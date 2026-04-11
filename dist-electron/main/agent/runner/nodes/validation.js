"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationNode = void 0;
const mission_integrator_1 = require("../mission-integrator");
const createValidationNode = (runner, missionTracker) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        integrator.startNode('validation', 'Validating tool calls for safety');
        try {
            runner.telemetry.transition('validation');
            // Simple heuristic: Any command execution or file writing is high risk.
            const isHighRisk = (state.pendingToolCalls || []).some(call => ['run_command', 'bash', 'write', 'edit', 'delete'].includes(call.name));
            const result = {
                taskPhase: 'validation',
                validationResult: {
                    isHighRisk,
                    reasoning: isHighRisk ? 'Dangerous tool detected' : 'Safe operation'
                }
            };
            integrator.completeNode('validation', `Validation complete: ${result.validationResult.reasoning}`);
            return result;
        }
        catch (error) {
            integrator.failNode('validation', error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
};
exports.createValidationNode = createValidationNode;
