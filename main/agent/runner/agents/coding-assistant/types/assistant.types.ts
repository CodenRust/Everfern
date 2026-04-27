/**
 * Core Assistant Type Definitions
 */

export interface AssistantConfig {
  handsOffMode: boolean;
  proactiveMode: boolean;
  learningEnabled: boolean;
  maxSuggestions: number;
  confidenceThreshold: number;
}

export interface AssistantContext {
  userInput: string;
  projectPath: string;
  activeFiles: string[];
  recentChanges: FileChange[];
}

export interface FileChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: number;
}

export interface AssistantAction {
  type: 'create_file' | 'modify_file' | 'delete_file' | 'run_command' | 'spawn_subagent';
  target?: string;
  content?: string;
  command?: string;
  reasoning: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AssistantResponse {
  response: string;
  suggestions: any[];
  actions: AssistantAction[];
  needsUserInput: boolean;
  metadata?: {
    processingTime: number;
    analysisDepth: 'shallow' | 'medium' | 'deep';
    confidenceScore: number;
  };
}
