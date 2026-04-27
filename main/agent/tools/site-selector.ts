/**
 * SiteSelector Implementation for Intelligent Site Selection
 *
 * This module provides the primary orchestrator for intelligent site selection decisions,
 * implementing multi-factor scoring algorithms, site ranking, and threshold-based decision making.
 */

import {
  SiteSelector,
  SiteEvaluation,
  RankedSite,
  SelectionFeedback,
  ResearchContext,
  ReasoningFactor,
  RiskLevel,
  URLClassifier,
  RelevanceEngine,
  ContentAnalyzer,
  IntelligentSelectionConfig,
  PageContent,
  SharedResearchMemory
} from './intelligent-site-selection';
import { BaseSiteSelector } from './intelligent-site-selection-base';
import { AIClient } from '../../lib/ai-client';

/**
 * Scoring factors for multi-factor relevance algorithm
 */
interface ScoringFactors {
  urlPatterns: number;
  keywordMatch: number;
  domainAuthority: number;
  contentIndicators: number;
  contextualFit: number;
  uniqueness: number;
  riskAssessment: number;
}

/**
 * Concrete implementation of SiteSelector with multi-factor scoring
 */
export class SiteSelectorImpl extends BaseSiteSelector {
  private urlClassifier: URLClassifier;
  private relevanceEngine?: RelevanceEngine;
  private contentAnalyzer?: ContentAnalyzer;
  private scoringWeights: ScoringFactors;
  private feedbackHistory: SelectionFeedback[] = [];

  constructor(
    aiClient: AIClient,
    config: IntelligentSelectionConfig,
    urlClassifier: URLClassifier,
    relevanceEngine?: RelevanceEngine,
    contentAnalyzer?: ContentAnalyzer
  ) {
    super(aiClient, config);
    this.urlClassifier = urlClassifier;
    this.relevanceEngine = relevanceEngine;
    this.contentAnalyzer = contentAnalyzer;
    this.scoringWeights = this.initializeDefaultWeights();
  }

