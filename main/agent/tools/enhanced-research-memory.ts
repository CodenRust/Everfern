/**
 * Enhanced Shared Research Memory with Intelligent Capabilities
 *
 * This module extends the existing SharedResearchMemory with intelligent features
 * for content gap analysis, research progress tracking, and context awareness.
 */

// Define the types we need that match browser-use.ts
interface ExtractedFact {
  url: string;
  title: string;
  summary: string;
  prices: string[];
  ratings: string[];
  keyFacts: string[];
  timestamp: number;
  category?: string; // For compatibility with our intelligent system
  content?: string; // For compatibility with our intelligent system
}

// Base SharedResearchMemory implementation that matches browser-use.ts
class SharedResearchMemory {
  protected facts: ExtractedFact[] = [];
  protected visitedUrls = new Set<string>();
  protected urlQueue: Array<{ url: string; score: number }> = [];

  addFact(fact: ExtractedFact) {
    this.facts.push(fact);
    this.visitedUrls.add(fact.url);
  }

  markVisited(url: string) {
    this.visitedUrls.add(url);
  }

  hasVisited(url: string): boolean {
    try {
      const u = new URL(url);
      return this.visitedUrls.has(u.href) || this.visitedUrls.has(url);
    } catch {
      return this.visitedUrls.has(url);
    }
  }

  queueUrl(url: string, score = 50) {
    if (!this.hasVisited(url) && !this.urlQueue.find(q => q.url === url)) {
      this.urlQueue.push({ url, score });
      // Keep queue sorted by score descending — best URLs first
      this.urlQueue.sort((a, b) => b.score - a.score);
    }
  }

  dequeueUrl(): string | undefined {
    return this.urlQueue.shift()?.url;
  }

  getSummary(): string {
    return this.facts.map(f =>
      `## ${f.title} (${f.url})\n${f.summary}\n${f.prices.length ? `Prices: ${f.prices.join(', ')}` : ''}\n${f.ratings.length ? `Ratings: ${f.ratings.join(', ')}` : ''}\nKey facts: ${f.keyFacts.join('; ')}`
    ).join('\n\n');
  }

  getFactCount(): number { return this.facts.length; }
  getVisitedCount(): number { return this.visitedUrls.size; }
  getQueueSize(): number { return this.urlQueue.length; }
}
import {
  EnhancedSharedResearchMemory,
  IntelligentExtractedFact,
  ContentGap,
  ResearchProgress,
  ResearchContext,
  RelevanceHistory,
  ContentType,
  CategoryScores
} from './intelligent-site-selection';

/**
 * Enhanced SharedResearchMemory implementation with intelligent capabilities
 */
export class EnhancedSharedResearchMemoryImpl extends SharedResearchMemory implements EnhancedSharedResearchMemory {
  private intelligentFacts: IntelligentExtractedFact[] = [];
  private researchContext?: ResearchContext;
  private relevanceHistory: RelevanceHistory[] = [];
  private contentGaps: ContentGap[] = [];

  // ============================================================================
  // Enhanced Fact Management
  // ============================================================================

