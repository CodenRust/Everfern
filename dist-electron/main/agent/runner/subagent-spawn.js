"use strict";
/**
 * EverFern Desktop — Subagent Spawner
 *
 * Spawns parallel subagents with session isolation.
 * Implements OpenClaw-style depth limiting and workspace inheritance.
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
exports.SubagentSpawner = exports.AGENT_TIMEOUTS = void 0;
exports.getSubagentSpawner = getSubagentSpawner;
const crypto = __importStar(require("crypto"));
const subagent_registry_1 = require("./subagent-registry");
const swarm_memory_1 = require("./swarm-memory");
const agent_events_1 = require("../infra/agent-events");
const session_lifecycle_events_1 = require("../sessions/session-lifecycle-events");
exports.AGENT_TIMEOUTS = {
    'web-explorer': 300000,
    'coding-specialist': 180000,
    'computer-use': 180000,
    'data-analyst': 180000,
    'generic': 120000,
};
class SubagentSpawner {
    runner;
    maxGlobalDepth = 3;
    activeAgents = 0;
    MAX_CONCURRENT_AGENTS = 2; // Limit parallel LLM calls to prevent Ollama 502s
    queue = [];
    setRunner(runner) {
        this.runner = runner;
    }
    async acquireSlot() {
        if (this.activeAgents < this.MAX_CONCURRENT_AGENTS) {
            this.activeAgents++;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }
    releaseSlot() {
        this.activeAgents--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) {
                this.activeAgents++;
                next();
            }
        }
    }
    async spawn(options) {
        const { parentSessionId, task, agentType = 'generic', systemPrompt, context, model, mode = 'run', workspaceDir, projectId, maxDepth = 3, parentHistory = [] } = options;
        if (!this.runner) {
            console.warn('[SubagentSpawner] No runner configured. Spawning failed.');
            throw new Error('SubagentSpawner: No runner configured');
        }
        const registry = (0, subagent_registry_1.getSubagentRegistry)();
        const parentEntry = registry.getBySessionKey(parentSessionId);
        const currentDepth = (parentEntry?.currentDepth || 0) + 1;
        if (currentDepth > this.maxGlobalDepth) {
            throw new Error(`Maximum spawn depth (${this.maxGlobalDepth}) exceeded`);
        }
        if (currentDepth > maxDepth) {
            throw new Error(`Task max depth (${maxDepth}) exceeded`);
        }
        const agentId = (0, subagent_registry_1.generateAgentId)();
        const sessionKey = `agent:${agentId}:${crypto.randomUUID().substring(0, 8)}`;
        const enrichedTask = context ? `[CONTEXT: ${context}]\n\n${task}` : task;
        const entry = registry.register({
            agentId,
            parentSessionId,
            sessionKey,
            task: enrichedTask,
            agentType,
            mode,
            status: 'pending',
            workspaceDir,
            projectId,
            maxDepth,
            currentDepth
        });
        const events = (0, agent_events_1.getAgentEvents)(sessionKey);
        events.setSessionKey(sessionKey);
        (0, agent_events_1.emitLifecycle)(parentSessionId, 'agent_spawned', {
            agentId,
            sessionKey,
            agentType,
            task: (enrichedTask || '').substring(0, 100)
        });
        console.log(`[SubagentSpawner] Spawned ${agentId} (${agentType}) for parent ${parentSessionId} (depth: ${currentDepth})`);
        const spawnedAgent = {
            agentId,
            parentSessionId,
            sessionKey,
            task: enrichedTask,
            agentType,
            status: 'pending',
            abort: () => registry.abort(agentId)
        };
        this.runSubagent(spawnedAgent, model, systemPrompt, parentHistory);
        return spawnedAgent;
    }
    async runSubagent(agent, model, systemPrompt, parentHistory = []) {
        const registry = (0, subagent_registry_1.getSubagentRegistry)();
        const swarm = (0, swarm_memory_1.getSwarmMemory)();
        registry.update(agent.agentId, { status: 'running' });
        agent.status = 'running';
        await this.acquireSlot();
        console.log(`[SubagentSpawner] 🎰 Agent ${agent.agentId} acquired execution slot. Active: ${this.activeAgents}`);
        // SWARM SYNC: Subscribe to real-time memory updates from sibling agents
        // This ensures the agent is aware of what its "army" peers are finding
        const swarmMessages = [];
        const unsubscribe = swarm.subscribe(agent.parentSessionId, agent.agentId, (fact) => {
            console.log(`[Subagent] 🧠 ${agent.agentId} received swarm update: ${fact.type}`);
            swarmMessages.push(`[SYNC FROM SWARM]: ${fact.content}`);
        });
        (0, session_lifecycle_events_1.sessionCreated)(agent.sessionKey, {
            parentSessionId: agent.parentSessionId,
            task: agent.task
        });
        (0, agent_events_1.emitTool)(agent.sessionKey, 'agent_start', {
            agentId: agent.agentId,
            agentType: agent.agentType,
            task: agent.task
        });
        const parentEvents = (0, agent_events_1.getAgentEvents)(agent.parentSessionId);
        try {
            const cappedHistory = parentHistory.slice(-40).map((msg) => ({
                role: msg.role || (msg._getType?.() === 'human' ? 'user' : 'assistant'),
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            }));
            // SWARM SYNC: Prepend existing swarm knowledge to the task
            const existingMemory = swarm.getMemory(agent.parentSessionId)
                .filter(f => f.sourceAgentId !== agent.agentId)
                .map(f => `[PRIOR SWARM KNOWLEDGE]: ${f.content}`)
                .join('\n');
            const finalTask = existingMemory ? `${existingMemory}\n\n${agent.task}` : agent.task;
            let finalResponse = '';
            let toolCalls = [];
            let retries = 0;
            const MAX_RETRIES = 2;
            while (retries <= MAX_RETRIES) {
                try {
                    if (this.runner?.runStream) {
                        console.log(`[SubagentSpawner] ⚡ Attempt ${retries + 1}: Using runStream for ${agent.agentId} to enable real-time piping`);
                        const entry = registry.get(agent.agentId);
                        const stream = this.runner.runStream(finalTask, cappedHistory, model, agent.parentSessionId, systemPrompt, entry?.projectId);
                        for await (const event of stream) {
                            if (event.type === 'done')
                                break;
                            if (event.type === 'chunk')
                                finalResponse += event.content;
                            if (event.type === 'tool_call')
                                toolCalls.push(event.toolCall);
                            // Pipe progress events to the parent session for the timeline
                            if (event.type === 'thought' || event.type === 'tool_start' || event.type === 'tool_call') {
                                const progressType = event.type === 'thought' ? 'reasoning' : 'action';
                                parentEvents.emit('subagent-progress', progressType, {
                                    toolCallId: agent.agentId, // Use agentId as toolCallId for grouping
                                    timestamp: new Date().toISOString(),
                                    content: event.type === 'thought' ? event.content : `Running tool: ${event.toolName || event.toolCall?.toolName}`,
                                    metadata: { agentId: agent.agentId, agentType: agent.agentType, attempt: retries + 1 },
                                    // Add timelineBranch for the nested visualization
                                    timelineBranch: {
                                        sessionId: agent.sessionKey,
                                        parentId: agent.parentSessionId,
                                        agentType: agent.agentType,
                                        taskDescription: agent.task,
                                        branchStatus: 'running'
                                    }
                                });
                            }
                        }
                    }
                    else {
                        console.log(`[SubagentSpawner] 🐢 Attempt ${retries + 1}: Using standard run for ${agent.agentId}`);
                        const entry = registry.get(agent.agentId);
                        const result = await this.runner.run(finalTask, cappedHistory, model, agent.parentSessionId, systemPrompt, entry?.projectId);
                        finalResponse = result.response;
                        toolCalls = result.toolCalls;
                    }
                    // If success, break out of retry loop
                    break;
                }
                catch (err) {
                    const is502 = String(err).includes('502') || String(err).includes('Bad Gateway');
                    if (is502 && retries < MAX_RETRIES) {
                        retries++;
                        const delay = 2000 * retries;
                        console.warn(`[SubagentSpawner] ⚠️ Agent ${agent.agentId} hit 502/Gateway error. Retrying in ${delay}ms... (Attempt ${retries + 1})`);
                        parentEvents.emit('subagent-progress', 'error', {
                            toolCallId: agent.agentId,
                            content: `Connection error (502). Retrying in ${delay / 1000}s... (Attempt ${retries + 1})`,
                            metadata: { agentId: agent.agentId, retry: true }
                        });
                        await new Promise(r => setTimeout(r, delay));
                        finalResponse = '';
                        toolCalls = [];
                        continue;
                    }
                    throw err; // Out of retries or not a 502
                }
            }
            registry.complete(agent.agentId, finalResponse);
            // Notify parent of completion
            parentEvents.emit('subagent-progress', 'complete', {
                toolCallId: agent.agentId,
                timestamp: new Date().toISOString(),
                timelineBranch: {
                    sessionId: agent.sessionKey,
                    branchStatus: 'completed'
                }
            });
            // SWARM SYNC: Broadcast findings to the rest of the army
            if (finalResponse && finalResponse.length > 50) {
                swarm.broadcast({
                    sourceAgentId: agent.agentId,
                    sessionId: agent.parentSessionId,
                    type: 'fact',
                    content: `Agent ${agent.agentId} (${agent.agentType}) findings: ${(finalResponse || '').substring(0, 500)}${finalResponse.length > 500 ? '...' : ''}`
                });
            }
            (0, session_lifecycle_events_1.sessionCompleted)(agent.sessionKey, {
                responseLength: finalResponse.length,
                toolCalls: toolCalls.length
            });
            (0, agent_events_1.emitTool)(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: true
            });
            console.log(`[SubagentSpawner] Agent ${agent.agentId} completed successfully`);
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            registry.complete(agent.agentId, undefined, errMsg);
            // Notify parent of error
            parentEvents.emit('subagent-progress', 'error', {
                toolCallId: agent.agentId,
                content: errMsg,
                timelineBranch: {
                    sessionId: agent.sessionKey,
                    branchStatus: 'failed'
                }
            });
            (0, session_lifecycle_events_1.sessionFailed)(agent.sessionKey, { error: errMsg });
            (0, agent_events_1.emitTool)(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: false,
                error: errMsg
            });
            console.error(`[SubagentSpawner] Agent ${agent.agentId} failed:`, error);
        }
        finally {
            this.releaseSlot();
            console.log(`[SubagentSpawner] 🏁 Agent ${agent.agentId} released execution slot. Active: ${this.activeAgents}`);
            unsubscribe();
        }
    }
    async spawnMultiple(parentSessionId, tasks, options = {}) {
        const spawned = [];
        for (const task of tasks) {
            try {
                const agent = await this.spawn({
                    parentSessionId,
                    task,
                    ...options
                });
                spawned.push(agent);
            }
            catch (error) {
                console.error(`[SubagentSpawner] Failed to spawn agent for task "${(task || '').substring(0, 50)}...":`, error);
            }
        }
        return spawned;
    }
    async waitForAgent(agentId, timeoutMs) {
        const registry = (0, subagent_registry_1.getSubagentRegistry)();
        const startTime = Date.now();
        while (true) {
            const entry = registry.get(agentId);
            if (!entry) {
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }
            if (entry.status === 'completed' || entry.status === 'failed' || entry.status === 'aborted') {
                return entry;
            }
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for agent ${agentId} (${timeoutMs}ms)`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    async waitForCompletion(parentSessionId, timeoutMs, agentType) {
        const registry = (0, subagent_registry_1.getSubagentRegistry)();
        const effectiveTimeout = timeoutMs ?? exports.AGENT_TIMEOUTS[agentType ?? 'generic'];
        const startTime = Date.now();
        while (registry.hasPendingChildren(parentSessionId)) {
            if (Date.now() - startTime > effectiveTimeout) {
                throw new Error(`Timeout waiting for subagents (${effectiveTimeout}ms)`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return registry.getChildren(parentSessionId);
    }
}
exports.SubagentSpawner = SubagentSpawner;
// Singleton
let spawnerInstance = null;
function getSubagentSpawner() {
    if (!spawnerInstance) {
        spawnerInstance = new SubagentSpawner();
    }
    return spawnerInstance;
}
