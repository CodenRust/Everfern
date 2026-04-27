/**
 * Learning System for Intelligent Site Selection
 *
 * This module implements the learning system that enables the intelligent site selection
 * system to adapt and improve over time through pattern learning, feedback integration,
 * and adaptive weighting of scoring factors.
 */

import {
  LearningSystem,
  PatternDatabase,
  FeedbackProcessor,
  AdaptationEngine,
  PerformanceTracker,
  Pattern,
  ScoringWeights,
  SelectionFeedback,
  ResearchOutcome,
  LearningData,
  PerformanceMetrics,
  ResearchContext,
  IntelligentSelectionConfig
} from './intelligent-site-selection';

// ============================================================================
// Pattern Database Implementation
// ============================================================================

export class PatternDatabaseImpl implements PatternDatabase {
  private patterns: Map<string, Pattern> = new Map();
  private patternsByType: Map<string, Pattern[]> = new Map();

  getPatterns(type: string): Pattern[] {
    return this.patternsByType.get(type) || [];
  }

  addPattern(pattern: Pattern): void {
    const patternId = this.generatePatternId(pattern);
    this.patterns.set(patternId, pattern);

    if (!this.patternsByType.has(pattern.type)) {
      this.patternsByType.set(pattern.type, []);
    }
    this.patternsByType.get(pattern.type)!.push(pattern);
  }

  updatePattern(pattern: Pattern): void {
    const patternId = this.generatePatternId(pattern);
    const existing = this.patterns.get(patternId);

    if (existing) {
      // Update the pattern with new data
      const updated: Pattern = {
        ...existing,
        ...pattern,
        lastUpdated: Date.now()
      };
      this.patterns.set(patternId, updated);

      // Update in type index
      const typePatterns = this.patternsByType.get(pattern.type) || [];
      const index = typePatterns.findIndex(p => this.generatePatternId(p) === patternId);
      if (index >= 0) {
        typePatterns[index] = updated;
      }
    } else {
      this.addPattern(pattern);
    }
  }

  removePattern(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      this.patterns.delete(patternId);

      const typePatterns = this.patternsByType.get(pattern.type) || [];
      const index = typePatterns.findIndex(p => this.generatePatternId(p) === patternId);
      if (index >= 0) {
        typePatterns.splice(index, 1);
      }
    }
  }

  private generatePatternId(pattern: Pattern): string {
    return `${pattern.type}:${pattern.pattern}`;
  }

  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  clearPatterns(): void {
    this.patterns.clear();
    this.patternsByType.clear();
  }
}

// ============================================================================
// Feedback Processor Implementation
// ============================================================================

