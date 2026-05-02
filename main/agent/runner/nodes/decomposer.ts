import { GraphStateType, StreamEvent, DecomposedTask, TaskStep } from '../state';
import { AgentRunner } from '../runner';
import { createMissionIntegrator } from '../mission-integrator';
import type { MissionTracker } from '../mission-tracker';
import { AIClient } from '../../../lib/ai-client';

/**
 * AI-powered Task Decomposer Node
 *
 * Uses a specialized sub-agent to break down complex user requests
 * into dependency-aware, parallelizable execution steps.
 */
export const createDecomposerNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  shouldAbort?: () => boolean
) => {
  const integrator = createMissionIntegrator(missionTracker);

  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    // Check for abort signal
    if (shouldAbort?.()) {
      throw new Error('Execution aborted by user (stop button clicked)');
    }

    integrator.startNode('decomposer', 'Intelligently decomposing task into execution steps');

    try {
      const lastUserMsg = state.messages.filter(m => {
        const msg = m as any;
        return msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human';
      }).pop();
      const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
      const isPlanApproval = content.includes('[PLAN_APPROVED]');

      // Check if plan already exists and has progress or is approved to prevent re-decomposition glitches
      if (state.decomposedTask && (isPlanApproval || (state.completedSteps && state.completedSteps.length > 0))) {
          console.log(`[Decomposer] Skipping decomposition: existing plan found. Approval: ${isPlanApproval}, Completed: ${state.completedSteps?.length || 0}`);
          return { taskPhase: 'planning' as const };
      }

      runner.telemetry.transition('decomposer');
      eventQueue?.push({ type: 'thought', content: '🧠 Decomposer: Analyzing task structure using AI classification...' });

      const startTime = Date.now();

      // Use AI-powered decomposition when a client is available, regex fallback otherwise
      const { decomposeTaskWithAI } = await import('../task-decomposer');
      const toolDefs = (runner as any)._buildToolDefinitions?.() || [];
      const toolNames = toolDefs.map((t: any) => t.name);
      const decomposed = await decomposeTaskWithAI(content, toolNames || [], runner.client ?? undefined);

      // Ensure totalSteps and unique ID are set
      decomposed.totalSteps = decomposed.steps.length;
      decomposed.id = `task_${Date.now()}`;

      const duration = Date.now() - startTime;
      runner.telemetry.info(`[Decomposer] Task split into ${decomposed.totalSteps} steps in ${duration}ms (${decomposed.executionMode}) via AI classification`);

      eventQueue?.push({
        type: 'task_analyzed',
        analysis: {
          complexity: decomposed.totalSteps > 5 ? 'complex' : 'simple',
          canParallelize: decomposed.canParallelize,
          suggestedApproach: decomposed.executionMode
        }
      });

      // Emit plan created event for UI
      eventQueue?.push({
        type: 'plan_created',
        plan: {
          id: decomposed.id,
          title: decomposed.title,
          steps: decomposed.steps.map(s => ({
            id: s.id,
            description: s.description,
            tool: s.tool
          }))
        }
      });

      const result = {
        decomposedTask: decomposed,
        taskPhase: 'planning' as const,
      };

      integrator.completeNode('decomposer', `Decomposed into ${decomposed.totalSteps} steps (Fast Heuristic)`);
      return result;
    } catch (error) {
      runner.telemetry.warn(`[Decomposer] Fast decomposition failed: ${error instanceof Error ? error.message : String(error)}`);
      integrator.completeNode('decomposer', 'Decomposition failed');
      throw error;
    }
  };
};
