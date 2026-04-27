/**
 * Context Management Type Definitions
 */

export interface CodingSession {
  id: string;
  startTime: number;
  lastActivity: number;
  projectPath: string;
  codebaseAnalysis?: any;
  conversationHistory: ConversationEntry[];
  fileChanges: FileChange[];
  activeFiles: string[];
  userPreferences: UserPreferences;
  currentTask?: TaskContext;
}

export interface ConversationEntry {
  id: string;
  timestamp: number;
  type: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  suggestions?: any[];
  filesReferenced?: string[];
  codeGenerated?: boolean;
  taskCompleted?: boolean;
  intent?: string;
  confidence?: number;
}

export interface FileChange {
  id: string;
  timestamp: number;
  file: string;
  type: 'create' | 'modify' | 'delete' | 'rename';
  before?: string;
  after?: string;
  reason: string;
  relatedConversation?: string;
}

export interface TaskContext {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  startTime: number;
  estimatedEffort: 'low' | 'medium' | 'high';
  relatedFiles: string[];
  subtasks: SubTask[];
  progress: number;
}

export type TaskType =
  | 'feature'
  | 'bug-fix'
  | 'refactor'
  | 'optimization'
  | 'documentation'
  | 'testing';

export type TaskStatus =
  | 'planning'
  | 'in-progress'
  | 'completed'
  | 'paused'
  | 'blocked';

export interface SubTask {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  file?: string;
  estimatedTime?: number;
}

export interface UserPreferences {
  codingStyle: 'functional' | 'object-oriented' | 'mixed';
  preferredFrameworks: string[];
  testingApproach: 'tdd' | 'unit-first' | 'integration-first' | 'minimal';
  codeVerbosity: 'minimal' | 'moderate' | 'verbose';
  securityLevel: 'basic' | 'standard' | 'high' | 'paranoid';
  performancePriority: 'readability' | 'balanced' | 'performance';
  documentationLevel: 'minimal' | 'standard' | 'comprehensive';
}

export interface ContextSnapshot {
  timestamp: number;
  activeFiles: string[];
  currentTask?: TaskContext;
  recentChanges: FileChange[];
  conversationSummary: string;
  codebaseState: CodebaseState;
}

export interface CodebaseState {
  totalFiles: number;
  linesOfCode: number;
  testCoverage?: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
}

export interface SessionStats {
  duration: number;
  filesModified: number;
  conversationLength: number;
  tasksCompleted: number;
  productivity: 'low' | 'medium' | 'high';
}
