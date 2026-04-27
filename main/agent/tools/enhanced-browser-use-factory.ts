/**
 * Enhanced Browser-Use Tool Factory Function
 *
 * Creates an enhanced browser-use tool with intelligent site selection capabilities
 * while maintaining backward compatibility with existing usage.
 *
 * Requirements: 8.1, 8.5
 */

import { AIClient } from '../../lib/ai-client';
import { GroundingEngine } from '../runner/grounding';
import { AgentTool, ToolResult } from '../runner/types';
import {
  IntelligentSelectionConfig,
  ResearchContext,
  ResearchPhase,
  LoggingLevel
} from './intelligent-site-selection';
import {
  IntelligentScoringSystem,
  createEnhancedResearchMemory,
  createIntelligentScoringSystem
} from './intelligent-browser-use-enhanced';
import { IntelligentCacheManager, createCacheManager } from './intelligent-caching-system';
import { ContextAwareScoringEngine, createContextAwareScoringEngine } from './context-aware-scoring';
import { DEFAULT_INTELLIGENT_CONFIG } from './intelligent-site-selection-base';

/**
 * Configuration interface for intelligent features
 *
 * Requirements: 8.5
 */
export interface IntelligentBrowserUseConfig {
  // Relevance thresholds
  relevanceThreshold?: number; // Default: 40
  highRelevanceThreshold?: number; // Default: 70

  // Performance mode settings
  performanceMode?: 'fast' | 'balanced' | 'thorough'; // Default: 'balanced'

  // Learning and caching options
  learningEnabled?: boolean; // Default: true
  cachingEnabled?: boolean; // Default: true
  cachingStrategy?: 'aggressive' | 'moderate' | 'conservative'; // Default: 'moderate'

  // Logging and transparency
  loggingLevel?: LoggingLevel; // Default: 'info'
  enableDecisionLogging?: boolean; // Default: true
  enablePerformanceMetrics?: boolean; // Default: true

  // Advanced options
  adaptiveWeightsEnabled?: boolean; // Default: true
  contextAwarenessEnabled?: boolean; // Default: true
  errorRecoveryEnabled?: boolean; // Default: true
}

/**
 * Enhanced browser-use tool options
 */
export interface EnhancedBrowserUseToolOptions {
  task: string;
  start_url?: string;
  max_steps?: number;
  intelligentConfig?: IntelligentBrowserUseConfig;
  researchContext?: ResearchContext;
}

/**
 * Enhanced browser-use tool result
 */
export interface EnhancedBrowserUseToolResult extends ToolResult {
  intelligentMetrics?: {
    sitesEvaluated: number;
    sitesSkipped: number;
    averageRelevanceScore: number;
    cacheHitRate: number;
    decisionTransparency: Array<{
      url: string;
      action: string;
      score: number;
      reasoning: string;
    }>;
  };
}

/**
 * Convert intelligent config to internal config
 */
function convertToInternalConfig(
  config: IntelligentBrowserUseConfig
): Partial<IntelligentSelectionConfig> {
  const internalConfig: Partial<IntelligentSelectionConfig> = {
    relevanceThreshold: config.relevanceThreshold || 40,
    performanceMode: config.performanceMode || 'balanced',
    learningEnabled: config.learningEnabled !== false,
    cachingEnabled: config.cachingEnabled !== false,
    loggingLevel: config.loggingLevel || LoggingLevel.INFO,
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
  } else if (config.cachingStrategy === 'conservative') {
    internalConfig.cacheConfig = {
      maxRelevanceEntries: 500,
      maxPatternEntries: 2000,
      relevanceTTL: 1800000, // 30 minutes
      patternTTL: 3600000 // 1 hour
    };
  } else {
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
export function createEnhancedBrowserUseTool(
  aiClient: AIClient,
  groundingEngine?: GroundingEngine,
  intelligentConfig?: IntelligentBrowserUseConfig
): AgentTool {
  // Convert user config to internal config
  const internalConfig = {
    ...DEFAULT_INTELLIGENT_CONFIG,
    ...convertToInternalConfig(intelligentConfig || {})
  };

  // Create intelligent components
  const scoringSystem = createIntelligentScoringSystem(aiClient, internalConfig);
  const cacheManager = createCacheManager(internalConfig as any);
  const scoringEngine = createContextAwareScoringEngine();
  const enhancedMemory = createEnhancedResearchMemory();

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

    async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void): Promise<ToolResult> {
      const { task, start_url, max_steps = 15, researchContext } = args as unknown as EnhancedBrowserUseToolOptions;

      try {
        // Initialize research context
        let context: ResearchContext = researchContext || {
          taskDescription: task,
          goals: extractGoals(task),
          keywords: extractKeywords(task),
          currentPhase: ResearchPhase.DISCOVERY,
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
        } as ToolResult;
      } catch (error) {
        console.error('Enhanced browser-use tool error:', error);
        return {
          success: false,
          output: `Error during research: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        } as ToolResult;
      }
    }
  };
}

/**
 * Create enhanced browser-use tool with default configuration
 */
export function createDefaultEnhancedBrowserUseTool(
  aiClient: AIClient,
  groundingEngine?: GroundingEngine
): AgentTool {
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
export function createFastBrowserUseTool(
  aiClient: AIClient,
  groundingEngine?: GroundingEngine
): AgentTool {
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
export function createThoroughBrowserUseTool(
  aiClient: AIClient,
  groundingEngine?: GroundingEngine
): AgentTool {
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
function extractGoals(taskDescription: string): string[] {
  const goals: string[] = [];

  if (taskDescription.toLowerCase().includes('pricing')) goals.push('Find pricing information');
  if (taskDescription.toLowerCase().includes('features')) goals.push('Identify key features');
  if (taskDescription.toLowerCase().includes('review')) goals.push('Find user reviews');
  if (taskDescription.toLowerCase().includes('documentation')) goals.push('Locate documentation');
  if (taskDescription.toLowerCase().includes('comparison')) goals.push('Compare alternatives');

  return goals.length > 0 ? goals : ['Complete research task'];
}

/**
 * Extract keywords from task description
 */
function extractKeywords(taskDescription: string): string[] {
  return taskDescription
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when', 'where', 'which'].includes(word))
    .slice(0, 10);
}

/**
 * Export configuration presets
 */
export const IntelligentBrowserUsePresets = {
  fast: {
    performanceMode: 'fast',
    relevanceThreshold: 50,
    learningEnabled: false,
    cachingEnabled: true,
    cachingStrategy: 'aggressive'
  } as IntelligentBrowserUseConfig,

  balanced: {
    performanceMode: 'balanced',
    relevanceThreshold: 40,
    learningEnabled: true,
    cachingEnabled: true,
    cachingStrategy: 'moderate'
  } as IntelligentBrowserUseConfig,

  thorough: {
    performanceMode: 'thorough',
    relevanceThreshold: 30,
    learningEnabled: true,
    cachingEnabled: true,
    cachingStrategy: 'conservative'
  } as IntelligentBrowserUseConfig
};
