"use strict";
/**
 * EverFern Desktop — Debate Event Emitter
 *
 * Sends debate progress and results to the frontend in real-time.
 * Events are sent via IPC to the renderer process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.debateEventEmitter = exports.DebateEventEmitter = void 0;
class DebateEventEmitter {
    /**
     * Emit a debate event to the frontend.
     * Called by debate engine to stream progress.
     */
    static emitDebateEvent(event, debateEvent) {
        if (event.sender) {
            try {
                event.sender.send('debate:stream', debateEvent);
            }
            catch (err) {
                console.error('[DebateEventEmitter] Error sending debate event:', err);
            }
        }
    }
    /**
     * Format a debate result for sending to frontend.
     */
    static formatDebateResultForFrontend(debateResult) {
        return {
            debateId: debateResult.debateId,
            timestamp: debateResult.timestamp,
            // Proposal summary (Vanguard)
            proposal: {
                id: debateResult.proposal.proposalId,
                taskSummary: debateResult.proposal.taskSummary,
                approach: debateResult.proposal.approach,
                estimatedTimeMs: debateResult.proposal.estimatedTotalTimeMs,
                stepCount: debateResult.proposal.steps.length,
                assumptions: debateResult.proposal.assumptionsAndConstraints,
            },
            // Review summary (Phantom)
            review: {
                id: debateResult.review.reviewId,
                assessment: debateResult.review.overallAssessment,
                concernCount: debateResult.review.concerns.length,
                criticalCount: debateResult.review.concerns.filter(c => c.severity === 'critical').length,
                highCount: debateResult.review.concerns.filter(c => c.severity === 'high').length,
                concerns: debateResult.review.concerns.map(c => ({
                    severity: c.severity,
                    title: c.title,
                    description: c.description,
                    suggestion: c.suggestion,
                })),
            },
            // Final plan (Arbiter)
            finalPlan: {
                id: debateResult.finalPlan.planId,
                goNogo: debateResult.finalPlan.goNogo,
                riskAssessment: debateResult.finalPlan.overallRiskAssessment,
                stepCount: debateResult.finalPlan.steps.length,
                addressedConcerns: debateResult.finalPlan.addressedConcerns.length,
                remainingRisks: debateResult.finalPlan.remainingRisks.length,
                guidance: debateResult.finalPlan.executionGuidance,
                explanation: debateResult.finalPlan.explanation,
            },
        };
    }
}
exports.DebateEventEmitter = DebateEventEmitter;
exports.debateEventEmitter = DebateEventEmitter;
