"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationNode = void 0;
const createValidationNode = (runner) => {
    return async (state) => {
        runner.telemetry.transition('validation');
        // Simple heuristic: Any command execution or file writing is high risk.
        const isHighRisk = (state.pendingToolCalls || []).some(call => ['run_command', 'bash', 'write', 'edit', 'delete'].includes(call.name));
        return {
            taskPhase: 'validation',
            validationResult: {
                isHighRisk,
                reasoning: isHighRisk ? 'Dangerous tool detected' : 'Safe operation'
            }
        };
    };
};
exports.createValidationNode = createValidationNode;
