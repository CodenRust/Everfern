# Enhanced Grounding Engine - Learning Mechanism

## Overview

The Enhanced Grounding Engine includes a sophisticated learning mechanism that tracks successful visual interactions and optimizes future element detection. This document describes how the learning system works and how to use it.

## Learning Components

### 1. Visual Interaction Recording

The engine records every visual interaction attempt with the following information:

```typescript
interface VisualInteractionLearning {
  query: string;                    // The element query/description
  method: 'dom' | 'visual' | 'hybrid';  // Detection method used
  selector?: string;                // CSS selector if DOM method
  confidence: number;               // Confidence score (0-1)
  timestamp: string;                // ISO timestamp
  success: boolean;                 // Whether interaction succeeded
  coordinates?: { x: number; y: number };  // Detected coordinates
  viewportSize?: { width: number; height: number };  // Viewport dimensions
}
```

### 2. Selector Optimization

When a DOM-based detection succeeds, the engine stores the selector for future use:

```typescript
// Learned selectors are stored in a Map
selectorOptimizations: Map<string, string>

// Example:
// "Submit button" → "button.submit"
// "Close dialog" → "button[aria-label='Close']"
```

### 3. Learning Log Management

- Maximum log size: 1000 entries
- Automatically prunes oldest entries when limit exceeded
- Provides statistics on detection methods and success rates

## API Usage

### Recording Interactions

```typescript
engine.recordLearning(
  query: string,           // "Submit button"
  method: 'dom' | 'visual' | 'hybrid',
  selector: string | undefined,  // "button.submit"
  confidence: number,      // 0.95
  success: boolean,        // true
  result: any,            // { found: true, x: 125, y: 215 }
  viewportWidth: number,  // 1920
  viewportHeight: number, // 1080
  duration: number,       // 150 (ms)
  error?: string          // Optional error reason
);
```

### Retrieving Learning Data

```typescript
// Get all learning records
const log = engine.getLearningLog();

// Get learned selectors
const optimizations = engine.getSelectorOptimizations();

// Get statistics
const stats = engine.getLearningStats();
// Returns: {
//   totalAttempts: number,
//   successRate: number,
//   averageConfidence: number,
//   methodBreakdown: Record<string, number>
// }
```

## How Learning Improves Detection

### 1. Learned Selector Prioritization

When `locateWithFallback()` is called with extension elements:

1. Check cache for exact match
2. **Check learned selectors** (NEW)
3. Try extension element matching
4. Try SoM text matching
5. Fall back to visual grounding

```typescript
// If we've successfully used "button.submit" for "Submit" before,
// we'll try that selector first next time
const learnedSelector = this.selectorOptimizations.get(query);
if (learnedSelector && domElements) {
  const element = domElements.find(el => el.selector === learnedSelector);
  if (element && validateCoordinates(x, y, imgW, imgH)) {
    return { found: true, ... };
  }
}
```

### 2. Confidence-Based Matching

The engine uses confidence scores to determine match quality:

- **Exact match**: 0.98 confidence
- **Substring match**: 0.85 confidence
- **Partial word match**: 0.75 confidence
- **Interactive element boost**: +0.05 confidence

### 3. Method Selection

Based on learning statistics, the engine can optimize method selection:

```typescript
selectDetectionMethod(
  elementType?: string,
  pageComplexity?: 'simple' | 'moderate' | 'complex'
): 'dom' | 'visual' | 'hybrid'
```

## Integration with Browser Automation

### In browser-use.ts

The enhanced grounding engine is used during click actions:

```typescript
case 'click': {
  if (action.target && groundingEngine) {
    // Use enhanced grounding with extension data
    if ('locateWithFallback' in groundingEngine && extensionElements.length > 0) {
      result = await groundingEngine.locateWithFallback(
        screenshotB64,
        viewportWidth,
        viewportHeight,
        action.target,
        extensionElements  // Chrome extension data
      );
    } else {
      result = await groundingEngine.locate(...);
    }

    if (result.found) {
      await page.mouse.click(result.x, result.y);
    }
  }
}
```

## Coordinate Validation

All coordinates are validated against viewport bounds:

