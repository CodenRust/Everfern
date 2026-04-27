/**
 * Conversation Handler - Natural Language Interaction
 *
 * Handles natural language conversations with the user.
 * Generates contextual responses based on intent and codebase analysis.
 */

import { UserIntent } from './intent-classifier';
import { CodebaseAnalysis } from '../codebase-analyzer';
import { IntelligentSuggestion } from '../intelligent-suggestions';
import { CodingSession } from '../context-manager';

export interface ConversationResult {
  response: string;
  needsUserInput: boolean;
  clarifyingQuestions?: string[];
}

export interface ConversationInput {
  userInput: string;
  intent: UserIntent;
  suggestions: IntelligentSuggestion[];
  codebaseAnalysis: CodebaseAnalysis;
  session: CodingSession;
}

export class ConversationHandler {
  /**
   * Handle user conversation and generate response
   */
  async handleConversation(input: ConversationInput): Promise<ConversationResult> {
    const { userInput, intent, suggestions, codebaseAnalysis, session } = input;

    // Build response based on intent
    let response = this.generateIntentResponse(intent, codebaseAnalysis);

    // Add suggestions if available
    if (suggestions.length > 0) {
      response += this.formatSuggestions(suggestions.slice(0, 3));
    }

    // Check if user input requires clarification
    const needsInput = this.requiresClarification(intent, userInput);
    const clarifyingQuestions = needsInput ?
      this.generateClarifyingQuestions(intent, codebaseAnalysis) :
      undefined;

    // Add context-aware tips
    response += this.generateContextTips(codebaseAnalysis, intent);

    return {
      response,
      needsUserInput: needsInput,
      clarifyingQuestions
    };
  }

  /**
   * Generate response based on detected intent
   */
  private generateIntentResponse(intent: UserIntent, analysis: CodebaseAnalysis): string {
    let response = '';

    switch (intent.type) {
      case 'create_component':
        response = `I'll help you create a new ${analysis.framework.primary} component. `;
        if (intent.details?.componentName) {
          response += `I'll create a component called "${intent.details.componentName}" `;
        }
        response += `with proper TypeScript types and following your project's patterns.`;
        break;

      case 'create_api':
        response = `I'll help you build a new API endpoint. `;
        if (intent.details?.endpoint) {
          response += `I'll create an endpoint for "${intent.details.endpoint}" `;
        }
        response += `with validation, error handling, and proper middleware integration.`;
        break;

      case 'create_database':
        response = `I'll help you set up database models and schema. `;
        if (intent.details?.model) {
          response += `I'll create a model for "${intent.details.model}" `;
        }
        response += `with proper relationships, migrations, and seed data.`;
        break;

      case 'setup_project':
        response = `I'll help you scaffold a complete project. `;
        if (intent.details?.framework) {
          response += `I'll set up a ${intent.details.framework} project `;
        } else {
          response += `I'll set up a ${analysis.framework.primary} project `;
        }
        response += `with all necessary configuration and dependencies.`;
        break;

      case 'fix_bug':
        response = `I'll help you debug and fix this issue. `;
        if (intent.details?.bugDescription) {
          response += `I'll investigate "${intent.details.bugDescription}", `;
        }
        response += `identify the root cause, implement a fix, and add tests to prevent regression.`;
        break;

      case 'refactor':
        response = `I'll help you improve your code quality. I'll analyze the architecture, `;
        response += `identify improvement opportunities, extract duplications, and refactor for better maintainability.`;
        break;

      case 'optimize':
        response = `I'll help you optimize your code for better performance. `;
        response += `I'll identify bottlenecks, implement optimizations, and measure the improvements.`;
        break;

      case 'test':
        response = `I'll help you add comprehensive tests. `;
        response += `I'll create unit tests, integration tests, and edge case coverage with proper mocking.`;
        break;

      case 'document':
        response = `I'll help you improve your documentation. `;
        response += `I'll create clear guides, API documentation, and setup instructions.`;
        break;

      case 'deploy':
        response = `I'll help you prepare for deployment. `;
        response += `I'll configure build tools, CI/CD pipelines, Docker setup, and deployment scripts.`;
        break;

      default:
        response = `I'm ready to help with your coding task. `;
        response += `Could you provide more details about what you'd like to accomplish?`;
    }

    return response;
  }

