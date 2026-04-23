import { StateGraph, END, START, interrupt } from '@langchain/langgraph';
import { GraphState, GraphStateType, StreamEvent } from './state';
import { createTriageNode } from './nodes/triage';
import { createPlannerNode } from './nodes/planner';
import { createExecuteToolsNode } from './nodes/execute_tools';
import { createValidationNode } from './nodes/validation';
import { createBrainNode } from './nodes/brain';
import { createJudgeNode } from './nodes/judge';
import { createDecomposerNode } from './nodes/decomposer';
import {
  createComputerUseNode,
  createCodingSpecialistNode,
  createDataAnalystNode,
  createWebExplorerNode
} from './nodes/specialized_agents';
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
  // Create a hash of tool names to include in cache key
  // This prevents reusing a cached graph when tool availability changes
  const toolNames = toolDefs.map(t => t.name).sort().join(',');
  const toolNamesHash = require('crypto').createHash('md5').update(toolNames).digest('hex').substring(0, 8);
  const cacheKey = `graph_v7_specialized_${toolDefs.length}_${toolNamesHash}`;

  if (graphCache.has(cacheKey)) {
    console.log(`[Graph] 📦 Using CACHED execution graph (key: ${cacheKey})`);
    console.log(`[Graph] Available tools: ${toolDefs.map(t => t.name).join(', ')}`);
    return graphCache.get(cacheKey);
  }

  console.log(`[Graph] 🏗️  BUILDING NEW AGENT EXECUTION GRAPH (v4 Specialized)`);
  console.log(`[Graph] Cache key: ${cacheKey}`);
  console.log(`[Graph] Available tools: ${toolDefs.map(t => t.name).join(', ')}`);

  // Warn if computer_use is missing
  if (!toolDefs.find(t => t.name === 'computer_use')) {
    console.warn(`[Graph] ⚠️ WARNING: computer_use tool is missing from tool definitions!`);
  }

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

      // Use interrupt() to pause the graph and wait for user response.
      // When the user approves/rejects, the runner resumes with Command({ resume: answer }).
      let answer: any;
      try {
        answer = interrupt(approvalRequest);
      } catch (interruptErr: any) {
        // If interrupt throws (e.g. checkpointer doesn't support it), route to END
        // to prevent infinite recursion. The user's next message will restart the flow.
        runner.telemetry.info('HITL interrupt() threw — ending graph turn to prevent recursion');
        return {
          taskPhase: 'planning' as const,
          hitlApprovalResult: {
            approved: null as any, // null → routes to END
            response: 'Waiting for user approval',
            reasoning: 'HITL paused — awaiting user response',
          },
          completionSignal: null,
        };
      }

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
      // Route to END to prevent infinite recursion when interrupt fails
      return {
        taskPhase: 'planning' as const,
        hitlApprovalResult: {
          approved: null as any, // null → routes to END in hitl_approval conditional edges
          response: 'HITL interrupted or failed',
          reasoning: `HITL approval failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  };

  // Node wrappers that extract context from config at runtime
  const triageNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createTriageNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const decomposerNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createDecomposerNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const plannerNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createPlannerNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const brainNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }

    // Inject plan context into brain prompt if it exists
    let systemPromptOverride = undefined;
    const plan = state.decomposedTask;
    if (plan) {
        systemPromptOverride = `You are the EverFern Orchestrator.
Your goal is to ensure the following execution plan is completed successfully.

CURRENT EXECUTION PLAN:
Title: ${plan.title}
Steps:
${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}

If a specialized agent failed to complete a step, identify the issue and use your tools to proceed.`;
    }

    const node = createBrainNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs, ctx.shouldAbort, systemPromptOverride);
    return node(state);
  };

  const computerUseNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createComputerUseNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs);
    return node(state);
  };

  const codingNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createCodingSpecialistNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs);
    return node(state);
  };

  const dataAnalystNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createDataAnalystNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs);
    return node(state);
  };

  const webExplorerNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createWebExplorerNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs);
    return node(state);
  };

  const validatorNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createValidationNode(ctx.runner, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const orchestratorNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createExecuteToolsNode(ctx.runner, tools, (ctx.runner as any).config, ctx.eventQueue, ctx.conversationId, ctx.missionTracker, ctx.shouldAbort, (ctx.runner as any).client);
    return node(state);
  };

  const judgeNode = async (state: GraphStateType, config?: any) => {
    const ctx = getContext(config);
    // Guard: Check abort before node execution
    if (ctx.shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }
    const node = createJudgeNode(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
    return node(state);
  };

  const compiledGraph = new StateGraph(GraphState)
    .addNode('intent_classifier', triageNode)
    .addNode('task_decomposer', decomposerNode)
    .addNode('global_planner', plannerNode)
    .addNode('brain', brainNode)
    .addNode('computer_use_agent', computerUseNode)
    .addNode('coding_specialist', codingNode)
    .addNode('data_analyst', dataAnalystNode)
    .addNode('web_explorer', webExplorerNode)
    .addNode('action_validation', validatorNode)
    .addNode('hitl_approval', hitlNode)
    .addNode('multi_tool_orchestrator', orchestratorNode)
    .addNode('judge', judgeNode);

  // New Brain-Centric Routing Architecture
  compiledGraph
    .addEdge(START, 'intent_classifier')
    .addEdge('intent_classifier', 'task_decomposer')
    .addEdge('task_decomposer', 'global_planner')
    .addEdge('global_planner', 'brain')

    // Brain is the central router - it decides whether to handle tasks itself or route to specialists
    .addConditionalEdges('brain', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        const routingDecision = state.routingDecision;

        // If brain has tools to execute, validate them first
        if (hasTools) {
            console.log('[Graph] 🔀 Brain has tools → action_validation');
            return 'action_validation';
        }

        // If brain made a routing decision to specialized agents
        if (routingDecision) {
            console.log(`[Graph] 🔀 Brain routing decision: ${routingDecision.decision}`);

            switch (routingDecision.decision) {
                case 'route_coding':
                    return 'coding_specialist';
                case 'route_data_analyst':
                    return 'data_analyst';
                case 'route_computer_use':
                    return 'computer_use_agent';
                case 'route_web_explorer':
                    return 'web_explorer';
                case 'complete_task':
                case 'continue_brain':
                default:
                    return 'judge';
            }
        }

        // Default to judge for completion assessment
        return 'judge';
    }, {
        action_validation: 'action_validation',
        coding_specialist: 'coding_specialist',
        data_analyst: 'data_analyst',
        computer_use_agent: 'computer_use_agent',
        web_explorer: 'web_explorer',
        judge: 'judge',
    })

    // All specialized agents route back to brain for coordination
    .addConditionalEdges('coding_specialist', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;

        if (hasTools) {
            console.log('[Graph] 🔀 Coding specialist has tools → action_validation');
            return 'action_validation';
        }

        console.log('[Graph] 🔀 Coding specialist complete → brain');
        return 'brain';
    }, {
        action_validation: 'action_validation',
        brain: 'brain',
    })

    .addConditionalEdges('data_analyst', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;

        if (hasTools) {
            console.log('[Graph] 🔀 Data analyst has tools → action_validation');
            return 'action_validation';
        }

        console.log('[Graph] 🔀 Data analyst complete → brain');
        return 'brain';
    }, {
        action_validation: 'action_validation',
        brain: 'brain',
    })

    .addConditionalEdges('computer_use_agent', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;

        if (hasTools) {
            console.log('[Graph] 🔀 Computer use agent has tools → action_validation');
            return 'action_validation';
        }

        console.log('[Graph] 🔀 Computer use agent complete → brain');
        return 'brain';
    }, {
        action_validation: 'action_validation',
        brain: 'brain',
    })

    .addConditionalEdges('web_explorer', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;

        if (hasTools) {
            console.log('[Graph] 🔀 Web explorer has tools → action_validation');
            return 'action_validation';
        }

        console.log('[Graph] 🔀 Web explorer complete → brain');
        return 'brain';
    }, {
        action_validation: 'action_validation',
        brain: 'brain',
    })

    // Tool validation and execution flow
    .addConditionalEdges('action_validation', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        if (hasTools) {
          // Bypass HITL if the user has already explicitly approved the execution plan
          const isPlanApproved = state.messages.some((m: any) => {
            const role = m.role || m._getType?.() || m.type;
            const content = typeof m.content === 'string' ? m.content : '';
            return (role === 'user' || role === 'human') && content.includes('[PLAN_APPROVED]');
          });

          if (isPlanApproved) {
              return 'multi_tool_orchestrator';
          }

          // Bypass HITL for safe internal bookkeeping tools — these never need user approval
          const SAFE_TOOLS = new Set([
            'update_plan_step', 'create_plan', 'todo_write',
            'memory_save', 'memory_search', 'read_file', 'view_file',
            'list_directory', 'execution_plan',
          ]);
          const allSafe = (state.pendingToolCalls || []).every((tc: any) => SAFE_TOOLS.has(tc.name));
          if (allSafe) {
            return 'multi_tool_orchestrator';
          }

          return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
        }
        return 'brain';
    }, {
        hitl_approval: 'hitl_approval',
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        brain: 'brain',
    })

    .addConditionalEdges('hitl_approval', (state) => {
        const approved = state.hitlApprovalResult?.approved;
        if (approved === true) {
          return 'multi_tool_orchestrator';
        } else if (approved === false) {
          return 'brain';
        } else {
          return END;
        }
    }, {
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        brain: 'brain',
        [END]: END
    })

    // After tool execution, always return to brain for coordination
    .addEdge('multi_tool_orchestrator', 'brain')

    // Judge makes final completion decision
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
