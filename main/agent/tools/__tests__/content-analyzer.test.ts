/**
 * Unit Tests for ContentAnalyzer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentAnalyzer } from '../content-analyzer';
import { AIClient } from '../../../lib/ai-client';
import {
  PageContent,
  ResearchContext,
  ContentType,
  ProcessingLevel,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy,
  ResearchPhase
} from '../intelligent-site-selection';

// Mock AI Client
const mockAIClient: AIClient = {
  chat: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      semanticRelevance: 75,
      informationValue: 80,
      contentGaps: ['pricing details'],
      extractionPriority: 4,
      nextActionRecommendations: ['Extract pricing information', 'Look for feature comparisons']
    })
  })
} as any;

const defaultConfig: IntelligentSelectionConfig = {
  relevanceThreshold: 40,
  performanceMode: 'balanced',
  learningEnabled: true,
  cachingStrategy: CacheStrategy.BALANCED,
  loggingLevel: LoggingLevel.INFO,
  adaptiveWeights: true
};

const sampleContext: ResearchContext = {
  taskDescription: 'Find pricing information for SaaS tools',
  goals: ['Find pricing information', 'Identify key features'],
  keywords: ['pricing', 'cost', 'features', 'saas'],
  currentPhase: ResearchPhase.DISCOVERY,
  timeConstraints: { urgency: 'medium' },
  qualityRequirements: {
    minRelevanceScore: 40,
    requireMultipleSources: false,
    factVerificationLevel: 'basic'
  },
  previousFindings: []
};

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;

  beforeEach(() => {
    analyzer = new ContentAnalyzer(mockAIClient, defaultConfig);
    vi.clearAllMocks();
  });

  describe('performHeuristicAnalysis', () => {
    it('should analyze pricing page content correctly', () => {
      const content: PageContent = {
        title: 'Pricing Plans - SaaS Tool',
        url: 'https://example.com/pricing',
        metaDescription: 'Choose the right plan for your business',
        headings: ['Basic Plan', 'Pro Plan', 'Enterprise'],
        paragraphs: [
          'Our Basic plan starts at $9/month and includes essential features.',
          'The Pro plan at $29/month adds advanced analytics and integrations.',
          'Enterprise pricing is available on request with custom features.'
        ],
        tables: [['Plan', 'Price', 'Features'], ['Basic', '$9/mo', 'Core features']],
        links: [{ text: 'Contact Sales', href: '/contact' }],
        rawText: 'Pricing Plans Basic $9/month Pro $29/month Enterprise custom',
        domTree: '<div>pricing content</div>',
        prices: ['$9/month', '$29/month'],
        ratings: []
      };

      const result = analyzer.performHeuristicAnalysis(content, sampleContext);

      expect(result.contentType).toBe(ContentType.PRICING);
      expect(result.relevanceScore).toBeGreaterThan(70);
      expect(result.informationDensity).toBeGreaterThan(0.5);
      expect(result.processingRecommendation).toBe(ProcessingLevel.DEEP_AI);
      expect(result.fastRejectReasons).toBeUndefined();
    });

    it('should reject administrative pages', () => {
      const content: PageContent = {
        title: 'Login - Admin Dashboard',
        url: 'https://example.com/admin/login',
        metaDescription: 'Login to your account',
        headings: ['Login'],
        paragraphs: ['Enter your credentials to access the dashboard'],
        tables: [],
        links: [{ text: 'Forgot Password', href: '/forgot' }],
        rawText: 'Login Enter username and password',
        domTree: '<form>login form</form>',
        prices: [],
        ratings: []
      };

      const result = analyzer.performHeuristicAnalysis(content, sampleContext);

      expect(result.contentType).toBe(ContentType.ADMINISTRATIVE);
      expect(result.relevanceScore).toBeLessThan(40);
      expect(result.processingRecommendation).toBe(ProcessingLevel.SKIP);
      expect(result.fastRejectReasons).toContain('Administrative page');
    });

    it('should complete heuristic analysis within time limit', () => {
      const content: PageContent = {
        title: 'Large Content Page',
        url: 'https://example.com/content',
        metaDescription: 'A page with lots of content',
        headings: Array(100).fill('Heading'),
        paragraphs: Array(1000).fill('This is a paragraph with some content about features and pricing.'),
        tables: [],
        links: Array(50).fill({ text: 'Link', href: '/page' }),
        rawText: Array(1000).fill('content text').join(' '),
        domTree: '<div>large content</div>',
        prices: [],
        ratings: []
      };

      const startTime = Date.now();
      const result = analyzer.performHeuristicAnalysis(content, sampleContext);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(200); // Should complete within 200ms
      expect(result).toBeDefined();
      expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(result.relevanceScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty content gracefully', () => {
      const content: PageContent = {
        title: '',
        url: 'https://example.com/empty',
        metaDescription: '',
        headings: [],
        paragraphs: [],
        tables: [],
        links: [],
        rawText: '',
        domTree: '',
        prices: [],
        ratings: []
      };

      const result = analyzer.performHeuristicAnalysis(content, sampleContext);

      expect(result.processingRecommendation).toBe(ProcessingLevel.SKIP);
      expect(result.fastRejectReasons).toContain('Insufficient content length');
      expect(result.informationDensity).toBe(0);
    });
  });

  describe('performDeepAnalysis', () => {
    it('should perform AI-powered deep analysis', async () => {
      const content: PageContent = {
        title: 'Product Features Overview',
        url: 'https://example.com/features',
        metaDescription: 'Comprehensive feature list',
        headings: ['Core Features', 'Advanced Features'],
        paragraphs: [
          'Our platform offers real-time analytics, automated reporting, and seamless integrations.',
          'Advanced features include AI-powered insights, custom dashboards, and enterprise security.'
        ],
        tables: [],
        links: [],
        rawText: 'Product features analytics reporting integrations AI insights dashboards security',
        domTree: '<div>features content</div>',
        prices: [],
        ratings: []
      };

      const result = await analyzer.performDeepAnalysis(content, sampleContext);

      expect(mockAIClient.chat).toHaveBeenCalledWith({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('RESEARCH CONTEXT')
          })
        ]),
        model: 'claude-3-haiku-20240307',
        maxTokens: 500,
        temperature: 0.1
      });

      expect(result.semanticRelevance).toBe(75);
      expect(result.informationValue).toBe(80);
      expect(result.contentGaps).toEqual(['pricing details']);
      expect(result.extractionPriority).toBe(4);
      expect(result.nextActionRecommendations).toHaveLength(2);
    });

    it('should handle AI client errors gracefully', async () => {
      (mockAIClient.chat as any).mockRejectedValueOnce(new Error('AI service unavailable'));

      const content: PageContent = {
        title: 'Test Content',
        url: 'https://example.com/test',
        metaDescription: 'Test description',
        headings: ['Test'],
        paragraphs: ['Test paragraph with sufficient content for analysis'],
        tables: [],
        links: [],
        rawText: 'Test content for analysis',
        domTree: '<div>test</div>',
        prices: [],
        ratings: []
      };

      const result = await analyzer.performDeepAnalysis(content, sampleContext);

      expect(result.semanticRelevance).toBe(40);
      expect(result.informationValue).toBe(30);
      expect(result.contentGaps).toEqual(['Analysis unavailable']);
      expect(result.nextActionRecommendations).toEqual(['Proceed with caution']);
    });

    it('should handle insufficient content', async () => {
      const content: PageContent = {
        title: 'Short',
        url: 'https://example.com/short',
        metaDescription: '',
        headings: [],
        paragraphs: ['Short'],
        tables: [],
        links: [],
        rawText: 'Short',
        domTree: '<div>short</div>',
        prices: [],
        ratings: []
      };

      const result = await analyzer.performDeepAnalysis(content, sampleContext);

      expect(result.semanticRelevance).toBe(20);
      expect(result.informationValue).toBe(10);
      expect(result.contentGaps).toEqual(['Insufficient content']);
      expect(result.extractionPriority).toBe(1);
    });
  });

  describe('extractStructuredData', () => {
    it('should extract pricing data from content', () => {
      const content: PageContent = {
        title: 'Pricing',
        url: 'https://example.com/pricing',
        metaDescription: 'Our pricing plans',
        headings: [],
        paragraphs: ['Basic plan costs $19/month. Premium is $49/year.'],
        tables: [],
        links: [],
        rawText: 'Basic $19/month Premium $49/year',
        domTree: '',
        prices: ['$19/month', '$49/year'],
        ratings: []
      };

      const result = analyzer.extractStructuredData(content);

      expect(result.pricing.length).toBeGreaterThanOrEqual(2); // At least 2 from prices array
      expect(result.pricing.some(p => p.price === '$19/month')).toBe(true);
      expect(result.pricing.some(p => p.price === '$49/year')).toBe(true);
      expect(result.pricing[0].currency).toBe('USD');
    });

    it('should extract rating data from content', () => {
      const content: PageContent = {
        title: 'Reviews',
        url: 'https://example.com/reviews',
        metaDescription: 'Customer reviews',
        headings: [],
        paragraphs: ['Rated 4.5/5 stars by customers. Overall rating: 4.2'],
        tables: [],
        links: [],
        rawText: '4.5/5 stars rating: 4.2',
        domTree: '',
        prices: [],
        ratings: ['4.5/5', '4.2 stars']
      };

      const result = analyzer.extractStructuredData(content);

      expect(result.ratings.length).toBeGreaterThan(0);
      expect(result.ratings[0].score).toBeGreaterThan(4);
      expect(result.ratings[0].maxScore).toBe(5);
    });

    it('should extract contact information', () => {
      const content: PageContent = {
        title: 'Contact Us',
        url: 'https://example.com/contact',
        metaDescription: 'Get in touch',
        headings: [],
        paragraphs: ['Email us at support@example.com or call (555) 123-4567'],
        tables: [],
        links: [],
        rawText: 'support@example.com (555) 123-4567',
        domTree: '',
        prices: [],
        ratings: []
      };

      const result = analyzer.extractStructuredData(content);

      expect(result.contacts.length).toBeGreaterThan(0);
      const emailContact = result.contacts.find(c => c.type === 'email');
      const phoneContact = result.contacts.find(c => c.type === 'phone');

      expect(emailContact?.value).toBe('support@example.com');
      expect(phoneContact?.value).toContain('555');
    });
  });

  describe('assessContentQuality', () => {
    it('should assess high-quality content correctly', () => {
      const content: PageContent = {
        title: 'Comprehensive Product Guide',
        url: 'https://example.com/guide',
        metaDescription: 'A detailed guide covering all aspects of our product features and capabilities',
        headings: ['Introduction', 'Features', 'Pricing', 'Support'],
        paragraphs: [
          'This comprehensive guide provides detailed information about our product.',
          'Our platform includes advanced analytics, real-time reporting, and seamless integrations.',
          'We offer flexible pricing plans to meet different business needs.',
          'Our support team is available 24/7 to help with any questions.'
        ],
        tables: [['Feature', 'Basic', 'Pro'], ['Analytics', 'Yes', 'Advanced']],
        links: [],
        rawText: 'Comprehensive guide product features analytics reporting integrations pricing support',
        domTree: '',
        prices: ['$19/month'],
        ratings: ['4.5/5']
      };

      const result = analyzer.assessContentQuality(content);

      expect(result.completeness).toBeGreaterThan(0.7);
      expect(result.authority).toBeGreaterThan(0.6);
      expect(result.readability).toBeGreaterThan(0.5);
    });

    it('should assess low-quality content correctly', () => {
      const content: PageContent = {
        title: '',
        url: 'https://example.com/low',
        metaDescription: '',
        headings: [],
        paragraphs: ['Short.'],
        tables: [],
        links: [],
        rawText: 'Short.',
        domTree: '',
        prices: [],
        ratings: []
      };

      const result = analyzer.assessContentQuality(content);

      expect(result.completeness).toBeLessThan(0.5);
      expect(result.authority).toBeLessThan(0.6);
    });
  });
});
