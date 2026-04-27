"use strict";
/**
 * Context-Aware Scoring Adaptation System
 *
 * Implements adaptive scoring algorithms that adjust based on research context,
 * research phase, and identified content gaps.
 *
 * Requirements: 4.1, 4.4, 4.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAwareScoringEngine = void 0;
exports.createContextAwareScoringEngine = createContextAwareScoringEngine;
const intelligent_site_selection_1 = require("./intelligent-site-selection");
/**
 * Scoring adaptation engine
 *
 * Requirements: 4.1, 4.4, 4.5
 */
class ContextAwareScoringEngine {
    baseWeights = {
        keywordMatch: 0.25,
        urlPatterns: 0.20,
        contentQuality: 0.15,
        informationDensity: 0.15,
        contextualFit: 0.10,
        uniqueness: 0.08,
        structuredData: 0.04,
        userSignals: 0.03
    };
    phaseWeights = {
        [intelligent_site_selection_1.ResearchPhase.DISCOVERY]: {
            keywordMatch: 0.20,
            urlPatterns: 0.25,
            contentQuality: 0.10,
            informationDensity: 0.10,
            contextualFit: 0.15,
            uniqueness: 0.15,
            structuredData: 0.03,
            userSignals: 0.02
        },
        [intelligent_site_selection_1.ResearchPhase.ANALYSIS]: {
            keywordMatch: 0.30,
            urlPatterns: 0.15,
            contentQuality: 0.20,
            informationDensity: 0.20,
            contextualFit: 0.08,
            uniqueness: 0.04,
            structuredData: 0.02,
            userSignals: 0.01
        },
        [intelligent_site_selection_1.ResearchPhase.VALIDATION]: {
            keywordMatch: 0.25,
            urlPatterns: 0.15,
            contentQuality: 0.25,
            informationDensity: 0.15,
            contextualFit: 0.10,
            uniqueness: 0.05,
            structuredData: 0.03,
            userSignals: 0.02
        },
        [intelligent_site_selection_1.ResearchPhase.COMPLETION]: {
            keywordMatch: 0.20,
            urlPatterns: 0.10,
            contentQuality: 0.20,
            informationDensity: 0.15,
            contextualFit: 0.20,
            uniqueness: 0.10,
            structuredData: 0.03,
            userSignals: 0.02
        }
    };
    /**
     * Get adaptive weights based on research context
     *
     * Requirements: 4.1, 4.4
     */
    getAdaptiveWeights(context, memory) {
        let weights = { ...this.baseWeights };
        // Apply phase-based adjustments
        const phaseWeights = this.phaseWeights[context.currentPhase];
        if (phaseWeights) {
            weights = { ...weights, ...phaseWeights };
        }
        // Apply gap-based adjustments
        if (memory) {
            const gaps = memory.getContentGaps();
            weights = this.adjustWeightsForGaps(weights, gaps, context);
        }
        // Apply keyword-based adjustments
        weights = this.adjustWeightsForKeywords(weights, context.keywords);
        // Normalize weights to sum to 1
        return this.normalizeWeights(weights);
    }
    /**
     * Adjust weights based on identified content gaps
     *
     * Requirements: 4.5
     */
    adjustWeightsForGaps(weights, gaps, context) {
        const adjusted = { ...weights };
        // If we have pricing gaps, boost pricing-related scoring
        if (gaps.some(g => g.category === 'pricing')) {
            adjusted.keywordMatch += 0.05;
            adjusted.urlPatterns += 0.03;
        }
        // If we have feature gaps, boost feature-related scoring
        if (gaps.some(g => g.category === 'features')) {
            adjusted.contentQuality += 0.05;
            adjusted.informationDensity += 0.03;
        }
        // If we have documentation gaps, boost documentation scoring
        if (gaps.some(g => g.category === 'documentation')) {
            adjusted.structuredData += 0.05;
            adjusted.contentQuality += 0.03;
        }
        // If we have review gaps, boost review-related scoring
        if (gaps.some(g => g.category === 'reviews')) {
            adjusted.userSignals += 0.08;
            adjusted.uniqueness += 0.03;
        }
        return adjusted;
    }
    /**
     * Adjust weights based on research keywords
     *
     * Requirements: 4.4
     */
    adjustWeightsForKeywords(weights, keywords) {
        const adjusted = { ...weights };
        // Check for pricing-related keywords
        if (keywords.some(kw => ['pricing', 'cost', 'price', 'plans', 'subscription'].includes(kw))) {
            adjusted.keywordMatch += 0.08;
            adjusted.urlPatterns += 0.05;
        }
        // Check for feature-related keywords
        if (keywords.some(kw => ['features', 'capabilities', 'functionality', 'tools'].includes(kw))) {
            adjusted.contentQuality += 0.08;
            adjusted.informationDensity += 0.05;
        }
        // Check for comparison keywords
        if (keywords.some(kw => ['comparison', 'vs', 'alternative', 'competitor'].includes(kw))) {
            adjusted.uniqueness += 0.10;
            adjusted.contextualFit += 0.05;
        }
        // Check for documentation keywords
        if (keywords.some(kw => ['documentation', 'docs', 'api', 'guide', 'tutorial'].includes(kw))) {
            adjusted.structuredData += 0.08;
            adjusted.contentQuality += 0.05;
        }
        return adjusted;
    }
    /**
     * Normalize weights to sum to 1
     */
    normalizeWeights(weights) {
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        const normalized = {};
        for (const [key, value] of Object.entries(weights)) {
            normalized[key] = value / sum;
        }
        return normalized;
    }
    /**
     * Calculate keyword-based score boost
     *
     * Requirements: 4.4
     */
    calculateKeywordBoost(content, keywords) {
        const contentLower = content.toLowerCase();
        let boost = 0;
        for (const keyword of keywords) {
            const keywordLower = keyword.toLowerCase();
            const occurrences = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
            // Boost based on keyword frequency
            if (occurrences > 0) {
                boost += Math.min(0.15, occurrences * 0.02);
            }
        }
        return Math.min(0.30, boost); // Cap at 30% boost
    }
    /**
     * Calculate research phase awareness score
     *
     * Requirements: 4.1
     */
    calculatePhaseAwarenessScore(phase, contentType) {
        const phaseContentPreferences = {
            [intelligent_site_selection_1.ResearchPhase.DISCOVERY]: {
                'overview': 0.9,
                'product': 0.8,
                'features': 0.7,
                'pricing': 0.6,
                'reviews': 0.5,
                'documentation': 0.4
            },
            [intelligent_site_selection_1.ResearchPhase.ANALYSIS]: {
                'documentation': 0.9,
                'technical': 0.9,
                'features': 0.8,
                'pricing': 0.7,
                'reviews': 0.6,
                'overview': 0.4
            },
            [intelligent_site_selection_1.ResearchPhase.VALIDATION]: {
                'reviews': 0.9,
                'case_studies': 0.9,
                'pricing': 0.8,
                'features': 0.7,
                'technical': 0.6,
                'documentation': 0.5
            },
            [intelligent_site_selection_1.ResearchPhase.COMPLETION]: {
                'comparison': 0.9,
                'summary': 0.8,
                'overview': 0.8,
                'pricing': 0.7,
                'features': 0.7,
                'reviews': 0.6
            }
        };
        const preferences = phaseContentPreferences[phase];
        return preferences[contentType] || 0.5;
    }
    /**
     * Calculate gap-based content prioritization score
     *
     * Requirements: 4.5
     */
    calculateGapPrioritizationScore(contentType, gaps) {
        let score = 0.5; // Base score
        // Check if this content type addresses any gaps
        for (const gap of gaps) {
            if (gap.category === contentType) {
                // Boost based on gap priority
                score += gap.priority * 0.3;
            }
        }
        return Math.min(1.0, score);
    }
    /**
     * Calculate combined context-aware score
     */
    calculateContextAwareScore(factors, weights) {
        let score = 0;
        for (const [factor, weight] of Object.entries(weights)) {
            const factorValue = factors[factor] || 0;
            score += factorValue * weight;
        }
        return Math.min(100, Math.max(0, score * 100));
    }
    /**
     * Get scoring explanation for transparency
     */
    getScoringExplanation(context, weights, factors) {
        const explanations = [];
        // Phase explanation
        explanations.push(`Research phase: ${context.currentPhase}`);
        // Top contributing factors
        const sortedWeights = Object.entries(weights)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);
        explanations.push(`Top factors: ${sortedWeights.map(([f, w]) => `${f} (${(w * 100).toFixed(0)}%)`).join(', ')}`);
        // Keyword boost
        if (context.keywords.length > 0) {
            explanations.push(`Keywords: ${context.keywords.slice(0, 3).join(', ')}`);
        }
        return explanations.join(' | ');
    }
}
exports.ContextAwareScoringEngine = ContextAwareScoringEngine;
/**
 * Create context-aware scoring engine
 */
function createContextAwareScoringEngine() {
    return new ContextAwareScoringEngine();
}
