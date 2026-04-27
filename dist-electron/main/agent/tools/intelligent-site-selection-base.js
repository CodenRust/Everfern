"use strict";
/**
 * Base Classes for Intelligent Site Selection Components
 *
 * This module provides base implementations for the intelligent site selection system,
 * offering default behavior and common functionality that can be extended by specific implementations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INTELLIGENT_CONFIG = exports.BaseDecisionLogger = exports.BaseURLClassifier = exports.BaseContentAnalyzer = exports.BaseNavigationReasoner = exports.BaseRelevanceEngine = exports.BaseSiteSelector = void 0;
exports.createDefaultResearchContext = createDefaultResearchContext;
const intelligent_site_selection_1 = require("./intelligent-site-selection");
// ============================================================================
// Base Site Selector Implementation
// ============================================================================
class BaseSiteSelector {
    config;
    aiClient;
    constructor(aiClient, config) {
        this.aiClient = aiClient;
        this.config = config;
    }
    shouldVisitSite(evaluation) {
        return evaluation.relevanceScore >= this.config.relevanceThreshold;
    }
    updateSelectionStrategy(feedback) {
        if (this.config.learningEnabled) {
            this.processSelectionFeedback(feedback);
        }
    }
    createReasoningFactor(factor, weight, contribution, explanation) {
        return { factor, weight, contribution, explanation };
    }
    assessRisk(url, score) {
        if (score < 20)
            return intelligent_site_selection_1.RiskLevel.HIGH;
        if (score < 50)
            return intelligent_site_selection_1.RiskLevel.MEDIUM;
        return intelligent_site_selection_1.RiskLevel.LOW;
    }
}
exports.BaseSiteSelector = BaseSiteSelector;
// ============================================================================
// Base Relevance Engine Implementation
// ============================================================================
class BaseRelevanceEngine {
    aiClient;
    config;
    cache = new Map();
    constructor(aiClient, config) {
        this.aiClient = aiClient;
        this.config = config;
    }
    getCachedAssessment(contentHash) {
        return this.cache.get(contentHash) || null;
    }
    setCachedAssessment(contentHash, assessment) {
        this.cache.set(contentHash, assessment);
    }
    generateContentHash(content, context) {
        const contentStr = `${content.title}|${content.url}|${content.text?.substring(0, 500)}`;
        const contextStr = `${context.taskDescription}|${context.keywords.join(',')}`;
        return Buffer.from(contentStr + contextStr).toString('base64').substring(0, 32);
    }
}
exports.BaseRelevanceEngine = BaseRelevanceEngine;
// ============================================================================
// Base Navigation Reasoner Implementation
// ============================================================================
class BaseNavigationReasoner {
    aiClient;
    config;
    constructor(aiClient, config) {
        this.aiClient = aiClient;
        this.config = config;
    }
    generateNavigationStrategy(goals, constraints) {
        return {
            approach: this.determineApproach(goals, constraints),
            maxDepth: Math.min(constraints.maxPages / 2, 5),
            parallelism: this.config.performanceMode === 'fast' ? 3 : 2,
            focusAreas: this.extractFocusAreas(goals)
        };
    }
}
exports.BaseNavigationReasoner = BaseNavigationReasoner;
// ============================================================================
// Base Content Analyzer Implementation
// ============================================================================
class BaseContentAnalyzer {
    aiClient;
    config;
    constructor(aiClient, config) {
        this.aiClient = aiClient;
        this.config = config;
    }
    assessContentQuality(content) {
        const textLength = content.text?.length || 0;
        const hasTitle = !!content.title;
        const hasStructure = this.hasStructuredContent(content);
        return {
            readability: this.calculateReadability(content.text || ''),
            completeness: hasTitle && textLength > 500 ? 0.8 : 0.4,
            accuracy: 0.7, // Default assumption, would need external validation
            freshness: 0.6, // Default assumption, would need date analysis
            authority: hasStructure ? 0.7 : 0.5
        };
    }
    hasStructuredContent(content) {
        const text = content.text || '';
        return text.includes('$') || // Pricing indicators
            text.includes('•') || // Bullet points
            text.includes('\n\n') || // Paragraphs
            !!content.title;
    }
    calculateReadability(text) {
        if (!text)
            return 0;
        const sentences = text.split(/[.!?]+/).length;
        const words = text.split(/\s+/).length;
        const avgWordsPerSentence = words / Math.max(sentences, 1);
        // Simple readability score (lower is better, normalize to 0-1)
        return Math.max(0, Math.min(1, 1 - (avgWordsPerSentence - 15) / 20));
    }
    determineContentType(content) {
        const text = (content.text || '').toLowerCase();
        const url = content.url.toLowerCase();
        const title = (content.title || '').toLowerCase();
        if (url.includes('pricing') || text.includes('$') || text.includes('price')) {
            return intelligent_site_selection_1.ContentType.PRICING;
        }
        if (url.includes('features') || title.includes('features')) {
            return intelligent_site_selection_1.ContentType.FEATURES;
        }
        if (url.includes('docs') || url.includes('documentation')) {
            return intelligent_site_selection_1.ContentType.DOCUMENTATION;
        }
        if (url.includes('review') || text.includes('rating')) {
            return intelligent_site_selection_1.ContentType.REVIEWS;
        }
        if (url.includes('product') || title.includes('product')) {
            return intelligent_site_selection_1.ContentType.PRODUCT;
        }
        if (url.includes('admin') || url.includes('login') || url.includes('signup')) {
            return intelligent_site_selection_1.ContentType.ADMINISTRATIVE;
        }
        if (url.match(/\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/)) {
            return intelligent_site_selection_1.ContentType.MEDIA;
        }
        return intelligent_site_selection_1.ContentType.IRRELEVANT;
    }
}
exports.BaseContentAnalyzer = BaseContentAnalyzer;
// ============================================================================
// Base URL Classifier Implementation
// ============================================================================
class BaseURLClassifier {
    config;
    patterns = new Map();
    constructor(config) {
        this.config = config;
        this.initializeDefaultPatterns();
    }
    getPatternConfidence(pattern) {
        return this.patterns.get(pattern)?.confidence || 0;
    }
    generateURLScore(url, taskKeywords) {
        let score = 50; // Base score
        // Positive patterns
        const positivePatterns = [
            { pattern: /pricing|price|cost|plan/i, boost: 20 },
            { pattern: /features|capabilities|functionality/i, boost: 15 },
            { pattern: /docs|documentation|guide/i, boost: 15 },
            { pattern: /review|rating|testimonial/i, boost: 10 },
            { pattern: /product|service|solution/i, boost: 10 }
        ];
        // Negative patterns
        const negativePatterns = [
            { pattern: /login|signin|signup|register/i, penalty: -30 },
            { pattern: /cookie|privacy|terms|legal/i, penalty: -25 },
            { pattern: /admin|dashboard|settings/i, penalty: -20 },
            { pattern: /\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/i, penalty: -40 },
            { pattern: /tracking|analytics|ads/i, penalty: -35 }
        ];
        // Apply positive patterns
        for (const { pattern, boost } of positivePatterns) {
            if (pattern.test(url)) {
                score += boost;
            }
        }
        // Apply negative patterns
        for (const { pattern, penalty } of negativePatterns) {
            if (pattern.test(url)) {
                score += penalty;
            }
        }
        // Keyword matching
        const urlLower = url.toLowerCase();
        for (const keyword of taskKeywords) {
            if (urlLower.includes(keyword.toLowerCase())) {
                score += 15;
            }
        }
        return Math.max(0, Math.min(100, score));
    }
    initializeDefaultPatterns() {
        const defaultPatterns = [
            { pattern: 'pricing', confidence: 0.9, impact: 20 },
            { pattern: 'features', confidence: 0.8, impact: 15 },
            { pattern: 'login', confidence: 0.95, impact: -30 },
            { pattern: 'admin', confidence: 0.9, impact: -20 }
        ];
        for (const { pattern, confidence, impact } of defaultPatterns) {
            this.patterns.set(pattern, { pattern, confidence, impact });
        }
    }
    categorizeURL(url) {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('pricing') || urlLower.includes('price')) {
            return intelligent_site_selection_1.URLCategory.PRICING;
        }
        if (urlLower.includes('features') || urlLower.includes('capabilities')) {
            return intelligent_site_selection_1.URLCategory.FEATURES;
        }
        if (urlLower.includes('docs') || urlLower.includes('documentation')) {
            return intelligent_site_selection_1.URLCategory.DOCUMENTATION;
        }
        if (urlLower.includes('review') || urlLower.includes('rating')) {
            return intelligent_site_selection_1.URLCategory.REVIEWS;
        }
        if (urlLower.includes('product') || urlLower.includes('service')) {
            return intelligent_site_selection_1.URLCategory.PRODUCT;
        }
        if (urlLower.includes('admin') || urlLower.includes('login')) {
            return intelligent_site_selection_1.URLCategory.ADMINISTRATIVE;
        }
        if (urlLower.match(/\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/)) {
            return intelligent_site_selection_1.URLCategory.MEDIA;
        }
        return intelligent_site_selection_1.URLCategory.IRRELEVANT;
    }
}
exports.BaseURLClassifier = BaseURLClassifier;
// ============================================================================
// Base Decision Logger Implementation
// ============================================================================
class BaseDecisionLogger {
    decisions = [];
    config;
    constructor(config) {
        this.config = config;
    }
    logSiteSelection(decision) {
        if (this.config.loggingLevel !== intelligent_site_selection_1.LoggingLevel.NONE) {
            this.decisions.push({
                decision,
                type: 'site_selection'
            });
            this.trimDecisionHistory();
        }
    }
    logNavigationDecision(decision) {
        if (this.config.loggingLevel !== intelligent_site_selection_1.LoggingLevel.NONE) {
            this.decisions.push({
                decision,
                type: 'navigation'
            });
            this.trimDecisionHistory();
        }
    }
    getDecisionHistory(filters) {
        return this.decisions.filter(entry => this.matchesFilters(entry, filters));
    }
    matchesFilters(entry, filters) {
        if (entry.type === 'site_selection') {
            const decision = entry.decision;
            if (filters.startTime && decision.timestamp < filters.startTime)
                return false;
            if (filters.endTime && decision.timestamp > filters.endTime)
                return false;
            if (filters.minScore && decision.score < filters.minScore)
                return false;
            if (filters.maxScore && decision.score > filters.maxScore)
                return false;
            if (filters.actions && !filters.actions.includes(decision.action))
                return false;
        }
        return true;
    }
    trimDecisionHistory() {
        // Keep only the last 1000 decisions to prevent memory issues
        if (this.decisions.length > 1000) {
            this.decisions = this.decisions.slice(-1000);
        }
    }
}
exports.BaseDecisionLogger = BaseDecisionLogger;
// ============================================================================
// Default Configuration
// ============================================================================
exports.DEFAULT_INTELLIGENT_CONFIG = {
    relevanceThreshold: 40,
    performanceMode: 'balanced',
    learningEnabled: true,
    cachingStrategy: 'balanced',
    loggingLevel: intelligent_site_selection_1.LoggingLevel.INFO,
    adaptiveWeights: true
};
// ============================================================================
// Utility Functions
// ============================================================================
function createDefaultResearchContext(taskDescription) {
    return {
        taskDescription,
        goals: extractGoalsFromTask(taskDescription),
        keywords: extractKeywordsFromTask(taskDescription),
        currentPhase: 'discovery',
        timeConstraints: {
            urgency: 'medium'
        },
        qualityRequirements: {
            minRelevanceScore: 40,
            requireMultipleSources: false,
            factVerificationLevel: 'basic'
        },
        previousFindings: []
    };
}
function extractGoalsFromTask(taskDescription) {
    const goals = [];
    const lowerTask = taskDescription.toLowerCase();
    if (lowerTask.includes('pricing') || lowerTask.includes('cost') || lowerTask.includes('price')) {
        goals.push('Find pricing information');
    }
    if (lowerTask.includes('features') || lowerTask.includes('capabilities')) {
        goals.push('Identify key features');
    }
    if (lowerTask.includes('review') || lowerTask.includes('comparison')) {
        goals.push('Gather reviews and comparisons');
    }
    if (lowerTask.includes('contact') || lowerTask.includes('support')) {
        goals.push('Find contact information');
    }
    return goals.length > 0 ? goals : ['General research'];
}
function extractKeywordsFromTask(taskDescription) {
    // Simple keyword extraction - in a real implementation, this could use NLP
    const words = taskDescription.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'have', 'been'].includes(word));
    return [...new Set(words)].slice(0, 10); // Unique keywords, max 10
}
