"use strict";
/**
 * EverFern Desktop — Agent Runner (AGI Edition)
 *
 * This is the main orchestration class for the autonomous agent.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunner = void 0;
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const system_prompt_1 = require("./system-prompt");
const graph_1 = require("./graph");
const skills_loader_1 = require("./skills-loader");
const tools_manager_1 = require("./tools_manager");
const telemetry_logger_1 = require("../helpers/telemetry-logger");
const pi_tools_1 = require("../tools/pi-tools");
// Lifecycle/Infra
const agent_events_1 = require("../infra/agent-events");
const sessions_1 = require("../sessions");
const DEFAULT_CONFIG = {
    maxIterations: 100,
    enableTerminal: true,
};
class AgentRunner {
    client;
    tools;
    config;
    skills = [];
    completionGateRetries = 0;
    currentConversationId;
    telemetry;
    constructor(client, config = {}) {
        this.client = client;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.skills = (0, skills_loader_1.loadSkills)();
        this.tools = (0, tools_manager_1.getBaseTools)(this);
        this.initializePiTools();
        this.telemetry = new telemetry_logger_1.TelemetryLogger();
    }
    async initializePiTools() {
        const piTools = await (0, pi_tools_1.getPiCodingTools)();
        if (!this.tools.find(t => t.name === piTools[0].name)) {
            this.tools.push(...piTools, this.createSpawnAgentTool());
        }
    }
    createSpawnAgentTool() {
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
                const task = args.task;
                const agentId = args.agent_id || crypto.randomUUID();
                const maxDepth = Math.min(args.max_depth || 2, 3);
                onUpdate?.(`AGI: Spawning sub-agent for: ${task.substring(0, 50)}...`);
                try {
                    const { getSubagentSpawner } = await Promise.resolve().then(() => __importStar(require('./subagent-spawn')));
                    const spawner = getSubagentSpawner();
                    spawner.setRunner({
                        run: async (t, h, m) => {
                            const subRunner = new AgentRunner(this.client, this.config);
                            subRunner.skills = this.skills;
                            const clonedHistory = JSON.parse(JSON.stringify(h));
                            let lastResponse = '';
                            let toolCalls = [];
                            const stream = subRunner.runStream(t, clonedHistory, m, `sub:${agentId}`);
                            let thoughts = '';
                            for await (const event of stream) {
                                if (event.type === 'done')
                                    break;
                                if (event.type === 'chunk')
                                    lastResponse += event.content;
                                if (event.type === 'thought') {
                                    thoughts += event.content;
                                    if (event.content.includes('\n'))
                                        onUpdate?.(`[Sub-Agent] 🤔 ${thoughts.trim().split('\n').pop()}`);
                                }
                                if (event.type === 'tool_start')
                                    onUpdate?.(`[Sub-Agent] 🛠️ Starting tool: ${event.toolName}`);
                                if (event.type === 'tool_update')
                                    onUpdate?.(`[Sub-Agent] ⏳ Running ${event.toolName}...`);
                                if (event.type === 'tool_call') {
                                    toolCalls.push(event.toolCall);
                                    onUpdate?.(`[Sub-Agent] ✅ Finished tool: ${event.toolCall.toolName}`);
                                }
                            }
                            return {
                                response: lastResponse,
                                toolCalls: toolCalls.map(tc => ({
                                    toolName: tc.toolName,
                                    args: tc.args
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
                }
                catch (err) {
                    return { success: false, output: `Spawn failed: ${err}` };
                }
            }
        };
    }
    shouldCaptureScreenshot(userInput) {
        const text = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
        const explicitVisionKeywords = /take.*screenshot|capture.*screen|see.*screen|show.*screen|look.*at.*screen|view.*screen|desktop|click|open.*app|find.*icon|locate.*button|open.*window|minimize|maximize|close.*window|browser|gui automation|computer use/i;
        return explicitVisionKeywords.test(text);
    }
    _buildToolDefinitions() {
        return this.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        }));
    }
    async run(userInput, history, model, conversationId) {
        const stream = this.runStream(userInput, history, model, conversationId);
        let lastResponse = '';
        let toolCalls = [];
        for await (const event of stream) {
            if (event.type === 'done')
                break;
            if (event.type === 'chunk')
                lastResponse += event.content;
            if (event.type === 'tool_call')
                toolCalls.push(event.toolCall);
        }
        return { response: lastResponse, toolCalls };
    }
    async *runStream(userInput, history, model, conversationId) {
        if (model)
            this.client.setModel(model);
        this.telemetry.setAgentId(this.client.model);
        const convId = conversationId || crypto.randomUUID();
        this.currentConversationId = convId;
        const sessionKey = `session:${convId}`;
        (0, sessions_1.sessionCreated)(sessionKey);
        (0, agent_events_1.emitLifecycle)(sessionKey, 'session_started', { convId, model: this.client.model });
        // Initialize mission tracker for timeline tracking
        const { createMissionTracker } = await Promise.resolve().then(() => __importStar(require('./mission-tracker')));
        const missionTracker = createMissionTracker(convId);
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
        const textInput = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
        const { ContextWindowGuard } = await Promise.resolve().then(() => __importStar(require('./context-window-guard')));
        const guard = new ContextWindowGuard(this.client.model);
        const status = guard.check(history);
        if (status.level === 'critical') {
            history = guard.compactHistory(history);
            this.telemetry.warn(`Critical context pressure detected. Compacted history proactively (${status.estimatedTokens} tokens).`);
        }
        this.telemetry.begin(textInput);
        this.telemetry.updateSpinner('Loading tool definitions...');
        const piTools = await (0, pi_tools_1.getPiCodingTools)();
        if (!this.tools.find(t => t.name === piTools[0].name))
            this.tools.push(...piTools);
        this.telemetry.updateSpinner('Compiling system messages...');
        const platform = os.platform();
        const { messages: initialMessages } = (0, system_prompt_1.buildSystemMessages)(history, userInput, platform, conversationId, []);
        this.telemetry.updateSpinner('Building execution graph...');
        const eventQueue = [];
        const graph = (0, graph_1.buildGraph)(this, this._buildToolDefinitions(), this.tools, eventQueue, convId, missionTracker);
        this.telemetry.updateSpinner('Invoking agent node pipeline...');
        let graphDone = false;
        (async () => {
            try {
                const threadConfig = { configurable: { thread_id: convId }, recursionLimit: 100 };
                const currentState = await graph.getState(threadConfig);
                const { Command } = await Promise.resolve().then(() => __importStar(require('@langchain/langgraph')));
                if (currentState && currentState.next && currentState.next.length > 0) {
                    this.telemetry.info(`Resuming session ${convId} from interrupted state...`);
                    missionTracker.startStep('step:triage');
                    await graph.invoke(new Command({ resume: textInput }), threadConfig);
                }
                else {
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
                missionTracker.complete();
            }
            catch (err) {
                console.error('[AgentRunner] Graph Error:', err);
                const errorMsg = err instanceof Error ? err.message : String(err);
                // Specialized handling for rate limits
                if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many requests') || errorMsg.toLowerCase().includes('rate limit')) {
                    eventQueue.push({
                        type: 'chunk',
                        content: `\n\n⚠️ **Rate Limit Reached**: The AI provider (Gemini) is currently limiting requests. \n\nI have attempted to retry multiple times, but the quota has not reset yet. Please wait about 30-60 seconds and then click **Continue** or type "continue" to resume our mission.`
                    });
                    missionTracker.fail(errorMsg);
                }
                else {
                    eventQueue.push({ type: 'chunk', content: `\n\n❌ **Error during execution:** ${errorMsg}` });
                    missionTracker.fail(errorMsg);
                }
                this.telemetry.warn(`Graph mission aborted: ${errorMsg}`);
                this.telemetry.terminate(false, errorMsg);
            }
            finally {
                graphDone = true;
            }
        })();
        // Drain all events and wait for mission completion
        while (!graphDone || eventQueue.length > 0 || !missionTracker.getTimeline().isComplete) {
            if (eventQueue.length > 0) {
                yield eventQueue.shift();
            }
            else {
                await new Promise(r => setTimeout(r, 10));
            }
        }
        this.telemetry.terminate(true);
        // Emit final mission completion event
        yield {
            type: 'mission_complete',
            timeline: missionTracker.getTimeline(),
            steps: missionTracker.getSteps(),
        };
        yield { type: 'done' };
    }
}
exports.AgentRunner = AgentRunner;
