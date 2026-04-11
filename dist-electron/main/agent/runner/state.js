"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphState = void 0;
const langgraph_1 = require("@langchain/langgraph");
exports.GraphState = langgraph_1.Annotation.Root({
    ...langgraph_1.MessagesAnnotation.spec,
    currentIntent: (0, langgraph_1.Annotation)(),
    intentConfidence: (0, langgraph_1.Annotation)(),
    decomposedTask: (0, langgraph_1.Annotation)(),
    agiHints: (0, langgraph_1.Annotation)(),
    taskPhase: (0, langgraph_1.Annotation)(),
    pendingToolCalls: (0, langgraph_1.Annotation)(),
    toolCallRecords: (0, langgraph_1.Annotation)(),
    toolCallHistory: (0, langgraph_1.Annotation)(), // Compatibility
    userConfirmation: (0, langgraph_1.Annotation)(), // Compatibility
    finalResponse: (0, langgraph_1.Annotation)(), // Compatibility
    pauseGeneration: (0, langgraph_1.Annotation)(),
    iterations: (0, langgraph_1.Annotation)(),
    // Multi-Agent State
    activeAgent: (0, langgraph_1.Annotation)(),
    validationResult: (0, langgraph_1.Annotation)(),
});
