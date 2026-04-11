"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("./state");
const triage_1 = require("./nodes/triage");
const planner_1 = require("./nodes/planner");
const call_model_1 = require("./nodes/call_model");
const execute_tools_1 = require("./nodes/execute_tools");
const validation_1 = require("./nodes/validation");
const specialized_agents_1 = require("./nodes/specialized_agents");
const triage_2 = require("./triage");
const memorySaver = new langgraph_1.MemorySaver();
const buildGraph = (runner, toolDefs, tools, eventQueue, conversationId) => {
    const config = runner.config;
    const hitlNode = async (state) => {
        runner.telemetry.transition('hitl');
        const feedback = (0, langgraph_1.interrupt)({ question: "High-risk action detected. Approve?", task: state.pendingToolCalls });
        return { taskPhase: 'orchestrating' };
    };
    const router = (0, call_model_1.createCallModelNode)(runner, toolDefs, eventQueue, config.maxIterations);
    const orchestrator = (0, execute_tools_1.createExecuteToolsNode)(runner, tools, config, eventQueue, conversationId);
    const validator = (0, validation_1.createValidationNode)(runner);
    const codingSpecialist = (0, specialized_agents_1.createCodingSpecialistNode)(runner);
    const dataAnalyst = (0, specialized_agents_1.createDataAnalystNode)(runner);
    return new langgraph_1.StateGraph(state_1.GraphState)
        .addNode('intent_classifier', (0, triage_1.createTriageNode)(runner, eventQueue))
        .addNode('global_planner', (0, planner_1.createPlannerNode)(runner, eventQueue))
        .addNode('task_router', router)
        .addNode('coding_specialist', codingSpecialist)
        .addNode('data_analyst', dataAnalyst)
        .addNode('action_validation', validator)
        .addNode('hitl_approval', hitlNode)
        .addNode('multi_tool_orchestrator', orchestrator)
        .addEdge(langgraph_1.START, 'intent_classifier')
        .addEdge('intent_classifier', 'global_planner')
        .addEdge('global_planner', 'task_router')
        .addConditionalEdges('task_router', (state) => {
        const isReadOnly = (0, triage_2.isReadOnlyTask)(state.currentIntent || 'unknown');
        const hasToolCalls = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        if (state.currentIntent === 'coding')
            return 'coding_specialist';
        if (state.currentIntent === 'analyze')
            return 'data_analyst';
        if (hasToolCalls)
            return 'action_validation';
        // If it's an executing phase but no tool calls, only continue if NOT read-only
        if (state.taskPhase === 'executing' && !isReadOnly)
            return 'action_validation';
        return langgraph_1.END;
    }, {
        coding_specialist: 'coding_specialist',
        data_analyst: 'data_analyst',
        action_validation: 'action_validation',
        [langgraph_1.END]: langgraph_1.END
    })
        .addEdge('coding_specialist', 'action_validation')
        .addEdge('data_analyst', 'action_validation')
        .addConditionalEdges('action_validation', (state) => {
        return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
    }, { hitl_approval: 'hitl_approval', multi_tool_orchestrator: 'multi_tool_orchestrator' })
        .addEdge('hitl_approval', 'multi_tool_orchestrator')
        .addEdge('multi_tool_orchestrator', 'task_router')
        .compile({ checkpointer: memorySaver });
};
exports.buildGraph = buildGraph;
