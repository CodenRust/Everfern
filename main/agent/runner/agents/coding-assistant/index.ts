/**
 * AI Coding Assistant - Main Entry Point
 *
 * A hands-off coding tool that works like Windsurf/Cursor for Kiro.
 * Intelligently understands any codebase and provides context-aware assistance.
 */

export { getCodebaseAnalyzer, resetCodebaseAnalyzer } from './codebase-analyzer';
export { getIntelligentSuggestionsEngine, resetIntelligentSuggestionsEngine } from './intelligent-suggestions';
export { getContextManager, resetContextManager } from './context-manager';

export type { CodebaseAnalysis } from './codebase-analyzer';
export type { IntelligentSuggestion, SuggestionContext } from './intelligent-suggestions';
export type { CodingSession, ConversationEntry, FileChange, TaskContext } from './context-manager';

// Core assistant functionality
export { AIAssistantEngine } from './core/assistant-engine';
export type { AIAssistantConfig, AssistantContext } from './core/assistant-engine';

// Types
export type * from './types/assistant.types';
export type * from './types/analysis.types';
export type * from './types/suggestion.types';
export type * from './types/context.types';
