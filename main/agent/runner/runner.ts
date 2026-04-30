/**
 * EverFern Desktop — Agent Runner (AGI Edition)
 *
 * This is the main orchestration class for the autonomous agent.
 */

import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIClient } from '../../lib/ai-client';
import { getPooledAIClient, releasePooledAIClient } from '../../lib/ai-client';
import type { ToolDefinition, ChatMessage } from '../../lib/ai-client';
import { buildSystemMessages, getSlimSystemPromptAsync } from './system-prompt';
import { ChatHistoryStore } from '../../store/history';
import { AgentTool, ToolCallRecord, AgentRunnerConfig } from './types';
import { buildGraph } from './graph';
import { StreamEvent } from './state';
import { Skill, loadSkills, loadSkillsAsync } from './skills-loader';
import { getSkillsPath } from '../../lib/skills-sync';
import { lookupCache, saveCache } from '../../lib/cache';
import { globalSessionManager } from '../../acp/control-plane/manager.core';
import { getBaseTools } from './tools_manager';
import { loadPrompt } from '../../lib/prompt-sync';
import { TelemetryLogger } from '../helpers/telemetry-logger';
import { stateManager } from './state-manager';
import { globalAbortManager, AbortError } from './abort-manager';

// Tool Imports
import { plannerTool, updateStepTool, executionPlanTool } from '../tools/planner';
import { createComputerUseTool, captureScreen } from '../tools/computer-use';
import { getPiCodingTools } from '../tools/pi-tools';
import { systemFilesTool } from '../tools/system-files';
import { memorySaveTool } from '../tools/memory-save';
import { memorySearchTool } from '../tools/memory-search';
import { webSearchTool } from '../tools/web-search';
import { todoWriteTool } from '../tools/todo-write';
import { askUserTool } from '../tools/ask-user';
import { skillTool } from '../tools/skill-tool';
import { presentFilesTool } from '../tools/present-files';
import { createWorkspaceRequestTool, allowFileDeleteTool } from '../tools/control-plane';

// Lifecycle/Infra
import { getAgentEvents, emitLifecycle } from '../infra/agent-events';
import { sessionCreated } from '../sessions';

const DEFAULT_CONFIG: AgentRunnerConfig = {
  maxIterations: 100,
  enableTerminal: true,
};

export class AgentRunner {
  public client: AIClient;
  public tools: AgentTool[];
  public config: AgentRunnerConfig;
  public skills: Skill[] = [];
  public completionGateRetries: number = 0;
  public currentConversationId?: string;
  public telemetry: TelemetryLogger;

  constructor(client: AIClient, config: Partial<AgentRunnerConfig> = {}) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.skills = []; // Initialize empty, will be loaded asynchronously

    this.tools = getBaseTools(this);
    console.log(`[AgentRunner] Constructor: Initialized ${this.tools.length} base tools.`);

