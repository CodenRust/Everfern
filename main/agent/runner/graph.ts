import { StateGraph, END, START, MemorySaver, interrupt } from '@langchain/langgraph';
import { GraphState, GraphStateType, StreamEvent } from './state';
import { createTriageNode } from './nodes/triage';
import { createPlannerNode } from './nodes/planner';
import { createCallModelNode } from './nodes/call_model'; 
import { createExecuteToolsNode } from './nodes/execute_tools'; 
import { createValidationNode } from './nodes/validation';
import { createCodingSpecialistNode, createDataAnalystNode, createComputerUseNode, createWebExplorerNode } from './nodes/specialized_agents';
import { AgentRunner } from './runner';
import { isReadOnlyTask } from './triage';

const memorySaver = new MemorySaver();

export const buildGraph = (
  runner: AgentRunner,
  toolDefs: any[],
  tools: any[],
  eventQueue?: StreamEvent[],
  conversationId?: string
) => {
  const config = (runner as any).config;

  const hitlNode = async (state: GraphStateType) => {
    runner.telemetry.transition('hitl');
    const feedback = interrupt({ question: "High-risk action detected. Approve?", task: state.pendingToolCalls });
    return { taskPhase: 'orchestrating' };
  };

  const orchestrator = createExecuteToolsNode(runner, tools, config, eventQueue, conversationId);
  const validator = createValidationNode(runner);
  
  const codingSpecialist = createCodingSpecialistNode(runner, eventQueue);
  const dataAnalyst = createDataAnalystNode(runner, eventQueue);
  const computerUse = createComputerUseNode(runner, eventQueue);
  const webExplorer = createWebExplorerNode(runner, eventQueue);

  return new StateGraph(GraphState)
    .addNode('intent_classifier', createTriageNode(runner, eventQueue))
    .addNode('global_planner', createPlannerNode(runner, eventQueue))
    .addNode('coding_specialist', codingSpecialist)
    .addNode('data_analyst', dataAnalyst)
    .addNode('computer_use_agent', computerUse)
    .addNode('web_explorer', webExplorer)
    .addNode('action_validation', validator)
    .addNode('hitl_approval', hitlNode)
    .addNode('multi_tool_orchestrator', orchestrator)
    .addEdge(START, 'intent_classifier')
    .addEdge('intent_classifier', 'global_planner')
    .addConditionalEdges('global_planner', (state) => {
        const intent = state.currentIntent || 'unknown';
        const isReadOnly = isReadOnlyTask(intent);
        
        // If read-only, we skip specialists and go straight to a default model call or end
        if (isReadOnly) return 'web_explorer'; // Use web_explorer as default for simple questions

        if (intent === 'coding') return 'coding_specialist';
        if (intent === 'analyze') return 'data_analyst';
        if (intent.includes('automate') || intent.includes('computer')) return 'computer_use_agent';
        
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
        if (!hasTools) return END; // Model finished without tools

        return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
    }, { 
        hitl_approval: 'hitl_approval', 
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        [END]: END 
    })
    .addEdge('hitl_approval', 'multi_tool_orchestrator')
    .addEdge('multi_tool_orchestrator', 'global_planner') // Loop back to planner for next step
    .compile({ checkpointer: memorySaver });
};

