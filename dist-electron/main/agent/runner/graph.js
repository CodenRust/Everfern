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
const custom_checkpointer_1 = require("./custom-checkpointer");
const hitl_1 = require("../../store/hitl");
const crypto = __importStar(require("crypto"));
// Cache compiled graphs for better performance
const graphCache = new Map();
/**
 * Helper to extract ExecutionContext from LangGraph config
 */
const getContext = (config) => {
    const ctx = config?.configurable?.executionContext;
    if (!ctx) {
        throw new Error('ExecutionContext missing from graph config. Ensure it is passed in the configurable field.');
    }
    return ctx;
};
const buildGraph = (runner, toolDefs, tools) => {
    // Use a cache key based on tool definitions to allow re-use
    // In a production app, toolDefs are usually static per version
    const cacheKey = `graph_v3_${toolDefs.length}`;
    if (graphCache.has(cacheKey)) {
        console.log('[Graph] 📦 Using CACHED execution graph');
        return graphCache.get(cacheKey);
    }
    console.log('[Graph] 🏗️  BUILDING NEW AGENT EXECUTION GRAPH (v3 Cached)');
    const hitlNode = async (state, config) => {
        const { runner, eventQueue, missionTracker, conversationId, shouldAbort } = getContext(config);
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        runner.telemetry.transition('hitl');
        if (missionTracker)
            missionTracker.startStep('step:hitl');
        try {
            const formatToolCallSummary = (call) => {
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
                (0, hitl_1.saveHitlRequest)(approvalRequest);
            }
            // Emit tool_start for ask_user_question so frontend knows to expect a result
            eventQueue?.push({
                type: 'tool_start',
                toolName: 'ask_user_question',
                toolArgs: { questions: reasoning }
            });
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
            eventQueue?.push({
                type: 'tool_call',
                toolCall: {
                    toolName: 'ask_user_question',
                    args: { questions: hitlResult.data?.questions },
                    result: hitlResult,
                },
            });
            eventQueue?.push({
                type: 'hitl_request',
                request: approvalRequest,
            });
            await new Promise(resolve => setTimeout(resolve, 300));
            runner.telemetry.info('HITL approval required — ending turn, user must respond');
            if (missionTracker)
                missionTracker.completeStep('step:hitl');
            // Pause execution and wait for user response via Command({ resume: ... })
            const answer = (0, langgraph_1.interrupt)(approvalRequest);
            const isApproved = String(answer).includes('[HITL_APPROVED]');
            runner.telemetry.info(`HITL response received: ${isApproved ? 'APPROVED' : 'REJECTED'}`);
            return {
                taskPhase: 'executing',
                hitlApprovalResult: {
                    approved: isApproved,
                    response: isApproved ? 'Approved by user' : 'Rejected by user',
                    reasoning: isApproved ? 'User approved the action' : 'User rejected the action',
                },
                completionSignal: null,
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
    // Node wrappers that extract context from config at runtime
    const triageNode = async (state, config) => {
        const ctx = getContext(config);
        const node = (0, triage_1.createTriageNode)(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
        return node(state);
    };
    const plannerNode = async (state, config) => {
        const ctx = getContext(config);
        const node = (0, planner_1.createPlannerNode)(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
        return node(state);
    };
    const brainNode = async (state, config) => {
        const ctx = getContext(config);
        const node = (0, brain_1.createBrainNode)(ctx.runner, ctx.eventQueue, ctx.missionTracker, toolDefs, ctx.shouldAbort);
        return node(state);
    };
    const validatorNode = async (state, config) => {
        const ctx = getContext(config);
        const node = (0, validation_1.createValidationNode)(ctx.runner, ctx.missionTracker, ctx.shouldAbort);
        return node(state);
    };
    const orchestratorNode = async (state, config) => {
        const ctx = getContext(config);
        const node = (0, execute_tools_1.createExecuteToolsNode)(ctx.runner, tools, ctx.runner.config, ctx.eventQueue, ctx.conversationId, ctx.missionTracker, ctx.shouldAbort, ctx.runner.client);
        return node(state);
    };
    const judgeNode = async (state, config) => {
        const ctx = getContext(config);
        const node = (0, judge_1.createJudgeNode)(ctx.runner, ctx.eventQueue, ctx.missionTracker, ctx.shouldAbort);
        return node(state);
    };
    const compiledGraph = new langgraph_1.StateGraph(state_1.GraphState)
        .addNode('intent_classifier', triageNode)
        .addNode('global_planner', plannerNode)
        .addNode('brain', brainNode)
        .addNode('action_validation', validatorNode)
        .addNode('hitl_approval', hitlNode)
        .addNode('multi_tool_orchestrator', orchestratorNode)
        .addNode('judge', judgeNode);
    compiledGraph
        .addEdge(langgraph_1.START, 'intent_classifier')
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
        }
        else if (approved === false) {
            return 'judge';
        }
        else {
            return langgraph_1.END;
        }
    }, {
        multi_tool_orchestrator: 'multi_tool_orchestrator',
        judge: 'judge',
        [langgraph_1.END]: langgraph_1.END
    })
        .addEdge('multi_tool_orchestrator', 'brain')
        .addConditionalEdges('judge', (state) => {
        return state.shouldContinueIteration ? 'brain' : langgraph_1.END;
    }, {
        brain: 'brain',
        [langgraph_1.END]: langgraph_1.END,
    });
    const finalGraph = compiledGraph.compile({
        checkpointer: custom_checkpointer_1.lightweightCheckpointer
    });
    graphCache.set(cacheKey, finalGraph);
    return finalGraph;
};
exports.buildGraph = buildGraph;
