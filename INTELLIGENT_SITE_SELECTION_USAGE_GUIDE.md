# Intelligent Site Selection - Usage Guide

## Quick Start

### Basic Usage

```typescript
import { createEnhancedBrowserUseTool } from './main/agent/tools/enhanced-browser-use-factory';
import { AIClient } from './lib/ai-client';

// Create the enhanced tool
const aiClient = new AIClient();
const tool = createEnhancedBrowserUseTool(aiClient, undefined, {
  performanceMode: 'balanced',
  learningEnabled: true,
  cachingEnabled: true
});

// Use it like the regular browser-use tool
const result = await tool.execute({
  task: 'Find pricing information for SaaS tools',
  max_steps: 15
});

// Access intelligent metrics
console.log(result.intelligentMetrics);
```

### Advanced Usage with Custom Configuration

```typescript
import {
  createIntelligentScoringSystem,
  createEnhancedResearchMemory,
  createCacheManager,
  createContextAwareScoringEngine,
  createErrorRecoverySystem
} from './main/agent/tools/intelligent-site-selection-index';

// Create individual components
const scoringSystem = createIntelligentScoringSystem(aiClient, {
  performanceMode: 'thorough',
  relevanceThreshold: 30,
  learningEnabled: true,
  cachingEnabled: true,
  cachingStrategy: 'conservative'
});

const memory = createEnhancedResearchMemory();
const cacheManager = createCacheManager(config);
const scoringEngine = createContextAwareScoringEngine();
const errorRecovery = createErrorRecoverySystem();

// Use components together
const context = {
  taskDescription: 'Find pricing information',
  goals: ['Find pricing', 'Find features'],
  keywords: ['pricing', 'plans', 'cost'],
  currentPhase: 'exploration',
  timeConstraints: { maxTime: 300000, startTime: Date.now() },
  qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
  previousFindings: []
};

scoringSystem.updateResearchContext(context);
memory.updateResearchContext(context);

// Score URLs with intelligent analysis
const score = await scoringSystem.scoreUrlRelevanceIntelligent(
  'https://example.com/pricing',
  context.taskDescription
);

// Get decision transparency
const report = scoringSystem.getDecisionReport();
console.log('Decisions:', report.decisions);
console.log('Average score:', report.averageScore);
```

## Configuration Options

### Performance Modes

#### Fast Mode
```typescript
const tool = createFastBrowserUseTool(aiClient);
// - Minimal AI analysis
// - Aggressive caching
// - No learning
// - Best for: Quick research, limited resources
```

#### Balanced Mode (Default)
```typescript
const tool = createDefaultEnhancedBrowserUseTool(aiClient);
// - Selective AI analysis
// - Moderate caching
// - Learning enabled
// - Best for: General research, balanced performance
```

#### Thorough Mode
```typescript
const tool = createThoroughBrowserUseTool(aiClient);
// - Full AI analysis
// - Conservative caching
// - Comprehensive learning
// - Best for: High-quality research, accuracy-focused
```

### Custom Configuration

```typescript
const config = {
  // Relevance thresholds
  relevanceThreshold: 40,        // Skip sites below this score
  highRelevanceThreshold: 70,    // Consider sites above this as high-value

  // Performance mode
  performanceMode: 'balanced',   // 'fast' | 'balanced' | 'thorough'

  // Learning and caching
  learningEnabled: true,         // Enable adaptive learning
  cachingEnabled: true,          // Enable result caching
  cachingStrategy: 'moderate',   // 'aggressive' | 'moderate' | 'conservative'

  // Logging and transparency
  loggingLevel: 'info',          // 'debug' | 'info' | 'warn' | 'error'
  enableDecisionLogging: true,   // Log all decisions
  enablePerformanceMetrics: true,// Track performance

  // Advanced options
  adaptiveWeightsEnabled: true,  // Adapt weights based on context
  contextAwarenessEnabled: true, // Use research context
  errorRecoveryEnabled: true     // Enable error recovery
};

const tool = createEnhancedBrowserUseTool(aiClient, groundingEngine, config);
```

## Component APIs

### IntelligentScoringSystem

