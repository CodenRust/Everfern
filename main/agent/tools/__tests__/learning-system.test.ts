/**
 * Unit Tests for Learning System
 *
 * Tests for pattern learning, feedback integration, and adaptive weighting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LearningSystemImpl,
  PatternDatabaseImpl,
  FeedbackProcessorImpl,
  AdaptationEngineImpl,
  PerformanceTrackerImpl
} from '../learning-system';
import {
  IntelligentSelectionConfig,
  CacheStrategy,
  LoggingLevel,
  SelectionFeedback,
  SiteSelectionDecision,
  ResearchOutcome,
  ResearchContext,
  ResearchPhase,
  Pattern
} from '../intelligent-site-selection';

// ============================================================================
// Test Fixtures
// ============================================================================

const defaultConfig: IntelligentSelectionConfig = {
  relevanceThreshold: 40,
  performanceMode: 'balanced',
  learningEnabled: true,
  cachingStrategy: CacheStrategy.BALANCED,
  loggingLevel: LoggingLevel.INFO,
  adaptiveWeights: true
};

const createTestFeedback = (userRating: number = 4, outcomes: ResearchOutcome[] = []): SelectionFeedback => {
  const defaultOutcomes: ResearchOutcome[] = [
    {
      url: 'https://example.com/pricing',
      factsExtracted: 5,
      relevanceActual: 0.8,
      timeSpent: 2000,
      userValue: 0.8
    },
    {
      url: 'https://example.com/features',
      factsExtracted: 3,
      relevanceActual: 0.6,
      timeSpent: 1500,
      userValue: 0.6
    }
  ];

  return {
    sessionId: 'test-session-1',
    decisions: [
      {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 75,
        reasoning: 'High relevance for pricing information',
        factors: [],
        context: createTestContext()
      }
    ],
    outcomes: outcomes.length > 0 ? outcomes : defaultOutcomes,
    userRating,
    improvements: ['Better URL classification', 'Faster analysis']
  };
};

const createTestContext = (): ResearchContext => ({
  taskDescription: 'Find pricing information for SaaS tools',
  goals: ['Find pricing', 'Compare features'],
  keywords: ['pricing', 'cost', 'features', 'saas'],
  currentPhase: ResearchPhase.DISCOVERY,
  timeConstraints: { urgency: 'medium' },
  qualityRequirements: {
    minRelevanceScore: 40,
    requireMultipleSources: false,
    factVerificationLevel: 'basic'
  },
  previousFindings: []
});

// ============================================================================
// Pattern Database Tests
// ============================================================================

describe('PatternDatabase', () => {
  let db: PatternDatabaseImpl;

  beforeEach(() => {
    db = new PatternDatabaseImpl();
  });

  it('should add and retrieve patterns by type', () => {
    const pattern: Pattern = {
      type: 'url_pattern',
      pattern: 'pricing',
      confidence: 0.9,
      successRate: 0.85,
      lastUpdated: Date.now()
    };

    db.addPattern(pattern);
    const patterns = db.getPatterns('url_pattern');

    expect(patterns).toHaveLength(1);
    expect(patterns[0].pattern).toBe('pricing');
  });

  it('should update existing patterns', () => {
    const pattern: Pattern = {
      type: 'url_pattern',
      pattern: 'pricing',
      confidence: 0.9,
      successRate: 0.85,
      lastUpdated: Date.now()
    };

    db.addPattern(pattern);

    const updated: Pattern = {
      ...pattern,
      confidence: 0.95,
      successRate: 0.9
    };

    db.updatePattern(updated);
    const patterns = db.getPatterns('url_pattern');

    expect(patterns[0].confidence).toBe(0.95);
    expect(patterns[0].successRate).toBe(0.9);
  });

  it('should remove patterns', () => {
    const pattern: Pattern = {
      type: 'url_pattern',
      pattern: 'pricing',
      confidence: 0.9,
      successRate: 0.85,
      lastUpdated: Date.now()
    };

    db.addPattern(pattern);
    expect(db.getPatterns('url_pattern')).toHaveLength(1);

    db.removePattern('url_pattern:pricing');
    expect(db.getPatterns('url_pattern')).toHaveLength(0);
  });

  it('should handle multiple patterns of different types', () => {
    const pattern1: Pattern = {
      type: 'url_pattern',
      pattern: 'pricing',
      confidence: 0.9,
      successRate: 0.85,
      lastUpdated: Date.now()
    };

    const pattern2: Pattern = {
      type: 'content_pattern',
      pattern: 'pricing_table',
      confidence: 0.8,
      successRate: 0.75,
      lastUpdated: Date.now()
    };

    db.addPattern(pattern1);
    db.addPattern(pattern2);

    expect(db.getPatterns('url_pattern')).toHaveLength(1);
    expect(db.getPatterns('content_pattern')).toHaveLength(1);
  });

  it('should clear all patterns', () => {
    const pattern: Pattern = {
      type: 'url_pattern',
      pattern: 'pricing',
      confidence: 0.9,
      successRate: 0.85,
      lastUpdated: Date.now()
    };

    db.addPattern(pattern);
    db.clearPatterns();

    expect(db.getPatterns('url_pattern')).toHaveLength(0);
  });
});

// ============================================================================
// Feedback Processor Tests
// ============================================================================

describe('FeedbackProcessor', () => {
  let processor: FeedbackProcessorImpl;

  beforeEach(() => {
    processor = new FeedbackProcessorImpl(defaultConfig);
  });

  it('should process feedback and update weights', () => {
    const feedback = createTestFeedback(5);
    const initialWeights = processor.getCurrentWeights();

    processor.processFeedback(feedback);
    const updatedWeights = processor.getCurrentWeights();

    // Weights should be normalized
    const sum = Object.values(updatedWeights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('should not process feedback when learning is disabled', () => {
    const config = { ...defaultConfig, learningEnabled: false };
    const disabledProcessor = new FeedbackProcessorImpl(config);

    const feedback = createTestFeedback();
    disabledProcessor.processFeedback(feedback);

    const learningData = disabledProcessor.generateLearningData();
    expect(learningData.feedback).toHaveLength(0);
  });

  it('should generate learning data from feedback', () => {
    const feedback = createTestFeedback();
    processor.processFeedback(feedback);

    const learningData = processor.generateLearningData();

    expect(learningData.feedback).toHaveLength(1);
    expect(learningData.outcomes).toHaveLength(2);
    expect(learningData.weights).toBeDefined();
  });

  it('should maintain feedback history', () => {
    const feedback1 = createTestFeedback(4);
    const feedback2 = createTestFeedback(5);

    processor.processFeedback(feedback1);
    processor.processFeedback(feedback2);

    const history = (processor as any).feedbackHistory;
    expect(history).toHaveLength(2);
  });

  it('should update weights based on user rating', () => {
    const lowRatingOutcomes: ResearchOutcome[] = [
      {
        url: 'https://example.com/1',
        factsExtracted: 1,
        relevanceActual: 0.2,
        timeSpent: 500,
        userValue: 0.2
      }
    ];

    const highRatingOutcomes: ResearchOutcome[] = [
      {
        url: 'https://example.com/1',
        factsExtracted: 5,
        relevanceActual: 0.9,
        timeSpent: 2000,
        userValue: 0.9
      }
    ];

    const lowRatingFeedback = createTestFeedback(2, lowRatingOutcomes);
    const highRatingFeedback = createTestFeedback(5, highRatingOutcomes);

    const processor1 = new FeedbackProcessorImpl(defaultConfig);
    const processor2 = new FeedbackProcessorImpl(defaultConfig);

    processor1.processFeedback(lowRatingFeedback);
    processor2.processFeedback(highRatingFeedback);

    const weights1 = processor1.getCurrentWeights();
    const weights2 = processor2.getCurrentWeights();

    // High rating should result in different weight distribution
    expect(weights1).not.toEqual(weights2);
  });

  it('should clear feedback history', () => {
    const feedback = createTestFeedback();
    processor.processFeedback(feedback);

    processor.clearFeedback();
    const learningData = processor.generateLearningData();

    expect(learningData.feedback).toHaveLength(0);
  });
});

// ============================================================================
// Adaptation Engine Tests
// ============================================================================

describe('AdaptationEngine', () => {
  let engine: AdaptationEngineImpl;

  beforeEach(() => {
    engine = new AdaptationEngineImpl(defaultConfig);
  });

  it('should adapt to research context', () => {
    const context = createTestContext();
    engine.adaptToContext(context);

    const adjustments = engine.getStrategyAdjustments();
    expect(adjustments).toBeDefined();
  });

  it('should optimize performance based on metrics', () => {
    const metrics = {
      averageDecisionTime: 150,
      cacheHitRate: 0.7,
      aiCallsCount: 10,
      totalProcessingTime: 1500
    };

    engine.optimizePerformance(metrics);
    const adjustments = engine.getStrategyAdjustments();

    expect(adjustments.has('performance_mode')).toBe(true);
    // Cache strategy is only set if hit rate is > 0.8 or < 0.3
    // In this case, hit rate is 0.7, so cache_strategy won't be set
  });

  it('should switch to fast mode when decision time is high', () => {
    const metrics = {
      averageDecisionTime: 250, // > 200ms
      cacheHitRate: 0.5,
      aiCallsCount: 10,
      totalProcessingTime: 2500
    };

    engine.optimizePerformance(metrics);
    const adjustments = engine.getStrategyAdjustments();

    expect(adjustments.get('performance_mode')).toBe(0); // Fast mode
  });

  it('should switch to thorough mode when decision time is very fast', () => {
    const metrics = {
      averageDecisionTime: 30, // < 50ms
      cacheHitRate: 0.5,
      aiCallsCount: 10,
      totalProcessingTime: 300
    };

    engine.optimizePerformance(metrics);
    const adjustments = engine.getStrategyAdjustments();

    expect(adjustments.get('performance_mode')).toBe(2); // Thorough mode
  });

  it('should update strategies based on outcomes', () => {
    const outcomes: ResearchOutcome[] = [
      {
        url: 'https://example.com/1',
        factsExtracted: 5,
        relevanceActual: 0.8,
        timeSpent: 2000,
        userValue: 0.8
      },
      {
        url: 'https://example.com/2',
        factsExtracted: 3,
        relevanceActual: 0.6,
        timeSpent: 1500,
        userValue: 0.75
      }
    ];

    engine.updateStrategies(outcomes);
    const adjustments = engine.getStrategyAdjustments();

    expect(adjustments.has('strategy_confidence')).toBe(true);
  });

  it('should clear history', () => {
    const context = createTestContext();
    engine.adaptToContext(context);

    engine.clearHistory();
    const adjustments = engine.getStrategyAdjustments();

    expect(adjustments.size).toBe(0);
  });
});

// ============================================================================
// Performance Tracker Tests
// ============================================================================

describe('PerformanceTracker', () => {
  let tracker: PerformanceTrackerImpl;

  beforeEach(() => {
    tracker = new PerformanceTrackerImpl(defaultConfig);
  });

  it('should track decision times', () => {
    tracker.trackDecisionTime('url_classification', 50);
    tracker.trackDecisionTime('url_classification', 60);
    tracker.trackDecisionTime('relevance_assessment', 100);

    const metrics = tracker.getMetrics();
    expect(metrics.averageDecisionTime).toBeGreaterThan(0);
  });

  it('should track cache performance', () => {
    tracker.trackCachePerformance(10, 5);
    tracker.trackCachePerformance(8, 2);

    const metrics = tracker.getMetrics();
    expect(metrics.cacheHitRate).toBeCloseTo(0.72, 1); // 18 hits / 25 total
  });

  it('should track research outcomes', () => {
    const outcome: ResearchOutcome = {
      url: 'https://example.com',
      factsExtracted: 5,
      relevanceActual: 0.8,
      timeSpent: 2000,
      userValue: 0.8
    };

    tracker.trackResearchOutcome(outcome);
    const outcomes = (tracker as any).outcomes;

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].url).toBe('https://example.com');
  });

  it('should calculate average decision time', () => {
    tracker.trackDecisionTime('operation1', 100);
    tracker.trackDecisionTime('operation1', 200);
    tracker.trackDecisionTime('operation2', 150);

    const metrics = tracker.getMetrics();
    expect(metrics.averageDecisionTime).toBeCloseTo(150, 0);
  });

  it('should count AI calls', () => {
    tracker.trackDecisionTime('deep_analysis', 100);
    tracker.trackDecisionTime('relevance_assessment', 150);
    tracker.trackDecisionTime('navigation_reasoning', 120);
    tracker.trackDecisionTime('url_classification', 50);

    const metrics = tracker.getMetrics();
    expect(metrics.aiCallsCount).toBe(3);
  });

  it('should clear metrics', () => {
    tracker.trackDecisionTime('operation', 100);
    tracker.trackCachePerformance(10, 5);

    tracker.clearMetrics();
    const metrics = tracker.getMetrics();

    expect(metrics.averageDecisionTime).toBe(0);
    expect(metrics.cacheHitRate).toBe(0);
  });
});

// ============================================================================
// Learning System Integration Tests
// ============================================================================

describe('LearningSystem', () => {
  let system: LearningSystemImpl;

  beforeEach(() => {
    system = new LearningSystemImpl(defaultConfig);
  });

  it('should process a research session', () => {
    const feedback = createTestFeedback();
    system.processSession(feedback);

    const learningData = system.getLearningData();
    expect(learningData.feedback).toHaveLength(1);
  });

  it('should get and update weights', () => {
    const initialWeights = system.getCurrentWeights();
    expect(initialWeights).toBeDefined();

    const newWeights = {
      keywordMatch: 0.2,
      urlPatterns: 0.15,
      contentQuality: 0.25,
      informationDensity: 0.15,
      contextualFit: 0.1,
      uniqueness: 0.1,
      structuredData: 0.03,
      userSignals: 0.02
    };

    system.updateWeights(newWeights);
    const updatedWeights = system.getCurrentWeights();

    expect(updatedWeights.keywordMatch).toBe(0.2);
  });

  it('should track decision times', () => {
    system.trackDecisionTime('url_classification', 50);
    system.trackDecisionTime('relevance_assessment', 100);

    const metrics = system.getPerformanceMetrics();
    expect(metrics.averageDecisionTime).toBeGreaterThan(0);
  });

  it('should track cache performance', () => {
    system.trackCachePerformance(10, 5);
    const metrics = system.getPerformanceMetrics();

    expect(metrics.cacheHitRate).toBeCloseTo(0.67, 2);
  });

  it('should track outcomes', () => {
    const outcome: ResearchOutcome = {
      url: 'https://example.com',
      factsExtracted: 5,
      relevanceActual: 0.8,
      timeSpent: 2000,
      userValue: 0.8
    };

    system.trackOutcome(outcome);
    const outcomes = (system.performanceTracker as PerformanceTrackerImpl).getOutcomes();

    expect(outcomes).toHaveLength(1);
  });

  it('should adapt to context', () => {
    const context = createTestContext();
    system.adaptToContext(context);

    const adjustments = system.getStrategyAdjustments();
    expect(adjustments).toBeDefined();
  });

  it('should optimize performance', () => {
    const metrics = {
      averageDecisionTime: 150,
      cacheHitRate: 0.7,
      aiCallsCount: 10,
      totalProcessingTime: 1500
    };

    system.optimizePerformance(metrics);
    const adjustments = system.getStrategyAdjustments();

    expect(adjustments.size).toBeGreaterThan(0);
  });

  it('should clear all learning data', () => {
    const feedback = createTestFeedback();
    system.processSession(feedback);
    system.trackDecisionTime('operation', 100);

    system.clearLearningData();

    const learningData = system.getLearningData();
    expect(learningData.feedback).toHaveLength(0);
    expect(learningData.patterns).toHaveLength(0);
  });

  it('should handle multiple sessions', () => {
    const feedback1 = createTestFeedback(4);
    const feedback2 = createTestFeedback(5);

    system.processSession(feedback1);
    system.processSession(feedback2);

    const learningData = system.getLearningData();
    expect(learningData.feedback).toHaveLength(2);
  });

  it('should maintain learning data across operations', () => {
    const feedback = createTestFeedback();
    system.processSession(feedback);

    system.trackDecisionTime('operation', 100);
    system.trackCachePerformance(10, 5);

    const learningData = system.getLearningData();
    const metrics = system.getPerformanceMetrics();

    expect(learningData.feedback).toHaveLength(1);
    expect(metrics.averageDecisionTime).toBeGreaterThan(0);
    expect(metrics.cacheHitRate).toBeGreaterThan(0);
  });
});
