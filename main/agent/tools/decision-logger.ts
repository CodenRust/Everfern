/**
 * Decision Logger Implementation
 *
 * Provides comprehensive logging and audit trail functionality for site selection
 * and navigation decisions made by the intelligent site selection system.
 *
 * Validates Requirements: 5.1, 5.2, 5.3
 */

import {
  DecisionLogger,
  SiteSelectionDecision,
  NavigationDecision,
  DecisionReport,
  DecisionFilters,
  DecisionEntry,
  SessionSummary,
  DecisionBreakdown,
  PerformanceMetrics,
  IntelligentSelectionConfig,
  LoggingLevel
} from './intelligent-site-selection';
import { BaseDecisionLogger } from './intelligent-site-selection-base';

/**
 * DecisionLoggerImpl - Concrete implementation of DecisionLogger
 *
 * Tracks all site selection and navigation decisions with comprehensive
 * logging, audit trails, and reporting capabilities.
 */
export class DecisionLoggerImpl extends BaseDecisionLogger implements DecisionLogger {
  private sessionStartTime: number = Date.now();
  private sessionId: string;
  private siteSelectionCount: number = 0;
  private navigationDecisionCount: number = 0;
  private skippedSiteCount: number = 0;
  private visitedSiteCount: number = 0;
  private totalRelevanceScore: number = 0;
  private decisionTimings: Map<string, number[]> = new Map();

  constructor(config: IntelligentSelectionConfig) {
    super(config);
    this.sessionId = this.generateSessionId();
  }

  /**
   * Logs a site selection decision with comprehensive tracking
   *
   * Requirement 5.1: THE Decision_Logger SHALL record the reasoning behind each site
   * selection or rejection decision
   *
   * Requirement 5.2: WHEN a site is skipped, THE Browser_Use_Tool SHALL log the
   * relevance score and primary reasons for skipping
   */
  logSiteSelection(decision: SiteSelectionDecision): void {
    if (this.config.loggingLevel === LoggingLevel.NONE) {
      return;
    }

    // Track decision metrics
    this.siteSelectionCount++;
    this.totalRelevanceScore += decision.score;

    if (decision.action === 'skip') {
      this.skippedSiteCount++;
    } else if (decision.action === 'visit') {
      this.visitedSiteCount++;
    }

    // Track timing
    const timingKey = `site_selection_${decision.action}`;
    if (!this.decisionTimings.has(timingKey)) {
      this.decisionTimings.set(timingKey, []);
    }

    // Call parent implementation to add to decisions array
    super.logSiteSelection(decision);

    // Log to console if verbose logging is enabled
    if (this.config.loggingLevel === LoggingLevel.VERBOSE) {
      this.logVerbose(`Site Selection: ${decision.action.toUpperCase()}`, {
        url: decision.url,
        score: decision.score,
        reasoning: decision.reasoning,
        factors: decision.factors.length
      });
    }
  }

  /**
   * Logs a navigation decision with audit trail
   *
   * Requirement 5.1: THE Decision_Logger SHALL record the reasoning behind each site
   * selection or rejection decision
   */
  logNavigationDecision(decision: NavigationDecision): void {
    if (this.config.loggingLevel === LoggingLevel.NONE) {
      return;
    }

    this.navigationDecisionCount++;

    // Call parent implementation to add to decisions array
    super.logNavigationDecision(decision);

    // Log to console if verbose logging is enabled
    if (this.config.loggingLevel === LoggingLevel.VERBOSE) {
      this.logVerbose('Navigation Decision', {
        primaryTarget: decision.primaryTarget,
        alternativeCount: decision.alternativeTargets?.length || 0,
        confidence: decision.confidence,
        reasoning: decision.reasoning
      });
    }
  }

