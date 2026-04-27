"use strict";
/**
 * Enhanced Shared Research Memory with Intelligent Capabilities
 *
 * This module extends the existing SharedResearchMemory with intelligent features
 * for content gap analysis, research progress tracking, and context awareness.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedSharedResearchMemoryImpl = void 0;
// Base SharedResearchMemory implementation that matches browser-use.ts
class SharedResearchMemory {
    facts = [];
    visitedUrls = new Set();
    urlQueue = [];
    addFact(fact) {
        this.facts.push(fact);
        this.visitedUrls.add(fact.url);
    }
    markVisited(url) {
        this.visitedUrls.add(url);
    }
    hasVisited(url) {
        try {
            const u = new URL(url);
            return this.visitedUrls.has(u.href) || this.visitedUrls.has(url);
        }
        catch {
            return this.visitedUrls.has(url);
        }
    }
    queueUrl(url, score = 50) {
        if (!this.hasVisited(url) && !this.urlQueue.find(q => q.url === url)) {
            this.urlQueue.push({ url, score });
            // Keep queue sorted by score descending — best URLs first
            this.urlQueue.sort((a, b) => b.score - a.score);
        }
    }
    dequeueUrl() {
        return this.urlQueue.shift()?.url;
    }
    getSummary() {
        return this.facts.map(f => `## ${f.title} (${f.url})\n${f.summary}\n${f.prices.length ? `Prices: ${f.prices.join(', ')}` : ''}\n${f.ratings.length ? `Ratings: ${f.ratings.join(', ')}` : ''}\nKey facts: ${f.keyFacts.join('; ')}`).join('\n\n');
    }
    getFactCount() { return this.facts.length; }
    getVisitedCount() { return this.visitedUrls.size; }
    getQueueSize() { return this.urlQueue.length; }
}
/**
 * Enhanced SharedResearchMemory implementation with intelligent capabilities
 */
