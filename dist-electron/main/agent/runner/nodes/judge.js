"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJudgeNode = void 0;
const mission_integrator_1 = require("../mission-integrator");
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
const createJudgeNode = (runner, eventQueue, missionTracker) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const startTime = Date.now();
        integrator.startNode('judge', 'Evaluating mission completion');
        // Emit phase change event for validation phase
        if (missionTracker) {
            missionTracker.setPhase('validation');
        }
        try {
            runner.telemetry.transition('judge');
            runner.telemetry.info('Evaluating mission completion signal...');
            eventQueue?.push({ type: 'thought', content: '⚖️ Judge: Evaluating mission completion...' });
            // Hard stop at max iterations
            if ((state.iterations ?? 0) >= MAX_ITERATIONS) {
                runner.telemetry.warn('Max iterations reached — forcing completion');
                integrator.completeNode('judge', 'Max iterations');
                return { taskPhase: 'executing', shouldContinueIteration: false };
            }
            // Read-only intents always complete after one brain pass
            const isReadOnly = state.currentIntent === 'question' || state.currentIntent === 'conversation';
            if (isReadOnly) {
                runner.telemetry.info('Read-only intent — complete');
                integrator.completeNode('judge', 'Read-only complete');
                return { taskPhase: 'executing', shouldContinueIteration: false };
            }
            // ── Primary path: use the brain's completion signal ──────────────────
            const signal = state.completionSignal;
            if (signal) {
                const { reason, explanation } = signal;
                runner.telemetry.info(`Judge: brain signal = ${reason} — ${explanation}`);
                eventQueue?.push({ type: 'thought', content: `⚖️ Judge: ${reason} — ${explanation}` });
                switch (reason) {
                    case 'task_complete':
                        integrator.completeNode('judge', 'Task complete');
                        return { taskPhase: 'executing', shouldContinueIteration: false };
                    case 'waiting_for_user_input':
                        // Brain is waiting for user input — this means the response is incomplete
                        // and the agent should continue iterating to provide a complete response
                        // before asking the user for input
                        integrator.completeNode('judge', 'Waiting for user input — looping back');
                        return { taskPhase: 'executing', shouldContinueIteration: true };
                    case 'needs_hitl':
                        // HITL is handled by the validation → hitl_approval path.
                        // If brain signals needs_hitl here (no tool calls), surface to user and end.
                        integrator.completeNode('judge', 'HITL required — surfacing to user');
                        return { taskPhase: 'executing', shouldContinueIteration: false };
                    case 'cannot_proceed':
                        // Blocked — surface the message to the user and end
                        integrator.completeNode('judge', 'Cannot proceed — surfacing to user');
                        return { taskPhase: 'executing', shouldContinueIteration: false };
                }
            }
            // ── Fallback path: no signal from brain ──────────────────────────────
            // This happens when the AI call for the signal timed out or failed.
            // Fall back to a lightweight AI evaluation of the response itself.
            const messages = state.messages || [];
            const lastAssistantMsg = [...messages].reverse().find((m) => {
                const role = m.role || m._getType?.();
                return role === 'assistant' || role === 'ai';
            });
            const responseContent = lastAssistantMsg
                ? (typeof lastAssistantMsg.content === 'string'
                    ? lastAssistantMsg.content
                    : lastAssistantMsg.content?.text || '')
                : '';
            // No response at all — loop back
            if (!responseContent || responseContent.trim().length < 5) {
                runner.telemetry.warn('No response — looping back to brain');
                integrator.completeNode('judge', 'No response');
                return { taskPhase: 'executing', shouldContinueIteration: true };
            }
            // ── Early completion detection ──────────────────────────────────────
            // Quick heuristics to avoid AI call when completion is obvious
            const hasUserInteraction = responseContent.includes('?') ||
                responseContent.toLowerCase().includes('select') ||
                responseContent.toLowerCase().includes('choose') ||
                responseContent.toLowerCase().includes('option') ||
                responseContent.toLowerCase().includes('would you like') ||
                responseContent.toLowerCase().includes('do you want');
            const hasToolOutput = responseContent.includes('```') ||
                responseContent.includes('File:') ||
                responseContent.includes('Output:') ||
                responseContent.includes('Result:');
            const hasCodeContent = responseContent.includes('def ') ||
                responseContent.includes('function ') ||
                responseContent.includes('class ') ||
                responseContent.includes('import ') ||
                responseContent.includes('const ') ||
                responseContent.includes('let ') ||
                responseContent.includes('var ');
            const isLongResponse = responseContent.trim().length > 100;
            // Early completion for obvious cases
            if (hasUserInteraction || hasToolOutput || hasCodeContent || isLongResponse) {
                runner.telemetry.info('Early completion detected — skipping AI evaluation');
                integrator.completeNode('judge', 'Early completion');
                return { taskPhase: 'executing', shouldContinueIteration: false };
            }
            if (runner.client) {
                try {
                    const userMessages = messages.filter((m) => {
                        const role = m.role || m._getType?.();
                        return role === 'user' || role === 'human';
                    });
                    const originalRequest = userMessages.length > 0
                        ? (typeof userMessages[0].content === 'string'
                            ? userMessages[0].content
                            : JSON.stringify(userMessages[0].content))
                        : '';
                    const judgePrompt = `Mission completion judge. Brain response lacks completion signal.

REQUEST: "${originalRequest.slice(0, 200)}"
RESPONSE: "${responseContent.slice(0, 300)}"

Quick decision: "complete" if response has ANY value (asks user input, shows options, does work). "incomplete" ONLY if pure empty filler.

JSON:
{
  "verdict": "complete" | "incomplete",
  "confidence": 0.0-1.0,
  "reasoning": "brief reason"
}`;
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Judge timed out')), 7000));
                    const response = await Promise.race([
                        runner.client.chat({
                            messages: [{ role: 'user', content: judgePrompt }],
                            responseFormat: 'json',
                            temperature: 0.0, // Reduced from 0.1 for faster, more deterministic responses
                            maxTokens: 80, // Reduced from 120 for faster processing
                        }),
                        timeoutPromise,
                    ]);
                    let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
                    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                    let judgment;
                    try {
                        judgment = JSON.parse(content);
                    }
                    catch (parseError) {
                        console.warn('[Judge] Failed to parse judgment JSON:', content);
                        throw new Error('Failed to parse judgment JSON');
                    }
                    const isComplete = judgment.verdict === 'complete' && judgment.confidence > 0.5;
                    runner.telemetry.info(`Judge fallback verdict: ${judgment.verdict} (${Math.round(judgment.confidence * 100)}%) — ${judgment.reasoning}`);
                    eventQueue?.push({ type: 'thought', content: `⚖️ Judge: ${judgment.verdict} — ${judgment.reasoning}` });
                    integrator.completeNode('judge', `Fallback verdict: ${judgment.verdict}`);
                    return { taskPhase: 'executing', shouldContinueIteration: !isComplete };
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    console.warn('[Judge] Fallback AI evaluation failed:', errorMessage);
                    // If the AI evaluation fails, use a more conservative heuristic
                    // Check if there's any meaningful content or user interaction
                    const hasUserInteraction = responseContent.includes('?') ||
                        responseContent.toLowerCase().includes('select') ||
                        responseContent.toLowerCase().includes('choose') ||
                        responseContent.toLowerCase().includes('option');
                    if (hasUserInteraction) {
                        runner.telemetry.info('Heuristic: User interaction detected — completing');
                        integrator.completeNode('judge', 'Heuristic: user interaction');
                        return { taskPhase: 'executing', shouldContinueIteration: false };
                    }
                }
            }
            // Final heuristic: any response > 30 chars is complete
            const isSubstantive = responseContent.trim().length > 30;
            integrator.completeNode('judge', isSubstantive ? 'Heuristic: complete' : 'Heuristic: incomplete');
            return { taskPhase: 'executing', shouldContinueIteration: !isSubstantive };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            runner.telemetry.warn(`Judge failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`);
            integrator.failNode('judge', error instanceof Error ? error.message : String(error));
            return { taskPhase: 'executing', shouldContinueIteration: false };
        }
    };
};
exports.createJudgeNode = createJudgeNode;
