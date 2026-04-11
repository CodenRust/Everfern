import { GraphStateType, StreamEvent } from '../state';
import { generatePlanText } from '../task-decomposer';
import { AgentRunner } from '../runner';
import { interrupt } from '@langchain/langgraph';
import { nodeLifecycle, handleApproval } from '../services/node-utils';
import { SystemMessage } from '@langchain/core/messages';

export const createPlannerNode = (runner: AgentRunner, eventQueue?: StreamEvent[]) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const logger = nodeLifecycle(runner, 'planner');
    logger.info('Compiling execution pipeline and integrating context hints...');
    
    if (!state.decomposedTask) {
      logger.warn('Execution plan missing. Proceeding with direct model-driven logic.');
      return { taskPhase: 'executing' };
    }

    const isReadOnly = ['conversation', 'question'].includes(state.currentIntent || '');

    if (isReadOnly) {
      logger.info('Read-only task detected. Skipping execution pipeline compilation.');
      return { 
        taskPhase: 'executing',
        messages: [new SystemMessage("Proceed with responding to the user's request directly.")]
      };
    }

    const planText = generatePlanText(state.decomposedTask);
    let agiHints = state.agiHints || '';

    eventQueue?.push({ 
      type: 'plan_created', 
      plan: { 
        id: state.decomposedTask.id, 
        title: state.decomposedTask.title, 
        steps: state.decomposedTask.steps.map((s: any) => ({
          id: s.id,
          description: s.description,
          tool: s.tool
        }))
      } 
    });

    eventQueue?.push({ type: 'thought', content: `Compiling execution pipeline for: ${state.decomposedTask.title}` });

    const systemMessage = `AS AN AGI ORCHESTRATOR, follow this task decomposition plan strictly:\n\n${planText}\n\n${agiHints}\nIMPORTANT: Execute parallel groups using your execution tools concurrently if applicable. Don't ask for permission to proceed with the plan, just execute it step by step.`;

    logger.info(`Execution pipeline finalized. System ready for task processing.`);

    return {
      taskPhase: 'executing',
      messages: [
        new SystemMessage(systemMessage)
      ]
    };
  };
};
