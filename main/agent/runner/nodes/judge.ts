import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';

const MAX_ITERATIONS = 50;

/**
 * Judge Node — mandatory gate before END
 *
 * The brain sets a `completionSignal` before routing here, explaining why
 * it believes the mission turn is over. The judge evaluates that signal and
 * decides whether to pass the mission through to END or loop back to brain.
 *
 * Signal reasons and their verdicts:
 *   task_complete        → END  (work is done)
 *   waiting_for_user_input → END  (user must reply; next turn resumes)
 *   needs_hitl           → END  (HITL flow handles approval separately)
 *   cannot_proceed       → END  (blocked; surface to user)
 *   null (no signal)     → AI fallback evaluation, then heuristic
 *
 * The judge only loops back to brain when:
 *   - No signal AND AI/heuristic says the response has zero substance
 *   - Max iterations not yet reached
 */
export const createJudgeNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
) => {
  const integrator = createMissionIntegrator(missionTracker);

  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    integrator.startNode('judge', 'Evaluating mission completion');

    try {
      runner.telemetry.transition('judge');
      runner.telemetry.info('Evaluating mission completion signal...');
      eventQueue?.push({ type: 'thought', content: '⚖️ Judge: Evaluating mission completion...' });

      // Hard stop at max iterations
      if ((state.iterations ?? 0) >= MAX_ITERATIONS) {
        runner.telemetry.warn('Max iterations reached — forcing completion');
        integrator.completeNode('judge', 'Max iterations');
        return { taskPhase: 'executing' as const, shouldContinueIteration: false };
      }

      // Read-only intents always complete after one brain pass
      const isReadOnly = state.currentIntent === 'question' || state.currentIntent === 'conversation';
      if (isReadOnly) {
        runner.telemetry.info('Read-only intent — complete');
        integrator.completeNode('judge', 'Read-only complete');
        return { taskPhase: 'executing' as const, shouldContinueIteration: false };
      }

      // ── Primary path: use the brain's completion signal ──────────────────
      const signal = (state as any).completionSignal as {
        reason: 'task_complete' | 'waiting_for_user_input' | 'needs_hitl' | 'cannot_proceed';
        explanation: string;
      } | null | undefined;

      if (signal) {
        const { reason, explanation } = signal;
        runner.telemetry.info(`Judge: brain signal = ${reason} — ${explanation}`);
        eventQueue?.push({ type: 'thought', content: `⚖️ Judge: ${reason} — ${explanation}` });

        switch (reason) {
          case 'task_complete':
            integrator.completeNode('judge', 'Task complete');
            return { taskPhase: 'executing' as const, shouldContinueIteration: false };

          case 'waiting_for_user_input':
            // Brain is waiting for user — valid terminal state for this turn
            integrator.completeNode('judge', 'Waiting for user input');
            return { taskPhase: 'executing' as const, shouldContinueIteration: false };

          case 'needs_hitl':
            // HITL is handled by the validation → hitl_approval path.
            // If brain signals needs_hitl here (no tool calls), surface to user and end.
            integrator.completeNode('judge', 'HITL required — surfacing to user');
            return { taskPhase: 'executing' as const, shouldContinueIteration: false };

          case 'cannot_proceed':
            // Blocked — surface the message to the user and end
            integrator.completeNode('judge', 'Cannot proceed — surfacing to user');
            return { taskPhase: 'executing' as const, shouldContinueIteration: false };
        }
      }

      // ── Fallback path: no signal from brain ──────────────────────────────
      // This happens when the AI call for the signal timed out or failed.
      // Fall back to a lightweight AI evaluation of the response itself.

      const messages = state.messages || [];
      const lastAssistantMsg = [...messages].reverse().find((m: any) => {
        const role = m.role || m._getType?.();
        return role === 'assistant' || role === 'ai';
      });

      const responseContent = lastAssistantMsg
        ? (typeof lastAssistantMsg.content === 'string'
            ? lastAssistantMsg.content
            : (lastAssistantMsg.content as any)?.text || '')
        : '';

      // No response at all — loop back
      if (!responseContent || responseContent.trim().length < 5) {
        runner.telemetry.warn('No response — looping back to brain');
        integrator.completeNode('judge', 'No response');
        return { taskPhase: 'executing' as const, shouldContinueIteration: true };
      }

      if (runner.client) {
        try {
          const userMessages = messages.filter((m: any) => {
            const role = m.role || m._getType?.();
            return role === 'user' || role === 'human';
          });
          const originalRequest = userMessages.length > 0
            ? (typeof (userMessages[0] as any).content === 'string'
                ? (userMessages[0] as any).content
                : JSON.stringify((userMessages[0] as any).content))
            : '';

          const judgePrompt = `You are a mission completion judge. The brain produced a response but did not provide a completion signal.

USER REQUEST: "${originalRequest.slice(0, 300)}"
BRAIN RESPONSE: "${responseContent.slice(0, 500)}"

Is this a valid terminal state? Answer "complete" if the response has ANY substance — including asking the user for input, presenting options, or doing partial work. Answer "incomplete" ONLY if the response is a pure empty filler with zero value (e.g. "I'll help you" with nothing else).

JSON only:
{
  "verdict": "complete" | "incomplete",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence"
}`;

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Judge timed out')), 3000)
          );

          const response = await Promise.race([
            runner.client.chat({
              messages: [{ role: 'user', content: judgePrompt }],
              responseFormat: 'json',
              temperature: 0.1,
              maxTokens: 120,
            }),
            timeoutPromise,
          ]) as any;

          let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const judgment = JSON.parse(content);

          const isComplete = judgment.verdict === 'complete' && judgment.confidence > 0.5;
          runner.telemetry.info(`Judge fallback verdict: ${judgment.verdict} (${Math.round(judgment.confidence * 100)}%) — ${judgment.reasoning}`);
          eventQueue?.push({ type: 'thought', content: `⚖️ Judge: ${judgment.verdict} — ${judgment.reasoning}` });

          integrator.completeNode('judge', `Fallback verdict: ${judgment.verdict}`);
          return { taskPhase: 'executing' as const, shouldContinueIteration: !isComplete };

        } catch (err) {
          console.warn('[Judge] Fallback AI evaluation failed:', err instanceof Error ? err.message : String(err));
        }
      }

      // Final heuristic: any response > 30 chars is complete
      const isSubstantive = responseContent.trim().length > 30;
      integrator.completeNode('judge', isSubstantive ? 'Heuristic: complete' : 'Heuristic: incomplete');
      return { taskPhase: 'executing' as const, shouldContinueIteration: !isSubstantive };

    } catch (error) {
      integrator.failNode('judge', error instanceof Error ? error.message : String(error));
      return { taskPhase: 'executing' as const, shouldContinueIteration: false };
    }
  };
};
