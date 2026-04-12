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
import { AgentTool, ToolCallRecord, AgentRunnerConfig } from './types';
import { buildGraph } from './graph';
import { StreamEvent } from './state';
import { Skill, loadSkills, loadSkillsAsync } from './skills-loader';
import { getSkillsPath } from '../../lib/skills-sync';
import { lookupCache, saveCache } from '../../lib/cache';
import { globalSessionManager } from '../../acp/control-plane/manager.core';
import { getBaseTools } from './tools_manager';
import { TelemetryLogger } from '../helpers/telemetry-logger';
import { stateManager } from './state-manager';

// Tool Imports
import { plannerTool, updateStepTool, executionPlanTool } from '../tools/planner';
import { createComputerUseTool, captureScreen } from '../tools/computer-use';
import { getPiCodingTools } from '../tools/pi-tools';
import { systemFilesTool } from '../tools/system-files';
import { memorySaveTool } from '../tools/memory-save';
import { memorySearchTool } from '../tools/memory-search';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { runCommandTool } from '../tools/terminal/run-command';
import { commandStatusTool } from '../tools/terminal/command-status';
import { sendCommandInputTool } from '../tools/terminal/send-command-input';
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
    this.initializePiTools();
    this.initializeSkills(); // Load skills asynchronously
    this.telemetry = new TelemetryLogger();
  }

  /**
   * Initialize skills asynchronously to avoid blocking the event loop
   */
  private async initializeSkills() {
    try {
      this.skills = await loadSkillsAsync();
    } catch (error) {
      console.error('[AgentRunner] Failed to load skills asynchronously:', error);
      this.skills = []; // Fallback to empty array
    }
  }

  private async initializePiTools() {
    const piTools = await getPiCodingTools();
    if (!this.tools.find(t => t.name === piTools[0].name)) {
      this.tools.push(...piTools, this.createSpawnAgentTool());
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
    return {
      name: 'spawn_agent',
      description: 'AGI: Launch parallel sub-agents for complex tasks. Use for: multiple files to process, research on multiple topics, independent operations that can run simultaneously.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The self-contained task for the sub-agent to accomplish.' },
          agent_id: { type: 'string', description: 'Resume an existing agent by ID (optional).' },
          max_depth: { type: 'number', description: 'Maximum spawn depth (default: 2, max: 3)' }
        },
        required: ['task']
      },
      execute: async (args, onUpdate) => {
        const task = args.task as string;
        const agentId = args.agent_id as string || crypto.randomUUID();
        const maxDepth = Math.min((args.max_depth as number) || 2, 3);
        onUpdate?.(`AGI: Spawning sub-agent for: ${task.substring(0, 50)}...`);
        try {
          const { getSubagentSpawner } = await import('./subagent-spawn');
          const spawner = getSubagentSpawner();
          spawner.setRunner({
            run: async (t, h, m) => {
              const subRunner = new AgentRunner(this.client, this.config);
              subRunner.skills = this.skills;
              const clonedHistory = JSON.parse(JSON.stringify(h));
              let lastResponse = '';
              let toolCalls: any[] = [];
              const stream = subRunner.runStream(t, clonedHistory, m, `sub:${agentId}`);
              let thoughts = '';
              for await (const event of stream) {
                  if (event.type === 'done') break;
                  if (event.type === 'chunk') lastResponse += event.content;
                  if (event.type === 'thought') {
                      thoughts += event.content;
                      if (event.content.includes('\n')) onUpdate?.(`[Sub-Agent] 🤔 ${thoughts.trim().split('\n').pop()}`);
                  }
                  if (event.type === 'tool_start') onUpdate?.(`[Sub-Agent] 🛠️ Starting tool: ${event.toolName}`);
                  if (event.type === 'tool_update') onUpdate?.(`[Sub-Agent] ⏳ Running ${event.toolName}...`);
                  if (event.type === 'tool_call') {
                      toolCalls.push(event.toolCall);
                      onUpdate?.(`[Sub-Agent] ✅ Finished tool: ${event.toolCall.toolName}`);
                  }
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
            model: this.client.model,
            maxDepth
          });
          const children = await spawner.waitForCompletion(this.currentConversationId || 'default', 300000);
          const myChild = children.find(c => c.agentId === spawnedAgent.agentId);
          if (myChild && myChild.result) {
            return { success: true, output: `Sub-agent (ID: ${spawnedAgent.agentId}) result:\n${myChild.result}` };
          }
          return { success: false, output: `Sub-agent failed: ${myChild?.error || 'Unknown error'}` };
        } catch (err) {
          return { success: false, output: `Spawn failed: ${err}` };
        }
      }
    };
  }

  public shouldCaptureScreenshot(userInput: string | any[]): boolean {
    const text = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
    const explicitVisionKeywords = /take.*screenshot|capture.*screen|see.*screen|show.*screen|look.*at.*screen|view.*screen|desktop|click|open.*app|find.*icon|locate.*button|open.*window|minimize|maximize|close.*window|browser|gui automation|computer use/i;
    return explicitVisionKeywords.test(text);
  }

  public _buildToolDefinitions(): ToolDefinition[] {
    return this.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    }));
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



    this.telemetry.updateSpinner('Loading tool definitions...');
    const piTools = await getPiCodingTools();
    if (!this.tools.find(t => t.name === piTools[0].name)) this.tools.push(...piTools);

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
    const eventQueue: StreamEvent[] = [];
    
    // Skip boring internal messages - frontend shows LoadingBreadcrumb instead
    // These console logs are for debugging only
    this.telemetry.updateSpinner('Compiling system messages...');
    console.log('[AgentRunner] 🔄 Building system messages...');
    
    const { messages: initialMessages } = buildSystemMessages(history, userInput, platform, conversationId, [], preloadedPrompt);
    console.log('[AgentRunner] ✅ System messages built');
    
    await new Promise(resolve => setImmediate(resolve));
    
    this.telemetry.updateSpinner('Building execution graph...');
    console.log('[AgentRunner] 🔄 Building execution graph...');
    
    // Build graph asynchronously to avoid blocking the event loop
    const graph = await Promise.resolve().then(() => buildGraph(
      this, 
      this._buildToolDefinitions(), 
      this.tools,
      eventQueue,
      convId,
      missionTracker,
      this.config.shouldAbort,
    ));
    console.log('[AgentRunner] ✅ Graph built successfully');
    
    await new Promise(resolve => setImmediate(resolve));

    this.telemetry.updateSpinner('Starting agent...');
    console.log('[AgentRunner] 🚀 Starting agent execution...');
    
    // Emit a fun status message
    yield { type: 'thought', content: '🎬 Let\'s do this!' };

    let graphDone = false;
    (async () => {
      try {
        console.log('[AgentRunner] 🔄 Getting graph state...');
        const threadConfig = { configurable: { thread_id: convId }, recursionLimit: 100 };
        const currentState = await graph.getState(threadConfig);
        console.log('[AgentRunner] ✅ Graph state retrieved');
        const { Command } = await import('@langchain/langgraph');

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
        
        // Specialized handling for rate limits
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests') || errorMsg.toLowerCase().includes('rate limit')) {
          eventQueue.push({ 
            type: 'chunk', 
            content: `\n\n⚠️ **Rate Limit Reached**: The AI provider (Gemini) is currently limiting requests. \n\nI have attempted to retry multiple times, but the quota has not reset yet. Please wait about 30-60 seconds and then click **Continue** or type "continue" to resume our mission.` 
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
      }
    })();

    // Drain all events and wait for mission completion
    // Keep draining while: graph is still running OR there are events in queue
    // Don't check missionTracker.isComplete here - it prevents HITL events from being yielded
    while (!graphDone || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        
        // Debug logging for HITL events
        if (event.type === 'hitl_request') {
          console.log('[Runner] Processing hitl_request event:', event);
        }
        
        // Track when first thought event occurs
        if (event.type === 'thought') {
          durationTracker.onThoughtStart();
        }
        
        yield event;
      } else {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    // Now mark mission as complete after all events have been drained
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
