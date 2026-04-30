# Smart Navigation Engine - Usage Guide

The Smart Navigation Engine provides reliable element interaction with multi-strategy clicking, retry logic, and dynamic content handling for the Enhanced Browser Research System.

## Features

- **Multi-Strategy Clicking**: Tries text → selector → extension → coordinates
- **Automatic Retries**: Up to 3 retries with 500ms delay between attempts
- **Timeout Enforcement**: 5-second timeout per click attempt
- **Dynamic Content Handling**: Detects and waits for lazy loading and infinite scroll
- **Selector Caching**: Caches successful selectors for performance
- **Detailed Results**: Returns method used, retry count, and error details

## Quick Start

### Basic Usage

```typescript
import { smartClick } from './smart-navigation-integration';

// Simple click
const result = await smartClick(page, 'View Pricing', extensionElements);

if (result.success) {
  console.log(`Clicked using ${result.method} after ${result.retries} retries`);
} else {
  console.error(`Click failed: ${result.error}`);
}
```

### With Progress Reporting

```typescript
import { smartClickWithProgress } from './smart-navigation-integration';

const result = await smartClickWithProgress(
  page,
  'Sign Up',
  extensionElements,
  (msg) => console.log(msg)
);

// Output:
// 🖱️ Clicking "Sign Up"...
// ✅ Clicked "Sign Up" using text strategy (0 retries)
```

### With Auto-Generated Fallbacks

```typescript
import { smartClickWithFallbacks } from './smart-navigation-integration';

// Automatically tries common selector patterns
const result = await smartClickWithFallbacks(page, 'View Pricing', extensionElements);

// Tries:
// 1. Text-based: hasText("View Pricing")
// 2. [data-view-pricing]
// 3. .view-pricing
// 4. #view-pricing
// 5. a[href*="view-pricing"]
// 6. button[class*="view-pricing"]
// 7. [aria-label*="View Pricing"]
// 8. [title*="View Pricing"]
// 9. Extension API
// 10. Coordinates
```

### With Custom Options

```typescript
import { smartClick } from './smart-navigation-integration';

const result = await smartClick(
  page,
  'Submit',
  extensionElements,
  {
    maxRetries: 5,
    timeout: 10000,
    waitForNavigation: true,
    fallbackSelectors: ['#submit-btn', '.submit-button', '[type="submit"]']
  }
);
```

## Dynamic Content Handling

```typescript
import { handleDynamicContent } from './smart-navigation-integration';

// Wait for lazy loading and infinite scroll
await handleDynamicContent(page);

// Now safe to interact with elements
const result = await smartClick(page, 'Load More', extensionElements);
```

## Selector Caching

```typescript
import { cacheSelector, getCachedSelector } from './smart-navigation-integration';

// Cache a successful selector
cacheSelector('Submit Button', '#submit-btn');

// Future clicks will try cached selector first
const result = await smartClick(page, 'Submit Button', extensionElements);

// Check cache
const cached = getCachedSelector('Submit Button');
console.log(cached); // '#submit-btn'
```

## Integration with browser-use Tool

### Before (Original Code)

```typescript
// Old click logic in executeAction
case 'click':
  const target = action.target || '';
  onProgress(`🖱️ [${taskId}] Clicking "${target}"...`);

  let clicked = false;
  if (extensionElements.length > 0) {
    const el = extensionElements.find(e => e.textContent.toLowerCase().includes(target.toLowerCase()));
    if (el) {
      await page.locator(el.selector).click().catch(() => {});
      clicked = true;
    }
  }

  if (!clicked) {
    await page.locator('a, button, input, span, [role="button"], [role="link"], [role="menuitem"], [role="tab"]')
      .filter({ hasText: target })
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  break;
```

### After (With Smart Navigation)

```typescript
import { smartClickWithProgress, handleDynamicContent } from './smart-navigation-integration';

case 'click':
  const target = action.target || '';

  // Handle dynamic content first
  await handleDynamicContent(page);

  // Smart click with progress reporting
  const result = await smartClickWithProgress(
    page,
    target,
    extensionElements,
    (msg) => onProgress(`[${taskId}] ${msg}`)
  );

  if (!result.success) {
    onProgress(`⚠️ [${taskId}] Click failed: ${result.error}`);
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  break;
```

## Click Strategies

The engine tries strategies in this order:

### 1. Text-Based Strategy

Finds elements by text content using Playwright's `hasText` filter.

```typescript
page.locator('a, button, input, span, [role="button"], [role="link"], [role="menuitem"], [role="tab"]')
  .filter({ hasText: target })
  .first()
  .click({ timeout: 5000 });
```

**Best for**: Buttons, links, and interactive elements with visible text.

### 2. Selector-Based Strategy

