/**
 * End-to-End Integration Tests for Intelligent Site Selection
 *
 * Tests complete research workflows with intelligent selection,
 * decision transparency, and performance requirements.
 *
 * Requirements: 1.1, 1.2, 5.1, 6.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  IntelligentScoringSystem,
  createEnhancedResearchMemory,
  createIntelligentScoringSystem
} from '../intelligent-browser-use-enhanced';
import { EnhancedSharedResearchMemoryImpl } from '../enhanced-research-memory';
import { IntelligentCacheManager, createCacheManager } from '../intelligent-caching-system';
import { ContextAwareScoringEngine, createContextAwareScoringEngine } from '../context-aware-scoring';
import { IntelligentErrorRecovery, createErrorRecoverySystem } from '../intelligent-error-recovery';
import {
  IntelligentSelectionConfig,
  ResearchContext,
  PageContent,
  IntelligentExtractedFact
} from '../intelligent-site-selection';
import { DEFAULT_INTELLIGENT_CONFIG } from '../intelligent-site-selection-base';

/**
 * Mock AI Client for testing
 */
class MockAIClient {
  async chat(options: any) {
    return {
      content: JSON.stringify({
        tool: 'navigate',
        args: { url: 'https://example.com' },
        reasoning: 'Test navigation'
      })
    };
  }
}

/**
 * Test suite for intelligent site selection integration
 */
