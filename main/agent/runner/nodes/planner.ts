import { GraphStateType, StreamEvent } from '../state';
import { generatePlanText } from '../task-decomposer';
import { AgentRunner } from '../runner';
import { interrupt } from '@langchain/langgraph';
import { nodeLifecycle, handleApproval } from '../services/node-utils';
import { SystemMessage } from '@langchain/core/messages';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';
import type { AIClient } from '../../../lib/ai-client';

/**
 * AI-based read-only intent detection
 * Replaces keyword-based intent checking with semantic analysis
 */
async function isReadOnlyIntent(intent: string, client?: AIClient): Promise<boolean> {
  if (!client) {
    // Fallback: conservative heuristic
    return intent === 'conversation' || intent === 'question';
  }

  try {
    const prompt = `Determine if this intent represents a read-only operation (no system modifications, file changes, or destructive actions).

Intent: "${intent}"

Read-only intents typically include:
- Conversations and greetings
- Questions requiring factual answers
- Information retrieval
- Documentation lookup

Non-read-only intents include:
- Coding (writing/modifying code)
- Building projects
- Fixing bugs (requires code changes)
- Task execution (file operations, commands)
- Automation setup

Respond with JSON:
{
  "isReadOnly": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    const response = await client.chat({
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
      temperature: 0.1,
      maxTokens: 150
    });

    let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const analysis = JSON.parse(content);

    return analysis.isReadOnly && analysis.confidence > 0.7;
  } catch (err) {
    console.warn('[Planner] AI read-only detection failed:', err);
    // Fallback
    return intent === 'conversation' || intent === 'question';
  }
}

export const createPlannerNode = (runner: AgentRunner, eventQueue?: StreamEvent[], missionTracker?: MissionTracker) => {
  const integrator = createMissionIntegrator(missionTracker);
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    integrator.startNode('planner', 'Compiling execution pipeline');
    try {
      const logger = nodeLifecycle(runner, 'planner');
      logger.info('Compiling execution pipeline and integrating context hints...');
      
      if (!state.decomposedTask) {
        logger.warn('Execution plan missing. Proceeding with direct model-driven logic.');
        integrator.completeNode('planner', 'No task decomposition needed');
        return { taskPhase: 'executing' };
      }

      // Use AI to determine if task is read-only
      const isReadOnly = await isReadOnlyIntent(state.currentIntent || 'unknown', runner.client);

      if (isReadOnly) {
        logger.info('Read-only task detected. Skipping execution pipeline compilation.');
        integrator.completeNode('planner', 'Read-only task identified');
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

      const result = {
        taskPhase: 'executing' as const,
        messages: [
          new SystemMessage(systemMessage)
        ]
      };
      integrator.completeNode('planner', 'Execution pipeline compiled');
      return result;
    } catch (error) {
      integrator.failNode('planner', error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
};
