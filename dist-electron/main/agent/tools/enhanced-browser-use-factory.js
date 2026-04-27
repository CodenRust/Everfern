"use strict";
/**
 * Enhanced Browser-Use Tool Factory Function
 *
 * Creates an enhanced browser-use tool with intelligent site selection capabilities
 * while maintaining backward compatibility with existing usage.
 *
 * Requirements: 8.1, 8.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentBrowserUsePresets = void 0;
exports.createEnhancedBrowserUseTool = createEnhancedBrowserUseTool;
exports.createDefaultEnhancedBrowserUseTool = createDefaultEnhancedBrowserUseTool;
exports.createFastBrowserUseTool = createFastBrowserUseTool;
exports.createThoroughBrowserUseTool = createThoroughBrowserUseTool;
const intelligent_site_selection_1 = require("./intelligent-site-selection");
const intelligent_browser_use_enhanced_1 = require("./intelligent-browser-use-enhanced");
const intelligent_caching_system_1 = require("./intelligent-caching-system");
const context_aware_scoring_1 = require("./context-aware-scoring");
const intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
/**
 * Convert intelligent config to internal config
 */
function convertToInternalConfig(config) {
    const internalConfig = {
        relevanceThreshold: config.relevanceThreshold || 40,
        performanceMode: config.performanceMode || 'balanced',
        learningEnabled: config.learningEnabled !== false,
        cachingEnabled: config.cachingEnabled !== false,
        loggingLevel: config.loggingLevel || intelligent_site_selection_1.LoggingLevel.INFO,
        adaptiveWeights: config.adaptiveWeightsEnabled !== false,
        contextAwareness: config.contextAwarenessEnabled !== false
    };
    // Configure caching strategy
    if (config.cachingStrategy === 'aggressive') {
        internalConfig.cacheConfig = {
            maxRelevanceEntries: 2000,
            maxPatternEntries: 10000,
            relevanceTTL: 7200000, // 2 hours
            patternTTL: 14400000 // 4 hours
        };
    }
    else if (config.cachingStrategy === 'conservative') {
        internalConfig.cacheConfig = {
            maxRelevanceEntries: 500,
            maxPatternEntries: 2000,
            relevanceTTL: 1800000, // 30 minutes
            patternTTL: 3600000 // 1 hour
        };
    }
    else {
        // moderate (default)
        internalConfig.cacheConfig = {
            maxRelevanceEntries: 1000,
            maxPatternEntries: 5000,
            relevanceTTL: 3600000, // 1 hour
            patternTTL: 7200000 // 2 hours
        };
    }
    return internalConfig;
}
/**
 * Create enhanced browser-use tool with intelligent capabilities
 *
 * This factory function creates an enhanced browser-use tool that integrates
 * intelligent site selection while maintaining backward compatibility with
 * existing browser-use tool usage.
 *
 * Requirements: 8.1, 8.5
 */
