# FastPageAnalyzer

## Overview

The `FastPageAnalyzer` class provides instant page analysis capabilities for the Enhanced Browser Research System. It analyzes web pages in under 200ms using heuristic methods, enabling fast and confident research without AI calls for 80% of pages.

## Features

- **Fast-path analysis** (< 50ms) for obvious cases (404, login walls, cookie pages)
- **Quality scoring** (0-100) based on keyword matches, structured data, pricing, ratings, and content depth
- **Content type classification** (pricing, features, reviews, docs, product, irrelevant)
- **Structured data extraction** (JSON-LD, OpenGraph, Schema.org microdata)
- **Relevant section identification** with relevance scores
- **Key fact extraction** using heuristic pattern matching

## Usage

```typescript
import { FastPageAnalyzer } from './fast-page-analyzer';
import type { PageContent, ResearchContext } from './enhanced-browser-research-types';

// Create analyzer instance
const analyzer = new FastPageAnalyzer();

// Define page content
const content: PageContent = {
  url: 'https://example.com/pricing',
  title: 'Pricing Plans',
  metaDescription: 'Our pricing plans',
  headings: ['Basic Plan', 'Pro Plan'],
  paragraphs: ['We offer flexible pricing options'],
  tables: [],
  links: [],
  rawText: 'Pricing plans for our product. Basic plan starts at $10/month.',
  domTree: '<div>pricing</div>',
  prices: ['$10/month', '$50/month'],
  ratings: [],
  contentHash: 'hash123',
  extractedAt: Date.now()
};

// Define research context
const context: ResearchContext = {
  query: 'pricing',
  keywords: ['pricing', 'plans'],
  targetDomains: [],
  requiredInfo: []
};

// Analyze page
const result = await analyzer.analyzeOnFirstPass(content, context);

console.log(`Quality Score: ${result.qualityScore}`);
console.log(`Content Type: ${result.contentType}`);
console.log(`Is Relevant: ${result.isRelevant}`);
console.log(`Key Facts: ${result.keyFacts.join(', ')}`);
console.log(`Processing Time: ${result.processingTime}ms`);
```

## Methods

### `analyzeOnFirstPass(content, context)`

Analyzes a page on first pass without re-reading. Must complete in < 200ms.

**Parameters:**
- `content: PageContent` - The page content to analyze
- `context: ResearchContext` - The research context with keywords and goals

**Returns:** `Promise<PageAnalysisResult>` with quality score, content type, key facts, and next actions

### `scorePageQuality(content, context)`

Scores page quality using heuristic scoring (no AI calls). Returns a score between 0 and 100.

**Parameters:**
- `content: PageContent` - The page content to score
- `context: ResearchContext` - The research context

**Returns:** `QualityScore` with overall score and quality signals

### `identifyRelevantSections(content)`

Identifies relevant sections of page content with relevance scores.

**Parameters:**
- `content: PageContent` - The page content to analyze

**Returns:** `ContentSection[]` - Array of relevant sections sorted by relevance score

### `extractStructuredData(content)`

Extracts structured data from page content (JSON-LD, OpenGraph, Schema.org microdata) in a single pass.

**Parameters:**
- `content: PageContent` - The page content to extract from

**Returns:** `StructuredData[]` - Array of extracted structured data

### `classifyContentType(content)`

Classifies content type based on URL patterns and page structure.

**Parameters:**
- `content: PageContent` - The page content to classify

**Returns:** `ContentType` - One of: pricing, features, reviews, docs, product, irrelevant

## Quality Scoring

The quality score is calculated based on multiple signals:

- **Keyword matches** (10 points per keyword, max 50 points)
- **Structured data** (+20 points)
- **Pricing information** (+15 points)
- **Rating information** (+10 points)
- **Content depth** (+15 points for > 2000 chars)
- **Authority indicators** (+2-5 points for docs, blog, meta description)

Score ranges:
- **0-39**: Low quality (skip page)
- **40-59**: Medium quality (scroll for more content)
- **60-100**: High quality (extract facts)

## Performance

- **Fast-path analysis**: < 50ms for obvious cases (404, login, cookie pages)
- **Full analysis**: < 200ms for all pages
- **No AI calls**: 80% of pages analyzed using heuristics only

## Testing

Run unit tests:

```bash
npm test -- fast-page-analyzer.test.ts --run
```

## Requirements Validated

- **Requirement 1.1**: Page analysis completes within 200ms
- **Requirement 1.3**: Quality score between 0 and 100
- **Requirement 1.4**: Structured data extraction in single pass
- **Requirement 1.6**: Content type classification

## Related Files

- `enhanced-browser-research-types.ts` - Type definitions and schemas
- `__tests__/fast-page-analyzer.test.ts` - Unit tests