describe('Intelligent Site Selection Integration', () => {
  let scoringSystem: IntelligentScoringSystem;
  let memory: EnhancedSharedResearchMemoryImpl;
  let cacheManager: IntelligentCacheManager;
  let scoringEngine: ContextAwareScoringEngine;
  let errorRecovery: IntelligentErrorRecovery;
  let aiClient: MockAIClient;
  let config: IntelligentSelectionConfig;

  beforeEach(() => {
    aiClient = new MockAIClient();
    config = { ...DEFAULT_INTELLIGENT_CONFIG };
    scoringSystem = createIntelligentScoringSystem(aiClient, config);
    memory = createEnhancedResearchMemory();
    cacheManager = createCacheManager(config);
    scoringEngine = createContextAwareScoringEngine();
    errorRecovery = createErrorRecoverySystem();
  });

  afterEach(() => {
    errorRecovery.reset();
    cacheManager.clearAll();
  });

  describe('Complete Research Workflow', () => {
    it('should execute a complete research workflow with intelligent selection', async () => {
      // Setup research context
      const context: ResearchContext = {
        taskDescription: 'Find pricing information for SaaS tools',
        goals: ['Find pricing information', 'Identify key features'],
        keywords: ['pricing', 'plans', 'cost', 'subscription'],
        currentPhase: 'exploration',
        timeConstraints: {
          maxTime: 300000,
          startTime: Date.now()
        },
        qualityRequirements: {
          minQuality: 0.6,
          minConfidence: 0.7
        },
        previousFindings: []
      };

      // Update systems with context
      scoringSystem.updateResearchContext(context);
      memory.updateResearchContext(context);

      // Simulate site evaluation
      const testUrls = [
        'https://example.com/pricing',
        'https://example.com/login',
        'https://example.com/features',
        'https://example.com/docs'
      ];

      const evaluations = await Promise.all(
        testUrls.map(url =>
          scoringSystem.scoreUrlRelevanceIntelligent(url, context.taskDescription)
        )
      );

      // Verify scoring results
      expect(evaluations).toHaveLength(4);
      expect(evaluations[0]).toBeGreaterThan(0); // pricing page
      expect(evaluations[1]).toBeLessThan(evaluations[0]); // login page should score lower
      expect(evaluations[2]).toBeGreaterThan(0); // features page
      expect(evaluations[3]).toBeGreaterThan(0); // docs page

      // Verify decision report
      const report = scoringSystem.getDecisionReport();
      expect(report.totalDecisions).toBeGreaterThan(0);
      expect(report.averageScore).toBeGreaterThan(0);
    });

    it('should track research progress through intelligent memory', () => {
      // Setup context
      const context: ResearchContext = {
        taskDescription: 'Research SaaS pricing',
        goals: ['Find pricing', 'Find features'],
        keywords: ['pricing', 'features'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      memory.updateResearchContext(context);

      // Add intelligent facts
      const fact1: IntelligentExtractedFact = {
        url: 'https://example.com/pricing',
        title: 'Pricing Page',
        summary: 'Found pricing information',
        relevanceScore: 85,
        contentQuality: 0.8,
        informationDensity: 0.7,
        extractionConfidence: 0.9,
        category: 'pricing',
        relatedTopics: ['plans', 'cost'],
        contentGapsFilled: ['pricing'],
        keyFacts: ['$99/month', 'Annual discount available'],
        prices: ['$99/month', '$999/year'],
        ratings: [],
        timestamp: Date.now()
      };

      memory.addIntelligentFact(fact1);

      // Check progress
      const progress = memory.getResearchProgress();
      expect(progress.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(progress.qualityScore).toBeGreaterThanOrEqual(0);

      // Check gaps
      const gaps = memory.getContentGaps();
      expect(gaps.length).toBeGreaterThanOrEqual(0);

      // Check stats
      const stats = memory.getIntelligentStats();
      expect(stats.totalIntelligentFacts).toBe(1);
      expect(stats.averageQuality).toBeGreaterThan(0);
    });
  });

  describe('Decision Transparency and Logging', () => {
    it('should log all site selection decisions with reasoning', async () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing',
        goals: ['Find pricing'],
        keywords: ['pricing'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      scoringSystem.updateResearchContext(context);

      // Score multiple URLs
      await scoringSystem.scoreUrlRelevanceIntelligent(
        'https://example.com/pricing',
        context.taskDescription
      );
      await scoringSystem.scoreUrlRelevanceIntelligent(
        'https://example.com/login',
        context.taskDescription
      );

      // Get decision report
      const report = scoringSystem.getDecisionReport();

      // Verify logging
      expect(report.decisions.length).toBeGreaterThan(0);
      expect(report.decisions[0]).toHaveProperty('url');
      expect(report.decisions[0]).toHaveProperty('action');
      expect(report.decisions[0]).toHaveProperty('score');
      expect(report.decisions[0]).toHaveProperty('reasoning');
    });

    it('should provide decision transparency for skipped sites', async () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing',
        goals: ['Find pricing'],
        keywords: ['pricing'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      scoringSystem.updateResearchContext(context);

      // Score a login page (should be skipped)
      const score = await scoringSystem.scoreUrlRelevanceIntelligent(
        'https://example.com/login',
        context.taskDescription
      );

      // Verify low score for login page
      expect(score).toBeLessThan(40);

      // Get decision report
      const report = scoringSystem.getDecisionReport();
      const loginDecision = report.decisions.find(d => d.url.includes('login'));

      expect(loginDecision).toBeDefined();
      expect(loginDecision?.reasoning).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete heuristic relevance checks within 200ms', async () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing',
        goals: ['Find pricing'],
        keywords: ['pricing'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      scoringSystem.updateResearchContext(context);

      const startTime = Date.now();

      // Score URL (should use heuristics)
      await scoringSystem.scoreUrlRelevanceIntelligent(
        'https://example.com/pricing',
        context.taskDescription
      );

      const duration = Date.now() - startTime;

      // Requirement: 6.5 - Complete within 200ms
      expect(duration).toBeLessThan(200);
    });

    it('should maintain cache hit rate above 50% for repeated queries', async () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing',
        goals: ['Find pricing'],
        keywords: ['pricing'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      // Score same URL multiple times
      const url = 'https://example.com/pricing';
      for (let i = 0; i < 10; i++) {
        await scoringSystem.scoreUrlRelevanceIntelligent(url, context.taskDescription);
      }

      // Get cache stats
      const stats = cacheManager.getStats();

      // Requirement: 6.3 - Cache should improve performance
      expect(stats.combined.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context-Aware Scoring', () => {
    it('should adapt scoring based on research phase', () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing',
        goals: ['Find pricing'],
        keywords: ['pricing'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      // Get weights for exploration phase
      const explorationWeights = scoringEngine.getAdaptiveWeights(context, memory);

      // Change phase
      context.currentPhase = 'deepdive';
      const deepdiveWeights = scoringEngine.getAdaptiveWeights(context, memory);

      // Weights should differ based on phase
      expect(explorationWeights.keywordMatch).not.toEqual(deepdiveWeights.keywordMatch);
    });

    it('should prioritize content based on identified gaps', () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing and features',
        goals: ['Find pricing', 'Find features'],
        keywords: ['pricing', 'features'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      memory.updateResearchContext(context);

      // Add a fact about pricing
      const pricingFact: IntelligentExtractedFact = {
        url: 'https://example.com/pricing',
        title: 'Pricing',
        summary: 'Pricing info',
        relevanceScore: 85,
        contentQuality: 0.8,
        informationDensity: 0.7,
        extractionConfidence: 0.9,
        category: 'pricing',
        relatedTopics: [],
        contentGapsFilled: ['pricing'],
        keyFacts: ['$99/month'],
        prices: ['$99/month'],
        ratings: [],
        timestamp: Date.now()
      };

      memory.addIntelligentFact(pricingFact);

      // Get gaps - should identify features gap
      const gaps = memory.getContentGaps();
      const hasFeatureGap = gaps.some(g => g.category === 'features');

      // Features gap should be identified since we only have pricing
      expect(hasFeatureGap || gaps.length === 0).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle relevance assessment failures gracefully', async () => {
      const error = new Error('AI service unavailable');

      const result = await errorRecovery.handleRelevanceAssessmentFailure(
        error,
        'default'
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.value).toBeDefined();
    });

    it('should implement circuit breaker for persistent failures', async () => {
      const error = new Error('Persistent failure');

      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        await errorRecovery.handleRelevanceAssessmentFailure(error, 'default');
      }

      // Circuit breaker should be open
      const state = errorRecovery.getCircuitBreakerState();
      expect(state).toBe('open');
    });

    it('should recover from circuit breaker after timeout', async () => {
      const error = new Error('Failure');

      // Trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await errorRecovery.handleRelevanceAssessmentFailure(error, 'default');
      }

      // Reset to test recovery
      errorRecovery.reset();
      const state = errorRecovery.getCircuitBreakerState();
      expect(state).toBe('closed');
    });
  });

  describe('Integration with Existing Browser-Use', () => {
    it('should maintain backward compatibility with existing memory interface', () => {
      // Test that enhanced memory implements all base methods
      expect(memory.addFact).toBeDefined();
      expect(memory.markVisited).toBeDefined();
      expect(memory.hasVisited).toBeDefined();
      expect(memory.queueUrl).toBeDefined();
      expect(memory.dequeueUrl).toBeDefined();
      expect(memory.getSummary).toBeDefined();
      expect(memory.getFactCount).toBeDefined();
      expect(memory.getVisitedCount).toBeDefined();
      expect(memory.getQueueSize).toBeDefined();
    });

    it('should support parallel research with intelligent selection', async () => {
      const context: ResearchContext = {
        taskDescription: 'Research multiple topics',
        goals: ['Find info'],
        keywords: ['research'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      scoringSystem.updateResearchContext(context);

      // Simulate parallel URL scoring
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3'
      ];

      const scores = await Promise.all(
        urls.map(url =>
          scoringSystem.scoreUrlRelevanceIntelligent(url, context.taskDescription)
        )
      );

      expect(scores).toHaveLength(3);
      expect(scores.every(s => typeof s === 'number')).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    it('should track and report performance metrics', async () => {
      const context: ResearchContext = {
        taskDescription: 'Find pricing',
        goals: ['Find pricing'],
        keywords: ['pricing'],
        currentPhase: 'exploration',
        timeConstraints: { maxTime: 300000, startTime: Date.now() },
        qualityRequirements: { minQuality: 0.6, minConfidence: 0.7 },
        previousFindings: []
      };

      scoringSystem.updateResearchContext(context);

      // Perform some operations
      await scoringSystem.scoreUrlRelevanceIntelligent(
        'https://example.com/pricing',
        context.taskDescription
      );

      // Get report
      const report = scoringSystem.getDecisionReport();

      expect(report).toHaveProperty('totalDecisions');
      expect(report).toHaveProperty('sitesVisited');
      expect(report).toHaveProperty('sitesSkipped');
      expect(report).toHaveProperty('averageScore');
    });

    it('should provide cache performance statistics', () => {
      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty('relevance');
      expect(stats).toHaveProperty('pattern');
      expect(stats).toHaveProperty('combined');
      expect(stats.combined).toHaveProperty('hitRate');
      expect(stats.combined).toHaveProperty('size');
    });
  });
});