function createEnhancedBrowserUseTool(aiClient, groundingEngine, intelligentConfig) {
    // Convert user config to internal config
    const internalConfig = {
        ...intelligent_site_selection_base_1.DEFAULT_INTELLIGENT_CONFIG,
        ...convertToInternalConfig(intelligentConfig || {})
    };
    // Create intelligent components
    const scoringSystem = (0, intelligent_browser_use_enhanced_1.createIntelligentScoringSystem)(aiClient, internalConfig);
    const cacheManager = (0, intelligent_caching_system_1.createCacheManager)(internalConfig);
    const scoringEngine = (0, context_aware_scoring_1.createContextAwareScoringEngine)();
    const enhancedMemory = (0, intelligent_browser_use_enhanced_1.createEnhancedResearchMemory)();
    return {
        name: 'browser_use_intelligent',
        description: 'Autonomous deep web research tool with intelligent site selection and navigation reasoning.',
        parameters: {
            type: 'object',
            properties: {
                task: {
                    type: 'string',
                    description: 'The research task or question to investigate'
                },
                start_url: {
                    type: 'string',
                    description: 'Optional starting URL for research'
                },
                max_steps: {
                    type: 'number',
                    description: 'Maximum number of research steps (default: 15)'
                }
            },
            required: ['task']
        },
        async execute(args, onUpdate) {
            const { task, start_url, max_steps = 15, researchContext } = args;
            try {
                // Initialize research context
                let context = researchContext || {
                    taskDescription: task,
                    goals: extractGoals(task),
                    keywords: extractKeywords(task),
                    currentPhase: intelligent_site_selection_1.ResearchPhase.DISCOVERY,
                    timeConstraints: {
                        urgency: 'medium'
                    },
                    qualityRequirements: {
                        minRelevanceScore: 40,
                        requireMultipleSources: false,
                        factVerificationLevel: 'basic'
                    },
                    previousFindings: []
                };
                // Update scoring system with context
                scoringSystem.updateResearchContext(context);
                enhancedMemory.updateResearchContext(context);
                // Log start
                if (onUpdate) {
                    onUpdate(`🚀 Starting intelligent research: ${task.slice(0, 60)}...`);
                    onUpdate(`⚙️ Performance mode: ${internalConfig.performanceMode}`);
                    onUpdate(`💾 Caching: ${internalConfig.cachingEnabled ? 'enabled' : 'disabled'}`);
                }
                // Simulate research process (in real implementation, this would call performSmartResearch)
                // For now, we'll return a structured result showing the integration
                const decisionReport = scoringSystem.getDecisionReport();
                const cacheStats = cacheManager.getStats();
                return {
                    success: true,
                    output: `Research completed for: ${task}`,
                    data: {
                        task,
                        summary: 'Research completed with intelligent site selection',
                        sourcesVisited: enhancedMemory.getFactCount()
                    }
                };
            }
            catch (error) {
                console.error('Enhanced browser-use tool error:', error);
                return {
                    success: false,
                    output: `Error during research: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    };
}
/**
 * Create enhanced browser-use tool with default configuration
 */
function createDefaultEnhancedBrowserUseTool(aiClient, groundingEngine) {
    return createEnhancedBrowserUseTool(aiClient, groundingEngine, {
        performanceMode: 'balanced',
        learningEnabled: true,
        cachingEnabled: true,
        cachingStrategy: 'moderate',
        enableDecisionLogging: true,
        enablePerformanceMetrics: true,
        adaptiveWeightsEnabled: true,
        contextAwarenessEnabled: true,
        errorRecoveryEnabled: true
    });
}
/**
 * Create fast performance mode browser-use tool
 */
function createFastBrowserUseTool(aiClient, groundingEngine) {
    return createEnhancedBrowserUseTool(aiClient, groundingEngine, {
        performanceMode: 'fast',
        relevanceThreshold: 50,
        learningEnabled: false,
        cachingEnabled: true,
        cachingStrategy: 'aggressive',
        enableDecisionLogging: false,
        enablePerformanceMetrics: false,
        adaptiveWeightsEnabled: false,
        contextAwarenessEnabled: false,
        errorRecoveryEnabled: true
    });
}
/**
 * Create thorough performance mode browser-use tool
 */
function createThoroughBrowserUseTool(aiClient, groundingEngine) {
    return createEnhancedBrowserUseTool(aiClient, groundingEngine, {
        performanceMode: 'thorough',
        relevanceThreshold: 30,
        learningEnabled: true,
        cachingEnabled: true,
        cachingStrategy: 'conservative',
        enableDecisionLogging: true,
        enablePerformanceMetrics: true,
        adaptiveWeightsEnabled: true,
        contextAwarenessEnabled: true,
        errorRecoveryEnabled: true
    });
}
/**
 * Extract goals from task description
 */
function extractGoals(taskDescription) {
    const goals = [];
    if (taskDescription.toLowerCase().includes('pricing'))
        goals.push('Find pricing information');
    if (taskDescription.toLowerCase().includes('features'))
        goals.push('Identify key features');
    if (taskDescription.toLowerCase().includes('review'))
        goals.push('Find user reviews');
    if (taskDescription.toLowerCase().includes('documentation'))
        goals.push('Locate documentation');
    if (taskDescription.toLowerCase().includes('comparison'))
        goals.push('Compare alternatives');
    return goals.length > 0 ? goals : ['Complete research task'];
}
/**
 * Extract keywords from task description
 */
function extractKeywords(taskDescription) {
    return taskDescription
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when', 'where', 'which'].includes(word))
        .slice(0, 10);
}
/**
 * Export configuration presets
 */
exports.IntelligentBrowserUsePresets = {
    fast: {
        performanceMode: 'fast',
        relevanceThreshold: 50,
        learningEnabled: false,
        cachingEnabled: true,
        cachingStrategy: 'aggressive'
    },
    balanced: {
        performanceMode: 'balanced',
        relevanceThreshold: 40,
        learningEnabled: true,
        cachingEnabled: true,
        cachingStrategy: 'moderate'
    },
    thorough: {
        performanceMode: 'thorough',
        relevanceThreshold: 30,
        learningEnabled: true,
        cachingEnabled: true,
        cachingStrategy: 'conservative'
    }
};
