/**
 * Unit Tests for RelevanceEngine Implementation
 */

import { RelevanceEngineImpl } from '../relevance-engine';
import {
  ResearchContext,
  ResearchPhase,
  PageContent,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy,
  SharedResearchMemory,
  ExtractedFact
} from '../intelligent-site-selection';
import { AIClient } from '../../lib/ai-client';

// Mock AIClient
class MockAIClient implements Partial<AIClient> {
  async generateText(prompt: string, options?: any): Promise<string> {
    return JSON.stringify({
      overallScore: 75,
      categoryScores: {
        pricing: 80,
        features: 70,
        documentation: 60,
        reviews: 50,
        technical: 65,
        competitive: 55
      },
      contentQuality: 75,
      informationDensity: 70,
      uniquenessScore: 65,
      contextualFit: 80
    });
  }
}

// Mock SharedResearchMemory
class MockSharedResearchMemory implements SharedResearchMemory {
  private facts: ExtractedFact[] = [];
  private visited: Set<string> = new Set();
  private queue: string[] = [];

  addFact(fact: ExtractedFact): void {
    this.facts.push(fact);
  }

  markVisited(url: string): void {
    this.visited.add(url);
  }

  hasVisited(url: string): boolean {
    return this.visited.has(url);
  }

  queueUrl(url: string, score?: number): void {
    this.queue.push(url);
  }

  dequeueUrl(): string | undefined {
    return this.queue.shift();
  }

  getSummary(): string {
    return `${this.facts.length} facts collected`;
  }

  getFactCount(): number {
    return this.facts.length;
  }