  /**
   * Evaluate a single site for relevance and value
   */
  async evaluateSite(url: string, context: ResearchContext): Promise<SiteEvaluation> {
    const startTime = Date.now();

    try {
      // Step 1: Fast URL classification
      const urlClassification = this.urlClassifier.classifyURL(url, context);

      // Step 2: Calculate multi-factor scoring
      const scoringFactors = await this.calculateScoringFactors(url, context, urlClassification);
      const relevanceScore = this.calculateWeightedScore(scoringFactors);

      // Step 3: Generate reasoning factors
      const reasoningFactors = this.generateReasoningFactors(scoringFactors, urlClassification);

      // Step 4: Assess risk and estimate value
      const riskAssessment = this.assessRisk(url, relevanceScore);
      const estimatedValue = this.estimateValue(relevanceScore, context);
      const confidenceLevel = this.calculateConfidence(scoringFactors, urlClassification);

      const evaluation: SiteEvaluation = {
        url,
        relevanceScore: Math.max(0, Math.min(100, relevanceScore)),
        confidenceLevel,
        reasoningFactors,
        estimatedValue,
        riskAssessment
      };

      // Log evaluation time for performance monitoring
      const evaluationTime = Date.now() - startTime;
      if (evaluationTime > 200) {
        console.warn(`Site evaluation took ${evaluationTime}ms for ${url}`);
      }

      return evaluation;
    } catch (error) {
      console.error(`Error evaluating site ${url}:`, error);

      // Return a safe fallback evaluation
      return {
        url,
        relevanceScore: 0,
        confidenceLevel: 0,
        reasoningFactors: [
          this.createReasoningFactor('error', 0, 0, `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        ],
        estimatedValue: 0,
        riskAssessment: RiskLevel.HIGH
      };
    }
  }

  /**
   * Rank multiple site candidates by relevance and priority
   */
  async rankSites(candidates: string[], context: ResearchContext): Promise<RankedSite[]> {
    if (candidates.length === 0) {
      return [];
    }

    // Evaluate all candidates
    const evaluations = await Promise.all(
      candidates.map(url => this.evaluateSite(url, context))
    );

    // Sort by relevance score (descending) and then by confidence
    const sortedEvaluations = evaluations.sort((a, b) => {
      const scoreDiff = b.relevanceScore - a.relevanceScore;
      if (Math.abs(scoreDiff) < 0.01) {
        // If scores are very close, use confidence as tiebreaker
        return b.confidenceLevel - a.confidenceLevel;
      }
      return scoreDiff;
    });

    // Convert to ranked sites
    return sortedEvaluations.map((evaluation, index) => ({
      url: evaluation.url,
      rank: index + 1,
      score: evaluation.relevanceScore,
      reasoning: this.generateRankingReasoning(evaluation, index + 1)
    }));
  }

  /**
   * Determine if a site should be visited based on threshold
   */
  shouldVisitSite(evaluation: SiteEvaluation): boolean {
    // Primary threshold check
    if (evaluation.relevanceScore < this.config.relevanceThreshold) {
      return false;
    }

    // Additional safety checks
    if (evaluation.riskAssessment === RiskLevel.HIGH) {
      return false;
    }

    // Confidence-based filtering for borderline cases
    if (evaluation.relevanceScore < this.config.relevanceThreshold + 10 &&
        evaluation.confidenceLevel < 0.6) {
      return false;
    }

    return true;
  }

  /**
   * Update selection strategy based on feedback
   */
  updateSelectionStrategy(feedback: SelectionFeedback): void {
    this.feedbackHistory.push(feedback);

    if (this.config.learningEnabled) {
      this.processSelectionFeedback(feedback);
    }

    // Trim feedback history to prevent memory issues
    if (this.feedbackHistory.length > 100) {
      this.feedbackHistory = this.feedbackHistory.slice(-100);
    }
  }

  /**
   * Process selection feedback for learning and adaptation
   */
  protected processSelectionFeedback(feedback: SelectionFeedback): void {
    // Analyze successful vs unsuccessful decisions
    const successfulDecisions = feedback.decisions.filter(decision => {
      const outcome = feedback.outcomes.find(o => o.url === decision.url);
      return outcome && outcome.userValue > 0.6;
    });

    const unsuccessfulDecisions = feedback.decisions.filter(decision => {
      const outcome = feedback.outcomes.find(o => o.url === decision.url);
      return outcome && outcome.userValue < 0.4;
    });

    // Adjust scoring weights based on feedback
    this.adjustScoringWeights(successfulDecisions, unsuccessfulDecisions);

    // Update URL classifier patterns if available
    if (this.urlClassifier.updatePatterns) {
      const learningData = this.generatePatternLearningData(successfulDecisions, unsuccessfulDecisions);
      this.urlClassifier.updatePatterns(learningData);
    }
  }

  /**
   * Calculate multi-factor scoring components
   */
  private async calculateScoringFactors(
    url: string,
    context: ResearchContext,
    urlClassification: any
  ): Promise<ScoringFactors> {
    const factors: ScoringFactors = {
      urlPatterns: urlClassification.score / 100, // Normalize to 0-1
      keywordMatch: this.calculateKeywordMatch(url, context.keywords),
      domainAuthority: this.calculateDomainAuthority(url),
      contentIndicators: this.calculateContentIndicators(url),
      contextualFit: this.calculateContextualFit(url, context),
      uniqueness: await this.calculateUniqueness(url, context),
      riskAssessment: this.calculateRiskScore(urlClassification.riskLevel)
    };

    return factors;
  }

  /**
   * Calculate weighted relevance score from scoring factors
   */
  private calculateWeightedScore(factors: ScoringFactors): number {
    const weightedSum =
      factors.urlPatterns * this.scoringWeights.urlPatterns +
      factors.keywordMatch * this.scoringWeights.keywordMatch +
      factors.domainAuthority * this.scoringWeights.domainAuthority +
      factors.contentIndicators * this.scoringWeights.contentIndicators +
      factors.contextualFit * this.scoringWeights.contextualFit +
      factors.uniqueness * this.scoringWeights.uniqueness +
      factors.riskAssessment * this.scoringWeights.riskAssessment;

    // Convert to 0-100 scale
    return weightedSum * 100;
  }

  /**
   * Generate detailed reasoning factors for transparency
   */
  private generateReasoningFactors(
    factors: ScoringFactors,
    urlClassification: any
  ): ReasoningFactor[] {
    const reasoningFactors: ReasoningFactor[] = [];

    // URL Pattern Analysis
    reasoningFactors.push(this.createReasoningFactor(
      'URL Patterns',
      this.scoringWeights.urlPatterns,
      factors.urlPatterns,
      `URL classification: ${urlClassification.category}, matched ${urlClassification.patterns.length} patterns`
    ));

    // Keyword Matching
    reasoningFactors.push(this.createReasoningFactor(
      'Keyword Match',
      this.scoringWeights.keywordMatch,
      factors.keywordMatch,
      `Keyword relevance score: ${(factors.keywordMatch * 100).toFixed(1)}%`
    ));

    // Domain Authority
    reasoningFactors.push(this.createReasoningFactor(
      'Domain Authority',
      this.scoringWeights.domainAuthority,
      factors.domainAuthority,
      `Domain authority assessment: ${(factors.domainAuthority * 100).toFixed(1)}%`
    ));

    // Content Indicators
    reasoningFactors.push(this.createReasoningFactor(
      'Content Indicators',
      this.scoringWeights.contentIndicators,
      factors.contentIndicators,
      `Content quality indicators: ${(factors.contentIndicators * 100).toFixed(1)}%`
    ));

    // Contextual Fit
    reasoningFactors.push(this.createReasoningFactor(
      'Contextual Fit',
      this.scoringWeights.contextualFit,
      factors.contextualFit,
      `Alignment with research context: ${(factors.contextualFit * 100).toFixed(1)}%`
    ));

    // Uniqueness
    reasoningFactors.push(this.createReasoningFactor(
      'Uniqueness',
      this.scoringWeights.uniqueness,
      factors.uniqueness,
      `Content uniqueness score: ${(factors.uniqueness * 100).toFixed(1)}%`
    ));

    // Risk Assessment
    reasoningFactors.push(this.createReasoningFactor(
      'Risk Assessment',
      this.scoringWeights.riskAssessment,
      factors.riskAssessment,
      `Risk level: ${urlClassification.riskLevel}`
    ));

    return reasoningFactors;
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordMatch(url: string, keywords: string[]): number {
    if (keywords.length === 0) return 0.5; // Neutral score for no keywords

    const urlLower = url.toLowerCase();
    let matchScore = 0;
    let totalKeywords = keywords.length;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();

      if (urlLower.includes(keywordLower)) {
        // Base match
        matchScore += 0.6;

        // Bonus for exact path segment match
        const pathSegments = url.split('/');
        if (pathSegments.some(segment => segment.toLowerCase() === keywordLower)) {
          matchScore += 0.3;
        }

        // Bonus for domain match
        if (this.extractDomain(url).includes(keywordLower)) {
          matchScore += 0.1;
        }
      }
    }

    return Math.min(1.0, matchScore / totalKeywords);
  }

  /**
   * Calculate domain authority score
   */
  private calculateDomainAuthority(url: string): number {
    const domain = this.extractDomain(url);

    // High authority domains
    const highAuthorityDomains = [
      'github.com', 'stackoverflow.com', 'microsoft.com', 'google.com',
      'amazon.com', 'apple.com', 'mozilla.org', 'w3.org', 'ieee.org'
    ];

    // Medium authority domains
    const mediumAuthorityDomains = [
      'medium.com', 'dev.to', 'hashnode.com', 'reddit.com', 'quora.com'
    ];

    if (highAuthorityDomains.some(authDomain => domain.includes(authDomain))) {
      return 0.9;
    }

    if (mediumAuthorityDomains.some(authDomain => domain.includes(authDomain))) {
      return 0.7;
    }

    // Check for common TLDs and domain characteristics
    if (domain.endsWith('.edu') || domain.endsWith('.gov') || domain.endsWith('.org')) {
      return 0.8;
    }

    if (domain.endsWith('.com') || domain.endsWith('.net')) {
      return 0.6;
    }

    // Unknown or suspicious domains
    if (domain.length < 4 || /\.(tk|ml|ga|cf)$/.test(domain)) {
      return 0.2;
    }

    return 0.5; // Default neutral score
  }

  /**
   * Calculate content indicators score
   */
  private calculateContentIndicators(url: string): number {
    const urlLower = url.toLowerCase();
    let score = 0.5; // Base score

    // Positive indicators
    const positiveIndicators = [
      { pattern: /pricing|price|cost/, boost: 0.2 },
      { pattern: /features|capabilities/, boost: 0.15 },
      { pattern: /docs|documentation/, boost: 0.15 },
      { pattern: /review|rating/, boost: 0.1 },
      { pattern: /demo|trial/, boost: 0.1 },
      { pattern: /comparison|vs/, boost: 0.1 }
    ];

    for (const indicator of positiveIndicators) {
      if (indicator.pattern.test(urlLower)) {
        score += indicator.boost;
      }
    }

    // Negative indicators
    const negativeIndicators = [
      { pattern: /login|signup/, penalty: -0.3 },
      { pattern: /admin|dashboard/, penalty: -0.2 },
      { pattern: /cookie|privacy|terms/, penalty: -0.2 },
      { pattern: /404|error/, penalty: -0.4 }
    ];

    for (const indicator of negativeIndicators) {
      if (indicator.pattern.test(urlLower)) {
        score += indicator.penalty;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate contextual fit score
   */
  private calculateContextualFit(url: string, context: ResearchContext): number {
    let fitScore = 0.5; // Base score

    // Goal alignment
    for (const goal of context.goals) {
      const goalLower = goal.toLowerCase();
      const urlLower = url.toLowerCase();

      if (goalLower.includes('pricing') && urlLower.includes('pricing')) {
        fitScore += 0.2;
      } else if (goalLower.includes('features') && urlLower.includes('features')) {
        fitScore += 0.15;
      } else if (goalLower.includes('documentation') && urlLower.includes('docs')) {
        fitScore += 0.15;
      } else if (goalLower.includes('review') && urlLower.includes('review')) {
        fitScore += 0.1;
      }
    }

    // Research phase alignment
    const urlLower = url.toLowerCase();
    switch (context.currentPhase) {
      case 'discovery':
        if (urlLower.includes('product') || urlLower.includes('overview')) {
          fitScore += 0.1;
        }
        break;
      case 'analysis':
        if (urlLower.includes('docs') || urlLower.includes('comparison')) {
          fitScore += 0.1;
        }
        break;
      case 'validation':
        if (urlLower.includes('review') || urlLower.includes('testimonial')) {
          fitScore += 0.1;
        }
        break;
    }

    return Math.max(0, Math.min(1, fitScore));
  }

  /**
   * Calculate uniqueness score (placeholder for now)
   */
  private async calculateUniqueness(url: string, context: ResearchContext): Promise<number> {
    // For now, return a heuristic-based uniqueness score
    // In a full implementation, this would check against visited URLs and content similarity

    const domain = this.extractDomain(url);
    const pathSegments = url.split('/').filter(segment => segment.length > 0);

    // More path segments generally indicate more specific content
    const pathComplexity = Math.min(1, pathSegments.length / 5);

    // Unique domains get higher scores
    const domainUniqueness = domain.length > 10 ? 0.8 : 0.6;

    return (pathComplexity + domainUniqueness) / 2;
  }

  /**
   * Calculate risk score from risk level
   */
  private calculateRiskScore(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case RiskLevel.LOW:
        return 0.9;
      case RiskLevel.MEDIUM:
        return 0.6;
      case RiskLevel.HIGH:
        return 0.1;
      default:
        return 0.5;
    }
  }

  /**
   * Calculate confidence level for the evaluation
   */
  private calculateConfidence(factors: ScoringFactors, urlClassification: any): number {
    // Base confidence on the consistency of scoring factors
    const factorValues = Object.values(factors);
    const mean = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
    const variance = factorValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / factorValues.length;
    const consistency = 1 - Math.min(1, variance * 2); // Lower variance = higher consistency

    // Factor in URL classification confidence
    const avgPatternConfidence = urlClassification.patterns.length > 0
      ? urlClassification.patterns.reduce((sum: number, p: any) => sum + p.confidence, 0) / urlClassification.patterns.length
      : 0.5;

    return (consistency + avgPatternConfidence) / 2;
  }

  /**
   * Estimate the value of visiting this site
   */
  private estimateValue(relevanceScore: number, context: ResearchContext): number {
    // Base value on relevance score
    let value = relevanceScore / 100;

    // Adjust based on research urgency
    if (context.timeConstraints.urgency === 'high') {
      value *= 1.2; // Higher value for urgent research
    } else if (context.timeConstraints.urgency === 'low') {
      value *= 0.8; // Lower value for non-urgent research
    }

    // Adjust based on quality requirements
    if (context.qualityRequirements.requireMultipleSources) {
      value *= 0.9; // Slightly lower individual value when multiple sources needed
    }

    return Math.max(0, Math.min(1, value));
  }

  /**
   * Generate ranking reasoning explanation
   */
  private generateRankingReasoning(evaluation: SiteEvaluation, rank: number): string {
    const topFactors = evaluation.reasoningFactors
      .sort((a, b) => (b.weight * b.contribution) - (a.weight * a.contribution))
      .slice(0, 3);

    const factorDescriptions = topFactors.map(factor =>
      `${factor.factor} (${(factor.contribution * 100).toFixed(1)}%)`
    ).join(', ');

    return `Rank ${rank}: Score ${evaluation.relevanceScore.toFixed(1)}/100. ` +
           `Key factors: ${factorDescriptions}. ` +
           `Confidence: ${(evaluation.confidenceLevel * 100).toFixed(1)}%`;
  }

  /**
   * Initialize default scoring weights
   */
  private initializeDefaultWeights(): ScoringFactors {
    return {
      urlPatterns: 0.25,      // 25% - URL pattern matching
      keywordMatch: 0.20,     // 20% - Keyword relevance
      domainAuthority: 0.15,  // 15% - Domain trustworthiness
      contentIndicators: 0.15, // 15% - Content type indicators
      contextualFit: 0.10,    // 10% - Research context alignment
      uniqueness: 0.10,       // 10% - Content uniqueness
      riskAssessment: 0.05    // 5% - Risk factors
    };
  }

  /**
   * Adjust scoring weights based on feedback
   */
  private adjustScoringWeights(
    successfulDecisions: any[],
    unsuccessfulDecisions: any[]
  ): void {
    // This is a simplified weight adjustment algorithm
    // In a full implementation, this would use more sophisticated machine learning

    const adjustment = 0.05; // Small adjustment per feedback cycle

    // Analyze which factors contributed to successful decisions
    // For now, we'll use a simple heuristic approach

    if (successfulDecisions.length > unsuccessfulDecisions.length) {
      // If more successes, slightly increase confidence in current weights
      // No adjustment needed
    } else if (unsuccessfulDecisions.length > successfulDecisions.length) {
      // If more failures, adjust weights to emphasize different factors
      this.scoringWeights.urlPatterns += adjustment;
      this.scoringWeights.keywordMatch += adjustment;
      this.scoringWeights.riskAssessment += adjustment;

      // Normalize weights to ensure they sum to 1
      this.normalizeWeights();
    }
  }

  /**
   * Normalize scoring weights to sum to 1
   */
  private normalizeWeights(): void {
    const totalWeight = Object.values(this.scoringWeights).reduce((sum, weight) => sum + weight, 0);

    if (totalWeight > 0) {
      for (const key in this.scoringWeights) {
        this.scoringWeights[key as keyof ScoringFactors] /= totalWeight;
      }
    }
  }

  /**
   * Generate pattern learning data from feedback
   */
  private generatePatternLearningData(
    successfulDecisions: any[],
    unsuccessfulDecisions: any[]
  ): any {
    // Extract patterns from successful and unsuccessful URLs
    const successPatterns = successfulDecisions.map(decision => ({
      type: 'url',
      pattern: this.extractPatternFromURL(decision.url),
      confidence: 0.8,
      successRate: 0.9,
      lastUpdated: Date.now()
    }));

    const failurePatterns = unsuccessfulDecisions.map(decision => ({
      type: 'url',
      pattern: this.extractPatternFromURL(decision.url),
      confidence: 0.3,
      successRate: 0.2,
      lastUpdated: Date.now()
    }));

    return {
      successPatterns,
      failurePatterns,
      contextualFactors: {}
    };
  }

  /**
   * Extract pattern from URL for learning
   */
  private extractPatternFromURL(url: string): string {
    // Simple pattern extraction - in a full implementation this would be more sophisticated
    const urlLower = url.toLowerCase();

    if (urlLower.includes('pricing')) return 'pricing';
    if (urlLower.includes('features')) return 'features';
    if (urlLower.includes('docs')) return 'documentation';
    if (urlLower.includes('review')) return 'reviews';
    if (urlLower.includes('login')) return 'login';
    if (urlLower.includes('admin')) return 'admin';

    return 'general';
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      // Fallback for malformed URLs
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1].toLowerCase() : '';
    }
  }
}
