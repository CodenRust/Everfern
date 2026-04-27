/**
 * AI Assistant Engine - Core Intelligence
 *
 * The main AI engine that orchestrates all coding assistance functionality.
 * Uses AI to understand codebases without hardcoded patterns.
 */

import { GraphStateType, StreamEvent } from '../../../state';
import { AgentRunner } from '../../../runner';
import { runAgentStep } from '../../../services/agent-runtime';
import { getCodebaseAnalyzer } from '../codebase-analyzer';
import { getIntelligentSuggestionsEngine } from '../intelligent-suggestions';
import { getContextManager } from '../context-manager';
import { AIMessage } from '@langchain/core/messages';

export interface AIAssistantConfig {
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
  recentChanges: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    timestamp: number;
  }>;
}

export class AIAssistantEngine {
  private config: AIAssistantConfig;
  private codebaseAnalyzer = getCodebaseAnalyzer();
  private suggestionsEngine = getIntelligentSuggestionsEngine();
  private contextManager = getContextManager();
  private intentClassifier: any;
  private conversationHandler: any;

  constructor(config: Partial<AIAssistantConfig> = {}) {
    this.config = {
      handsOffMode: true,
      proactiveMode: true,
      learningEnabled: true,
      maxSuggestions: 5,
      confidenceThreshold: 0.7,
      ...config
    };
  }

  private getIntentClassifier() {
    if (!this.intentClassifier) {
      const { createIntentClassifier } = require('./intent-classifier');
      this.intentClassifier = createIntentClassifier();
    }
    return this.intentClassifier;
  }

  private getConversationHandler() {
    if (!this.conversationHandler) {
      const { createConversationHandler } = require('./conversation-handler');
      this.conversationHandler = createConversationHandler();
    }
    return this.conversationHandler;
  }

  /**
   * Main entry point for AI assistance
   */
  async processUserRequest(
    context: AssistantContext,
    state: GraphStateType,
    eventQueue?: StreamEvent[]
  ): Promise<{
    response: string;
    suggestions: any[];
    actions: any[];
    needsUserInput: boolean;
  }> {
    try {
      // Start or continue coding session
      const sessionOrId = this.contextManager.getCurrentSession() ||
        this.contextManager.startSession(context.projectPath);

      const session = typeof sessionOrId === 'string'
        ? { id: sessionOrId, codebaseAnalysis: undefined } as any
        : sessionOrId;

      // Emit thinking event
      eventQueue?.push({
        type: 'thought',
        content: '🧠 AI Assistant: Analyzing your request and codebase context...'
      });

      // Step 1: Analyze codebase if not done recently
      let codebaseAnalysis = session.codebaseAnalysis;
      if (!codebaseAnalysis || this.shouldRefreshAnalysis(session)) {
        eventQueue?.push({
          type: 'thought',
          content: '🔍 Performing intelligent codebase analysis...'
        });

        codebaseAnalysis = await this.codebaseAnalyzer.analyzeCodebase(context.projectPath);
        this.contextManager.updateCodebaseAnalysis(codebaseAnalysis);
      }

      // Step 2: Classify user intent
      const intent = await this.getIntentClassifier().classifyIntent(context.userInput, {
        codebaseAnalysis,
        recentChanges: context.recentChanges,
        activeFiles: context.activeFiles
      });

      eventQueue?.push({
        type: 'thought',
        content: `🎯 Intent detected: ${intent.type} (${Math.round(intent.confidence * 100)}% confidence)`
      });

      // Step 3: Generate intelligent suggestions
      const suggestions = await this.suggestionsEngine.generateSuggestions({
        userInput: context.userInput,
        recentChanges: context.recentChanges,
        codebaseAnalysis
      });

      // Step 4: Handle conversation and generate response
      const conversationResult = await this.getConversationHandler().handleConversation({
        userInput: context.userInput,
        intent,
        suggestions,
        codebaseAnalysis,
        session
      });

      // Step 5: Determine actions based on hands-off mode
      const actions = this.config.handsOffMode
        ? await this.generateAutonomousActions(intent, suggestions, codebaseAnalysis)
        : await this.generateGuidedActions(intent, suggestions);

      eventQueue?.push({
        type: 'thought',
        content: `✅ Generated ${suggestions.length} suggestions and ${actions.length} potential actions`
      });

      return {
        response: conversationResult.response,
        suggestions: suggestions.slice(0, this.config.maxSuggestions),
        actions,
        needsUserInput: conversationResult.needsUserInput
      };

    } catch (error) {
      console.error('AI Assistant Engine error:', error);
      return {
        response: 'I encountered an issue analyzing your request. Let me try a different approach.',
        suggestions: [],
        actions: [],
        needsUserInput: false
      };
    }
  }

