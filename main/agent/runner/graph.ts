import { StateGraph, END, START, interrupt } from '@langchain/langgraph';
import { GraphState, GraphStateType, StreamEvent } from './state';
import { createTriageNode } from './nodes/triage';
import { createPlannerNode } from './nodes/planner';
import { createExecuteToolsNode } from './nodes/execute_tools';
import { createValidationNode } from './nodes/validation';
import { createBrainNode } from './nodes/brain';
import { createJudgeNode } from './nodes/judge';
import { AgentRunner } from './runner';
import type { MissionTracker } from './mission-tracker';
import { lightweightCheckpointer } from './custom-checkpointer';
import { saveHitlRequest } from '../../store/hitl';
import * as crypto from 'crypto';

// Cache compiled graphs for better performance
const graphCache = new Map<string, any>();

/**
 * ExecutionContext provides access to runtime-specific objects (queue, tracker, etc.)
 * that shouldn't be baked into the cached graph's closures.
 */
export interface ExecutionContext {
  runner: AgentRunner;
  eventQueue?: StreamEvent[];
  missionTracker?: MissionTracker;
  conversationId?: string;
  shouldAbort?: () => boolean;
}

/**
 * Helper to extract ExecutionContext from LangGraph config
 */
const getContext = (config: any): ExecutionContext => {
  const ctx = config?.configurable?.executionContext;
  if (!ctx) {
    throw new Error('ExecutionContext missing from graph config. Ensure it is passed in the configurable field.');
  }
  return ctx;
};

