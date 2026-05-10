/**
 * EverFern Desktop — Subagent Tool
 * 
 * Agent tool for spawning parallel subagents.
 */

import type { AgentTool, ToolResult } from '../runner/types';
import { getSubagentSpawner, type SubagentRunner, type SpawnOptions } from '../runner/subagent-spawn';
import { getSubagentRegistry } from '../runner/subagent-registry';

export function createSubagentTool(runner: SubagentRunner): AgentTool {
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

        async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
            const task = args.task as string;
            const agentType = (args.agent_type as string) || 'generic';
            const wait = args.wait !== false; // default to true
            const agentId = args.agent_id as string | undefined;
            const maxDepth = (args.max_depth as number) || 4;

            onUpdate?.('Spawning sub-agent...');

            try {
                const spawner = getSubagentSpawner();

                const options: SpawnOptions = {
                    parentSessionId: 'main', // Will be overridden by actual parent
                    task,
                    agentType: agentType as any,
                    maxDepth,
                    toolCallId,
                    runner: runner
                };

                const agent = await spawner.spawn(options);

                if (wait && agent.completion) {
                    onUpdate?.(`Waiting for ${agentType} agent to complete...`);
                    await agent.completion;

                    // Read the result from the registry
                    const registry = getSubagentRegistry();
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
            } catch (error) {
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