```typescript
const scoringSystem = createIntelligentScoringSystem(aiClient, config);

// Score a URL
const urlScore = await scoringSystem.scoreUrlRelevanceIntelligent(
  url,
  taskDescription,
  linkText
);

// Score page content
const pageScore = await scoringSystem.scorePageRelevanceIntelligent(
  taskDescription,
  pageContent
);

// Evaluate if site should be visited
const { shouldVisit, score, reasoning } = await scoringSystem.evaluateSiteForVisit(
  url,
  taskDescription,
  pageContent
);

// Get navigation recommendations
const recommendations = await scoringSystem.getNavigationRecommendations(
  currentUrl,
  links,
  taskDescription
);

// Get decision report
const report = scoringSystem.getDecisionReport();
// {
//   totalDecisions: number,
//   sitesVisited: number,
//   sitesSkipped: number,
//   averageScore: number,
//   decisions: Array<{url, action, score, reasoning}>
// }

// Update research context
scoringSystem.updateResearchContext({
  currentPhase: 'deepdive',
  keywords: ['new', 'keywords']
});
```

### EnhancedSharedResearchMemory

```typescript
const memory = createEnhancedResearchMemory();

// Add intelligent fact
memory.addIntelligentFact({
  url: 'https://example.com',
  title: 'Page Title',
  summary: 'Summary text',
  relevanceScore: 85,
  contentQuality: 0.8,
  informationDensity: 0.7,
  extractionConfidence: 0.9,
  category: 'pricing',
  relatedTopics: ['plans', 'cost'],
  contentGapsFilled: ['pricing'],
  keyFacts: ['$99/month'],
  prices: ['$99/month'],
  ratings: [],
  timestamp: Date.now()
});

// Get content gaps
const gaps = memory.getContentGaps();
// [{
//   category: 'features',
//   description: 'Insufficient information about features',
//   priority: 0.8,
//   suggestedSources: ['features page', 'product overview']
// }]

// Get research progress
const progress = memory.getResearchProgress();
// {
//   completionPercentage: 50,
//   categoryCoverage: { pricing: 1, features: 0.3, ... },
//   qualityScore: 0.75,
//   remainingGoals: ['Find features']
// }

// Update research context
memory.updateResearchContext({
  taskDescription: 'Find pricing and features',
  goals: ['Find pricing', 'Find features'],
  keywords: ['pricing', 'features'],
  currentPhase: 'exploration',
  timeConstraints: { maxTime: 300000, startTime: Date.now() },
  qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
  previousFindings: []
});

// Get intelligent statistics
const stats = memory.getIntelligentStats();
// {
//   totalIntelligentFacts: 5,
//   averageQuality: 0.8,
//   averageRelevance: 82,
//   categoryDistribution: { pricing: 2, features: 3 },
//   topCategories: ['features', 'pricing']
// }
```

### IntelligentCacheManager

```typescript
const cacheManager = createCacheManager(config);

// Get cached relevance assessment
const cached = cacheManager.getCachedRelevance(pageContent, context);

// Cache relevance assessment
cacheManager.cacheRelevance(pageContent, context, assessment);

// Get cached URL classification
const cachedClass = cacheManager.getCachedClassification(url, keywords);

// Cache URL classification
cacheManager.cacheClassification(url, keywords, classification);

// Invalidate cache
cacheManager.invalidateCache({
  type: 'relevance',
  pattern: 'example\\.com'
});

// Get cache statistics
const stats = cacheManager.getStats();
// {
//   relevance: { hits, misses, evictions, size, hitRate },
//   pattern: { hits, misses, evictions, size, hitRate },
//   combined: { hits, misses, evictions, size, hitRate }
// }

// Clear all caches
cacheManager.clearAll();
```

### ContextAwareScoringEngine

```typescript
const scoringEngine = createContextAwareScoringEngine();

// Get adaptive weights based on context
const weights = scoringEngine.getAdaptiveWeights(context, memory);
// {
//   keywordMatch: 0.25,
//   urlPatterns: 0.20,
//   contentQuality: 0.15,
//   informationDensity: 0.15,
//   contextualFit: 0.10,
//   uniqueness: 0.08,
//   structuredData: 0.04,
//   userSignals: 0.03
// }

// Calculate keyword boost
const boost = scoringEngine.calculateKeywordBoost(content, keywords);

// Calculate phase awareness score
const phaseScore = scoringEngine.calculatePhaseAwarenessScore('exploration', 'pricing');

// Calculate gap prioritization score
const gapScore = scoringEngine.calculateGapPrioritizationScore('features', gaps);

// Calculate combined context-aware score
const finalScore = scoringEngine.calculateContextAwareScore(factors, weights);

// Get scoring explanation
const explanation = scoringEngine.getScoringExplanation(context, weights, factors);
```

