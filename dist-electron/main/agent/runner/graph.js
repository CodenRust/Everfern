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
const state_manager_1 = require("./state-manager");
const custom_checkpointer_1 = require("./custom-checkpointer");
const hitl_1 = require("../../store/hitl");
const crypto = __importStar(require("crypto"));
// Cache compiled graphs for better performance
const graphCache = new Map();
const buildGraph = (runner, toolDefs, tools, eventQueue, conversationId, missionTracker, shouldAbort) => {
    // Create cache key based on runner configuration
    const cacheKey = `graph_${runner.config?.maxIterations || 50}`;
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
            // Create detailed approval request
            const toolSummary = state.pendingToolCalls?.map(call => `${call.name}(${JSON.stringify(call.arguments)})`).join(', ') || 'No tools';
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
                (0, hitl_1.saveHitlRequest)(approvalRequest);
            }
            // Save state before interrupt
            if (conversationId) {
                state_manager_1.stateManager.saveState(conversationId, state);
                state_manager_1.stateManager.setInterrupted(conversationId, approvalRequest);
            }
            // Push HITL request to event queue for frontend
            console.log('[HITL] Pushing hitl_request event to queue, current queue length:', eventQueue?.length || 0);
            eventQueue?.push({
                type: 'hitl_request',
                request: approvalRequest,
            });
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
        }
        catch (error) {
            if (missionTracker)
                missionTracker.failStep('step:hitl', error instanceof Error ? error.message : String(error));
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
    const orchestrator = (0, execute_tools_1.createExecuteToolsNode)(runner, tools, config, eventQueue, conversationId, missionTracker, shouldAbort, runner.client);
    const validator = (0, validation_1.createValidationNode)(runner, missionTracker);
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
        .addNode('multi_tool_orchestrator', orchestrator);
    console.log('[Graph] ✅ Nodes added successfully');
    console.log('[Graph] 🔄 Adding edges...');
    compiledGraph
        .addEdge(langgraph_1.START, 'intent_classifier')
        .addEdge('intent_classifier', 'global_planner')
        .addEdge('global_planner', 'brain')
        .addConditionalEdges('brain', (state) => {
        // Brain executes and produces tool calls if needed
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        return hasTools ? 'action_validation' : langgraph_1.END;
    }, {
        action_validation: 'action_validation',
        [langgraph_1.END]: langgraph_1.END
    })
        .addConditionalEdges('action_validation', (state) => {
        const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
        // Route based on tool presence and risk level
        if (hasTools) {
            return state.validationResult?.isHighRisk ? 'hitl_approval' : 'multi_tool_orchestrator';
        }
        // No tools - task complete
        return langgraph_1.END;
    }, {
        hitl_approval: 'hitl_approval',
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        [langgraph_1.END]: langgraph_1.END
    })
        .addConditionalEdges('hitl_approval', (state) => {
        // Route based solely on approval decision
        // If approved is undefined, we're still waiting for HITL - route to END to pause
        // If approved is true, continue to execution
        // If approved is false, end the mission
        const approved = state.hitlApprovalResult?.approved;
        if (approved === true) {
            return 'multi_tool_orchestrator';
        }
        else {
            // For both false and undefined, route to END
            // The difference is that undefined means "waiting for approval"
            // while false means "approval denied"
            return langgraph_1.END;
        }
    }, {
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        [langgraph_1.END]: langgraph_1.END
    })
        .addEdge('multi_tool_orchestrator', 'brain');
    console.log('[Graph] ✅ Cyclic graph structure created (brain ← execute_tools feedback loop)');
    console.log('[Graph] ✅ Edges added successfully');
    console.log('[Graph] 🔄 Compiling graph...');
    console.log('[Graph] ⏱️  Starting compilation...');
    console.log('[Graph] 📋 Edge Summary:');
    console.log('[Graph]    START → intent_classifier → global_planner → brain');
    console.log('[Graph]    brain → [action_validation | END]');
    console.log('[Graph]    action_validation → [hitl_approval | multi_tool_orchestrator | END]');
    console.log('[Graph]    hitl_approval → [multi_tool_orchestrator | END]');
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
    console.log('║  Nodes: 6 | Edges: 8 | Cache: Enabled                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    // Cache the compiled graph
    console.log('[Graph] 💾 Caching compiled graph...');
    graphCache.set(cacheKey, finalGraph);
    console.log('[Graph] ✅ Graph cached successfully');
    return finalGraph;
};
exports.buildGraph = buildGraph;