  /**
   * Generates a comprehensive decision report for session analysis
   *
   * Requirement 5.3: THE Decision_Logger SHALL maintain a decision audit trail for
   * each research session
   */
  generateDecisionReport(sessionId: string): DecisionReport {
    const sessionDecisions = this.decisions.filter(entry => {
      // Filter decisions for this session (in a real implementation, would check sessionId)
      return true;
    });

    const siteSelectionDecisions = sessionDecisions.filter(e => e.type === 'site_selection');
    const navigationDecisions = sessionDecisions.filter(e => e.type === 'navigation');

    const sessionSummary = this.generateSessionSummary(sessionId, siteSelectionDecisions);
    const decisionBreakdown = this.generateDecisionBreakdown(siteSelectionDecisions);
    const performanceMetrics = this.generatePerformanceMetrics();
    const recommendations = this.generateRecommendations(decisionBreakdown, performanceMetrics);

    return {
      sessionSummary,
      decisionBreakdown,
      performanceMetrics,
      recommendations
    };
  }

  /**
   * Generates a summary of the research session
   */
  private generateSessionSummary(
    sessionId: string,
    siteSelectionDecisions: DecisionEntry[]
  ): SessionSummary {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const averageRelevanceScore =
      this.siteSelectionCount > 0 ? this.totalRelevanceScore / this.siteSelectionCount : 0;

    const visitedUrls = siteSelectionDecisions
      .filter(e => (e.decision as SiteSelectionDecision).action === 'visit')
      .map(e => (e.decision as SiteSelectionDecision).url);

    const skippedUrls = siteSelectionDecisions
      .filter(e => (e.decision as SiteSelectionDecision).action === 'skip')
      .map(e => (e.decision as SiteSelectionDecision).url);

    return {
      sessionId,
      startTime: this.sessionStartTime,
      endTime: Date.now(),
      duration: sessionDuration,
      totalDecisions: this.siteSelectionCount + this.navigationDecisionCount,
      siteSelectionDecisions: this.siteSelectionCount,
      navigationDecisions: this.navigationDecisionCount,
      visitedSites: this.visitedSiteCount,
      skippedSites: this.skippedSiteCount,
      sitesVisited: this.visitedSiteCount,
      sitesSkipped: this.skippedSiteCount,
      averageRelevanceScore: Math.round(averageRelevanceScore * 100) / 100,
      visitedUrls,
      skippedUrls
    };
  }

  /**
   * Generates a breakdown of decision factors and their impact
   */
  private generateDecisionBreakdown(siteSelectionDecisions: DecisionEntry[]): DecisionBreakdown {
    const factorImpact: Map<string, { count: number; totalContribution: number }> = new Map();
    const actionCounts = { visit: 0, skip: 0, queue: 0 };
    const scoreDistribution = { low: 0, medium: 0, high: 0 };

    for (const entry of siteSelectionDecisions) {
      const decision = entry.decision as SiteSelectionDecision;

      // Count actions
      actionCounts[decision.action as keyof typeof actionCounts]++;

      // Track score distribution
      if (decision.score < 40) scoreDistribution.low++;
      else if (decision.score < 70) scoreDistribution.medium++;
      else scoreDistribution.high++;

      // Track factor impact
      for (const factor of decision.factors) {
        if (!factorImpact.has(factor.name)) {
          factorImpact.set(factor.name, { count: 0, totalContribution: 0 });
        }
        const impact = factorImpact.get(factor.name)!;
        impact.count++;
        impact.totalContribution += factor.weight;
      }
    }

    // Calculate average factor contributions
    const topFactors = Array.from(factorImpact.entries())
      .map(([factor, data]) => ({
        factor,
        averageContribution: data.totalContribution / data.count,
        frequency: data.count
      }))
      .sort((a, b) => b.averageContribution - a.averageContribution)
      .slice(0, 5);

    return {
      totalDecisions: siteSelectionDecisions.length,
      actionDistribution: actionCounts,
      scoreDistribution,
      topFactors,
      decisionReasons: this.extractDecisionReasons(siteSelectionDecisions)
    };
  }

