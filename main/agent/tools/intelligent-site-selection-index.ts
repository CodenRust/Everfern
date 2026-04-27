/**
 * Intelligent Site Selection - Unified Export Index
 *
 * This file provides a single import point for all intelligent site selection
 * components, making it easy to integrate with the browser-use tool.
 */

// Import factory functions for createIntelligentResearchSystem
import { createIntelligentScoringSystem } from './intelligent-browser-use-enhanced';
import { createEnhancedResearchMemory } from './intelligent-browser-use-enhanced';
import { createCacheManager } from './intelligent-caching-system';
import { createContextAwareScoringEngine } from './context-aware-scoring';
import { createErrorRecoverySystem } from './intelligent-error-recovery';
import { createEnhancedBrowserUseTool } from './enhanced-browser-use-factory';

// Core types and interfaces
export * from './intelligent-site-selection';

// Base classes and implementations
export * from './intelligent-site-selection-base';
export { createDefaultResearchContext as createResearchContext } from './intelligent-site-selection-base';

// Enhanced research memory
export { EnhancedSharedResearchMemoryImpl } from './enhanced-research-memory';

// Factory functions
export {
  createIntelligentSiteSelection,
  createEnhancedResearchMemory,
  createSiteSelector,
  createRelevanceEngine,
  createNavigationReasoner,
  createContentAnalyzer,
  createURLClassifier,
  createDecisionLogger,
  createFastConfig,
  createThoroughConfig,
  createBalancedConfig
} from './intelligent-site-selection-factory';

// Enhanced browser-use integration
export {
  IntelligentScoringSystem,
  createEnhancedResearchMemory as createEnhancedMemory,
  createIntelligentScoringSystem,
  scoreUrlRelevanceWithIntelligence,
  scorePageRelevanceWithIntelligence,
  addIntelligentFactToMemory
} from './intelligent-browser-use-enhanced';

// Caching system
export {
  RelevanceCache,
  PatternCache,
  IntelligentCacheManager,
  createCacheManager,
  type CacheStats
} from './intelligent-caching-system';

// Context-aware scoring
export {
  ContextAwareScoringEngine,
  createContextAwareScoringEngine,
  type AdaptiveWeights
} from './context-aware-scoring';

// Enhanced browser-use tool factory
export {
  createEnhancedBrowserUseTool,
  createDefaultEnhancedBrowserUseTool,
  createFastBrowserUseTool,
  createThoroughBrowserUseTool,
  IntelligentBrowserUsePresets,
  type IntelligentBrowserUseConfig,
  type EnhancedBrowserUseToolOptions,
  type EnhancedBrowserUseToolResult
} from './enhanced-browser-use-factory';

// Error recovery
export {
  CircuitBreaker,
  RetryMechanism,
  IntelligentErrorRecovery,
  createErrorRecoverySystem,
  ErrorRecoveryStrategy,
  CircuitBreakerState,
  DEFAULT_RETRY_CONFIG,
  type ErrorRecoveryResult,
  type RetryConfig
} from './intelligent-error-recovery';

// Intelligent browser-use integration example
export * from './intelligent-browser-use-integration';

/**
 * Quick start helper - creates a fully configured intelligent research system
 */
export function createIntelligentResearchSystem(
  aiClient: any,
  config?: any
) {
  const scoringSystem = createIntelligentScoringSystem(aiClient, config);
  const memory = createEnhancedResearchMemory();
  const cacheManager = createCacheManager(config || {});
  const scoringEngine = createContextAwareScoringEngine();
  const errorRecovery = createErrorRecoverySystem();

  return {
    scoringSystem,
    memory,
    cacheManager,
    scoringEngine,
    errorRecovery
  };
}

/**
 * Create a complete browser-use tool with intelligent capabilities
 */
export function createIntelligentBrowserUseTool(
  aiClient: any,
  groundingEngine?: any,
  config?: any
) {
  return createEnhancedBrowserUseTool(aiClient, groundingEngine, config);
}
