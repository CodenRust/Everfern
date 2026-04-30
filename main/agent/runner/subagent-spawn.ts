/**
 * EverFern Desktop — Subagent Spawner
 *
 * Spawns parallel subagents with session isolation.
 * Implements OpenClaw-style depth limiting and workspace inheritance.
 */

import * as crypto from 'crypto';
import { getSubagentRegistry, generateAgentId, type SubagentEntry, type AgentType } from './subagent-registry';
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
    maxDepth?: number;
    parentHistory?: Array<{ role: string; content: string | any[] }>;
}

export interface SpawnedAgent {
    agentId: string;
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
        task: string,
        history: Array<{ role: string; content: string }>,
        model?: string,
        systemPrompt?: string
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
            agentType = 'generic',
            systemPrompt,
            context,
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
            maxDepth,
            currentDepth
        });

        const events = getAgentEvents(sessionKey);
        events.setSessionKey(sessionKey);

        emitLifecycle(parentSessionId, 'agent_spawned', {
            agentId,
            sessionKey,
            agentType,
            task: enrichedTask.substring(0, 100)
        });

        console.log(`[SubagentSpawner] Spawned ${agentId} (${agentType}) for parent ${parentSessionId} (depth: ${currentDepth})`);

        const spawnedAgent: SpawnedAgent = {
            agentId,
            sessionKey,
            task: enrichedTask,
            agentType,
            status: 'pending',
            abort: () => registry.abort(agentId)
        };

        this.runSubagent(spawnedAgent, model, systemPrompt, parentHistory);

        return spawnedAgent;
    }

    private async runSubagent(agent: SpawnedAgent, model?: string, systemPrompt?: string, parentHistory: Array<{ role: string; content: string | any[] }> = []): Promise<void> {
        const registry = getSubagentRegistry();

        registry.update(agent.agentId, { status: 'running' });
        agent.status = 'running';

        sessionCreated(agent.sessionKey, {
            parentSessionId: registry.get(agent.agentId)?.parentSessionId,
            task: agent.task
        });

        emitTool(agent.sessionKey, 'agent_start', {
            agentId: agent.agentId,
            agentType: agent.agentType,
            task: agent.task
        });

        try {
            const cappedHistory = parentHistory.slice(-40).map((msg: any) => ({
              role: msg.role || (msg._getType?.() === 'human' ? 'user' : 'assistant'),
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            }));

            const result = await this.runner!.run(
                agent.task,
                cappedHistory,
                model,
                systemPrompt
            );

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