```typescript
private validateCoordinates(x: number, y: number, imgW: number, imgH: number): boolean {
  const margin = 10; // Allow 10px margin for edge elements

  const withinBounds = x >= -margin && x <= imgW + margin &&
                       y >= -margin && y <= imgH + margin;

  if (!withinBounds) {
    console.warn(`Coordinates out of bounds: (${x}, ${y}) vs viewport (${imgW}x${imgH})`);
    return false;
  }

  // Warn if at extreme edges
  if (x < margin || x > imgW - margin || y < margin || y > imgH - margin) {
    console.warn(`Coordinates at viewport edge: (${x}, ${y})`);
  }

  return true;
}
```

## Logging and Debugging

### Console Output

The engine provides detailed logging:

```
[EnhancedGrounding] 🎯 Locate with fallback: "Submit"
[EnhancedGrounding] 🧠 Using learned selector: button.submit
[EnhancedGrounding] ✅ Extension match: "Submit" → button.submit (confidence: 0.95)
[EnhancedGrounding] 📚 Learning recorded: dom for "Submit" (success: true, confidence: 0.95, duration: 150ms)
```

### Learning Statistics

```typescript
const stats = engine.getLearningStats();
console.log(`Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`Average Confidence: ${stats.averageConfidence.toFixed(2)}`);
console.log(`Method Breakdown:`, stats.methodBreakdown);
```

## Error Handling

When grounding fails, the engine provides actionable error information:

```typescript
handleGroundingError(
  error: Error,
  query: string,
  attemptedMethods: string[]
): VisualGroundingResult
```

Fallback reasons include:
- `timeout` - VLM request timed out
- `low_confidence` - Confidence below threshold
- `element_not_found` - Element not detected
- `coordinates_out_of_bounds` - Coordinates outside viewport
- `all_methods_failed` - All detection methods failed
- `unknown_error` - Other errors

## Performance Considerations

### Cache Management

- Results are cached by query + screenshot hash
- Cache hits avoid expensive VLM calls
- Learned selectors provide fast path for common queries

### Learning Log Size

- Maximum 1000 entries to prevent memory bloat
- Oldest entries automatically pruned
- Can be cleared manually if needed

### Viewport Size Tracking

- Viewport dimensions stored with each learning record
- Helps identify coordinate validation issues
- Useful for debugging cross-device interactions

## Best Practices

1. **Use Extension Data**: Always pass extension elements when available for better accuracy
2. **Monitor Learning Stats**: Periodically check success rates to identify problematic queries
3. **Validate Coordinates**: Ensure coordinates are within viewport bounds
4. **Handle Errors Gracefully**: Use fallback reasons to provide user feedback
5. **Clear Old Data**: Periodically clear learning logs in long-running sessions

## Example Usage

```typescript
import { EnhancedGroundingEngine } from './grounding';

// Create engine with learning enabled
const engine = new EnhancedGroundingEngine({
  enableSoMDetection: true,
  fallbackToVisual: true,
  confidenceThreshold: 0.75,
  enableExtensionData: true,
});

// Use with extension data
const result = await engine.locateWithFallback(
  screenshotB64,
  1920,
  1080,
  'Submit button',
  extensionElements
);

if (result.found) {
  console.log(`Found at (${result.x}, ${result.y}) using ${result.method}`);

  // Learning is automatically recorded
  const stats = engine.getLearningStats();
  console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
}
```

## Testing

The learning mechanism is tested with:

1. **Unit Tests** (`enhanced-grounding.test.ts`):
   - Recording interactions
   - Selector optimization
   - Learning statistics
   - Log size management

2. **Property Tests** (`enhanced-grounding.property.test.ts`):
   - Coordinate validation across all viewport sizes
   - Consistent results for identical inputs
   - Method selection logic
   - Error handling

## Future Enhancements

Potential improvements to the learning system:

1. **Persistent Storage**: Save learning data across sessions
2. **ML-Based Optimization**: Use learning data to train selector generation
3. **User Preferences**: Allow users to configure learning behavior
4. **Analytics**: Track which queries are most problematic
5. **Adaptive Thresholds**: Adjust confidence thresholds based on success rates
