# Error Recovery Mechanisms - Usage Guide

This guide explains how to use the error recovery mechanisms in the Enhanced Browser Research System.

## Overview

The error recovery system provides graceful handling for:
- **Page load timeouts** (Requirement 8.1): Skip after 20s, continue to next URL
- **Element not found errors** (Requirement 8.2): Log after 3 retries, continue research
- **AI analysis failures** (Requirement 8.3, 8.5): Fall back to heuristic analysis, use cache if available
- **Browser crashes** (Requirement 8.4): Save state, restart, resume from checkpoint

## Components

### 1. ErrorRecoveryManager

Core error recovery manager that handles all recovery scenarios.

```typescript
import { createErrorRecoveryManager } from './error-recovery';
import { FastPageAnalyzer } from './fast-page-analyzer';

const analyzer = new FastPageAnalyzer();
const recoveryManager = createErrorRecoveryManager(analyzer);
```

### 2. ResilientPageAnalyzer

Wraps page analysis with automatic error recovery.

```typescript
import { createResilientPageAnalyzer } from './error-recovery-integration';

const resilientAnalyzer = createResilientPageAnalyzer(analyzer, recoveryManager);

// Analyze with automatic recovery
const result = await resilientAnalyzer.analyzeWithRecovery(content, context);
if (result.success) {
  console.log('Analysis:', result.data);
} else {
  console.log('Recovery method:', result.recoveryMethod);
}
```

### 3. ResilientBrowserNavigator

Wraps browser navigation with timeout recovery and checkpoint management.

```typescript
import { createResilientBrowserNavigator } from './error-recovery-integration';

const resilientNavigator = createResilientBrowserNavigator(
  recoveryManager,
  sharedMemory
);

// Navigate with timeout recovery
const result = await resilientNavigator.navigateWithRecovery(page, url, 20000);
if (!result.success) {
  // Get next URL after timeout
  const nextUrl = resilientNavigator.getNextUrl();
}
```

## Usage Examples

### Example 1: Page Load Timeout Recovery

```typescript
// Setup
const recoveryManager = createErrorRecoveryManager(analyzer);
const resilientNavigator = createResilientBrowserNavigator(
  recoveryManager,
  sharedMemory
);

// Queue URLs
sharedMemory.queueUrl('https://example.com/page1', 90);
sharedMemory.queueUrl('https://example.com/page2', 80);

// Try navigation with timeout recovery
const result = await resilientNavigator.navigateWithRecovery(
  page,
  'https://example.com/page1',
  20000 // 20 second timeout
);

if (!result.success && result.error?.includes('timeout')) {
  console.log('Page timed out, getting next URL');
  const nextUrl = resilientNavigator.getNextUrl();

  if (nextUrl) {
    // Continue with next URL
    await resilientNavigator.navigateWithRecovery(page, nextUrl, 20000);
  }
}
```

### Example 2: Element Not Found Recovery

```typescript
// Setup navigation engine with error recovery
const navigationEngine = new SmartNavigationEngine();
navigationEngine.setErrorRecoveryManager(recoveryManager);

// Try clicking element
const clickResult = await navigationEngine.clickElementWithContext(
  page,
  'button[data-action="submit"]',
  { maxRetries: 3, timeout: 5000 }
);

if (!clickResult.success) {
  // Error recovery automatically logged
  // Use fallback navigation
  const fallbackUrl = 'https://example.com/direct-link';
  await page.goto(fallbackUrl);
}
```

### Example 3: AI Failure with Cache Fallback

```typescript
// Setup resilient analyzer
const resilientAnalyzer = createResilientPageAnalyzer(analyzer, recoveryManager);

// First analysis - creates cache
const result1 = await resilientAnalyzer.analyzeWithRecovery(content, context);
console.log('First analysis:', result1.recoveryMethod); // 'heuristic_analysis'

// Second analysis - uses cache
const result2 = await resilientAnalyzer.analyzeWithRecovery(content, context);
console.log('Second analysis:', result2.recoveryMethod); // 'cached_analysis'
```

### Example 4: Browser Crash Recovery

```typescript
// Setup
const resilientNavigator = createResilientBrowserNavigator(
  recoveryManager,
  sharedMemory
);

// Save checkpoints during research
sharedMemory.queueUrl('https://example.com/page1', 90);
sharedMemory.queueUrl('https://example.com/page2', 80);

resilientNavigator.saveCheckpoint('https://example.com/page1');

// ... research continues ...

// If browser crashes, recover
try {
  // Browser operation that might crash
  await page.goto(url);
} catch (error) {
  if (error.message.includes('crash') || error.message.includes('disconnected')) {
    console.log('Browser crashed, recovering...');

    const recovery = resilientNavigator.recoverFromCrash();

    if (recovery.success) {
      console.log('Recovered from checkpoint:', recovery.data);

      // Restart browser and resume
      const newBrowser = await playwright.chromium.launch();
      const newPage = await newBrowser.newPage();

      // Continue with queued URLs
      const nextUrl = resilientNavigator.getNextUrl();
      if (nextUrl) {
        await resilientNavigator.navigateWithRecovery(newPage, nextUrl, 20000);
      }
    }
  }
}
```

### Example 5: Complete Research Flow with Error Recovery