export class FeedbackProcessorImpl implements FeedbackProcessor {
  private feedbackHistory: SelectionFeedback[] = [];
  private currentWeights: ScoringWeights;
  private config: IntelligentSelectionConfig;

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
    this.currentWeights = this.getDefaultWeights();
  }

  processFeedback(feedback: SelectionFeedback): void {
    if (!this.config.learningEnabled) {
      return;
    }

    this.feedbackHistory.push(feedback);

    // Keep only recent feedback to avoid memory issues
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-1000);
    }

    // Update weights based on feedback
    this.updateWeightsFromFeedback(feedback);
  }

  generateLearningData(): LearningData {
    const patterns = this.extractPatterns();
    const outcomes = this.extractOutcomes();
    const feedback = [...this.feedbackHistory];

    return {
      patterns,
      outcomes,
      feedback,
      weights: this.currentWeights
    };
  }

  updateWeights(weights: ScoringWeights): void {
    this.currentWeights = weights;
  }

  getCurrentWeights(): ScoringWeights {
    return { ...this.currentWeights };
  }

  private updateWeightsFromFeedback(feedback: SelectionFeedback): void {
    if (feedback.outcomes.length === 0) {
      return;
    }

    // Calculate average user value from outcomes
    const avgUserValue = feedback.outcomes.reduce((sum, o) => sum + o.userValue, 0) / feedback.outcomes.length;

    // Adjust weights based on user rating and outcomes
    const adjustmentFactor = (feedback.userRating / 5) * 0.1; // Max 10% adjustment

    // Increase weights for factors that contributed to high-value outcomes
    if (avgUserValue > 0.7) {
      this.currentWeights.contentQuality += adjustmentFactor;
      this.currentWeights.informationDensity += adjustmentFactor;
      this.currentWeights.contextualFit += adjustmentFactor;
    }

    // Decrease weights for factors that led to low-value outcomes
    if (avgUserValue < 0.3) {
      this.currentWeights.urlPatterns -= adjustmentFactor;
      this.currentWeights.userSignals -= adjustmentFactor;
    }

    // Normalize weights to sum to 1
    this.normalizeWeights();
  }

  private extractPatterns(): Pattern[] {
    const patterns: Pattern[] = [];
    const patternMap = new Map<string, { successes: number; total: number }>();

    for (const feedback of this.feedbackHistory) {
      for (const decision of feedback.decisions) {
        const patternKey = `${decision.url}:${decision.score}`;
        const outcome = feedback.outcomes.find(o => o.url === decision.url);

        if (outcome) {
          const current = patternMap.get(patternKey) || { successes: 0, total: 0 };
          current.total++;
          if (outcome.userValue > 0.6) {
            current.successes++;
          }
          patternMap.set(patternKey, current);
        }
      }
    }

    // Convert to Pattern objects
    for (const [key, stats] of patternMap.entries()) {
      const successRate = stats.total > 0 ? stats.successes / stats.total : 0;
      patterns.push({
        type: 'url_pattern',
        pattern: key,
        confidence: Math.min(1, stats.total / 10), // Confidence increases with sample size
        successRate,
        lastUpdated: Date.now()
      });
    }

    return patterns;
  }

  private extractOutcomes(): ResearchOutcome[] {
    const outcomes: ResearchOutcome[] = [];

    for (const feedback of this.feedbackHistory) {
      outcomes.push(...feedback.outcomes);
    }

    return outcomes;
  }

  private normalizeWeights(): void {
    const sum = Object.values(this.currentWeights).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (const key in this.currentWeights) {
        (this.currentWeights as any)[key] /= sum;
      }
    }
  }

  private getDefaultWeights(): ScoringWeights {
    return {
      keywordMatch: 0.15,
      urlPatterns: 0.15,
      contentQuality: 0.2,
      informationDensity: 0.15,
      contextualFit: 0.15,
      uniqueness: 0.1,
      structuredData: 0.05,
      userSignals: 0.05
    };
  }

  getFeedbackHistory(): SelectionFeedback[] {
    return [...this.feedbackHistory];
  }

  clearFeedback(): void {
    this.feedbackHistory = [];
  }
}

// ============================================================================
// Adaptation Engine Implementation
// ============================================================================

