"use strict";
/**
 * EverFern Desktop — Subagent Tool
 *
 * Agent tool for spawning parallel subagents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubagentTool = createSubagentTool;
const subagent_spawn_1 = require("../runner/subagent-spawn");
function createSubagentTool(runner) {
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
                agent_type: {
                    type: 'string',
                    description: 'The type of sub-agent to spawn: "web-explorer" for web research/browsing/website navigation, "coding-specialist" for code tasks, "data-analyst" for data analysis, "computer-use" for desktop GUI automation (NOT for websites). Default: "web-explorer" if the task involves visiting/looking up websites, otherwise "generic".'
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
        async execute(args, onUpdate, emitEvent, toolCallId) {
            const task = args.task;
            const agentType = args.agent_type || 'generic';
            const agentId = args.agent_id;
            const maxDepth = args.max_depth || 3;
            onUpdate?.('Spawning sub-agent...');
            try {
                const spawner = (0, subagent_spawn_1.getSubagentSpawner)();
                spawner.setRunner(runner);
                const options = {
                    parentSessionId: 'main', // Will be overridden by actual parent
                    sponsorSessionKey: runner.currentAgentSessionKey,
                    task,
                    agentType: agentType,
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
