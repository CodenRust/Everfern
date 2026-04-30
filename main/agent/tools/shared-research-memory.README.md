# SharedResearchMemory

## Overview

The `SharedResearchMemory` class provides cross-tab knowledge sharing for the Enhanced Browser Research System. It enables parallel research tabs to avoid redundant work and synthesize information effectively by sharing facts, visited URLs, and URL queues across all tabs.

## Features

- **Fact Management**: Store and retrieve extracted facts from research
- **URL Tracking**: Track visited URLs to avoid redundant visits
- **URL Queue**: Priority queue for URLs to visit, sorted by relevance score
- **Automatic Deduplication**: Skip already-visited URLs automatically
- **Capacity Limits**: Enforce limits to prevent memory issues
- **URL Normalization**: Handle URL variations to avoid duplicates
- **Cross-Tab Sharing**: All tabs share the same memory instance

## Installation

```typescript
import { createSharedResearchMemory } from './shared-research-memory';

const memory = createSharedResearchMemory();
```

## API Reference

### Methods

#### `addFact(fact: ExtractedFact): void`

Add a fact to the shared memory. Automatically marks the fact's URL as visited.

**Capacity Limit**: Maximum 100 facts per session (Requirement 7.5)

```typescript
const fact: ExtractedFact = {
  url: 'https://example.com',
  title: 'Example Product',
  summary: 'Product description with pricing and features...',
  prices: ['$10/month', '$30/month'],
  ratings: ['4.5/5'],
  keyFacts: ['Fast', 'Reliable', 'Affordable'],
  timestamp: Date.now(),
  confidence: 0.95,
  source: 'structured_data'
};

memory.addFact(fact);
```

#### `markVisited(url: string): void`

Mark a URL as visited. URLs are normalized to avoid duplicates.

**Capacity Limit**: Maximum 500 visited URLs per session (Requirement 7.6)

```typescript
memory.markVisited('https://example.com/pricing');
```

#### `hasVisited(url: string): boolean`

Check if a URL has been visited. Handles URL normalization automatically.

```typescript
if (!memory.hasVisited('https://example.com/features')) {
  // Visit the URL
}
```

#### `queueUrl(url: string, score: number): void`

Queue a URL for visiting with a priority score (0-100). URLs are sorted by score descending (best URLs first).

**Automatic Deduplication**: Skips already-visited URLs (Requirement 7.4)

```typescript
memory.queueUrl('https://example.com/features', 85);
memory.queueUrl('https://example.com/pricing', 90);
```

#### `dequeueUrl(): string | undefined`

Dequeue the highest-priority URL from the queue. Returns `undefined` if queue is empty.

```typescript
const nextUrl = memory.dequeueUrl();
if (nextUrl) {
  // Visit the URL
}
```

#### `getFactCount(): number`

Get the number of facts in memory.

```typescript
console.log(`Facts collected: ${memory.getFactCount()}`);
```

#### `getVisitedCount(): number`

Get the number of visited URLs.

```typescript
console.log(`URLs visited: ${memory.getVisitedCount()}`);
```

#### `getSummary(): string`

Get a formatted summary of all facts in memory.

```typescript
const summary = memory.getSummary();
console.log(summary);
```

#### `getFacts(): ExtractedFact[]`

Get all facts as an array (returns a copy).

```typescript
const facts = memory.getFacts();
for (const fact of facts) {
  console.log(fact.title);
}
```

#### `getStats(): object`

Get statistics about the memory state.

```typescript
const stats = memory.getStats();
console.log(`Facts: ${stats.factCount}`);
console.log(`Visited: ${stats.visitedCount}`);
console.log(`Queue size: ${stats.queueSize}`);
console.log(`Fact capacity remaining: ${stats.factCapacityRemaining}`);
console.log(`Visited capacity remaining: ${stats.visitedCapacityRemaining}`);
```

#### `clear(): void`

Clear all data (useful for testing).

```typescript
memory.clear();
```

## Usage Examples

### Example 1: Multi-Tab Research

```typescript
import { createSharedResearchMemory } from './shared-research-memory';

// Create shared memory (shared across all tabs)
const sharedMemory = createSharedResearchMemory();

// Tab 1: Research pricing
sharedMemory.markVisited('https://example.com/pricing');
sharedMemory.addFact({
  url: 'https://example.com/pricing',
  title: 'Pricing Information',
  summary: 'Product offers three tiers: Basic ($10), Pro ($30), Enterprise (custom)...',
  prices: ['$10/month', '$30/month', 'Custom'],
  ratings: [],
  keyFacts: ['Basic: 10 users', 'Pro: 50 users', 'Enterprise: unlimited'],
  timestamp: Date.now(),
  confidence: 0.95,
  source: 'structured_data'
});

// Queue related URLs for other tabs
sharedMemory.queueUrl('https://example.com/features', 85);
sharedMemory.queueUrl('https://example.com/reviews', 80);

// Tab 2: Research features (using shared knowledge)
const nextUrl = sharedMemory.dequeueUrl(); // Gets features URL
if (!sharedMemory.hasVisited(nextUrl!)) {
  sharedMemory.markVisited(nextUrl!);
  // Extract and add feature facts...
}

// Tab 3: Research reviews (using shared knowledge)
const reviewUrl = sharedMemory.dequeueUrl(); // Gets reviews URL
if (!sharedMemory.hasVisited(reviewUrl!)) {
  sharedMemory.markVisited(reviewUrl!);
  // Extract and add review facts...
}

// All tabs can access all facts
console.log(sharedMemory.getSummary());
```

