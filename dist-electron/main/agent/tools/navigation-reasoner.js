"use strict";
/**
 * Navigation Reasoner Implementation
 *
 * This module implements intelligent navigation decision-making for the browser-use tool.
 * It evaluates available links, prioritizes navigation paths, and generates strategic
 * navigation strategies based on research context and goals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigationReasonerImpl = void 0;
const intelligent_site_selection_1 = require("./intelligent-site-selection");
const intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
/**
 * NavigationReasonerImpl provides strategic decision-making for navigation paths
 * and intelligent link selection during web research.
 */
class NavigationReasonerImpl extends intelligent_site_selection_base_1.BaseNavigationReasoner {
    constructor(aiClient, config) {
        super(aiClient, config);
    }
    /**
     * Evaluates available navigation options and generates a strategic plan
     * for the most promising navigation paths.
     *
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
     */
    async evaluateNavigationOptions(currentPage, context, memory) {
        // Extract links from current page
        const availableLinks = this.extractLinksFromPage(currentPage);
        if (availableLinks.length === 0) {
            return {
                primaryTargets: [],
                secondaryTargets: [],
                avoidanceList: [],
                reasoning: 'No navigation links found on current page',
                confidence: 0.5
            };
        }
        // Prioritize links based on context and research goals
        const prioritizedLinks = await this.prioritizeLinks(availableLinks, context);
        // Separate into primary and secondary targets
        const primaryTargets = [];
        const secondaryTargets = [];
        const avoidanceList = [];
        for (const link of prioritizedLinks) {
            if (link.priority >= 0.7) {
                primaryTargets.push(link.url);
            }
            else if (link.priority >= 0.4) {
                secondaryTargets.push(link.url);
            }
            else if (link.priority < 0.2) {
                avoidanceList.push(link.url);
            }
        }
        // Generate reasoning explanation
        const reasoning = this.generateNavigationReasoning(context, primaryTargets, secondaryTargets, prioritizedLinks);
        // Calculate confidence based on link quality and context alignment
        const confidence = this.calculateNavigationConfidence(prioritizedLinks, context);
        return {
            primaryTargets: primaryTargets.slice(0, 5), // Limit to top 5
            secondaryTargets: secondaryTargets.slice(0, 5),
            avoidanceList,
            reasoning,
            confidence
        };
    }
    /**
     * Prioritizes links based on relevance to research goals and context.
     * Returns links sorted by priority score.
     *
     * **Validates: Requirements 2.1, 2.3**
     */
    async prioritizeLinks(links, context) {
        const prioritizedLinks = [];
        for (const link of links) {
            const priority = await this.calculateLinkPriority(link, context);
            const reasoning = this.generateLinkReasoning(link, context, priority);
            prioritizedLinks.push({
                url: link.href || link.url,
                link,
                priority,
                reasoning
            });
        }
        // Sort by priority descending
        return prioritizedLinks.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Determines whether a specific link should be followed based on context.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    async shouldFollowLink(link, context) {
        const priority = await this.calculateLinkPriority(link, context);
        // Follow links with priority >= 0.4
        return priority >= 0.4;
    }
    /**
     * Generates a strategic navigation approach based on research goals and constraints.
     * Overrides base implementation with enhanced strategy generation.
     *
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
     */
    generateNavigationStrategy(goals, constraints) {
        // Determine navigation approach based on goals
        const approach = this.determineApproach(goals, constraints);
        // Extract focus areas from goals
        const focusAreas = this.extractFocusAreas(goals);
        // Calculate optimal depth and parallelism based on constraints
        // Ensure maxDepth doesn't exceed the constraint
        const maxDepth = Math.min(Math.ceil(constraints.maxPages / 3), constraints.maxDepth || 5);
        const parallelism = this.config.performanceMode === 'fast' ? 3 : 2;
        return {
            approach,
            maxDepth,
            parallelism,
            focusAreas
        };
    }
    /**
     * Calculates priority score for a link based on multiple factors.
     * Returns a score between 0 and 1.
     */
    async calculateLinkPriority(link, context) {
        // First check for low-value patterns - these should immediately lower priority
        const linkText = (link.text + ' ' + link.href).toLowerCase();
        const lowValuePatterns = [
            /login|signin|signup|register/i,
            /privacy|terms|legal|cookie/i,
            /admin|dashboard|settings/i
        ];
        for (const pattern of lowValuePatterns) {
            if (pattern.test(linkText)) {
                return 0.15; // Very low priority for administrative links
            }
        }
        let score = 0.3; // Base score for regular links
        // Factor 1: Keyword matching in link text and URL
        const keywordMatch = this.calculateKeywordMatch(link, context.keywords);
        score += keywordMatch * 0.25;
        // Factor 2: Goal alignment
        const goalAlignment = this.calculateGoalAlignment(link, context.goals);
        score += goalAlignment * 0.25;
        // Factor 3: Link position and context (earlier links often more important)
        const positionScore = this.calculatePositionScore(link);
        score += positionScore * 0.15;
        // Factor 4: Content type indicators
        const contentTypeScore = this.calculateContentTypeScore(link, context);
        score += contentTypeScore * 0.35;
        // Normalize to 0-1 range
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculates keyword match score for a link.
     */
    calculateKeywordMatch(link, keywords) {
        const linkText = (link.text + ' ' + link.href).toLowerCase();
        let matches = 0;
        for (const keyword of keywords) {
            if (linkText.includes(keyword.toLowerCase())) {
                matches++;
            }
        }
        // Return normalized score (0-1)
        return Math.min(1, matches / Math.max(keywords.length, 1));
    }
    /**
     * Calculates goal alignment score for a link.
     */
    calculateGoalAlignment(link, goals) {
        const linkText = (link.text + ' ' + link.href).toLowerCase();
        let alignmentScore = 0;
        // Check for pricing-related goals
        if (goals.some(g => g.toLowerCase().includes('pricing'))) {
            if (linkText.includes('pricing') || linkText.includes('price') || linkText.includes('plan')) {
                alignmentScore += 0.5;
            }
        }
        // Check for features-related goals
        if (goals.some(g => g.toLowerCase().includes('features'))) {
            if (linkText.includes('features') || linkText.includes('capabilities')) {
                alignmentScore += 0.5;
            }
        }
        // Check for documentation-related goals
        if (goals.some(g => g.toLowerCase().includes('documentation'))) {
            if (linkText.includes('docs') || linkText.includes('documentation') || linkText.includes('guide')) {
                alignmentScore += 0.5;
            }
        }
        // Check for review-related goals
        if (goals.some(g => g.toLowerCase().includes('review'))) {
            if (linkText.includes('review') || linkText.includes('rating') || linkText.includes('testimonial')) {
                alignmentScore += 0.5;
            }
        }
        return Math.min(1, alignmentScore);
    }
    /**
     * Calculates position score based on link position in page.
     * Earlier links typically have higher priority.
     */
    calculatePositionScore(link) {
        if (!link.position) {
            return 0.5; // Default if position unknown
        }
        // Links in top 10% of page get higher score
        const index = link.position.index ?? 0;
        const totalLinks = link.position.totalLinks ?? 1;
        const positionRatio = index / Math.max(totalLinks, 1);
        return Math.max(0, 1 - positionRatio);
    }
    /**
     * Calculates content type score based on link indicators.
     */
    calculateContentTypeScore(link, context) {
        const linkText = (link.text + ' ' + link.href).toLowerCase();
        let score = 0.5; // Neutral base
        // High-value content types
        const highValuePatterns = [
            { pattern: /pricing|price|cost|plan/i, score: 0.9 },
            { pattern: /features|capabilities/i, score: 0.8 },
            { pattern: /documentation|guide|tutorial/i, score: 0.7 },
            { pattern: /review|rating|testimonial/i, score: 0.6 },
            { pattern: /product|service|solution/i, score: 0.5 }
        ];
        // Low-value content types
        const lowValuePatterns = [
            { pattern: /login|signin|signup|register/i, score: 0.1 },
            { pattern: /privacy|terms|legal|cookie/i, score: 0.15 },
            { pattern: /admin|dashboard|settings/i, score: 0.2 },
            { pattern: /contact|support|help/i, score: 0.4 } // Moderate value
        ];
        // Check high-value patterns first
        for (const { pattern, score: patternScore } of highValuePatterns) {
            if (pattern.test(linkText)) {
                return patternScore;
            }
        }
        // Check low-value patterns
        for (const { pattern, score: patternScore } of lowValuePatterns) {
            if (pattern.test(linkText)) {
                return patternScore;
            }
        }
        // Default neutral score
        return 0.5;
    }
    /**
     * Estimates the value of following a link based on context.
     */
    estimateLinkValue(link, context) {
        const priority = this.calculateLinkPrioritySync(link, context);
        return priority * 100; // Convert to 0-100 scale
    }
    /**
     * Synchronous version of priority calculation for estimation.
     */
    calculateLinkPrioritySync(link, context) {
        // First check for low-value patterns
        const linkText = (link.text + ' ' + link.href).toLowerCase();
        const lowValuePatterns = [
            /login|signin|signup|register/i,
            /privacy|terms|legal|cookie/i,
            /admin|dashboard|settings/i
        ];
        for (const pattern of lowValuePatterns) {
            if (pattern.test(linkText)) {
                return 0.15;
            }
        }
        let score = 0.3;
        const keywordMatch = this.calculateKeywordMatch(link, context.keywords);
        score += keywordMatch * 0.25;
        const goalAlignment = this.calculateGoalAlignment(link, context.goals);
        score += goalAlignment * 0.25;
        const positionScore = this.calculatePositionScore(link);
        score += positionScore * 0.15;
        const contentTypeScore = this.calculateContentTypeScore(link, context);
        score += contentTypeScore * 0.35;
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Generates reasoning explanation for navigation decisions.
     */
    generateNavigationReasoning(context, primaryTargets, secondaryTargets, prioritizedLinks) {
        const parts = [];
        parts.push(`Navigation strategy for: ${context.taskDescription}`);
        if (primaryTargets.length > 0) {
            parts.push(`Primary targets (${primaryTargets.length}): Focus on high-relevance links`);
        }
        if (secondaryTargets.length > 0) {
            parts.push(`Secondary targets (${secondaryTargets.length}): Explore if primary targets exhausted`);
        }
        if (context.goals.length > 0) {
            parts.push(`Goals: ${context.goals.join(', ')}`);
        }
        return parts.join('. ');
    }
    /**
     * Generates reasoning for individual link prioritization.
     */
    generateLinkReasoning(link, context, priority) {
        const reasons = [];
        if (priority >= 0.7) {
            reasons.push('High relevance to research goals');
        }
        else if (priority >= 0.4) {
            reasons.push('Moderate relevance to research goals');
        }
        else {
            reasons.push('Low relevance to research goals');
        }
        // Add specific reasons
        const linkText = (link.text + ' ' + link.href).toLowerCase();
        if (linkText.includes('pricing') || linkText.includes('price')) {
            reasons.push('Contains pricing information');
        }
        if (linkText.includes('features') || linkText.includes('capabilities')) {
            reasons.push('Contains feature information');
        }
        if (linkText.includes('docs') || linkText.includes('documentation')) {
            reasons.push('Contains documentation');
        }
        return reasons.join('; ');
    }
    /**
     * Calculates confidence in navigation plan based on link quality.
     */
    calculateNavigationConfidence(prioritizedLinks, context) {
        if (prioritizedLinks.length === 0) {
            return 0.3;
        }
        // Average priority of top links
        const topLinks = prioritizedLinks.slice(0, 5);
        const avgPriority = topLinks.reduce((sum, link) => sum + link.priority, 0) / topLinks.length;
        // Confidence increases with average priority and number of good options
        const optionCount = prioritizedLinks.filter(l => l.priority >= 0.4).length;
        const optionFactor = Math.min(1, optionCount / 5);
        return (avgPriority * 0.7 + optionFactor * 0.3);
    }
    /**
     * Extracts links from page content.
     */
    extractLinksFromPage(page) {
        const links = [];
        if (!page.links || page.links.length === 0) {
            return links;
        }
        for (let i = 0; i < page.links.length; i++) {
            const link = page.links[i];
            // Skip empty or invalid links
            if (!link.href || !link.href.trim()) {
                continue;
            }
            // Skip anchor-only links
            if (link.href.startsWith('#')) {
                continue;
            }
            links.push({
                url: link.href,
                text: link.text || '',
                context: page.title || '',
                elementType: 'a',
                position: {
                    index: i,
                    totalLinks: page.links.length
                }
            });
        }
        return links;
    }
    /**
     * Determines navigation approach based on goals and constraints.
     * Overrides base implementation.
     */
    determineApproach(goals, constraints) {
        // Analyze goals to determine best approach
        const goalsText = goals.join(' ').toLowerCase();
        if (goalsText.includes('comparison') || goalsText.includes('compare')) {
            return intelligent_site_selection_1.NavigationApproach.BREADTH_FIRST;
        }
        if (goalsText.includes('deep') || goalsText.includes('detailed')) {
            return intelligent_site_selection_1.NavigationApproach.DEPTH_FIRST;
        }
        if (goalsText.includes('specific') || goalsText.includes('targeted')) {
            return intelligent_site_selection_1.NavigationApproach.TARGETED;
        }
        // Default to breadth-first for general research
        return intelligent_site_selection_1.NavigationApproach.BREADTH_FIRST;
    }
    /**
     * Extracts focus areas from research goals.
     * Overrides base implementation.
     */
    extractFocusAreas(goals) {
        const focusAreas = [];
        for (const goal of goals) {
            const lowerGoal = goal.toLowerCase();
            if (lowerGoal.includes('pricing')) {
                focusAreas.push('pricing');
            }
            if (lowerGoal.includes('features')) {
                focusAreas.push('features');
            }
            if (lowerGoal.includes('documentation')) {
                focusAreas.push('documentation');
            }
            if (lowerGoal.includes('review')) {
                focusAreas.push('reviews');
            }
            if (lowerGoal.includes('comparison')) {
                focusAreas.push('comparison');
            }
        }
        return [...new Set(focusAreas)]; // Remove duplicates
    }
}
exports.NavigationReasonerImpl = NavigationReasonerImpl;
