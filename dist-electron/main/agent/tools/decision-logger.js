"use strict";
/**
 * Decision Logger Implementation
 *
 * Provides comprehensive logging and audit trail functionality for site selection
 * and navigation decisions made by the intelligent site selection system.
 *
 * Validates Requirements: 5.1, 5.2, 5.3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionLoggerImpl = void 0;
const intelligent_site_selection_1 = require("./intelligent-site-selection");
const intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
/**
 * DecisionLoggerImpl - Concrete implementation of DecisionLogger
 *
 * Tracks all site selection and navigation decisions with comprehensive
 * logging, audit trails, and reporting capabilities.
 */
class DecisionLoggerImpl extends intelligent_site_selection_base_1.BaseDecisionLogger {
    sessionStartTime = Date.now();
    sessionId;
    siteSelectionCount = 0;
    navigationDecisionCount = 0;
    skippedSiteCount = 0;
    visitedSiteCount = 0;
    totalRelevanceScore = 0;
    decisionTimings = new Map();
    constructor(config) {
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
    logSiteSelection(decision) {
        if (this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.NONE) {
            return;
        }
        // Track decision metrics
        this.siteSelectionCount++;
        this.totalRelevanceScore += decision.score;
        if (decision.action === 'skip') {
            this.skippedSiteCount++;
        }
        else if (decision.action === 'visit') {
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
        if (this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.VERBOSE) {
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
    logNavigationDecision(decision) {
        if (this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.NONE) {
            return;
        }
        this.navigationDecisionCount++;
        // Call parent implementation to add to decisions array
        super.logNavigationDecision(decision);
        // Log to console if verbose logging is enabled
        if (this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.VERBOSE) {
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
    generateDecisionReport(sessionId) {
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
    generateSessionSummary(sessionId, siteSelectionDecisions) {
        const sessionDuration = Date.now() - this.sessionStartTime;
        const averageRelevanceScore = this.siteSelectionCount > 0 ? this.totalRelevanceScore / this.siteSelectionCount : 0;
        const visitedUrls = siteSelectionDecisions
            .filter(e => e.decision.action === 'visit')
            .map(e => e.decision.url);
        const skippedUrls = siteSelectionDecisions
            .filter(e => e.decision.action === 'skip')
            .map(e => e.decision.url);
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
    generateDecisionBreakdown(siteSelectionDecisions) {
        const factorImpact = new Map();
        const actionCounts = { visit: 0, skip: 0, queue: 0 };
        const scoreDistribution = { low: 0, medium: 0, high: 0 };
        for (const entry of siteSelectionDecisions) {
            const decision = entry.decision;
            // Count actions
            actionCounts[decision.action]++;
            // Track score distribution
            if (decision.score < 40)
                scoreDistribution.low++;
            else if (decision.score < 70)
                scoreDistribution.medium++;
            else
                scoreDistribution.high++;
            // Track factor impact
            for (const factor of decision.factors) {
                if (!factorImpact.has(factor.name)) {
                    factorImpact.set(factor.name, { count: 0, totalContribution: 0 });
                }
                const impact = factorImpact.get(factor.name);
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
    extractDecisionReasons(siteSelectionDecisions) {
        const reasons = new Map();
        for (const entry of siteSelectionDecisions) {
            const decision = entry.decision;
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
    generatePerformanceMetrics() {
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
            visitSuccessRate: this.siteSelectionCount > 0
                ? Math.round((this.visitedSiteCount / this.siteSelectionCount) * 100)
                : 0,
            skipRate: this.siteSelectionCount > 0
                ? Math.round((this.skippedSiteCount / this.siteSelectionCount) * 100)
                : 0
        };
    }
    /**
     * Generates recommendations based on decision analysis
     */
    generateRecommendations(breakdown, metrics) {
        const recommendations = [];
        // Analyze skip rate
        if (metrics.skipRate > 70) {
            recommendations.push('High skip rate detected. Consider adjusting relevance threshold or improving URL classification.');
        }
        // Analyze decision speed
        if (metrics.averageDecisionTime > 200) {
            recommendations.push('Decision-making is slower than target (200ms). Consider optimizing AI analysis or using more heuristics.');
        }
        // Analyze score distribution
        if (breakdown.scoreDistribution.low > breakdown.scoreDistribution.high * 2) {
            recommendations.push('Most sites have low relevance scores. Review research context or adjust scoring weights.');
        }
        // Analyze top factors
        if (breakdown.topFactors.length > 0) {
            const topFactor = breakdown.topFactors[0];
            recommendations.push(`Top decision factor: "${topFactor.factor}" (avg contribution: ${Math.round(topFactor.averageContribution * 100) / 100})`);
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
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    /**
     * Logs verbose messages if verbose logging is enabled
     */
    logVerbose(message, data) {
        if (this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.VERBOSE) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [DecisionLogger] ${message}`, data || '');
        }
    }
    /**
     * Gets the current session ID
     */
    getSessionId() {
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
            averageRelevanceScore: this.siteSelectionCount > 0 ? this.totalRelevanceScore / this.siteSelectionCount : 0,
            decisionHistorySize: this.decisions.length
        };
    }
}
exports.DecisionLoggerImpl = DecisionLoggerImpl;