export class AdaptationEngineImpl implements AdaptationEngine {
  private contextHistory: ResearchContext[] = [];
  private strategyAdjustments: Map<string, number> = new Map();
  private config: IntelligentSelectionConfig;

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
  }

  adaptToContext(context: ResearchContext): void {
    this.contextHistory.push(context);

    // Keep only recent context history
    if (this.contextHistory.length > 100) {
      this.contextHistory = this.contextHistory.slice(-100);
    }

    // Analyze context patterns
    this.analyzeContextPatterns();
  }

  optimizePerformance(metrics: PerformanceMetrics): void {
    if (!this.config.adaptiveWeights) {
      return;
    }

    // Adjust performance based on metrics
    if (metrics.averageDecisionTime > 200) {
      // Decision time is too high, switch to faster mode
      this.strategyAdjustments.set('performance_mode', 0); // Fast mode
    } else if (metrics.averageDecisionTime < 50) {
      // Decision time is very fast, can afford more thorough analysis
      this.strategyAdjustments.set('performance_mode', 2); // Thorough mode
    } else {
      // Balanced mode
      this.strategyAdjustments.set('performance_mode', 1);
    }

    // Optimize cache strategy based on hit rate
    const cacheHitRate = metrics.aiCallsCount ? 0.5 : 0; // Placeholder calculation
    if (cacheHitRate > 0.8) {
      this.strategyAdjustments.set('cache_strategy', 1); // Aggressive caching
    } else if (cacheHitRate < 0.3) {
      this.strategyAdjustments.set('cache_strategy', 0); // Conservative caching
    }
  }

  updateStrategies(outcomes: ResearchOutcome[]): void {
    if (outcomes.length === 0) {
      return;
    }

    // Calculate average value
    const avgValue = outcomes.reduce((sum, o) => o.userValue, 0) / outcomes.length;

    // Identify high-value patterns
    const highValueOutcomes = outcomes.filter(o => o.userValue > 0.7);
    const lowValueOutcomes = outcomes.filter(o => o.userValue < 0.3);

    // Adjust strategies based on patterns
    if (highValueOutcomes.length > lowValueOutcomes.length) {
      this.strategyAdjustments.set('strategy_confidence', 1); // Increase confidence
    } else if (lowValueOutcomes.length > highValueOutcomes.length) {
      this.strategyAdjustments.set('strategy_confidence', -1); // Decrease confidence
    }
  }

  getStrategyAdjustments(): Map<string, number> {
    return new Map(this.strategyAdjustments);
  }

  clearHistory(): void {
    this.contextHistory = [];
    this.strategyAdjustments.clear();
  }

  private analyzeContextPatterns(): void {
    if (this.contextHistory.length < 2) {
      return;
    }

    // Analyze patterns in research contexts
    const recentContexts = this.contextHistory.slice(-10);
    const commonKeywords = this.extractCommonKeywords(recentContexts);

    // Store common patterns for future optimization
    for (const keyword of commonKeywords) {
      const current = this.strategyAdjustments.get(`keyword_${keyword}`) || 0;
      this.strategyAdjustments.set(`keyword_${keyword}`, current + 1);
    }
  }

  private extractCommonKeywords(contexts: ResearchContext[]): string[] {
    const keywordCounts = new Map<string, number>();

    for (const context of contexts) {
      for (const keyword of context.keywords) {
        const count = keywordCounts.get(keyword) || 0;
        keywordCounts.set(keyword, count + 1);
      }
    }

    // Return keywords that appear in multiple contexts
    return Array.from(keywordCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([keyword, _]) => keyword);
  }
}

// ============================================================================
// Performance Tracker Implementation
// ============================================================================

export class PerformanceTrackerImpl implements PerformanceTracker {
  private decisionTimes: Map<string, number[]> = new Map();
  private cacheStats = { hits: 0, misses: 0 };
  private outcomes: ResearchOutcome[] = [];
  private config: IntelligentSelectionConfig;

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
  }

  trackDecisionTime(operation: string, duration: number): void {
    if (!this.decisionTimes.has(operation)) {
      this.decisionTimes.set(operation, []);
    }
    this.decisionTimes.get(operation)!.push(duration);

    // Keep only recent measurements
    const times = this.decisionTimes.get(operation)!;
    if (times.length > 100) {
      times.shift();
    }
  }

  trackCachePerformance(hits: number, misses: number): void {
    this.cacheStats.hits += hits;
    this.cacheStats.misses += misses;
  }

  trackResearchOutcome(outcome: ResearchOutcome): void {
    this.outcomes.push(outcome);

    // Keep only recent outcomes
    if (this.outcomes.length > 1000) {
      this.outcomes = this.outcomes.slice(-1000);
    }
  }

  getMetrics(): PerformanceMetrics {
    const avgDecisionTime = this.calculateAverageDecisionTime();
    const aiCallsCount = this.countAICalls();
    const totalProcessingTime = this.calculateTotalProcessingTime();

    return {
      totalDecisions: this.decisionTimes.size,
      sessionDuration: totalProcessingTime,
      decisionsPerSecond: totalProcessingTime > 0 ? this.decisionTimes.size / (totalProcessingTime / 1000) : 0,
      averageDecisionTime: avgDecisionTime,
      visitSuccessRate: 0.7,
      skipRate: 0.3,
      aiCallsCount,
      totalProcessingTime
    };
  }

  private calculateAverageDecisionTime(): number {
    let totalTime = 0;
    let totalCount = 0;

    for (const times of this.decisionTimes.values()) {
      totalTime += times.reduce((a, b) => a + b, 0);
      totalCount += times.length;
    }

    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  private calculateCacheHitRate(): number {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total > 0 ? this.cacheStats.hits / total : 0;
  }

  private countAICalls(): number {
    // Count operations that likely involve AI calls
    const aiOperations = ['deep_analysis', 'relevance_assessment', 'navigation_reasoning'];
    let count = 0;

    for (const [operation, times] of this.decisionTimes.entries()) {
      if (aiOperations.some(op => operation.includes(op))) {
        count += times.length;
      }
    }

    return count;
  }

  private calculateTotalProcessingTime(): number {
    let total = 0;

    for (const times of this.decisionTimes.values()) {
      total += times.reduce((a, b) => a + b, 0);
    }

    return total;
  }

  getOutcomes(): ResearchOutcome[] {
    return [...this.outcomes];
  }

  clearMetrics(): void {
    this.decisionTimes.clear();
    this.cacheStats = { hits: 0, misses: 0 };
    this.outcomes = [];
  }
}