    // Start async initialization but don't block constructor
    this.initializePiTools();
    this.initializeSkills();
    this.telemetry = new TelemetryLogger();
  }

  /**
   * Ensure all asynchronous tool/skill initialization is complete
   */
  public async waitForToolsReady() {
    console.log('[AgentRunner] 🔄 Waiting for tools/skills to be ready...');

    // Skills are already loaded in initializeSkills call from constructor
    // but we can ensure they are loaded here too if needed
    if (this.skills.length === 0) {
      await this.initializeSkills();
    }

    // Pi tools are already loaded in initializePiTools call from constructor
    await this.initializePiTools();

    console.log(`[AgentRunner] ✅ All tools ready. Total tools: ${this.tools.length}`);
  }

  /**
   * Initialize skills asynchronously to avoid blocking the event loop
   */
  private async initializeSkills() {
    try {
      if (this.skills.length > 0) return;
      this.skills = await loadSkillsAsync();
      console.log(`[AgentRunner] ✅ Skills loaded: ${this.skills.length}`);
    } catch (error) {
      console.error('[AgentRunner] Failed to load skills asynchronously:', error);
      this.skills = []; // Fallback to empty array
    }
  }

  private async initializePiTools() {
    try {
      const piTools = await getPiCodingTools();
      if (!this.tools.find(t => t.name === piTools[0].name)) {
        console.log(`[AgentRunner] 🔄 Registering ${piTools.length} Pi coding tools...`);
        this.tools.push(...piTools, this.createSpawnAgentTool());
        console.log(`[AgentRunner] ✅ Pi coding tools registered. Total tools: ${this.tools.length}`);
      }
    } catch (error) {
      console.error('[AgentRunner] Failed to initialize Pi tools:', error);
    }
  }

  /**
   * Get or create a pooled AI client for better performance
   * This ensures we reuse connections instead of creating new clients
   */
  public getClient(config?: { provider?: string; model?: string; apiKey?: string; baseUrl?: string }): AIClient {
    if (!config) {
      return this.client;
    }

    // Use pooled client for better performance
    return getPooledAIClient({
      provider: (config.provider || this.client.provider) as any,
      model: config.model || this.client.model,
      apiKey: config.apiKey || this.client.apiKey,
      baseUrl: config.baseUrl
    });
  }

  /**
   * Release a pooled client back to the pool
   */
  public releaseClient(client: AIClient, config: { provider?: string; model?: string; apiKey?: string; baseUrl?: string }): void {
    if (client === this.client) {
      return; // Don't release the main client
    }

    releasePooledAIClient(client, {
      provider: (config.provider || this.client.provider) as any,
      model: config.model || this.client.model,
      apiKey: config.apiKey || this.client.apiKey,
      baseUrl: config.baseUrl
    });
  }

  private createSpawnAgentTool(): AgentTool {
    const AGENT_TYPE_PROMPTS: Record<string, string> = {
      'coding-specialist': 'coding-specialist.md',
      'web-explorer': 'web-explorer.md',
      'data-analyst': 'data-analyst.md',
      'computer-use': 'computer-use.md',
    };

    const AGENT_TYPE_TIMEOUT: Record<string, number> = {
      'web-explorer': 300000,
      'coding-specialist': 180000,
      'computer-use': 180000,
      'data-analyst': 180000,
      'generic': 120000,
    };

    return {
      name: 'spawn_agent',
      description: 'Launch a specialized sub-agent for parallel/independent tasks. Use agent_type to pick the right specialist. Keep nesting to 2 levels max.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Self-contained task for the sub-agent to accomplish.' },
          agent_type: { type: 'string', description: 'Type of specialist agent. Options: generic, coding-specialist, web-explorer, data-analyst, computer-use.', enum: ['generic', 'coding-specialist', 'web-explorer', 'data-analyst', 'computer-use'] },
          context: { type: 'string', description: 'Additional background information or constraints for the task.' },
          max_depth: { type: 'number', description: 'Maximum spawn depth (default: 2, max: 3)' }
        },
        required: ['task']
      },
      execute: async (args, onUpdate, emitEvent, toolCallId) => {
        const task = args.task as string;
        const agentType = (args.agent_type as string) || 'generic';
        const context = (args.context as string) || '';
        const maxDepth = Math.min((args.max_depth as number) || 2, 3);
        const agentId = crypto.randomUUID();
        const timeout = AGENT_TYPE_TIMEOUT[agentType] ?? 120000;

        onUpdate?.(`Spawning ${agentType} sub-agent for: ${task.substring(0, 60)}...`);

        if (emitEvent && toolCallId) {
            emitEvent({
                type: 'subagent-progress',
                toolCallId,
                timestamp: new Date().toISOString(),
                data: {
                    type: 'step',
                    toolCallId,
                    timestamp: new Date().toISOString(),
                    content: `${agentType} agent spawned: ${task.substring(0, 80)}...`
                }
            });
        }

        try {
          let parentHistory: Array<{ role: string; content: string | any[] }> = [];
          try {
            const chatHistoryStore = new ChatHistoryStore();
            const fullConversation = await chatHistoryStore.load(this.currentConversationId || 'default');

            if (fullConversation && fullConversation.messages.length > 0) {
              const reconstructed = reconstructFullHistory(fullConversation.messages, '');
              parentHistory = reconstructed.slice(-40);
              console.log(`[SubagentSpawn] Loaded ${parentHistory.length} messages from parent`);
            }
          } catch (historyErr) {
            console.warn('[SubagentSpawn] Failed to load parent history:', historyErr);
            parentHistory = [];
          }

          let systemPrompt: string | undefined;
          const promptFile = AGENT_TYPE_PROMPTS[agentType];
          if (promptFile) {
            systemPrompt = loadPrompt(promptFile) || undefined;
          }

          const { getSubagentSpawner } = await import('./subagent-spawn');
          const spawner = getSubagentSpawner();
          spawner.setRunner({
            run: async (t, h, m, subSystemPrompt) => {
              const subRunner = new AgentRunner(this.client, this.config);
              subRunner.skills = this.skills;
              const clonedHistory = [...h] as any[];
              let lastResponse = '';
              let toolCalls: any[] = [];

              const effectivePrompt = subSystemPrompt || systemPrompt;
              const enrichedTask = effectivePrompt ? `${effectivePrompt}\n\n---\n\nTASK: ${t}` : t;

              const stream = subRunner.runStream(enrichedTask, clonedHistory, m, `sub:${agentId}`);

              for await (const event of stream) {
                  if (event.type === 'done') break;
                  if (event.type === 'chunk') lastResponse += event.content;

                  if (event.type === 'thought' && emitEvent && toolCallId) {
                      emitEvent({
                          type: 'subagent-progress',
                          toolCallId,
                          timestamp: new Date().toISOString(),
                          data: {
                              type: 'reasoning',
                              toolCallId,
                              timestamp: new Date().toISOString(),
                              content: event.content
                          }
                      });
                  }

                  if (event.type === 'tool_start' && emitEvent && toolCallId) {
                      emitEvent({
                          type: 'subagent-progress',
                          toolCallId,
                          timestamp: new Date().toISOString(),
                          data: {
                              type: 'action',
                              toolCallId,
                              timestamp: new Date().toISOString(),
                              content: `Running tool: ${event.toolName}`,
                              toolName: event.toolName
                          }
                      });
                  }

                  if (event.type === 'tool_call' && emitEvent && toolCallId) {
                      emitEvent({
                          type: 'subagent-progress',
                          toolCallId,
                          timestamp: new Date().toISOString(),
                          data: {
                              type: 'action',
                              toolCallId,
                              timestamp: new Date().toISOString(),
                              content: `Finished ${event.toolCall.toolName}`,
                              toolName: event.toolCall.toolName,
                              status: event.toolCall.result.success ? 'success' : 'failure'
                          }
                      });
                  }

                  if (event.type === 'thought') {
                      if (event.content.includes('\n')) onUpdate?.(`[Sub-Agent] ${event.content.trim().split('\n').pop()}`);
                  }
                  if (event.type === 'tool_start') onUpdate?.(`[Sub-Agent] Tool: ${event.toolName}`);
                  if (event.type === 'tool_update') onUpdate?.(`[Sub-Agent] Running ${event.toolName}...`);
                  if (event.type === 'tool_call') {
                      toolCalls.push(event.toolCall);
                      onUpdate?.(`[Sub-Agent] Done: ${event.toolCall.toolName}`);
                  }
              }

              if (emitEvent && toolCallId) {
                  emitEvent({
                      type: 'subagent-progress',
                      toolCallId,
                      timestamp: new Date().toISOString(),
                      data: {
                          type: 'complete',
                          toolCallId,
                          timestamp: new Date().toISOString()
                      }
                  });
              }

              return {
                response: lastResponse,
                toolCalls: toolCalls.map(tc => ({
                  toolName: tc.toolName,
                  args: tc.args as Record<string, unknown>
                }))
              };
            }
          });

          const spawnedAgent = await spawner.spawn({
            parentSessionId: this.currentConversationId || 'default',
            task,
            agentType: agentType as any,
            context,
            model: this.client.model,
            maxDepth,
            parentHistory
          });

          const children = await spawner.waitForCompletion(this.currentConversationId || 'default', timeout, agentType as any);
          const myChild = children.find(c => c.agentId === spawnedAgent.agentId);
          if (myChild && myChild.result) {
            return { success: true, output: `Sub-agent [${agentType}] (ID: ${spawnedAgent.agentId}):\n${myChild.result}` };
          }
          return { success: false, output: `Sub-agent failed: ${myChild?.error || 'Unknown error'}` };
        } catch (err) {
          return { success: false, output: `Spawn failed: ${err}` };
        }
      }
    };
  }

  /**
   * Abort the current execution
   * Requirement 1.1: Stop button shall immediately set the Stream_Abort_Flag to true
   */
  public abort(): void {
    globalAbortManager.setAborted();
    console.log('[AgentRunner] 🛑 Abort requested - execution will be terminated');
  }

  /**
   * Check if execution is currently aborted
   */
  public isAborted(): boolean {
    return globalAbortManager.streamAborted;
  }

  /**
   * Get abort timing information for debugging
   */
  public getAbortTiming(): { aborted: boolean; elapsedMs: number | null } {
    return globalAbortManager.getAbortTiming();
  }

  public shouldCaptureScreenshot(userInput: string | any[]): boolean {
    const text = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
    const explicitVisionKeywords = /take.*screenshot|capture.*screen|see.*screen|show.*screen|look.*at.*screen|view.*screen|desktop|click|open.*app|find.*icon|locate.*button|open.*window|minimize|maximize|close.*window|browser|gui automation|computer use/i;
    return explicitVisionKeywords.test(text);
  }

  public _buildToolDefinitions(): ToolDefinition[] {
    const toolDefs: ToolDefinition[] = [];

    console.log(`[ToolDefinitions] Building tool definitions for ${this.tools.length} tools...`);

    for (const t of this.tools) {
      // Validate that tool has required properties
      if (!t.name || !t.description || !t.parameters) {
        console.warn(`[ToolDefinitions] Skipping tool with missing properties:`, {
          name: t.name || 'MISSING',
          hasDescription: !!t.description,
          hasParameters: !!t.parameters,
        });
        if (t.name === 'computer_use') {
          console.error(`[ToolDefinitions] ❌ CRITICAL: computer_use tool is missing required properties!`, {
            description: t.description ? 'present' : 'missing',
            parameters: t.parameters ? 'present' : 'missing'
          });
        }
        continue;
      }

      // Add valid tool definition
      toolDefs.push({
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      });

      // Log computer_use tool specifically
      if (t.name === 'computer_use') {
        console.log(`[ToolDefinitions] ✅ computer_use tool included in definitions:`, {
          descLength: t.description.length,
          paramKeys: Object.keys(t.parameters.properties || {})
        });
      }
    }

    console.log(`[ToolDefinitions] Built ${toolDefs.length} tool definitions`);
    console.log(`[ToolDefinitions] Tool names: ${toolDefs.map(t => t.name).join(', ')}`);

    // Warn if computer_use is missing
    if (!toolDefs.find(t => t.name === 'computer_use')) {
      console.warn(`[ToolDefinitions] ⚠️ WARNING: computer_use tool is missing from tool definitions!`);
    }

    return toolDefs;
  }

  async run(
    userInput: string | any[],
    history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
    model?: string,
    conversationId?: string,
  ): Promise<{ response: string; toolCalls: ToolCallRecord[] }> {
    const stream = this.runStream(userInput, history, model, conversationId);
    let lastResponse = '';
    let toolCalls: ToolCallRecord[] = [];
    for await (const event of stream) {
      if (event.type === 'done') break;
      if (event.type === 'chunk') lastResponse += event.content;
      if (event.type === 'tool_call') toolCalls.push(event.toolCall);
    }
    return { response: lastResponse, toolCalls };
  }

  async *runStream(
    userInput: string | any[],
    history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
    model?: string,
    conversationId?: string,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    if (model) this.client.setModel(model);
    this.telemetry.setAgentId(this.client.model);
    const convId = conversationId || crypto.randomUUID();
    this.currentConversationId = convId;
    const sessionKey = `session:${convId}`;
    sessionCreated(sessionKey);
    emitLifecycle(sessionKey, 'session_started', { convId, model: this.client.model });

    // Check if this is a HITL approval/rejection response
    const textInput = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
    if (textInput.includes('[HITL_APPROVED]') || textInput.includes('[HITL_REJECTED]')) {
      const approved = textInput.includes('[HITL_APPROVED]');
      console.log(`[Runner] HITL response detected: ${approved ? 'APPROVED' : 'REJECTED'}`);

      // Try to find the request ID from state manager
      const state = stateManager.getState(convId);
      const interruptData = stateManager.getInterruptData(convId);

      if (interruptData && (interruptData as any).id) {
        const { saveHitlResponse } = await import('../../store/hitl');
        const responseId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        saveHitlResponse({
          id: responseId,
          requestId: (interruptData as any).id,
          conversationId: convId,
          timestamp,
          approved,
          response: textInput,
        });

        console.log(`[Runner] HITL response saved: ${responseId} (${approved ? 'approved' : 'rejected'})`);
      } else {
        console.warn('[Runner] Could not find HITL request ID to save response');
      }
    }

    // Initialize mission tracker for timeline tracking
    const { createMissionTracker } = await import('./mission-tracker');
    const missionTracker = createMissionTracker(convId);

    // Initialize duration tracker for thinking time tracking
    const { DurationTracker } = await import('./duration-tracker');
    const durationTracker = new DurationTracker();

    // Add initial mission steps
    missionTracker.addStep({
      id: 'step:triage',
      name: 'Analyzing Intent',
      description: 'Classifying user request and identifying task type',
      phase: 'triage',
    });

    // Setup mission tracker event emission to IPC
    missionTracker.onStepUpdate((step, timeline) => {
      eventQueue.push({
        type: 'mission_step_update',
        step,
        timeline,
      });
    });

    missionTracker.onPhaseChange((phase, timeline) => {
      eventQueue.push({
        type: 'mission_phase_change',
        phase,
        timeline,
      });
    });

    // Check Context Window before proceeding
    const { ContextWindowGuard } = await import('./context-window-guard');
    const guard = new ContextWindowGuard(this.client.model);
    const status = guard.check(history);
    if (status.level === 'critical') {
       history = guard.compactHistory(history);
       this.telemetry.warn(`Critical context pressure detected. Compacted history proactively (${status.estimatedTokens} tokens).`);
    }

    this.telemetry.begin(textInput);

    // Ensure all tools and skills are fully loaded before proceeding
    await this.waitForToolsReady();

    this.telemetry.updateSpinner('Pre-loading system prompt...');
    const platform = os.platform();

    // Ensure skills are loaded before building system prompt
    if (this.skills.length === 0) {
      console.log('[AgentRunner] Skills not yet loaded, loading now...');
      this.skills = await loadSkillsAsync();
    }

    // Pre-load system prompt asynchronously with pre-loaded skills to avoid loading them twice
    const preloadedPrompt = await getSlimSystemPromptAsync(platform, conversationId, [], this.skills);

    // Create eventQueue early so we can push status updates
    let pushResolver: any = null;
    const eventQueue: StreamEvent[] = [];
    const originalPush = eventQueue.push.bind(eventQueue);
    eventQueue.push = (...items: StreamEvent[]) => {
      const res = originalPush(...items);
      if (pushResolver) {
        pushResolver();
        pushResolver = null;
      }
      return res;
    };

    // Skip boring internal messages - frontend shows LoadingBreadcrumb instead
    // These console logs are for debugging only
    this.telemetry.updateSpinner('Compiling system messages...');
    console.log('[AgentRunner] 🔄 Building system messages...');

    const { messages: initialMessages } = buildSystemMessages(history, userInput, platform, conversationId, [], preloadedPrompt);

    // Bug 2 Fix: Load full conversation history including tool calls into initialMessages
    const chatHistoryStore = new ChatHistoryStore();
    try {
      const fullConversation = await chatHistoryStore.load(convId);
      if (fullConversation && fullConversation.messages.length > 0) {
        console.log(`[AgentRunner] 🔄 Reconstructing full conversation history (${fullConversation.messages.length} messages)...`);

        // Reconstruct full message history including tool calls/results
        const priorMessages = reconstructFullHistory(fullConversation.messages, userInput);

        // Apply context window cap: limit to most recent 20 turns to prevent unbounded growth
        const maxMessages = 20;
        const limitedPriorMessages = priorMessages.slice(-maxMessages);

        // Replace initialMessages with: [system] + priorMessages + [new user msg]
        const systemMessage = initialMessages[0]; // Extract system message
        const newUserMessage = initialMessages[initialMessages.length - 1]; // Extract new user message

        initialMessages.length = 0; // Clear array
        initialMessages.push(systemMessage, ...limitedPriorMessages, newUserMessage);

        console.log(`[AgentRunner] ✅ Full conversation history reconstructed (${limitedPriorMessages.length} prior messages)`);
      }
    } catch (err) {
      console.warn('[AgentRunner] Failed to load conversation history:', err);
      // Continue with original initialMessages if history loading fails
    }

    console.log('[AgentRunner] ✅ System messages built');

    await new Promise(resolve => setImmediate(resolve));

    this.telemetry.updateSpinner('Building execution graph...');
    console.log('[AgentRunner] 🔄 Building execution graph...');

    // Reset abort state for new execution
    globalAbortManager.reset();

    // Create shouldAbort callback for graph nodes
    const shouldAbort = globalAbortManager.createShouldAbortCallback();

    // Build graph asynchronously to avoid blocking the event loop
    const graph = await Promise.resolve().then(() => buildGraph(
      this,
      this._buildToolDefinitions(),
      this.tools,
    ));
    console.log('[AgentRunner] ✅ Graph built (or retrieved from cache)');

    await new Promise(resolve => setImmediate(resolve));

    this.telemetry.updateSpinner('Starting agent...');
    console.log('[AgentRunner] 🚀 Starting agent execution...');

    // Emit a fun status message
    yield { type: 'thought', content: '🎬 Let\'s do this!' };

    let graphDone = false;
    (async () => {
      try {
        // Check abort before starting graph execution
        // Requirement 1.2: Agent_Runner shall check the flag before each node execution
        globalAbortManager.checkAbort();

        console.log('[AgentRunner] 🔄 Getting graph state...');
        const threadConfig = {
          configurable: {
            thread_id: convId,
            executionContext: {
              runner: this,
              eventQueue,
              missionTracker,
              conversationId: convId,
              shouldAbort,
            }
          },
          recursionLimit: 100
        };
        const currentState = await graph.getState(threadConfig);
        console.log('[AgentRunner] ✅ Graph state retrieved');
        const { Command } = await import('@langchain/langgraph');

        // Check abort before graph invocation
        globalAbortManager.checkAbort();

        if (currentState && currentState.next && currentState.next.length > 0) {
            console.log('[AgentRunner] 🔄 Resuming interrupted session...');
            this.telemetry.info(`Resuming session ${convId} from interrupted state...`);
            missionTracker.startStep('step:triage');
            await graph.invoke(new Command({ resume: textInput }), threadConfig);
        } else {
            console.log('[AgentRunner] 🔄 Starting new graph invocation...');
            missionTracker.startStep('step:triage');
            await graph.invoke({
              messages: initialMessages,
              toolCallRecords: [],
              iterations: 0,
              pendingToolCalls: [],
              finalResponse: '',
              toolCallHistory: [],
              missionId: convId,
              missionTimeline: missionTracker.getTimeline(),
              missionSteps: missionTracker.getSteps(),
              currentStepId: 'step:triage',
            }, threadConfig);
        }
        console.log('[AgentRunner] ✅ Graph invocation completed');
        // Don't mark mission as complete yet - wait until all events are drained
        // This ensures HITL events are properly yielded before mission completion
      } catch (err) {
        console.error('[AgentRunner] Graph Error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Handle abort errors specially
        if (err instanceof AbortError || errorMsg.includes('Execution aborted by user')) {
          console.log('[AgentRunner] 🛑 Execution aborted by user');
          eventQueue.push({
            type: 'chunk',
            content: '\n\n🛑 Stopped by user.'
          });
          missionTracker.fail('Execution stopped by user');
          this.telemetry.warn('Execution aborted by user (stop button clicked)');
          this.telemetry.terminate(false, 'User abort');
        }
        // Specialized handling for rate limits
        else if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests') || errorMsg.toLowerCase().includes('rate limit')) {
          const providerName = this.client.provider ? this.client.provider.charAt(0).toUpperCase() + this.client.provider.slice(1) : 'The AI provider';
          eventQueue.push({
            type: 'chunk',
            content: `\n\n⚠️ **Rate Limit Reached**: ${providerName} is currently limiting requests. \n\nI have attempted to retry multiple times, but the quota has not reset yet. Please wait about 30-60 seconds and then click **Continue** or type "continue" to resume our mission.`
          });
          missionTracker.fail(errorMsg);
        } else {
          eventQueue.push({ type: 'chunk', content: `\n\n❌ **Error during execution:** ${errorMsg}` });
          missionTracker.fail(errorMsg);
        }

        this.telemetry.warn(`Graph mission aborted: ${errorMsg}`);
        this.telemetry.terminate(false, errorMsg);
      } finally {
        graphDone = true;
        if (pushResolver) {
          pushResolver();
          pushResolver = null;
        }
      }
    })();

    // Drain all events and wait for mission completion
    // Keep draining while: graph is still running OR there are events in queue
    // Don't check missionTracker.isComplete here - it prevents HITL events from being yielded
    while (!graphDone || eventQueue.length > 0) {
      // If graph just completed, add a small delay to ensure all events are queued
      if (graphDone && eventQueue.length === 0) {
        await new Promise(r => setTimeout(r, 10));
        // Check again after delay - if still no events, we're done
        if (eventQueue.length === 0) break;
      }
      if (eventQueue.length > 0) {
        // HITL Event Priority: Process HITL events before other events
        // This prevents race conditions between HITL and mission completion
        const hitlEventIndex = eventQueue.findIndex(e => e.type === 'hitl_request');
        let event: StreamEvent;

        if (hitlEventIndex !== -1) {
          // Remove HITL event from queue (higher priority)
          event = eventQueue.splice(hitlEventIndex, 1)[0];
          console.log('[Runner] 🔔 Processing HITL event with priority (found at index', hitlEventIndex, ')');
        } else {
          // Process regular events in FIFO order
          event = eventQueue.shift()!;
        }

        // Debug logging for HITL events
        if (event.type === 'hitl_request') {
          console.log('[Runner] Processing hitl_request event:', event);
          console.log('[Runner] Remaining events in queue:', eventQueue.length);
        }

        // Track when first thought event occurs
        if (event.type === 'thought') {
          durationTracker.onThoughtStart();
        }

        yield event;
      } else {
        await new Promise<void>(r => { pushResolver = r; });
      }
    }

    // Ensure judge evaluation completes before marking mission as complete
    // Add a small delay to ensure all judge processing is finished
    await new Promise(r => setTimeout(r, 50));

    // Now mark mission as complete after all events have been drained and judge is done
    if (!missionTracker.getTimeline().isComplete && !missionTracker.getTimeline().error) {
      missionTracker.complete();
    }

    this.telemetry.terminate(true);

    // Calculate thinking duration
    const thinkingDuration = durationTracker.onMissionComplete();

    // Emit final mission completion event with thinking duration
    yield {
      type: 'mission_complete',
      timeline: missionTracker.getTimeline(),
      steps: missionTracker.getSteps(),
      thinkingDuration,
    };

    // Reset duration tracker for next mission
    durationTracker.reset();

    yield { type: 'done' };
  }
}

