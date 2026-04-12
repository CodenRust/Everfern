"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupCache = lookupCache;
exports.saveCache = saveCache;
const db_1 = require("./db");
const embeddings_1 = require("./embeddings");
const crypto_1 = __importDefault(require("crypto"));
const SIMILARITY_THRESHOLD = 0.96;
const CACHE_RETRY_ATTEMPTS = 3;
const CACHE_TIMEOUT_MS = 5000;
let isCacheDisabled = false;
let cacheHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
// Circuit breaker pattern for cache reliability
class CacheCircuitBreaker {
    failures = 0;
    lastFailure = 0;
    maxFailures = 5;
    resetTimeout = 30000; // 30 seconds
    isOpen() {
        if (this.failures >= this.maxFailures) {
            if (Date.now() - this.lastFailure > this.resetTimeout) {
                this.reset();
                return false;
            }
            return true;
        }
        return false;
    }
    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
    }
    recordSuccess() {
        this.failures = Math.max(0, this.failures - 1);
    }
    reset() {
        this.failures = 0;
        this.lastFailure = 0;
    }
}
const circuitBreaker = new CacheCircuitBreaker();
async function withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Cache operation timed out')), timeoutMs));
    return Promise.race([promise, timeoutPromise]);
}
async function checkCacheHealth() {
    if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
        return cacheHealthy;
    }
    try {
        // Simple health check - try to query the database
        await withTimeout(db_1.dbOps.get('SELECT 1'), 2000);
        cacheHealthy = true;
        lastHealthCheck = Date.now();
        return true;
    }
    catch (err) {
        cacheHealthy = false;
        lastHealthCheck = Date.now();
        console.warn('[Cache] Health check failed:', err instanceof Error ? err.message : String(err));
        return false;
    }
}
async function lookupCache(prompt) {
    if (isCacheDisabled || circuitBreaker.isOpen())
        return null;
    // Check cache health before proceeding
    if (!(await checkCacheHealth())) {
        return null;
    }
    for (let attempt = 1; attempt <= CACHE_RETRY_ATTEMPTS; attempt++) {
        try {
            const config = (0, embeddings_1.getSystemEmbeddingConfig)();
            const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
            await (0, db_1.ensureVectorTable)(dimensions);
            const promptVector = await withTimeout(embeddings.embedQuery(prompt), CACHE_TIMEOUT_MS);
            const vectorBuffer = Buffer.from(new Float32Array(promptVector).buffer);
            const row = await withTimeout(db_1.dbOps.get('SELECT c.response_json, vec_distance_cosine(v.embedding, ?) as distance FROM semantic_cache_vec v JOIN semantic_cache c ON v.id = c.id WHERE distance < ? ORDER BY distance ASC LIMIT 1', [vectorBuffer, 1 - SIMILARITY_THRESHOLD]), CACHE_TIMEOUT_MS);
            if (row) {
                const score = (1 - row.distance).toFixed(4);
                console.log('[Optima] Semantic Cache Hit! (Score: ' + score + ')');
                circuitBreaker.recordSuccess();
                return JSON.parse(row.response_json);
            }
            // No cache hit, but operation succeeded
            circuitBreaker.recordSuccess();
            return null;
        }
        catch (err) {
            const isConnectionError = err instanceof Error && (err.message.includes('fetch failed') ||
                err.message.includes('ECONNREFUSED') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('timed out'));
            if (isConnectionError) {
                console.warn(`[Optima] Cache lookup failed (attempt ${attempt}/${CACHE_RETRY_ATTEMPTS}):`, err instanceof Error ? err.message : String(err));
                circuitBreaker.recordFailure();
                if (attempt === CACHE_RETRY_ATTEMPTS) {
                    console.warn('[Optima] Semantic cache disabled for this session due to repeated failures.');
                    isCacheDisabled = true;
                }
            }
            else {
                console.warn('[Optima] Cache lookup failed', err);
                circuitBreaker.recordFailure();
            }
            // Don't retry on non-connection errors
            if (!isConnectionError)
                break;
        }
    }
    return null;
}
async function saveCache(prompt, response) {
    if (isCacheDisabled || circuitBreaker.isOpen())
        return;
    // Check cache health before proceeding
    if (!(await checkCacheHealth())) {
        return;
    }
    for (let attempt = 1; attempt <= CACHE_RETRY_ATTEMPTS; attempt++) {
        try {
            const config = (0, embeddings_1.getSystemEmbeddingConfig)();
            const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
            await (0, db_1.ensureVectorTable)(dimensions);
            const id = crypto_1.default.createHash('sha256').update(prompt).digest('hex');
            const promptVector = await withTimeout(embeddings.embedQuery(prompt), CACHE_TIMEOUT_MS);
            const vectorBuffer = Buffer.from(new Float32Array(promptVector).buffer);
            await withTimeout(db_1.dbOps.run('BEGIN TRANSACTION'), CACHE_TIMEOUT_MS);
            try {
                await withTimeout(db_1.dbOps.run('INSERT OR REPLACE INTO semantic_cache (id, prompt_text, response_json, provider, model) VALUES (?, ?, ?, ?, ?)', [id, prompt, JSON.stringify(response), config.provider, response.model]), CACHE_TIMEOUT_MS);
                await withTimeout(db_1.dbOps.run('INSERT OR REPLACE INTO semantic_cache_vec (id, embedding) VALUES (?, ?)', [id, vectorBuffer]), CACHE_TIMEOUT_MS);
                await withTimeout(db_1.dbOps.run('COMMIT'), CACHE_TIMEOUT_MS);
                console.log('[Optima] Saved to Semantic Cache');
                circuitBreaker.recordSuccess();
                return;
            }
            catch (e) {
                await db_1.dbOps.run('ROLLBACK').catch(() => { }); // Ignore rollback errors
                throw e;
            }
        }
        catch (err) {
            const isConnectionError = err instanceof Error && (err.message.includes('fetch failed') ||
                err.message.includes('ECONNREFUSED') ||
                err.message.includes('ENOTFOUND') ||
                err.message.includes('timed out'));
            if (isConnectionError) {
                console.warn(`[Optima] Cache save failed (attempt ${attempt}/${CACHE_RETRY_ATTEMPTS}):`, err instanceof Error ? err.message : String(err));
                circuitBreaker.recordFailure();
                if (attempt === CACHE_RETRY_ATTEMPTS) {
                    isCacheDisabled = true;
                }
            }
            else {
                console.warn('[Optima] Cache save failed', err);
                circuitBreaker.recordFailure();
            }
            // Don't retry on non-connection errors
            if (!isConnectionError)
                break;
        }
    }
}