Uses provided fallback selectors.

```typescript
page.locator(fallbackSelector).click({ timeout: 5000 });
```

**Best for**: Elements with known CSS selectors or IDs.

### 3. Extension API Strategy

Uses elements captured by Chrome extension.

```typescript
const element = extensionElements.find(e =>
  e.textContent.toLowerCase().includes(target.toLowerCase())
);
page.locator(element.selector).click({ timeout: 5000 });
```

**Best for**: Complex pages where standard selectors fail.

### 4. Coordinate-Based Strategy (Last Resort)

Clicks element by coordinates.

```typescript
const box = await element.boundingBox();
page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
```

**Best for**: When all other strategies fail.

## Error Handling

```typescript
const result = await smartClick(page, 'Click Me', extensionElements);

if (!result.success) {
  console.error(`Click failed after ${result.retries} retries`);
  console.error(`Error: ${result.error}`);

  // Handle failure
  if (result.retries >= 3) {
    // All strategies exhausted
    console.log('Trying alternative navigation...');
  }
}
```

## Performance Tips

1. **Use Selector Caching**: Cache successful selectors for frequently clicked elements
2. **Provide Fallback Selectors**: Reduce retry attempts by providing good fallbacks
3. **Handle Dynamic Content First**: Call `handleDynamicContent()` before clicking
4. **Use Auto-Generated Fallbacks**: Let the engine generate common patterns

## Advanced Usage

### Custom Fallback Generator

```typescript
function buildCustomFallbacks(target: string): string[] {
  return [
    `[data-testid="${target}"]`,
    `[data-cy="${target}"]`,
    `[data-qa="${target}"]`,
    `#${target.replace(/\s+/g, '-').toLowerCase()}`
  ];
}

const result = await smartClick(
  page,
  'Submit Form',
  extensionElements,
  {
    fallbackSelectors: buildCustomFallbacks('submit-form')
  }
);
```

### Retry with Different Timeouts

```typescript
// Quick attempt first
let result = await smartClick(page, 'Fast Button', extensionElements, {
  maxRetries: 1,
  timeout: 2000
});

if (!result.success) {
  // Slower attempt with more retries
  result = await smartClick(page, 'Fast Button', extensionElements, {
    maxRetries: 5,
    timeout: 10000
  });
}
```

### Conditional Dynamic Content Handling

```typescript
// Only handle dynamic content for specific pages
if (page.url().includes('infinite-scroll')) {
  await handleDynamicContent(page);
}

const result = await smartClick(page, 'Load More', extensionElements);
```

## Testing

### Unit Tests

```typescript
import { SmartNavigationEngine } from './smart-navigation-engine';

const engine = new SmartNavigationEngine();

// Test text-based clicking
const result = await engine.clickByText(mockPage, 'Click Me', 5000);
expect(result.success).toBe(true);
expect(result.method).toBe('text');
```

### Integration Tests

```typescript
import { smartClick } from './smart-navigation-integration';

// Test complete workflow
const result = await smartClick(mockPage, 'Submit', mockExtensionElements);
expect(result.success).toBe(true);
```

## API Reference

### smartClick(page, target, extensionElements, options?)

Main click function with multi-strategy approach.

**Parameters:**
- `page`: Playwright page object
- `target`: Element text or selector
- `extensionElements`: Elements from Chrome extension
- `options`: Optional click options

**Returns:** `Promise<ClickResult>`

### handleDynamicContent(page)

Handles lazy loading and infinite scroll.

**Parameters:**
- `page`: Playwright page object

**Returns:** `Promise<void>`

### cacheSelector(element, selector)

Cache a successful selector.

**Parameters:**
- `element`: Element text/description
- `selector`: CSS selector

**Returns:** `void`

### getCachedSelector(element)

Get cached selector.

**Parameters:**
- `element`: Element text/description

**Returns:** `string | undefined`

### buildFallbackSelectors(target)

Generate common fallback selectors.

**Parameters:**
- `target`: Element text

**Returns:** `string[]`

## Troubleshooting

### Click Always Fails

1. Check if element exists: `await page.locator(target).count()`
2. Try with longer timeout: `{ timeout: 10000 }`
3. Provide specific fallback selectors
4. Check browser console for JavaScript errors

### Slow Performance

1. Cache successful selectors
2. Reduce `maxRetries` for fast pages
3. Provide specific selectors instead of text
4. Skip dynamic content handling for static pages

### False Positives

1. Use more specific target text
2. Provide exact CSS selectors
3. Check for multiple matching elements
4. Verify element is actually clickable

## Examples

See `__tests__/smart-navigation-engine.test.ts` and `__tests__/smart-navigation-integration.test.ts` for comprehensive examples.
