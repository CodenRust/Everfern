import { GraphStateType, StreamEvent } from '../state';
import { generatePlanText } from '../task-decomposer';
import { AgentRunner } from '../runner';

export const createPlannerNode = (runner: AgentRunner, eventQueue?: StreamEvent[]) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    runner.telemetry.transition('planner');
    runner.telemetry.info('Compiling execution pipeline and integrating context hints...');
    
    if (!state.decomposedTask) {
      runner.telemetry.warn('Execution plan missing. Proceeding with direct model-driven logic.');
      return { taskPhase: 'executing' };
    }

    const planText = generatePlanText(state.decomposedTask);
    let agiHints = state.agiHints || '';
    
    eventQueue?.push({ 
      type: 'plan_created', 
      plan: { 
        id: state.decomposedTask.id, 
        title: state.decomposedTask.title, 
        steps: state.decomposedTask.steps.map(s => ({
          id: s.id,
          description: s.description,
          tool: s.tool
        })) as any
      } 
    });

    eventQueue?.push({ type: 'thought', content: `Compiling execution pipeline for: ${state.decomposedTask.title}` });

    const systemMessage = `AS AN AGI ORCHESTRATOR, follow this task decomposition plan strictly:\n\n${planText}\n\n${agiHints}\nIMPORTANT: Execute parallel groups using your execution tools concurrently if applicable. Don't ask for permission to proceed with the plan, just execute it step by step.`;

    runner.telemetry.info(`Execution pipeline finalized. System ready for task processing.`);

    return {
      taskPhase: 'executing',
      messages: [
        {
          role: 'system',
          content: systemMessage
        }
      ]
    };
  };
};
