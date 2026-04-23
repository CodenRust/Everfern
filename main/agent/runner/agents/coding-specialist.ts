import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition } from '../../../lib/ai-client';
import { runAgentStep } from '../services/agent-runtime';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const createCodingSpecialistNode = (
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

    // Emit coding specialist active event for frontend
    eventQueue?.push({ type: 'thought', content: '\n💻 Coding Specialist: Analyzing source code and preparing implementation...' });

    // Load system prompt from file
    let systemPrompt = '';
    try {
      systemPrompt = await readFile(join(process.cwd(), 'main/agent/prompts/coding-specialist.md'), 'utf-8');
    } catch (error) {
      console.warn('Failed to load coding specialist prompt, using fallback');
      systemPrompt = `You are the EverFern Coding Specialist.
Your goal is to write, debug, and optimize code with extreme precision.
Use your tools (write, edit, run_command) to implement the requested features.

CRITICAL RULES:
- Do NOT call create_plan or execution_plan. A plan already exists from the decomposer.
- Do NOT narrate what you are about to do. Skip all filler text like "I'll now..." or "Let me...".
- Call your tools DIRECTLY without preamble.`;
    }

    return integrator.wrapNode(
      'coding_specialist',
      () => runAgentStep(state, {
        runner,
        toolDefs: tools,
        eventQueue,
        nodeName: 'coding_specialist',
        systemPromptOverride: systemPrompt + planContext
      }),
      'Writing Code & Implementing Features'
    );
  };
};
