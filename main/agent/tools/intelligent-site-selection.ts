/**
 * Intelligent Site Selection System for Browser-Use Tool
 *
 * This module provides AI-powered site selection, relevance assessment, and strategic
 * navigation capabilities to enhance the browser-use tool's research efficiency.
 */

import { AIClient } from '../../lib/ai-client';

// ============================================================================
// Browser-Use Compatibility Types
// ============================================================================

/**
 * ExtractedFact interface that matches browser-use.ts
 */
export interface ExtractedFact {
  url: string;
  title: string;
  summary: string;
  prices: string[];
  ratings: string[];
  keyFacts: string[];
  timestamp: number;
}

/**
 * PageContent interface that matches browser-use.ts
 */
export interface PageContent {
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
}

/**
 * SharedResearchMemory interface that matches browser-use.ts
 */
export interface SharedResearchMemory {
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

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Research context containing task information and current state
 */
export interface ResearchContext {
  taskDescription: string;
  goals: string[];
  keywords: string[];
  currentPhase: ResearchPhase;
  timeConstraints: TimeConstraints;
  qualityRequirements: QualityRequirements;
  previousFindings: ExtractedFact[];
}

export enum ResearchPhase {
  DISCOVERY = 'discovery',
  ANALYSIS = 'analysis',
  VALIDATION = 'validation',
  COMPLETION = 'completion'
}

export interface TimeConstraints {
  maxDuration?: number;
  urgency: 'low' | 'medium' | 'high';
}

export interface QualityRequirements {
  minRelevanceScore: number;
  requireMultipleSources: boolean;
  factVerificationLevel: 'basic' | 'thorough';
}

/**
 * Site evaluation result with scoring and reasoning
 */
export interface SiteEvaluation {
  url: string;
  relevanceScore: number;
  confidenceLevel: number;
  reasoningFactors: ReasoningFactor[];
  estimatedValue: number;
  riskAssessment: RiskLevel;
}

export interface ReasoningFactor {
  factor: string;
  weight: number;
  contribution: number;
  explanation: string;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Ranked site for prioritization
 */
export interface RankedSite {
  url: string;
  rank: number;
  score: number;
  reasoning: string;
}

/**
 * Navigation planning and decision structures
 */
export interface NavigationPlan {
  primaryTargets: string[];
  secondaryTargets: string[];
  avoidanceList: string[];
  reasoning: string;
  confidence: number;
}

export interface LinkCandidate {
  url: string;
  href?: string;
  text: string;
  context: string;
  elementType: string;
  position: ElementPosition;
}

export interface ElementPosition {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  totalLinks?: number;
}

export interface PrioritizedLink {
  url: string;
  link: LinkCandidate;
  priority: number;
  reasoning: string;
}

export interface NavigationStrategy {
  approach: NavigationApproach;
  maxDepth: number;
  parallelism: number;
  focusAreas: string[];
}

export enum NavigationApproach {
  BREADTH_FIRST = 'breadth_first',
  DEPTH_FIRST = 'depth_first',
  TARGETED = 'targeted',
  ADAPTIVE = 'adaptive'
}

export interface NavigationConstraints {
  maxPages: number;
  timeLimit: number;
  avoidPatterns: string[];
  requiredPatterns: string[];
  maxDepth?: number;
}

// ============================================================================
// Content Analysis Models
// ============================================================================

/**
 * Relevance assessment with detailed scoring
 */
export interface RelevanceAssessment {
  overallScore: number;
  categoryScores: CategoryScores;
  contentQuality: number;
  informationDensity: number;
  uniquenessScore: number;
  contextualFit: number;
}

export interface CategoryScores {
  pricing: number;
  features: number;
  documentation: number;
  reviews: number;
  technical: number;
  competitive: number;
}

/**
 * Content analysis results
 */
export interface HeuristicAnalysis {
  relevanceScore: number;
  contentType: ContentType;
  informationDensity: number;
  processingRecommendation: ProcessingLevel;
  fastRejectReasons?: string[];
}

export interface DeepAnalysis {
  semanticRelevance: number;
  informationValue: number;
  contentGaps: string[];
  extractionPriority: number;
  nextActionRecommendations: string[];
}

export enum ContentType {
  PRICING = 'pricing',
  FEATURES = 'features',
  DOCUMENTATION = 'documentation',
  REVIEWS = 'reviews',
  PRODUCT = 'product',
  ADMINISTRATIVE = 'administrative',
  MEDIA = 'media',
  IRRELEVANT = 'irrelevant'
}

export enum ProcessingLevel {
  SKIP = 'skip',
  HEURISTIC_ONLY = 'heuristic_only',
  LIGHT_AI = 'light_ai',
  DEEP_AI = 'deep_ai'
}

/**
 * URL classification results
 */
export interface URLClassification {
  category: URLCategory;
  score: number;
  patterns: MatchedPattern[];
  riskLevel: RiskLevel;
  processingRecommendation: ProcessingLevel;
}

export enum URLCategory {
  PRICING = 'pricing',
  FEATURES = 'features',
  DOCUMENTATION = 'documentation',
  REVIEWS = 'reviews',
  PRODUCT = 'product',
  ADMINISTRATIVE = 'administrative',
  MEDIA = 'media',
  IRRELEVANT = 'irrelevant'
}

export interface MatchedPattern {
  pattern: string;
  confidence: number;
  impact: number;
}

// ============================================================================
// Decision Logging Models
// ============================================================================

/**
 * Decision tracking and audit trail
 */
export interface SiteSelectionDecision {
  timestamp: number;
  url: string;
  action: 'visit' | 'skip' | 'queue';
  score: number;
  reasoning: string;
  factors: DecisionFactor[];
  context: ResearchContext;
}

export interface NavigationDecision {
  timestamp: number;
  currentUrl: string;
  selectedAction: string;
  alternativeActions: string[];
  reasoning: string;
  confidence: number;
  primaryTarget?: string;
  alternativeTargets?: string[];
}

export interface DecisionFactor {
  name: string;
  value: number;
  weight: number;
  description: string;
}

export interface DecisionReport {
  sessionSummary: SessionSummary;
  decisionBreakdown: DecisionBreakdown;
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
}

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalDecisions: number;
  siteSelectionDecisions: number;
  navigationDecisions: number;
  visitedSites: number;
  skippedSites: number;
  sitesVisited: number;
  sitesSkipped: number;
  averageRelevanceScore: number;
  visitedUrls: string[];
  skippedUrls: string[];
}

export interface DecisionBreakdown {
  totalDecisions: number;
  actionDistribution: Record<string, number>;
  scoreDistribution: Record<string, number>;
  topFactors: Array<{ factor: string; averageContribution: number; frequency: number }>;
  decisionReasons: Map<string, number>;
}

export interface PerformanceMetrics {
  totalDecisions: number;
  sessionDuration: number;
  decisionsPerSecond: number;
  averageDecisionTime: number;
  visitSuccessRate: number;
  skipRate: number;
  aiCallsCount?: number;
  totalProcessingTime?: number;
}

export interface DecisionFilters {
  startTime?: number;
  endTime?: number;
  minScore?: number;
  maxScore?: number;
  actions?: string[];
  categories?: URLCategory[];
}

export interface DecisionEntry {
  decision: SiteSelectionDecision | NavigationDecision;
  type: 'site_selection' | 'navigation';
}

// ============================================================================
// Learning System Models
// ============================================================================

/**
 * Learning and adaptation structures
 */
export interface SelectionFeedback {
  sessionId: string;
  decisions: SiteSelectionDecision[];
  outcomes: ResearchOutcome[];
  userRating: number;
  improvements: string[];
}

export interface ResearchOutcome {
  url: string;
  factsExtracted: number;
  relevanceActual: number;
  timeSpent: number;
  userValue: number;
}

export interface ContentGapAnalysis {
  missingCategories: string[];
  incompleteAreas: string[];
  priorityGaps: Array<{ area: string; priority: number }>;
}

export interface ResearchProgress {
  completionPercentage: number;
  categoryCoverage: CategoryScores;
  qualityScore: number;
  remainingGoals: string[];
}

export interface RelevanceHistory {
  url: string;
  predictedScore: number;
  actualScore: number;
  timestamp: number;
}

// ============================================================================
// Enhanced Memory Models
// ============================================================================

/**
 * Enhanced fact with intelligent metadata
 */
export interface IntelligentExtractedFact extends ExtractedFact {
  // Base ExtractedFact properties from browser-use.ts:
  // url: string;
  // title: string;
  // summary: string;
  // prices: string[];
  // ratings: string[];
  // keyFacts: string[];
  // timestamp: number;

