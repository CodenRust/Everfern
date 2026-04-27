"use strict";
/**
 * Integration example for Intelligent Site Selection with Browser-Use Tool
 *
 * This module demonstrates how the intelligent site selection system integrates
 * with the existing browser-use tool architecture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentSiteEvaluator = void 0;
exports.createEnhancedBrowserUseTool = createEnhancedBrowserUseTool;
exports.demonstrateIntelligentSelection = demonstrateIntelligentSelection;
const intelligent_site_selection_factory_1 = require("./intelligent-site-selection-factory");
const intelligent_site_selection_1 = require("./intelligent-site-selection");
const intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
const intelligent_site_selection_index_1 = require("./intelligent-site-selection-index");
/**
 * Intelligent site evaluation wrapper for existing browser-use functions
 */
class IntelligentSiteEvaluator {
    intelligentSystem;
    config;
    constructor(aiClient, config = {}) {
        this.config = { ...intelligent_site_selection_base_1.DEFAULT_INTELLIGENT_CONFIG, ...config };
        this.intelligentSystem = (0, intelligent_site_selection_factory_1.createIntelligentSiteSelection)(aiClient, this.config);
    }
    /**
     * Enhanced URL relevance scoring using intelligent components
     */
    async scoreUrlRelevanceIntelligent(url, taskDescription, context) {
        const researchContext = context || (0, intelligent_site_selection_index_1.createResearchContext)(taskDescription);
        try {
            // Use intelligent URL classifier first for fast pre-filtering
            const classification = this.intelligentSystem.urlClassifier.classifyURL(url, researchContext);
            // If URL fails basic classification, return low score
            if (classification.processingRecommendation === 'skip') {
                this.logDecision(url, 'skip', classification.score, 'Failed URL classification');
                return classification.score;
            }
            // Use site selector for comprehensive evaluation
            const evaluation = await this.intelligentSystem.selector.evaluateSite(url, researchContext);
            this.logDecision(url, 'evaluate', evaluation.relevanceScore, evaluation.reasoningFactors[0]?.explanation || 'Intelligent evaluation');
            return evaluation.relevanceScore;
        }
        catch (error) {
            console.warn('Intelligent URL scoring failed, falling back to basic scoring:', error);
            // Fallback to basic scoring (would call original scoreUrlRelevance)
            return this.fallbackUrlScoring(url, taskDescription);
        }
    }
    /**
     * Enhanced page relevance scoring using intelligent content analysis
     */
    async scorePageRelevanceIntelligent(taskDescription, content, context) {
        const researchContext = context || (0, intelligent_site_selection_index_1.createResearchContext)(taskDescription);
        try {
            // Fast heuristic analysis first
            const heuristicAnalysis = this.intelligentSystem.contentAnalyzer.performHeuristicAnalysis(content, researchContext);
            // If heuristic analysis suggests skipping, return early
            if (heuristicAnalysis.processingRecommendation === 'skip') {
                return heuristicAnalysis.relevanceScore;
            }
            // Perform deeper analysis if warranted
            if (heuristicAnalysis.processingRecommendation === 'deep_ai') {
                const relevanceAssessment = await this.intelligentSystem.relevanceEngine.assessRelevance(content, researchContext);
                return relevanceAssessment.overallScore;
            }
            return heuristicAnalysis.relevanceScore;
        }
        catch (error) {
            console.warn('Intelligent page scoring failed, falling back to basic scoring:', error);
            // Fallback to basic scoring (would call original scorePageRelevance)
            return this.fallbackPageScoring(taskDescription, content);
        }
    }
    /**
     * Intelligent site selection decision
     */
    async shouldVisitSite(url, context) {
        try {
            const evaluation = await this.intelligentSystem.selector.evaluateSite(url, context);
            const shouldVisit = this.intelligentSystem.selector.shouldVisitSite(evaluation);
            this.logDecision(url, shouldVisit ? 'visit' : 'skip', evaluation.relevanceScore, `Decision based on threshold ${this.config.relevanceThreshold}`);
            return shouldVisit;
        }
        catch (error) {
            console.warn('Intelligent site selection failed, using fallback:', error);
            return true; // Conservative fallback - visit the site
        }
    }
    /**
     * Get intelligent navigation recommendations
     */
    async getNavigationRecommendations(currentPage, context, memory) {
        try {
            return await this.intelligentSystem.navigationReasoner.evaluateNavigationOptions(currentPage, context, memory);
        }
        catch (error) {
            console.warn('Navigation reasoning failed:', error);
            return null;
        }
    }
    /**
     * Generate decision transparency report
     */
    generateDecisionReport(sessionId) {
        return this.intelligentSystem.decisionLogger.generateDecisionReport(sessionId);
    }
    logDecision(url, action, score, reasoning) {
        if (this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.DEBUG || this.config.loggingLevel === intelligent_site_selection_1.LoggingLevel.TRACE) {
            console.log(`[Intelligent Selection] ${action.toUpperCase()}: ${url} (score: ${score}) - ${reasoning}`);
        }
    }
    fallbackUrlScoring(url, taskDescription) {
        // This would call the original scoreUrlRelevance function
        // For now, return a basic score
        let score = 50;
        const urlLower = url.toLowerCase();
        const taskLower = taskDescription.toLowerCase();
        if (urlLower.includes('pricing'))
            score += 15;
        if (urlLower.includes('features'))
            score += 10;
        if (urlLower.includes('login'))
            score -= 20;
        return Math.max(0, Math.min(100, score));
    }
    fallbackPageScoring(taskDescription, content) {
        // This would call the original scorePageRelevance function
        // For now, return a basic score
        const text = (content.rawText || '').toLowerCase();
        const taskLower = taskDescription.toLowerCase();
        let score = 0;
        const words = taskLower.split(/\s+/);
        for (const word of words) {
            if (word.length > 3 && text.includes(word)) {
                score += 10;
            }
        }
        return Math.min(100, score);
    }
}
exports.IntelligentSiteEvaluator = IntelligentSiteEvaluator;
/**
 * Enhanced browser-use tool factory with intelligent capabilities
 */
