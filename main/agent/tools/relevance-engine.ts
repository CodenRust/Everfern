/**
 * Relevance Engine - AI-powered relevance assessment with contextual understanding
 *
 * This component provides intelligent relevance assessment for page content,
 * analyzes content gaps, and maintains a caching system for performance optimization.
 */

import { AIClient } from '../../lib/ai-client';
import {
  RelevanceEngine,
  RelevanceAssessment,
  CategoryScores,
  PageContent,
  ResearchContext,
  SharedResearchMemory,
  ContentGapAnalysis,
  LearningData,
  IntelligentSelectionConfig,
  CachedRelevanceAssessment,
  CacheInvalidationCriteria,
  CacheStrategy,
  LoggingLevel
} from './intelligent-site-selection';
import { BaseRelevanceEngine } from './intelligent-site-selection-base';
import * as crypto from 'crypto';

/**
 * RelevanceEngineImpl - Concrete implementation of RelevanceEngine
 *
 * Provides AI-powered relevance assessment with:
 * - Contextual understanding of research goals
 * - Content gap analysis
 * - Intelligent caching for performance
 * - Adaptive scoring weights based on learning data
 */
export class RelevanceEngineImpl extends BaseRelevanceEngine implements RelevanceEngine {
  private relevanceCache: Map<string, CachedRelevanceAssessment>;
  private categoryWeights: CategoryScores;
  private contextCache: Map<string, ResearchContext>;
  private cacheHitCount: number = 0;
  private cacheMissCount: number = 0;

  constructor(aiClient: AIClient, config: IntelligentSelectionConfig) {
    super(aiClient, config);
    this.relevanceCache = new Map();
    this.contextCache = new Map();
    this.categoryWeights = {
      pricing: 0.2,
      features: 0.2,
      documentation: 0.15,
      reviews: 0.15,
      technical: 0.15,
      competitive: 0.15
    };
  }

  /**
   * Assess relevance of page content with contextual understanding
   *
   * Validates: Requirements 1.3, 4.1, 4.2
   */
  async assessRelevance(
    content: PageContent,
    context: ResearchContext
  ): Promise<RelevanceAssessment> {
    const contentHash = this.generateContentHashImpl(content, context);

    // Check cache first
    const cached = this.getCachedAssessment(contentHash);
    if (cached) {
      this.cacheHitCount++;
      this.log(`Cache hit for content hash: ${contentHash}`, LoggingLevel.DEBUG);
      return cached;
    }

    this.cacheMissCount++;

    // Perform assessment
    const assessment = await this.performRelevanceAssessment(content, context);

    // Cache the result
    this.setCachedAssessment(contentHash, assessment);

    return assessment;
  }

  /**
   * Analyze content gaps in research memory
   *
   * Identifies missing information types and prioritizes them
   */
  analyzeContentGaps(memory: SharedResearchMemory, goals: string[]): ContentGapAnalysis {
    const gaps: ContentGapAnalysis = {
      missingCategories: [],
      incompleteAreas: [],
      priorityGaps: []
    };

    // Analyze which categories are missing from collected facts
    const categoryPresence = this.analyzeCategoryPresence(memory);

    // Identify missing categories based on goals
    const goalCategories = this.extractCategoriesFromGoals(goals);
    for (const category of goalCategories) {
      if (!categoryPresence[category] || categoryPresence[category] === 0) {
        gaps.missingCategories.push(category);
      }
    }

    // Identify incomplete areas (categories with low coverage)
    for (const [category, count] of Object.entries(categoryPresence)) {
      if (count > 0 && count < 3) {
        gaps.incompleteAreas.push(category);
      }
    }

    // Prioritize gaps based on goal alignment
    gaps.priorityGaps = this.prioritizeGaps(gaps.missingCategories, gaps.incompleteAreas, goals);

    return gaps;
  }

  /**
   * Adapt scoring weights based on learning data
   *
   * Updates category weights to reflect successful patterns
   */
  adaptScoringWeights(learningData: LearningData): void {
    if (!learningData.weights) {
      return;
    }

    // Apply learning data to category weights
    const successRate = this.calculateSuccessRate(learningData);

    // Adjust weights based on success patterns
    for (const pattern of learningData.patterns) {
      if (pattern.successRate > 0.7) {
        // Boost weight for successful patterns
        this.boostCategoryWeight(pattern.type, pattern.successRate);
      } else if (pattern.successRate < 0.3) {
        // Reduce weight for unsuccessful patterns
        this.reduceCategoryWeight(pattern.type, pattern.successRate);
      }
    }

    this.log('Scoring weights adapted based on learning data', LoggingLevel.INFO);
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHitCount + this.cacheMissCount;
    const hitRate = total > 0 ? this.cacheHitCount / total : 0;
    return {
      hits: this.cacheHitCount,
      misses: this.cacheMissCount,
      hitRate
    };
  }

