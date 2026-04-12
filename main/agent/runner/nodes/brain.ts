import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition } from '../../../lib/ai-client';
import { runAgentStep } from '../services/agent-runtime';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';

/**
 * Central Brain Node - The Main Orchestrator
 * 
 * This is the core intelligence of the system that:
 * - Uses the main system prompt (SYSTEM_PROMPT.md)
 * - Analyzes the user's request and current context
 * - Decides which specialist nodes to delegate to (if needed)
 * - Coordinates multi-specialist workflows
 * - Synthesizes outputs from multiple specialists
 * - Makes high-level strategic decisions
 * - Handles all user interactions directly
 * 
 * The brain acts as the primary agent that has full access to all tools
 * and can delegate to specialists when their expertise is needed.
 */
export const createBrainNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);
  
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const tools = toolDefs || (runner as any)._buildToolDefinitions();
    
    return integrator.wrapNode(
      'brain',
      () => runAgentStep(state, {
        runner,
        toolDefs: tools,
        eventQueue,
        nodeName: 'brain',
        // No systemPromptOverride - uses the main SYSTEM_PROMPT.md file
        // The brain is the primary agent with full capabilities
      }),
      'Processing request'
    );
  };
};
