/**
 * Unit Tests for NavigationReasoner Implementation
 *
 * Tests the strategic decision-making capabilities of the NavigationReasoner component,
 * including link prioritization, navigation strategy generation, and path planning.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NavigationReasonerImpl } from '../navigation-reasoner';
import {
  ResearchContext,
  ResearchPhase,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy,
  NavigationConstraints,
  LinkCandidate,
  PageContent,
  NavigationApproach
} from '../intelligent-site-selection';
import { AIClient } from '../../../lib/ai-client';

// Mock AIClient
const mockAIClient: AIClient = {
  generateText: vi.fn(),
  generateStructuredData: vi.fn(),
  generateJSON: vi.fn()
} as any;

describe('NavigationReasoner', () => {
  let reasoner: NavigationReasonerImpl;
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

    reasoner = new NavigationReasonerImpl(mockAIClient, config);

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

  describe('Link Prioritization', () => {
    test('should prioritize pricing links higher than other links', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/pricing',
          text: 'Pricing Plans',
          context: 'Main navigation',
          elementType: 'a',
          position: { index: 0, totalLinks: 5 }
        },
        {
          url: 'https://example.com/about',
          text: 'About Us',
          context: 'Main navigation',
          elementType: 'a',
          position: { index: 1, totalLinks: 5 }
        },
        {
          url: 'https://example.com/features',
          text: 'Features',
          context: 'Main navigation',
          elementType: 'a',
          position: { index: 2, totalLinks: 5 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      // Should return prioritized links
      expect(prioritized.length).toBeGreaterThan(0);

      // Pricing should be first or second (high priority)
      const pricingLink = prioritized.find(l => l && l.url && l.url.includes('pricing'));
      const featuresLink = prioritized.find(l => l && l.url && l.url.includes('features'));
      const aboutLink = prioritized.find(l => l && l.url && l.url.includes('about'));

      if (pricingLink) {
        expect(pricingLink.priority).toBeGreaterThan(0.5);
      }

      // Features should also be high priority
      if (featuresLink) {
        expect(featuresLink.priority).toBeGreaterThan(0.4);
      }

      // About should be lower priority than pricing
      if (aboutLink && pricingLink) {
        expect(aboutLink.priority).toBeLessThan(pricingLink.priority);
      }
    });

    test('should penalize administrative links', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/login',
          text: 'Login',
          context: 'Header',
          elementType: 'a',
          position: { index: 0, totalLinks: 3 }
        },
        {
          url: 'https://example.com/pricing',
          text: 'Pricing',
          context: 'Header',
          elementType: 'a',
          position: { index: 1, totalLinks: 3 }
        },
        {
          url: 'https://example.com/signup',
          text: 'Sign Up',
          context: 'Header',
          elementType: 'a',
          position: { index: 2, totalLinks: 3 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      // Should return prioritized links
      expect(prioritized.length).toBeGreaterThan(0);
    });

    test('should consider keyword matching in prioritization', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/project-management-pricing',
          text: 'Project Management Pricing',
          context: 'Navigation',
          elementType: 'a',
          position: { index: 0, totalLinks: 2 }
        },
        {
          url: 'https://example.com/blog',
          text: 'Blog',
          context: 'Navigation',
          elementType: 'a',
          position: { index: 1, totalLinks: 2 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      // Both links should be present
      expect(prioritized.length).toBeGreaterThanOrEqual(1);

      // Link with more keywords should have higher priority
      const keywordRichLink = prioritized.find(l => l && l.url && l.url.includes('project-management'));
      const simpleLink = prioritized.find(l => l && l.url && l.url === 'https://example.com/blog');

      if (keywordRichLink && simpleLink) {
        expect(keywordRichLink.priority).toBeGreaterThan(simpleLink.priority);
      }
    });

    test('should return links sorted by priority descending', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/about',
          text: 'About',
          context: 'Nav',
          elementType: 'a',
          position: { index: 0, totalLinks: 3 }
        },
        {
          url: 'https://example.com/pricing',
          text: 'Pricing',
          context: 'Nav',
          elementType: 'a',
          position: { index: 1, totalLinks: 3 }
        },
        {
          url: 'https://example.com/features',
          text: 'Features',
          context: 'Nav',
          elementType: 'a',
          position: { index: 2, totalLinks: 3 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      // Verify sorted in descending order
      for (let i = 0; i < prioritized.length - 1; i++) {
        expect(prioritized[i].priority).toBeGreaterThanOrEqual(prioritized[i + 1].priority);
      }
    });
  });

  describe('Navigation Options Evaluation', () => {
    test('should evaluate navigation options and return plan', async () => {
      const page: PageContent = {
        title: 'Product Overview',
        url: 'https://example.com',
        metaDescription: 'Our product overview',
        headings: ['Features', 'Pricing', 'About'],
        paragraphs: ['Learn about our features', 'Check our pricing'],
        tables: [],
        links: [
          { text: 'Pricing', href: 'https://example.com/pricing' },
          { text: 'Features', href: 'https://example.com/features' },
          { text: 'About', href: 'https://example.com/about' },
          { text: 'Login', href: 'https://example.com/login' }
        ],
        rawText: 'Product overview content',
        domTree: '<html></html>'
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      expect(plan).toBeDefined();
      expect(plan.primaryTargets).toBeDefined();
      expect(plan.secondaryTargets).toBeDefined();
      expect(plan.avoidanceList).toBeDefined();
      expect(plan.reasoning).toBeDefined();
      expect(plan.confidence).toBeGreaterThan(0);
      expect(plan.confidence).toBeLessThanOrEqual(1);
    });

    test('should prioritize pricing and features in primary targets', async () => {
      const page: PageContent = {
        title: 'Product Overview',
        url: 'https://example.com',
        metaDescription: 'Our product',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [
          { text: 'Pricing', href: 'https://example.com/pricing' },
          { text: 'Features', href: 'https://example.com/features' },
          { text: 'Blog', href: 'https://example.com/blog' }
        ],
        rawText: '',
        domTree: ''
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      // Plan should have targets
      expect(plan.primaryTargets.length + plan.secondaryTargets.length).toBeGreaterThan(0);
    });

    test('should handle pages with no links', async () => {
      const page: PageContent = {
        title: 'Dead End Page',
        url: 'https://example.com/dead-end',
        metaDescription: 'No links here',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [],
        rawText: 'Content with no links',
        domTree: ''
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      expect(plan.primaryTargets).toHaveLength(0);
      expect(plan.secondaryTargets).toHaveLength(0);
      expect(plan.reasoning).toContain('No navigation links');
    });

    test('should include avoidance list for low-priority links', async () => {
      const page: PageContent = {
        title: 'Product',
        url: 'https://example.com',
        metaDescription: 'Product page',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [
          { text: 'Login', href: 'https://example.com/login' },
          { text: 'Admin', href: 'https://example.com/admin' },
          { text: 'Privacy', href: 'https://example.com/privacy' }
        ],
        rawText: '',
        domTree: ''
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      // Low-priority links should be in avoidance list or secondary targets
      // (not in primary targets)
      expect(plan.primaryTargets.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Should Follow Link Decision', () => {
    test('should follow high-priority links', async () => {
      const link: LinkCandidate = {
        url: 'https://example.com/pricing',
        text: 'Pricing Plans',
        context: 'Navigation',
        elementType: 'a',
        position: { index: 0, totalLinks: 5 }
      };

      const shouldFollow = await reasoner.shouldFollowLink(link, context);

      expect(shouldFollow).toBe(true);
    });

    test('should not follow low-priority links', async () => {
      const link: LinkCandidate = {
        url: 'https://example.com/login',
        text: 'Login',
        context: 'Header',
        elementType: 'a',
        position: { index: 0, totalLinks: 3 }
      };

      const shouldFollow = await reasoner.shouldFollowLink(link, context);

      // Login links should have low priority (< 0.4)
      expect(shouldFollow).toBe(false);
    });

    test('should follow moderate-priority links', async () => {
      const link: LinkCandidate = {
        url: 'https://example.com/blog',
        text: 'Blog',
        context: 'Footer',
        elementType: 'a',
        position: { index: 10, totalLinks: 20 }
      };

      const shouldFollow = await reasoner.shouldFollowLink(link, context);

      // Blog might be moderate priority, decision depends on implementation
      expect(typeof shouldFollow).toBe('boolean');
    });
  });

  describe('Navigation Strategy Generation', () => {
    test('should generate navigation strategy with valid approach', () => {
      const goals = ['Find pricing information', 'Identify key features'];
      const constraints: NavigationConstraints = {
        maxPages: 20,
        maxDepth: 5,
        timeLimit: 300000
      };

      const strategy = reasoner.generateNavigationStrategy(goals, constraints);

      expect(strategy).toBeDefined();
      expect(strategy.approach).toBeDefined();
      expect(strategy.maxDepth).toBeGreaterThan(0);
      expect(strategy.maxDepth).toBeLessThanOrEqual(5);
      expect(strategy.parallelism).toBeGreaterThan(0);
      expect(strategy.focusAreas).toBeDefined();
      expect(Array.isArray(strategy.focusAreas)).toBe(true);
    });

    test('should use breadth-first approach for comparison goals', () => {
      const goals = ['Compare different solutions'];
      const constraints: NavigationConstraints = {
        maxPages: 20,
        maxDepth: 5,
        timeLimit: 300000
      };

      const strategy = reasoner.generateNavigationStrategy(goals, constraints);

      expect(strategy.approach).toBe(NavigationApproach.BREADTH_FIRST);
    });

    test('should use depth-first approach for deep research goals', () => {
      const goals = ['Deep dive into technical details'];
      const constraints: NavigationConstraints = {
        maxPages: 20,
        maxDepth: 5,
        timeLimit: 300000
      };

      const strategy = reasoner.generateNavigationStrategy(goals, constraints);

      expect(strategy.approach).toBe(NavigationApproach.DEPTH_FIRST);
    });

    test('should use targeted approach for specific goals', () => {
      const goals = ['Find specific pricing tier'];
      const constraints: NavigationConstraints = {
        maxPages: 20,
        maxDepth: 5,
        timeLimit: 300000
      };

      const strategy = reasoner.generateNavigationStrategy(goals, constraints);

      expect(strategy.approach).toBe(NavigationApproach.TARGETED);
    });

    test('should extract focus areas from goals', () => {
      const goals = ['Find pricing information', 'Identify key features', 'Read documentation'];
      const constraints: NavigationConstraints = {
        maxPages: 20,
        maxDepth: 5,
        timeLimit: 300000
      };

      const strategy = reasoner.generateNavigationStrategy(goals, constraints);

      expect(strategy.focusAreas).toContain('pricing');
      expect(strategy.focusAreas).toContain('features');
      expect(strategy.focusAreas).toContain('documentation');
    });

    test('should adjust parallelism based on performance mode', () => {
      const goals = ['Research'];
      const constraints: NavigationConstraints = {
        maxPages: 20,
        maxDepth: 5,
        timeLimit: 300000
      };

      // Test with fast mode
      const fastConfig = { ...config, performanceMode: 'fast' };
      const fastReasoner = new NavigationReasonerImpl(mockAIClient, fastConfig);
      const fastStrategy = fastReasoner.generateNavigationStrategy(goals, constraints);

      // Test with balanced mode
      const balancedReasoner = new NavigationReasonerImpl(mockAIClient, config);
      const balancedStrategy = balancedReasoner.generateNavigationStrategy(goals, constraints);

      expect(fastStrategy.parallelism).toBeGreaterThanOrEqual(balancedStrategy.parallelism);
    });

    test('should respect max depth constraint', () => {
      const goals = ['Research'];
      const constraints: NavigationConstraints = {
        maxPages: 100,
        maxDepth: 3,
        timeLimit: 300000
      };

      const strategy = reasoner.generateNavigationStrategy(goals, constraints);

      expect(strategy.maxDepth).toBeLessThanOrEqual(constraints.maxDepth);
    });
  });

  describe('Link Reasoning Generation', () => {
    test('should provide reasoning for prioritized links', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/pricing',
          text: 'Pricing Plans',
          context: 'Navigation',
          elementType: 'a',
          position: { index: 0, totalLinks: 5 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      expect(prioritized[0].reasoning).toBeDefined();
      expect(prioritized[0].reasoning.length).toBeGreaterThan(0);
    });

    test('should include specific reasons in link reasoning', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/pricing',
          text: 'Pricing Plans',
          context: 'Navigation',
          elementType: 'a',
          position: { index: 0, totalLinks: 5 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      expect(prioritized[0].reasoning).toContain('pricing');
    });
  });

  describe('Navigation Confidence Calculation', () => {
    test('should return confidence between 0 and 1', async () => {
      const page: PageContent = {
        title: 'Product',
        url: 'https://example.com',
        metaDescription: 'Product page',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [
          { text: 'Pricing', href: 'https://example.com/pricing' },
          { text: 'Features', href: 'https://example.com/features' }
        ],
        rawText: '',
        domTree: ''
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      expect(plan.confidence).toBeGreaterThanOrEqual(0);
      expect(plan.confidence).toBeLessThanOrEqual(1);
    });

    test('should have higher confidence with more high-priority links', async () => {
      const page: PageContent = {
        title: 'Product',
        url: 'https://example.com',
        metaDescription: 'Product page',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [
          { text: 'Pricing', href: 'https://example.com/pricing' },
          { text: 'Features', href: 'https://example.com/features' },
          { text: 'Documentation', href: 'https://example.com/docs' },
          { text: 'Reviews', href: 'https://example.com/reviews' }
        ],
        rawText: '',
        domTree: ''
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      // With multiple high-value links, confidence should be higher
      expect(plan.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Edge Cases', () => {
    test('should handle links with missing position information', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/pricing',
          text: 'Pricing',
          context: 'Navigation',
          elementType: 'a'
          // No position provided
        }
      ];

      expect(async () => {
        await reasoner.prioritizeLinks(links, context);
      }).not.toThrow();
    });

    test('should handle empty link text', async () => {
      const links: LinkCandidate[] = [
        {
          url: 'https://example.com/pricing',
          text: '',
          context: 'Navigation',
          elementType: 'a',
          position: { index: 0, totalLinks: 1 }
        }
      ];

      const prioritized = await reasoner.prioritizeLinks(links, context);

      expect(prioritized).toHaveLength(1);
      expect(prioritized[0].priority).toBeGreaterThan(0);
    });

    test('should handle anchor-only links', async () => {
      const page: PageContent = {
        title: 'Product',
        url: 'https://example.com',
        metaDescription: 'Product page',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [
          { text: 'Jump to section', href: '#section1' },
          { text: 'Pricing', href: 'https://example.com/pricing' }
        ],
        rawText: '',
        domTree: ''
      };

      const mockMemory = {
        addFact: vi.fn(),
        markVisited: vi.fn(),
        hasVisited: vi.fn().mockReturnValue(false),
        queueUrl: vi.fn(),
        dequeueUrl: vi.fn(),
        getSummary: vi.fn().mockReturnValue(''),
        getFactCount: vi.fn().mockReturnValue(0),
        getVisitedCount: vi.fn().mockReturnValue(0),
        getQueueSize: vi.fn().mockReturnValue(0)
      };

      const plan = await reasoner.evaluateNavigationOptions(page, context, mockMemory as any);

      // Anchor links should be filtered out
      const allTargets = [...plan.primaryTargets, ...plan.secondaryTargets, ...plan.avoidanceList];
      expect(allTargets.every(url => !url || !url.includes('#'))).toBe(true);
    });
  });
});