  /**
   * Clear cache based on invalidation criteria
   */
  invalidateCache(criteria: CacheInvalidationCriteria): void {
    const now = Date.now();
    let invalidatedCount = 0;

    for (const [key, cached] of this.relevanceCache.entries()) {
      let shouldInvalidate = false;

      if (criteria.olderThan && cached.timestamp < now - criteria.olderThan) {
        shouldInvalidate = true;
      }

      if (criteria.contextChanged && this.hasContextChanged(cached.contextHash)) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        this.relevanceCache.delete(key);
        invalidatedCount++;
      }
    }

    this.log(`Invalidated ${invalidatedCount} cache entries`, LoggingLevel.DEBUG);
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHashImpl(content: PageContent, context: ResearchContext): string {
    const contentStr = `${content.title}|${content.url}|${content.rawText?.substring(0, 500) || ''}`;
    const contextStr = `${context.taskDescription}|${context.keywords.join(',')}`;
    const combined = contentStr + contextStr;
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
  }

  /**
   * Perform the actual relevance assessment using AI
   */
  private async performRelevanceAssessment(
    content: PageContent,
    context: ResearchContext
  ): Promise<RelevanceAssessment> {
    // Build assessment prompt
    const prompt = this.buildRelevanceAssessmentPrompt(content, context);

    try {
      // Call AI to assess relevance
      const response = await this.aiClient.chat({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 500
      });

      // Parse response into RelevanceAssessment
      let content: string;
      if (Array.isArray(response.content)) {
        const firstItem = response.content[0];
        if (firstItem && typeof firstItem === 'object' && 'text' in firstItem) {
          content = (firstItem as any).text || '';
        } else {
          content = '';
        }
      } else {
        content = typeof response.content === 'string' ? response.content : '';
      }
      const assessment = this.parseRelevanceResponse(content);

      return assessment;
    } catch (error) {
      this.log(`Error assessing relevance: ${error}`, LoggingLevel.ERROR);
      // Return default assessment on error
      return this.getDefaultAssessment();
    }
  }

  /**
   * Build prompt for AI relevance assessment
   */
  private buildRelevanceAssessmentPrompt(content: PageContent, context: ResearchContext): string {
    const contentText = this.extractContentText(content);
    const goalsText = context.goals.join(', ');
    const keywordsText = context.keywords.join(', ');

    return `Assess the relevance of the following page content to a research task.

Research Task: ${context.taskDescription}
Goals: ${goalsText}
Keywords: ${keywordsText}

Page Title: ${content.title}
Page URL: ${content.url}
Meta Description: ${content.metaDescription}

Content Summary:
${contentText.substring(0, 1000)}

Provide a JSON response with the following structure:
{
  "overallScore": <0-100>,
  "categoryScores": {
    "pricing": <0-100>,
    "features": <0-100>,
    "documentation": <0-100>,
    "reviews": <0-100>,
    "technical": <0-100>,
    "competitive": <0-100>
  },
  "contentQuality": <0-100>,
  "informationDensity": <0-100>,
  "uniquenessScore": <0-100>,
  "contextualFit": <0-100>
}

Focus on:
1. How well the content matches the research goals
2. The quality and depth of information provided
3. The relevance of specific content categories
4. How unique or novel the information is
5. How well it fits the current research context`;
  }

