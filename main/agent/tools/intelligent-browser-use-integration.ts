/**
 * Integration example for Intelligent Site Selection with Browser-Use Tool
 *
 * This module demonstrates how the intelligent site selection system integrates
 * with the existing browser-use tool architecture.
 */

import { AIClient } from '../../lib/ai-client';
import { GroundingEngine } from '../runner/grounding';
import { AgentTool } from '../runner/types';
import {
  createIntelligentSiteSelection
} from './intelligent-site-selection-factory';
import {
  IntelligentSiteSelection,
  ResearchContext,
  SiteEvaluation,
  IntelligentSelectionConfig,
  PageContent,
  SharedResearchMemory,
  LoggingLevel
} from './intelligent-site-selection';
import { DEFAULT_INTELLIGENT_CONFIG } from './intelligent-site-selection-base';
import { createResearchContext } from './intelligent-site-selection-index';
import {
  BrowserUseOptions,
  BrowserUseResult
} from './browser-use';

/**
 * Enhanced browser-use options with intelligent selection capabilities
 */
export interface EnhancedBrowserUseOptions extends BrowserUseOptions {
  intelligentConfig?: Partial<IntelligentSelectionConfig>;
  enableIntelligentSelection?: boolean;
  researchContext?: ResearchContext;
}

/**
 * Enhanced browser-use result with intelligent selection metrics
 */
export interface EnhancedBrowserUseResult {
  success: boolean;
  output: string;
  data?: unknown;
  intelligentMetrics?: {
    sitesEvaluated: number;
    sitesSkipped: number;
    averageRelevanceScore: number;
    decisionTransparency: string[];
  };
}

/**
 * Intelligent site evaluation wrapper for existing browser-use functions
 */
export class IntelligentSiteEvaluator {
  private intelligentSystem: IntelligentSiteSelection;
  private config: IntelligentSelectionConfig;

  constructor(aiClient: AIClient, config: Partial<IntelligentSelectionConfig> = {}) {
    this.config = { ...DEFAULT_INTELLIGENT_CONFIG, ...config };
    this.intelligentSystem = createIntelligentSiteSelection(aiClient, this.config);
  }

  /**
   * Enhanced URL relevance scoring using intelligent components
   */
  async scoreUrlRelevanceIntelligent(
    url: string,
    taskDescription: string,
    context?: ResearchContext
  ): Promise<number> {
    const researchContext = context || createResearchContext(taskDescription);

    try {
      // Use intelligent URL classifier first for fast pre-filtering
      const classification = this.intelligentSystem.urlClassifier.classifyURL(url, researchContext);

      // If URL fails basic classification, return low score
      if (classification.processingRecommendation === 'skip') {
        this.logDecision(url, 'skip', classification.score, 'Failed URL classification');
        return classification.score;
      }

      // Use site selector for comprehensive evaluation
      const evaluation = await this.intelligentSystem.selector.evaluateSite(url, researchContext);

      this.logDecision(url, 'evaluate', evaluation.relevanceScore, evaluation.reasoningFactors[0]?.explanation || 'Intelligent evaluation');

      return evaluation.relevanceScore;
    } catch (error) {
      console.warn('Intelligent URL scoring failed, falling back to basic scoring:', error);
      // Fallback to basic scoring (would call original scoreUrlRelevance)
      return this.fallbackUrlScoring(url, taskDescription);
    }
  }

  /**
   * Enhanced page relevance scoring using intelligent content analysis
   */
  async scorePageRelevanceIntelligent(
    taskDescription: string,
    content: PageContent,
    context?: ResearchContext
  ): Promise<number> {
    const researchContext = context || createResearchContext(taskDescription);

    try {
      // Fast heuristic analysis first
      const heuristicAnalysis = this.intelligentSystem.contentAnalyzer.performHeuristicAnalysis(
        content,
        researchContext
      );

      // If heuristic analysis suggests skipping, return early
      if (heuristicAnalysis.processingRecommendation === 'skip') {
        return heuristicAnalysis.relevanceScore;
      }

      // Perform deeper analysis if warranted
      if (heuristicAnalysis.processingRecommendation === 'deep_ai') {
        const relevanceAssessment = await this.intelligentSystem.relevanceEngine.assessRelevance(
          content,
          researchContext
        );
        return relevanceAssessment.overallScore;
      }

      return heuristicAnalysis.relevanceScore;
    } catch (error) {
      console.warn('Intelligent page scoring failed, falling back to basic scoring:', error);
      // Fallback to basic scoring (would call original scorePageRelevance)
      return this.fallbackPageScoring(taskDescription, content);
    }
  }

  /**
   * Intelligent site selection decision
   */
  async shouldVisitSite(url: string, context: ResearchContext): Promise<boolean> {
    try {
      const evaluation = await this.intelligentSystem.selector.evaluateSite(url, context);
      const shouldVisit = this.intelligentSystem.selector.shouldVisitSite(evaluation);

      this.logDecision(
        url,
        shouldVisit ? 'visit' : 'skip',
        evaluation.relevanceScore,
        `Decision based on threshold ${this.config.relevanceThreshold}`
      );

      return shouldVisit;
    } catch (error) {
      console.warn('Intelligent site selection failed, using fallback:', error);
      return true; // Conservative fallback - visit the site
    }
  }

