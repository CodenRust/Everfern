"use strict";
/**
 * Enhanced Browser-Use Tool with Intelligent Site Selection Integration
 *
 * This module integrates intelligent site selection components with the existing
 * browser-use tool, providing enhanced decision-making for site selection and navigation.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 1.1, 1.2, 5.1, 6.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentScoringSystem = void 0;
exports.createEnhancedResearchMemory = createEnhancedResearchMemory;
exports.createIntelligentScoringSystem = createIntelligentScoringSystem;
exports.scoreUrlRelevanceWithIntelligence = scoreUrlRelevanceWithIntelligence;
exports.scorePageRelevanceWithIntelligence = scorePageRelevanceWithIntelligence;
exports.addIntelligentFactToMemory = addIntelligentFactToMemory;
const intelligent_site_selection_1 = require("./intelligent-site-selection");
const intelligent_site_selection_factory_1 = require("./intelligent-site-selection-factory");
const enhanced_research_memory_1 = require("./enhanced-research-memory");
const intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
/**
 * Enhanced scoring functions that integrate intelligent components
 */
class IntelligentScoringSystem {
    intelligentSystem;
    config;
    researchContext;
    decisionLog = [];
    constructor(aiClient, config = {}, researchContext) {
        this.config = { ...intelligent_site_selection_base_1.DEFAULT_INTELLIGENT_CONFIG, ...config };
        this.intelligentSystem = (0, intelligent_site_selection_factory_1.createIntelligentSiteSelection)(aiClient, this.config);
        this.researchContext = researchContext;
    }
    /**
     * Enhanced URL relevance scoring using intelligent URL classifier
     * Integrates with existing scoreUrlRelevance function
     *
     * Requirements: 1.1, 3.1, 3.2, 3.5
     */
    async scoreUrlRelevanceIntelligent(url, taskDescription, linkText = '') {
        if (!this.researchContext) {
            this.researchContext = {
                taskDescription,
                goals: this.extractGoals(taskDescription),
                keywords: this.extractKeywords(taskDescription),
                currentPhase: intelligent_site_selection_1.ResearchPhase.DISCOVERY,
                timeConstraints: { urgency: 'medium' },
                qualityRequirements: { minRelevanceScore: 40, requireMultipleSources: false, factVerificationLevel: 'basic' },
                previousFindings: []
            };
        }
        try {
            // Use URL classifier for fast pre-filtering
            const classification = this.intelligentSystem.urlClassifier.classifyURL(url, this.researchContext);
            // Log the decision
            this.logDecision(url, 'classify', classification.score, `Category: ${classification.category}`);
            // Return the intelligent score
            return classification.score;
        }
        catch (error) {
            console.warn('Intelligent URL scoring failed, using fallback:', error);
            // Fallback to basic scoring
            return this.fallbackUrlScoring(url, taskDescription, linkText);
        }
    }
    /**
     * Enhanced page relevance scoring using intelligent content analyzer
     * Integrates with existing scorePageRelevance function
     *
     * Requirements: 1.1, 1.3, 1.5, 6.1, 6.2
     */
    async scorePageRelevanceIntelligent(taskDescription, content) {
        if (!this.researchContext) {
            this.researchContext = {
                taskDescription,
                goals: this.extractGoals(taskDescription),
                keywords: this.extractKeywords(taskDescription),
                currentPhase: intelligent_site_selection_1.ResearchPhase.DISCOVERY,
                timeConstraints: { urgency: 'medium' },
                qualityRequirements: { minRelevanceScore: 40, requireMultipleSources: false, factVerificationLevel: 'basic' },
                previousFindings: []
            };
        }
        try {
            // Perform heuristic analysis first (fast path)
            const heuristicAnalysis = this.intelligentSystem.contentAnalyzer.performHeuristicAnalysis(content, this.researchContext);
            // If heuristic score is very low, skip AI analysis
            if (heuristicAnalysis.relevanceScore < 30) {
                this.logDecision(content.url, 'heuristic_skip', heuristicAnalysis.relevanceScore, `Heuristic score too low: ${heuristicAnalysis.fastRejectReasons?.join(', ')}`);
                return heuristicAnalysis.relevanceScore;
            }
            // For promising candidates, perform deep analysis
            if (heuristicAnalysis.relevanceScore >= 50) {
                const deepAnalysis = await this.intelligentSystem.contentAnalyzer.performDeepAnalysis(content, this.researchContext);
                const finalScore = (heuristicAnalysis.relevanceScore + deepAnalysis.semanticRelevance) / 2;
                this.logDecision(content.url, 'deep_analysis', finalScore, 'Deep AI analysis performed');
                return finalScore;
            }
            // Medium scores use heuristic result
            this.logDecision(content.url, 'heuristic_score', heuristicAnalysis.relevanceScore, 'Heuristic analysis');
            return heuristicAnalysis.relevanceScore;
        }
        catch (error) {
            console.warn('Intelligent page scoring failed, using fallback:', error);
            return this.fallbackPageScoring(taskDescription, content);
        }
    }
    /**
     * Intelligent site evaluation for decision-making
     * Integrates with existing action decision logic
     *
     * Requirements: 1.1, 1.2, 1.4, 2.1, 2.2
     */
    async evaluateSiteForVisit(url, taskDescription, content) {
        if (!this.researchContext) {
            this.researchContext = {
                taskDescription,
                goals: this.extractGoals(taskDescription),
                keywords: this.extractKeywords(taskDescription),
                currentPhase: intelligent_site_selection_1.ResearchPhase.DISCOVERY,
                timeConstraints: { urgency: 'medium' },
                qualityRequirements: { minRelevanceScore: 40, requireMultipleSources: false, factVerificationLevel: 'basic' },
                previousFindings: []
            };
        }
        try {
            // Evaluate site using intelligent selector
            const evaluation = await this.intelligentSystem.selector.evaluateSite(url, this.researchContext);
            // Determine if site should be visited based on threshold
            const shouldVisit = this.intelligentSystem.selector.shouldVisitSite(evaluation);
            this.logDecision(url, shouldVisit ? 'visit' : 'skip', evaluation.relevanceScore, evaluation.reasoningFactors.map(f => f.explanation).join('; '));
            return {
                shouldVisit,
                score: evaluation.relevanceScore,
                reasoning: evaluation.reasoningFactors.map(f => f.explanation).join('; ')
            };
        }
        catch (error) {
            console.warn('Intelligent site evaluation failed:', error);
            return {
                shouldVisit: true,
                score: 50,
                reasoning: 'Fallback evaluation due to error'
            };
        }
    }
    /**
     * Get navigation recommendations for link prioritization
     * Integrates with existing link discovery and queuing
     *
     * Requirements: 2.1, 2.2, 2.3, 2.5
     */
    async getNavigationRecommendations(currentUrl, links, taskDescription) {
        if (!this.researchContext) {
            this.researchContext = {
                taskDescription,
                goals: this.extractGoals(taskDescription),
                keywords: this.extractKeywords(taskDescription),
                currentPhase: intelligent_site_selection_1.ResearchPhase.ANALYSIS,
                timeConstraints: { urgency: 'medium' },
                qualityRequirements: { minRelevanceScore: 40, requireMultipleSources: false, factVerificationLevel: 'basic' },
                previousFindings: []
            };
        }
        try {
            // Score each link using URL classifier
            const scoredLinks = await Promise.all(links.map(async (link) => {
                const score = await this.scoreUrlRelevanceIntelligent(link.href, taskDescription, link.text);
                return {
                    url: link.href,
                    score,
                    reasoning: `Link text: "${link.text}"`
                };
            }));
            // Sort by score descending
            return scoredLinks.sort((a, b) => b.score - a.score);
        }
        catch (error) {
            console.warn('Navigation recommendations failed:', error);
            return [];
        }
    }
    /**
     * Log decision for transparency and debugging
     * Integrates with decision logging system
     *
     * Requirements: 5.1, 5.2
     */
    logDecision(url, action, score, reasoning) {
        this.decisionLog.push({
            timestamp: Date.now(),
            url,
            action,
            score,
            reasoning
        });
        // Keep log size manageable
        if (this.decisionLog.length > 1000) {
            this.decisionLog = this.decisionLog.slice(-500);
        }
    }
    /**
     * Get decision report for session analysis
     * Requirements: 5.1, 5.2, 5.3
     */
    getDecisionReport() {
        const visited = this.decisionLog.filter(d => d.action === 'visit').length;
        const skipped = this.decisionLog.filter(d => d.action === 'skip').length;
        const avgScore = this.decisionLog.length > 0
            ? this.decisionLog.reduce((sum, d) => sum + d.score, 0) / this.decisionLog.length
            : 0;
        return {
            totalDecisions: this.decisionLog.length,
            sitesVisited: visited,
            sitesSkipped: skipped,
            averageScore: avgScore,
            decisions: this.decisionLog
        };
    }
    /**
     * Update research context for adaptive scoring
     * Requirements: 4.1, 4.2, 4.3
     */
    updateResearchContext(context) {
        if (this.researchContext) {
            this.researchContext = { ...this.researchContext, ...context };
        }
    }
    /**
     * Fallback URL scoring when intelligent scoring fails
     */
    fallbackUrlScoring(url, taskDescription, linkText) {
        const task = taskDescription.toLowerCase();
        const u = url.toLowerCase();
        const text = linkText.toLowerCase();
        let score = 50;
        // Boost for relevant keywords
        const keywords = this.extractKeywords(taskDescription);
        keywords.forEach(kw => {
            if (u.includes(kw) || text.includes(kw))
                score += 15;
        });
        // Penalize for irrelevant patterns
        if (u.includes('login') || u.includes('signup') || u.includes('auth'))
            score -= 30;
        if (u.includes('cookie') || u.includes('privacy') || u.includes('terms'))
            score -= 20;
        if (u.includes('.pdf') || u.includes('.jpg') || u.includes('.png'))
            score -= 25;
        // Boost for relevant patterns
        if (u.includes('pricing') || u.includes('plans') || u.includes('cost'))
            score += 20;
        if (u.includes('features') || u.includes('capabilities'))
            score += 15;
        if (u.includes('documentation') || u.includes('docs') || u.includes('api'))
            score += 15;
        return Math.max(0, Math.min(100, score));
    }
    /**
     * Fallback page scoring when intelligent scoring fails
     */
    fallbackPageScoring(taskDescription, content) {
        const task = taskDescription.toLowerCase();
        let score = 50;
        // Check title
        if (content.title.toLowerCase().includes(task))
            score += 20;
        // Check meta description
        if (content.metaDescription?.toLowerCase().includes(task))
            score += 15;
        // Check headings
        const headingText = content.headings.join(' ').toLowerCase();
        if (headingText.includes(task))
            score += 10;
        // Check for structured data
        if (content.structuredData)
            score += 10;
        // Check for pricing/features
        if (content.rawText.toLowerCase().includes('pricing'))
            score += 10;
        if (content.rawText.toLowerCase().includes('features'))
            score += 10;
        return Math.max(0, Math.min(100, score));
    }
    /**
     * Extract goals from task description
     */
    extractGoals(taskDescription) {
        const goals = [];
        if (taskDescription.toLowerCase().includes('pricing'))
            goals.push('Find pricing information');
        if (taskDescription.toLowerCase().includes('features'))
            goals.push('Identify key features');
        if (taskDescription.toLowerCase().includes('review'))
            goals.push('Find user reviews');
        if (taskDescription.toLowerCase().includes('documentation'))
            goals.push('Locate documentation');
        return goals.length > 0 ? goals : ['Complete research task'];
    }
    /**
     * Extract keywords from task description
     */
    extractKeywords(taskDescription) {
        return taskDescription
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'that', 'this'].includes(word))
            .slice(0, 10);
    }
}
exports.IntelligentScoringSystem = IntelligentScoringSystem;
/**
 * Enhanced research memory wrapper that integrates intelligent capabilities
 */
