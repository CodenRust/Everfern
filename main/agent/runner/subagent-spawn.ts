/**
 * EverFern Desktop — Subagent Spawner
 *
 * Spawns parallel subagents with session isolation.
 * Implements OpenClaw-style depth limiting and workspace inheritance.
 */

import * as crypto from 'crypto';
import { getSubagentRegistry, generateAgentId, type SubagentEntry, type AgentType } from './subagent-registry';
import { getSwarmMemory, type MemoryFact } from './swarm-memory';
import {
    getAgentEvents,
    emitTool,
    emitLifecycle
} from '../infra/agent-events';
import {
    sessionCreated,
    sessionCompleted,
    sessionFailed
} from '../sessions/session-lifecycle-events';

export const AGENT_TIMEOUTS: Record<AgentType, number> = {
    'web-explorer': 300000,
    'coding-specialist': 180000,
    'computer-use': 180000,
    'data-analyst': 180000,
    'generic': 120000,
};

export interface SpawnOptions {
    parentSessionId: string;
    task: string;
    agentType?: AgentType;
    systemPrompt?: string;
    context?: string;
    model?: string;
    mode?: 'run' | 'session';
    workspaceDir?: string;
    projectId?: string;
    maxDepth?: number;
    parentHistory?: Array<{ role: 'user' | 'assistant'; content: string | any[] }>;
}

export interface SpawnedAgent {
    agentId: string;
    parentSessionId: string;
    sessionKey: string;
    task: string;
    agentType: AgentType;
    status: 'pending' | 'running';
    abort: () => void;
}

export interface SpawnResult {
    success: boolean;
    agentId: string;
    sessionKey: string;
    result?: string;
    error?: string;
}

export interface SubagentRunner {
    run(
        userInput: string | any[],
        history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
        model?: string,
        conversationId?: string,
        systemPromptOverride?: string,
        projectId?: string
    ): Promise<{ response: string; toolCalls: any[] }>;

    runStream?(
        userInput: string | any[],
        history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
        model?: string,
        conversationId?: string,
        systemPromptOverride?: string,
        projectId?: string,
    ): AsyncGenerator<any, void, unknown>;
}

class SubagentSpawner {
    private runner?: SubagentRunner;
    private maxGlobalDepth: number = 3;
    private activeAgents: number = 0;
    private readonly MAX_CONCURRENT_AGENTS = 2; // Limit parallel LLM calls to prevent Ollama 502s
    private queue: Array<() => void> = [];

    setRunner(runner: SubagentRunner) {
        this.runner = runner;
    }

    private async acquireSlot(): Promise<void> {
        if (this.activeAgents < this.MAX_CONCURRENT_AGENTS) {
            this.activeAgents++;
            return;
        }
        return new Promise(resolve => this.queue.push(resolve));
    }