```typescript
import {
  createErrorRecoveryManager,
  createResilientPageAnalyzer,
  createResilientBrowserNavigator
} from './enhanced-browser-research-types';

async function conductResearchWithRecovery(
  query: string,
  targetUrls: string[]
) {
  // Setup components
  const analyzer = new FastPageAnalyzer();
  const recoveryManager = createErrorRecoveryManager(analyzer);
  const sharedMemory = createSharedResearchMemory();

  const resilientAnalyzer = createResilientPageAnalyzer(analyzer, recoveryManager);
  const resilientNavigator = createResilientBrowserNavigator(
    recoveryManager,
    sharedMemory
  );

  // Queue target URLs
  for (const url of targetUrls) {
    sharedMemory.queueUrl(url, 80);
  }

  // Launch browser
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  try {
    // Research loop with error recovery
    while (true) {
      const url = resilientNavigator.getNextUrl();
      if (!url) break;

      // Save checkpoint before navigation
      resilientNavigator.saveCheckpoint(url);

      // Navigate with timeout recovery
      const navResult = await resilientNavigator.navigateWithRecovery(
        page,
        url,
        20000
      );

      if (!navResult.success) {
        console.log(`Navigation failed: ${navResult.error}`);
        continue; // Skip to next URL
      }

      // Extract content
      const content = await extractPageContent(page);

      // Analyze with AI failure recovery
      const analysisResult = await resilientAnalyzer.analyzeWithRecovery(
        content,
        { query, keywords: query.split(' '), targetDomains: [], requiredInfo: [] }
      );

      if (analysisResult.success && analysisResult.data) {
        const analysis = analysisResult.data;

        if (analysis.qualityScore >= 60) {
          // Extract facts
          const fact = {
            url: content.url,
            title: content.title,
            summary: analysis.keyFacts.join('. '),
            prices: content.prices || [],
            ratings: content.ratings || [],
            keyFacts: analysis.keyFacts,
            timestamp: Date.now(),
            confidence: analysis.qualityScore / 100,
            source: 'heuristic' as const
          };

          sharedMemory.addFact(fact);
        }
      }

      // Check if research is complete
      if (sharedMemory.getFactCount() >= 5) {
        break;
      }
    }

    // Return results
    return {
      facts: sharedMemory.facts,
      visitedUrls: Array.from(sharedMemory.visitedUrls)
    };

  } catch (error) {
    // Handle browser crash
    if (error.message.includes('crash') || error.message.includes('disconnected')) {
      const recovery = resilientNavigator.recoverFromCrash();

      if (recovery.success) {
        console.log('Recovered from crash, can resume research');
        // Could restart browser and resume here
      }
    }

    throw error;
  } finally {
    await browser.close();
  }
}
```

## Error Recovery Strategies

### Page Load Timeout (8.1)
- **Trigger**: Page doesn't load within 20 seconds
- **Action**: Skip page, mark as visited, continue to next URL
- **Recovery**: `handlePageLoadTimeout(url, memory)`

### Element Not Found (8.2)
- **Trigger**: Element not found after 3 retries
- **Action**: Log failure, continue research
- **Recovery**: `handleElementNotFound(target, retries, fallbackUrl?)`

### AI Failure (8.3, 8.5)
- **Trigger**: AI analysis call fails or times out
- **Action**: Fall back to heuristic analysis
- **Cache**: Use cached result if available
- **Recovery**: `handleAIFailure(content, context, contentHash)`

### Browser Crash (8.4)
- **Trigger**: Browser process crashes
- **Action**: Save state, restart browser, resume from checkpoint
- **Recovery**: `handleBrowserCrash(memory)`

## Best Practices

1. **Save checkpoints regularly**: Call `saveCheckpoint()` before each major operation
2. **Use resilient wrappers**: Prefer `ResilientPageAnalyzer` and `ResilientBrowserNavigator` over direct component usage
3. **Check recovery results**: Always check `result.shouldContinue` to determine if research can proceed
4. **Monitor recovery methods**: Log `result.recoveryMethod` to track which recovery strategies are being used
5. **Clear caches periodically**: Call `clearCache()` when starting new research sessions
6. **Limit checkpoint history**: Use reasonable `maxCheckpoints` value (default: 10)

## Performance Considerations

- **Cache size**: Limited to 500 entries (LIMITS.MAX_CACHE_ENTRIES)
- **Checkpoint history**: Limited to configurable max (default: 10)
- **Timeout values**:
  - Page load: 20 seconds (LIMITS.PAGE_LOAD_TIMEOUT_MS)
  - Element click: 5 seconds (LIMITS.CLICK_TIMEOUT_MS)
  - Max retries: 3 (LIMITS.MAX_CLICK_RETRIES)

## Testing

Run error recovery tests:

```bash
# Unit tests
npm test -- error-recovery.test.ts --run

# Integration tests
npm test -- error-recovery-integration.test.ts --run
```

## API Reference

### ErrorRecoveryManager

```typescript
class ErrorRecoveryManager {
  handlePageLoadTimeout(url: string, memory: SharedResearchMemory): RecoveryResult<string>
  handleElementNotFound(target: string, retries: number, fallbackUrl?: string): RecoveryResult<string>
  handleAIFailure(content: PageContent, context: ResearchContext, hash: string): Promise<RecoveryResult<PageAnalysisResult>>
  handleBrowserCrash(memory: SharedResearchMemory): RecoveryResult<ResearchCheckpoint>
  saveCheckpoint(memory: SharedResearchMemory, currentUrl?: string): void
  cacheAnalysis(hash: string, result: PageAnalysisResult): void
  getCachedAnalysis(hash: string): PageAnalysisResult | null
  clearCache(): void
  getCheckpoints(): ResearchCheckpoint[]
  clearCheckpoints(): void
}
```

### RecoveryResult<T>

```typescript
interface RecoveryResult<T> {
  success: boolean
  data?: T
  error?: string
  recoveryMethod?: string
  shouldContinue: boolean
}
```

### ResearchCheckpoint

```typescript
interface ResearchCheckpoint {
  timestamp: number
  factsCollected: number
  urlsVisited: number
  currentUrl?: string
  queuedUrls: string[]
}
```