  /**
   * Generate autonomous actions for hands-off mode
   */
  private async generateAutonomousActions(
    intent: any,
    suggestions: any[],
    codebaseAnalysis: any
  ): Promise<any[]> {
    const actions = [];

    // High-confidence suggestions become automatic actions
    const highConfidenceSuggestions = suggestions.filter(
      s => s.confidence >= this.config.confidenceThreshold
    );

    for (const suggestion of highConfidenceSuggestions) {
      switch (suggestion.type) {
        case 'completion':
          if (suggestion.code) {
            actions.push({
              type: 'create_file',
              file: suggestion.code.file,
              content: suggestion.code.after,
              reasoning: suggestion.reasoning
            });
          }
          break;

        case 'fix':
          actions.push({
            type: 'fix_issue',
            description: suggestion.description,
            files: suggestion.relatedFiles || [],
            reasoning: suggestion.reasoning
          });
          break;

        case 'refactor':
          actions.push({
            type: 'refactor_code',
            description: suggestion.description,
            file: suggestion.code?.file,
            reasoning: suggestion.reasoning
          });
          break;

        case 'security':
          actions.push({
            type: 'security_fix',
            description: suggestion.description,
            priority: suggestion.priority,
            reasoning: suggestion.reasoning
          });
          break;
      }
    }

    // Intent-based actions
    switch (intent.type) {
      case 'create_component':
        actions.push({
          type: 'generate_component',
          framework: codebaseAnalysis.framework.primary,
          name: intent.details?.componentName,
          reasoning: 'User requested component creation'
        });
        break;

      case 'create_api':
        actions.push({
          type: 'generate_api',
          framework: codebaseAnalysis.framework.primary,
          endpoint: intent.details?.endpoint,
          reasoning: 'User requested API endpoint creation'
        });
        break;

      case 'setup_project':
        actions.push({
          type: 'scaffold_project',
          framework: intent.details?.framework || codebaseAnalysis.framework.primary,
          reasoning: 'User requested project setup'
        });
        break;
    }

    return actions;
  }

  /**
   * Generate guided actions that require user confirmation
   */
  private async generateGuidedActions(intent: any, suggestions: any[]): Promise<any[]> {
    return suggestions.map(suggestion => ({
      type: 'suggestion',
      suggestion,
      requiresConfirmation: true
    }));
  }

  /**
   * Check if codebase analysis should be refreshed
   */
  private shouldRefreshAnalysis(session: any): boolean {
    if (!session.codebaseAnalysis) return true;

    const lastAnalysis = session.lastActivity;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return (now - lastAnalysis) > fiveMinutes;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIAssistantConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AIAssistantConfig {
    return { ...this.config };
  }
}

/**
 * Create AI Assistant Engine node for the agent graph
 */
export function createAIAssistantEngine(config?: Partial<AIAssistantConfig>) {
  const engine = new AIAssistantEngine(config);

  return (
    runner: AgentRunner,
    eventQueue?: StreamEvent[],
    toolDefs?: any[]
  ) => {
    return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
      const tools = toolDefs || (runner as any)._buildToolDefinitions();

      // Get user input from messages
      const messages = state.messages || [];
      const lastUserMessage = messages.filter((m: any) => (m as any)._getType?.() === 'human' || (m as any).role === 'user').pop();
      const userInput = lastUserMessage?.content?.toString() || '';

      // Build context
      const context: AssistantContext = {
        userInput,
        projectPath: process.cwd(),
        activeFiles: [], // Would be populated from file system
        recentChanges: [] // Would be populated from file watcher
      };

      // Process with AI engine
      const result = await engine.processUserRequest(context, state, eventQueue);

      // If hands-off mode and we have actions, execute them
      if (engine.getConfig().handsOffMode && result.actions.length > 0) {
        eventQueue?.push({
          type: 'thought',
          content: `🚀 Executing ${result.actions.length} autonomous actions...`
        });

        // Execute actions using the agent runtime
        return runAgentStep(state, {
          runner,
          toolDefs: tools,
          eventQueue,
          nodeName: 'ai_assistant',
          systemPromptOverride: `You are an AI coding assistant in hands-off mode.

CONTEXT:
${result.response}

AUTONOMOUS ACTIONS TO EXECUTE:
${result.actions.map((action: any) => `- ${action.type}: ${action.reasoning}`).join('\n')}

SUGGESTIONS AVAILABLE:
${result.suggestions.map((s: any) => `- ${s.title}: ${s.description}`).join('\n')}

Execute the actions directly without asking for permission. Use the appropriate tools to implement the changes.
Focus on writing clean, production-ready code that follows the detected project patterns.`
        });
      }

      // Otherwise, provide guidance and suggestions
      return {
        messages: [
          ...messages,
          new AIMessage({
            content: result.response + (result.suggestions.length > 0 ?
              `\n\n**Suggestions:**\n${result.suggestions.map((s: any) => `• ${s.title}: ${s.description}`).join('\n')}` :
              ''
            )
          })
        ]
      };
    };
  };
}
