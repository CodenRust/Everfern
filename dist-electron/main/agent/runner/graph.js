"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("./state");
const triage_1 = require("./nodes/triage");
const planner_1 = require("./nodes/planner");
const execute_tools_1 = require("./nodes/execute_tools");
const validation_1 = require("./nodes/validation");
const brain_1 = require("./nodes/brain");
const judge_1 = require("./nodes/judge");
const state_manager_1 = require("./state-manager");
const custom_checkpointer_1 = require("./custom-checkpointer");
const hitl_1 = require("../../store/hitl");
const crypto = __importStar(require("crypto"));
// Cache compiled graphs for better performance
const graphCache = new Map();
const buildGraph = (runner, toolDefs, tools, eventQueue, conversationId, missionTracker, shouldAbort) => {
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
    const config = runner.config;
    const hitlNode = async (state) => {
        runner.telemetry.transition('hitl');
        if (missionTracker)
            missionTracker.startStep('step:hitl');
        try {
            const toolSummary = state.pendingToolCalls?.map(call => `**${call.name}** — \`${JSON.stringify(call.arguments).slice(0, 120)}\``).join('\n') || 'No tools pending';
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
                (0, hitl_1.saveHitlRequest)(approvalRequest);
                state_manager_1.stateManager.saveState(conversationId, state);
                state_manager_1.stateManager.setInterrupted(conversationId, approvalRequest);
            }
            // Use ask_user_question to surface the approval UI — same path as regular questions,
            // fully wired up on the frontend with the HitlApprovalForm.
            const { askUserTool } = await Promise.resolve().then(() => __importStar(require('../tools/ask-user')));
            const hitlResult = await askUserTool.execute({
                questions: [
                    {
                        question: `⚠️ High-risk action requires your approval\n\n${reasoning}\n\nActions to execute:\n${toolSummary}`,
                        options: ['✅ Approve — proceed with the action', '❌ Reject — cancel and do not proceed'],
                        multiSelect: false,
                    }
                ]
            }, (msg) => runner.telemetry.info(msg));
            // Push the ask_user result as a tool_call event so the frontend shows the form
            eventQueue?.push({
                type: 'tool_call',
                toolCall: {
                    toolName: 'ask_user_question',
                    args: { questions: hitlResult.data?.questions },
                    result: hitlResult,
                },
            });
            // Also push the legacy hitl_request event for backward compat
            eventQueue?.push({
                type: 'hitl_request',
                request: approvalRequest,
            });
            // Give the frontend time to receive the events before graph ends
            await new Promise(resolve => setTimeout(resolve, 300));
            runner.telemetry.info('HITL approval required — ending turn, user must respond');
            if (missionTracker)
                missionTracker.completeStep('step:hitl');
            // End this turn. The user's approval/rejection comes back as a new message,
            // which runner.ts detects via [HITL_APPROVED] / [HITL_REJECTED] markers.
            return {
                taskPhase: 'awaiting_hitl',
                hitlApprovalResult: {
                    approved: undefined,
                    response: 'Waiting for human approval',
                    reasoning: 'HITL approval pending — user must respond',
                },
                completionSignal: {
                    reason: 'needs_hitl',
                    explanation: reasoning,
                },
            };
        }
        catch (error) {
            if (missionTracker)
                missionTracker.failStep('step:hitl', error instanceof Error ? error.message : String(error));
            return {
                taskPhase: 'planning',
                hitlApprovalResult: {
                    approved: false,
                    response: 'Error occurred during approval process',
                    reasoning: `HITL approval failed: ${error instanceof Error ? error.message : String(error)}`,
                },
            };
        }
    };
    const orchestrator = (0, execute_tools_1.createExecuteToolsNode)(runner, tools, config, eventQueue, conversationId, missionTracker, shouldAbort, runner.client);
    const validator = (0, validation_1.createValidationNode)(runner, missionTracker);
    const judge = (0, judge_1.createJudgeNode)(runner, eventQueue, missionTracker);
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
    const brain = (0, brain_1.createBrainNode)(runner, eventQueue, missionTracker, toolDefs);
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
    const triageNode = (0, triage_1.createTriageNode)(runner, eventQueue, missionTracker, shouldAbort);
    console.log('[Graph] ✅ Created node: intent_classifier');
    console.log('[Graph] 🔄 Creating node: global_planner...');
    const plannerNode = (0, planner_1.createPlannerNode)(runner, eventQueue, missionTracker);
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
    const compiledGraph = new langgraph_1.StateGraph(state_1.GraphState)
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
        .addEdge(langgraph_1.START, 'intent_classifier')
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
        // approved === true  → user approved, execute the tools
        // approved === false → user rejected, go back to planner
        // approved === undefined → waiting for user (turn ends, user responds next)
        if (approved === true) {
            return 'multi_tool_orchestrator';
        }
        else if (approved === false) {
            return 'judge'; // surface rejection message to user via judge
        }
        else {
            return langgraph_1.END; // awaiting_hitl — end turn, user's next message resumes
        }
    }, {
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        judge: 'judge',
        [langgraph_1.END]: langgraph_1.END
    })
        .addEdge('multi_tool_orchestrator', 'brain')
        .addConditionalEdges('judge', (state) => {
        // Judge is the ONLY path to END
        return state.shouldContinueIteration ? 'brain' : langgraph_1.END;
    }, {
        brain: 'brain',
        [langgraph_1.END]: langgraph_1.END,
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
        finalGraph = compiledGraph.compile({ checkpointer: custom_checkpointer_1.lightweightCheckpointer });
        const compileTime = Date.now() - compileStart;
        console.log(`[Graph] ✅ compile() returned successfully in ${compileTime}ms`);
    }
    catch (error) {
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
exports.buildGraph = buildGraph;
