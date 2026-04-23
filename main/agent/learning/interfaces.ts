/**
 * EverFern Desktop — Learning System Core Interfaces
 *
 * Abstract base interfaces for all learning system components.
 * These interfaces define the contracts that concrete implementations must follow.
 */

import type {
  LearningContext,
  LearningOpportunity,
  LearnedKnowledge,
  InteractionAnalysis,
  LearningTask,
  UserPreference,
  ToolUsagePattern,
  ProblemSolvingPattern,
  WorkflowPattern,
  ValidationInfo,
  ResourceUsage,
  ResourceLimits,
  LearningConfig
} from './types';

// ── Core Learning Agent Interface ────────────────────────────────────

/**
 * Main orchestrator for the continuous learning system.
 * Coordinates all learning activities and integrates with the agent architecture.
 */
export interface ILearningAgent {
  /**
   * Analyze a completed interaction for learning opportunities.
   * This is the main entry point triggered after successful interactions.
   */
  analyzeInteraction(context: LearningContext): Promise<void>;

  /**
   * Process queued learning tasks during idle periods.
   * Respects resource constraints and user activity.
   */
  processLearningQueue(): Promise<void>;

  /**
   * Retrieve relevant learned knowledge for a given query or context.
   * Used during agent decision-making to apply learned patterns.
   */
  retrieveRelevantKnowledge(query: string, limit?: number): Promise<LearnedKnowledge[]>;

  /**
   * Explain how learned knowledge influenced a specific decision.
   * Provides transparency into the learning system's impact.
   */
  explainDecisionInfluence(decisionId: string): Promise<string>;

  /**
   * Get current learning system status and metrics.
   */
  getStatus(): Promise<LearningSystemStatus>;

  /**
   * Update learning system configuration.
   */
  updateConfig(config: Partial<LearningConfig>): Promise<void>;
}

// ── Interaction Analysis Interface ───────────────────────────────────

/**
 * Analyzes interactions to determine learning value and extract opportunities.
 */
export interface IInteractionAnalyzer {
  /**
   * Perform comprehensive analysis of an interaction.
   * Returns structured analysis with patterns and opportunities.
   */
  analyzeInteraction(context: LearningContext): Promise<InteractionAnalysis>;

  /**
   * Filter interactions to identify successful ones worth learning from.
   * Removes failed interactions, errors, and incomplete tasks.
   */
  filterSuccessfulInteractions(contexts: LearningContext[]): Promise<LearningContext[]>;

  /**
   * Extract specific learning opportunities from an interaction.
   * Identifies patterns, preferences, and optimization opportunities.
   */
  extractLearningOpportunities(context: LearningContext): Promise<LearningOpportunity[]>;

  /**
   * Sanitize interaction data to remove PII and session-specific information.
   * Ensures privacy compliance and prevents false task completion states.
   */
  sanitizeInteractionData(context: LearningContext): Promise<LearningContext>;

  /**
   * Validate that an interaction is suitable for learning.
   * Checks success indicators and data quality.
   */
  validateInteractionForLearning(context: LearningContext): Promise<boolean>;
}

// ── Pattern Detection Interface ──────────────────────────────────────

/**
 * Detects recurring patterns across multiple interactions.
 */
export interface IPatternDetector {
  /**
   * Detect user preference patterns from interaction history.
   * Identifies formatting, workflow, and communication preferences.
   */
  detectUserPreferences(interactions: LearningContext[]): Promise<UserPreference[]>;

  /**
   * Detect effective tool usage patterns and combinations.
   * Identifies successful tool sequences and parallel usage.
   */
  detectToolUsagePatterns(interactions: LearningContext[]): Promise<ToolUsagePattern[]>;

  /**
   * Detect successful problem-solving approaches.
   * Identifies effective strategies for different problem types.
   */
  detectProblemSolvingPatterns(interactions: LearningContext[]): Promise<ProblemSolvingPattern[]>;

  /**
   * Detect workflow optimization opportunities.
   * Identifies patterns that could improve efficiency.
   */
  detectWorkflowOptimizations(interactions: LearningContext[]): Promise<WorkflowPattern[]>;

  /**
   * Detect meta-patterns across existing knowledge.
   * Identifies higher-level patterns from learned knowledge.
   */
  detectMetaPatterns(knowledge: LearnedKnowledge[]): Promise<LearnedKnowledge[]>;

  /**
   * Validate detected patterns for accuracy and relevance.
   */
  validatePatterns(patterns: any[]): Promise<any[]>;
}

// ── Knowledge Synthesis Interface ────────────────────────────────────

/**
 * Converts raw patterns into structured, actionable knowledge.
 */
export interface IKnowledgeSynthesizer {
  /**
   * Synthesize structured knowledge from interaction analysis.
   * Creates knowledge entries with proper metadata and validation.
   */
  synthesizeKnowledge(analysis: InteractionAnalysis): Promise<LearnedKnowledge[]>;

