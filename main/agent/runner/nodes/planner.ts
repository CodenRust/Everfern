import { GraphStateType, StreamEvent } from '../state';
import { generatePlanText } from '../task-decomposer';
import { AgentRunner } from '../runner';
import { interrupt } from '@langchain/langgraph';

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

    // Human-in-the-loop: Pause and wait for plan approval
    const feedback = interrupt({
        question: "Please review and approve the execution plan.",
        plan: state.decomposedTask
    });

    runner.telemetry.info(`Plan review feedback received: ${typeof feedback === 'string' ? feedback.substring(0, 50) : '...'}...`);

    if (typeof feedback === 'string' && feedback.toLowerCase().includes('reject')) {
        runner.telemetry.warn('Plan rejected by human.');
        return {
            taskPhase: 'evaluating',
            messages: [{ role: 'system', content: `The user rejected the plan with feedback: ${feedback}` }]
        };
    }

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