  /**
   * Parse AI response into RelevanceAssessment
   */
  private parseRelevanceResponse(response: string): RelevanceAssessment {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultAssessment();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overallScore: Math.min(100, Math.max(0, parsed.overallScore || 50)),
        categoryScores: {
          pricing: Math.min(100, Math.max(0, parsed.categoryScores?.pricing || 0)),
          features: Math.min(100, Math.max(0, parsed.categoryScores?.features || 0)),
          documentation: Math.min(100, Math.max(0, parsed.categoryScores?.documentation || 0)),
          reviews: Math.min(100, Math.max(0, parsed.categoryScores?.reviews || 0)),
          technical: Math.min(100, Math.max(0, parsed.categoryScores?.technical || 0)),
          competitive: Math.min(100, Math.max(0, parsed.categoryScores?.competitive || 0))
        },
        contentQuality: Math.min(100, Math.max(0, parsed.contentQuality || 50)),
        informationDensity: Math.min(100, Math.max(0, parsed.informationDensity || 50)),
        uniquenessScore: Math.min(100, Math.max(0, parsed.uniquenessScore || 50)),
        contextualFit: Math.min(100, Math.max(0, parsed.contextualFit || 50))
      };
    } catch (error) {
      this.log(`Error parsing relevance response: ${error}`, LoggingLevel.WARN);
      return this.getDefaultAssessment();
    }
  }

  /**
   * Extract text content from PageContent
   */
  private extractContentText(content: PageContent): string {
    const parts: string[] = [];

    if (content.title) parts.push(`Title: ${content.title}`);
    if (content.metaDescription) parts.push(`Description: ${content.metaDescription}`);
    if (content.headings.length > 0) parts.push(`Headings: ${content.headings.join(', ')}`);
    if (content.paragraphs.length > 0) {
      parts.push(`Content: ${content.paragraphs.slice(0, 5).join(' ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Analyze which categories are present in memory
   */
  private analyzeCategoryPresence(memory: SharedResearchMemory): Record<string, number> {
    const presence: Record<string, number> = {
      pricing: 0,
      features: 0,
      documentation: 0,
      reviews: 0,
      technical: 0,
      competitive: 0
    };

    // This would need access to the actual facts in memory
    // For now, return default presence
    return presence;
  }

  /**
   * Extract categories from research goals
   */
  private extractCategoriesFromGoals(goals: string[]): string[] {
    const categories: Set<string> = new Set();
    const categoryKeywords: Record<string, string[]> = {
      pricing: ['price', 'cost', 'plan', 'subscription', 'fee'],
      features: ['feature', 'capability', 'functionality', 'benefit'],
      documentation: ['doc', 'guide', 'tutorial', 'api', 'reference'],
      reviews: ['review', 'rating', 'feedback', 'testimonial'],
      technical: ['technical', 'architecture', 'implementation', 'spec'],
      competitive: ['competitor', 'comparison', 'alternative', 'vs']
    };

    for (const goal of goals) {
      const lowerGoal = goal.toLowerCase();
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => lowerGoal.includes(kw))) {
          categories.add(category);
        }
      }
    }

    return Array.from(categories);
  }

  /**
   * Prioritize gaps based on goal alignment
   */
  private prioritizeGaps(
    missing: string[],
    incomplete: string[],
    goals: string[]
  ): Array<{ area: string; priority: number }> {
    const gaps: Array<{ area: string; priority: number }> = [];

    // Missing categories get higher priority
    for (const area of missing) {
      gaps.push({ area, priority: 10 });
    }

    // Incomplete areas get medium priority
    for (const area of incomplete) {
      gaps.push({ area, priority: 5 });
    }

    // Sort by priority
    gaps.sort((a, b) => b.priority - a.priority);

    return gaps;
  }

  /**
   * Calculate success rate from learning data
   */
  private calculateSuccessRate(learningData: LearningData): number {
    if (!learningData.outcomes || learningData.outcomes.length === 0) {
      return 0.5;
    }

    const totalValue = learningData.outcomes.reduce((sum, o) => sum + o.userValue, 0);
    const avgValue = totalValue / learningData.outcomes.length;

    return Math.min(1, avgValue / 100);
  }

  /**
   * Boost category weight for successful patterns
   */
  private boostCategoryWeight(category: string, successRate: number): void {
    const boost = successRate * 0.1; // Max 10% boost
    const key = category as keyof CategoryScores;
    if (key in this.categoryWeights) {
      this.categoryWeights[key] = Math.min(1, this.categoryWeights[key] + boost);
    }
  }

  /**
   * Reduce category weight for unsuccessful patterns
   */
  private reduceCategoryWeight(category: string, successRate: number): void {
    const reduction = (1 - successRate) * 0.1; // Max 10% reduction
    const key = category as keyof CategoryScores;
    if (key in this.categoryWeights) {
      this.categoryWeights[key] = Math.max(0, this.categoryWeights[key] - reduction);
    }
  }

  /**
   * Check if context has changed
   */
  private hasContextChanged(contextHash: string): boolean {
    // Simple implementation - in production would compare actual contexts
    return false;
  }

  /**
   * Initialize default category weights
   */
  private initializeDefaultWeights(): void {
    this.categoryWeights = {
      pricing: 0.2,
      features: 0.2,
      documentation: 0.15,
      reviews: 0.15,
      technical: 0.15,
      competitive: 0.15
    };
  }

  /**
   * Get default assessment when AI fails
   */
  private getDefaultAssessment(): RelevanceAssessment {
    return {
      overallScore: 50,
      categoryScores: {
        pricing: 50,
        features: 50,
        documentation: 50,
        reviews: 50,
        technical: 50,
        competitive: 50
      },
      contentQuality: 50,
      informationDensity: 50,
      uniquenessScore: 50,
      contextualFit: 50
    };
  }

  /**
   * Logging helper
   */
  private log(message: string, level: LoggingLevel): void {
    if (this.config.loggingLevel === LoggingLevel.NONE) {
      return;
    }

    const levelOrder = [
      LoggingLevel.TRACE,
      LoggingLevel.DEBUG,
      LoggingLevel.INFO,
      LoggingLevel.WARN,
      LoggingLevel.ERROR,
      LoggingLevel.NONE
    ];

    const configLevelIndex = levelOrder.indexOf(this.config.loggingLevel);
    const messageLevelIndex = levelOrder.indexOf(level);

    if (messageLevelIndex >= configLevelIndex) {
      console.log(`[RelevanceEngine] ${message}`);
    }
  }
}
