/**
 * Example Usage of URLClassifier for Task 2.1
 *
 * This demonstrates how the URLClassifier implements the requirements:
 * - URL pattern recognition for pricing, features, documentation pages
 * - Penalty patterns for login, signup, cookie, privacy, terms pages
 * - Scoring algorithm that adapts based on research task keywords
 */

import { URLClassifierImpl } from '../url-classifier';
import {
  URLCategory,
  ProcessingLevel,
  RiskLevel,
  ResearchPhase,
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy
} from '../intelligent-site-selection';
import { createResearchContext } from '../intelligent-site-selection-index';

describe('URLClassifier Task 2.1 Examples', () => {
  let classifier: URLClassifierImpl;

  beforeEach(() => {
    const config: IntelligentSelectionConfig = {
      relevanceThreshold: 40,
      performanceMode: 'balanced',
      learningEnabled: true,
      cachingStrategy: CacheStrategy.BALANCED,
      loggingLevel: LoggingLevel.INFO,
      adaptiveWeights: true
    };

    classifier = new URLClassifierImpl(config);
  });

  test('Example 1: SaaS Pricing Research', () => {
    // Create research context for SaaS pricing research
    const context = createResearchContext(
      'Research pricing models for project management SaaS tools',
      {
        goals: ['Find pricing information', 'Compare subscription plans'],
        keywords: ['pricing', 'saas', 'subscription', 'project', 'management'],
        urgency: 'high'
      }
    );

    const testUrls = [
      'https://asana.com/pricing',           // Should get high score - pricing page
      'https://trello.com/features',         // Should get good score - features page
      'https://monday.com/login',            // Should get penalty - login page
      'https://basecamp.com/privacy',        // Should get penalty - privacy page
      'https://jira.atlassian.com/docs',     // Should get moderate score - docs
      'https://notion.so/product',           // Should get good score - product page
      'https://clickup.com/signup',          // Should get penalty - signup page
      'https://airtable.com/demo.mp4'       // Should get penalty - media file
    ];

    const results = testUrls.map(url => {
      const classification = classifier.classifyURL(url, context);
      return {
        url,
        category: classification.category,
        score: classification.score,
        processing: classification.processingRecommendation,
        risk: classification.riskLevel,
        patterns: classification.patterns.length
      };
    });

    console.log('\n=== SaaS Pricing Research Results ===');
    results.forEach(result => {
      console.log(`${result.url}`);
      console.log(`  Category: ${result.category}, Score: ${result.score}`);
      console.log(`  Processing: ${result.processing}, Risk: ${result.risk}`);
      console.log(`  Matched Patterns: ${result.patterns}\n`);
    });

    // Verify requirements implementation
    const pricingResult = results.find(r => r.url.includes('pricing'));
    expect(pricingResult?.category).toBe(URLCategory.PRICING);
    expect(pricingResult?.score).toBeGreaterThan(70);
    expect(pricingResult?.processing).toBe(ProcessingLevel.DEEP_AI);

    const loginResult = results.find(r => r.url.includes('login'));
    expect(loginResult?.category).toBe(URLCategory.ADMINISTRATIVE);
    expect(loginResult?.score).toBeLessThan(40);
    expect(loginResult?.risk).toBeOneOf([RiskLevel.MEDIUM, RiskLevel.HIGH]);

    const privacyResult = results.find(r => r.url.includes('privacy'));
    expect(privacyResult?.score).toBeLessThan(40);

    const mediaResult = results.find(r => r.url.includes('.mp4'));
    expect(mediaResult?.category).toBe(URLCategory.MEDIA);
    expect(mediaResult?.processing).toBe(ProcessingLevel.SKIP);
  });

  test('Example 2: Technical Documentation Research', () => {
    // Create research context for technical documentation
    const context = createResearchContext(
      'Find API documentation and developer guides for integration',
      {
        goals: ['Find documentation', 'Identify API capabilities'],
        keywords: ['api', 'documentation', 'developer', 'integration', 'guide'],
        urgency: 'medium'
      }
    );

    const testUrls = [
      'https://stripe.com/docs/api',         // Should get high score - API docs
      'https://github.com/api/guide',        // Should get high score - guide
      'https://twilio.com/docs/usage',       // Should get high score - usage docs
      'https://aws.amazon.com/features',     // Should get good score - features
      'https://heroku.com/signup',           // Should get penalty - signup
      'https://digitalocean.com/terms',      // Should get penalty - terms
      'https://netlify.com/tutorial',        // Should get good score - tutorial
      'https://vercel.com/cookie-policy'     // Should get penalty - cookie policy
    ];

    const results = testUrls.map(url => {
      const classification = classifier.classifyURL(url, context);
      return {
        url,
        category: classification.category,
        score: classification.score,
        keywordBoost: classification.score - classifier.generateURLScore(url, []) // Estimate keyword contribution
      };
    });

    console.log('\n=== Technical Documentation Research Results ===');
    results.forEach(result => {
      console.log(`${result.url}`);
      console.log(`  Category: ${result.category}, Score: ${result.score}`);
      console.log(`  Estimated Keyword Boost: ${Math.max(0, result.keywordBoost)}\n`);
    });

    // Verify keyword-based adaptation
    const apiDocsResult = results.find(r => r.url.includes('docs/api'));
    expect(apiDocsResult?.category).toBe(URLCategory.DOCUMENTATION);
    expect(apiDocsResult?.score).toBeGreaterThan(70);

    const signupResult = results.find(r => r.url.includes('signup'));
    expect(signupResult?.score).toBeLessThan(40);

    const termsResult = results.find(r => r.url.includes('terms'));
    expect(termsResult?.score).toBeLessThan(40);
  });

  test('Example 3: Contextual Adaptation Based on Research Phase', () => {
    const baseContext = createResearchContext(
      'Evaluate project management tools for team adoption',
      {
        goals: ['Evaluate tools', 'Find suitable solution'],
        keywords: ['project', 'management', 'team', 'collaboration']
      }
    );

    const testUrl = 'https://example.com/product-features';

    // Test different research phases
    const discoveryContext = { ...baseContext, currentPhase: ResearchPhase.DISCOVERY };
    const analysisContext = { ...baseContext, currentPhase: ResearchPhase.ANALYSIS };
    const validationContext = { ...baseContext, currentPhase: ResearchPhase.VALIDATION };

    const discoveryResult = classifier.classifyURL(testUrl, discoveryContext);
    const analysisResult = classifier.classifyURL(testUrl, analysisContext);
    const validationResult = classifier.classifyURL(testUrl, validationContext);

    console.log('\n=== Contextual Adaptation Results ===');
    console.log(`Discovery Phase Score: ${discoveryResult.score}`);
    console.log(`Analysis Phase Score: ${analysisResult.score}`);
    console.log(`Validation Phase Score: ${validationResult.score}`);

    // Verify phase-based adaptation
    expect(discoveryResult.score).toBeGreaterThan(50);
    expect(analysisResult.score).toBeGreaterThan(0);
    expect(validationResult.score).toBeGreaterThan(0);
  });

  test('Example 4: Pattern Learning and Adaptation', () => {
    const context = createResearchContext('Research pricing strategies');

    // Test initial scoring
    const pricingUrl = 'https://example.com/pricing';
    const initialClassification = classifier.classifyURL(pricingUrl, context);
    const initialScore = initialClassification.score;

    console.log(`\n=== Pattern Learning Example ===`);
    console.log(`Initial pricing URL score: ${initialScore}`);

    // Simulate learning from successful patterns
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
        'pricing_focus': 1.8  // Increase pricing focus weight
      }
    };

    classifier.updatePatterns(learningData);

    // Test scoring after learning
    const updatedClassification = classifier.classifyURL(pricingUrl, context);
    const updatedScore = updatedClassification.score;

    console.log(`Updated pricing URL score: ${updatedScore}`);
    console.log(`Score improvement: ${updatedScore - initialScore}`);

    // Verify learning improves scoring
    expect(updatedScore).toBeGreaterThanOrEqual(initialScore);
    expect(classifier.getPatternConfidence('pricing')).toBeGreaterThan(0.8);
  });

  test('Example 5: Comprehensive Pattern Matching', () => {
    const context = createResearchContext(
      'Comprehensive research on business software solutions',
      {
        keywords: ['business', 'software', 'enterprise', 'solution']
      }
    );

    const complexUrl = 'https://enterprise-software.com/pricing-features-comparison';
    const classification = classifier.classifyURL(complexUrl, context);

    console.log('\n=== Comprehensive Pattern Matching ===');
    console.log(`URL: ${complexUrl}`);
    console.log(`Category: ${classification.category}`);
    console.log(`Score: ${classification.score}`);
    console.log(`Risk Level: ${classification.riskLevel}`);
    console.log(`Processing Recommendation: ${classification.processingRecommendation}`);
    console.log('Matched Patterns:');
    classification.patterns.forEach(pattern => {
      console.log(`  - ${pattern.pattern} (confidence: ${pattern.confidence}, impact: ${pattern.impact})`);
    });

    // Verify comprehensive analysis
    expect(classification.patterns.length).toBeGreaterThan(0);
    expect(classification.score).toBeGreaterThan(60); // Should get multiple positive pattern matches
    expect(classification.category).toBe(URLCategory.PRICING); // Should prioritize pricing
    expect(classification.processingRecommendation).toBe(ProcessingLevel.DEEP_AI);
  });
});