function createEnhancedResearchMemory() {
    return new enhanced_research_memory_1.EnhancedSharedResearchMemoryImpl();
}
/**
 * Create intelligent scoring system for browser-use integration
 */
function createIntelligentScoringSystem(aiClient, config, researchContext) {
    return new IntelligentScoringSystem(aiClient, config, researchContext);
}
/**
 * Integration helper: Wrap existing scoreUrlRelevance with intelligent scoring
 */
async function scoreUrlRelevanceWithIntelligence(url, taskDescription, linkText, scoringSystem) {
    return scoringSystem.scoreUrlRelevanceIntelligent(url, taskDescription, linkText);
}
/**
 * Integration helper: Wrap existing scorePageRelevance with intelligent scoring
 */
async function scorePageRelevanceWithIntelligence(taskDescription, content, scoringSystem) {
    return scoringSystem.scorePageRelevanceIntelligent(taskDescription, content);
}
/**
 * Integration helper: Add intelligent fact to enhanced memory
 */
function addIntelligentFactToMemory(memory, url, title, summary, relevanceScore, contentQuality, category, keyFacts = [], prices = [], ratings = []) {
    const intelligentFact = {
        url,
        title,
        summary,
        relevanceScore,
        contentQuality,
        informationDensity: 0.7,
        extractionConfidence: 0.8,
        category,
        relatedTopics: [],
        contentGapsFilled: [],
        keyFacts,
        prices,
        ratings,
        timestamp: Date.now()
    };
    memory.addIntelligentFact(intelligentFact);
}
