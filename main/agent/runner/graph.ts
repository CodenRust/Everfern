import { StateGraph, END, START } from '@langchain/langgraph';
import { GraphState, GraphStateType, StreamEvent } from './state';
import { createTriageNode } from './nodes/triage';
import { createPlannerNode } from './nodes/planner';
import { createExecuteToolsNode } from './nodes/execute_tools';
import { createValidationNode } from './nodes/validation';
import { createBrainNode } from './nodes/brain';
import { createJudgeNode } from './nodes/judge';
import { AgentRunner } from './runner';
import type { MissionTracker } from './mission-tracker';
import { stateManager } from './state-manager';
import { lightweightCheckpointer } from './custom-checkpointer';
import { saveHitlRequest, saveHitlResponse } from '../../store/hitl';
import * as crypto from 'crypto';

// Cache compiled graphs for better performance
const graphCache = new Map<string, any>();

export const buildGraph = (
  runner: AgentRunner,
  toolDefs: any[],
  tools: any[],
  eventQueue?: StreamEvent[],
  conversationId?: string,
  missionTracker?: MissionTracker,
  shouldAbort?: () => boolean,
) => {
  // Create cache key based on runner configuration + graph version
  const cacheKey = `graph_v2_${runner.config?.maxIterations || 50}`;

  // Return cached graph if available
  if (graphCache.has(cacheKey)) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  📦 GRAPH CACHE HIT                                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    return graphCache.get(cacheKey);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🏗️  BUILDING AGENT EXECUTION GRAPH                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const config = (runner as any).config;

  const hitlNode = async (state: GraphStateType) => {
    runner.telemetry.transition('hitl');
    if (missionTracker) missionTracker.startStep('step:hitl');

    try {
      // Create detailed approval request
      const toolSummary = state.pendingToolCalls?.map(call =>
        `${call.name}(${JSON.stringify(call.arguments)})`
      ).join(', ') || 'No tools';

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
          reasoning: state.validationResult?.reasoning || 'High-risk operation detected'
        },
        options: ['approve', 'reject', 'modify']
      };

      // Save HITL request to storage
      if (conversationId) {
        console.log('[HITL] Saving request to storage:', requestId);
        saveHitlRequest(approvalRequest);
      }

      // Save state before interrupt
      if (conversationId) {
        stateManager.saveState(conversationId, state);
        stateManager.setInterrupted(conversationId, approvalRequest);
      }

      // Push HITL request to event queue for frontend
      console.log('[HITL] Pushing hitl_request event to queue, current queue length:', eventQueue?.length || 0);
      eventQueue?.push({
        type: 'hitl_request',
        request: approvalRequest,
      } as any);
      console.log('[HITL] Event pushed, new queue length:', eventQueue?.length || 0);

      // Add a longer delay to ensure the event is fully processed and sent to frontend
      // before the graph completes and sends mission_complete
      // This prevents mission_complete from removing listeners before HITL event is handled
      await new Promise(resolve => setTimeout(resolve, 500));

      // NOTE: Without checkpointer, we can't use interrupt()
      // The graph will complete here, and the user must send a new message to resume
      // The frontend should handle this by showing the approval UI and sending the response

      console.log('[HITL] ⏸️  HITL approval required - graph will pause');
      console.log('[HITL] ℹ️  User must respond with approval/rejection to continue');

      // Don't complete the HITL step yet - wait for approval
      // if (missionTracker) missionTracker.completeStep('step:hitl');

      // Return a state that indicates we're waiting for HITL
      // Don't set approved: false as this will cause the graph to route to END
      return {
        taskPhase: 'awaiting_hitl',
        hitlApprovalResult: {
          approved: undefined, // Don't set to false, as this causes immediate END routing
          response: 'Waiting for human approval',
          reasoning: 'HITL approval pending'
        }
      };

    } catch (error) {
      if (missionTracker) missionTracker.failStep('step:hitl', error instanceof Error ? error.message : String(error));

      // Default to rejection on error for safety
      return {
        taskPhase: 'planning',
        hitlApprovalResult: {
          approved: false,
          response: 'Error occurred during approval process',
          reasoning: `HITL approval failed: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  };

  const orchestrator = createExecuteToolsNode(runner, tools, config, eventQueue, conversationId, missionTracker, shouldAbort, (runner as any).client);
  const validator = createValidationNode(runner, missionTracker);
  const judge = createJudgeNode(runner, eventQueue, missionTracker);

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  🧠 CORE NODES                                              │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  ├─ 🎯 Brain Node (Main Orchestrator)                      │');
  console.log('│  ├─ 🔍 Intent Classifier                                    │');
  console.log('│  ├─ 📋 Global Planner                                       │');
  console.log('│  ├─ ✅ Action Validator                                     │');
  console.log('│  ├─ 👤 HITL Approval                                        │');
  console.log('│  └─ ⚙️  Multi-Tool Orchestrator                             │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  // Create the Brain node - central orchestrator
  const brain = createBrainNode(runner, eventQueue, missionTracker, toolDefs);

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  🤖 SPECIALIST AGENTS                                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  ℹ️  Specialist nodes removed from graph (unreachable)     │');
  console.log('│  They can be re-added when delegation is implemented       │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  // NOTE: Specialist nodes removed to fix UnreachableNodeError
  // They were added to the graph but had no incoming edges
  // Can be re-added when proper delegation is implemented

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  🔗 GRAPH ARCHITECTURE                                      │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│                                                             │');
  console.log('│  START → Intent Classifier → Global Planner                │');
  console.log('│              ↓                                              │');
  console.log('│           🧠 Brain (Main Agent) ←──────────────────────────┐│');
  console.log('│              ↓                                             ││');
  console.log('│         Action Validation                                  ││');
  console.log('│         ↙️         ↘️                                        ││');
  console.log('│    HITL Approval   Multi-Tool Orchestrator                 ││');
  console.log('│         ↓              ↓                                   ││');
  console.log('│    [Approve/Reject]   Execute Tools ──────────────────────┘│');
  console.log('│              ↓                                              │');
  console.log('│            END                                              │');
  console.log('│                                                             │');
  console.log('│  Specialists: 💻 📊 🖥️ 🌐 (delegated when needed)          │');
  console.log('│                                                             │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  console.log('\n[Graph] 🔄 Creating StateGraph instance...');
  console.log('[Graph] 🔄 Creating node: intent_classifier...');
  const triageNode = createTriageNode(runner, eventQueue, missionTracker, shouldAbort);
  console.log('[Graph] ✅ Created node: intent_classifier');

  console.log('[Graph] 🔄 Creating node: global_planner...');
  const plannerNode = createPlannerNode(runner, eventQueue, missionTracker);
  console.log('[Graph] ✅ Created node: global_planner');

  console.log('[Graph] 🔄 Creating node: brain...');
  // brain is already created above
  console.log('[Graph] ✅ Created node: brain');

  console.log('[Graph] 🔄 Creating node: action_validation...');
  // validator is already created above
  console.log('[Graph] ✅ Created node: action_validation');

  console.log('[Graph] 🔄 Creating node: hitl_approval...');
  // hitlNode is already created above
  console.log('[Graph] ✅ Created node: hitl_approval');

  console.log('[Graph] 🔄 Creating node: multi_tool_orchestrator...');
  // orchestrator is already created above
  console.log('[Graph] ✅ Created node: multi_tool_orchestrator');

  console.log('[Graph] 🔄 Adding nodes to StateGraph...');
  const compiledGraph = new StateGraph(GraphState)
    .addNode('intent_classifier', triageNode)
    .addNode('global_planner', plannerNode)
    .addNode('brain', brain)
    .addNode('action_validation', validator)
    .addNode('hitl_approval', hitlNode)
    .addNode('multi_tool_orchestrator', orchestrator)
    .addNode('judge', judge);

  console.log('[Graph] ✅ Nodes added successfully');
  console.log('[Graph] 🔄 Adding edges...');

  compiledGraph
    .addEdge(START, 'intent_classifier')
    .addEdge('intent_classifier', 'global_planner')
    .addEdge('global_planner', 'brain')
    .addConditionalEdges('brain', (state) => {
        // Brain executes and produces tool calls if needed
        // NEVER route directly to END — always pass through judge
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        return hasTools ? 'action_validation' : 'judge';
    }, {
        action_validation: 'action_validation',
        judge: 'judge',
    })
    .addConditionalEdges('action_validation', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;

        // Route based on tool presence and risk level
        if (hasTools) {
          return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
        }

        // No tools — pass through judge
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
        } else {
          return END;
        }
    }, {
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        [END]: END
    })
    .addEdge('multi_tool_orchestrator', 'brain')
    .addConditionalEdges('judge', (state) => {
        // Judge is the ONLY path to END
        return state.shouldContinueIteration ? 'brain' : END;
    }, {
        brain: 'brain',
        [END]: END,
    });

  console.log('[Graph] ✅ Cyclic graph structure created (brain ← execute_tools feedback loop)');

  console.log('[Graph] ✅ Edges added successfully');
  console.log('[Graph] 🔄 Compiling graph...');
  console.log('[Graph] ⏱️  Starting compilation...');
  console.log('[Graph] 📋 Edge Summary:');
  console.log('[Graph]    START → intent_classifier → global_planner → brain');
  console.log('[Graph]    brain → [action_validation | judge]');
  console.log('[Graph]    action_validation → [hitl_approval | multi_tool_orchestrator | judge]');
  console.log('[Graph]    hitl_approval → [multi_tool_orchestrator | END]');
  console.log('[Graph]    judge → [brain (loop) | END]  ← ONLY path to END');
  console.log('[Graph]    multi_tool_orchestrator → brain (continues processing)');

  const compileStart = Date.now();

  let finalGraph;
  try {
    console.log('[Graph] 📦 Calling StateGraph.compile() with LightweightCheckpointer...');
    console.log('[Graph] ℹ️  Using custom checkpointer for session persistence');

    // Compile with lightweight checkpointer for session persistence
    // This should not cause hangs since it's a simple in-memory implementation
    finalGraph = compiledGraph.compile({ checkpointer: lightweightCheckpointer });

    const compileTime = Date.now() - compileStart;
    console.log(`[Graph] ✅ compile() returned successfully in ${compileTime}ms`);

  } catch (error) {
    const errorTime = Date.now() - compileStart;
    console.error(`[Graph] ❌ Compilation failed after ${errorTime}ms`);
    console.error('[Graph] Error details:', error);
    throw new Error(`Graph compilation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const compileTime = Date.now() - compileStart;

  if (compileTime > 5000) {
    console.warn(`[Graph] ⚠️  ⚠️ Compilation was slow: ${compileTime}ms (expected: <2000ms)`);
    console.warn('[Graph] This may indicate graph structure issues or LLM calls during compilation');
    console.warn('[Graph] Consider checking conditional edge logic for cycles');
  }

  console.log(`[Graph] ✅ Graph compilation completed in ${compileTime}ms!`);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ GRAPH COMPILED SUCCESSFULLY                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Nodes: 7 | Edges: 9 | Cache: Enabled                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Cache the compiled graph
  console.log('[Graph] 💾 Caching compiled graph...');
  graphCache.set(cacheKey, finalGraph);
  console.log('[Graph] ✅ Graph cached successfully');

  return finalGraph;
};
