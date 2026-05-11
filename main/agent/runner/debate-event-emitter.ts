/**
 * EverFern Desktop — Debate Event Emitter
 *
 * Sends debate progress and results to the frontend in real-time.
 * Events are sent via IPC to the renderer process.
 */

import type { DebateResult, DebateMessage } from './debate-types';

export interface DebateStreamEvent {
  type: 'debate_start' | 'vanguard_complete' | 'phantom_complete' | 'arbiter_complete' | 'debate_complete' | 'debate_error';
  timestamp: string;
  debateId: string;
  phase?: 'vanguard' | 'phantom' | 'arbiter';
  data?: any;
  error?: string;
}

export class DebateEventEmitter {
  /**
   * Emit a debate event to the frontend.
   * Called by debate engine to stream progress.
   */
  static emitDebateEvent(event: { sender?: any }, debateEvent: DebateStreamEvent) {
    if (event.sender) {
      try {
        event.sender.send('debate:stream', debateEvent);
      } catch (err) {
        console.error('[DebateEventEmitter] Error sending debate event:', err);
      }
    }
  }

  /**
   * Format a debate result for sending to frontend.
   */
  static formatDebateResultForFrontend(debateResult: DebateResult) {
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

export const debateEventEmitter = DebateEventEmitter;
