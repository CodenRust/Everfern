# Speed Optimization Layer

## Overview

The Speed Optimization Layer minimizes research latency through parallel execution, session-scoped caching, and intelligent URL pre-filtering. It ensures fast research by avoiding redundant page analysis and processing multiple pages concurrently.

## Features

### 1. Parallel Page Analysis (Requirements 5.1, 5.6)

Processes multiple pages concurrently using `Promise.all`, significantly reducing total analysis time compared to sequential processing.

```typescript
const pages = [page1, page2, page3];
const results = await speedOptimizer.parallelizeAnalysis(pages, context);
// Processes all pages in parallel, much faster than sequential
```

### 2. Session-Scoped Caching (Requirements 5.2, 5.3, 5.5)

Caches page analysis results by content hash to avoid re-analyzing the same content:

- **LRU Eviction**: Automatically evicts least recently used entries when cache reaches 500 entries
- **TTL Support**: Cache entries expire after 1 hour by default
- **Content Hash**: Uses title + URL + first 500 chars for unique identification

```typescript
// Cache a result
speedOptimizer.cachePageAnalysis(contentHash, analysisResult);

// Retrieve cached result
const cached = speedOptimizer.getCachedAnalysis(contentHash);
if (cached) {
  console.log('Cache hit!');
}
```

### 3. URL Pre-Filtering (Requirement 5.4)

Filters low-quality URLs before navigation to avoid wasting time on irrelevant pages:

```typescript
// Filter URLs with score < 40
const filteredQueue = speedOptimizer.skipLowQualityPages(urlQueue);
// Only high-quality URLs remain
```

### 4. URL Quality Estimation

Pre-scores URLs based on patterns before visiting them:

```typescript
const urls = ['https://example.com/pricing', 'https://example.com/login'];
const scored = speedOptimizer.preFilterUrls(urls, context);
// Returns: [{ url: '...', score: 75 }, { url: '...', score: 20 }]
```

## Usage Examples

### Basic Usage

```typescript
import { createSpeedOptimizationLayer } from './speed-optimization-layer';
import { createFastPageAnalyzer } from './fast-page-analyzer';

// Create instances
const analyzer = createFastPageAnalyzer();
const speedOptimizer = createSpeedOptimizationLayer(analyzer);

// Parallel analysis
const pages = await extractMultiplePages([url1, url2, url3]);
const results = await speedOptimizer.parallelizeAnalysis(pages, context);

// Check cache statistics
const stats = speedOptimizer.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### Integration with Research Flow

```typescript
// Pre-filter URLs
const urlEntries = speedOptimizer.preFilterUrls(candidateUrls, context);
const queue = createURLQueue();
urlEntries.forEach(entry => queue.enqueue(entry.url, entry.score));

// Filter low-quality URLs
const filteredQueue = speedOptimizer.skipLowQualityPages(queue);

// Process remaining URLs with caching
while (!filteredQueue.isEmpty()) {
  const url = filteredQueue.dequeue();
  const page = await extractPageContent(url);

  // Check cache first
  let result = speedOptimizer.getCachedAnalysis(page.contentHash);

  if (!result) {
    // Analyze and cache
    result = await analyzer.analyzeOnFirstPass(page, context);
    speedOptimizer.cachePageAnalysis(page.contentHash, result);
  }

  // Use result...
}
```

### Custom Configuration

```typescript
// Create with custom settings
const speedOptimizer = createSpeedOptimizationLayer(
  analyzer,
  1000,      // Max cache size: 1000 entries
  7200000    // TTL: 2 hours
);
```

## Performance Characteristics

### Parallel Analysis Speedup

For N pages analyzed in parallel:
- **Sequential**: N × 200ms = N × 200ms
- **Parallel**: ~200ms (all pages analyzed concurrently)
- **Speedup**: ~N× faster

Example with 5 pages:
- Sequential: 5 × 200ms = 1000ms
- Parallel: ~200ms
- **5× speedup**

### Cache Performance

- **Cache Hit**: ~1ms (instant retrieval)
- **Cache Miss**: ~200ms (full analysis)
- **Speedup on Hit**: ~200× faster

With 50% hit rate on 10 pages:
- Without cache: 10 × 200ms = 2000ms
- With cache: 5 × 200ms + 5 × 1ms = 1005ms
- **~2× speedup**

### URL Pre-Filtering

Skipping low-quality URLs (score < 40) saves:
- Navigation time: ~500ms per URL
- Analysis time: ~200ms per URL
- **Total savings**: ~700ms per skipped URL

## Cache Statistics

Monitor cache performance:

```typescript
const stats = speedOptimizer.getStats();
console.log({
  hits: stats.hits,           // Number of cache hits
  misses: stats.misses,       // Number of cache misses
  evictions: stats.evictions, // Number of LRU evictions
  size: stats.size,           // Current cache size
  hitRate: stats.hitRate      // Hit rate (0-1)
});
```

## Cache Management

### Automatic Optimization

The layer automatically optimizes cache performance:

```typescript
// Periodically optimize cache
speedOptimizer.optimizeCachePerformance();
// Clears cache if hit rate < 10% and size > 100
```

### Manual Cache Control

```typescript
// Clear entire cache
speedOptimizer.clearCache();

