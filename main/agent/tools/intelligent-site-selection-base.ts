/**
 * Base Classes for Intelligent Site Selection Components
 *
 * This module provides base implementations for the intelligent site selection system,
 * offering default behavior and common functionality that can be extended by specific implementations.
 */

import { AIClient } from '../../lib/ai-client';

// Import types that we need from browser-use
// Note: These should match the interfaces in browser-use.ts
interface PageContent {
  title: string;
  url: string;
  metaDescription: string;
  headings: string[];
  paragraphs: string[];
  tables: string[][];
  links: Array<{ text: string; href: string }>;
  rawText: string;
  domTree: string;
  prices?: string[];
  ratings?: string[];
  structuredData?: string;
  text?: string; // For compatibility with our intelligent system
}

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

// We'll use a minimal interface for SharedResearchMemory to avoid circular dependencies
interface SharedResearchMemory {
  addFact(fact: ExtractedFact): void;
  markVisited(url: string): void;
  hasVisited(url: string): boolean;
  queueUrl(url: string, score?: number): void;
  dequeueUrl(): string | undefined;
  getSummary(): string;
  getFactCount(): number;
  getVisitedCount(): number;
  getQueueSize(): number;
}
import {
  SiteSelector,
  RelevanceEngine,
  NavigationReasoner,
  ContentAnalyzer,
  URLClassifier,
  DecisionLogger,
  ResearchContext,
  SiteEvaluation,
  RankedSite,
  SelectionFeedback,
  RelevanceAssessment,
  ContentGapAnalysis,
  LearningData,
  NavigationPlan,
  LinkCandidate,
  PrioritizedLink,
  NavigationStrategy,
  NavigationConstraints,
  HeuristicAnalysis,
  DeepAnalysis,
  StructuredDataExtraction,
  ContentQualityMetrics,
  URLClassification,
  PatternLearningData,
  SiteSelectionDecision,
  NavigationDecision,
  DecisionReport,
  DecisionFilters,
  DecisionEntry,
  ReasoningFactor,
  RiskLevel,
  ContentType,
  ProcessingLevel,
  URLCategory,
  MatchedPattern,
  IntelligentSelectionConfig,
  LoggingLevel
} from './intelligent-site-selection';

// ============================================================================
// Base Site Selector Implementation
// ============================================================================

export abstract class BaseSiteSelector implements SiteSelector {
  protected config: IntelligentSelectionConfig;
  protected aiClient: AIClient;

  constructor(aiClient: AIClient, config: IntelligentSelectionConfig) {
    this.aiClient = aiClient;
    this.config = config;
  }

  abstract evaluateSite(url: string, context: ResearchContext): Promise<SiteEvaluation>;
  abstract rankSites(candidates: string[], context: ResearchContext): Promise<RankedSite[]>;

  shouldVisitSite(evaluation: SiteEvaluation): boolean {
    return evaluation.relevanceScore >= this.config.relevanceThreshold;
  }

  updateSelectionStrategy(feedback: SelectionFeedback): void {
    if (this.config.learningEnabled) {
      this.processSelectionFeedback(feedback);
    }
  }

  protected abstract processSelectionFeedback(feedback: SelectionFeedback): void;

  protected createReasoningFactor(
    factor: string,
    weight: number,
    contribution: number,
    explanation: string
  ): ReasoningFactor {
    return { factor, weight, contribution, explanation };
  }

