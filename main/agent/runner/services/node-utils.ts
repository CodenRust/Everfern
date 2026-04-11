import { GraphStateType } from '../state';
import { AgentRunner } from '../runner';

/**
 * Handles node lifecycle events (telemetry, logging).
 */
export const nodeLifecycle = (runner: AgentRunner, nodeName: string) => {
  runner.telemetry.transition(nodeName);
  return {
    info: (msg: string) => runner.telemetry.info(msg),
    warn: (msg: string) => runner.telemetry.warn(msg),
    error: (msg: string) => runner.telemetry.warn(msg), // Fallback to warn if error is missing
  };
};

/**
 * Common HITL patterns.
 */
export const handleApproval = (state: GraphStateType, task: any, interruptFn: any) => {
  const isReadOnly = ['conversation', 'question'].includes(state.currentIntent || '');
  if (isReadOnly) return 'approved';
  return interruptFn({
    question: "Please review and approve the execution plan.",
    plan: task
  });
};
