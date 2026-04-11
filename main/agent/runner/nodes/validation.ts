import { GraphStateType } from '../state';
import { AgentRunner } from '../runner';

export const createValidationNode = (runner: AgentRunner) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    runner.telemetry.transition('validation');
    
    // Simple heuristic: Any command execution or file writing is high risk.
    const isHighRisk = (state.pendingToolCalls || []).some(call => 
      ['run_command', 'bash', 'write', 'edit', 'delete'].includes(call.name)
    );

    return {
      taskPhase: 'validation',
      validationResult: {
        isHighRisk,
        reasoning: isHighRisk ? 'Dangerous tool detected' : 'Safe operation'
      }
    };
  };
};
