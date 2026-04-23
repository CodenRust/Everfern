"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCodingSpecialistNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const createCodingSpecialistNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        // Build plan context
        const plan = state.decomposedTask;
        const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';
        // Emit coding specialist active event for frontend
        eventQueue?.push({ type: 'thought', content: '\n💻 Coding Specialist: Analyzing source code and preparing implementation...' });
        // Load system prompt from file
        let systemPrompt = '';
        try {
            systemPrompt = await (0, promises_1.readFile)((0, path_1.join)(process.cwd(), 'main/agent/prompts/coding-specialist.md'), 'utf-8');
        }
        catch (error) {
            console.warn('Failed to load coding specialist prompt, using fallback');
            systemPrompt = `You are the EverFern Coding Specialist.
Your goal is to write, debug, and optimize code with extreme precision.
Use your tools (write, edit, run_command) to implement the requested features.

CRITICAL RULES:
- Do NOT call create_plan or execution_plan. A plan already exists from the decomposer.
- Do NOT narrate what you are about to do. Skip all filler text like "I'll now..." or "Let me...".
- Call your tools DIRECTLY without preamble.`;
        }
        return integrator.wrapNode('coding_specialist', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'coding_specialist',
            systemPromptOverride: systemPrompt + planContext
        }), 'Writing Code & Implementing Features');
    };
};
exports.createCodingSpecialistNode = createCodingSpecialistNode;
