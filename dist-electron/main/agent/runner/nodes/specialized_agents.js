"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebExplorerNode = exports.createComputerUseNode = exports.createDataAnalystNode = exports.createCodingSpecialistNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const createCodingSpecialistNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        return integrator.wrapNode('coding_specialist', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'coding_specialist',
            systemPromptOverride: `You are the EverFern Coding Specialist. 
Your goal is to write, debug, and optimize code with extreme precision. 
Use your tools (write, edit, run_command) to implement the requested features.`
        }), 'Analyzing coding task');
    };
};
exports.createCodingSpecialistNode = createCodingSpecialistNode;
const createDataAnalystNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        return integrator.wrapNode('data_analyst', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'data_analyst',
            systemPromptOverride: `You are the EverFern Data Analyst. 
Your goal is to process data, generate reports, and provide insights. 
Use your tools (read, web_fetch, write) to analyze datasets and present results.`
        }), 'Analyzing data task');
    };
};
exports.createDataAnalystNode = createDataAnalystNode;
const createComputerUseNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        return integrator.wrapNode('computer_use_agent', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'computer_use_agent',
            systemPromptOverride: `You are the EverFern OS Interaction Agent. 
Your goal is to navigate the operating system and interact with desktop applications. 
Use the 'computer_use' tool to achieve your goals.`
        }), 'Automating computer tasks');
    };
};
exports.createComputerUseNode = createComputerUseNode;
const createWebExplorerNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const tools = toolDefs || runner._buildToolDefinitions();
        return integrator.wrapNode('web_explorer', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'web_explorer',
            systemPromptOverride: `You are the EverFern Web Explorer. 
Your goal is to find information on the web and navigate websites. 
Use your tools (web_search, web_fetch) to gather the requested data.`
        }), 'Searching for information');
    };
};
exports.createWebExplorerNode = createWebExplorerNode;