  /**
   * Format suggestions for display
   */
  private formatSuggestions(suggestions: IntelligentSuggestion[]): string {
    if (suggestions.length === 0) return '';

    let formatted = '\n\n**Smart Suggestions:**\n';
    for (const suggestion of suggestions) {
      formatted += `• **${suggestion.title}** (${Math.round(suggestion.confidence * 100)}% confidence)\n`;
      formatted += `  ${suggestion.description}\n`;
    }

    return formatted;
  }

  /**
   * Check if user input requires clarification
   */
  private requiresClarification(intent: UserIntent, userInput: string): boolean {
    // If confidence is low, ask for clarification
    if (intent.confidence < 0.5) return true;

    // If intent is unknown, definitely need clarification
    if (intent.type === 'unknown') return true;

    // For component/API creation, check if name is provided
    if ((intent.type === 'create_component' || intent.type === 'create_api') &&
        !intent.details?.componentName && !intent.details?.endpoint) {
      return true;
    }

    // For project setup, check if framework is specified
    if (intent.type === 'setup_project' && !intent.details?.framework) {
      return true;
    }

    return false;
  }

  /**
   * Generate clarifying questions
   */
  private generateClarifyingQuestions(intent: UserIntent, analysis: CodebaseAnalysis): string[] {
    const questions: string[] = [];

    switch (intent.type) {
      case 'create_component':
        questions.push(`What should the component be called?`);
        questions.push(`What props should it accept?`);
        questions.push(`Should it be a functional or class component?`);
        break;

      case 'create_api':
        questions.push(`What should the endpoint path be?`);
        questions.push(`What HTTP methods should it support (GET, POST, etc.)?`);
        questions.push(`What data should it accept and return?`);
        break;

      case 'create_database':
        questions.push(`What should the model/table be called?`);
        questions.push(`What fields should it have?`);
        questions.push(`What relationships does it need?`);
        break;

      case 'setup_project':
        questions.push(`Which framework would you like to use?`);
        questions.push(`Do you need a frontend, backend, or both?`);
        questions.push(`What database should we set up?`);
        break;

      case 'fix_bug':
        questions.push(`Can you describe the bug in more detail?`);
        questions.push(`What's the expected behavior?`);
        questions.push(`What's the actual behavior?`);
        break;

      case 'unknown':
        questions.push(`What would you like to accomplish?`);
        questions.push(`Are you looking to create, fix, optimize, or document something?`);
        break;
    }

    return questions;
  }

  /**
   * Generate context-aware tips
   */
  private generateContextTips(analysis: CodebaseAnalysis, intent: UserIntent): string {
    let tips = '';

    // Framework-specific tips
    if (analysis.framework.primary === 'React') {
      if (intent.type === 'create_component') {
        tips += `\n\n💡 **React Tip:** I'll use functional components with hooks and TypeScript for type safety.`;
      }
      if (intent.type === 'optimize') {
        tips += `\n\n💡 **React Tip:** I'll implement React.memo, useMemo, and useCallback for performance optimization.`;
      }
    }

    if (analysis.framework.primary === 'Next.js') {
      if (intent.type === 'create_component') {
        tips += `\n\n💡 **Next.js Tip:** I'll create components that work with Next.js routing and server components.`;
      }
      if (intent.type === 'optimize') {
        tips += `\n\n💡 **Next.js Tip:** I'll use Image optimization, dynamic imports, and ISR for better performance.`;
      }
    }

    if (analysis.framework.primary === 'Express') {
      if (intent.type === 'create_api') {
        tips += `\n\n💡 **Express Tip:** I'll follow Express best practices with proper middleware, error handling, and validation.`;
      }
    }

    // General tips based on project state
    if (!analysis.capabilities.hasTests && intent.type !== 'test') {
      tips += `\n\n💡 **Quality Tip:** Your project doesn't have tests yet. I can add comprehensive tests after implementation.`;
    }

    if (analysis.complexity === 'complex' && intent.type === 'refactor') {
      tips += `\n\n💡 **Architecture Tip:** I'll break down the refactoring into manageable steps to maintain stability.`;
    }

    return tips;
  }
}

/**
 * Factory function to create conversation handler
 */
export function createConversationHandler(): ConversationHandler {
  return new ConversationHandler();
}