  /**
   * Validate knowledge quality and relevance.
   * Assigns accuracy, relevance, and quality scores.
   */
  validateKnowledge(knowledge: LearnedKnowledge): Promise<ValidationInfo>;

  /**
   * Resolve conflicts between competing knowledge entries.
   * Uses recency, frequency, and confidence weighting.
   */
  resolveConflicts(conflicting: LearnedKnowledge[]): Promise<LearnedKnowledge>;

  /**
   * Assign confidence scores to knowledge based on evidence.
   * Considers source quality, frequency, and validation results.
   */
  assignConfidenceScore(knowledge: LearnedKnowledge): Promise<number>;

  /**
   * Create structured knowledge entry from raw pattern data.
   * Standardizes format and adds required metadata.
   */
  createStructuredEntry(pattern: any, type: string): Promise<LearnedKnowledge>;

  /**
   * Update existing knowledge with new evidence.
   * Reinforces or adjusts confidence based on new data.
   */
  updateKnowledgeWithEvidence(knowledge: LearnedKnowledge, evidence: any): Promise<LearnedKnowledge>;
}

// ── Background Processing Interface ──────────────────────────────────

/**
 * Manages non-blocking learning operations with resource constraints.
 */
export interface IBackgroundProcessor {
  /**
   * Queue a learning task for background processing.
   * Respects priority and resource constraints.
   */
  queueLearningTask(task: LearningTask): Promise<void>;

  /**
   * Process queued tasks during idle periods.
   * Monitors resource usage and user activity.
   */
  processQueue(): Promise<void>;

  /**
   * Check if the system is currently idle and available for processing.
   */
  isIdle(): boolean;

  /**
   * Get current resource usage metrics.
   */
  getResourceUsage(): ResourceUsage;

  /**
   * Set resource limits for background processing.
   */
  setResourceLimits(limits: ResourceLimits): void;

  /**
   * Prioritize tasks in the processing queue.
   * Orders tasks by priority, age, and resource requirements.
   */
  prioritizeTasks(tasks: LearningTask[]): LearningTask[];

  /**
   * Clear completed or failed tasks from the queue.
   */
  cleanupQueue(): Promise<void>;

  /**
   * Get queue status and metrics.
   */
  getQueueStatus(): QueueStatus;
}

// ── Memory Integration Interface ─────────────────────────────────────

/**
 * Extends the existing memory system with learning-specific storage.
 */
export interface ILearningMemory {
  /**
   * Store learned knowledge in the memory system.
   * Integrates with existing vector database.
   */
  storeLearning(knowledge: LearnedKnowledge): Promise<void>;

  /**
   * Retrieve learned knowledge matching a query.
   * Uses vector similarity and metadata filtering.
   */
  retrieveLearning(query: string, limit?: number): Promise<LearnedKnowledge[]>;

  /**
   * Update confidence score for existing knowledge.
   * Adjusts based on successful applications or new evidence.
   */
  updateLearningConfidence(id: string, delta: number): Promise<void>;

  /**
   * Remove low-confidence or outdated knowledge.
   * Maintains knowledge base quality over time.
   */
  pruneLowConfidenceKnowledge(threshold: number): Promise<void>;

  /**
   * Query user-specific preferences and patterns.
   * Filters knowledge by user context when available.
   */
  queryUserPreferences(userId?: string): Promise<LearnedKnowledge[]>;

  /**
   * Get provenance information for knowledge entry.
   * Provides audit trail for knowledge sources.
   */
  getKnowledgeProvenance(id: string): Promise<any>;

  /**
   * Validate integrity of stored knowledge.
   * Checks for corruption or inconsistencies.
   */
  validateKnowledgeIntegrity(): Promise<boolean>;
}

// ── Supporting Types ─────────────────────────────────────────────────

export interface LearningSystemStatus {
  enabled: boolean;
  queueDepth: number;
  resourceUsage: ResourceUsage;
  knowledgeCount: number;
  lastProcessingTime: Date;
  errorCount: number;
  successRate: number;
}

export interface QueueStatus {
  totalTasks: number;
  pendingTasks: number;
  processingTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
}

// ── Factory Interface ────────────────────────────────────────────────

/**
 * Factory for creating learning system components.
 * Enables dependency injection and testing.
 */
export interface ILearningSystemFactory {
  createLearningAgent(config: LearningConfig): ILearningAgent;
  createInteractionAnalyzer(): IInteractionAnalyzer;
  createPatternDetector(): IPatternDetector;
  createKnowledgeSynthesizer(): IKnowledgeSynthesizer;
  createBackgroundProcessor(): IBackgroundProcessor;
  createLearningMemory(): ILearningMemory;
}
