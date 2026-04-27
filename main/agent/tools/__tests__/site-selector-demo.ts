/**
 * Demonstration of SiteSelector functionality
 *
 * This script shows how the SiteSelector evaluates and ranks URLs
 * for intelligent site selection in browser-use research tasks.
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

// Mock AIClient for demo
const mockAIClient = {
  chat: async () => ({ content: 'Mock response' }),
  complete: async () => 'Mock completion'
} as unknown as AIClient;

async function demonstrateSiteSelector() {
  console.log('🔍 SiteSelector Demonstration\n');

  // Configuration
  const config: IntelligentSelectionConfig = {
    relevanceThreshold: 40,
    performanceMode: 'balanced',
    learningEnabled: true,
    cachingStrategy: CacheStrategy.BALANCED,
    loggingLevel: LoggingLevel.INFO,
    adaptiveWeights: true
  };

  // Create components
  const urlClassifier = new URLClassifierImpl(config);
  const siteSelector = new SiteSelectorImpl(mockAIClient, config, urlClassifier);

  // Research context
  const context: ResearchContext = {
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

  // Test URLs representing different types of pages
  const testUrls = [
    'https://asana.com/pricing',                    // High value - pricing page
    'https://trello.com/features',                  // High value - features page
    'https://monday.com/product',                   // Medium value - product page
    'https://notion.so/help',                       // Medium value - help page
    'https://clickup.com/login',                    // Low value - login page
    'https://basecamp.com/privacy',                 // Low value - privacy page
    'https://github.com/project-management-tool',   // Medium-high value - authoritative domain
    'https://suspicious-site.tk/pricing'            // Low value - suspicious domain
  ];

  console.log('📋 Test URLs:');
  testUrls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  console.log();

  // Evaluate each URL
  console.log('🎯 Individual Site Evaluations:\n');

  const evaluations: any[] = [];
  for (const url of testUrls) {
    const evaluation = await siteSelector.evaluateSite(url, context);
    evaluations.push(evaluation);

    console.log(`URL: ${url}`);
    console.log(`  Score: ${evaluation.relevanceScore.toFixed(1)}/100`);
    console.log(`  Confidence: ${(evaluation.confidenceLevel * 100).toFixed(1)}%`);
    console.log(`  Risk: ${evaluation.riskAssessment}`);
    console.log(`  Should Visit: ${siteSelector.shouldVisitSite(evaluation) ? '✅ Yes' : '❌ No'}`);

    // Show top 3 reasoning factors
    const topFactors = evaluation.reasoningFactors
      .sort((a, b) => (b.weight * b.contribution) - (a.weight * a.contribution))
      .slice(0, 3);

    console.log('  Top Factors:');
    topFactors.forEach(factor => {
      const impact = (factor.weight * factor.contribution * 100).toFixed(1);
      console.log(`    - ${factor.factor}: ${impact}% impact`);
    });
    console.log();
  }

  // Rank all URLs
  console.log('🏆 Site Rankings:\n');
  const rankedSites = await siteSelector.rankSites(testUrls, context);

  rankedSites.forEach(site => {
    const shouldVisit = evaluations.find(e => e.url === site.url);
    const visitStatus = shouldVisit && siteSelector.shouldVisitSite(shouldVisit) ? '✅' : '❌';

    console.log(`${site.rank}. ${visitStatus} ${site.url}`);
    console.log(`   Score: ${site.score.toFixed(1)}/100`);
    console.log(`   ${site.reasoning}`);
    console.log();
  });

  // Demonstrate threshold filtering
  console.log('🚦 Threshold-Based Filtering:\n');
  const sitesToVisit = evaluations.filter(e => siteSelector.shouldVisitSite(e));
  const sitesToSkip = evaluations.filter(e => !siteSelector.shouldVisitSite(e));

  console.log(`✅ Sites to Visit (${sitesToVisit.length}):`);
  sitesToVisit.forEach(site => {
    console.log(`  - ${site.url} (Score: ${site.relevanceScore.toFixed(1)})`);
  });

  console.log(`\n❌ Sites to Skip (${sitesToSkip.length}):`);
  sitesToSkip.forEach(site => {
    console.log(`  - ${site.url} (Score: ${site.relevanceScore.toFixed(1)}, Risk: ${site.riskAssessment})`);
  });

  // Performance summary
  console.log('\n⚡ Performance Summary:');
  console.log(`  - Evaluated ${testUrls.length} URLs`);
  console.log(`  - Threshold: ${config.relevanceThreshold}/100`);
  console.log(`  - Sites above threshold: ${sitesToVisit.length}`);
  console.log(`  - Sites below threshold: ${sitesToSkip.length}`);
  console.log(`  - Efficiency: ${((sitesToVisit.length / testUrls.length) * 100).toFixed(1)}% of sites worth visiting`);

  console.log('\n✨ Demonstration Complete!');
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateSiteSelector().catch(console.error);
}

export { demonstrateSiteSelector };
