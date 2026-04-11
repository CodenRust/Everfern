import { GraphStateType } from '../state';
import { AgentRunner } from '../runner';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';

const MAX_ITERATIONS = 50;

/**
 * Evaluates whether the task objective has been achieved and the mission should complete.
 * 
 * This function implements completion validation heuristics to prevent premature task completion.
 * It checks multiple signals to determine if the agent should continue iterating or finalize.
 * 
 * @param state - Current graph state
 * @returns true if task should complete (route to END), false if should continue iterating
 */
function shouldCompleteTask(state: GraphStateType): boolean {
  // 1. Force completion at max iterations to prevent infinite loops
  if (state.iterations >= MAX_ITERATIONS) {
    return true;
  }

  // 2. Read-only tasks (questions, conversations) can complete without tools
  const isReadOnlyIntent = state.currentIntent === 'question' || state.currentIntent === 'conversation';
  if (isReadOnlyIntent) {
    return true;
  }

  // 3. Check if decomposed task exists and all steps are complete
  if (state.decomposedTask) {
    // If we have a task decomposition, check if all steps are marked complete
    // For now, we'll assume incomplete if we're here without tools
    // This is a conservative approach - better to iterate than complete prematurely
    return false;
  }

  // 4. Analyze last assistant message for completion indicators
  const messages = state.messages || [];
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  
  if (lastAssistantMessage && typeof lastAssistantMessage.content === 'string') {
    const content = lastAssistantMessage.content.toLowerCase();
    
    // Check for explicit completion indicators
    const completionIndicators = [
      'task completed',
      'task is complete',
      'finished the task',
      'all done',
      'successfully completed',
      'here is the final result',
      'here is the result'
    ];
    
    const hasCompletionIndicator = completionIndicators.some(indicator => 
      content.includes(indicator)
    );
    
    if (hasCompletionIndicator) {
      return true;
    }
  }

  // 5. Default: continue iterating (conservative approach)
  // Better to iterate unnecessarily than to complete prematurely
  return false;
}

export const createValidationNode = (runner: AgentRunner, missionTracker?: MissionTracker) => {
  const integrator = createMissionIntegrator(missionTracker);
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    integrator.startNode('validation', 'Validating tool calls for safety');
    try {
      runner.telemetry.transition('validation');
      
      // Simple heuristic: Any command execution or file writing is high risk.
      const isHighRisk = (state.pendingToolCalls || []).some(call => 
        ['run_command', 'bash', 'write', 'edit', 'delete'].includes(call.name)
      );

      // Evaluate whether task should complete or continue iterating
      const taskShouldComplete = shouldCompleteTask(state);

      const result = {
        taskPhase: 'validation' as const,
        validationResult: {
          isHighRisk,
          reasoning: isHighRisk ? 'Dangerous tool detected' : 'Safe operation'
        },
        shouldContinueIteration: !taskShouldComplete
      };

      integrator.completeNode('validation', `Validation complete: ${result.validationResult.reasoning}`);
      return result;
    } catch (error) {
      integrator.failNode('validation', error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
};
