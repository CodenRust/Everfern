"use strict";
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
exports.createSwarmOrchestratorNode = void 0;
const subagent_spawn_1 = require("../subagent-spawn");
/**
 * EverFern Swarm Orchestrator
 *
 * Executes parallelizable steps from a decomposed task in parallel.
 * Utilizes the Swarm Memory Bus for real-time synchronization between agents.
 */
const createSwarmOrchestratorNode = (runner, eventQueue) => {
    return async (state) => {
        const plan = state.decomposedTask;
        const completedSteps = state.completedSteps || [];
        const spawnedAgents = state.subagentSpawned || [];
        const hasSpawnedSubagents = spawnedAgents.length > 0;
        console.log(`[SwarmOrchestrator] Entering node. taskPhase: ${state.taskPhase}, spawnedAgents: ${spawnedAgents.length}`);
        if (!plan || plan.steps.length === 0) {
            console.warn('[SwarmOrchestrator] No plan found, returning to evaluating.');
            return { taskPhase: 'evaluating' };
        }
        // PHASE 1: Dispatch
        if (!hasSpawnedSubagents) {
            // Filter for steps that are ready (dependencies met) and parallelizable
            const readySteps = plan.steps.filter(step => {
                if (completedSteps.includes(step.id))
                    return false;
                return (step.dependsOn || []).every(depId => completedSteps.includes(depId));
            });
            const parallelSteps = readySteps.filter(s => s.canParallelize || s.parallelGroup !== undefined);
            if (parallelSteps.length === 0) {
                console.log('[SwarmOrchestrator] No parallel steps ready, returning to brain.');
                return { taskPhase: 'brain' };
            }
            eventQueue?.push({
                type: 'thought',
                content: `\n🐝 SWARM: Launching ${parallelSteps.length} parallel agents for tasks:\n${parallelSteps.map(s => ` - ${s.description}`).join('\n')}`
            });
            const spawner = (0, subagent_spawn_1.getSubagentSpawner)();
            const spawned = [];
            // Configure spawner with the current runner to enable event piping
            spawner.setRunner(runner);
            for (const step of parallelSteps) {
                const toolCallId = `swarm_${step.id}_${Date.now().toString(36)}`;
                // Emit pseudo tool_start for the timeline
                eventQueue?.push({
                    type: 'tool_start',
                    toolName: `swarm_agent:${mapToolToAgentType(step.tool)}`,
                    toolArgs: { task: step.description },
                    toolCallId
                });
                const options = {
                    parentSessionId: runner.currentConversationId || 'default',
                    task: step.description,
                    agentType: mapToolToAgentType(step.tool),
                    model: runner.client.model,
                    mode: 'run',
                    maxDepth: 1,
                    context: `Overall goal: ${plan.title}\nTask ID: ${step.id}`
                };
                console.log(`[SwarmOrchestrator] Spawning agent for step ${step.id}: ${step.description}`);
                const agent = await spawner.spawn(options);
                spawned.push({
                    agentId: agent.agentId,
                    sessionKey: agent.sessionKey,
                    stepId: step.id,
                    task: step.description,
                    toolCallId // Track the pseudo toolCallId
                });
            }
            return {
                subagentSpawned: spawned,
                taskPhase: 'swarm',
                returningFromSpecialist: 'swarm_orchestrator'
            };
        }
        // PHASE 2: Check Status (Non-blocking)
        if (hasSpawnedSubagents) {
            const ids = spawnedAgents.map((s) => s.agentId);
            const { getSubagentRegistry } = await Promise.resolve().then(() => __importStar(require('../subagent-registry')));
            const registry = getSubagentRegistry();
            const children = registry.getChildren(runner.currentConversationId || 'default');
            const statusMap = ids.map((id) => {
                const child = children.find(c => c.agentId === id);
                const spawnedInfo = spawnedAgents.find((s) => s.agentId === id);
                return { id, status: child?.status || 'unknown', toolCallId: spawnedInfo?.toolCallId };
            });
            const allDone = statusMap.every((s) => s.status === 'completed' || s.status === 'failed' || s.status === 'aborted');
            if (!allDone) {
                const runningCount = statusMap.filter((s) => s.status === 'running' || s.status === 'pending').length;
                console.log(`[SwarmOrchestrator] Waiting for ${runningCount} agents...`);
                // Safety: track how many polling iterations we've done
                const pollCount = (state.swarmPollCount || 0) + 1;
                const MAX_POLL_ITERATIONS = 30; // 30 × 2s = 60s max wait
                if (pollCount >= MAX_POLL_ITERATIONS) {
                    console.warn(`[SwarmOrchestrator] ⚠️ Exceeded max poll iterations (${MAX_POLL_ITERATIONS}). Aborting swarm wait and returning to brain.`);
                    eventQueue?.push({
                        type: 'thought',
                        content: `\n⚠️ SWARM: Timeout reached — some agents may not have completed. Proceeding with available results.`
                    });
                    // Force transition out of the swarm loop
                    return {
                        taskPhase: 'brain',
                        swarmPollCount: 0,
                        subagentSpawned: [],
                        returningFromSpecialist: null
                    };
                }
                // Heartbeat thought to keep UI alive and show progress
                eventQueue?.push({
                    type: 'thought',
                    content: `⏳ Swarm: Working... (${runningCount} agents active, ${ids.length - runningCount} finished)`
                });
                // Delay to prevent tight loop
                await new Promise(r => setTimeout(r, 2000));
                return { taskPhase: 'swarm', swarmPollCount: pollCount };
            }
            // All agents finished! Aggregate results.
            console.log('[SwarmOrchestrator] All agents finished. Aggregating...');
            const results = [];
            const finishedStepIds = [];
            for (const s of spawnedAgents) {
                const child = children.find(c => c.agentId === s.agentId);
                // Emit pseudo tool_call (complete) for the timeline
                eventQueue?.push({
                    type: 'tool_call',
                    toolCall: {
                        toolName: `swarm_agent`,
                        args: { task: child?.task },
                        result: { success: child?.status === 'completed', output: child?.result || child?.error },
                        id: s.toolCallId
                    }
                });
                if (child?.status === 'completed' && child.result) {
                    results.push(`### Task Completed: ${child.task}\nResult: ${child.result}`);
                    finishedStepIds.push(s.stepId);
                }
                else if (child?.status === 'failed') {
                    results.push(`### Task Failed: ${child.task}\nError: ${child.error || 'Unknown error'}`);
                }
            }
            eventQueue?.push({
                type: 'thought',
                content: `\n✅ SWARM: Parallel phase complete. Synthesized ${results.length} findings.`
            });
            // Add findings to message history so brain can see them
            const synthesisMsg = {
                role: 'assistant',
                content: `[SWARM SYNTHESIS]\n\n${results.join('\n\n---\n\n')}\n\nCompleted Steps: ${finishedStepIds.join(', ')}`
            };
            return {
                messages: [...state.messages, synthesisMsg],
                completedSteps: [...completedSteps, ...finishedStepIds],
                subagentSpawned: [], // Clear for next potential swarm phase
                taskPhase: 'brain',
                returningFromSpecialist: null // Clear this since we are back in brain control
            };
        }
        return { taskPhase: 'brain' };
    };
};
exports.createSwarmOrchestratorNode = createSwarmOrchestratorNode;
function mapToolToAgentType(tool) {
    if (!tool)
        return 'generic';
    const t = tool.toLowerCase();
    if (t.includes('web') || t === 'navis')
        return 'web-explorer';
    if (t.includes('write') || t.includes('edit') || t.includes('bash') || t.includes('command'))
        return 'coding-specialist';
    if (t === 'computer_use')
        return 'computer-use';
    if (t === 'analyze')
        return 'data-analyst';
    return 'generic';
}
