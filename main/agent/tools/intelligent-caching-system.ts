/**
 * Intelligent Caching System for Browser-Use Tool
 *
 * Implements caching for relevance assessments and URL classifications
 * to optimize performance and reduce redundant AI calls.
 *
 * Requirements: 6.3, 6.4
 */

import * as crypto from 'crypto';
import {
  RelevanceAssessment,
  URLClassification,
  ResearchContext,
  PageContent,
  IntelligentSelectionConfig
} from './intelligent-site-selection';

/**
 * Cache entry with TTL and metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * Relevance assessment cache
 * Caches AI-powered relevance assessments for content
 *
 * Requirements: 6.3
 */
export class RelevanceCache {
  private cache: Map<string, CacheEntry<RelevanceAssessment>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) { // 1 hour default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key from content and context
   */
  private generateKey(content: PageContent, context: ResearchContext): string {
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
  get(content: PageContent, context: ResearchContext): RelevanceAssessment | null {
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
  set(
    content: PageContent,
    context: ResearchContext,
    assessment: RelevanceAssessment,
    ttl: number = this.defaultTTL
  ): void {
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
  private evictLRU(): void {
    let lruKey: string | null = null;
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
  invalidateByPattern(pattern: string): void {
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
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * URL pattern cache
 * Caches URL classification results
 *
 * Requirements: 6.3, 6.4
 */
export class PatternCache {
  private cache: Map<string, CacheEntry<URLClassification>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 5000, defaultTTL: number = 7200000) { // 2 hours default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key from URL and context
   */
  private generateKey(url: string, keywords: string[]): string {
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
  get(url: string, keywords: string[]): URLClassification | null {
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
  set(
    url: string,
    keywords: string[],
    classification: URLClassification,
    ttl: number = this.defaultTTL
  ): void {
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
  private evictLRU(): void {
    let lruKey: string | null = null;
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
  invalidateByPattern(pattern: string): void {
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
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Unified cache manager for intelligent site selection
 *
 * Requirements: 6.3, 6.4
 */
export class IntelligentCacheManager {
  private relevanceCache: RelevanceCache;
  private patternCache: PatternCache;
  private config: IntelligentSelectionConfig;

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
    this.relevanceCache = new RelevanceCache(
      config.cacheConfig?.maxRelevanceEntries || 1000,
      config.cacheConfig?.relevanceTTL || 3600000
    );
    this.patternCache = new PatternCache(
      config.cacheConfig?.maxPatternEntries || 5000,
      config.cacheConfig?.patternTTL || 7200000
    );
  }

  /**
   * Get cached relevance assessment
   */
  getCachedRelevance(
    content: PageContent,
    context: ResearchContext
  ): RelevanceAssessment | null {
    if (!this.config.cachingEnabled) return null;
    return this.relevanceCache.get(content, context);
  }

  /**
   * Cache relevance assessment
   */
  cacheRelevance(
    content: PageContent,
    context: ResearchContext,
    assessment: RelevanceAssessment
  ): void {
    if (!this.config.cachingEnabled) return;
    this.relevanceCache.set(content, context, assessment);
  }

  /**
   * Get cached URL classification
   */
  getCachedClassification(
    url: string,
    keywords: string[]
  ): URLClassification | null {
    if (!this.config.cachingEnabled) return null;
    return this.patternCache.get(url, keywords);
  }

  /**
   * Cache URL classification
   */
  cacheClassification(
    url: string,
    keywords: string[],
    classification: URLClassification
  ): void {
    if (!this.config.cachingEnabled) return;
    this.patternCache.set(url, keywords, classification);
  }

  /**
   * Invalidate cache based on criteria
   */
  invalidateCache(criteria: {
    type?: 'relevance' | 'pattern' | 'all';
    pattern?: string;
  }): void {
    if (criteria.type === 'relevance' || criteria.type === 'all') {
      if (criteria.pattern) {
        this.relevanceCache.invalidateByPattern(criteria.pattern);
      } else {
        this.relevanceCache.clear();
      }
    }

    if (criteria.type === 'pattern' || criteria.type === 'all') {
      if (criteria.pattern) {
        this.patternCache.invalidateByPattern(criteria.pattern);
      } else {
        this.patternCache.clear();
      }
    }
  }

  /**
   * Get combined cache statistics
   */
  getStats(): {
    relevance: CacheStats;
    pattern: CacheStats;
    combined: CacheStats;
  } {
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
  clearAll(): void {
    this.relevanceCache.clear();
    this.patternCache.clear();
  }

  /**
   * Manage cache lifecycle - cleanup expired entries
   */
  manageCacheLifecycle(): void {
    // This is called periodically to clean up expired entries
    // The individual caches handle this on access, but we can add
    // periodic cleanup here if needed
    const stats = this.getStats();
    console.debug('Cache lifecycle management - Stats:', stats);
  }

  /**
   * Optimize cache performance based on hit rates
   */
  optimizeCachePerformance(): void {
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

/**
 * Create cache manager with default configuration
 */
export function createCacheManager(config: IntelligentSelectionConfig): IntelligentCacheManager {
  return new IntelligentCacheManager(config);
}
