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
let isCacheDisabled = false;
async function lookupCache(prompt) {
    if (isCacheDisabled)
        return null;
    try {
        const config = (0, embeddings_1.getSystemEmbeddingConfig)();
        const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
        await (0, db_1.ensureVectorTable)(dimensions);
        const promptVector = await embeddings.embedQuery(prompt);
        const vectorBuffer = Buffer.from(new Float32Array(promptVector).buffer);
        const row = await db_1.dbOps.get('SELECT c.response_json, vec_distance_cosine(v.embedding, ?) as distance FROM semantic_cache_vec v JOIN semantic_cache c ON v.id = c.id WHERE distance < ? ORDER BY distance ASC LIMIT 1', [vectorBuffer, 1 - SIMILARITY_THRESHOLD]);
        if (row) {
            const score = (1 - row.distance).toFixed(4);
            console.log('[Optima] Semantic Cache Hit! (Score: ' + score + ')');
            return JSON.parse(row.response_json);
        }
    }
    catch (err) {
        const isConnectionError = err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'));
        if (isConnectionError) {
            console.warn('[Optima] Semantic cache disabled for this session because the embedding server is unreachable.');
            isCacheDisabled = true;
        }
        else {
            console.warn('[Optima] Cache lookup failed', err);
        }
    }
    return null;
}
async function saveCache(prompt, response) {
    if (isCacheDisabled)
        return;
    try {
        const config = (0, embeddings_1.getSystemEmbeddingConfig)();
        const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
        await (0, db_1.ensureVectorTable)(dimensions);
        const id = crypto_1.default.createHash('sha256').update(prompt).digest('hex');
        const promptVector = await embeddings.embedQuery(prompt);
        const vectorBuffer = Buffer.from(new Float32Array(promptVector).buffer);
        await db_1.dbOps.run('BEGIN TRANSACTION');
        try {
            await db_1.dbOps.run('INSERT OR REPLACE INTO semantic_cache (id, prompt_text, response_json, provider, model) VALUES (?, ?, ?, ?, ?)', [id, prompt, JSON.stringify(response), config.provider, response.model]);
            await db_1.dbOps.run('INSERT OR REPLACE INTO semantic_cache_vec (id, embedding) VALUES (?, ?)', [id, vectorBuffer]);
            await db_1.dbOps.run('COMMIT');
        }
        catch (e) {
            await db_1.dbOps.run('ROLLBACK');
            throw e;
        }
        console.log('[Optima] Saved to Semantic Cache');
    }
    catch (err) {
        const isConnectionError = err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'));
        if (isConnectionError) {
            isCacheDisabled = true;
        }
        else {
            console.warn('[Optima] Cache save failed', err);
        }
    }
}
