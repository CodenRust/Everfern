/**
 * Unit Tests for DecisionLogger Implementation
 *
 * Tests comprehensive logging and audit trail functionality for site selection
 * and navigation decisions.
 */

import { DecisionLoggerImpl } from '../decision-logger';
import {
  IntelligentSelectionConfig,
  LoggingLevel,
  CacheStrategy,
  ResearchPhase,
  SiteSelectionDecision,
  NavigationDecision,
  DecisionFactor,
  RiskLevel
} from '../intelligent-site-selection';

describe('DecisionLogger', () => {
  let logger: DecisionLoggerImpl;
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

    logger = new DecisionLoggerImpl(config);
  });

  describe('Site Selection Logging', () => {
    test('should log site selection decisions with all required fields', () => {
      const decision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance score and matches pricing keywords',
        factors: [
          {
            factor: 'keyword_match',
            weight: 0.3,
            contribution: 25,
            explanation: 'URL contains pricing keyword'
          },
          {
            factor: 'url_pattern',
            weight: 0.4,
            contribution: 35,
            explanation: 'Matches pricing URL pattern'
          }
        ],
        context: {
          taskDescription: 'Research pricing',
          goals: ['Find pricing'],
          keywords: ['pricing'],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(decision);

      const history = logger.getDecisionHistory({});
      expect(history).toHaveLength(1);
      expect(history[0].decision).toEqual(decision);
      expect(history[0].type).toBe('site_selection');
    });

    test('should track skipped sites with reasoning', () => {
      const skippedDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/login',
        action: 'skip',
        score: 15,
        reasoning: 'Administrative page - login required',
        factors: [
          {
            factor: 'admin_pattern',
            weight: 0.5,
            contribution: -30,
            explanation: 'URL matches administrative pattern'
          }
        ],
        context: {
          taskDescription: 'Research pricing',
          goals: ['Find pricing'],
          keywords: ['pricing'],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(skippedDecision);

      const stats = logger.getDecisionStats();
      expect(stats.skippedSiteCount).toBe(1);
      expect(stats.visitedSiteCount).toBe(0);
    });

    test('should track visited sites separately from skipped sites', () => {
      const visitDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 80,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research pricing',
          goals: ['Find pricing'],
          keywords: ['pricing'],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      const skipDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/admin',
        action: 'skip',
        score: 20,
        reasoning: 'Low relevance',
        factors: [],
        context: {
          taskDescription: 'Research pricing',
          goals: ['Find pricing'],
          keywords: ['pricing'],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(visitDecision);
      logger.logSiteSelection(skipDecision);

      const stats = logger.getDecisionStats();
      expect(stats.visitedSiteCount).toBe(1);
      expect(stats.skippedSiteCount).toBe(1);
      expect(stats.siteSelectionCount).toBe(2);
    });

    test('should calculate average relevance score correctly', () => {
      const decisions: SiteSelectionDecision[] = [
        {
          timestamp: Date.now(),
          url: 'https://example.com/1',
          action: 'visit',
          score: 100,
          reasoning: 'High',
          factors: [],
          context: {
            taskDescription: 'Research',
            goals: [],
            keywords: [],
            currentPhase: ResearchPhase.DISCOVERY,
            timeConstraints: { urgency: 'medium' },
            qualityRequirements: {
              minRelevanceScore: 40,
              requireMultipleSources: false,
              factVerificationLevel: 'basic'
            },
            previousFindings: []
          }
        },
        {
          timestamp: Date.now(),
          url: 'https://example.com/2',
          action: 'visit',
          score: 80,
          reasoning: 'Medium',
          factors: [],
          context: {
            taskDescription: 'Research',
            goals: [],
            keywords: [],
            currentPhase: ResearchPhase.DISCOVERY,
            timeConstraints: { urgency: 'medium' },
            qualityRequirements: {
              minRelevanceScore: 40,
              requireMultipleSources: false,
              factVerificationLevel: 'basic'
            },
            previousFindings: []
          }
        },
        {
          timestamp: Date.now(),
          url: 'https://example.com/3',
          action: 'visit',
          score: 60,
          reasoning: 'Low',
          factors: [],
          context: {
            taskDescription: 'Research',
            goals: [],
            keywords: [],
            currentPhase: ResearchPhase.DISCOVERY,
            timeConstraints: { urgency: 'medium' },
            qualityRequirements: {
              minRelevanceScore: 40,
              requireMultipleSources: false,
              factVerificationLevel: 'basic'
            },
            previousFindings: []
          }
        }
      ];

      for (const decision of decisions) {
        logger.logSiteSelection(decision);
      }

      const stats = logger.getDecisionStats();
      expect(stats.averageRelevanceScore).toBe(80); // (100 + 80 + 60) / 3
    });
  });

  describe('Navigation Decision Logging', () => {
    test('should log navigation decisions with reasoning', () => {
      const navDecision: NavigationDecision = {
        primaryTarget: 'https://example.com/features',
        alternativeTargets: ['https://example.com/pricing', 'https://example.com/docs'],
        reasoning: 'Features page provides comprehensive feature list',
        confidence: 0.85
      };

      logger.logNavigationDecision(navDecision);

      const history = logger.getDecisionHistory({});
      expect(history).toHaveLength(1);
      expect(history[0].decision).toEqual(navDecision);
      expect(history[0].type).toBe('navigation');
    });

    test('should track navigation decision count', () => {
      const navDecision: NavigationDecision = {
        primaryTarget: 'https://example.com/features',
        alternativeTargets: [],
        reasoning: 'Navigate to features',
        confidence: 0.9
      };

      logger.logNavigationDecision(navDecision);
      logger.logNavigationDecision(navDecision);

      const stats = logger.getDecisionStats();
      expect(stats.navigationDecisionCount).toBe(2);
    });
  });

  describe('Decision Report Generation', () => {
    test('should generate comprehensive decision report', () => {
      // Log some decisions
      const siteDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance pricing page',
        factors: [
          {
            factor: 'keyword_match',
            weight: 0.5,
            contribution: 25,
            explanation: 'Contains pricing keyword'
          }
        ],
        context: {
          taskDescription: 'Research pricing',
          goals: ['Find pricing'],
          keywords: ['pricing'],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(siteDecision);

      const report = logger.generateDecisionReport(logger.getSessionId());

      expect(report).toBeDefined();
      expect(report.sessionSummary).toBeDefined();
      expect(report.decisionBreakdown).toBeDefined();
      expect(report.performanceMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should include session summary with timing information', () => {
      const siteDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(siteDecision);

      const report = logger.generateDecisionReport(logger.getSessionId());
      const summary = report.sessionSummary;

      expect(summary.sessionId).toBeDefined();
      expect(summary.startTime).toBeLessThanOrEqual(summary.endTime);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
      expect(summary.totalDecisions).toBe(1);
      expect(summary.siteSelectionDecisions).toBe(1);
      expect(summary.visitedSites).toBe(1);
      expect(summary.skippedSites).toBe(0);
    });

    test('should include decision breakdown with action distribution', () => {
      const visitDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      const skipDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/admin',
        action: 'skip',
        score: 20,
        reasoning: 'Low relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(visitDecision);
      logger.logSiteSelection(skipDecision);

      const report = logger.generateDecisionReport(logger.getSessionId());
      const breakdown = report.decisionBreakdown;

      expect(breakdown.actionDistribution.visit).toBe(1);
      expect(breakdown.actionDistribution.skip).toBe(1);
      expect(breakdown.totalDecisions).toBe(2);
    });

    test('should include performance metrics', () => {
      const siteDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(siteDecision);

      const report = logger.generateDecisionReport(logger.getSessionId());
      const metrics = report.performanceMetrics;

      expect(metrics.totalDecisions).toBe(1);
      expect(metrics.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.decisionsPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.visitSuccessRate).toBe(100);
      expect(metrics.skipRate).toBe(0);
    });

    test('should include recommendations based on analysis', () => {
      const siteDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [
          {
            factor: 'keyword_match',
            weight: 0.5,
            contribution: 25,
            explanation: 'Contains keyword'
          }
        ],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(siteDecision);

      const report = logger.generateDecisionReport(logger.getSessionId());

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Decision History Filtering', () => {
    test('should filter decisions by score range', () => {
      const highScoreDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/1',
        action: 'visit',
        score: 90,
        reasoning: 'High',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      const lowScoreDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/2',
        action: 'skip',
        score: 20,
        reasoning: 'Low',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(highScoreDecision);
      logger.logSiteSelection(lowScoreDecision);

      const highScoreHistory = logger.getDecisionHistory({ minScore: 80 });
      expect(highScoreHistory).toHaveLength(1);
      expect((highScoreHistory[0].decision as SiteSelectionDecision).score).toBe(90);

      const lowScoreHistory = logger.getDecisionHistory({ maxScore: 30 });
      expect(lowScoreHistory).toHaveLength(1);
      expect((lowScoreHistory[0].decision as SiteSelectionDecision).score).toBe(20);
    });

    test('should filter decisions by action type', () => {
      const visitDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/1',
        action: 'visit',
        score: 85,
        reasoning: 'Visit',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      const skipDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/2',
        action: 'skip',
        score: 20,
        reasoning: 'Skip',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(visitDecision);
      logger.logSiteSelection(skipDecision);

      const visitHistory = logger.getDecisionHistory({ actions: ['visit'] });
      expect(visitHistory).toHaveLength(1);
      expect((visitHistory[0].decision as SiteSelectionDecision).action).toBe('visit');

      const skipHistory = logger.getDecisionHistory({ actions: ['skip'] });
      expect(skipHistory).toHaveLength(1);
      expect((skipHistory[0].decision as SiteSelectionDecision).action).toBe('skip');
    });
  });

  describe('Logging Level Control', () => {
    test('should not log when logging level is NONE', () => {
      const noLogConfig = { ...config, loggingLevel: LoggingLevel.NONE };
      const noLogLogger = new DecisionLoggerImpl(noLogConfig);

      const decision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      noLogLogger.logSiteSelection(decision);

      const history = noLogLogger.getDecisionHistory({});
      expect(history).toHaveLength(0);
    });

    test('should log when logging level is INFO', () => {
      const infoConfig = { ...config, loggingLevel: LoggingLevel.INFO };
      const infoLogger = new DecisionLoggerImpl(infoConfig);

      const decision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      infoLogger.logSiteSelection(decision);

      const history = infoLogger.getDecisionHistory({});
      expect(history).toHaveLength(1);
    });
  });

  describe('Session Management', () => {
    test('should generate unique session IDs', () => {
      const logger1 = new DecisionLoggerImpl(config);
      const logger2 = new DecisionLoggerImpl(config);

      expect(logger1.getSessionId()).not.toBe(logger2.getSessionId());
    });

    test('should maintain session ID throughout logger lifetime', () => {
      const sessionId1 = logger.getSessionId();
      const sessionId2 = logger.getSessionId();

      expect(sessionId1).toBe(sessionId2);
    });
  });

  describe('Decision History Limits', () => {
    test('should maintain decision history size limit', () => {
      // Log more than 1000 decisions
      for (let i = 0; i < 1100; i++) {
        const decision: SiteSelectionDecision = {
          timestamp: Date.now(),
          url: `https://example.com/${i}`,
          action: 'visit',
          score: 50 + (i % 50),
          reasoning: `Decision ${i}`,
          factors: [],
          context: {
            taskDescription: 'Research',
            goals: [],
            keywords: [],
            currentPhase: ResearchPhase.DISCOVERY,
            timeConstraints: { urgency: 'medium' },
            qualityRequirements: {
              minRelevanceScore: 40,
              requireMultipleSources: false,
              factVerificationLevel: 'basic'
            },
            previousFindings: []
          }
        };

        logger.logSiteSelection(decision);
      }

      const history = logger.getDecisionHistory({});
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Decision Statistics', () => {
    test('should provide accurate decision statistics', () => {
      const visitDecision: SiteSelectionDecision = {
        timestamp: Date.now(),
        url: 'https://example.com/pricing',
        action: 'visit',
        score: 85,
        reasoning: 'High relevance',
        factors: [],
        context: {
          taskDescription: 'Research',
          goals: [],
          keywords: [],
          currentPhase: ResearchPhase.DISCOVERY,
          timeConstraints: { urgency: 'medium' },
          qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
          },
          previousFindings: []
        }
      };

      logger.logSiteSelection(visitDecision);

      const stats = logger.getDecisionStats();

      expect(stats.sessionId).toBeDefined();
      expect(stats.siteSelectionCount).toBe(1);
      expect(stats.navigationDecisionCount).toBe(0);
      expect(stats.visitedSiteCount).toBe(1);
      expect(stats.skippedSiteCount).toBe(0);
      expect(stats.averageRelevanceScore).toBe(85);
      expect(stats.decisionHistorySize).toBe(1);
    });
  });
});