  // Additional intelligent properties
  relevanceScore: number;
  contentQuality: number;
  informationDensity: number;
  extractionConfidence: number;
  relatedTopics: string[];
  contentGapsFilled: string[];
  category: string; // Make category required for intelligent facts
}

export interface ContentGap {
  category: string;
  description: string;
  priority: number;
  suggestedSources: string[];
}

// ============================================================================
// Caching Models
// ============================================================================

/**
 * Caching system interfaces
 */
export interface CachedRelevanceAssessment {
  assessment: RelevanceAssessment;
  timestamp: number;
  contextHash: string;
  ttl: number;
}

export interface CacheInvalidationCriteria {
  olderThan?: number;
  contextChanged?: boolean;
  patternUpdated?: string;
}

export enum CacheStrategy {
  AGGRESSIVE = 'aggressive',
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative'
}

// ============================================================================
// Configuration Models
// ============================================================================

/**
 * Configuration for intelligent site selection
 */
export interface IntelligentSelectionConfig {
  relevanceThreshold: number;
  performanceMode: 'fast' | 'balanced' | 'thorough';
  learningEnabled: boolean;
  cachingStrategy: CacheStrategy;
  cachingEnabled?: boolean;
  loggingLevel: LoggingLevel;
  adaptiveWeights: boolean;
  contextAwareness?: boolean;
  cacheConfig?: {
    maxRelevanceEntries: number;
    maxPatternEntries: number;
    relevanceTTL: number;
    patternTTL: number;
  };
}

export enum LoggingLevel {
  NONE = 'none',
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
  TRACE = 'trace'
}

// ============================================================================
// Core Component Interfaces
// ============================================================================

/**
 * Site Selector - Primary orchestrator for intelligent site selection
 */
export interface SiteSelector {
  evaluateSite(url: string, context: ResearchContext): Promise<SiteEvaluation>;
  rankSites(candidates: string[], context: ResearchContext): Promise<RankedSite[]>;
  shouldVisitSite(evaluation: SiteEvaluation): boolean;
  updateSelectionStrategy(feedback: SelectionFeedback): void;
}

/**
 * Relevance Engine - AI-powered relevance assessment
 */
export interface RelevanceEngine {
  assessRelevance(content: PageContent, context: ResearchContext): Promise<RelevanceAssessment>;
  analyzeContentGaps(memory: SharedResearchMemory, goals: string[]): ContentGapAnalysis;
  adaptScoringWeights(learningData: LearningData): void;
  getCachedAssessment(contentHash: string): RelevanceAssessment | null;
}

/**
 * Navigation Reasoner - Strategic navigation decision making
 */
export interface NavigationReasoner {
  evaluateNavigationOptions(
    currentPage: PageContent,
    context: ResearchContext,
    memory: SharedResearchMemory
  ): Promise<NavigationPlan>;

