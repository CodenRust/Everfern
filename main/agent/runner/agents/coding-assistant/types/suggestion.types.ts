/**
 * Intelligent Suggestion Type Definitions
 */

export interface IntelligentSuggestion {
  id: string;
  type: SuggestionType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  code?: CodeSuggestion;
  relatedFiles?: string[];
  tags: string[];
  category: string;
}

export type SuggestionType =
  | 'completion'
  | 'refactor'
  | 'fix'
  | 'optimize'
  | 'test'
  | 'security'
  | 'performance'
  | 'best-practice'
  | 'documentation'
  | 'architecture';

export interface CodeSuggestion {
  file: string;
  before?: string;
  after: string;
  line?: number;
  language?: string;
}

export interface SuggestionContext {
  userInput: string;
  currentFile?: string;
  selectedText?: string;
  cursorPosition?: { line: number; column: number };
  recentChanges: FileChange[];
  codebaseAnalysis: any;
}

export interface FileChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: number;
}

export interface SuggestionFilter {
  types?: SuggestionType[];
  minConfidence?: number;
  maxEffort?: 'low' | 'medium' | 'high';
  tags?: string[];
  categories?: string[];
}

export interface SuggestionResult {
  suggestions: IntelligentSuggestion[];
  totalCount: number;
  appliedFilters: SuggestionFilter;
  generatedAt: number;
}
