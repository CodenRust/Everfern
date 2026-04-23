"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebExplorerNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const createWebExplorerNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        // Build plan context
        const plan = state.decomposedTask;
        const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';
        // Emit web explorer active event for frontend
        eventQueue?.push({ type: 'thought', content: '\n🌐 Web Explorer: Navigating the web and gathering information...' });
        // Load system prompt from file
        let systemPrompt = '';
        try {
            systemPrompt = await (0, promises_1.readFile)((0, path_1.join)(process.cwd(), 'main/agent/prompts/web-explorer.md'), 'utf-8');
        }
        catch (error) {
            console.warn('Failed to load web explorer prompt, using fallback');
            systemPrompt = `You are the EverFern Web Explorer.
Your goal is to find information on the web and navigate websites.
Use your tools (web_search, web_fetch) to gather the requested data.

CRITICAL RULES:
- Do NOT call create_plan or execution_plan. A plan already exists from the decomposer.
- Do NOT narrate what you are about to do. Skip all filler text. Call tools DIRECTLY.`;
        }
        return integrator.wrapNode('web_explorer', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'web_explorer',
            systemPromptOverride: systemPrompt + planContext
        }), 'Searching for information');
    };
};
exports.createWebExplorerNode = createWebExplorerNode;
