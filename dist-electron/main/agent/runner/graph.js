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
const call_model_1 = require("./nodes/call_model");
const execute_tools_1 = require("./nodes/execute_tools");
const utils_1 = require("./utils");
const crypto = __importStar(require("crypto"));
const buildGraph = (runner, toolDefs, tools, eventQueue, conversationId, detectedSkills, needsVision = false) => {
    const config = runner.config;
    const should_continue = (state) => {
        if (state.pauseGeneration) {
            runner.telemetry.warn('Session paused by internal request.');
            return langgraph_1.END;
        }
        if (state.needsHumanApproval) {
            runner.telemetry.warn('Human interaction required for state transition.');
            return langgraph_1.END;
        }
        if (state.iterations >= config.maxIterations) {
            runner.telemetry.warn(`Resource Limit: Reached iteration threshold (${config.maxIterations}). Terminating session.`);
            return langgraph_1.END;
        }
        let hasWrittenFile = false;
        let hasRunCommand = false;
        for (const rec of state.toolCallRecords ?? []) {
            if (rec.toolName === 'write' || rec.toolName === 'edit')
                hasWrittenFile = true;
            if (rec.toolName === 'run_command' || rec.toolName === 'bash')
                hasRunCommand = true;
        }
        if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
            runner.telemetry.info('Transition logic: Diverting to EXECUTE_TOOLS for pending operations.');
            return 'execute_tools';
        }
        const currentIntent = state.currentIntent || 'unknown';
        const isActionableIntent = ['coding', 'task'].includes(currentIntent);
        const skillsWereDetected = (detectedSkills ?? []).length > 0;
        const noRealWork = !hasWrittenFile && !hasRunCommand;
        if (isActionableIntent && skillsWereDetected && noRealWork && runner.completionGateRetries < 4) {
            runner.telemetry.warn('Verification Gate: Objective incomplete. Re-routing for logic refinement.');
            runner.completionGateRetries++;
            const contextualMessage = (0, utils_1.generateContextualCompletionMessage)(currentIntent);
            state.messages.push({ role: 'system', content: contextualMessage });
            state.pendingToolCalls = [{
                    id: 'call_completion_gate_' + crypto.randomUUID().substring(0, 8),
                    name: 'system_verify_intent',
                    arguments: { _context: { intent: currentIntent, phase: 'evaluating' } }
                }];
            return 'execute_tools';
        }
        const lastRec = state.toolCallRecords?.[state.toolCallRecords.length - 1];
        const taskJustFailed = lastRec && (!lastRec.result?.success || lastRec.result?.error);
        if (taskJustFailed && runner.completionGateRetries < 4) {
            runner.telemetry.warn(`Persistence Engine: Operation [${lastRec?.toolName}] failed. Triggering recovery protocol.`);
            runner.completionGateRetries++;
            state.messages.push({
                role: 'system',
                content: `SYSTEM PERSISTENCE: The previous tool call [${lastRec?.toolName}] failed. Fix your approach and retry.\nError: ${lastRec?.result?.error}\nSuggestions:\n${(0, utils_1.getContextualSuggestions)(currentIntent, lastRec?.toolName || '')}`
            });
            state.pendingToolCalls = [{
                    id: 'persistence_retry_' + crypto.randomUUID().substring(0, 8),
                    name: 'system_verify_intent',
                    arguments: { _context: { intent: currentIntent, phase: 'executing' } }
                }];
            return 'execute_tools';
        }
        if ((0, utils_1.isReadOnlyTask)(currentIntent)) {
            runner.telemetry.info('Mission objective satisfied. Read-only intent finalized.');
            return langgraph_1.END;
        }
        if (isActionableIntent && (hasWrittenFile || hasRunCommand)) {
            runner.telemetry.info('Mission objective satisfied. Executable workload completed.');
            return langgraph_1.END;
        }
        return langgraph_1.END;
    };
    const triageNode = (0, triage_1.createTriageNode)(runner, eventQueue);
    const plannerNode = (0, planner_1.createPlannerNode)(runner, eventQueue);
    const callModelNode = (0, call_model_1.createCallModelNode)(runner, toolDefs, eventQueue, config.maxIterations);
    const executeToolsNode = (0, execute_tools_1.createExecuteToolsNode)(runner, tools, config, eventQueue, conversationId);
    return new langgraph_1.StateGraph(state_1.GraphState)
        .addNode('triage', triageNode)
        .addNode('planner', plannerNode)
        .addNode('call_model', callModelNode)
        .addNode('execute_tools', executeToolsNode)
        .addEdge(langgraph_1.START, 'triage')
        .addEdge('triage', 'planner')
        .addEdge('planner', 'call_model')
        .addConditionalEdges('call_model', should_continue, {
        execute_tools: 'execute_tools',
        [langgraph_1.END]: langgraph_1.END,
    })
        .addEdge('execute_tools', 'call_model')
        .compile();
};
exports.buildGraph = buildGraph;
