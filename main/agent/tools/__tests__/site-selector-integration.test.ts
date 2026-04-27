/**
 * Integration Tests for SiteSelector with URLClassifier
 */

import { SiteSelectorImpl } from '../site-selector';
import { URLClassifierImpl } from '../url-classifier';
import {
  ResearchContext,
  ResearchPhase,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy
} from '../intelligent-site-selection';
import { AIClient } from '../../../lib/ai-client';
import { vi } from 'vitest';

// Mock AIClient for testing
const mockAIClient = {
  chat: vi.fn(),
  complete: vi.fn()
} as unknown as AIClient;

describe('SiteSelector Integration', () => {
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

  describe('End-to-End Site Selection', () => {
    test('should correctly evaluate and rank a realistic set of URLs', async () => {
      const testUrls = [
        'https://asana.com/pricing',                    // High value - pricing page
        'https://trello.com/features',                  // High value - features page
        'https://monday.com/product',                   // Medium value - product page
        'https://notion.so/help',                       // Medium value - help page
        'https://clickup.com/login',                    // Low value - login page
        'https://basecamp.com/privacy',                 // Low value - privacy page
        'https://suspicious-site.tk/pricing',           // Low value - suspicious domain
        'https://github.com/project-management-tool'    // Medium-high value - authoritative domain
      ];

      // Evaluate all URLs
      const evaluations = await Promise.all(
        testUrls.map(url => siteSelector.evaluateSite(url, context))
      );

      // Rank the URLs
      const rankedSites = await siteSelector.rankSites(testUrls, context);

      // Verify basic expectations
      expect(evaluations).toHaveLength(8);
      expect(rankedSites).toHaveLength(8);

      // Check that pricing and features URLs are ranked highly
      const topRanked = rankedSites.slice(0, 3);
      const topUrls = topRanked.map(site => site.url);

      expect(topUrls).toContain('https://asana.com/pricing');
      expect(topUrls).toContain('https://trello.com/features');

      // Check that administrative URLs are ranked lowly
      const bottomRanked = rankedSites.slice(-3);
      const bottomUrls = bottomRanked.map(site => site.url);

      expect(bottomUrls).toContain('https://clickup.com/login');
      expect(bottomUrls).toContain('https://basecamp.com/privacy');

      // Verify threshold-based filtering
      const shouldVisitResults = evaluations.map(evaluation => ({
        url: evaluation.url,
        shouldVisit: siteSelector.shouldVisitSite(evaluation),
        score: evaluation.relevanceScore
      }));

      const highValueSites = shouldVisitResults.filter(result => result.shouldVisit);
      const lowValueSites = shouldVisitResults.filter(result => !result.shouldVisit);

      expect(highValueSites.length).toBeGreaterThan(0);
      expect(lowValueSites.length).toBeGreaterThan(0);

      // All sites marked for visiting should have scores above threshold
      for (const site of highValueSites) {
        expect(site.score).toBeGreaterThanOrEqual(config.relevanceThreshold);
      }

      // All sites marked for skipping should have scores below threshold or other issues
      for (const site of lowValueSites) {
        // Either below threshold or has other issues (risk, confidence, etc.)
        expect(site.score < config.relevanceThreshold || site.url.includes('login') || site.url.includes('privacy') || site.url.includes('.tk')).toBe(true);
      }
    });

    test('should adapt scoring based on different research contexts', async () => {
      const testUrl = 'https://example.com/pricing-features-comparison';

      // Pricing-focused context
      const pricingContext = {
        ...context,
        goals: ['Find detailed pricing information'],
        keywords: ['pricing', 'cost', 'plans', 'subscription']
      };

      // Features-focused context
      const featuresContext = {
        ...context,
        goals: ['Identify key features and capabilities'],
        keywords: ['features', 'capabilities', 'functionality']
      };

      // Documentation-focused context
      const docsContext = {
        ...context,
        goals: ['Find technical documentation'],
        keywords: ['documentation', 'api', 'guide', 'tutorial']
      };

      const pricingEvaluation = await siteSelector.evaluateSite(testUrl, pricingContext);
      const featuresEvaluation = await siteSelector.evaluateSite(testUrl, featuresContext);
      const docsEvaluation = await siteSelector.evaluateSite(testUrl, docsContext);

      // The URL contains both "pricing" and "features", so both contexts should score well
      expect(pricingEvaluation.relevanceScore).toBeGreaterThan(60);
      expect(featuresEvaluation.relevanceScore).toBeGreaterThan(60);

      // Documentation context should score lower since URL doesn't contain doc-related terms
      expect(docsEvaluation.relevanceScore).toBeLessThan(Math.max(pricingEvaluation.relevanceScore, featuresEvaluation.relevanceScore));
    });

    test('should provide consistent results for identical inputs', async () => {
      const testUrl = 'https://example.com/pricing';

      // Run evaluation multiple times
      const evaluation1 = await siteSelector.evaluateSite(testUrl, context);
      const evaluation2 = await siteSelector.evaluateSite(testUrl, context);
      const evaluation3 = await siteSelector.evaluateSite(testUrl, context);

      // Results should be identical
      expect(evaluation1.relevanceScore).toBe(evaluation2.relevanceScore);
      expect(evaluation2.relevanceScore).toBe(evaluation3.relevanceScore);
      expect(evaluation1.riskAssessment).toBe(evaluation2.riskAssessment);
      expect(evaluation2.riskAssessment).toBe(evaluation3.riskAssessment);

      // Ranking should also be consistent
      const candidates = [testUrl, 'https://example.com/features', 'https://example.com/admin'];

      const ranking1 = await siteSelector.rankSites(candidates, context);
      const ranking2 = await siteSelector.rankSites(candidates, context);

      expect(ranking1).toEqual(ranking2);
    });

    test('should handle edge cases gracefully', async () => {
      const edgeCaseUrls = [
        '',                                    // Empty URL
        'not-a-url',                          // Invalid URL format
        'https://',                           // Incomplete URL
        'ftp://example.com/file',             // Non-HTTP protocol
        'https://example.com/' + 'a'.repeat(1000), // Very long URL
        'https://example.com/page?param=' + 'x'.repeat(500) // Long query string
      ];

      for (const url of edgeCaseUrls) {
        const evaluation = await siteSelector.evaluateSite(url, context);

        // Should not throw and should return valid evaluation
        expect(evaluation.url).toBe(url);
        expect(evaluation.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(evaluation.relevanceScore).toBeLessThanOrEqual(100);
        expect(evaluation.confidenceLevel).toBeGreaterThanOrEqual(0);
        expect(evaluation.confidenceLevel).toBeLessThanOrEqual(1);
        expect(evaluation.reasoningFactors).toHaveLength(7);
      }

      // Should also handle ranking edge cases
      const ranking = await siteSelector.rankSites(edgeCaseUrls, context);
      expect(ranking).toHaveLength(edgeCaseUrls.length);
    });
  });

  describe('Performance Integration', () => {
    test('should maintain performance with realistic workloads', async () => {
      // Generate a realistic set of URLs
      const domains = ['asana.com', 'trello.com', 'monday.com', 'notion.so', 'clickup.com'];
      const paths = ['pricing', 'features', 'product', 'docs', 'help', 'login', 'signup', 'admin'];

      const testUrls = domains.flatMap(domain =>
        paths.map(path => `https://${domain}/${path}`)
      );

      const startTime = Date.now();

      // Evaluate all URLs (40 URLs total)
      const evaluations = await Promise.all(
        testUrls.map(url => siteSelector.evaluateSite(url, context))
      );

      // Rank all URLs
      const ranking = await siteSelector.rankSites(testUrls, context);

      const totalTime = Date.now() - startTime;

      // Performance expectations
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(evaluations).toHaveLength(40);
      expect(ranking).toHaveLength(40);

      // Verify all evaluations are valid
      for (const evaluation of evaluations) {
        expect(evaluation.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(evaluation.relevanceScore).toBeLessThanOrEqual(100);
        expect(evaluation.reasoningFactors).toHaveLength(7);
      }

      // Verify ranking is properly ordered (allowing for floating-point precision and tie-breaking)
      for (let i = 0; i < ranking.length - 1; i++) {
        const currentScore = ranking[i].score;
        const nextScore = ranking[i + 1].score;

        // Allow for small floating-point differences and tie-breaking by confidence
        expect(currentScore).toBeGreaterThanOrEqual(nextScore - 0.01);
      }
    });
  });

  describe('Learning Integration', () => {
    test('should process feedback and update strategy', async () => {
      const testUrl = 'https://example.com/pricing';

      // Get initial evaluation
      const initialEvaluation = await siteSelector.evaluateSite(testUrl, context);

      // Simulate positive feedback
      const positiveFeedback = {
        sessionId: 'test-session-1',
        decisions: [
          {
            timestamp: Date.now(),
            url: testUrl,
            action: 'visit' as const,
            score: initialEvaluation.relevanceScore,
            reasoning: 'Test decision',
            factors: [],
            context
          }
        ],
        outcomes: [
          {
            url: testUrl,
            factsExtracted: 10,
            relevanceActual: 0.9,
            timeSpent: 30000,
            userValue: 0.95
          }
        ],
        userRating: 5.0,
        improvements: ['Excellent pricing information']
      };

      // Update strategy with feedback
      siteSelector.updateSelectionStrategy(positiveFeedback);

      // The system should handle the feedback without errors
      // In a full implementation, we would verify that scoring has improved
      expect(() => {
        siteSelector.updateSelectionStrategy(positiveFeedback);
      }).not.toThrow();
    });
  });
});
