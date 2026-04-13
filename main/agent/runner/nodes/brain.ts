    import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition } from '../../../lib/ai-client';
import { runAgentStep } from '../services/agent-runtime';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';

type CompletionReason = 'task_complete' | 'waiting_for_user_input' | 'needs_hitl' | 'cannot_proceed';

/**
 * After the brain produces a response with no tool calls, ask it to self-assess
 * why it's done and produce a structured completion signal for the judge.
 *
 * This replaces regex pattern matching in the judge with a first-class signal
 * from the brain itself.
 */
async function buildCompletionSignal(
  runner: AgentRunner,
  responseContent: string,
  originalRequest: string,
): Promise<{ reason: CompletionReason; explanation: string } | null> {
  if (!runner.client) {
    console.warn('[Brain] No client available for completion signal');
    return null;
  }

  try {
    const prompt = `You just produced a response to a user request. Classify why you are done for this turn.

USER REQUEST: "${originalRequest.slice(0, 300)}"
YOUR RESPONSE: "${responseContent.slice(0, 500)}"

Choose exactly one reason:
- "task_complete"        — You fully completed the requested task with substantive output
- "waiting_for_user_input" — You need the user to provide information, make a selection, or upload a file before you can proceed
- "needs_hitl"           — A high-risk or irreversible action requires explicit human approval before execution
- "cannot_proceed"       — You are blocked and cannot make progress (missing permissions, unsupported request, etc.)

Respond with JSON only:
{
  "reason": "task_complete" | "waiting_for_user_input" | "needs_hitl" | "cannot_proceed",
  "explanation": "one sentence explaining why"
}`;

    console.log('[Brain] Building completion signal...');
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('completion signal timed out')), 15000)
    );

    const response = await Promise.race([
      runner.client.chat({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: 'json',
        temperature: 0.1,
        maxTokens: 120,
      }),
      timeoutPromise,
    ]) as any;

    const duration = Date.now() - startTime;
    console.log(`[Brain] Completion signal response received in ${duration}ms`);

    let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let signal;
    try {
      signal = JSON.parse(content);
    } catch (parseError) {
      console.warn('[Brain] Failed to parse completion signal JSON:', content);
      return null;
    }

    const validReasons: CompletionReason[] = ['task_complete', 'waiting_for_user_input', 'needs_hitl', 'cannot_proceed'];
    if (!validReasons.includes(signal.reason)) {
      console.warn('[Brain] Invalid completion signal reason:', signal.reason);
      return null;
    }

    console.log(`[Brain] Completion signal built successfully: ${signal.reason}`);
    return { reason: signal.reason as CompletionReason, explanation: String(signal.explanation || '') };
  } catch (error) {
    // Log the specific error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[Brain] Completion signal failed:', errorMessage);
    return null;
  }
}

/**
 * Central Brain Node - The Main Orchestrator
 *
 * After producing a response with no tool calls, the brain self-assesses
 * and sets a completionSignal so the judge can make an informed verdict
 * without relying on regex pattern matching.
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

    // Emit phase change event for execution phase (only on first brain call)
    if (missionTracker && state.iterations === 0) {
      missionTracker.setPhase('execution');
    }

    const result = await integrator.wrapNode(
      'brain',
      () => runAgentStep(state, {
        runner,
        toolDefs: tools,
        eventQueue,
        nodeName: 'brain',
      }),
      'Processing request'
    );

    // Only build a completion signal when there are no tool calls
    // (i.e. the brain is done for this turn and will route to judge)
    const hasPendingTools = result.pendingToolCalls && result.pendingToolCalls.length > 0;
    if (hasPendingTools) {
      return { ...result, completionSignal: null };
    }

    // Extract the brain's response text
    const messages = result.messages as any[] | undefined;
    const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    const responseContent = lastMsg
      ? (typeof lastMsg.content === 'string' ? lastMsg.content : (lastMsg.content?.text || ''))
      : '';

    // Get original user request for context
    const allMessages = state.messages || [];
    const firstUserMsg = allMessages.find((m: any) => {
      const role = m.role || m._getType?.();
      return role === 'user' || role === 'human';
    });
    const originalRequest = firstUserMsg
      ? (typeof (firstUserMsg as any).content === 'string'
          ? (firstUserMsg as any).content
          : JSON.stringify((firstUserMsg as any).content))
      : '';

    const signal = await buildCompletionSignal(runner, responseContent, originalRequest);

    if (signal) {
      runner.telemetry.info(`Brain completion signal: ${signal.reason} — ${signal.explanation}`);
      eventQueue?.push({ type: 'thought', content: `🧠 Brain: ${signal.reason} — ${signal.explanation}` });
    } else {
      runner.telemetry.warn('Brain completion signal failed — judge will use fallback');
      eventQueue?.push({ type: 'thought', content: '🧠 Brain: completion signal failed, judge will evaluate' });
    }

    return { ...result, completionSignal: signal };
  };
};
