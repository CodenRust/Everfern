"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("./state");
const triage_1 = require("./nodes/triage");
const planner_1 = require("./nodes/planner");
const execute_tools_1 = require("./nodes/execute_tools");
const validation_1 = require("./nodes/validation");
const specialized_agents_1 = require("./nodes/specialized_agents");
const triage_2 = require("./triage");
const memorySaver = new langgraph_1.MemorySaver();
const buildGraph = (runner, toolDefs, tools, eventQueue, conversationId, missionTracker) => {
    const config = runner.config;
    const hitlNode = async (state) => {
        runner.telemetry.transition('hitl');
        if (missionTracker)
            missionTracker.startStep('step:hitl');
        const feedback = (0, langgraph_1.interrupt)({ question: "High-risk action detected. Approve?", task: state.pendingToolCalls });
        if (missionTracker)
            missionTracker.completeStep('step:hitl');
        return { taskPhase: 'orchestrating' };
    };
    const orchestrator = (0, execute_tools_1.createExecuteToolsNode)(runner, tools, config, eventQueue, conversationId, missionTracker);
    const validator = (0, validation_1.createValidationNode)(runner, missionTracker);
    const codingSpecialist = (0, specialized_agents_1.createCodingSpecialistNode)(runner, eventQueue, missionTracker, toolDefs);
    const dataAnalyst = (0, specialized_agents_1.createDataAnalystNode)(runner, eventQueue, missionTracker, toolDefs);
    const computerUse = (0, specialized_agents_1.createComputerUseNode)(runner, eventQueue, missionTracker, toolDefs);
    const webExplorer = (0, specialized_agents_1.createWebExplorerNode)(runner, eventQueue, missionTracker, toolDefs);
    return new langgraph_1.StateGraph(state_1.GraphState)
        .addNode('intent_classifier', (0, triage_1.createTriageNode)(runner, eventQueue, missionTracker))
        .addNode('global_planner', (0, planner_1.createPlannerNode)(runner, eventQueue, missionTracker))
        .addNode('coding_specialist', codingSpecialist)
        .addNode('data_analyst', dataAnalyst)
        .addNode('computer_use_agent', computerUse)
        .addNode('web_explorer', webExplorer)
        .addNode('action_validation', validator)
        .addNode('hitl_approval', hitlNode)
        .addNode('multi_tool_orchestrator', orchestrator)
        .addEdge(langgraph_1.START, 'intent_classifier')
        .addEdge('intent_classifier', 'global_planner')
        .addConditionalEdges('global_planner', (state) => {
        const intent = state.currentIntent || 'unknown';
        const isReadOnly = (0, triage_2.isReadOnlyTask)(intent);
        // If read-only, we skip specialists and go straight to a default model call or end
        if (isReadOnly)
            return 'web_explorer'; // Use web_explorer as default for simple questions
        if (intent === 'coding')
            return 'coding_specialist';
        if (intent === 'analyze')
            return 'data_analyst';
        if (intent.includes('automate') || intent.includes('computer'))
            return 'computer_use_agent';
        return 'web_explorer';
    }, {
        coding_specialist: 'coding_specialist',
        data_analyst: 'data_analyst',
        computer_use_agent: 'computer_use_agent',
        web_explorer: 'web_explorer'
    })
        .addEdge('coding_specialist', 'action_validation')
        .addEdge('data_analyst', 'action_validation')
        .addEdge('computer_use_agent', 'action_validation')
        .addEdge('web_explorer', 'action_validation')
        .addConditionalEdges('action_validation', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        if (!hasTools)
            return langgraph_1.END; // Model finished without tools
        return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
    }, {
        hitl_approval: 'hitl_approval',
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        [langgraph_1.END]: langgraph_1.END
    })
        .addEdge('hitl_approval', 'multi_tool_orchestrator')
        .addEdge('multi_tool_orchestrator', 'global_planner') // Loop back to planner for next step
        .compile({ checkpointer: memorySaver });
};
exports.buildGraph = buildGraph;
