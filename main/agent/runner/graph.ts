import { StateGraph, END, START, MemorySaver } from '@langchain/langgraph';
import { GraphState, GraphStateType, StreamEvent } from './state';
import { createTriageNode } from './nodes/triage';
import { createPlannerNode } from './nodes/planner';
import { createCallModelNode } from './nodes/call_model';
import { createExecuteToolsNode } from './nodes/execute_tools';
import { AgentRunner } from './runner';
import { isReadOnlyTask, generateContextualCompletionMessage, getContextualSuggestions } from './utils';
import * as crypto from 'crypto';

// Use a shared memory saver for proper state persistence across interrupts and iterations
const memorySaver = new MemorySaver();

export const buildGraph = (
  runner: AgentRunner,
  toolDefs: any[],
  tools: any[],
  eventQueue?: StreamEvent[],
  conversationId?: string,
  detectedSkills?: any[],
  needsVision: boolean = false
) => {
  const config = (runner as any).config;

  const should_continue = (state: GraphStateType): 'execute_tools' | typeof END => {
    if (state.pauseGeneration) {
      runner.telemetry.warn('Session paused by internal request.');
      return END;
    }
    if (state.iterations >= config.maxIterations) {
      runner.telemetry.warn(`Resource Limit: Reached iteration threshold (${config.maxIterations}). Terminating session.`);
      return END;
    }

    let hasWrittenFile = false;
    let hasRunCommand = false;
    for (const rec of state.toolCallRecords ?? []) {
      if (rec.toolName === 'write' || rec.toolName === 'edit') hasWrittenFile = true;
      if (rec.toolName === 'run_command' || rec.toolName === 'bash') hasRunCommand = true;
    }

    if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
      runner.telemetry.info('Transition logic: Diverting to EXECUTE_TOOLS for pending operations.');
      return 'execute_tools';
    }

    const currentIntent = state.currentIntent || 'unknown';
    const isActionableIntent = ['coding', 'task'].includes(currentIntent);
    const skillsWereDetected = (detectedSkills ?? []).length > 0;
    const noRealWork = !hasWrittenFile && !hasRunCommand;

    if (isActionableIntent && skillsWereDetected && noRealWork && (runner as any).completionGateRetries < 4) {
      runner.telemetry.warn('Verification Gate: Objective incomplete. Re-routing for logic refinement.');
      (runner as any).completionGateRetries++;
      const contextualMessage = generateContextualCompletionMessage(currentIntent);
      state.messages.push({ role: 'system', content: contextualMessage });
      state.pendingToolCalls = [{
        id: 'call_completion_gate_' + crypto.randomUUID().substring(0, 8),
        name: 'system_verify_intent',
        arguments: { _context: { intent: currentIntent, phase: 'evaluating' } }
      } as any];
      return 'execute_tools';
    }

    const lastRec = state.toolCallRecords?.[state.toolCallRecords.length - 1];
    const taskJustFailed = lastRec && (!lastRec.result?.success || lastRec.result?.error);

    if (taskJustFailed && (runner as any).completionGateRetries < 4) {
      runner.telemetry.warn(`Persistence Engine: Operation [${lastRec?.toolName}] failed. Triggering recovery protocol.`);
      (runner as any).completionGateRetries++;
      state.messages.push({
        role: 'system',
        content: `SYSTEM PERSISTENCE: The previous tool call [${lastRec?.toolName}] failed. Fix your approach and retry.\nError: ${lastRec?.result?.error}\nSuggestions:\n${getContextualSuggestions(currentIntent, lastRec?.toolName || '')}`
      });
      state.pendingToolCalls = [{
        id: 'persistence_retry_' + crypto.randomUUID().substring(0, 8),
        name: 'system_verify_intent',
        arguments: { _context: { intent: currentIntent, phase: 'executing' } }
      } as any];
      return 'execute_tools';
    }

    if (isReadOnlyTask(currentIntent)) {
      runner.telemetry.info('Mission objective satisfied. Read-only intent finalized.');
      return END;
    }
    if (isActionableIntent && (hasWrittenFile || hasRunCommand)) {
      runner.telemetry.info('Mission objective satisfied. Executable workload completed.');
      return END;
    }
    
    return END;
  };

  const triageNode = createTriageNode(runner, eventQueue);
  const plannerNode = createPlannerNode(runner, eventQueue);
  const callModelNode = createCallModelNode(runner, toolDefs, eventQueue, config.maxIterations);
  const executeToolsNode = createExecuteToolsNode(runner, tools, config, eventQueue, conversationId);

  return new StateGraph(GraphState)
    .addNode('triage', triageNode)
    .addNode('planner', plannerNode)
    .addNode('call_model', callModelNode)
    .addNode('execute_tools', executeToolsNode)
    .addEdge(START, 'triage')
    .addEdge('triage', 'planner')
    .addEdge('planner', 'call_model')
    .addConditionalEdges(
      'call_model',
      should_continue,
      {
        execute_tools: 'execute_tools',
        [END]: END,
      }
    )
    .addEdge('execute_tools', 'call_model')
    .compile({ checkpointer: memorySaver });
};
