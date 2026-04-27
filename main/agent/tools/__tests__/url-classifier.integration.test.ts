/**
 * Integration Tests for URLClassifier with Base Classes
 */

import { URLClassifierImpl } from '../url-classifier';
import {
  URLCategory,
  RiskLevel,
  ProcessingLevel,
  ResearchContext,
  ResearchPhase,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy
} from '../intelligent-site-selection';

describe('URLClassifier Integration', () => {
  let classifier: URLClassifierImpl;
  let config: IntelligentSelectionConfig;

  beforeEach(() => {
    config = {
      relevanceThreshold: 40,
      performanceMode: 'balanced',
      learningEnabled: true,
      cachingStrategy: CacheStrategy.BALANCED,
      loggingLevel: LoggingLevel.INFO,
      adaptiveWeights: true
    };

    classifier = new URLClassifierImpl(config);
  });

  test('should integrate with base class methods', () => {
    // Test that base class methods are accessible
    expect(classifier.getPatternConfidence).toBeDefined();
    expect(classifier.generateURLScore).toBeDefined();
    expect(classifier.classifyURL).toBeDefined();
    expect(classifier.updatePatterns).toBeDefined();
  });

  test('should work with realistic research scenarios', () => {
    const context: ResearchContext = {
      taskDescription: 'Research SaaS pricing models for project management tools',
      goals: ['Find pricing information', 'Compare features'],
      keywords: ['pricing', 'saas', 'project', 'management', 'subscription'],
      currentPhase: ResearchPhase.DISCOVERY,
      timeConstraints: { urgency: 'medium' },
      qualityRequirements: {
        minRelevanceScore: 40,
        requireMultipleSources: true,
        factVerificationLevel: 'thorough'
      },
      previousFindings: []
    };

    const testUrls = [
      'https://asana.com/pricing',
      'https://trello.com/features',
      'https://monday.com/login',
      'https://jira.atlassian.com/docs',
      'https://basecamp.com/image.jpg'
    ];

    const results = testUrls.map(url => ({
      url,
      classification: classifier.classifyURL(url, context)
    }));

    // Verify pricing URL gets high score
    const pricingResult = results.find(r => r.url.includes('pricing'));
    expect(pricingResult?.classification.score).toBeGreaterThan(70);
    expect(pricingResult?.classification.category).toBe(URLCategory.PRICING);

    // Verify features URL gets good score
    const featuresResult = results.find(r => r.url.includes('features'));
    expect(featuresResult?.classification.score).toBeGreaterThan(60);
    expect(featuresResult?.classification.category).toBe(URLCategory.FEATURES);

    // Verify login URL gets penalized
    const loginResult = results.find(r => r.url.includes('login'));
    expect(loginResult?.classification.score).toBeLessThan(40);
    expect(loginResult?.classification.category).toBe(URLCategory.ADMINISTRATIVE);

    // Verify docs URL gets moderate score
    const docsResult = results.find(r => r.url.includes('docs'));
    expect(docsResult?.classification.score).toBeGreaterThan(50);
    expect(docsResult?.classification.category).toBe(URLCategory.DOCUMENTATION);

    // Verify image URL gets skipped
    const imageResult = results.find(r => r.url.includes('.jpg'));
    expect(imageResult?.classification.processingRecommendation).toBe(ProcessingLevel.SKIP);
    expect(imageResult?.classification.category).toBe(URLCategory.MEDIA);
  });

  test('should adapt to different research phases', () => {
    const baseContext: ResearchContext = {
      taskDescription: 'Research project management tools',
      goals: ['Find suitable tool'],
      keywords: ['project', 'management'],
      currentPhase: ResearchPhase.DISCOVERY,
      timeConstraints: { urgency: 'medium' },
      qualityRequirements: {
        minRelevanceScore: 40,
        requireMultipleSources: false,
        factVerificationLevel: 'basic'
      },
      previousFindings: []
    };

    const productUrl = 'https://example.com/product';
    const docsUrl = 'https://example.com/documentation';

    // Test discovery phase
    const discoveryContext = { ...baseContext, currentPhase: ResearchPhase.DISCOVERY };
    const productInDiscovery = classifier.classifyURL(productUrl, discoveryContext);

    // Test analysis phase
    const analysisContext = { ...baseContext, currentPhase: ResearchPhase.ANALYSIS };
    const docsInAnalysis = classifier.classifyURL(docsUrl, analysisContext);
    const productInAnalysis = classifier.classifyURL(productUrl, analysisContext);

    // Product pages should score higher in discovery
    expect(productInDiscovery.score).toBeGreaterThan(productInAnalysis.score);

    // Documentation should get boost in analysis phase
    expect(docsInAnalysis.score).toBeGreaterThan(50);
  });

  test('should handle learning and pattern updates', () => {
    const initialConfidence = classifier.getPatternConfidence('pricing');

    // Simulate successful learning
    const learningData = {
      successPatterns: [
        {
          type: 'url',
          pattern: 'pricing',
          confidence: 0.95,
          successRate: 0.9,
          lastUpdated: Date.now()
        }
      ],
      failurePatterns: [],
      contextualFactors: {
        'pricing_focus': 1.8
      }
    };

    classifier.updatePatterns(learningData);

    // Pattern confidence should be updated
    const updatedConfidence = classifier.getPatternConfidence('pricing');
    expect(updatedConfidence).toBeGreaterThanOrEqual(initialConfidence);

    // Test that the learning affects scoring
    const context: ResearchContext = {
      taskDescription: 'Find pricing information',
      goals: ['pricing research'],
      keywords: ['pricing'],
      currentPhase: ResearchPhase.DISCOVERY,
      timeConstraints: { urgency: 'high' },
      qualityRequirements: {
        minRelevanceScore: 40,
        requireMultipleSources: false,
        factVerificationLevel: 'basic'
      },
      previousFindings: []
    };

    const pricingUrl = 'https://example.com/pricing';
    const classification = classifier.classifyURL(pricingUrl, context);

    expect(classification.score).toBeGreaterThan(70);
  });

  test('should provide comprehensive classification results', () => {
    const context: ResearchContext = {
      taskDescription: 'Research pricing and features',
      goals: ['pricing', 'features'],
      keywords: ['pricing', 'features'],
      currentPhase: ResearchPhase.DISCOVERY,
      timeConstraints: { urgency: 'medium' },
      qualityRequirements: {
        minRelevanceScore: 40,
        requireMultipleSources: false,
        factVerificationLevel: 'basic'
      },
      previousFindings: []
    };

    const url = 'https://example.com/pricing-features';
    const classification = classifier.classifyURL(url, context);

    // Should have all required properties
    expect(classification).toHaveProperty('category');
    expect(classification).toHaveProperty('score');
    expect(classification).toHaveProperty('patterns');
    expect(classification).toHaveProperty('riskLevel');
    expect(classification).toHaveProperty('processingRecommendation');

    // Should have matched patterns
    expect(classification.patterns.length).toBeGreaterThan(0);

    // Should have valid score range
    expect(classification.score).toBeGreaterThanOrEqual(0);
    expect(classification.score).toBeLessThanOrEqual(100);

    // Should have valid risk level
    expect(Object.values(RiskLevel)).toContain(classification.riskLevel);

    // Should have valid processing recommendation
    expect(Object.values(ProcessingLevel)).toContain(classification.processingRecommendation);
  });
});
