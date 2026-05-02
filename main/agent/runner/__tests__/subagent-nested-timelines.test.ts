import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubagentSpawner, type SubagentRunner } from '../subagent-spawn';
import { getAgentEvents } from '../../infra/agent-events';

describe('Subagent Nested Timelines — Event Emission', () => {
  /**
   * This test verifies that the SubagentSpawner correctly emits 'subagent-progress' events
   * with proper 'timelineBranch' metadata to enable nested timelines in the frontend.
   */

  beforeEach(() => {
    // Reset spawner and events
    const spawner = getSubagentSpawner();
    spawner.setRunner(undefined as any);
  });

  it('should pipe progress events from runStream to parent events with timelineBranch', async () => {
    const spawner = getSubagentSpawner();
    const parentSessionId = 'parent-session-123';
    
    // Mock runStream generator
    async function* mockStream() {
      yield { type: 'thought', content: 'Thinking about the task...' };
      yield { type: 'tool_start', toolName: 'web_search', toolArgs: { q: 'test' } };
      yield { type: 'chunk', content: 'Result is successful' };
      yield { type: 'done' };
    }

    const mockRunner: SubagentRunner = {
      run: vi.fn(),
      runStream: vi.fn().mockReturnValue(mockStream())
    };

    spawner.setRunner(mockRunner);

    // Capture events emitted to the parent session
    const parentEvents = getAgentEvents(parentSessionId);
    const emittedProgress: any[] = [];
    
    // Use onStream to listen for all events in the 'subagent-progress' stream
    parentEvents.onStream('subagent-progress', (event) => {
      emittedProgress.push({ type: event.type, ...event.data });
    });

    // Add dummy error listener to prevent "Unhandled error" exceptions when type is 'error'
    parentEvents.on('error', () => {});

    // Spawn subagent
    const agent = await spawner.spawn({
      parentSessionId,
      task: 'Research parallel task',
      agentType: 'web-explorer'
    });

    // Wait for the async runSubagent to finish
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify events were emitted
    expect(emittedProgress.length).toBeGreaterThanOrEqual(3); // thought, tool_start, complete

    // Check reasoning event
    const reasoningEvent = emittedProgress.find(e => e.type === 'reasoning');
    expect(reasoningEvent).toBeDefined();
    expect(reasoningEvent.content).toBe('Thinking about the task...');
    expect(reasoningEvent.toolCallId).toBe(agent.agentId);
    expect(reasoningEvent.timelineBranch).toBeDefined();
    expect(reasoningEvent.timelineBranch.sessionId).toBe(agent.sessionKey);
    expect(reasoningEvent.timelineBranch.parentId).toBe(parentSessionId);
    expect(reasoningEvent.timelineBranch.agentType).toBe('web-explorer');

    // Check action event
    const actionEvent = emittedProgress.find(e => e.type === 'action');
    expect(actionEvent).toBeDefined();
    expect(actionEvent.content).toContain('Running tool: web_search');
    expect(actionEvent.timelineBranch.branchStatus).toBe('running');

    // Check complete event
    const completeEvent = emittedProgress.find(e => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.timelineBranch.branchStatus).toBe('completed');
  });

  it('should emit error event with failed branchStatus on failure', async () => {
    const spawner = getSubagentSpawner();
    const parentSessionId = 'parent-error-session';

    const mockRunner: SubagentRunner = {
      run: vi.fn().mockRejectedValue(new Error('Connection failed')),
      runStream: undefined // Force using standard run
    };

    spawner.setRunner(mockRunner);

    const parentEvents = getAgentEvents(parentSessionId);
    const emittedProgress: any[] = [];
    
    parentEvents.onStream('subagent-progress', (event) => {
      emittedProgress.push({ type: event.type, ...event.data });
    });
    
    parentEvents.on('error', () => {});

    await spawner.spawn({
      parentSessionId,
      task: 'Failing task'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const errorEvent = emittedProgress.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.content).toBe('Connection failed');
    expect(errorEvent.timelineBranch.branchStatus).toBe('failed');
  });
});
