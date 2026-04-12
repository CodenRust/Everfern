"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrainNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
/**
 * Central Brain Node - The Main Orchestrator
 *
 * This is the core intelligence of the system that:
 * - Uses the main system prompt (SYSTEM_PROMPT.md)
 * - Analyzes the user's request and current context
 * - Decides which specialist nodes to delegate to (if needed)
 * - Coordinates multi-specialist workflows
 * - Synthesizes outputs from multiple specialists
 * - Makes high-level strategic decisions
 * - Handles all user interactions directly
 *
 * The brain acts as the primary agent that has full access to all tools
 * and can delegate to specialists when their expertise is needed.
 */
const createBrainNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        return integrator.wrapNode('brain', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'brain',
            // No systemPromptOverride - uses the main SYSTEM_PROMPT.md file
            // The brain is the primary agent with full capabilities
        }), 'Processing request');
    };
};
exports.createBrainNode = createBrainNode;
