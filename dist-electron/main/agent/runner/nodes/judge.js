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
const createJudgeNode = (runner, eventQueue, missionTracker, shouldAbort) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        // Check for abort signal before processing
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
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
            // EXCEPTION: if the brain explicitly signals waiting_for_user_input or needs_hitl,
            // honour that signal even for read-only intents — the agent asked the user something.
            const signal = state.completionSignal;
            const isReadOnly = state.currentIntent === 'question' || state.currentIntent === 'conversation';
            const signalNeedsUserAction = signal?.reason === 'waiting_for_user_input' || signal?.reason === 'needs_hitl';
            if (isReadOnly && !signalNeedsUserAction) {
                runner.telemetry.info('Read-only intent — complete');
                integrator.completeNode('judge', 'Read-only complete');
                return { taskPhase: 'executing', shouldContinueIteration: false };
            }
            // ── Primary path: use the brain's completion signal ──────────────────
            if (signal) {
                const { reason, explanation } = signal;
                runner.telemetry.info(`Judge: brain signal = ${reason} — ${explanation}`);
                eventQueue?.push({ type: 'thought', content: `⚖️ Judge: ${reason} — ${explanation}` });
                switch (reason) {
                    case 'task_complete':
                        integrator.completeNode('judge', 'Task complete');
                        return { taskPhase: 'executing', shouldContinueIteration: false };
                    case 'waiting_for_user_input':
                        // Brain is waiting for user input — end this turn so the user can respond.
                        // The ask_user_question tool has already surfaced the form on the frontend.
                        integrator.completeNode('judge', 'Waiting for user input — ending turn');
                        return { taskPhase: 'executing', shouldContinueIteration: false };
                    case 'needs_hitl':
                        // HITL node already surfaced the approval form to the user and ended the turn.
                        // If we somehow reach judge with needs_hitl, just end cleanly.
                        integrator.completeNode('judge', 'HITL required — ending turn');
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
                responseContent.includes('Result:') ||
                responseContent.includes('dashboard.html') ||
                responseContent.includes('.html') ||
                responseContent.includes('saved') ||
                responseContent.includes('created') ||
                responseContent.includes('generated');
            const hasCodeContent = responseContent.includes('def ') ||
                responseContent.includes('function ') ||
                responseContent.includes('class ') ||
                responseContent.includes('import ') ||
                responseContent.includes('const ') ||
                responseContent.includes('let ') ||
                responseContent.includes('var ');
            const hasDataAnalysisContent = responseContent.toLowerCase().includes('analysis') ||
                responseContent.toLowerCase().includes('chart') ||
                responseContent.toLowerCase().includes('visualization') ||
                responseContent.toLowerCase().includes('data') ||
                responseContent.toLowerCase().includes('report') ||
                responseContent.toLowerCase().includes('dashboard') ||
                responseContent.toLowerCase().includes('insights');
            const isLongResponse = responseContent.trim().length > 100;
            // Early completion for obvious cases - be more aggressive about completion
            if (hasUserInteraction || hasToolOutput || hasCodeContent || hasDataAnalysisContent || isLongResponse) {
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

Quick decision: "complete" if response has ANY substantive content, work done, files created, analysis provided, or meaningful output. "incomplete" ONLY if response is pure empty filler or error.

Bias toward COMPLETION - if there's any doubt, choose "complete".

JSON:
{
  "verdict": "complete" | "incomplete",
  "confidence": 0.0-1.0,
  "reasoning": "brief reason"
}`;
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Judge timed out')), 15000));
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
                    const isComplete = judgment.verdict === 'complete' && judgment.confidence > 0.3;
                    runner.telemetry.info(`Judge fallback verdict: ${judgment.verdict} (${Math.round(judgment.confidence * 100)}%) — ${judgment.reasoning}`);
                    eventQueue?.push({ type: 'thought', content: `⚖️ Judge: ${judgment.verdict} — ${judgment.reasoning}` });
                    integrator.completeNode('judge', `Fallback verdict: ${judgment.verdict}`);
                    return { taskPhase: 'executing', shouldContinueIteration: !isComplete };
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    console.warn('[Judge] Fallback AI evaluation failed:', errorMessage);
                    // AI evaluation failed/timed out — fall through to final heuristic below
                    // Do NOT end the mission here; let the heuristic decide
                }
            }
            // Final heuristic: any response > 20 chars is complete (lowered threshold)
            // Be more aggressive about completion to avoid unnecessary loops
            const isSubstantive = responseContent.trim().length > 20;
            integrator.completeNode('judge', isSubstantive ? 'Heuristic: complete' : 'Heuristic: incomplete');
            return { taskPhase: 'executing', shouldContinueIteration: !isSubstantive };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            runner.telemetry.warn(`Judge node error after ${duration}ms: ${errorMsg}`);
            integrator.failNode('judge', errorMsg);
            // On unexpected error, continue iterating rather than silently ending the mission
            return { taskPhase: 'executing', shouldContinueIteration: true };
        }
    };
};
exports.createJudgeNode = createJudgeNode;
