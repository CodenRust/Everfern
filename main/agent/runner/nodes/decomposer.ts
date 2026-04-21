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
      runner.telemetry.transition('decomposer');
      eventQueue?.push({ type: 'thought', content: '🧠 Decomposer: Analyzing task structure and dependencies...' });

      const intent = state.currentIntent || 'task';
      const lastUserMsg = state.messages.filter(m => {
        const msg = m as any;
        return msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human';
      }).pop();
      const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';

      // Get available tools for the decomposer
      const toolDefs = (runner as any)._buildToolDefinitions();
      const toolsSummary = toolDefs.map((t: any) => `- ${t.name}: ${t.description}`).join('\n');

      const prompt = `You are the EverFern NEXUS Decomposer. 
Your goal is to break down the user's request into a structured execution plan.

USER REQUEST: "${content}"
INTENT: "${intent}"

AVAILABLE TOOLS:
${toolsSummary}

DECOMPOSITION RULES:
1. If the user mentions opening, launching, or interacting with a specific application (e.g., Spotify, Chrome, Discord, VS Code, Browser, etc), you MUST create EXACTLY ONE step using the "computer_use" tool.
2. For GUI/Automation tasks, the "task" argument to "computer_use" should be the user's original request.
3. For coding tasks, use: analyze -> edit -> verify.
4. For research tasks, use: search -> fetch -> summarize.
5. Identify parallelizable steps and assign "parallelGroup" (number).
6. Use "dependsOn" (array of step IDs) for sequential dependencies.
7. The first step ID MUST be "step_1".

Respond with JSON only:
{
  "title": "Short descriptive title",
  "steps": [
    {
      "id": "step_1",
      "description": "What to do",
      "tool": "tool_name",
      "dependsOn": [],
      "canParallelize": true/false,
      "priority": "low" | "normal" | "critical",
      "estimatedComplexity": "low" | "medium" | "high",
      "parallelGroup": 1
    }
  ],
  "canParallelize": true/false,
  "executionMode": "sequential" | "parallel" | "hybrid"
}`;

      const startTime = Date.now();
      const response = await runner.client.chat({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: 'json',
        temperature: 0.1,
        maxTokens: 1000
      });

      const duration = Date.now() - startTime;
      runner.telemetry.info(`[Decomposer] AI decomposition completed in ${duration}ms`);

      let jsonContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      const decomposed = JSON.parse(jsonContent) as DecomposedTask;
      
      // Ensure totalSteps is set
      decomposed.totalSteps = decomposed.steps.length;
      decomposed.id = `task_${Date.now()}`;

      runner.telemetry.info(`[Decomposer] Task split into ${decomposed.totalSteps} steps (${decomposed.executionMode})`);
      
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

      integrator.completeNode('decomposer', `Decomposed into ${decomposed.totalSteps} steps`);
      return result;
    } catch (error) {
      runner.telemetry.warn(`[Decomposer] AI decomposition failed: ${error instanceof Error ? error.message : String(error)}. Falling back to heuristic.`);
      
      // Fallback to the old heuristic if AI fails
      const { decomposeTask } = await import('../task-decomposer');
      const lastUserMsg = state.messages.filter(m => (m as any).role === 'user' || (m as any).type === 'human').pop();
      const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
      const decomposed = decomposeTask(content, []);
      
      integrator.completeNode('decomposer', 'Decomposed using fallback heuristic');
      return {
        decomposedTask: decomposed,
        taskPhase: 'planning' as const,
      };
    }
  };
};