    private releaseSlot(): void {
        this.activeAgents--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) {
                this.activeAgents++;
                next();
            }
        }
    }

    async spawn(options: SpawnOptions): Promise<SpawnedAgent> {
        const {
            parentSessionId,
            task,
            agentType = 'generic',
            systemPrompt,
            context,
            model,
            mode = 'run',
            workspaceDir,
            projectId,
            maxDepth = 3,
            parentHistory = []
        } = options;

        if (!this.runner) {
            console.warn('[SubagentSpawner] No runner configured. Spawning failed.');
            throw new Error('SubagentSpawner: No runner configured');
        }


        const registry = getSubagentRegistry();

        const parentEntry = registry.getBySessionKey(parentSessionId);
        const currentDepth = (parentEntry?.currentDepth || 0) + 1;

        if (currentDepth > this.maxGlobalDepth) {
            throw new Error(`Maximum spawn depth (${this.maxGlobalDepth}) exceeded`);
        }

        if (currentDepth > maxDepth) {
            throw new Error(`Task max depth (${maxDepth}) exceeded`);
        }

        const agentId = generateAgentId();
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

        const events = getAgentEvents(sessionKey);
        events.setSessionKey(sessionKey);

        emitLifecycle(parentSessionId, 'agent_spawned', {
            agentId,
            sessionKey,
            agentType,
            task: (enrichedTask || '').substring(0, 100)
        });

        console.log(`[SubagentSpawner] Spawned ${agentId} (${agentType}) for parent ${parentSessionId} (depth: ${currentDepth})`);

        const spawnedAgent: SpawnedAgent = {
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

    private async runSubagent(agent: SpawnedAgent, model?: string, systemPrompt?: string, parentHistory: Array<{ role: 'user' | 'assistant'; content: string | any[] }> = []): Promise<void> {
        const registry = getSubagentRegistry();
        const swarm = getSwarmMemory();

        registry.update(agent.agentId, { status: 'running' });
        agent.status = 'running';

        await this.acquireSlot();
        console.log(`[SubagentSpawner] 🎰 Agent ${agent.agentId} acquired execution slot. Active: ${this.activeAgents}`);

        // SWARM SYNC: Subscribe to real-time memory updates from sibling agents
        // This ensures the agent is aware of what its "army" peers are finding
        const swarmMessages: string[] = [];
        const unsubscribe = swarm.subscribe(agent.parentSessionId, agent.agentId, (fact) => {
            console.log(`[Subagent] 🧠 ${agent.agentId} received swarm update: ${fact.type}`);
            swarmMessages.push(`[SYNC FROM SWARM]: ${fact.content}`);
        });

        sessionCreated(agent.sessionKey, {
            parentSessionId: agent.parentSessionId,
            task: agent.task
        });

        emitTool(agent.sessionKey, 'agent_start', {
            agentId: agent.agentId,
            agentType: agent.agentType,
            task: agent.task
        });

        const parentEvents = getAgentEvents(agent.parentSessionId);

        try {
            const cappedHistory = parentHistory.slice(-40).map((msg: any) => ({
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
            let toolCalls: any[] = [];
            let retries = 0;
            const MAX_RETRIES = 2;

            while (retries <= MAX_RETRIES) {
                try {
                    if (this.runner?.runStream) {
                        console.log(`[SubagentSpawner] ⚡ Attempt ${retries + 1}: Using runStream for ${agent.agentId} to enable real-time piping`);
                        const entry = registry.get(agent.agentId);
                        const stream = this.runner.runStream(finalTask, cappedHistory, model, agent.parentSessionId, systemPrompt, entry?.projectId);

                        for await (const event of stream) {
                            if (event.type === 'done') break;
                            if (event.type === 'chunk') finalResponse += event.content;
                            if (event.type === 'tool_call') toolCalls.push(event.toolCall);

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
                    } else {
                        console.log(`[SubagentSpawner] 🐢 Attempt ${retries + 1}: Using standard run for ${agent.agentId}`);
                        const entry = registry.get(agent.agentId);
                        const result = await this.runner!.run(finalTask, cappedHistory, model, agent.parentSessionId, systemPrompt, entry?.projectId);
                        finalResponse = result.response;
                        toolCalls = result.toolCalls;
                    }
                    // If success, break out of retry loop
                    break;
                } catch (err: any) {
                    const is502 = String(err).includes('502') || String(err).includes('Bad Gateway');
                    if (is502 && retries < MAX_RETRIES) {
                        retries++;
                        const delay = 2000 * retries;
                        console.warn(`[SubagentSpawner] ⚠️ Agent ${agent.agentId} hit 502/Gateway error. Retrying in ${delay}ms... (Attempt ${retries + 1})`);
                        parentEvents.emit('subagent-progress', 'error', {
                            toolCallId: agent.agentId,
                            content: `Connection error (502). Retrying in ${delay/1000}s... (Attempt ${retries + 1})`,
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

            sessionCompleted(agent.sessionKey, {
                responseLength: finalResponse.length,
                toolCalls: toolCalls.length
            });

            emitTool(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: true
            });

            console.log(`[SubagentSpawner] Agent ${agent.agentId} completed successfully`);

        } catch (error) {
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

            sessionFailed(agent.sessionKey, { error: errMsg });

            emitTool(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: false,
                error: errMsg
            });

            console.error(`[SubagentSpawner] Agent ${agent.agentId} failed:`, error);
        } finally {
            this.releaseSlot();
            console.log(`[SubagentSpawner] 🏁 Agent ${agent.agentId} released execution slot. Active: ${this.activeAgents}`);
            unsubscribe();
        }
    }

    async spawnMultiple(
        parentSessionId: string,
        tasks: string[],
        options: Partial<SpawnOptions> = {}
    ): Promise<SpawnedAgent[]> {
        const spawned: SpawnedAgent[] = [];

        for (const task of tasks) {
            try {
                const agent = await this.spawn({
                    parentSessionId,
                    task,
                    ...options
                });
                spawned.push(agent);
            } catch (error) {
                console.error(`[SubagentSpawner] Failed to spawn agent for task "${(task || '').substring(0, 50)}...":`, error);
            }
        }

        return spawned;
    }

    async waitForAgent(
        agentId: string,
        timeoutMs: number
    ): Promise<SubagentEntry | undefined> {
        const registry = getSubagentRegistry();
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

    async waitForCompletion(
        parentSessionId: string,
        timeoutMs?: number,
        agentType?: AgentType
    ): Promise<SubagentEntry[]> {
        const registry = getSubagentRegistry();
        const effectiveTimeout = timeoutMs ?? AGENT_TIMEOUTS[agentType ?? 'generic'];
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

export { SubagentSpawner };

// Singleton
let spawnerInstance: SubagentSpawner | null = null;

export function getSubagentSpawner(): SubagentSpawner {
    if (!spawnerInstance) {
        spawnerInstance = new SubagentSpawner();
    }
    return spawnerInstance;
}
