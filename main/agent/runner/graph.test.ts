import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildGraph } from './graph';
import { GraphState } from './state';
import { END } from '@langchain/langgraph';

let runCount = 0;

vi.mock('./nodes/triage', () => ({
  createTriageNode: vi.fn(() => async (state: any) => {
    return { currentIntent: 'coding' };
  })
}));

vi.mock('./nodes/planner', () => ({
  createPlannerNode: vi.fn(() => async (state: any) => {
    return { taskPhase: 'planning' };
  })
}));

vi.mock('./nodes/call_model', () => ({
  createCallModelNode: vi.fn(() => async (state: any) => {
    runCount++;
    if (runCount === 1) {
        // First run: output a tool call
        return { 
            messages: [{ role: 'assistant', content: 'doing work' }],
            pendingToolCalls: [{ id: 'tc_1', name: 'write', arguments: { path: 'test.ts' } }] 
        };
    } else {
        // Second run: no more tool calls, just finish
        return { 
            messages: [{ role: 'assistant', content: 'done' }],
            pendingToolCalls: []
        };
    }
  })
}));

vi.mock('./nodes/execute_tools', () => ({
  createExecuteToolsNode: vi.fn(() => async (state: any) => {
    if (state.pendingToolCalls?.length > 0) {
        return { 
            toolCallRecords: [{ toolName: 'write', args: {}, result: { success: true } }],
            pendingToolCalls: [],
            pauseGeneration: true // Simulate pausing after first tool execution
        };
    }
    return { pauseGeneration: false };
  })
}));

describe('LangGraph Checkpointer Persistence', () => {
  let mockRunner: any;

  beforeEach(() => {
    runCount = 0;
    mockRunner = {
      config: { maxIterations: 10 },
      telemetry: {
        warn: vi.fn(),
        info: vi.fn(),
        action: vi.fn(),
      }
    };
  });

  it('should persist state across interrupts/pauses using checkpointer', async () => {
    const graph = buildGraph(mockRunner, [], [], [], 'test-conv-id', [], false);
    const threadConfig = { configurable: { thread_id: 'test-thread-1' }, recursionLimit: 50 };

    const initialState = {
      messages: [{ role: 'user', content: 'test request' }],
      toolCallRecords: [],
      iterations: 0,
      pendingToolCalls: [],
      finalResponse: '',
      toolCallHistory: [],
    };

    // First invocation
    const firstResult = await graph.invoke(initialState, threadConfig);

    expect(firstResult.currentIntent).toBe('coding');
    expect(firstResult.pauseGeneration).toBe(true);
    expect(firstResult.toolCallRecords.length).toBe(1);
    expect(firstResult.toolCallRecords[0].toolName).toBe('write');

    // We manually clear pauseGeneration to resume execution
    // And provide empty pendingToolCalls so call_model mock knows to finish
    const updatedState = { pauseGeneration: false, iterations: 1 };

    // Second invocation
    const secondResult = await graph.invoke(updatedState, threadConfig);

    expect(secondResult.pauseGeneration).toBe(false);
    
    // Checkpointer should preserve the toolCallRecords from the first run!
    // Since execute_tools doesn't run again (pendingToolCalls empty), it should still be 1.
    expect(secondResult.toolCallRecords.length).toBe(1);
    expect(secondResult.toolCallRecords[0].toolName).toBe('write');
  });
});