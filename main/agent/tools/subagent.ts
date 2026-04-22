/**
 * EverFern Desktop — Subagent Tool
 * 
 * Agent tool for spawning parallel subagents.
 */

import type { AgentTool, ToolResult } from '../runner/types';
import { getSubagentSpawner, type SubagentRunner, type SpawnOptions } from '../runner/subagent-spawn';

export function createSubagentTool(runner: SubagentRunner): AgentTool {
    return {
        name: 'spawn_agent',
        description: 'Spawn a specialized sub-agent for complex, parallelizable, or long-horizon tasks. The sub-agent runs independently and returns results. Use this for tasks that can be broken into parallel subtasks.',
        parameters: {
            type: 'object',
            properties: {
                task: { 
                    type: 'string', 
                    description: 'The self-contained task description for the sub-agent.' 
                },
                agent_id: { 
                    type: 'string', 
                    description: 'Resume an existing agent by ID.' 
                },
                max_depth: { 
                    type: 'number', 
                    description: 'Maximum spawn depth for nested agents (default: 3)'
                }
            },
            required: ['task']
        },

        async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
            const task = args.task as string;
            const agentId = args.agent_id as string | undefined;
            const maxDepth = (args.max_depth as number) || 3;

            onUpdate?.('Spawning sub-agent...');

            try {
                const spawner = getSubagentSpawner();
                spawner.setRunner(runner);

                const options: SpawnOptions = {
                    parentSessionId: 'main', // Will be overridden by actual parent
                    task,
                    maxDepth
                };

                const agent = await spawner.spawn(options);

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
