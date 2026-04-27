"use strict";
/**
 * Intelligent Caching System for Browser-Use Tool
 *
 * Implements caching for relevance assessments and URL classifications
 * to optimize performance and reduce redundant AI calls.
 *
 * Requirements: 6.3, 6.4
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentCacheManager = exports.PatternCache = exports.RelevanceCache = void 0;
exports.createCacheManager = createCacheManager;
const crypto = __importStar(require("crypto"));
/**
 * Relevance assessment cache
 * Caches AI-powered relevance assessments for content
 *
 * Requirements: 6.3
 */
class RelevanceCache {
    cache = new Map();
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0
    };
    maxSize;
    defaultTTL;
    constructor(maxSize = 1000, defaultTTL = 3600000) {
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
    }
    /**
     * Generate cache key from content and context
     */
    generateKey(content, context) {
        const contentHash = crypto
            .createHash('sha256')
            .update(content.title + content.url + content.metaDescription)
            .digest('hex');
        const contextHash = crypto
            .createHash('sha256')
            .update(context.taskDescription + context.keywords.join(','))
            .digest('hex');
        return `relevance_${contentHash}_${contextHash}`;
    }
    /**
     * Get cached assessment
     */
    get(content, context) {
        const key = this.generateKey(content, context);
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.evictions++;
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }
        // Update access stats
        entry.hits++;
        entry.lastAccessed = Date.now();
        this.stats.hits++;
        this.updateHitRate();
        return entry.value;
    }
    /**
     * Store assessment in cache
     */
    set(content, context, assessment, ttl = this.defaultTTL) {
        const key = this.generateKey(content, context);
        // Evict if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value: assessment,
            timestamp: Date.now(),
            ttl,
            hits: 0,
            lastAccessed: Date.now()
        });
        this.stats.size = this.cache.size;
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let lruKey = null;
        let lruTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < lruTime) {
                lruTime = entry.lastAccessed;
                lruKey = key;
            }
        }
        if (lruKey) {
            this.cache.delete(lruKey);
            this.stats.evictions++;
        }
    }
    /**
     * Invalidate cache entries matching pattern
     */
    invalidateByPattern(pattern) {
        const regex = new RegExp(pattern);
        let invalidated = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                invalidated++;
            }
        }
        this.stats.evictions += invalidated;
        this.stats.size = this.cache.size;
    }
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
        this.stats.size = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Update hit rate
     */
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
}
exports.RelevanceCache = RelevanceCache;
/**
 * URL pattern cache
 * Caches URL classification results
 *
 * Requirements: 6.3, 6.4
 */
class PatternCache {
    cache = new Map();
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        hitRate: 0
    };
    maxSize;
    defaultTTL;
    constructor(maxSize = 5000, defaultTTL = 7200000) {
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
    }
    /**
     * Generate cache key from URL and context
     */
    generateKey(url, keywords) {
        const urlHash = crypto
            .createHash('sha256')
            .update(url)
            .digest('hex');
        const keywordHash = crypto
            .createHash('sha256')
            .update(keywords.join(','))
            .digest('hex');
        return `pattern_${urlHash}_${keywordHash}`;
    }
    /**
     * Get cached classification
     */
    get(url, keywords) {
        const key = this.generateKey(url, keywords);
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.stats.evictions++;
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }
        // Update access stats
        entry.hits++;
        entry.lastAccessed = Date.now();
        this.stats.hits++;
        this.updateHitRate();
        return entry.value;
    }
    /**
     * Store classification in cache
     */
    set(url, keywords, classification, ttl = this.defaultTTL) {
        const key = this.generateKey(url, keywords);
        // Evict if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value: classification,
            timestamp: Date.now(),
            ttl,
            hits: 0,
            lastAccessed: Date.now()
        });
        this.stats.size = this.cache.size;
    }
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let lruKey = null;
        let lruTime = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < lruTime) {
                lruTime = entry.lastAccessed;
                lruKey = key;
            }
        }
        if (lruKey) {
            this.cache.delete(lruKey);
            this.stats.evictions++;
        }
    }
    /**
     * Invalidate cache entries matching pattern
     */
    invalidateByPattern(pattern) {
        const regex = new RegExp(pattern);
        let invalidated = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                invalidated++;
            }
        }
        this.stats.evictions += invalidated;
        this.stats.size = this.cache.size;
    }
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
        this.stats.size = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Update hit rate
     */
    updateHitRate() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
}
exports.PatternCache = PatternCache;
/**
 * Unified cache manager for intelligent site selection
 *
 * Requirements: 6.3, 6.4
 */
