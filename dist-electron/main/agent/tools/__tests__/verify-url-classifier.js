"use strict";
/**
 * Verification script for URLClassifier implementation
 * This script verifies that the URLClassifier meets all requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
const url_classifier_1 = require("../url-classifier");
const intelligent_site_selection_1 = require("../intelligent-site-selection");
// Test configuration
const config = {
    relevanceThreshold: 40,
    performanceMode: 'balanced',
    learningEnabled: true,
    cachingStrategy: intelligent_site_selection_1.CacheStrategy.BALANCED,
    loggingLevel: intelligent_site_selection_1.LoggingLevel.INFO,
    adaptiveWeights: true
};
const classifier = new url_classifier_1.URLClassifierImpl(config);
// Test context
const context = {
    taskDescription: 'Research pricing and features for project management tools',
    goals: ['Find pricing information', 'Identify key features'],
    keywords: ['pricing', 'features', 'project', 'management'],
    currentPhase: intelligent_site_selection_1.ResearchPhase.DISCOVERY,
    timeConstraints: { urgency: 'medium' },
    qualityRequirements: {
        minRelevanceScore: 40,
        requireMultipleSources: false,
        factVerificationLevel: 'basic'
    },
    previousFindings: []
};
console.log('=== URLClassifier Verification ===\n');
// Test 1: Pricing URL classification (Requirement 3.2)
console.log('Test 1: Pricing URL Classification (Requirement 3.2)');
const pricingUrl = 'https://example.com/pricing';
const pricingClassification = classifier.classifyURL(pricingUrl, context);
console.log(`URL: ${pricingUrl}`);
console.log(`Category: ${pricingClassification.category}`);
console.log(`Score: ${pricingClassification.score}`);
console.log(`Expected: category=pricing, score>60`);
console.log(`Result: ${pricingClassification.category === intelligent_site_selection_1.URLCategory.PRICING && pricingClassification.score > 60 ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 2: Features URL classification (Requirement 3.2)
console.log('Test 2: Features URL Classification (Requirement 3.2)');
const featuresUrl = 'https://example.com/features';
const featuresClassification = classifier.classifyURL(featuresUrl, context);
console.log(`URL: ${featuresUrl}`);
console.log(`Category: ${featuresClassification.category}`);
console.log(`Score: ${featuresClassification.score}`);
console.log(`Expected: category=features, score>55`);
console.log(`Result: ${featuresClassification.category === intelligent_site_selection_1.URLCategory.FEATURES && featuresClassification.score > 55 ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 3: Login URL penalization (Requirement 3.1)
console.log('Test 3: Login URL Penalization (Requirement 3.1)');
const loginUrl = 'https://example.com/login';
const loginClassification = classifier.classifyURL(loginUrl, context);
console.log(`URL: ${loginUrl}`);
console.log(`Category: ${loginClassification.category}`);
console.log(`Score: ${loginClassification.score}`);
console.log(`Expected: category=administrative, score<40`);
console.log(`Result: ${loginClassification.category === intelligent_site_selection_1.URLCategory.ADMINISTRATIVE && loginClassification.score < 40 ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 4: Privacy URL penalization (Requirement 3.1)
console.log('Test 4: Privacy URL Penalization (Requirement 3.1)');
const privacyUrl = 'https://example.com/privacy';
const privacyClassification = classifier.classifyURL(privacyUrl, context);
console.log(`URL: ${privacyUrl}`);
console.log(`Score: ${privacyClassification.score}`);
console.log(`Expected: score<40`);
console.log(`Result: ${privacyClassification.score < 40 ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 5: Keyword-based scoring adaptation (Requirement 3.5)
console.log('Test 5: Keyword-Based Scoring Adaptation (Requirement 3.5)');
const keywordUrl = 'https://example.com/project-management-pricing';
const keywordScore = classifier.generateURLScore(keywordUrl, context.keywords);
const nonKeywordUrl = 'https://example.com/random-page';
const nonKeywordScore = classifier.generateURLScore(nonKeywordUrl, context.keywords);
console.log(`Keyword URL: ${keywordUrl}, Score: ${keywordScore}`);
console.log(`Non-keyword URL: ${nonKeywordUrl}, Score: ${nonKeywordScore}`);
console.log(`Expected: keywordScore > nonKeywordScore`);
console.log(`Result: ${keywordScore > nonKeywordScore ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 6: Score consistency (Property 1)
console.log('Test 6: Score Consistency (Property 1)');
const testUrl = 'https://example.com/pricing';
const score1 = classifier.generateURLScore(testUrl, context.keywords);
const score2 = classifier.generateURLScore(testUrl, context.keywords);
const score3 = classifier.generateURLScore(testUrl, context.keywords);
console.log(`Score 1: ${score1}, Score 2: ${score2}, Score 3: ${score3}`);
console.log(`Expected: All scores equal`);
console.log(`Result: ${score1 === score2 && score2 === score3 ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 7: Media file penalization (Requirement 3.4)
console.log('Test 7: Media File Penalization (Requirement 3.4)');
const mediaUrl = 'https://example.com/image.jpg';
const mediaClassification = classifier.classifyURL(mediaUrl, context);
console.log(`URL: ${mediaUrl}`);
console.log(`Category: ${mediaClassification.category}`);
console.log(`Score: ${mediaClassification.score}`);
console.log(`Processing Recommendation: ${mediaClassification.processingRecommendation}`);
console.log(`Expected: category=media, score<30, recommendation=skip`);
console.log(`Result: ${mediaClassification.category === intelligent_site_selection_1.URLCategory.MEDIA && mediaClassification.score < 30 && mediaClassification.processingRecommendation === intelligent_site_selection_1.ProcessingLevel.SKIP ? '✓ PASS' : '✗ FAIL'}\n`);
// Test 8: Pattern matching
console.log('Test 8: Pattern Matching');
const complexUrl = 'https://example.com/pricing-features-login';
const complexClassification = classifier.classifyURL(complexUrl, context);
console.log(`URL: ${complexUrl}`);
console.log(`Patterns found: ${complexClassification.patterns.length}`);
console.log(`Patterns: ${complexClassification.patterns.map(p => p.pattern).join(', ')}`);
console.log(`Expected: Multiple patterns (positive and negative)`);
console.log(`Result: ${complexClassification.patterns.length > 1 ? '✓ PASS' : '✗ FAIL'}\n`);
console.log('=== Verification Complete ===');
