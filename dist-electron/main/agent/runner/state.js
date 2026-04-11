"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphState = void 0;
const langgraph_1 = require("@langchain/langgraph");
// ── LangGraph State Schema (6-Node Architecture) ─────────────────────
exports.GraphState = langgraph_1.Annotation.Root({
    messages: (0, langgraph_1.Annotation)({
        reducer: (existing, incoming) => [...existing, ...incoming],
        default: () => [],
    }),
    toolCallRecords: (0, langgraph_1.Annotation)({
        reducer: (existing, incoming) => [...existing, ...incoming],
        default: () => [],
    }),
    iterations: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => 0,
    }),
    pendingToolCalls: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => [],
    }),
    finalResponse: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => '',
    }),
    userConfirmation: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => undefined,
    }),
    pauseGeneration: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => false,
    }),
    toolCallHistory: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => [],
    }),
    // ── NEW: 6-Node Architecture Fields ───────────────────────────────
    currentIntent: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => 'unknown',
    }),
    intentConfidence: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => 0,
    }),
    taskPhase: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => 'receiving',
    }),
    executionPlan: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => null,
    }),
    context: (0, langgraph_1.Annotation)({
        reducer: (existing, incoming) => ({ ...existing, ...incoming }),
        default: () => ({
            completedSteps: [],
            pendingSteps: [],
            filesModified: [],
            commandsRun: [],
            errors: []
        }),
    }),
    shortTermMemory: (0, langgraph_1.Annotation)({
        reducer: (existing, incoming) => {
            const combined = [...existing, ...incoming];
            return combined.slice(-10);
        },
        default: () => [],
    }),
    lastToolResult: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => null,
    }),
    needsHumanApproval: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => false,
    }),
    pendingApproval: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => null,
    }),
    responseMetadata: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => ({ ..._existing, ...incoming }),
        default: () => ({
            intent: 'unknown',
            confidence: 0,
            toolsUsed: [],
            filesModified: [],
            iterations: 0
        }),
    }),
    // ── AGI-Specific Fields ─────────────────────────────────────────────
    // Tracks spawned sub-agents for coordination
    activeAgents: (0, langgraph_1.Annotation)({
        reducer: (existing, incoming) => [...existing, ...incoming].filter((v, i, a) => a.indexOf(v) === i),
        default: () => [],
    }),
    // Tracks parallel execution groups
    parallelGroups: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => 0,
    }),
    // Task decomposition state
    decomposedTask: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => null,
    }),
    // AGI hints for system prompt
    agiHints: (0, langgraph_1.Annotation)({
        reducer: (_existing, incoming) => incoming,
        default: () => '',
    }),
});