### Example 2: URL Deduplication

```typescript
const memory = createSharedResearchMemory();

// Mark URL as visited
memory.markVisited('https://example.com/page');

// Try to queue the same URL (will be skipped)
memory.queueUrl('https://example.com/page', 90);
memory.queueUrl('https://example.com/page/', 85); // Normalized to same URL

const url = memory.dequeueUrl(); // Returns undefined (already visited)
```

### Example 3: Capacity Limits

```typescript
const memory = createSharedResearchMemory();

// Add facts up to limit (100)
for (let i = 0; i < 100; i++) {
  memory.addFact({
    url: `https://example.com/${i}`,
    title: `Fact ${i}`,
    summary: `Summary for fact ${i} with enough characters to meet requirements...`,
    prices: [],
    ratings: [],
    keyFacts: [],
    timestamp: Date.now(),
    confidence: 0.8,
    source: 'heuristic'
  });
}

console.log(memory.getFactCount()); // 100

// Try to add 101st fact (will be rejected)
memory.addFact({
  url: 'https://example.com/extra',
  title: 'Extra Fact',
  summary: 'This fact will not be added due to capacity limit...',
  prices: [],
  ratings: [],
  keyFacts: [],
  timestamp: Date.now(),
  confidence: 0.8,
  source: 'heuristic'
});

console.log(memory.getFactCount()); // Still 100
```

## Design Decisions

### URL Normalization

URLs are normalized to avoid duplicates:
- Trailing slashes are removed (except for root path)
- Protocol, hostname, pathname, search, and hash are preserved
- Invalid URLs are returned as-is

Examples:
- `https://example.com/` → `https://example.com`
- `https://example.com/page/` → `https://example.com/page`
- `https://example.com/page?q=test` → `https://example.com/page?q=test`

### Capacity Limits

Limits are enforced to prevent memory issues during long research sessions:
- **Facts**: Maximum 100 per session (LIMITS.MAX_FACTS_PER_SESSION)
- **Visited URLs**: Maximum 500 per session (LIMITS.MAX_VISITED_URLS)

When limits are reached, new additions are rejected with a warning logged to console.

### URL Queue Sorting

The URL queue is always sorted by score descending (best URLs first). This ensures that high-priority URLs are visited first.

### Cross-Tab Sharing

In a real implementation, the SharedResearchMemory instance would be shared across all browser tabs using a shared state mechanism (e.g., Redux, Zustand, or a custom event system). The current implementation provides the foundation for this cross-tab sharing.

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 7.1**: Facts are shared across all tabs via the shared memory instance
- **Requirement 7.2**: Visited URLs are tracked and shared across all tabs
- **Requirement 7.3**: URL visited status can be queried before queueing
- **Requirement 7.4**: Already-visited URLs are automatically skipped when queueing
- **Requirement 7.5**: Facts are limited to 100 per session
- **Requirement 7.6**: Visited URLs are limited to 500 per session

## Testing

Comprehensive unit tests are available in `__tests__/shared-research-memory.test.ts`:

```bash
npm test -- shared-research-memory.test.ts
```

Integration examples are available in `__tests__/shared-research-memory-integration.example.ts`.

## Performance Considerations

- **URL Normalization**: O(1) time complexity using URL parsing
- **URL Deduplication**: O(1) lookup using Set data structure
- **Queue Sorting**: O(n log n) when adding URLs, but amortized over many operations
- **Memory Usage**: Bounded by capacity limits (100 facts + 500 URLs)

## Future Enhancements

Potential improvements for future versions:

1. **Persistent Storage**: Save memory state to disk for session recovery
2. **LRU Eviction**: Implement least-recently-used eviction when at capacity
3. **Priority Boosting**: Boost priority of URLs related to high-quality facts
4. **Fact Deduplication**: Detect and merge duplicate facts from different sources
5. **Category Tracking**: Track fact distribution by category (pricing, features, reviews)
6. **Quality Metrics**: Track average fact quality and confidence scores

## Related Components

- **FastPageAnalyzer**: Analyzes pages and extracts facts
- **ComplexResearchOrchestrator**: Orchestrates multi-tab research using SharedResearchMemory
- **SmartNavigationEngine**: Navigates to URLs from the queue
- **SpeedOptimizationLayer**: Caches page analysis results

## License

Part of the Enhanced Browser Research System.