/**
 * Reconstruct full conversation history from stored ChatMessage entries.
 * Converts stored toolCalls back into the interleaved assistant+tool_calls and tool result format.
 * Skips the very last user message (it will be appended as userInput).
 */
function reconstructFullHistory(storedMessages: any[], currentUserInput: string | any[]): any[] {
  const reconstructed: any[] = [];

  // Skip the very last user message if it matches the current input
  const currentInputText = typeof currentUserInput === 'string' ? currentUserInput : JSON.stringify(currentUserInput);
  let messagesToProcess = storedMessages;

  // Remove the last user message if it matches current input (avoid duplication)
  if (storedMessages.length > 0) {
    const lastMsg = storedMessages[storedMessages.length - 1];
    if (lastMsg.role === 'user' && lastMsg.content === currentInputText) {
      messagesToProcess = storedMessages.slice(0, -1);
    }
  }

  for (const msg of messagesToProcess) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      // This is an assistant message with tool calls
      // First emit the assistant message with tool_calls array
      reconstructed.push({
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.toolCalls.map((tc: any) => ({
          id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'function',
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.args || {})
          }
        }))
      });

      // Then emit individual tool result messages
      for (const tc of msg.toolCalls) {
        reconstructed.push({
          role: 'tool',
          tool_call_id: tc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          content: JSON.stringify(tc.result || { success: false, output: 'No result available' })
        });
      }
    } else {
      // Plain user/assistant text message - emit as-is
      reconstructed.push({
        role: msg.role,
        content: msg.content
      });
    }
  }

  return reconstructed;
}
