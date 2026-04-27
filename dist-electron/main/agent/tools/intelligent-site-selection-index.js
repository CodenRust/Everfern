"use strict";
/**
 * Intelligent Site Selection - Unified Export Index
 *
 * This file provides a single import point for all intelligent site selection
 * components, making it easy to integrate with the browser-use tool.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RETRY_CONFIG = exports.CircuitBreakerState = exports.ErrorRecoveryStrategy = exports.createErrorRecoverySystem = exports.IntelligentErrorRecovery = exports.RetryMechanism = exports.CircuitBreaker = exports.IntelligentBrowserUsePresets = exports.createThoroughBrowserUseTool = exports.createFastBrowserUseTool = exports.createDefaultEnhancedBrowserUseTool = exports.createEnhancedBrowserUseTool = exports.createContextAwareScoringEngine = exports.ContextAwareScoringEngine = exports.createCacheManager = exports.IntelligentCacheManager = exports.PatternCache = exports.RelevanceCache = exports.addIntelligentFactToMemory = exports.scorePageRelevanceWithIntelligence = exports.scoreUrlRelevanceWithIntelligence = exports.createIntelligentScoringSystem = exports.createEnhancedMemory = exports.IntelligentScoringSystem = exports.createBalancedConfig = exports.createThoroughConfig = exports.createFastConfig = exports.createDecisionLogger = exports.createURLClassifier = exports.createContentAnalyzer = exports.createNavigationReasoner = exports.createRelevanceEngine = exports.createSiteSelector = exports.createEnhancedResearchMemory = exports.createIntelligentSiteSelection = exports.EnhancedSharedResearchMemoryImpl = exports.createResearchContext = void 0;
exports.createIntelligentResearchSystem = createIntelligentResearchSystem;
exports.createIntelligentBrowserUseTool = createIntelligentBrowserUseTool;
// Import factory functions for createIntelligentResearchSystem
const intelligent_browser_use_enhanced_1 = require("./intelligent-browser-use-enhanced");
const intelligent_browser_use_enhanced_2 = require("./intelligent-browser-use-enhanced");
const intelligent_caching_system_1 = require("./intelligent-caching-system");
const context_aware_scoring_1 = require("./context-aware-scoring");
const intelligent_error_recovery_1 = require("./intelligent-error-recovery");
const enhanced_browser_use_factory_1 = require("./enhanced-browser-use-factory");
// Core types and interfaces
__exportStar(require("./intelligent-site-selection"), exports);
// Base classes and implementations
__exportStar(require("./intelligent-site-selection-base"), exports);
var intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
Object.defineProperty(exports, "createResearchContext", { enumerable: true, get: function () { return intelligent_site_selection_base_1.createDefaultResearchContext; } });
// Enhanced research memory
var enhanced_research_memory_1 = require("./enhanced-research-memory");
Object.defineProperty(exports, "EnhancedSharedResearchMemoryImpl", { enumerable: true, get: function () { return enhanced_research_memory_1.EnhancedSharedResearchMemoryImpl; } });
// Factory functions
var intelligent_site_selection_factory_1 = require("./intelligent-site-selection-factory");
Object.defineProperty(exports, "createIntelligentSiteSelection", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createIntelligentSiteSelection; } });
Object.defineProperty(exports, "createEnhancedResearchMemory", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createEnhancedResearchMemory; } });
Object.defineProperty(exports, "createSiteSelector", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createSiteSelector; } });
Object.defineProperty(exports, "createRelevanceEngine", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createRelevanceEngine; } });
Object.defineProperty(exports, "createNavigationReasoner", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createNavigationReasoner; } });
Object.defineProperty(exports, "createContentAnalyzer", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createContentAnalyzer; } });
Object.defineProperty(exports, "createURLClassifier", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createURLClassifier; } });
Object.defineProperty(exports, "createDecisionLogger", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createDecisionLogger; } });
Object.defineProperty(exports, "createFastConfig", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createFastConfig; } });
Object.defineProperty(exports, "createThoroughConfig", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createThoroughConfig; } });
Object.defineProperty(exports, "createBalancedConfig", { enumerable: true, get: function () { return intelligent_site_selection_factory_1.createBalancedConfig; } });
// Enhanced browser-use integration
var intelligent_browser_use_enhanced_3 = require("./intelligent-browser-use-enhanced");
Object.defineProperty(exports, "IntelligentScoringSystem", { enumerable: true, get: function () { return intelligent_browser_use_enhanced_3.IntelligentScoringSystem; } });
Object.defineProperty(exports, "createEnhancedMemory", { enumerable: true, get: function () { return intelligent_browser_use_enhanced_3.createEnhancedResearchMemory; } });
Object.defineProperty(exports, "createIntelligentScoringSystem", { enumerable: true, get: function () { return intelligent_browser_use_enhanced_3.createIntelligentScoringSystem; } });
Object.defineProperty(exports, "scoreUrlRelevanceWithIntelligence", { enumerable: true, get: function () { return intelligent_browser_use_enhanced_3.scoreUrlRelevanceWithIntelligence; } });
Object.defineProperty(exports, "scorePageRelevanceWithIntelligence", { enumerable: true, get: function () { return intelligent_browser_use_enhanced_3.scorePageRelevanceWithIntelligence; } });
Object.defineProperty(exports, "addIntelligentFactToMemory", { enumerable: true, get: function () { return intelligent_browser_use_enhanced_3.addIntelligentFactToMemory; } });
// Caching system
var intelligent_caching_system_2 = require("./intelligent-caching-system");
Object.defineProperty(exports, "RelevanceCache", { enumerable: true, get: function () { return intelligent_caching_system_2.RelevanceCache; } });
Object.defineProperty(exports, "PatternCache", { enumerable: true, get: function () { return intelligent_caching_system_2.PatternCache; } });
Object.defineProperty(exports, "IntelligentCacheManager", { enumerable: true, get: function () { return intelligent_caching_system_2.IntelligentCacheManager; } });
Object.defineProperty(exports, "createCacheManager", { enumerable: true, get: function () { return intelligent_caching_system_2.createCacheManager; } });
// Context-aware scoring
var context_aware_scoring_2 = require("./context-aware-scoring");
Object.defineProperty(exports, "ContextAwareScoringEngine", { enumerable: true, get: function () { return context_aware_scoring_2.ContextAwareScoringEngine; } });
Object.defineProperty(exports, "createContextAwareScoringEngine", { enumerable: true, get: function () { return context_aware_scoring_2.createContextAwareScoringEngine; } });
// Enhanced browser-use tool factory
var enhanced_browser_use_factory_2 = require("./enhanced-browser-use-factory");
Object.defineProperty(exports, "createEnhancedBrowserUseTool", { enumerable: true, get: function () { return enhanced_browser_use_factory_2.createEnhancedBrowserUseTool; } });
Object.defineProperty(exports, "createDefaultEnhancedBrowserUseTool", { enumerable: true, get: function () { return enhanced_browser_use_factory_2.createDefaultEnhancedBrowserUseTool; } });
Object.defineProperty(exports, "createFastBrowserUseTool", { enumerable: true, get: function () { return enhanced_browser_use_factory_2.createFastBrowserUseTool; } });
Object.defineProperty(exports, "createThoroughBrowserUseTool", { enumerable: true, get: function () { return enhanced_browser_use_factory_2.createThoroughBrowserUseTool; } });
Object.defineProperty(exports, "IntelligentBrowserUsePresets", { enumerable: true, get: function () { return enhanced_browser_use_factory_2.IntelligentBrowserUsePresets; } });
// Error recovery
var intelligent_error_recovery_2 = require("./intelligent-error-recovery");
Object.defineProperty(exports, "CircuitBreaker", { enumerable: true, get: function () { return intelligent_error_recovery_2.CircuitBreaker; } });
Object.defineProperty(exports, "RetryMechanism", { enumerable: true, get: function () { return intelligent_error_recovery_2.RetryMechanism; } });
Object.defineProperty(exports, "IntelligentErrorRecovery", { enumerable: true, get: function () { return intelligent_error_recovery_2.IntelligentErrorRecovery; } });
Object.defineProperty(exports, "createErrorRecoverySystem", { enumerable: true, get: function () { return intelligent_error_recovery_2.createErrorRecoverySystem; } });
Object.defineProperty(exports, "ErrorRecoveryStrategy", { enumerable: true, get: function () { return intelligent_error_recovery_2.ErrorRecoveryStrategy; } });
Object.defineProperty(exports, "CircuitBreakerState", { enumerable: true, get: function () { return intelligent_error_recovery_2.CircuitBreakerState; } });
Object.defineProperty(exports, "DEFAULT_RETRY_CONFIG", { enumerable: true, get: function () { return intelligent_error_recovery_2.DEFAULT_RETRY_CONFIG; } });
// Intelligent browser-use integration example
__exportStar(require("./intelligent-browser-use-integration"), exports);
/**
 * Quick start helper - creates a fully configured intelligent research system
 */
function createIntelligentResearchSystem(aiClient, config) {
    const scoringSystem = (0, intelligent_browser_use_enhanced_1.createIntelligentScoringSystem)(aiClient, config);
    const memory = (0, intelligent_browser_use_enhanced_2.createEnhancedResearchMemory)();
    const cacheManager = (0, intelligent_caching_system_1.createCacheManager)(config || {});
    const scoringEngine = (0, context_aware_scoring_1.createContextAwareScoringEngine)();
    const errorRecovery = (0, intelligent_error_recovery_1.createErrorRecoverySystem)();
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
function createIntelligentBrowserUseTool(aiClient, groundingEngine, config) {
    return (0, enhanced_browser_use_factory_1.createEnhancedBrowserUseTool)(aiClient, groundingEngine, config);
}
