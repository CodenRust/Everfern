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
    setRunner(runner) {
        this.runner = runner;
    }
    async spawn(options) {
        const { parentSessionId, task, agentType = 'generic', systemPrompt, context, model, mode = 'run', workspaceDir, maxDepth = 3, parentHistory = [] } = options;
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
            maxDepth,
            currentDepth
        });
        const events = (0, agent_events_1.getAgentEvents)(sessionKey);
        events.setSessionKey(sessionKey);
        (0, agent_events_1.emitLifecycle)(parentSessionId, 'agent_spawned', {
            agentId,
            sessionKey,
            agentType,
            task: enrichedTask.substring(0, 100)
        });
        console.log(`[SubagentSpawner] Spawned ${agentId} (${agentType}) for parent ${parentSessionId} (depth: ${currentDepth})`);
        const spawnedAgent = {
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
    async runSubagent(agent, model, systemPrompt, parentHistory = []) {
        const registry = (0, subagent_registry_1.getSubagentRegistry)();
        registry.update(agent.agentId, { status: 'running' });
        agent.status = 'running';
        (0, session_lifecycle_events_1.sessionCreated)(agent.sessionKey, {
            parentSessionId: registry.get(agent.agentId)?.parentSessionId,
            task: agent.task
        });
        (0, agent_events_1.emitTool)(agent.sessionKey, 'agent_start', {
            agentId: agent.agentId,
            agentType: agent.agentType,
            task: agent.task
        });
        try {
            const cappedHistory = parentHistory.slice(-40).map((msg) => ({
                role: msg.role || (msg._getType?.() === 'human' ? 'user' : 'assistant'),
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            }));
            const result = await this.runner.run(agent.task, cappedHistory, model, systemPrompt);
            registry.complete(agent.agentId, result.response);
            (0, session_lifecycle_events_1.sessionCompleted)(agent.sessionKey, {
                responseLength: result.response.length,
                toolCalls: result.toolCalls.length
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
            (0, session_lifecycle_events_1.sessionFailed)(agent.sessionKey, { error: errMsg });
            (0, agent_events_1.emitTool)(agent.sessionKey, 'agent_end', {
                agentId: agent.agentId,
                success: false,
                error: errMsg
            });
            console.error(`[SubagentSpawner] Agent ${agent.agentId} failed:`, error);
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
                console.error(`[SubagentSpawner] Failed to spawn agent for task "${task.substring(0, 50)}...":`, error);
            }
        }
        return spawned;
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