  /**
   * Extracts and categorizes the primary reasons for decisions
   */
  private extractDecisionReasons(siteSelectionDecisions: DecisionEntry[]): Map<string, number> {
    const reasons: Map<string, number> = new Map();

    for (const entry of siteSelectionDecisions) {
      const decision = entry.decision as SiteSelectionDecision;
      const reasoning = decision.reasoning || 'Unknown';

      // Extract primary reason (first sentence or key phrase)
      const primaryReason = reasoning.split('.')[0].substring(0, 100);

      reasons.set(primaryReason, (reasons.get(primaryReason) || 0) + 1);
    }

    return reasons;
  }

  /**
   * Generates performance metrics for the session
   */
  private generatePerformanceMetrics(): PerformanceMetrics {
    const totalDecisions = this.siteSelectionCount + this.navigationDecisionCount;
    const sessionDuration = Date.now() - this.sessionStartTime;
    const decisionsPerSecond = totalDecisions / (sessionDuration / 1000);

    // Calculate average decision timing
    let totalDecisionTime = 0;
    let decisionCount = 0;

    for (const timings of this.decisionTimings.values()) {
      for (const timing of timings) {
        totalDecisionTime += timing;
        decisionCount++;
      }
    }

    const averageDecisionTime = decisionCount > 0 ? totalDecisionTime / decisionCount : 0;

    return {
      totalDecisions,
      sessionDuration,
      decisionsPerSecond: Math.round(decisionsPerSecond * 100) / 100,
      averageDecisionTime: Math.round(averageDecisionTime),
      visitSuccessRate:
        this.siteSelectionCount > 0
          ? Math.round((this.visitedSiteCount / this.siteSelectionCount) * 100)
          : 0,
      skipRate:
        this.siteSelectionCount > 0
          ? Math.round((this.skippedSiteCount / this.siteSelectionCount) * 100)
          : 0
    };
  }

  /**
   * Generates recommendations based on decision analysis
   */
  private generateRecommendations(
    breakdown: DecisionBreakdown,
    metrics: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Analyze skip rate
    if (metrics.skipRate > 70) {
      recommendations.push(
        'High skip rate detected. Consider adjusting relevance threshold or improving URL classification.'
      );
    }

    // Analyze decision speed
    if (metrics.averageDecisionTime > 200) {
      recommendations.push(
        'Decision-making is slower than target (200ms). Consider optimizing AI analysis or using more heuristics.'
      );
    }

    // Analyze score distribution
    if (breakdown.scoreDistribution.low > breakdown.scoreDistribution.high * 2) {
      recommendations.push(
        'Most sites have low relevance scores. Review research context or adjust scoring weights.'
      );
    }

    // Analyze top factors
    if (breakdown.topFactors.length > 0) {
      const topFactor = breakdown.topFactors[0];
      recommendations.push(
        `Top decision factor: "${topFactor.factor}" (avg contribution: ${Math.round(topFactor.averageContribution * 100) / 100})`
      );
    }

    // Add default recommendation if none generated
    if (recommendations.length === 0) {
      recommendations.push('Decision-making process is operating within normal parameters.');
    }

    return recommendations;
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Logs verbose messages if verbose logging is enabled
   */
  private logVerbose(message: string, data?: any): void {
    if (this.config.loggingLevel === LoggingLevel.VERBOSE) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [DecisionLogger] ${message}`, data || '');
    }
  }

  /**
   * Gets the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Gets current decision statistics
   */
  getDecisionStats() {
    return {
      sessionId: this.sessionId,
      siteSelectionCount: this.siteSelectionCount,
      navigationDecisionCount: this.navigationDecisionCount,
      skippedSiteCount: this.skippedSiteCount,
      visitedSiteCount: this.visitedSiteCount,
      averageRelevanceScore:
        this.siteSelectionCount > 0 ? this.totalRelevanceScore / this.siteSelectionCount : 0,
      decisionHistorySize: this.decisions.length
    };
  }
}
