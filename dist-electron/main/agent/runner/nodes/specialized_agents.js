"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebExplorerNode = exports.createComputerUseNode = exports.createDataAnalystNode = exports.createCodingSpecialistNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const createCodingSpecialistNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        // Build plan context
        const plan = state.decomposedTask;
        const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';
        return integrator.wrapNode('coding_specialist', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'coding_specialist',
            systemPromptOverride: `You are the EverFern Coding Specialist. 
Your goal is to write, debug, and optimize code with extreme precision. 
Use your tools (write, edit, run_command) to implement the requested features.${planContext}`
        }), 'Analyzing coding task');
    };
};
exports.createCodingSpecialistNode = createCodingSpecialistNode;
const createDataAnalystNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        // Build plan context
        const plan = state.decomposedTask;
        const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';
        return integrator.wrapNode('data_analyst', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'data_analyst',
            systemPromptOverride: `You are the EverFern Data Analyst. 
Your goal is to process data, generate reports, and provide insights. 
Use your tools (read, web_fetch, write) to analyze datasets and present results.${planContext}`
        }), 'Analyzing data task');
    };
};
exports.createDataAnalystNode = createDataAnalystNode;
const createComputerUseNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        integrator.startNode('computer_use_agent', 'Initiating autonomous computer automation');
        try {
            runner.telemetry.transition('computer_use_agent');
            eventQueue?.push({ type: 'thought', content: '🖥️ OS Interaction: Launching autonomous sub-agent for desktop automation...' });
            // Get the original task from the last user message or the decomposition plan
            const lastUserMsg = state.messages.filter(m => m.role === 'user' || m.type === 'human').pop();
            const task = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : 'Perform automation task') : 'Automate desktop';
            // Directly emit a tool call for the computer_use tool.
            // This bypasses the model call in this node and goes straight to validation/execution.
            const toolCall = {
                id: `tc-auto-${Date.now()}`,
                name: 'computer_use',
                arguments: { task }
            };
            const assistantMsg = {
                role: 'assistant',
                content: `I will now use the computer_use tool to: ${task}`,
                tool_calls: [toolCall]
            };
            integrator.completeNode('computer_use_agent', 'Automation sub-agent triggered');
            return {
                messages: [assistantMsg],
                pendingToolCalls: [toolCall],
                taskPhase: 'executing'
            };
        }
        catch (error) {
            integrator.failNode('computer_use_agent', error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
};
exports.createComputerUseNode = createComputerUseNode;
const createWebExplorerNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        // Build plan context
        const plan = state.decomposedTask;
        const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';
        return integrator.wrapNode('web_explorer', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'web_explorer',
            systemPromptOverride: `You are the EverFern Web Explorer. 
Your goal is to find information on the web and navigate websites. 
Use your tools (web_search, web_fetch) to gather the requested data.${planContext}`
        }), 'Searching for information');
    };
};
exports.createWebExplorerNode = createWebExplorerNode;
