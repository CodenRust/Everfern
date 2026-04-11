"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleApproval = exports.nodeLifecycle = void 0;
/**
 * Handles node lifecycle events (telemetry, logging).
 */
const nodeLifecycle = (runner, nodeName) => {
    runner.telemetry.transition(nodeName);
    return {
        info: (msg) => runner.telemetry.info(msg),
        warn: (msg) => runner.telemetry.warn(msg),
        error: (msg) => runner.telemetry.warn(msg), // Fallback to warn if error is missing
    };
};
exports.nodeLifecycle = nodeLifecycle;
/**
 * Common HITL patterns.
 */
const handleApproval = (state, task, interruptFn) => {
    const isReadOnly = ['conversation', 'question'].includes(state.currentIntent || '');
    if (isReadOnly)
        return 'approved';
    return interruptFn({
        question: "Please review and approve the execution plan.",
        plan: task
    });
};
exports.handleApproval = handleApproval;
