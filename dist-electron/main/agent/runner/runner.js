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
const ai_client_1 = require("../../lib/ai-client");
const system_prompt_1 = require("./system-prompt");
const graph_1 = require("./graph");
const skills_loader_1 = require("./skills-loader");
const tools_manager_1 = require("./tools_manager");
const telemetry_logger_1 = require("../helpers/telemetry-logger");
const state_manager_1 = require("./state-manager");
const abort_manager_1 = require("./abort-manager");
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
        this.skills = []; // Initialize empty, will be loaded asynchronously
        this.tools = (0, tools_manager_1.getBaseTools)(this);
        console.log(`[AgentRunner] Constructor: Initialized ${this.tools.length} base tools.`);
        // Start async initialization but don't block constructor
        this.initializePiTools();
        this.initializeSkills();
        this.telemetry = new telemetry_logger_1.TelemetryLogger();
    }
    /**
     * Ensure all asynchronous tool/skill initialization is complete
     */
    async waitForToolsReady() {
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
    async initializeSkills() {
        try {
            if (this.skills.length > 0)
                return;
            this.skills = await (0, skills_loader_1.loadSkillsAsync)();
            console.log(`[AgentRunner] ✅ Skills loaded: ${this.skills.length}`);
        }
        catch (error) {
            console.error('[AgentRunner] Failed to load skills asynchronously:', error);
            this.skills = []; // Fallback to empty array
        }
    }
    async initializePiTools() {
        try {
            const piTools = await (0, pi_tools_1.getPiCodingTools)();
            if (!this.tools.find(t => t.name === piTools[0].name)) {
                console.log(`[AgentRunner] 🔄 Registering ${piTools.length} Pi coding tools...`);
                this.tools.push(...piTools, this.createSpawnAgentTool());
                console.log(`[AgentRunner] ✅ Pi coding tools registered. Total tools: ${this.tools.length}`);
            }
        }
        catch (error) {
            console.error('[AgentRunner] Failed to initialize Pi tools:', error);
        }
    }
    /**
     * Get or create a pooled AI client for better performance
     * This ensures we reuse connections instead of creating new clients
     */
    getClient(config) {
        if (!config) {
            return this.client;
        }
        // Use pooled client for better performance
        return (0, ai_client_1.getPooledAIClient)({
            provider: (config.provider || this.client.provider),
            model: config.model || this.client.model,
            apiKey: config.apiKey || this.client.apiKey,
            baseUrl: config.baseUrl
        });
    }
    /**
     * Release a pooled client back to the pool
     */
    releaseClient(client, config) {
        if (client === this.client) {
            return; // Don't release the main client
        }
        (0, ai_client_1.releasePooledAIClient)(client, {
            provider: (config.provider || this.client.provider),
            model: config.model || this.client.model,
            apiKey: config.apiKey || this.client.apiKey,
            baseUrl: config.baseUrl
        });
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
                            const clonedHistory = [...h];
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
    /**
     * Abort the current execution
     * Requirement 1.1: Stop button shall immediately set the Stream_Abort_Flag to true
     */
    abort() {
        abort_manager_1.globalAbortManager.setAborted();
        console.log('[AgentRunner] 🛑 Abort requested - execution will be terminated');
    }
    /**
     * Check if execution is currently aborted
     */
    isAborted() {
        return abort_manager_1.globalAbortManager.streamAborted;
    }
    /**
     * Get abort timing information for debugging
     */
    getAbortTiming() {
        return abort_manager_1.globalAbortManager.getAbortTiming();
    }
    shouldCaptureScreenshot(userInput) {
        const text = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
        const explicitVisionKeywords = /take.*screenshot|capture.*screen|see.*screen|show.*screen|look.*at.*screen|view.*screen|desktop|click|open.*app|find.*icon|locate.*button|open.*window|minimize|maximize|close.*window|browser|gui automation|computer use/i;
        return explicitVisionKeywords.test(text);
    }
    _buildToolDefinitions() {
        const toolDefs = [];
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
                parameters: t.parameters,
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
        // Check if this is a HITL approval/rejection response
        const textInput = typeof userInput === 'string' ? userInput : JSON.stringify(userInput);
        if (textInput.includes('[HITL_APPROVED]') || textInput.includes('[HITL_REJECTED]')) {
            const approved = textInput.includes('[HITL_APPROVED]');
            console.log(`[Runner] HITL response detected: ${approved ? 'APPROVED' : 'REJECTED'}`);
            // Try to find the request ID from state manager
            const state = state_manager_1.stateManager.getState(convId);
            const interruptData = state_manager_1.stateManager.getInterruptData(convId);
            if (interruptData && interruptData.id) {
                const { saveHitlResponse } = await Promise.resolve().then(() => __importStar(require('../../store/hitl')));
                const responseId = crypto.randomUUID();
                const timestamp = new Date().toISOString();
                saveHitlResponse({
                    id: responseId,
                    requestId: interruptData.id,
                    conversationId: convId,
                    timestamp,
                    approved,
                    response: textInput,
                });
                console.log(`[Runner] HITL response saved: ${responseId} (${approved ? 'approved' : 'rejected'})`);
            }
            else {
                console.warn('[Runner] Could not find HITL request ID to save response');
            }
        }
        // Initialize mission tracker for timeline tracking
        const { createMissionTracker } = await Promise.resolve().then(() => __importStar(require('./mission-tracker')));
        const missionTracker = createMissionTracker(convId);
        // Initialize duration tracker for thinking time tracking
        const { DurationTracker } = await Promise.resolve().then(() => __importStar(require('./duration-tracker')));
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
        const { ContextWindowGuard } = await Promise.resolve().then(() => __importStar(require('./context-window-guard')));
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
            this.skills = await (0, skills_loader_1.loadSkillsAsync)();
        }
        // Pre-load system prompt asynchronously with pre-loaded skills to avoid loading them twice
        const preloadedPrompt = await (0, system_prompt_1.getSlimSystemPromptAsync)(platform, conversationId, [], this.skills);
        // Create eventQueue early so we can push status updates
        let pushResolver = null;
        const eventQueue = [];
        const originalPush = eventQueue.push.bind(eventQueue);
        eventQueue.push = (...items) => {
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
        const { messages: initialMessages } = (0, system_prompt_1.buildSystemMessages)(history, userInput, platform, conversationId, [], preloadedPrompt);
        console.log('[AgentRunner] ✅ System messages built');
        await new Promise(resolve => setImmediate(resolve));
        this.telemetry.updateSpinner('Building execution graph...');
        console.log('[AgentRunner] 🔄 Building execution graph...');
        // Reset abort state for new execution
        abort_manager_1.globalAbortManager.reset();
        // Create shouldAbort callback for graph nodes
        const shouldAbort = abort_manager_1.globalAbortManager.createShouldAbortCallback();
        // Build graph asynchronously to avoid blocking the event loop
        const graph = await Promise.resolve().then(() => (0, graph_1.buildGraph)(this, this._buildToolDefinitions(), this.tools));
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
                abort_manager_1.globalAbortManager.checkAbort();
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
                const { Command } = await Promise.resolve().then(() => __importStar(require('@langchain/langgraph')));
                // Check abort before graph invocation
                abort_manager_1.globalAbortManager.checkAbort();
                if (currentState && currentState.next && currentState.next.length > 0) {
                    console.log('[AgentRunner] 🔄 Resuming interrupted session...');
                    this.telemetry.info(`Resuming session ${convId} from interrupted state...`);
                    missionTracker.startStep('step:triage');
                    await graph.invoke(new Command({ resume: textInput }), threadConfig);
                }
                else {
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
            }
            catch (err) {
                console.error('[AgentRunner] Graph Error:', err);
                const errorMsg = err instanceof Error ? err.message : String(err);
                // Handle abort errors specially
                if (err instanceof abort_manager_1.AbortError || errorMsg.includes('Execution aborted by user')) {
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
            if (eventQueue.length > 0) {
                const event = eventQueue.shift();
                // Debug logging for HITL events
                if (event.type === 'hitl_request') {
                    console.log('[Runner] Processing hitl_request event:', event);
                }
                // Track when first thought event occurs
                if (event.type === 'thought') {
                    durationTracker.onThoughtStart();
                }
                yield event;
            }
            else {
                await new Promise(r => { pushResolver = r; });
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
exports.AgentRunner = AgentRunner;