// Get current statistics
const stats = speedOptimizer.getStats();
```

## Content Hash Generation

Generate content hash for caching:

```typescript
import { SpeedOptimizationLayer } from './speed-optimization-layer';

const hash = SpeedOptimizationLayer.generateContentHash(pageContent);
// Uses: title + url + first 500 chars of text
```

## Integration Points

### With FastPageAnalyzer

The SpeedOptimizationLayer wraps FastPageAnalyzer to add caching:

```typescript
const analyzer = createFastPageAnalyzer();
const speedOptimizer = createSpeedOptimizationLayer(analyzer);

// Analyzer is used internally for cache misses
const result = await speedOptimizer.parallelizeAnalysis([page], context);
```

### With URLQueue

Works seamlessly with URLQueue for filtering:

```typescript
import { createURLQueue } from './url-queue';

const queue = createURLQueue();
queue.enqueue('https://example.com/pricing', 80);
queue.enqueue('https://example.com/login', 20);

const filtered = speedOptimizer.skipLowQualityPages(queue);
// Only URLs with score >= 40 remain
```

### With Research Orchestrator

Integrates into the research flow:

```typescript
// In ComplexResearchOrchestrator
const speedOptimizer = createSpeedOptimizationLayer();

// Parallel analysis of multiple tabs
const tabPages = await Promise.all(tabs.map(t => extractPageContent(t)));
const results = await speedOptimizer.parallelizeAnalysis(tabPages, context);

// Pre-filter URLs before visiting
const urlEntries = speedOptimizer.preFilterUrls(candidateUrls, context);
```

## Requirements Validation

- ✅ **5.1**: Parallel page analysis using Promise.all
- ✅ **5.2**: Session-scoped page cache by content hash
- ✅ **5.3**: Cache retrieval for previously visited URLs
- ✅ **5.4**: URL pre-filtering by quality score threshold
- ✅ **5.5**: LRU eviction at 500 entries
- ✅ **5.6**: Parallel analysis faster than sequential

## Testing

See `main/agent/tools/__tests__/speed-optimization-layer.test.ts` for:
- Unit tests for caching behavior
- Parallel analysis performance tests
- URL filtering tests
- LRU eviction tests
- Cache statistics tests

## Performance Benchmarks

Expected performance characteristics:
- **Page Analysis**: < 200ms per page
- **Cache Hit**: < 1ms retrieval
- **Parallel Speedup**: ~N× for N pages
- **Cache Hit Rate**: > 30% in typical sessions
- **LRU Eviction**: < 10ms per eviction

## Best Practices

1. **Reuse Instances**: Create one SpeedOptimizationLayer per session
2. **Monitor Hit Rate**: Check cache statistics periodically
3. **Tune Cache Size**: Adjust based on memory constraints
4. **Pre-Filter Early**: Filter URLs before queueing to save memory
5. **Clear on Context Change**: Clear cache when research context changes significantly

## Troubleshooting

### Low Cache Hit Rate

If hit rate is < 10%:
- Check if content hashes are being generated correctly
- Verify TTL is not too short
- Ensure same pages are being revisited

### High Memory Usage

If cache grows too large:
- Reduce `maxCacheSize` parameter
- Decrease `cacheTTL` to expire entries sooner
- Call `clearCache()` between research sessions

### Slow Parallel Analysis

If parallel analysis is not faster:
- Check if pages are being analyzed sequentially by mistake
- Verify Promise.all is being used correctly
- Ensure analyzer is not blocking on I/O
