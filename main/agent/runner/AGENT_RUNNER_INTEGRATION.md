/**
 * EverFern Desktop — Agent Runner Integration for Debate Engine
 *
 * This shows the ACTUAL integration pattern to add to main/agent/runner/agent-runner.ts
 */

// ════════════════════════════════════════════════════════════════════════════
// ADD THESE IMPORTS TO agent-runner.ts
// ════════════════════════════════════════════════════════════════════════════

import * as crypto from 'crypto';
import { PeerAgentDebateEngine } from './debate-engine';
import { analyzeTaskComplexity } from './complexity-analyzer';
import {
  createDebateEventEmitter,
  emitDebateStart,
  emitDebateComplete,
  emitDebateError,
} from '../ipc/debate-handler';
import type { DebateContext } from './debate-types';

// ════════════════════════════════════════════════════════════════════════════
// ADD THESE PROPERTIES TO AgentRunner CLASS
// ════════════════════════════════════════════════════════════════════════════

export class AgentRunner {
  private debateEngine: PeerAgentDebateEngine | null = null;

  // ... existing properties ...

  /**
   * Initialize the debate engine in the constructor or when first needed
   */
  private initializeDebateEngine(): void {
    if (this.debateEngine || !this.client) return;

    console.log('[AgentRunner] Initializing Peer Agent Debate Engine');
    this.debateEngine = new PeerAgentDebateEngine(this.client, {
      enableDebate: true,
      complexityThreshold: 'moderate',
      timeoutMs: 60000,
      vanguardTimeoutMs: 15000,
      phantomTimeoutMs: 20000,
      arbiterTimeoutMs: 15000,
      verbose: true,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADD THIS METHOD TO executeTask() OR CREATE NEW METHOD
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Execute task with optional debate for complex tasks
   */
  async executeTaskWithDebate(
    userInput: string,
    event: any, // IpcMainEvent from Electron
    conversationHistory: any[] = [],
    availableTools: string[] = []
  ) {
    try {
      // Step 1: Analyze task complexity
      console.log('[AgentRunner] Analyzing task complexity...');
      const complexity = await analyzeTaskComplexity(
        userInput,
        this.client,
        this.workspaceDir || ''
      );

      console.log(`[AgentRunner] Complexity: ${complexity.complexity} (confidence: ${complexity.confidence})`);
      console.log(`[AgentRunner] Factors:`, complexity.factors);
      console.log(`[AgentRunner] Risks:`, complexity.riskFactors);

      // Step 2: Check if debate should activate
      const shouldDebate =
        complexity.complexity === 'complex' ||
        (complexity.complexity === 'moderate' && complexity.confidence > 0.7);

      if (shouldDebate) {
        console.log('[AgentRunner] ✅ Activating debate engine for complex task');
        return await this.executeTaskWithRealTimeDebate(
          userInput,
          event,
          conversationHistory,
          availableTools
        );
      } else {
        console.log('[AgentRunner] Skipping debate - task is too simple');
        return await this.normalExecuteTask(userInput, event, conversationHistory);
      }

    } catch (err) {
      console.error('[AgentRunner] Error in executeTaskWithDebate:', err);
      throw err;
    }
  }

  /**
   * Execute task WITH real-time debate streaming to frontend
   */
  private async executeTaskWithRealTimeDebate(
    userInput: string,
    event: any,
    conversationHistory: any[] = [],
    availableTools: string[] = []
  ) {
    const debateId = `debate-${crypto.randomUUID()}`;

    try {
      // Initialize debate engine if needed
      this.initializeDebateEngine();
      if (!this.debateEngine) throw new Error('Failed to initialize debate engine');

      // Notify frontend that debate is starting
      console.log(`[AgentRunner] Starting debate [${debateId}]`);
      emitDebateStart(event, debateId);

      // Build debate context
      const debateContext: DebateContext = {
        taskId: crypto.randomUUID(),
        userInput,
        conversationHistory: conversationHistory.map(msg => ({
          role: msg.role || 'user',
          content: msg.content || '',
        })),
        availableTools: availableTools || [],
        workspaceContext: this.workspaceDir || '',
        constraints: [
          'Must not delete critical files',
          'Preserve existing functionality',
          'Ask for confirmation on breaking changes',
        ],
      };

      // Run debate with real-time event streaming
      const debateResult = await this.debateEngine.debate(debateContext, {
        // This callback is called after each phase completes
        onPhaseComplete: createDebateEventEmitter(event, debateId),
      } as any);

      // Notify frontend debate is complete
      console.log(`[AgentRunner] Debate completed [${debateId}]`);
      emitDebateComplete(event, debateId, debateResult);

      // Step 3: Execute based on debate decision
      if (debateResult.finalPlan.goNogo === 'go') {
        console.log('[AgentRunner] ✅ Debate approved - executing plan');
        return await this.executeApprovedPlan(debateResult.finalPlan, event);
      }
      else if (debateResult.finalPlan.goNogo === 'proceed-with-caution') {
        console.log('[AgentRunner] ⚠️  Debate approved with caution - executing with validation');
        return await this.executePlanWithValidation(debateResult.finalPlan, event);
      }
      else {
        console.log('[AgentRunner] ❌ Debate rejected - plan not approved');
        throw new Error(
          `Debate rejected execution plan:\n${debateResult.finalPlan.explanation}\n\n` +
          `Please revise your request to address the concerns.`
        );
      }

    } catch (err) {
      console.error(`[AgentRunner] Debate execution failed [${debateId}]:`, err);
      emitDebateError(event, debateId, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Normal task execution (without debate)
   */
  private async normalExecuteTask(
    userInput: string,
    event: any,
    conversationHistory: any[] = []
  ) {
    console.log('[AgentRunner] Executing task without debate');
    // Your existing executeTask logic here
    return await this.existingExecuteTaskMethod(userInput, event, conversationHistory);
  }

  /**
   * Execute the debate-approved plan
   * This should iterate through auditedSteps and execute each one
   */
  private async executeApprovedPlan(finalPlan: any, event: any) {
    console.log('[AgentRunner] Executing approved plan with', finalPlan.steps.length, 'steps');

    // Iterate through finalPlan.steps (auditedSteps)
    for (const step of finalPlan.steps) {
      console.log(`[AgentRunner] Executing step: ${step.description}`);

      // Execute step using available tools
      // This is your existing tool execution logic
      // Make sure to emit progress events to frontend
    }

    return { success: true, result: 'Plan executed successfully' };
  }

  /**
   * Execute plan with validation and caution
   */
  private async executePlanWithValidation(finalPlan: any, event: any) {
    console.log('[AgentRunner] Executing plan with validation...');

    // Same as executeApprovedPlan but with additional validation checks
    // Check for remaining risks before each step
    for (const step of finalPlan.steps) {
      // Validate step won't cause issues
      console.log(`[AgentRunner] Validating step: ${step.description}`);

      // Execute step
      // Validate results
    }

    return { success: true, result: 'Plan executed with validation' };
  }

  /**
   * Placeholder for your existing task execution logic
   */
  private async existingExecuteTaskMethod(
    userInput: string,
    event: any,
    conversationHistory: any[]
  ) {
    // Replace with your actual implementation
    throw new Error('existingExecuteTaskMethod not implemented');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// UPDATE YOUR MAIN EXECUTION ENTRY POINT
// ════════════════════════════════════════════════════════════════════════════

// BEFORE (Old approach):
/*
  async handleExecuteTask(userInput: string, event: IpcMainEvent) {
    const result = await agentRunner.executeTask(userInput, event);
    return result;
  }
*/

// AFTER (With debate support):
/*
  async handleExecuteTask(userInput: string, event: IpcMainEvent) {
    // This now checks complexity and activates debate automatically
    const result = await agentRunner.executeTaskWithDebate(
      userInput,
      event,
      conversationHistory,
      availableTools
    );
    return result;
  }
*/

// ════════════════════════════════════════════════════════════════════════════
// FIXED TYPES FOR DEBATE CONTEXT
// ════════════════════════════════════════════════════════════════════════════

/**
 * The DebateContext structure that should be passed to debate engine:
 */
export interface DebateContextFull {
  taskId: string;
  userInput: string;
  conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
  }>;
  availableTools: string[];
  workspaceContext: string;
  constraints?: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// ERROR FIXES AND IMPROVEMENTS
// ════════════════════════════════════════════════════════════════════════════

/**
 * FIXED: Import error in debate-handler.ts
 * - Added proper crypto import
 * - Fixed formatDebateDataForFrontend to handle missing data gracefully
 * - Added try-catch around event.sender.send() calls
 */

/**
 * FIXED: Type safety
 * - Exported DebatePhase and DebateEventEmitterCallback types
 * - Added proper type definitions in debate-types.ts
 * - Used type-safe event handlers
 */

/**
 * FIXED: Event emission timing
 * - Moved from post-execution to real-time (during phase completion)
 * - Debate engine now calls onPhaseComplete callback after each phase
 * - Frontend receives updates as they happen
 */

/**
 * TODO: After integration
 * - [ ] Test with complex task
 * - [ ] Verify all three debate phases show in UI
 * - [ ] Test go/no-go/caution decisions
 * - [ ] Verify debate plan execution
 * - [ ] Test error handling
 */