### IntelligentErrorRecovery

```typescript
const errorRecovery = createErrorRecoverySystem();

// Handle relevance assessment failure
const result = await errorRecovery.handleRelevanceAssessmentFailure(
  error,
  'default', // or 'heuristics', 'cached', 'skip'
  pageContent,
  context
);

// Handle navigation decision failure
const navResult = await errorRecovery.handleNavigationDecisionFailure(error, context);

// Handle learning system failure
errorRecovery.handleLearningSystemFailure(error);

// Handle cache failure
errorRecovery.handleCacheFailure(error, 'get');

// Get circuit breaker state
const state = errorRecovery.getCircuitBreakerState();
// 'closed' | 'open' | 'half_open'

// Reset error recovery
errorRecovery.reset();
```

## Integration with Existing Browser-Use

### Replacing scoreUrlRelevance

```typescript
// Old code
const score = scoreUrlRelevance(url, taskDescription, linkText);

// New code with intelligent scoring
const scoringSystem = createIntelligentScoringSystem(aiClient, config);
const score = await scoringSystem.scoreUrlRelevanceIntelligent(
  url,
  taskDescription,
  linkText
);
```

### Replacing scorePageRelevance

```typescript
// Old code
const score = scorePageRelevance(taskDescription, content);

// New code with intelligent scoring
const scoringSystem = createIntelligentScoringSystem(aiClient, config);
const score = await scoringSystem.scorePageRelevanceIntelligent(
  taskDescription,
  content
);
```

### Using Enhanced Memory

```typescript
// Old code
const memory = new SharedResearchMemory();

// New code with enhanced capabilities
const memory = createEnhancedResearchMemory();

// All old methods still work
memory.addFact(fact);
memory.markVisited(url);
memory.queueUrl(url, score);

// Plus new intelligent methods
memory.addIntelligentFact(intelligentFact);
const gaps = memory.getContentGaps();
const progress = memory.getResearchProgress();
```

## Performance Tuning

### For Speed

```typescript
const config = {
  performanceMode: 'fast',
  relevanceThreshold: 50,
  learningEnabled: false,
  cachingEnabled: true,
  cachingStrategy: 'aggressive',
  enableDecisionLogging: false,
  enablePerformanceMetrics: false,
  adaptiveWeightsEnabled: false,
  contextAwarenessEnabled: false
};
```

### For Quality

```typescript
const config = {
  performanceMode: 'thorough',
  relevanceThreshold: 30,
  learningEnabled: true,
  cachingEnabled: true,
  cachingStrategy: 'conservative',
  enableDecisionLogging: true,
  enablePerformanceMetrics: true,
  adaptiveWeightsEnabled: true,
  contextAwarenessEnabled: true
};
```

### For Balanced Performance

```typescript
const config = {
  performanceMode: 'balanced',
  relevanceThreshold: 40,
  learningEnabled: true,
  cachingEnabled: true,
  cachingStrategy: 'moderate',
  enableDecisionLogging: true,
  enablePerformanceMetrics: true,
  adaptiveWeightsEnabled: true,
  contextAwarenessEnabled: true
};
```

## Monitoring and Debugging

### Enable Debug Logging

```typescript
const config = {
  loggingLevel: 'debug',
  enableDecisionLogging: true,
  enablePerformanceMetrics: true
};

const tool = createEnhancedBrowserUseTool(aiClient, groundingEngine, config);
```

### Access Decision Report

```typescript
const report = scoringSystem.getDecisionReport();

console.log('Total decisions:', report.totalDecisions);
console.log('Sites visited:', report.sitesVisited);
console.log('Sites skipped:', report.sitesSkipped);
console.log('Average score:', report.averageScore);

// Analyze individual decisions
report.decisions.forEach(decision => {
  console.log(`${decision.url}: ${decision.action} (${decision.score}) - ${decision.reasoning}`);
});
```

### Monitor Cache Performance