  prioritizeLinks(links: LinkCandidate[], context: ResearchContext): Promise<PrioritizedLink[]>;
  shouldFollowLink(link: LinkCandidate, context: ResearchContext): Promise<boolean>;
  generateNavigationStrategy(goals: string[], constraints: NavigationConstraints): NavigationStrategy;
}

/**
 * Content Analyzer - Fast heuristic and deep AI content analysis
 */
export interface ContentAnalyzer {
  performHeuristicAnalysis(content: PageContent, context: ResearchContext): HeuristicAnalysis;
  performDeepAnalysis(content: PageContent, context: ResearchContext): Promise<DeepAnalysis>;
  extractStructuredData(content: PageContent): StructuredDataExtraction;
  assessContentQuality(content: PageContent): ContentQualityMetrics;
}

/**
 * URL Classifier - Fast pre-filtering and pattern-based URL evaluation
 */
export interface URLClassifier {
  classifyURL(url: string, context: ResearchContext): URLClassification;
  updatePatterns(learningData: PatternLearningData): void;
  getPatternConfidence(pattern: string): number;
  generateURLScore(url: string, taskKeywords: string[]): number;
}

/**
 * Decision Logger - Transparency and debugging for site selection decisions
 */
export interface DecisionLogger {
  logSiteSelection(decision: SiteSelectionDecision): void;
  logNavigationDecision(decision: NavigationDecision): void;
  generateDecisionReport(sessionId: string): DecisionReport;
  getDecisionHistory(filters: DecisionFilters): DecisionEntry[];
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface StructuredDataExtraction {
  pricing: PricingData[];
  features: FeatureData[];
  ratings: RatingData[];
  contacts: ContactData[];
}

export interface PricingData {
  plan: string;
  price: string;
  currency: string;
  period: string;
  features: string[];
}

export interface FeatureData {
  name: string;
  description: string;
  category: string;
  availability: string;
}

export interface RatingData {
  score: number;
  maxScore: number;
  reviewCount: number;
  source: string;
}

export interface ContactData {
  type: string;
  value: string;
  verified: boolean;
}

export interface ContentQualityMetrics {
  readability: number;
  completeness: number;
  accuracy: number;
  freshness: number;
  authority: number;
}

export interface LearningData {
  patterns: Pattern[];
  outcomes: ResearchOutcome[];
  feedback: SelectionFeedback[];
  weights: ScoringWeights;
}

export interface Pattern {
  type: string;
  pattern: string;
  confidence: number;
  successRate: number;
  lastUpdated: number;
}

export interface ScoringWeights {
  keywordMatch: number;
  urlPatterns: number;
  contentQuality: number;
  informationDensity: number;
  contextualFit: number;
  uniqueness: number;
  structuredData: number;
  userSignals: number;
}

export interface PatternLearningData {
  successPatterns: Pattern[];
  failurePatterns: Pattern[];
  contextualFactors: Record<string, number>;
}

// ============================================================================
// Main Intelligent Site Selection System
// ============================================================================

/**
 * Main intelligent site selection system that orchestrates all components
 */
export interface IntelligentSiteSelection {
  selector: SiteSelector;
  relevanceEngine: RelevanceEngine;
  navigationReasoner: NavigationReasoner;
  contentAnalyzer: ContentAnalyzer;
  urlClassifier: URLClassifier;
  decisionLogger: DecisionLogger;
  learningSystem: LearningSystem;
}

export interface LearningSystem {
  patternDatabase: PatternDatabase;
  feedbackProcessor: FeedbackProcessor;
  adaptationEngine: AdaptationEngine;
  performanceTracker: PerformanceTracker;
}

export interface PatternDatabase {
  getPatterns(type: string): Pattern[];
  addPattern(pattern: Pattern): void;
  updatePattern(pattern: Pattern): void;
  removePattern(patternId: string): void;
}

export interface FeedbackProcessor {
  processFeedback(feedback: SelectionFeedback): void;
  generateLearningData(): LearningData;
  updateWeights(weights: ScoringWeights): void;
}

export interface AdaptationEngine {
  adaptToContext(context: ResearchContext): void;
  optimizePerformance(metrics: PerformanceMetrics): void;
  updateStrategies(outcomes: ResearchOutcome[]): void;
}

export interface PerformanceTracker {
  trackDecisionTime(operation: string, duration: number): void;
  trackCachePerformance(hits: number, misses: number): void;
  trackResearchOutcome(outcome: ResearchOutcome): void;
  getMetrics(): PerformanceMetrics;
}

// ============================================================================
// Enhanced Shared Research Memory Interface
// ============================================================================

/**
 * Enhanced SharedResearchMemory with intelligent capabilities
 */
export interface EnhancedSharedResearchMemory extends SharedResearchMemory {
  // Existing functionality preserved
  addFact(fact: ExtractedFact): void;
  markVisited(url: string): void;
  hasVisited(url: string): boolean;

  // New intelligent capabilities
  addIntelligentFact(fact: IntelligentExtractedFact): void;
  getContentGaps(): ContentGap[];
  getResearchProgress(): ResearchProgress;
  updateResearchContext(context: ResearchContext): void;
  getRelevanceHistory(): RelevanceHistory[];
}
