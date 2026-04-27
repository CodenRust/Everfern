/**
 * EverFern Desktop — Subagent Spawner
 *
 * Spawns parallel subagents with session isolation.
 * Implements OpenClaw-style depth limiting and workspace inheritance.
 */

import * as crypto from 'crypto';
import { getSubagentRegistry, generateAgentId, type SubagentEntry } from './subagent-registry';
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

export interface SpawnOptions {
    parentSessionId: string;
    task: string;
    model?: string;
    mode?: 'run' | 'session';
    workspaceDir?: string;
    maxDepth?: number;
    parentHistory?: Array<{ role: string; content: string | any[] }>;
}

export interface SpawnedAgent {
    agentId: string;
    sessionKey: string;
    task: string;
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
        task: string,
        history: Array<{ role: string; content: string }>,
        model?: string
    ): Promise<{ response: string; toolCalls: Array<{ toolName: string; args: Record<string, unknown> }> }>;
}

class SubagentSpawner {
    private runner?: SubagentRunner;
    private maxGlobalDepth: number = 3;

    setRunner(runner: SubagentRunner) {
        this.runner = runner;
    }

    async spawn(options: SpawnOptions): Promise<SpawnedAgent> {
        const {
            parentSessionId,
            task,
            model,
            mode = 'run',
            workspaceDir,
            maxDepth = 3,
            parentHistory = []
        } = options;

        if (!this.runner) {
            console.warn('[SubagentSpawner] No runner configured. Spawning failed.');
            throw new Error('SubagentSpawner: No runner configured');
        }


        const registry = getSubagentRegistry();

        // Check depth limit
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

        // Register the subagent
        const entry = registry.register({
            agentId,
            parentSessionId,
            sessionKey,
            task,
            mode,
            status: 'pending',
            workspaceDir,
            maxDepth,
            currentDepth
        });

        // Set up events
        const events = getAgentEvents(sessionKey);
        events.setSessionKey(sessionKey);

        // Emit spawn event
        emitLifecycle(parentSessionId, 'agent_spawned', {
            agentId,
            sessionKey,
            task: task.substring(0, 100)
        });

        console.log(`[SubagentSpawner] Spawned ${agentId} for parent ${parentSessionId} (depth: ${currentDepth})`);

        const spawnedAgent: SpawnedAgent = {
            agentId,
            sessionKey,
            task,
            status: 'pending',
            abort: () => registry.abort(agentId)
        };

        // Start the agent
        this.runSubagent(spawnedAgent, model, parentHistory);

        return spawnedAgent;
    }

    private async runSubagent(agent: SpawnedAgent, model?: string, parentHistory: Array<{ role: string; content: string | any[] }> = []): Promise<void> {
        const registry = getSubagentRegistry();

        registry.update(agent.agentId, { status: 'running' });
        agent.status = 'running';

        sessionCreated(agent.sessionKey, {
            parentSessionId: registry.get(agent.agentId)?.parentSessionId,
            task: agent.task
        });

        emitTool(agent.sessionKey, 'agent_start', {
            agentId: agent.agentId,
            task: agent.task
        });

        try {
            // Apply context window cap: limit parentHistory to most recent 20 turns (40 messages max)
            // This prevents context window overflow when passing parent conversation to subagent
            const cappedHistory = parentHistory.slice(-40).map((msg: any) => ({
              role: msg.role || (msg._getType?.() === 'human' ? 'user' : 'assistant'),
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            }));

            // Run the agent with parent conversation context
            const result = await this.runner!.run(
                agent.task,
                cappedHistory,
                model
            );

            // Complete the subagent
            registry.complete(agent.agentId, result.response);
            sessionCompleted(agent.sessionKey, {
                responseLength: result.response.length,
                toolCalls: result.toolCalls.length
            });

            emitTool(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: true
            });

            console.log(`[SubagentSpawner] Agent ${agent.agentId} completed successfully`);

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);

            registry.complete(agent.agentId, undefined, errMsg);
            sessionFailed(agent.sessionKey, { error: errMsg });

            emitTool(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: false,
                error: errMsg
            });

            console.error(`[SubagentSpawner] Agent ${agent.agentId} failed:`, error);
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
                console.error(`[SubagentSpawner] Failed to spawn agent for task "${task.substring(0, 50)}...":`, error);
            }
        }

        return spawned;
    }

    async waitForCompletion(
        parentSessionId: string,
        timeoutMs: number = 60000
    ): Promise<SubagentEntry[]> {
        const registry = getSubagentRegistry();
        const startTime = Date.now();

        while (registry.hasPendingChildren(parentSessionId)) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for subagents (${timeoutMs}ms)`);
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