```typescript
const stats = cacheManager.getStats();

console.log('Cache hit rate:', (stats.combined.hitRate * 100).toFixed(2) + '%');
console.log('Total cache size:', stats.combined.size);
console.log('Cache hits:', stats.combined.hits);
console.log('Cache misses:', stats.combined.misses);
console.log('Cache evictions:', stats.combined.evictions);
```

### Track Research Progress

```typescript
const progress = memory.getResearchProgress();

console.log('Completion:', progress.completionPercentage.toFixed(1) + '%');
console.log('Quality score:', (progress.qualityScore * 100).toFixed(1) + '%');
console.log('Remaining goals:', progress.remainingGoals);

const gaps = memory.getContentGaps();
console.log('Content gaps:', gaps.map(g => `${g.category} (priority: ${g.priority})`));
```

## Troubleshooting

### Low Cache Hit Rate

**Problem**: Cache hit rate is below 50%

**Solutions**:
1. Increase cache size: `cachingStrategy: 'aggressive'`
2. Increase TTL: Adjust `cacheConfig.relevanceTTL`
3. Check if URLs are being normalized consistently

### High Error Rate

**Problem**: Circuit breaker is frequently opening

**Solutions**:
1. Check AI service availability
2. Increase retry attempts: `maxAttempts: 5`
3. Increase retry delay: `initialDelayMs: 200`
4. Enable error recovery: `errorRecoveryEnabled: true`

### Slow Performance

**Problem**: Research is taking too long

**Solutions**:
1. Switch to fast mode: `performanceMode: 'fast'`
2. Increase relevance threshold: `relevanceThreshold: 60`
3. Disable learning: `learningEnabled: false`
4. Disable context awareness: `contextAwarenessEnabled: false`

### Low Quality Results

**Problem**: Research results are not comprehensive

**Solutions**:
1. Switch to thorough mode: `performanceMode: 'thorough'`
2. Lower relevance threshold: `relevanceThreshold: 30`
3. Enable learning: `learningEnabled: true`
4. Enable context awareness: `contextAwarenessEnabled: true`

## Best Practices

1. **Use appropriate performance mode** for your use case
2. **Monitor cache hit rates** and adjust caching strategy
3. **Enable decision logging** for debugging and optimization
4. **Update research context** as you gather more information
5. **Handle errors gracefully** with error recovery system
6. **Track research progress** to identify gaps
7. **Use adaptive weights** for better scoring
8. **Leverage caching** for repeated queries
9. **Test with different configurations** to find optimal settings
10. **Monitor performance metrics** in production

## Examples

### Example 1: Research SaaS Pricing

```typescript
const tool = createEnhancedBrowserUseTool(aiClient, groundingEngine, {
  performanceMode: 'balanced',
  relevanceThreshold: 40,
  learningEnabled: true
});

const result = await tool.execute({
  task: 'Find pricing information for project management SaaS tools',
  max_steps: 20
});

console.log('Research complete!');
console.log('Sources visited:', result.data.sourcesVisited);
console.log('Average relevance:', result.intelligentMetrics.averageRelevanceScore);
console.log('Cache hit rate:', (result.intelligentMetrics.cacheHitRate * 100).toFixed(1) + '%');
```

### Example 2: Competitive Analysis

```typescript
const memory = createEnhancedResearchMemory();
const scoringSystem = createIntelligentScoringSystem(aiClient, {
  performanceMode: 'thorough',
  contextAwarenessEnabled: true
});

const context = {
  taskDescription: 'Compare features and pricing of project management tools',
  goals: ['Compare features', 'Compare pricing', 'Find reviews'],
  keywords: ['features', 'pricing', 'comparison', 'reviews'],
  currentPhase: 'exploration',
  timeConstraints: { maxTime: 600000, startTime: Date.now() },
  qualityRequirements: { minQuality: 0.7, minConfidence: 0.8 },
  previousFindings: []
};

scoringSystem.updateResearchContext(context);
memory.updateResearchContext(context);

// Research process...

const progress = memory.getResearchProgress();
const gaps = memory.getContentGaps();

console.log('Research progress:', progress.completionPercentage + '%');
console.log('Remaining gaps:', gaps.map(g => g.category));
```

## Support and Documentation

For more information, see:
- `INTELLIGENT_SITE_SELECTION_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `main/agent/tools/intelligent-site-selection.ts` - Type definitions
- `main/agent/tools/__tests__/intelligent-integration.test.ts` - Test examples
