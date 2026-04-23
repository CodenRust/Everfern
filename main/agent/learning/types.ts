/**
 * Core types and interfaces for the Continuous Learning Agent system
 */

import { ChatMessage } from '../../acp/types';

// Learning Context Types
export interface LearningContext {
  interactionId: string;
  userId?: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  success: boolean;
  tools: ToolCall[];
  messages: ChatMessage[];
  outcome: InteractionOutcome;
}

export interface ToolCall {
  name: string;
  toolName: string;
  args: any;
  result?: ToolResult;
  error?: Error;
  startTime: number;
  endTime?: number;
  timestamp: number;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface InteractionOutcome {
  type: 'success' | 'failure' | 'partial' | 'error';
  description: string;
  metrics?: {
    duration: number;
    toolsUsed: number;
    errorsEncountered: number;
  };
}

// Learning Opportunity Types
export interface LearningOpportunity {
  id: string;
  type: LearningOpportunityType;
  priority: number;
  context: LearningContext;
  extractedData: any;
  confidence: number;
  timestamp: Date;
}

export type LearningOpportunityType =
  | 'user_preference'
  | 'tool_pattern'
  | 'problem_solving'
  | 'workflow_optimization'
  | 'error_recovery';

// Pattern Detection Types
export interface UserPreference {
  category: 'formatting' | 'output' | 'workflow' | 'technology' | 'communication';
  description: string;
  confidence: number;
  evidence: string[];
  applicableContexts: string[];
}

export interface ToolUsagePattern {
  toolCombination: string[];
  sequence: boolean;
  parallel: boolean;
  effectiveness: number;
  context: string;
  frequency: number;
}

export interface ProblemSolvingPattern {
  problemType: string;
  approach: string;
  steps: string[];
  successRate: number;
  applicableScenarios: string[];
}

export interface WorkflowPattern {
  workflowType: string;
  optimizations: string[];
  timesSaved: number;
  applicableContexts: string[];
}

// Analysis Results
export interface InteractionAnalysis {
  interactionId: string;
  analysisTimestamp: Date;
  successIndicators: {
    taskCompleted: boolean;
    userSatisfied: boolean;
    noErrors: boolean;
    meaningfulOutput: boolean;
  };
  extractedPatterns: {
    userPreferences: UserPreference[];
    toolUsagePatterns: ToolUsagePattern[];
    problemSolvingApproaches: ProblemSolvingPattern[];
    workflowOptimizations: WorkflowPattern[];
  };
  learningOpportunities: LearningOpportunity[];
  filteredContent: {
    removedSessionData: string[];
    removedPII: string[];
    removedCompletionIndicators: string[];
  };
}

// Background Processing Types
export interface LearningTask {
  id: string;
  type: 'analyze' | 'synthesize' | 'store' | 'prune';
  priority: number;
  data: any;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface ProcessingQueue {
  tasks: LearningTask[];
  isProcessing: boolean;
  maxConcurrency: number;
  resourceLimits: {
    maxCpuPercent: number;
    maxMemoryMB: number;
  };
}

// Error Handling Types
export interface LearningError {
  type: 'analysis' | 'storage' | 'processing' | 'security';
  code: LearningErrorCode;
  message: string;
  context?: any;
  timestamp: Date;
  recoverable: boolean;
  retryAfter?: number;
}

export type LearningErrorCode =
  | 'ANALYSIS_TIMEOUT'
  | 'ANALYSIS_FAILED'
  | 'PATTERN_DETECTION_FAILED'
  | 'PII_DETECTION_FAILED'
  | 'STORAGE_FULL'
  | 'STORAGE_FAILED'
  | 'STORAGE_ERROR'
  | 'KNOWLEDGE_VALIDATION_FAILED'
  | 'PROCESSING_OVERLOAD'
  | 'PROCESSING_FAILED'
  | 'RESOURCE_EXHAUSTED'
  | 'QUEUE_OVERFLOW'
  | 'SECURITY_VIOLATION'
  | 'PII_DETECTED'
  | 'ENCRYPTION_FAILED'
  | 'ACCESS_DENIED';

export interface SecurityContext {
  sessionId: string;
  userId?: string;
  interactionId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface LearningErrorHandler {
  handleAnalysisError(error: LearningError, context: LearningContext): Promise<void>;
  handleStorageError(error: LearningError, knowledge: LearnedKnowledge): Promise<void>;
  handleProcessingError(error: LearningError, task: LearningTask): Promise<void>;
  handleSecurityError(error: LearningError, context: SecurityContext): Promise<void>;
}

export interface SecurityError extends LearningError {
  type: 'security';
  violationType: 'pii_detected' | 'encryption_failed' | 'access_violation';
  sensitiveData?: string[];
}

// Learning System Configuration
export interface LearningConfig {
  enabled: boolean;
  analysisTimeoutMs: number;
  maxCpuPercent: number;
  maxMemoryMB: number;
  confidenceThreshold: number;
  pruningInterval: number;
  encryptSensitivePatterns: boolean;
  logLearningActivities: boolean;
  domains: Record<string, {
    enabled: boolean;
    priority: number;
  }>;
  backgroundProcessing: {
    enabled: boolean;
    maxCpuPercent: number;
    maxMemoryMB: number;
    idleThresholdMs: number;
  };
  privacy: {
    enablePIIDetection: boolean;
    enableEncryption: boolean;
    dataRetentionDays: number;
  };
  quality: {
    minConfidenceThreshold: number;
    pruningInterval: number;
    maxKnowledgeEntries: number;
  };
  transparency: {
    enableLogging: boolean;
    enableUserQueries: boolean;
    enableExplanations: boolean;
  };
}

// Learning Node Interface
export interface LearningNode {
  analyzeInteraction(context: LearningContext): Promise<void>;
  processLearningQueue(): Promise<void>;
  retrieveRelevantKnowledge(query: string): Promise<LearnedKnowledge[]>;
  explainDecisionInfluence(decisionId: string): Promise<string>;
}

// Learning Hooks Interface
export interface LearningHooks {
  onToolStart(toolName: string, args: any, context: ExecutionContext): void;
  onToolComplete(toolName: string, result: ToolResult, context: ExecutionContext): void;
  onToolError(toolName: string, error: Error, context: ExecutionContext): void;
  onInteractionComplete(context: LearningContext): Promise<void>;
}

export interface ExecutionContext {
  sessionId: string;
  userId?: string;
  interactionId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

// Additional types for background processing and resource management
export interface ResourceUsage {
  cpuPercent: number;
  memoryMB: number;
  timestamp: Date;
}

export interface ResourceLimits {
  maxCpuPercent: number;
  maxMemoryMB: number;
}

export interface ValidationInfo {
  accuracyScore: number;
  relevanceScore: number;
  qualityScore: number;
  lastValidated: Date;
  validationMethod: string;
}

// Re-export LearnedKnowledge from memory manager to avoid circular imports
export interface LearnedKnowledge {
  id: string;
  type: 'pattern' | 'preference' | 'workflow' | 'tool_combination';
  title: string;
  content: string;
  context: string;
  applicabilityConditions: string[];
  confidence: number;
  frequency: number;
  lastUsed: Date;
  created: Date;
  tags: string[];
  provenance: {
    sourceInteractions: string[];
    extractionMethod: string;
    validationScore: number;
  };
  metadata: {
    domain?: string;
    toolsInvolved?: string[];
    userPreference?: boolean;
    encrypted?: boolean;
  };
}