class EnhancedSharedResearchMemoryImpl extends SharedResearchMemory {
    intelligentFacts = [];
    researchContext;
    relevanceHistory = [];
    contentGaps = [];
    // ============================================================================
    // Enhanced Fact Management
    // ============================================================================
    addIntelligentFact(fact) {
        this.intelligentFacts.push(fact);
        // Also add to base facts for compatibility
        this.addFact({
            url: fact.url,
            title: fact.title || '',
            summary: fact.summary || '',
            prices: fact.prices || [],
            ratings: fact.ratings || [],
            keyFacts: fact.keyFacts || [],
            timestamp: fact.timestamp,
            category: fact.category
        });
        // Update content gaps based on new fact
        this.updateContentGapsFromFact(fact);
    }
    getIntelligentFacts() {
        return [...this.intelligentFacts];
    }
    getFactsByCategory(category) {
        return this.intelligentFacts.filter(fact => fact.category === category);
    }
    getHighQualityFacts(minQuality = 0.7) {
        return this.intelligentFacts.filter(fact => fact.contentQuality >= minQuality);
    }
    // ============================================================================
    // Content Gap Analysis
    // ============================================================================
    getContentGaps() {
        this.updateContentGaps();
        return [...this.contentGaps];
    }
    updateContentGaps() {
        if (!this.researchContext)
            return;
        const gaps = [];
        const categories = this.analyzeCategoryCoverage();
        // Check for missing categories based on research goals
        for (const goal of this.researchContext.goals) {
            const requiredCategory = this.mapGoalToCategory(goal);
            if (requiredCategory && categories[requiredCategory] < 0.3) {
                gaps.push({
                    category: requiredCategory,
                    description: `Insufficient information about ${requiredCategory}`,
                    priority: this.calculateGapPriority(requiredCategory, goal),
                    suggestedSources: this.suggestSourcesForCategory(requiredCategory)
                });
            }
        }
        // Check for incomplete areas
        const incompleteAreas = this.identifyIncompleteAreas();
        for (const area of incompleteAreas) {
            gaps.push({
                category: area.category,
                description: area.description,
                priority: area.priority,
                suggestedSources: area.suggestedSources
            });
        }
        this.contentGaps = gaps;
    }
    updateContentGapsFromFact(fact) {
        // Remove gaps that this fact addresses
        this.contentGaps = this.contentGaps.filter(gap => {
            const factAddressesGap = fact.contentGapsFilled.includes(gap.category) ||
                fact.category === gap.category;
            return !factAddressesGap;
        });
    }
    analyzeCategoryCoverage() {
        const categories = {
            pricing: 0,
            features: 0,
            documentation: 0,
            reviews: 0,
            technical: 0,
            competitive: 0
        };
        const totalFacts = this.intelligentFacts.length;
        if (totalFacts === 0)
            return categories;
        // Count facts by category
        const categoryCounts = {};
        for (const fact of this.intelligentFacts) {
            categoryCounts[fact.category] = (categoryCounts[fact.category] || 0) + 1;
        }
        // Calculate coverage scores (0-1)
        for (const [category, count] of Object.entries(categoryCounts)) {
            if (category in categories) {
                categories[category] = Math.min(1, count / Math.max(1, totalFacts * 0.2));
            }
        }
        return categories;
    }
    mapGoalToCategory(goal) {
        const goalLower = goal.toLowerCase();
        if (goalLower.includes('pricing') || goalLower.includes('cost'))
            return 'pricing';
        if (goalLower.includes('features') || goalLower.includes('capabilities'))
            return 'features';
        if (goalLower.includes('documentation') || goalLower.includes('docs'))
            return 'documentation';
        if (goalLower.includes('review') || goalLower.includes('rating'))
            return 'reviews';
        if (goalLower.includes('technical') || goalLower.includes('specs'))
            return 'technical';
        if (goalLower.includes('comparison') || goalLower.includes('competitive'))
            return 'competitive';
        return null;
    }
    calculateGapPriority(category, goal) {
        // Priority based on category importance and goal urgency
        const categoryPriorities = {
            pricing: 0.9,
            features: 0.8,
            reviews: 0.7,
            technical: 0.6,
            documentation: 0.5,
            competitive: 0.4
        };
        const basePriority = categoryPriorities[category] || 0.3;
        // Boost priority if goal explicitly mentions urgency
        const urgencyBoost = goal.toLowerCase().includes('urgent') ||
            goal.toLowerCase().includes('important') ? 0.2 : 0;
        return Math.min(1, basePriority + urgencyBoost);
    }
    suggestSourcesForCategory(category) {
        const suggestions = {
            pricing: ['pricing page', 'plans page', 'cost calculator'],
            features: ['features page', 'product overview', 'capabilities section'],
            documentation: ['docs site', 'API reference', 'user guide'],
            reviews: ['review sites', 'testimonials page', 'case studies'],
            technical: ['technical specs', 'system requirements', 'architecture docs'],
            competitive: ['comparison pages', 'alternatives section', 'vs competitors']
        };
        return suggestions[category] || ['product pages', 'official website'];
    }
    identifyIncompleteAreas() {
        const incomplete = [];
        // Check for categories with low-quality facts
        const categoryQuality = this.calculateCategoryQuality();
        for (const [category, quality] of Object.entries(categoryQuality)) {
            if (quality < 0.6 && quality > 0) { // Has some facts but low quality
                incomplete.push({
                    category,
                    description: `Low quality information about ${category}`,
                    priority: 0.6,
                    suggestedSources: this.suggestSourcesForCategory(category)
                });
            }
        }
        return incomplete;
    }
    calculateCategoryQuality() {
        const categoryQuality = {};
        const categoryFacts = {};
        // Group facts by category
        for (const fact of this.intelligentFacts) {
            if (!categoryFacts[fact.category]) {
                categoryFacts[fact.category] = [];
            }
            categoryFacts[fact.category].push(fact);
        }
        // Calculate average quality per category
        for (const [category, facts] of Object.entries(categoryFacts)) {
            const avgQuality = facts.reduce((sum, fact) => sum + fact.contentQuality, 0) / facts.length;
            categoryQuality[category] = avgQuality;
        }
        return categoryQuality;
    }
    // ============================================================================
    // Research Progress Tracking
    // ============================================================================
    getResearchProgress() {
        if (!this.researchContext) {
            return {
                completionPercentage: 0,
                categoryCoverage: {
                    pricing: 0,
                    features: 0,
                    documentation: 0,
                    reviews: 0,
                    technical: 0,
                    competitive: 0
                },
                qualityScore: 0,
                remainingGoals: []
            };
        }
        const categoryCoverage = this.analyzeCategoryCoverage();
        const completionPercentage = this.calculateCompletionPercentage();
        const qualityScore = this.calculateOverallQualityScore();
        const remainingGoals = this.identifyRemainingGoals();
        return {
            completionPercentage,
            categoryCoverage,
            qualityScore,
            remainingGoals
        };
    }
    calculateCompletionPercentage() {
        if (!this.researchContext)
            return 0;
        const totalGoals = this.researchContext.goals.length;
        const completedGoals = this.researchContext.goals.filter(goal => this.isGoalCompleted(goal)).length;
        return totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
    }
    isGoalCompleted(goal) {
        const category = this.mapGoalToCategory(goal);
        if (!category)
            return false;
        const categoryFacts = this.getFactsByCategory(category);
        const hasHighQualityFacts = categoryFacts.some(fact => fact.contentQuality > 0.7);
        const hasMinimumFacts = categoryFacts.length >= 2;
        return hasHighQualityFacts && hasMinimumFacts;
    }
    calculateOverallQualityScore() {
        if (this.intelligentFacts.length === 0)
            return 0;
        const totalQuality = this.intelligentFacts.reduce((sum, fact) => sum + fact.contentQuality, 0);
        return totalQuality / this.intelligentFacts.length;
    }
    identifyRemainingGoals() {
        if (!this.researchContext)
            return [];
        return this.researchContext.goals.filter(goal => !this.isGoalCompleted(goal));
    }
    // ============================================================================
    // Context Management
    // ============================================================================
    updateResearchContext(context) {
        this.researchContext = context;
        this.updateContentGaps();
    }
    getResearchContext() {
        return this.researchContext;
    }
    // ============================================================================
    // Relevance History Tracking
    // ============================================================================
    getRelevanceHistory() {
        return [...this.relevanceHistory];
    }
    addRelevanceHistory(entry) {
        this.relevanceHistory.push(entry);
        // Keep only the last 500 entries to prevent memory issues
        if (this.relevanceHistory.length > 500) {
            this.relevanceHistory = this.relevanceHistory.slice(-500);
        }
    }
    getRelevanceAccuracy() {
        if (this.relevanceHistory.length === 0)
            return 0;
        const accuracyScores = this.relevanceHistory.map(entry => {
            const diff = Math.abs(entry.predictedScore - entry.actualScore);
            return Math.max(0, 1 - diff / 100); // Normalize to 0-1
        });
        return accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
    }
    // ============================================================================
    // Enhanced Summary and Statistics
    // ============================================================================
    getEnhancedSummary() {
        const baseSummary = this.getSummary();
        const progress = this.getResearchProgress();
        const gaps = this.getContentGaps();
        let enhancedSummary = baseSummary;
        enhancedSummary += `\n\nIntelligent Analysis:`;
        enhancedSummary += `\n- Research Progress: ${progress.completionPercentage.toFixed(1)}%`;
        enhancedSummary += `\n- Quality Score: ${(progress.qualityScore * 100).toFixed(1)}%`;
        enhancedSummary += `\n- Content Gaps: ${gaps.length}`;
        if (gaps.length > 0) {
            enhancedSummary += `\n- Priority Gaps: ${gaps
                .filter(gap => gap.priority > 0.7)
                .map(gap => gap.category)
                .join(', ')}`;
        }
        if (progress.remainingGoals.length > 0) {
            enhancedSummary += `\n- Remaining Goals: ${progress.remainingGoals.length}`;
        }
        return enhancedSummary;
    }
    getIntelligentStats() {
        const totalIntelligentFacts = this.intelligentFacts.length;
        if (totalIntelligentFacts === 0) {
            return {
                totalIntelligentFacts: 0,
                averageQuality: 0,
                averageRelevance: 0,
                categoryDistribution: {},
                topCategories: []
            };
        }
        const averageQuality = this.intelligentFacts.reduce((sum, fact) => sum + fact.contentQuality, 0) / totalIntelligentFacts;
        const averageRelevance = this.intelligentFacts.reduce((sum, fact) => sum + fact.relevanceScore, 0) / totalIntelligentFacts;
        const categoryDistribution = {};
        for (const fact of this.intelligentFacts) {
            categoryDistribution[fact.category] = (categoryDistribution[fact.category] || 0) + 1;
        }
        const topCategories = Object.entries(categoryDistribution)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([category]) => category);
        return {
            totalIntelligentFacts,
            averageQuality,
            averageRelevance,
            categoryDistribution,
            topCategories
        };
    }
}
exports.EnhancedSharedResearchMemoryImpl = EnhancedSharedResearchMemoryImpl;