// ============================================================================
// Main Learning System Implementation
// ============================================================================

export class LearningSystemImpl implements LearningSystem {
  patternDatabase: PatternDatabase;
  feedbackProcessor: FeedbackProcessor;
  adaptationEngine: AdaptationEngine;
  performanceTracker: PerformanceTracker;

  private config: IntelligentSelectionConfig;

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
    this.patternDatabase = new PatternDatabaseImpl();
    this.feedbackProcessor = new FeedbackProcessorImpl(config);
    this.adaptationEngine = new AdaptationEngineImpl(config);
    this.performanceTracker = new PerformanceTrackerImpl(config);
  }

  /**
   * Process a research session and extract learning data
   */
  processSession(feedback: SelectionFeedback): void {
    this.feedbackProcessor.processFeedback(feedback);
    this.adaptationEngine.updateStrategies(feedback.outcomes);
  }

  /**
   * Get current learning data for weight adaptation
   */
  getLearningData(): LearningData {
    return this.feedbackProcessor.generateLearningData();
  }

  /**
   * Update scoring weights based on learning data
   */
  updateWeights(weights: ScoringWeights): void {
    this.feedbackProcessor.updateWeights(weights);
  }

  /**
   * Get current scoring weights
   */
  getCurrentWeights(): ScoringWeights {
    return (this.feedbackProcessor as FeedbackProcessorImpl).getCurrentWeights();
  }

  /**
   * Adapt to a new research context
   */
  adaptToContext(context: ResearchContext): void {
    this.adaptationEngine.adaptToContext(context);
  }

  /**
   * Optimize based on performance metrics
   */
  optimizePerformance(metrics: PerformanceMetrics): void {
    this.adaptationEngine.optimizePerformance(metrics);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceTracker.getMetrics();
  }

  /**
   * Track a decision time
   */
  trackDecisionTime(operation: string, duration: number): void {
    this.performanceTracker.trackDecisionTime(operation, duration);
  }

  /**
   * Track cache performance
   */
  trackCachePerformance(hits: number, misses: number): void {
    this.performanceTracker.trackCachePerformance(hits, misses);
  }

  /**
   * Track a research outcome
   */
  trackOutcome(outcome: ResearchOutcome): void {
    this.performanceTracker.trackResearchOutcome(outcome);
  }

  /**
   * Get strategy adjustments from adaptation engine
   */
  getStrategyAdjustments(): Map<string, number> {
    return (this.adaptationEngine as AdaptationEngineImpl).getStrategyAdjustments();
  }

  /**
   * Clear all learning data
   */
  clearLearningData(): void {
    (this.patternDatabase as PatternDatabaseImpl).clearPatterns();
    (this.feedbackProcessor as FeedbackProcessorImpl).clearFeedback();
    (this.adaptationEngine as AdaptationEngineImpl).clearHistory();
    (this.performanceTracker as PerformanceTrackerImpl).clearMetrics();
  }
}