export const buildGraph = (
  runner: AgentRunner,
  toolDefs: any[],
  tools: any[],
) => {
  // Use a cache key based on tool definitions to allow re-use
  // In a production app, toolDefs are usually static per version
  const cacheKey = `graph_v3_${toolDefs.length}`;

  if (graphCache.has(cacheKey)) {
    console.log('[Graph] 📦 Using CACHED execution graph');
    return graphCache.get(cacheKey);
  }

  console.log('[Graph] 🏗️  BUILDING NEW AGENT EXECUTION GRAPH (v3 Cached)');

  const hitlNode = async (state: GraphStateType, config?: any) => {
    const { runner, eventQueue, missionTracker, conversationId, shouldAbort } = getContext(config);

    if (shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }

    runner.telemetry.transition('hitl');
    if (missionTracker) missionTracker.startStep('step:hitl');

    try {
      const formatToolCallSummary = (call: any) => {
        const name = call.name;
        const args = call.arguments || {};
        
        // Specialize formatting for terminal commands
        if (name === 'terminal_execute' || name === 'executePwsh' || name === 'run_command' || name === 'bash') {
          const cmd = args.command || args.CommandLine || args.cmd || JSON.stringify(args);
          return `**${name}** — \`${cmd}\``;
        }
        
        // Default formatting for other tools
        return `**${name}** — \`${JSON.stringify(args).slice(0, 120)}\``;
      };

      const toolSummary = state.pendingToolCalls?.map(formatToolCallSummary).join('\n') || 'No tools pending';

      const reasoning = state.validationResult?.reasoning || 'High-risk operation detected';
      const requestId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const approvalRequest = {
        id: requestId,
        conversationId: conversationId || 'unknown',
        timestamp,
        question: "High-risk action detected. Please review and approve:",
        details: {
          tools: state.pendingToolCalls || [],
          summary: toolSummary,
          reasoning,
        },
        options: ['approve', 'reject', 'modify']
      };

      if (conversationId) {
        saveHitlRequest(approvalRequest);
      }

      // Emit tool_start for ask_user_question so frontend knows to expect a result
      eventQueue?.push({
        type: 'tool_start',
        toolName: 'ask_user_question',
        toolArgs: { questions: reasoning }
      });

      const { askUserTool } = await import('../tools/ask-user');
      const hitlResult = await askUserTool.execute({
        questions: [
          {
            question: `⚠️ High-risk action requires your approval\n\n${reasoning}\n\nActions to execute:\n${toolSummary}`,
            options: ['✅ Approve — proceed with the action', '❌ Reject — cancel and do not proceed'],
            multiSelect: false,
          }
        ]
      }, (msg) => runner.telemetry.info(msg));

      eventQueue?.push({
        type: 'tool_call',
        toolCall: {
          toolName: 'ask_user_question',
          args: { questions: (hitlResult.data as any)?.questions },
          result: hitlResult,
        },
      } as any);

      eventQueue?.push({
        type: 'hitl_request',
        request: approvalRequest,
      } as any);

      await new Promise(resolve => setTimeout(resolve, 300));

      runner.telemetry.info('HITL approval required — ending turn, user must respond');
      if (missionTracker) missionTracker.completeStep('step:hitl');

      // Pause execution and wait for user response via Command({ resume: ... })
      const answer = interrupt(approvalRequest);
      const isApproved = String(answer).includes('[HITL_APPROVED]');
      
      runner.telemetry.info(`HITL response received: ${isApproved ? 'APPROVED' : 'REJECTED'}`);

      return {
        taskPhase: 'executing' as const,
        hitlApprovalResult: {
          approved: isApproved,
          response: isApproved ? 'Approved by user' : 'Rejected by user',
          reasoning: isApproved ? 'User approved the action' : 'User rejected the action',
        },
        completionSignal: null,
      };

    } catch (error) {
      if (missionTracker) missionTracker.failStep('step:hitl', error instanceof Error ? error.message : String(error));
      return {
        taskPhase: 'planning' as const,
        hitlApprovalResult: {
          approved: false,
          response: 'Error occurred during approval process',
          reasoning: `HITL approval failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  };

  // Node wrappers that extract context from config at runtime
  const triageNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    const node = createTriageNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const plannerNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    const node = createPlannerNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const brainNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    const node = createBrainNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs, ctx.shouldAbort);
    return node(state);
  };

  const validatorNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    const node = createValidationNode(ctx.runner, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const orchestratorNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    const node = createExecuteToolsNode(ctx.runner, tools, (ctx.runner as any).config, ctx.eventQueue, ctx.conversationId, ctx.missionTracker, ctx.shouldAbort, (ctx.runner as any).client);
    return node(state);
  };

  const judgeNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    const node = createJudgeNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const compiledGraph = new StateGraph(GraphState)
    .addNode('intent_classifier', triageNode)
    .addNode('global_planner', plannerNode)
    .addNode('brain', brainNode)
    .addNode('action_validation', validatorNode)
    .addNode('hitl_approval', hitlNode)
    .addNode('multi_tool_orchestrator', orchestratorNode)
    .addNode('judge', judgeNode);

  compiledGraph
    .addEdge(START, 'intent_classifier')
    .addEdge('intent_classifier', 'global_planner')
    .addEdge('global_planner', 'brain')
    .addConditionalEdges('brain', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        return hasTools ? 'action_validation' : 'judge';
    }, {
        action_validation: 'action_validation',
        judge: 'judge',
    })
    .addConditionalEdges('action_validation', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        if (hasTools) {
          return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
        }
        return 'judge';
    }, {
        hitl_approval: 'hitl_approval',
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        judge: 'judge',
    })
    .addConditionalEdges('hitl_approval', (state) => {
        const approved = state.hitlApprovalResult?.approved;
        if (approved === true) {
          return 'multi_tool_orchestrator';
        } else if (approved === false) {
          return 'judge';
        } else {
          return END;
        }
    }, {
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        judge: 'judge',
        [END]: END
    })
    .addEdge('multi_tool_orchestrator', 'brain')
    .addConditionalEdges('judge', (state) => {
        return state.shouldContinueIteration ? 'brain' : END;
    }, {
        brain: 'brain',
        [END]: END,
    });

  const finalGraph = compiledGraph.compile({ 
    checkpointer: lightweightCheckpointer
  });
  graphCache.set(cacheKey, finalGraph);
  return finalGraph;
};