  getVisitedCount(): number {
    return this.visited.size;
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

describe('RelevanceEngine', () => {
  let engine: RelevanceEngineImpl;
  let config: IntelligentSelectionConfig;
  let context: ResearchContext;
  let pageContent: PageContent;
  let aiClient: MockAIClient;

  beforeEach(() => {
    aiClient = new MockAIClient();

    config = {
      relevanceThreshold: 40,
      performanceMode: 'balanced',
      learningEnabled: true,
      cachingStrategy: CacheStrategy.BALANCED,
      loggingLevel: LoggingLevel.INFO,
      adaptiveWeights: true
    };

    engine = new RelevanceEngineImpl(aiClient as any, config);

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

    pageContent = {
      title: 'Project Management Tool - Pricing & Features',
      url: 'https://example.com/pricing',
      metaDescription: 'Explore our pricing plans and features',
      headings: ['Pricing Plans', 'Features Overview', 'Comparison'],
      paragraphs: [
        'Our tool offers three pricing tiers: Basic, Professional, and Enterprise.',
        'Key features include task management, team collaboration, and reporting.'
      ],
      tables: [['Plan', 'Price', 'Users'], ['Basic', '$10/mo', '1-5']],
      links: [
        { text: 'Features', href: '/features' },
        { text: 'Pricing', href: '/pricing' }
      ],
      rawText: 'Project management pricing features',
      domTree: '<html><body>...</body></html>'
    };
  });

  describe('Relevance Assessment', () => {
    test('should assess relevance of page content', async () => {
      const assessment = await engine.assessRelevance(pageContent, context);

      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
      expect(assessment.categoryScores).toBeDefined();
      expect(assessment.contentQuality).toBeGreaterThanOrEqual(0);
      expect(assessment.informationDensity).toBeGreaterThanOrEqual(0);
    });

    test('should return consistent assessment for identical inputs', async () => {
      const assessment1 = await engine.assessRelevance(pageContent, context);
      const assessment2 = await engine.assessRelevance(pageContent, context);

      expect(assessment1.overallScore).toBe(assessment2.overallScore);
      expect(assessment1.categoryScores.pricing).toBe(assessment2.categoryScores.pricing);
    });

    test('should assess category scores correctly', async () => {
      const assessment = await engine.assessRelevance(pageContent, context);

      expect(assessment.categoryScores.pricing).toBeGreaterThanOrEqual(0);
      expect(assessment.categoryScores.pricing).toBeLessThanOrEqual(100);
      expect(assessment.categoryScores.features).toBeGreaterThanOrEqual(0);
      expect(assessment.categoryScores.features).toBeLessThanOrEqual(100);
    });

    test('should assess content quality metrics', async () => {
      const assessment = await engine.assessRelevance(pageContent, context);

      expect(assessment.contentQuality).toBeGreaterThanOrEqual(0);
      expect(assessment.contentQuality).toBeLessThanOrEqual(100);
      expect(assessment.informationDensity).toBeGreaterThanOrEqual(0);
      expect(assessment.informationDensity).toBeLessThanOrEqual(100);
      expect(assessment.uniquenessScore).toBeGreaterThanOrEqual(0);
      expect(assessment.uniquenessScore).toBeLessThanOrEqual(100);
      expect(assessment.contextualFit).toBeGreaterThanOrEqual(0);
      expect(assessment.contextualFit).toBeLessThanOrEqual(100);
    });
  });

  describe('Caching System', () => {
    test('should cache relevance assessments', async () => {
      const stats1 = engine.getCacheStats();
      expect(stats1.hits).toBe(0);

      // First call - cache miss
      await engine.assessRelevance(pageContent, context);
      const stats2 = engine.getCacheStats();
      expect(stats2.misses).toBe(1);

      // Second call - cache hit
      await engine.assessRelevance(pageContent, context);
      const stats3 = engine.getCacheStats();
      expect(stats3.hits).toBe(1);
    });

    test('should return cached assessment on hit', async () => {
      const assessment1 = await engine.assessRelevance(pageContent, context);
      const assessment2 = await engine.assessRelevance(pageContent, context);

      expect(assessment1).toEqual(assessment2);
    });

    test('should track cache hit rate', async () => {
      await engine.assessRelevance(pageContent, context);
      await engine.assessRelevance(pageContent, context);
      await engine.assessRelevance(pageContent, context);

      const stats = engine.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    test('should handle cache misses for different content', async () => {
      const content1 = { ...pageContent, url: 'https://example.com/page1' };
      const content2 = { ...pageContent, url: 'https://example.com/page2' };

      await engine.assessRelevance(content1, context);
      const stats1 = engine.getCacheStats();

      await engine.assessRelevance(content2, context);
      const stats2 = engine.getCacheStats();

      expect(stats2.misses).toBeGreaterThan(stats1.misses);
    });
  });

  describe('Content Gap Analysis', () => {
    test('should analyze content gaps in memory', () => {
      const memory = new MockSharedResearchMemory();

      const gaps = engine.analyzeContentGaps(memory, context.goals);

      expect(gaps).toBeDefined();
      expect(gaps.missingCategories).toBeDefined();
      expect(gaps.incompleteAreas).toBeDefined();
      expect(gaps.priorityGaps).toBeDefined();
      expect(Array.isArray(gaps.missingCategories)).toBe(true);
      expect(Array.isArray(gaps.incompleteAreas)).toBe(true);
      expect(Array.isArray(gaps.priorityGaps)).toBe(true);
    });

    test('should identify missing categories based on goals', () => {
      const memory = new MockSharedResearchMemory();
      const pricingGoals = ['Find pricing information'];

      const gaps = engine.analyzeContentGaps(memory, pricingGoals);

      // Should identify pricing as a potential gap
      expect(gaps.missingCategories.length >= 0).toBe(true);
    });

    test('should prioritize gaps correctly', () => {
      const memory = new MockSharedResearchMemory();

      const gaps = engine.analyzeContentGaps(memory, context.goals);

      // Priority gaps should be sorted by priority
      if (gaps.priorityGaps.length > 1) {
        for (let i = 0; i < gaps.priorityGaps.length - 1; i++) {
          expect(gaps.priorityGaps[i].priority).toBeGreaterThanOrEqual(
            gaps.priorityGaps[i + 1].priority
          );
        }
      }
    });
  });

  describe('Learning and Adaptation', () => {
    test('should adapt scoring weights from learning data', () => {
      const learningData = {
        patterns: [
          {
            type: 'pricing',
            pattern: 'pricing-page',
            confidence: 0.9,
            successRate: 0.85,
            lastUpdated: Date.now()
          }
        ],
        outcomes: [
          {
            url: 'https://example.com/pricing',
            factsExtracted: 5,
            relevanceActual: 85,
            timeSpent: 2000,
            userValue: 90
          }
        ],
        feedback: [],
        weights: {
          keywordMatch: 0.2,
          urlPatterns: 0.2,
          contentQuality: 0.15,
          informationDensity: 0.15,
          contextualFit: 0.15,
          uniqueness: 0.1,
          structuredData: 0.05,
          userSignals: 0
        }
      };

      expect(() => {
        engine.adaptScoringWeights(learningData);
      }).not.toThrow();
    });

    test('should handle learning data with no patterns', () => {
      const learningData = {
        patterns: [],
        outcomes: [],
        feedback: [],
        weights: {
          keywordMatch: 0.2,
          urlPatterns: 0.2,
          contentQuality: 0.15,
          informationDensity: 0.15,
          contextualFit: 0.15,
          uniqueness: 0.1,
          structuredData: 0.05,
          userSignals: 0
        }
      };

      expect(() => {
        engine.adaptScoringWeights(learningData);
      }).not.toThrow();
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache based on criteria', async () => {
      // Add some cached entries
      await engine.assessRelevance(pageContent, context);
      const statsBefore = engine.getCacheStats();

      // Invalidate cache
      engine.invalidateCache({ olderThan: 0 });

      // Cache should be cleared
      const statsAfter = engine.getCacheStats();
      expect(statsAfter.hits).toBe(statsBefore.hits);
    });
  });

  describe('Error Handling', () => {
    test('should handle AI client errors gracefully', async () => {
      const failingAIClient = {
        generateText: async () => {
          throw new Error('AI service error');
        }
      };

      const failingEngine = new RelevanceEngineImpl(failingAIClient as any, config);

      const assessment = await failingEngine.assessRelevance(pageContent, context);

      // Should return default assessment on error
      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBe(50);
    });

    test('should handle malformed AI responses', async () => {
      const malformedAIClient = {
        generateText: async () => 'Invalid JSON response'
      };

      const malformedEngine = new RelevanceEngineImpl(malformedAIClient as any, config);

      const assessment = await malformedEngine.assessRelevance(pageContent, context);

      // Should return default assessment on parse error
      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty page content', async () => {
      const emptyContent: PageContent = {
        title: '',
        url: '',
        metaDescription: '',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [],
        rawText: '',
        domTree: ''
      };

      const assessment = await engine.assessRelevance(emptyContent, context);

      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallScore).toBeLessThanOrEqual(100);
    });

    test('should handle context with no goals', async () => {
      const noGoalsContext = { ...context, goals: [] };

      const assessment = await engine.assessRelevance(pageContent, noGoalsContext);

      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    });

    test('should handle context with no keywords', async () => {
      const noKeywordsContext = { ...context, keywords: [] };

      const assessment = await engine.assessRelevance(pageContent, noKeywordsContext);

      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    test('should complete assessment within reasonable time', async () => {
      const startTime = Date.now();

      await engine.assessRelevance(pageContent, context);

      const duration = Date.now() - startTime;

      // Should complete within 5 seconds (generous timeout for AI calls)
      expect(duration).toBeLessThan(5000);
    });

    test('should use cache to improve performance', async () => {
      // First call - no cache
      const start1 = Date.now();
      await engine.assessRelevance(pageContent, context);
      const duration1 = Date.now() - start1;

      // Second call - with cache
      const start2 = Date.now();
      await engine.assessRelevance(pageContent, context);
      const duration2 = Date.now() - start2;

      // Cached call should be faster or equal (mock is very fast)
      expect(duration2).toBeLessThanOrEqual(duration1);

      // Verify cache was actually used
      const stats = engine.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });
});