function createEnhancedBrowserUseTool(aiClient, groundingEngine, intelligentConfig) {
    const evaluator = new IntelligentSiteEvaluator(aiClient, intelligentConfig);
    return {
        name: 'browser_use_intelligent',
        description: 'Autonomous deep web research tool with intelligent site selection and navigation reasoning.',
        parameters: {
            type: 'object',
            properties: {
                task: {
                    type: 'string',
                    description: 'The research task or question to investigate'
                },
                urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional starting URLs for research'
                },
                maxSites: {
                    type: 'number',
                    description: 'Maximum number of sites to visit (default: 10)'
                },
                enableIntelligentSelection: {
                    type: 'boolean',
                    description: 'Enable intelligent site selection features (default: true)'
                },
                relevanceThreshold: {
                    type: 'number',
                    description: 'Minimum relevance score for site visits (default: 40)'
                }
            },
            required: ['task']
        },
        async execute(args, onUpdate, emitEvent, toolCallId) {
            const { task, urls = [], maxSites = 10, enableIntelligentSelection = true, relevanceThreshold = 40 } = args;
            // Create research context
            const context = (0, intelligent_site_selection_index_1.createResearchContext)(task);
            // Update configuration if provided
            const config = {
                ...intelligentConfig,
                relevanceThreshold
            };
            if (onUpdate) {
                onUpdate(`Starting intelligent research for: ${task}`);
            }
            try {
                // This would integrate with the actual browser research logic
                // For now, return a mock result showing the integration structure
                const result = {
                    success: true,
                    output: `Intelligent research completed with ${enableIntelligentSelection ? 'enhanced' : 'basic'} site selection`,
                    intelligentMetrics: enableIntelligentSelection ? {
                        sitesEvaluated: 15,
                        sitesSkipped: 8,
                        averageRelevanceScore: 67,
                        decisionTransparency: [
                            'Skipped 3 login pages due to low relevance',
                            'Prioritized pricing pages based on task keywords',
                            'Used AI analysis for 5 high-potential sites'
                        ]
                    } : undefined
                };
                if (onUpdate) {
                    onUpdate('Research completed successfully');
                }
                return result;
            }
            catch (error) {
                console.error('Enhanced browser research failed:', error);
                throw error;
            }
        }
    };
}
/**
 * Utility function to demonstrate intelligent site selection workflow
 */
async function demonstrateIntelligentSelection(aiClient, taskDescription, candidateUrls) {
    console.log('=== Intelligent Site Selection Demonstration ===');
    console.log(`Task: ${taskDescription}`);
    console.log(`Candidate URLs: ${candidateUrls.length}`);
    const evaluator = new IntelligentSiteEvaluator(aiClient);
    const context = (0, intelligent_site_selection_index_1.createResearchContext)(taskDescription);
    console.log('\n--- URL Evaluation Results ---');
    for (const url of candidateUrls) {
        const score = await evaluator.scoreUrlRelevanceIntelligent(url, taskDescription, context);
        const shouldVisit = await evaluator.shouldVisitSite(url, context);
        console.log(`${shouldVisit ? '✓' : '✗'} ${url} (score: ${score})`);
    }
    console.log('\n--- Decision Report ---');
    const report = evaluator.generateDecisionReport('demo-session');
    console.log(`Total decisions: ${report.sessionSummary.totalDecisions}`);
    console.log(`Sites to visit: ${report.sessionSummary.sitesVisited}`);
    console.log(`Sites to skip: ${report.sessionSummary.sitesSkipped}`);
    console.log(`Average relevance: ${report.sessionSummary.averageRelevanceScore}`);
}