  addIntelligentFact(fact: IntelligentExtractedFact): void {
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

  getIntelligentFacts(): IntelligentExtractedFact[] {
    return [...this.intelligentFacts];
  }

  getFactsByCategory(category: string): IntelligentExtractedFact[] {
    return this.intelligentFacts.filter(fact => fact.category === category);
  }

  getHighQualityFacts(minQuality = 0.7): IntelligentExtractedFact[] {
    return this.intelligentFacts.filter(fact => fact.contentQuality >= minQuality);
  }

  // ============================================================================
  // Content Gap Analysis
  // ============================================================================

  getContentGaps(): ContentGap[] {
    this.updateContentGaps();
    return [...this.contentGaps];
  }

  private updateContentGaps(): void {
    if (!this.researchContext) return;

    const gaps: ContentGap[] = [];
    const categories = this.analyzeCategoryCoverage();

    // Check for missing categories based on research goals
    for (const goal of this.researchContext.goals) {
      const requiredCategory = this.mapGoalToCategory(goal);
      if (requiredCategory && (categories as unknown as Record<string, number>)[requiredCategory] < 0.3) {
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

  private updateContentGapsFromFact(fact: IntelligentExtractedFact): void {
    // Remove gaps that this fact addresses
    this.contentGaps = this.contentGaps.filter(gap => {
      const factAddressesGap = fact.contentGapsFilled.includes(gap.category) ||
                              fact.category === gap.category;
      return !factAddressesGap;
    });
  }

  private analyzeCategoryCoverage(): CategoryScores {
    const categories: CategoryScores = {
      pricing: 0,
      features: 0,
      documentation: 0,
      reviews: 0,
      technical: 0,
      competitive: 0
    };

    const totalFacts = this.intelligentFacts.length;
    if (totalFacts === 0) return categories;

    // Count facts by category
    const categoryCounts: Record<string, number> = {};
    for (const fact of this.intelligentFacts) {
      categoryCounts[fact.category] = (categoryCounts[fact.category] || 0) + 1;
    }

    // Calculate coverage scores (0-1)
    for (const [category, count] of Object.entries(categoryCounts)) {
      if (category in categories) {
        (categories as any)[category] = Math.min(1, count / Math.max(1, totalFacts * 0.2));
      }
    }

    return categories;
  }

  private mapGoalToCategory(goal: string): string | null {
    const goalLower = goal.toLowerCase();

    if (goalLower.includes('pricing') || goalLower.includes('cost')) return 'pricing';
    if (goalLower.includes('features') || goalLower.includes('capabilities')) return 'features';
    if (goalLower.includes('documentation') || goalLower.includes('docs')) return 'documentation';
    if (goalLower.includes('review') || goalLower.includes('rating')) return 'reviews';
    if (goalLower.includes('technical') || goalLower.includes('specs')) return 'technical';
    if (goalLower.includes('comparison') || goalLower.includes('competitive')) return 'competitive';

    return null;
  }

  private calculateGapPriority(category: string, goal: string): number {
    // Priority based on category importance and goal urgency
    const categoryPriorities: Record<string, number> = {
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

  private suggestSourcesForCategory(category: string): string[] {
    const suggestions: Record<string, string[]> = {
      pricing: ['pricing page', 'plans page', 'cost calculator'],
      features: ['features page', 'product overview', 'capabilities section'],
      documentation: ['docs site', 'API reference', 'user guide'],
      reviews: ['review sites', 'testimonials page', 'case studies'],
      technical: ['technical specs', 'system requirements', 'architecture docs'],
      competitive: ['comparison pages', 'alternatives section', 'vs competitors']
    };

    return suggestions[category] || ['product pages', 'official website'];
  }

  private identifyIncompleteAreas(): Array<{
    category: string;
    description: string;
    priority: number;
    suggestedSources: string[];
  }> {
    const incomplete: Array<{
      category: string;
      description: string;
      priority: number;
      suggestedSources: string[];
    }> = [];

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

  private calculateCategoryQuality(): Record<string, number> {
    const categoryQuality: Record<string, number> = {};
    const categoryFacts: Record<string, IntelligentExtractedFact[]> = {};

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

  getResearchProgress(): ResearchProgress {
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

  private calculateCompletionPercentage(): number {
    if (!this.researchContext) return 0;

    const totalGoals = this.researchContext.goals.length;
    const completedGoals = this.researchContext.goals.filter(goal =>
      this.isGoalCompleted(goal)
    ).length;

    return totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
  }

  private isGoalCompleted(goal: string): boolean {
    const category = this.mapGoalToCategory(goal);
    if (!category) return false;

    const categoryFacts = this.getFactsByCategory(category);
    const hasHighQualityFacts = categoryFacts.some(fact => fact.contentQuality > 0.7);
    const hasMinimumFacts = categoryFacts.length >= 2;

    return hasHighQualityFacts && hasMinimumFacts;
  }

  private calculateOverallQualityScore(): number {
    if (this.intelligentFacts.length === 0) return 0;

    const totalQuality = this.intelligentFacts.reduce((sum, fact) =>
      sum + fact.contentQuality, 0
    );

    return totalQuality / this.intelligentFacts.length;
  }

  private identifyRemainingGoals(): string[] {
    if (!this.researchContext) return [];

    return this.researchContext.goals.filter(goal => !this.isGoalCompleted(goal));
  }

  // ============================================================================
  // Context Management
  // ============================================================================

  updateResearchContext(context: ResearchContext): void {
    this.researchContext = context;
    this.updateContentGaps();
  }

  getResearchContext(): ResearchContext | undefined {
    return this.researchContext;
  }

  // ============================================================================
  // Relevance History Tracking
  // ============================================================================

  getRelevanceHistory(): RelevanceHistory[] {
    return [...this.relevanceHistory];
  }

  addRelevanceHistory(entry: RelevanceHistory): void {
    this.relevanceHistory.push(entry);

    // Keep only the last 500 entries to prevent memory issues
    if (this.relevanceHistory.length > 500) {
      this.relevanceHistory = this.relevanceHistory.slice(-500);
    }
  }

  getRelevanceAccuracy(): number {
    if (this.relevanceHistory.length === 0) return 0;

    const accuracyScores = this.relevanceHistory.map(entry => {
      const diff = Math.abs(entry.predictedScore - entry.actualScore);
      return Math.max(0, 1 - diff / 100); // Normalize to 0-1
    });

    return accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
  }

  // ============================================================================
  // Enhanced Summary and Statistics
  // ============================================================================

  getEnhancedSummary(): string {
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

  getIntelligentStats(): {
    totalIntelligentFacts: number;
    averageQuality: number;
    averageRelevance: number;
    categoryDistribution: Record<string, number>;
    topCategories: string[];
  } {
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

    const averageQuality = this.intelligentFacts.reduce((sum, fact) =>
      sum + fact.contentQuality, 0) / totalIntelligentFacts;

    const averageRelevance = this.intelligentFacts.reduce((sum, fact) =>
      sum + fact.relevanceScore, 0) / totalIntelligentFacts;

    const categoryDistribution: Record<string, number> = {};
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