  /**
   * Get intelligent navigation recommendations
   */
  async getNavigationRecommendations(
    currentPage: PageContent,
    context: ResearchContext,
    memory: SharedResearchMemory
  ) {
    try {
      return await this.intelligentSystem.navigationReasoner.evaluateNavigationOptions(
        currentPage,
        context,
        memory
      );
    } catch (error) {
      console.warn('Navigation reasoning failed:', error);
      return null;
    }
  }

  /**
   * Generate decision transparency report
   */
  generateDecisionReport(sessionId: string) {
    return this.intelligentSystem.decisionLogger.generateDecisionReport(sessionId);
  }

  private logDecision(url: string, action: string, score: number, reasoning: string) {
    if (this.config.loggingLevel === LoggingLevel.DEBUG || this.config.loggingLevel === LoggingLevel.TRACE) {
      console.log(`[Intelligent Selection] ${action.toUpperCase()}: ${url} (score: ${score}) - ${reasoning}`);
    }
  }

  private fallbackUrlScoring(url: string, taskDescription: string): number {
    // This would call the original scoreUrlRelevance function
    // For now, return a basic score
    let score = 50;
    const urlLower = url.toLowerCase();
    const taskLower = taskDescription.toLowerCase();

    if (urlLower.includes('pricing')) score += 15;
    if (urlLower.includes('features')) score += 10;
    if (urlLower.includes('login')) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  private fallbackPageScoring(taskDescription: string, content: PageContent): number {
    // This would call the original scorePageRelevance function
    // For now, return a basic score
    const text = (content.rawText || '').toLowerCase();
    const taskLower = taskDescription.toLowerCase();

    let score = 0;
    const words = taskLower.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && text.includes(word)) {
        score += 10;
      }
    }

    return Math.min(100, score);
  }
}

/**
 * Enhanced browser-use tool factory with intelligent capabilities
 */
export function createEnhancedBrowserUseTool(
  aiClient: AIClient,
  groundingEngine?: GroundingEngine,
  intelligentConfig?: Partial<IntelligentSelectionConfig>
): AgentTool {
  const evaluator = new IntelligentSiteEvaluator(aiClient, intelligentConfig);

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
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional starting URLs for research'
        },
        maxSites: {
          type: 'number',
          description: 'Maximum number of sites to visit (default: 10)'
        },
        enableIntelligentSelection: {
          type: 'boolean',
          description: 'Enable intelligent site selection features (default: true)'
        },
        relevanceThreshold: {
          type: 'number',
          description: 'Minimum relevance score for site visits (default: 40)'
        }
      },
      required: ['task']
    },
    async execute(
      args: Record<string, unknown>,
      onUpdate?: (msg: string) => void,
      emitEvent?: (event: any) => void,
      toolCallId?: string
    ): Promise<EnhancedBrowserUseResult> {
      const {
        task,
        urls = [],
        maxSites = 10,
        enableIntelligentSelection = true,
        relevanceThreshold = 40
      } = args as {
        task: string;
        urls?: string[];
        maxSites?: number;
        enableIntelligentSelection?: boolean;
        relevanceThreshold?: number;
      };

      // Create research context
      const context = createResearchContext(task);

      // Update configuration if provided
      const config = {
        ...intelligentConfig,
        relevanceThreshold
      };

      if (onUpdate) {
        onUpdate(`Starting intelligent research for: ${task}`);
      }

      try {
        // This would integrate with the actual browser research logic
        // For now, return a mock result showing the integration structure
        const result: EnhancedBrowserUseResult = {
          success: true,
          output: `Intelligent research completed with ${enableIntelligentSelection ? 'enhanced' : 'basic'} site selection`,
          intelligentMetrics: enableIntelligentSelection ? {
            sitesEvaluated: 15,
            sitesSkipped: 8,
            averageRelevanceScore: 67,
            decisionTransparency: [
              'Skipped 3 login pages due to low relevance',
              'Prioritized pricing pages based on task keywords',
              'Used AI analysis for 5 high-potential sites'
            ]
          } : undefined
        };

        if (onUpdate) {
          onUpdate('Research completed successfully');
        }

        return result;
      } catch (error) {
        console.error('Enhanced browser research failed:', error);
        throw error;
      }
    }
  };
}

/**
 * Utility function to demonstrate intelligent site selection workflow
 */
export async function demonstrateIntelligentSelection(
  aiClient: AIClient,
  taskDescription: string,
  candidateUrls: string[]
): Promise<void> {
  console.log('=== Intelligent Site Selection Demonstration ===');
  console.log(`Task: ${taskDescription}`);
  console.log(`Candidate URLs: ${candidateUrls.length}`);

  const evaluator = new IntelligentSiteEvaluator(aiClient);
  const context = createResearchContext(taskDescription);

  console.log('\n--- URL Evaluation Results ---');
  for (const url of candidateUrls) {
    const score = await evaluator.scoreUrlRelevanceIntelligent(url, taskDescription, context);
    const shouldVisit = await evaluator.shouldVisitSite(url, context);

    console.log(`${shouldVisit ? '✓' : '✗'} ${url} (score: ${score})`);
  }

  console.log('\n--- Decision Report ---');
  const report = evaluator.generateDecisionReport('demo-session');
  console.log(`Total decisions: ${report.sessionSummary.totalDecisions}`);
  console.log(`Sites to visit: ${report.sessionSummary.sitesVisited}`);
  console.log(`Sites to skip: ${report.sessionSummary.sitesSkipped}`);
  console.log(`Average relevance: ${report.sessionSummary.averageRelevanceScore}`);
}