class IntelligentCacheManager {
    relevanceCache;
    patternCache;
    config;
    constructor(config) {
        this.config = config;
        this.relevanceCache = new RelevanceCache(config.cacheConfig?.maxRelevanceEntries || 1000, config.cacheConfig?.relevanceTTL || 3600000);
        this.patternCache = new PatternCache(config.cacheConfig?.maxPatternEntries || 5000, config.cacheConfig?.patternTTL || 7200000);
    }
    /**
     * Get cached relevance assessment
     */
    getCachedRelevance(content, context) {
        if (!this.config.cachingEnabled)
            return null;
        return this.relevanceCache.get(content, context);
    }
    /**
     * Cache relevance assessment
     */
    cacheRelevance(content, context, assessment) {
        if (!this.config.cachingEnabled)
            return;
        this.relevanceCache.set(content, context, assessment);
    }
    /**
     * Get cached URL classification
     */
    getCachedClassification(url, keywords) {
        if (!this.config.cachingEnabled)
            return null;
        return this.patternCache.get(url, keywords);
    }
    /**
     * Cache URL classification
     */
    cacheClassification(url, keywords, classification) {
        if (!this.config.cachingEnabled)
            return;
        this.patternCache.set(url, keywords, classification);
    }
    /**
     * Invalidate cache based on criteria
     */
    invalidateCache(criteria) {
        if (criteria.type === 'relevance' || criteria.type === 'all') {
            if (criteria.pattern) {
                this.relevanceCache.invalidateByPattern(criteria.pattern);
            }
            else {
                this.relevanceCache.clear();
            }
        }
        if (criteria.type === 'pattern' || criteria.type === 'all') {
            if (criteria.pattern) {
                this.patternCache.invalidateByPattern(criteria.pattern);
            }
            else {
                this.patternCache.clear();
            }
        }
    }
    /**
     * Get combined cache statistics
     */
    getStats() {
        const relevanceStats = this.relevanceCache.getStats();
        const patternStats = this.patternCache.getStats();
        return {
            relevance: relevanceStats,
            pattern: patternStats,
            combined: {
                hits: relevanceStats.hits + patternStats.hits,
                misses: relevanceStats.misses + patternStats.misses,
                evictions: relevanceStats.evictions + patternStats.evictions,
                size: relevanceStats.size + patternStats.size,
                hitRate: (relevanceStats.hits + patternStats.hits) /
                    (relevanceStats.hits + relevanceStats.misses + patternStats.hits + patternStats.misses)
            }
        };
    }
    /**
     * Clear all caches
     */
    clearAll() {
        this.relevanceCache.clear();
        this.patternCache.clear();
    }
    /**
     * Manage cache lifecycle - cleanup expired entries
     */
    manageCacheLifecycle() {
        // This is called periodically to clean up expired entries
        // The individual caches handle this on access, but we can add
        // periodic cleanup here if needed
        const stats = this.getStats();
        console.debug('Cache lifecycle management - Stats:', stats);
    }
    /**
     * Optimize cache performance based on hit rates
     */
    optimizeCachePerformance() {
        const stats = this.getStats();
        // If hit rate is very low, consider clearing cache
        if (stats.combined.hitRate < 0.1 && stats.combined.size > 100) {
            console.debug('Low cache hit rate, clearing caches');
            this.clearAll();
        }
        // Log performance metrics
        console.debug('Cache performance optimization - Hit rate:', stats.combined.hitRate);
    }
}
exports.IntelligentCacheManager = IntelligentCacheManager;
/**
 * Create cache manager with default configuration
 */
function createCacheManager(config) {
    return new IntelligentCacheManager(config);
}
