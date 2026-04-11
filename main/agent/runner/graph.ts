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
import type { MissionTracker } from './mission-tracker';

const memorySaver = new MemorySaver();

export const buildGraph = (
  runner: AgentRunner,
  toolDefs: any[],
  tools: any[],
  eventQueue?: StreamEvent[],
  conversationId?: string,
  missionTracker?: MissionTracker,
) => {
  const config = (runner as any).config;

  const hitlNode = async (state: GraphStateType) => {
    runner.telemetry.transition('hitl');
    if (missionTracker) missionTracker.startStep('step:hitl');
    const feedback = interrupt({ question: "High-risk action detected. Approve?", task: state.pendingToolCalls });
    if (missionTracker) missionTracker.completeStep('step:hitl');
    return { taskPhase: 'orchestrating' };
  };

  const orchestrator = createExecuteToolsNode(runner, tools, config, eventQueue, conversationId, missionTracker);
  const validator = createValidationNode(runner, missionTracker);
  
  const codingSpecialist = createCodingSpecialistNode(runner, eventQueue, missionTracker, toolDefs);
  const dataAnalyst = createDataAnalystNode(runner, eventQueue, missionTracker, toolDefs);
  const computerUse = createComputerUseNode(runner, eventQueue, missionTracker, toolDefs);
  const webExplorer = createWebExplorerNode(runner, eventQueue, missionTracker, toolDefs);

  return new StateGraph(GraphState)
    .addNode('intent_classifier', createTriageNode(runner, eventQueue, missionTracker))
    .addNode('global_planner', createPlannerNode(runner, eventQueue, missionTracker))
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
        
        // If no tools, check if task is actually complete
        if (!hasTools) {
          // Check if we should continue iterating or complete the mission
          return state.shouldContinueIteration ? 'global_planner' : END;
        }

        return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
    }, { 
        global_planner: 'global_planner',
        hitl_approval: 'hitl_approval', 
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        [END]: END 
    })
    .addEdge('hitl_approval', 'multi_tool_orchestrator')
    .addEdge('multi_tool_orchestrator', 'global_planner') // Loop back to planner for next step
    .compile({ checkpointer: memorySaver });
};