  protected assessRisk(url: string, score: number): RiskLevel {
    if (score < 20) return RiskLevel.HIGH;
    if (score < 50) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

// ============================================================================
// Base Relevance Engine Implementation
// ============================================================================

export abstract class BaseRelevanceEngine implements RelevanceEngine {
  protected aiClient: AIClient;
  protected config: IntelligentSelectionConfig;
  protected cache: Map<string, RelevanceAssessment> = new Map();

  constructor(aiClient: AIClient, config: IntelligentSelectionConfig) {
    this.aiClient = aiClient;
    this.config = config;
  }

  abstract assessRelevance(content: PageContent, context: ResearchContext): Promise<RelevanceAssessment>;
  abstract analyzeContentGaps(memory: SharedResearchMemory, goals: string[]): ContentGapAnalysis;
  abstract adaptScoringWeights(learningData: LearningData): void;

  getCachedAssessment(contentHash: string): RelevanceAssessment | null {
    return this.cache.get(contentHash) || null;
  }

  protected setCachedAssessment(contentHash: string, assessment: RelevanceAssessment): void {
    this.cache.set(contentHash, assessment);
  }

  protected generateContentHash(content: PageContent, context: ResearchContext): string {
    const contentStr = `${content.title}|${content.url}|${content.text?.substring(0, 500)}`;
    const contextStr = `${context.taskDescription}|${context.keywords.join(',')}`;
    return Buffer.from(contentStr + contextStr).toString('base64').substring(0, 32);
  }
}

// ============================================================================
// Base Navigation Reasoner Implementation
// ============================================================================

export abstract class BaseNavigationReasoner implements NavigationReasoner {
  protected aiClient: AIClient;
  protected config: IntelligentSelectionConfig;

  constructor(aiClient: AIClient, config: IntelligentSelectionConfig) {
    this.aiClient = aiClient;
    this.config = config;
  }

  abstract evaluateNavigationOptions(
    currentPage: PageContent,
    context: ResearchContext,
    memory: SharedResearchMemory
  ): Promise<NavigationPlan>;

  abstract prioritizeLinks(links: LinkCandidate[], context: ResearchContext): Promise<PrioritizedLink[]>;
  abstract shouldFollowLink(link: LinkCandidate, context: ResearchContext): Promise<boolean>;

  generateNavigationStrategy(goals: string[], constraints: NavigationConstraints): NavigationStrategy {
    return {
      approach: this.determineApproach(goals, constraints),
      maxDepth: Math.min(constraints.maxPages / 2, 5),
      parallelism: this.config.performanceMode === 'fast' ? 3 : 2,
      focusAreas: this.extractFocusAreas(goals)
    };
  }

  protected abstract determineApproach(goals: string[], constraints: NavigationConstraints): any;
  protected abstract extractFocusAreas(goals: string[]): string[];
}

// ============================================================================
// Base Content Analyzer Implementation
// ============================================================================

export abstract class BaseContentAnalyzer implements ContentAnalyzer {
  protected aiClient: AIClient;
  protected config: IntelligentSelectionConfig;

  constructor(aiClient: AIClient, config: IntelligentSelectionConfig) {
    this.aiClient = aiClient;
    this.config = config;
  }

  abstract performHeuristicAnalysis(content: PageContent, context: ResearchContext): HeuristicAnalysis;
  abstract performDeepAnalysis(content: PageContent, context: ResearchContext): Promise<DeepAnalysis>;
  abstract extractStructuredData(content: PageContent): StructuredDataExtraction;

  assessContentQuality(content: PageContent): ContentQualityMetrics {
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

  protected hasStructuredContent(content: PageContent): boolean {
    const text = content.text || '';
    return text.includes('$') || // Pricing indicators
           text.includes('•') || // Bullet points
           text.includes('\n\n') || // Paragraphs
           !!content.title;
  }

  protected calculateReadability(text: string): number {
    if (!text) return 0;

    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const avgWordsPerSentence = words / Math.max(sentences, 1);

    // Simple readability score (lower is better, normalize to 0-1)
    return Math.max(0, Math.min(1, 1 - (avgWordsPerSentence - 15) / 20));
  }

  protected determineContentType(content: PageContent): ContentType {
    const text = (content.text || '').toLowerCase();
    const url = content.url.toLowerCase();
    const title = (content.title || '').toLowerCase();

    if (url.includes('pricing') || text.includes('$') || text.includes('price')) {
      return ContentType.PRICING;
    }
    if (url.includes('features') || title.includes('features')) {
      return ContentType.FEATURES;
    }
    if (url.includes('docs') || url.includes('documentation')) {
      return ContentType.DOCUMENTATION;
    }
    if (url.includes('review') || text.includes('rating')) {
      return ContentType.REVIEWS;
    }
    if (url.includes('product') || title.includes('product')) {
      return ContentType.PRODUCT;
    }
    if (url.includes('admin') || url.includes('login') || url.includes('signup')) {
      return ContentType.ADMINISTRATIVE;
    }
    if (url.match(/\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/)) {
      return ContentType.MEDIA;
    }

    return ContentType.IRRELEVANT;
  }
}

// ============================================================================
// Base URL Classifier Implementation
// ============================================================================

export abstract class BaseURLClassifier implements URLClassifier {
  protected config: IntelligentSelectionConfig;
  protected patterns: Map<string, MatchedPattern> = new Map();

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
    this.initializeDefaultPatterns();
  }

  abstract classifyURL(url: string, context: ResearchContext): URLClassification;
  abstract updatePatterns(learningData: PatternLearningData): void;

  getPatternConfidence(pattern: string): number {
    return this.patterns.get(pattern)?.confidence || 0;
  }

  generateURLScore(url: string, taskKeywords: string[]): number {
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

  protected initializeDefaultPatterns(): void {
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

  protected categorizeURL(url: string): URLCategory {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('pricing') || urlLower.includes('price')) {
      return URLCategory.PRICING;
    }
    if (urlLower.includes('features') || urlLower.includes('capabilities')) {
      return URLCategory.FEATURES;
    }
    if (urlLower.includes('docs') || urlLower.includes('documentation')) {
      return URLCategory.DOCUMENTATION;
    }
    if (urlLower.includes('review') || urlLower.includes('rating')) {
      return URLCategory.REVIEWS;
    }
    if (urlLower.includes('product') || urlLower.includes('service')) {
      return URLCategory.PRODUCT;
    }
    if (urlLower.includes('admin') || urlLower.includes('login')) {
      return URLCategory.ADMINISTRATIVE;
    }
    if (urlLower.match(/\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/)) {
      return URLCategory.MEDIA;
    }

    return URLCategory.IRRELEVANT;
  }
}

// ============================================================================
// Base Decision Logger Implementation
// ============================================================================

export abstract class BaseDecisionLogger implements DecisionLogger {
  protected decisions: DecisionEntry[] = [];
  protected config: IntelligentSelectionConfig;

  constructor(config: IntelligentSelectionConfig) {
    this.config = config;
  }

  logSiteSelection(decision: SiteSelectionDecision): void {
    if (this.config.loggingLevel !== LoggingLevel.NONE) {
      this.decisions.push({
        decision,
        type: 'site_selection'
      });
      this.trimDecisionHistory();
    }
  }

  logNavigationDecision(decision: NavigationDecision): void {
    if (this.config.loggingLevel !== LoggingLevel.NONE) {
      this.decisions.push({
        decision,
        type: 'navigation'
      });
      this.trimDecisionHistory();
    }
  }

  abstract generateDecisionReport(sessionId: string): DecisionReport;

  getDecisionHistory(filters: DecisionFilters): DecisionEntry[] {
    return this.decisions.filter(entry => this.matchesFilters(entry, filters));
  }

  protected matchesFilters(entry: DecisionEntry, filters: DecisionFilters): boolean {
    if (entry.type === 'site_selection') {
      const decision = entry.decision as SiteSelectionDecision;

      if (filters.startTime && decision.timestamp < filters.startTime) return false;
      if (filters.endTime && decision.timestamp > filters.endTime) return false;
      if (filters.minScore && decision.score < filters.minScore) return false;
      if (filters.maxScore && decision.score > filters.maxScore) return false;
      if (filters.actions && !filters.actions.includes(decision.action)) return false;
    }

    return true;
  }

  protected trimDecisionHistory(): void {
    // Keep only the last 1000 decisions to prevent memory issues
    if (this.decisions.length > 1000) {
      this.decisions = this.decisions.slice(-1000);
    }
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_INTELLIGENT_CONFIG: IntelligentSelectionConfig = {
  relevanceThreshold: 40,
  performanceMode: 'balanced',
  learningEnabled: true,
  cachingStrategy: 'balanced' as any,
  loggingLevel: LoggingLevel.INFO,
  adaptiveWeights: true
};

// ============================================================================
// Utility Functions
// ============================================================================

export function createDefaultResearchContext(taskDescription: string): ResearchContext {
  return {
    taskDescription,
    goals: extractGoalsFromTask(taskDescription),
    keywords: extractKeywordsFromTask(taskDescription),
    currentPhase: 'discovery' as any,
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

function extractGoalsFromTask(taskDescription: string): string[] {
  const goals: string[] = [];
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

function extractKeywordsFromTask(taskDescription: string): string[] {
  // Simple keyword extraction - in a real implementation, this could use NLP
  const words = taskDescription.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'have', 'been'].includes(word));

  return [...new Set(words)].slice(0, 10); // Unique keywords, max 10
}
