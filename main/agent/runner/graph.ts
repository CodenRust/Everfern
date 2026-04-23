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

  compiledGraph
    .addEdge(START, 'intent_classifier')
    .addConditionalEdges('intent_classifier', (state) => {
        // Always route through task_decomposer to ensure proper task type evaluation
        // and routing to specialized agents (data_analyst, coding_specialist, etc.)
        const intent = state.currentIntent;

        console.log(`[Graph] 🔀 Routing from intent_classifier: intent=${intent} → task_decomposer`);

        return 'task_decomposer';
    }, {
        task_decomposer: 'task_decomposer',
    })
    .addConditionalEdges('task_decomposer', (state) => {
        const intent = state.currentIntent;

        // Guard: Ensure task decomposition is fully processed
        // If decomposedTask exists, verify it has valid structure
        if (state.decomposedTask) {
            const plan = state.decomposedTask;
            if (!plan.steps || plan.steps.length === 0) {
                console.warn('[Graph] ⚠️ Task decomposition incomplete - no steps defined');
            }
        }

        // Route to specialized agents based on task type
        let destination = 'global_planner';

        if (intent === 'automate') {
            destination = 'computer_use_agent';
        } else if (intent === 'coding') {
            destination = 'coding_specialist';
        } else if (intent === 'analyze') {
            destination = 'data_analyst';
        } else if (intent === 'research') {
            destination = 'web_explorer';
        }

        console.log(`[Graph] 🔀 Routing from task_decomposer: intent=${intent} → ${destination}`);

        return destination;
    }, {
        computer_use_agent: 'computer_use_agent',
        coding_specialist: 'coding_specialist',
        data_analyst: 'data_analyst',
        web_explorer: 'web_explorer',
        global_planner: 'global_planner',
    })
    .addEdge('global_planner', 'brain')
    .addConditionalEdges('computer_use_agent', (state) => {
        // Guard: Validate specialized agent has completed work before routing to judge
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        const hasCompletionSignal = state.completionSignal !== null && state.completionSignal !== undefined;

        // If agent has pending tools, route to validation
        if (hasTools) {
            return 'action_validation';
        }

        // If agent has no tools and no completion signal, it may not have finished its work
        // Route back to itself to continue iteration
        if (!hasCompletionSignal) {
            console.log('[Graph] ⚠️ computer_use_agent has no tools and no completion signal - may need more iterations');
        }

        return 'judge';
    }, {
        action_validation: 'action_validation',
        judge: 'judge',
    })
    .addConditionalEdges('coding_specialist', (state) => {
        // Guard: Validate specialized agent has completed work before routing to judge
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        const hasCompletionSignal = state.completionSignal !== null && state.completionSignal !== undefined;

        // If agent has pending tools, route to validation
        if (hasTools) {
            return 'action_validation';
        }

        // If agent has no tools and no completion signal, it may not have finished its work
        // Route back to itself to continue iteration
        if (!hasCompletionSignal) {
            console.log('[Graph] ⚠️ coding_specialist has no tools and no completion signal - may need more iterations');
        }

        return 'judge';
    }, {
        action_validation: 'action_validation',
        judge: 'judge',
    })
    .addConditionalEdges('data_analyst', (state) => {
        // Guard: Validate specialized agent has completed work before routing to judge
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        const hasCompletionSignal = state.completionSignal !== null && state.completionSignal !== undefined;

        // If agent has pending tools, route to validation
        if (hasTools) {
            return 'action_validation';
        }

        // If agent has no tools and no completion signal, it may not have finished its work
        // Route back to itself to continue iteration
        if (!hasCompletionSignal) {
            console.log('[Graph] ⚠️ data_analyst has no tools and no completion signal - may need more iterations');
        }

        return 'judge';
    }, {
        action_validation: 'action_validation',
        judge: 'judge',
    })
    .addConditionalEdges('web_explorer', (state) => {
        // Guard: Validate specialized agent has completed work before routing to judge
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        const hasCompletionSignal = state.completionSignal !== null && state.completionSignal !== undefined;

        // If agent has pending tools, route to validation
        if (hasTools) {
            return 'action_validation';
        }

        // If agent has no tools and no completion signal, it may not have finished its work
        // Route back to itself to continue iteration
        if (!hasCompletionSignal) {
            console.log('[Graph] ⚠️ web_explorer has no tools and no completion signal - may need more iterations');
        }

        return 'judge';
    }, {
        action_validation: 'action_validation',
        judge: 'judge',
    })
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
    .addConditionalEdges('multi_tool_orchestrator', (state) => {
        // Route back to the originating specialized agent to allow iterative execution
        const intent = state.currentIntent;

        console.log(`[Graph] 🔀 Routing from multi_tool_orchestrator: intent=${intent}`);

        // Route back to the specialized agent that initiated the tool call
        // This allows each agent to iterate until their task is complete
        if (intent === 'automate') return 'computer_use_agent';
        if (intent === 'coding') return 'coding_specialist';
        if (intent === 'analyze') return 'data_analyst';
        if (intent === 'research') return 'web_explorer';

        // Default to brain for general tasks
        return 'brain';
    }, {
        computer_use_agent: 'computer_use_agent',
        coding_specialist: 'coding_specialist',
        data_analyst: 'data_analyst',
        web_explorer: 'web_explorer',
        judge: 'judge',
        brain: 'brain',
    })
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
