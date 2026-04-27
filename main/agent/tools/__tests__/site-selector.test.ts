/**
 * Unit Tests for SiteSelector Implementation
 */

import { SiteSelectorImpl } from '../site-selector';
import { URLClassifierImpl } from '../url-classifier';
import {
  ResearchContext,
  ResearchPhase,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy,
  RiskLevel
} from '../intelligent-site-selection';
import { AIClient } from '../../../lib/ai-client';
import { vi } from 'vitest';

// Mock AIClient for testing
const mockAIClient = {
  chat: vi.fn(),
  complete: vi.fn()
} as unknown as AIClient;

describe('SiteSelector', () => {
  let siteSelector: SiteSelectorImpl;
  let urlClassifier: URLClassifierImpl;
  let config: IntelligentSelectionConfig;
  let context: ResearchContext;

  beforeEach(() => {
    config = {
      relevanceThreshold: 40,
      performanceMode: 'balanced',
      learningEnabled: true,
      cachingStrategy: CacheStrategy.BALANCED,
      loggingLevel: LoggingLevel.INFO,
      adaptiveWeights: true
    };

    urlClassifier = new URLClassifierImpl(config);
    siteSelector = new SiteSelectorImpl(mockAIClient, config, urlClassifier);

    context = {
      taskDescription: 'Research pricing and features for project management tools',
      goals: ['Find pricing information', 'Identify key features'],
      keywords: ['pricing', 'features', 'project', 'management'],
      currentPhase: ResearchPhase.DISCOVERY,
      timeConstraints: { urgency: 'medium' },
      qualityRequirements: {
        minRelevanceScore: 40,
        requireMultipleSources: false,
        factVerificationLevel: 'basic'
      },
      previousFindings: []
    };
  });

  describe('evaluateSite', () => {
    test('should evaluate a pricing URL with high relevance score', async () => {
      const url = 'https://example.com/pricing';
      const evaluation = await siteSelector.evaluateSite(url, context);

      expect(evaluation.url).toBe(url);
      expect(evaluation.relevanceScore).toBeGreaterThan(60);
      expect(evaluation.confidenceLevel).toBeGreaterThan(0.5);
      expect(evaluation.reasoningFactors).toHaveLength(7); // All scoring factors
      expect(evaluation.riskAssessment).toBe(RiskLevel.LOW);
    });

    test('should evaluate an administrative URL with low relevance score', async () => {
      const url = 'https://example.com/admin/login';
      const evaluation = await siteSelector.evaluateSite(url, context);

      expect(evaluation.url).toBe(url);
      expect(evaluation.relevanceScore).toBeLessThan(40);
      expect(evaluation.riskAssessment).toBeOneOf([RiskLevel.MEDIUM, RiskLevel.HIGH]);
    });

    test('should handle malformed URLs gracefully', async () => {
      const url = 'not-a-valid-url';
      const evaluation = await siteSelector.evaluateSite(url, context);

      expect(evaluation.url).toBe(url);
      expect(evaluation.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.relevanceScore).toBeLessThanOrEqual(100);
    });

    test('should provide detailed reasoning factors', async () => {
      const url = 'https://example.com/features';
      const evaluation = await siteSelector.evaluateSite(url, context);

      expect(evaluation.reasoningFactors).toHaveLength(7);

      const factorNames = evaluation.reasoningFactors.map(f => f.factor);
      expect(factorNames).toContain('URL Patterns');
      expect(factorNames).toContain('Keyword Match');
      expect(factorNames).toContain('Domain Authority');
      expect(factorNames).toContain('Content Indicators');
      expect(factorNames).toContain('Contextual Fit');
      expect(factorNames).toContain('Uniqueness');
      expect(factorNames).toContain('Risk Assessment');
    });
  });

  describe('rankSites', () => {
    test('should rank sites by relevance score in descending order', async () => {
      const candidates = [
        'https://example.com/admin',           // Low score
        'https://example.com/pricing',         // High score
        'https://example.com/features',        // Medium-high score
        'https://example.com/random-page'      // Medium score
      ];

      const rankedSites = await siteSelector.rankSites(candidates, context);

      expect(rankedSites).toHaveLength(4);
      expect(rankedSites[0].rank).toBe(1);
      expect(rankedSites[1].rank).toBe(2);
      expect(rankedSites[2].rank).toBe(3);
      expect(rankedSites[3].rank).toBe(4);

      // Verify descending order of scores
      for (let i = 0; i < rankedSites.length - 1; i++) {
        expect(rankedSites[i].score).toBeGreaterThanOrEqual(rankedSites[i + 1].score);
      }
    });

    test('should handle empty candidate list', async () => {
      const rankedSites = await siteSelector.rankSites([], context);
      expect(rankedSites).toHaveLength(0);
    });

    test('should provide reasoning for each ranked site', async () => {
      const candidates = ['https://example.com/pricing', 'https://example.com/features'];
      const rankedSites = await siteSelector.rankSites(candidates, context);

      for (const site of rankedSites) {
        expect(site.reasoning).toBeTruthy();
        expect(site.reasoning).toContain(`Rank ${site.rank}`);
        expect(site.reasoning).toContain('Score');
        expect(site.reasoning).toContain('Confidence');
      }
    });
  });

  describe('shouldVisitSite', () => {
    test('should return true for sites above threshold', async () => {
      const url = 'https://example.com/pricing';
      const evaluation = await siteSelector.evaluateSite(url, context);

      // Ensure the evaluation meets our expectations
      expect(evaluation.relevanceScore).toBeGreaterThan(config.relevanceThreshold);

      const shouldVisit = siteSelector.shouldVisitSite(evaluation);
      expect(shouldVisit).toBe(true);
    });

    test('should return false for sites below threshold', async () => {
      const url = 'https://example.com/admin/login';
      const evaluation = await siteSelector.evaluateSite(url, context);

      // Ensure the evaluation meets our expectations
      expect(evaluation.relevanceScore).toBeLessThan(config.relevanceThreshold);

      const shouldVisit = siteSelector.shouldVisitSite(evaluation);
      expect(shouldVisit).toBe(false);
    });

    test('should return false for high-risk sites regardless of score', async () => {
      // Create a mock evaluation with high score but high risk
      const highRiskEvaluation = {
        url: 'https://suspicious-site.com/pricing',
        relevanceScore: 80,
        confidenceLevel: 0.8,
        reasoningFactors: [],
        estimatedValue: 0.8,
        riskAssessment: RiskLevel.HIGH
      };

      const shouldVisit = siteSelector.shouldVisitSite(highRiskEvaluation);
      expect(shouldVisit).toBe(false);
    });

    test('should return false for borderline scores with low confidence', async () => {
      // Create a mock evaluation with borderline score and low confidence
      const lowConfidenceEvaluation = {
        url: 'https://example.com/maybe-relevant',
        relevanceScore: config.relevanceThreshold + 5, // Just above threshold
        confidenceLevel: 0.3, // Low confidence
        reasoningFactors: [],
        estimatedValue: 0.5,
        riskAssessment: RiskLevel.MEDIUM
      };

      const shouldVisit = siteSelector.shouldVisitSite(lowConfidenceEvaluation);
      expect(shouldVisit).toBe(false);
    });
  });

  describe('updateSelectionStrategy', () => {
    test('should process feedback when learning is enabled', () => {
      const feedback = {
        sessionId: 'test-session',
        decisions: [
          {
            timestamp: Date.now(),
            url: 'https://example.com/pricing',
            action: 'visit' as const,
            score: 75,
            reasoning: 'High relevance for pricing research',
            factors: [],
            context
          }
        ],
        outcomes: [
          {
            url: 'https://example.com/pricing',
            factsExtracted: 5,
            relevanceActual: 0.8,
            timeSpent: 30000,
            userValue: 0.9
          }
        ],
        userRating: 4.5,
        improvements: ['Good pricing information found']
      };

      expect(() => {
        siteSelector.updateSelectionStrategy(feedback);
      }).not.toThrow();
    });

    test('should handle feedback when learning is disabled', () => {
      const disabledLearningConfig = { ...config, learningEnabled: false };
      const disabledLearningSiteSelector = new SiteSelectorImpl(
        mockAIClient,
        disabledLearningConfig,
        urlClassifier
      );

      const feedback = {
        sessionId: 'test-session',
        decisions: [],
        outcomes: [],
        userRating: 3.0,
        improvements: []
      };

      expect(() => {
        disabledLearningSiteSelector.updateSelectionStrategy(feedback);
      }).not.toThrow();
    });
  });

  describe('Multi-factor Scoring', () => {
    test('should score pricing URLs higher for pricing-focused research', async () => {
      const pricingContext = {
        ...context,
        goals: ['Find pricing information'],
        keywords: ['pricing', 'cost', 'plans']
      };

      const pricingUrl = 'https://example.com/pricing';
      const featuresUrl = 'https://example.com/features';

      const pricingEvaluation = await siteSelector.evaluateSite(pricingUrl, pricingContext);
      const featuresEvaluation = await siteSelector.evaluateSite(featuresUrl, pricingContext);

      expect(pricingEvaluation.relevanceScore).toBeGreaterThan(featuresEvaluation.relevanceScore);
    });

    test('should consider domain authority in scoring', async () => {
      const githubUrl = 'https://github.com/project/pricing';
      const unknownUrl = 'https://unknown-domain.tk/pricing';

      const githubEvaluation = await siteSelector.evaluateSite(githubUrl, context);
      const unknownEvaluation = await siteSelector.evaluateSite(unknownUrl, context);

      expect(githubEvaluation.relevanceScore).toBeGreaterThan(unknownEvaluation.relevanceScore);
    });

    test('should boost scores for keyword matches in URL', async () => {
      const keywordUrl = 'https://example.com/project-management-pricing';
      const nonKeywordUrl = 'https://example.com/random-page';

      const keywordEvaluation = await siteSelector.evaluateSite(keywordUrl, context);
      const nonKeywordEvaluation = await siteSelector.evaluateSite(nonKeywordUrl, context);

      expect(keywordEvaluation.relevanceScore).toBeGreaterThan(nonKeywordEvaluation.relevanceScore);
    });
  });

  describe('Performance', () => {
    test('should complete evaluation within reasonable time', async () => {
      const url = 'https://example.com/pricing';
      const startTime = Date.now();

      await siteSelector.evaluateSite(url, context);

      const evaluationTime = Date.now() - startTime;
      expect(evaluationTime).toBeLessThan(500); // Should complete within 500ms
    });

    test('should handle multiple concurrent evaluations', async () => {
      const urls = [
        'https://example.com/pricing',
        'https://example.com/features',
        'https://example.com/docs',
        'https://example.com/reviews',
        'https://example.com/admin'
      ];

      const startTime = Date.now();
      const evaluations = await Promise.all(
        urls.map(url => siteSelector.evaluateSite(url, context))
      );
      const totalTime = Date.now() - startTime;

      expect(evaluations).toHaveLength(5);
      expect(totalTime).toBeLessThan(1000); // Should complete all within 1 second

      // Verify all evaluations are valid
      for (const evaluation of evaluations) {
        expect(evaluation.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(evaluation.relevanceScore).toBeLessThanOrEqual(100);
        expect(evaluation.confidenceLevel).toBeGreaterThanOrEqual(0);
        expect(evaluation.confidenceLevel).toBeLessThanOrEqual(1);
      }
    });
  });
});
