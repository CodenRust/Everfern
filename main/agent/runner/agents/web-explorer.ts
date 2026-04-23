import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition } from '../../../lib/ai-client';
import { runAgentStep } from '../services/agent-runtime';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const createWebExplorerNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);

  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const tools = toolDefs || (runner as any)._buildToolDefinitions();

    // Build plan context
    const plan = state.decomposedTask;
    const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';

    // Emit web explorer active event for frontend
    eventQueue?.push({ type: 'thought', content: '\n🌐 Web Explorer: Navigating the web and gathering information...' });

    // Load system prompt from file
    let systemPrompt = '';
    try {
      systemPrompt = await readFile(join(process.cwd(), 'main/agent/prompts/web-explorer.md'), 'utf-8');
    } catch (error) {
      console.warn('Failed to load web explorer prompt, using fallback');
      systemPrompt = `You are the EverFern Web Explorer.
Your goal is to find information on the web and navigate websites.
Use your tools (web_search, web_fetch) to gather the requested data.

CRITICAL RULES:
- Do NOT call create_plan or execution_plan. A plan already exists from the decomposer.
- Do NOT narrate what you are about to do. Skip all filler text. Call tools DIRECTLY.`;
    }

    return integrator.wrapNode(
      'web_explorer',
      () => runAgentStep(state, {
        runner,
        toolDefs: tools,
        eventQueue,
        nodeName: 'web_explorer',
        systemPromptOverride: systemPrompt + planContext
      }),
      'Searching for information'
    );
  };
};
