"use strict";
/**
 * Learning System for Intelligent Site Selection
 *
 * This module implements the learning system that enables the intelligent site selection
 * system to adapt and improve over time through pattern learning, feedback integration,
 * and adaptive weighting of scoring factors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningSystemImpl = exports.PerformanceTrackerImpl = exports.AdaptationEngineImpl = exports.FeedbackProcessorImpl = exports.PatternDatabaseImpl = void 0;
// ============================================================================
// Pattern Database Implementation
// ============================================================================
class PatternDatabaseImpl {
    patterns = new Map();
    patternsByType = new Map();
    getPatterns(type) {
        return this.patternsByType.get(type) || [];
    }
    addPattern(pattern) {
        const patternId = this.generatePatternId(pattern);
        this.patterns.set(patternId, pattern);
        if (!this.patternsByType.has(pattern.type)) {
            this.patternsByType.set(pattern.type, []);
        }
        this.patternsByType.get(pattern.type).push(pattern);
    }
    updatePattern(pattern) {
        const patternId = this.generatePatternId(pattern);
        const existing = this.patterns.get(patternId);
        if (existing) {
            // Update the pattern with new data
            const updated = {
                ...existing,
                ...pattern,
                lastUpdated: Date.now()
            };
            this.patterns.set(patternId, updated);
            // Update in type index
            const typePatterns = this.patternsByType.get(pattern.type) || [];
            const index = typePatterns.findIndex(p => this.generatePatternId(p) === patternId);
            if (index >= 0) {
                typePatterns[index] = updated;
            }
        }
        else {
            this.addPattern(pattern);
        }
    }
    removePattern(patternId) {
        const pattern = this.patterns.get(patternId);
        if (pattern) {
            this.patterns.delete(patternId);
            const typePatterns = this.patternsByType.get(pattern.type) || [];
            const index = typePatterns.findIndex(p => this.generatePatternId(p) === patternId);
            if (index >= 0) {
                typePatterns.splice(index, 1);
            }
        }
    }
    generatePatternId(pattern) {
        return `${pattern.type}:${pattern.pattern}`;
    }
    getAllPatterns() {
        return Array.from(this.patterns.values());
    }
    clearPatterns() {
        this.patterns.clear();
        this.patternsByType.clear();
    }
}
exports.PatternDatabaseImpl = PatternDatabaseImpl;
// ============================================================================
// Feedback Processor Implementation
// ============================================================================
class FeedbackProcessorImpl {
    feedbackHistory = [];
    currentWeights;
    config;
    constructor(config) {
        this.config = config;
        this.currentWeights = this.getDefaultWeights();
    }
    processFeedback(feedback) {
        if (!this.config.learningEnabled) {
            return;
        }
        this.feedbackHistory.push(feedback);
        // Keep only recent feedback to avoid memory issues
        if (this.feedbackHistory.length > 1000) {
            this.feedbackHistory = this.feedbackHistory.slice(-1000);
        }
        // Update weights based on feedback
        this.updateWeightsFromFeedback(feedback);
    }
    generateLearningData() {
        const patterns = this.extractPatterns();
        const outcomes = this.extractOutcomes();
        const feedback = [...this.feedbackHistory];
        return {
            patterns,
            outcomes,
            feedback,
            weights: this.currentWeights
        };
    }
    updateWeights(weights) {
        this.currentWeights = weights;
    }
    getCurrentWeights() {
        return { ...this.currentWeights };
    }
    updateWeightsFromFeedback(feedback) {
        if (feedback.outcomes.length === 0) {
            return;
        }
        // Calculate average user value from outcomes
        const avgUserValue = feedback.outcomes.reduce((sum, o) => sum + o.userValue, 0) / feedback.outcomes.length;
        // Adjust weights based on user rating and outcomes
        const adjustmentFactor = (feedback.userRating / 5) * 0.1; // Max 10% adjustment
        // Increase weights for factors that contributed to high-value outcomes
        if (avgUserValue > 0.7) {
            this.currentWeights.contentQuality += adjustmentFactor;
            this.currentWeights.informationDensity += adjustmentFactor;
            this.currentWeights.contextualFit += adjustmentFactor;
        }
        // Decrease weights for factors that led to low-value outcomes
        if (avgUserValue < 0.3) {
            this.currentWeights.urlPatterns -= adjustmentFactor;
            this.currentWeights.userSignals -= adjustmentFactor;
        }
        // Normalize weights to sum to 1
        this.normalizeWeights();
    }
    extractPatterns() {
        const patterns = [];
        const patternMap = new Map();
        for (const feedback of this.feedbackHistory) {
            for (const decision of feedback.decisions) {
                const patternKey = `${decision.url}:${decision.score}`;
                const outcome = feedback.outcomes.find(o => o.url === decision.url);
                if (outcome) {
                    const current = patternMap.get(patternKey) || { successes: 0, total: 0 };
                    current.total++;
                    if (outcome.userValue > 0.6) {
                        current.successes++;
                    }
                    patternMap.set(patternKey, current);
                }
            }
        }
        // Convert to Pattern objects
        for (const [key, stats] of patternMap.entries()) {
            const successRate = stats.total > 0 ? stats.successes / stats.total : 0;
            patterns.push({
                type: 'url_pattern',
                pattern: key,
                confidence: Math.min(1, stats.total / 10), // Confidence increases with sample size
                successRate,
                lastUpdated: Date.now()
            });
        }
        return patterns;
    }
    extractOutcomes() {
        const outcomes = [];
        for (const feedback of this.feedbackHistory) {
            outcomes.push(...feedback.outcomes);
        }
        return outcomes;
    }
    normalizeWeights() {
        const sum = Object.values(this.currentWeights).reduce((a, b) => a + b, 0);
        if (sum > 0) {
            for (const key in this.currentWeights) {
                this.currentWeights[key] /= sum;
            }
        }
    }
    getDefaultWeights() {
        return {
            keywordMatch: 0.15,
            urlPatterns: 0.15,
            contentQuality: 0.2,
            informationDensity: 0.15,
            contextualFit: 0.15,
            uniqueness: 0.1,
            structuredData: 0.05,
            userSignals: 0.05
        };
    }
    getFeedbackHistory() {
        return [...this.feedbackHistory];
    }
    clearFeedback() {
        this.feedbackHistory = [];
    }
}
exports.FeedbackProcessorImpl = FeedbackProcessorImpl;
// ============================================================================
// Adaptation Engine Implementation
// ============================================================================
class AdaptationEngineImpl {
    contextHistory = [];
    strategyAdjustments = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    adaptToContext(context) {
        this.contextHistory.push(context);
        // Keep only recent context history
        if (this.contextHistory.length > 100) {
            this.contextHistory = this.contextHistory.slice(-100);
        }
        // Analyze context patterns
        this.analyzeContextPatterns();
    }
    optimizePerformance(metrics) {
        if (!this.config.adaptiveWeights) {
            return;
        }
        // Adjust performance based on metrics
        if (metrics.averageDecisionTime > 200) {
            // Decision time is too high, switch to faster mode
            this.strategyAdjustments.set('performance_mode', 0); // Fast mode
        }
        else if (metrics.averageDecisionTime < 50) {
            // Decision time is very fast, can afford more thorough analysis
            this.strategyAdjustments.set('performance_mode', 2); // Thorough mode
        }
        else {
            // Balanced mode
            this.strategyAdjustments.set('performance_mode', 1);
        }
        // Optimize cache strategy based on hit rate
        const cacheHitRate = metrics.aiCallsCount ? 0.5 : 0; // Placeholder calculation
        if (cacheHitRate > 0.8) {
            this.strategyAdjustments.set('cache_strategy', 1); // Aggressive caching
        }
        else if (cacheHitRate < 0.3) {
            this.strategyAdjustments.set('cache_strategy', 0); // Conservative caching
        }
    }
    updateStrategies(outcomes) {
        if (outcomes.length === 0) {
            return;
        }
        // Calculate average value
        const avgValue = outcomes.reduce((sum, o) => o.userValue, 0) / outcomes.length;
        // Identify high-value patterns
        const highValueOutcomes = outcomes.filter(o => o.userValue > 0.7);
        const lowValueOutcomes = outcomes.filter(o => o.userValue < 0.3);
        // Adjust strategies based on patterns
        if (highValueOutcomes.length > lowValueOutcomes.length) {
            this.strategyAdjustments.set('strategy_confidence', 1); // Increase confidence
        }
        else if (lowValueOutcomes.length > highValueOutcomes.length) {
            this.strategyAdjustments.set('strategy_confidence', -1); // Decrease confidence
        }
    }
    getStrategyAdjustments() {
        return new Map(this.strategyAdjustments);
    }
    clearHistory() {
        this.contextHistory = [];
        this.strategyAdjustments.clear();
    }
    analyzeContextPatterns() {
        if (this.contextHistory.length < 2) {
            return;
        }
        // Analyze patterns in research contexts
        const recentContexts = this.contextHistory.slice(-10);
        const commonKeywords = this.extractCommonKeywords(recentContexts);
        // Store common patterns for future optimization
        for (const keyword of commonKeywords) {
            const current = this.strategyAdjustments.get(`keyword_${keyword}`) || 0;
            this.strategyAdjustments.set(`keyword_${keyword}`, current + 1);
        }
    }
    extractCommonKeywords(contexts) {
        const keywordCounts = new Map();
        for (const context of contexts) {
            for (const keyword of context.keywords) {
                const count = keywordCounts.get(keyword) || 0;
                keywordCounts.set(keyword, count + 1);
            }
        }
        // Return keywords that appear in multiple contexts
        return Array.from(keywordCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([keyword, _]) => keyword);
    }
}
exports.AdaptationEngineImpl = AdaptationEngineImpl;
// ============================================================================
// Performance Tracker Implementation
// ============================================================================
class PerformanceTrackerImpl {
    decisionTimes = new Map();
    cacheStats = { hits: 0, misses: 0 };
    outcomes = [];
    config;
    constructor(config) {
        this.config = config;
    }
    trackDecisionTime(operation, duration) {
        if (!this.decisionTimes.has(operation)) {
            this.decisionTimes.set(operation, []);
        }
        this.decisionTimes.get(operation).push(duration);
        // Keep only recent measurements
        const times = this.decisionTimes.get(operation);
        if (times.length > 100) {
            times.shift();
        }
    }
    trackCachePerformance(hits, misses) {
        this.cacheStats.hits += hits;
        this.cacheStats.misses += misses;
    }
    trackResearchOutcome(outcome) {
        this.outcomes.push(outcome);
        // Keep only recent outcomes
        if (this.outcomes.length > 1000) {
            this.outcomes = this.outcomes.slice(-1000);
        }
    }
    getMetrics() {
        const avgDecisionTime = this.calculateAverageDecisionTime();
        const aiCallsCount = this.countAICalls();
        const totalProcessingTime = this.calculateTotalProcessingTime();
        return {
            totalDecisions: this.decisionTimes.size,
            sessionDuration: totalProcessingTime,
            decisionsPerSecond: totalProcessingTime > 0 ? this.decisionTimes.size / (totalProcessingTime / 1000) : 0,
            averageDecisionTime: avgDecisionTime,
            visitSuccessRate: 0.7,
            skipRate: 0.3,
            aiCallsCount,
            totalProcessingTime
        };
    }
    calculateAverageDecisionTime() {
        let totalTime = 0;
        let totalCount = 0;
        for (const times of this.decisionTimes.values()) {
            totalTime += times.reduce((a, b) => a + b, 0);
            totalCount += times.length;
        }
        return totalCount > 0 ? totalTime / totalCount : 0;
    }
    calculateCacheHitRate() {
        const total = this.cacheStats.hits + this.cacheStats.misses;
        return total > 0 ? this.cacheStats.hits / total : 0;
    }
    countAICalls() {
        // Count operations that likely involve AI calls
        const aiOperations = ['deep_analysis', 'relevance_assessment', 'navigation_reasoning'];
        let count = 0;
        for (const [operation, times] of this.decisionTimes.entries()) {
            if (aiOperations.some(op => operation.includes(op))) {
                count += times.length;
            }
        }
        return count;
    }
    calculateTotalProcessingTime() {
        let total = 0;
        for (const times of this.decisionTimes.values()) {
            total += times.reduce((a, b) => a + b, 0);
        }
        return total;
    }
    getOutcomes() {
        return [...this.outcomes];
    }
    clearMetrics() {
        this.decisionTimes.clear();
        this.cacheStats = { hits: 0, misses: 0 };
        this.outcomes = [];
    }
}
exports.PerformanceTrackerImpl = PerformanceTrackerImpl;
// ============================================================================
// Main Learning System Implementation
// ============================================================================
class LearningSystemImpl {
    patternDatabase;
    feedbackProcessor;
    adaptationEngine;
    performanceTracker;
    config;
    constructor(config) {
        this.config = config;
        this.patternDatabase = new PatternDatabaseImpl();
        this.feedbackProcessor = new FeedbackProcessorImpl(config);
        this.adaptationEngine = new AdaptationEngineImpl(config);
        this.performanceTracker = new PerformanceTrackerImpl(config);
    }
    /**
     * Process a research session and extract learning data
     */
    processSession(feedback) {
        this.feedbackProcessor.processFeedback(feedback);
        this.adaptationEngine.updateStrategies(feedback.outcomes);
    }
    /**
     * Get current learning data for weight adaptation
     */
    getLearningData() {
        return this.feedbackProcessor.generateLearningData();
    }
    /**
     * Update scoring weights based on learning data
     */
    updateWeights(weights) {
        this.feedbackProcessor.updateWeights(weights);
    }
    /**
     * Get current scoring weights
     */
    getCurrentWeights() {
        return this.feedbackProcessor.getCurrentWeights();
    }
    /**
     * Adapt to a new research context
     */
    adaptToContext(context) {
        this.adaptationEngine.adaptToContext(context);
    }
    /**
     * Optimize based on performance metrics
     */
    optimizePerformance(metrics) {
        this.adaptationEngine.optimizePerformance(metrics);
    }
    /**
     * Get current performance metrics
     */
    getPerformanceMetrics() {
        return this.performanceTracker.getMetrics();
    }
    /**
     * Track a decision time
     */
    trackDecisionTime(operation, duration) {
        this.performanceTracker.trackDecisionTime(operation, duration);
    }
    /**
     * Track cache performance
     */
    trackCachePerformance(hits, misses) {
        this.performanceTracker.trackCachePerformance(hits, misses);
    }
    /**
     * Track a research outcome
     */
    trackOutcome(outcome) {
        this.performanceTracker.trackResearchOutcome(outcome);
    }
    /**
     * Get strategy adjustments from adaptation engine
     */
    getStrategyAdjustments() {
        return this.adaptationEngine.getStrategyAdjustments();
    }
    /**
     * Clear all learning data
     */
    clearLearningData() {
        this.patternDatabase.clearPatterns();
        this.feedbackProcessor.clearFeedback();
        this.adaptationEngine.clearHistory();
        this.performanceTracker.clearMetrics();
    }
}
exports.LearningSystemImpl = LearningSystemImpl;
