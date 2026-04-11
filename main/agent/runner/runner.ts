/**
 * EverFern Desktop — Agent Runner (AGI Edition)
 *
 * This is the main orchestration class for the autonomous agent.
 */

import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIClient } from '../../lib/ai-client';
import type { ToolDefinition, ChatMessage } from '../../lib/ai-client';
import { buildSystemMessages } from './system-prompt';
import { AgentTool, ToolCallRecord, AgentRunnerConfig } from './types';
import { buildGraph } from './graph';
import { StreamEvent } from './state';
import { Skill, loadSkills } from './skills-loader';
import { getSkillsPath } from '../../lib/skills-sync';
import { lookupCache, saveCache } from '../../lib/cache';
import { globalSessionManager } from '../../acp/control-plane/manager.core';
import { getBaseTools } from './tools_manager';
import { TelemetryLogger } from '../helpers/telemetry-logger';

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
    this.skills = loadSkills();

    this.tools = getBaseTools(this);
    this.initializePiTools();
    this.telemetry = new TelemetryLogger();
  }

  private async initializePiTools() {
    const piTools = await getPiCodingTools();
    if (!this.tools.find(t => t.name === piTools[0].name)) {
      this.tools.push(...piTools, this.createSpawnAgentTool());
    }
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

    // Check Context Window before proceeding
    const textInput = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
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

    this.telemetry.updateSpinner('Compiling system messages...');
    const platform = os.platform();
    const { messages: initialMessages } = buildSystemMessages(history, userInput, platform, conversationId, []);
    
    this.telemetry.updateSpinner('Building execution graph...');
    const eventQueue: StreamEvent[] = [];
    const graph = buildGraph(this, this._buildToolDefinitions(), this.tools, eventQueue, convId, [], this.shouldCaptureScreenshot(userInput));

    this.telemetry.updateSpinner('Invoking agent node pipeline...');

    let graphDone = false;
    (async () => {
      try {
        await graph.invoke({
          messages: initialMessages,
          toolCallRecords: [],
          iterations: 0,
          pendingToolCalls: [],
          finalResponse: '',
          toolCallHistory: [],
        }, { recursionLimit: 100 });
      } catch (err) {
        console.error('[AgentRunner] Graph Error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Specialized handling for rate limits
        if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests') || errorMsg.toLowerCase().includes('rate limit')) {
          eventQueue.push({ 
            type: 'chunk', 
            content: `\n\n⚠️ **Rate Limit Reached**: The AI provider (Gemini) is currently limiting requests. \n\nI have attempted to retry multiple times, but the quota has not reset yet. Please wait about 30-60 seconds and then click **Continue** or type "continue" to resume our mission.` 
          });
        } else {
          eventQueue.push({ type: 'chunk', content: `\n\n❌ **Error during execution:** ${errorMsg}` });
        }
        
        this.telemetry.warn(`Graph mission aborted: ${errorMsg}`);
        this.telemetry.terminate(false, errorMsg);
      } finally {
        graphDone = true;
      }
    })();

    while (!graphDone || eventQueue.length > 0) {
      if (eventQueue.length > 0) yield eventQueue.shift()!;
      else await new Promise(r => setTimeout(r, 10));
    }

    this.telemetry.terminate(true);
    yield { type: 'done' };
  }
}
