"use strict";
/**
 * EverFern Desktop — Subagent Tool
 *
 * Agent tool for spawning parallel subagents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubagentTool = createSubagentTool;
const subagent_spawn_1 = require("../runner/subagent-spawn");
const subagent_registry_1 = require("../runner/subagent-registry");
function createSubagentTool(runner) {
    return {
        name: 'spawn_agent',
        description: 'Spawn a sub-agent for independent tasks. Set wait=true to block until the agent finishes and returns its result. Set wait=false for fire-and-forget parallel exploration (returns immediately, result is lost). For primary web tasks, route through the graph system instead.',
        parameters: {
            type: 'object',
            properties: {
                task: {
                    type: 'string',
                    description: 'The self-contained task description for the sub-agent.'
                },
                agent_type: {
                    type: 'string',
                    description: 'The type of sub-agent: "web-explorer" for web research/browsing, "coding-specialist" for code, "data-analyst" for data analysis, "computer-use" for desktop GUI. Default: "generic".'
                },
                wait: {
                    type: 'boolean',
                    description: 'If true, wait for the agent to complete and return its result. Use this when you need the agent\'s output. Default: true.'
                },
                agent_id: {
                    type: 'string',
                    description: 'Resume an existing agent by ID.'
                },
                max_depth: {
                    type: 'number',
                    description: 'Maximum spawn depth for nested agents (default: 4)'
                }
            },
            required: ['task']
        },
        async execute(args, onUpdate, emitEvent, toolCallId) {
            const task = args.task;
            const agentType = args.agent_type || 'generic';
            const wait = args.wait !== false; // default to true
            const agentId = args.agent_id;
            const maxDepth = args.max_depth || 4;
            onUpdate?.('Spawning sub-agent...');
            try {
                const spawner = (0, subagent_spawn_1.getSubagentSpawner)();
                const options = {
                    parentSessionId: 'main', // Will be overridden by actual parent
                    task,
                    agentType: agentType,
                    maxDepth,
                    toolCallId,
                    runner: runner
                };
                const agent = await spawner.spawn(options);
                if (wait && agent.completion) {
                    onUpdate?.(`Waiting for ${agentType} agent to complete...`);
                    await agent.completion;
                    // Read the result from the registry
                    const registry = (0, subagent_registry_1.getSubagentRegistry)();
                    const entry = registry.get(agent.agentId);
                    return {
                        success: entry?.status === 'completed',
                        output: entry?.result || `Agent completed with status: ${entry?.status || 'unknown'}`,
                        data: {
                            agentId: agent.agentId,
                            sessionKey: agent.sessionKey,
                            status: entry?.status,
                            result: entry?.result,
                            error: entry?.error
                        }
                    };
                }
                return {
                    success: true,
                    output: `Sub-agent spawned successfully: ${agent.agentId}\nTask: ${task.substring(0, 100)}...\nStatus: ${agent.status}`,
                    data: {
                        agentId: agent.agentId,
                        sessionKey: agent.sessionKey,
                        status: agent.status
                    }
                };
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                return {
                    success: false,
                    output: `Failed to spawn sub-agent: ${errMsg}`,
                    error: errMsg
                };
            }
        }
    };
}
