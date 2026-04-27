/**
 * Bug Condition Exploration Test: Subagent Parent Context Access
 *
 * This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * Bug: Subagents receive empty history instead of parent conversation context.
 * Expected: Subagents should receive parent conversation's reconstructed history.
 *
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getSubagentSpawner, SubagentSpawner } from '../subagent-spawn';
import { getSubagentRegistry } from '../subagent-registry';

describe('Bug Condition: Subagents Receive Empty History Instead of Parent Context', () => {
  let spawner: SubagentSpawner;
  let capturedHistory: any[] | null = null;

  beforeEach(() => {
    // Reset state
    spawner = getSubagentSpawner();
    capturedHistory = null;
    // Note: Registry persists across tests, but each test uses unique session IDs
  });

  it('should pass parent conversation history to subagent (EXPECTED TO FAIL on unfixed code)', async () => {
    // ARRANGE: Create parent conversation with 3 messages
    const parentHistory = [
      { role: 'user', content: 'Create a login form' },
      { role: 'assistant', content: 'I will create a login form with email and password fields.' },
      { role: 'user', content: 'Add validation to the form' }
    ];

    // Set up mock runner that captures the history parameter
    spawner.setRunner({
      run: async (task: string, history: any[], model?: string) => {
        capturedHistory = history;
        return {
          response: 'Task completed',
          toolCalls: []
        };
      }
    });

    // ACT: Spawn subagent with parent history
    const spawnedAgent = await spawner.spawn({
      parentSessionId: 'test-parent-session',
      task: 'Add email validation',
      model: 'test-model',
      parentHistory
    });

    // Wait for subagent to start running
    await new Promise(resolve => setTimeout(resolve, 100));

    // ASSERT: Subagent should receive parent history (length > 0)
    // This assertion WILL FAIL on unfixed code because subagent receives empty array []
    expect(capturedHistory).not.toBeNull();
    expect(capturedHistory!.length).toBeGreaterThan(0);

    // ASSERT: Subagent history should contain parent messages
    // This assertion WILL FAIL on unfixed code
    expect(capturedHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: expect.stringContaining('login form') })
    ]));
  });

  it('should pass parent history with tool calls to subagent (EXPECTED TO FAIL on unfixed code)', async () => {
    // ARRANGE: Create parent conversation with tool calls
    const parentHistory = [
      { role: 'user', content: 'Read the config file' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'readFile',
            arguments: JSON.stringify({ path: 'config.json' })
          }
        }]
      },
      {
        role: 'tool',
        tool_call_id: 'call_123',
        content: JSON.stringify({ success: true, output: '{"port": 3000}' })
      },
      { role: 'assistant', content: 'The config file shows port 3000.' }
    ];

    // Set up mock runner that captures the history parameter
    spawner.setRunner({
      run: async (task: string, history: any[], model?: string) => {
        capturedHistory = history;
        return {
          response: 'Task completed',
          toolCalls: []
        };
      }
    });

    // ACT: Spawn subagent
    const spawnedAgent = await spawner.spawn({
      parentSessionId: 'test-parent-session-2',
      task: 'Update the port to 4000',
      model: 'test-model',
      parentHistory
    });

    // Wait for subagent to start running
    await new Promise(resolve => setTimeout(resolve, 100));

    // ASSERT: Subagent should receive parent history including tool calls
    // This assertion WILL FAIL on unfixed code
    expect(capturedHistory).not.toBeNull();
    expect(capturedHistory!.length).toBeGreaterThan(0);

    // ASSERT: History should include tool call messages
    // This assertion WILL FAIL on unfixed code
    const hasToolCall = capturedHistory!.some(msg =>
      msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0
    );
    expect(hasToolCall).toBe(true);
  });

  it('should cap parent history at 20 turns (40 messages max) (EXPECTED TO FAIL on unfixed code)', async () => {
    // ARRANGE: Create parent conversation with 50 messages (25 turns)
    const parentHistory: any[] = [];
    for (let i = 0; i < 25; i++) {
      parentHistory.push({ role: 'user', content: `User message ${i}` });
      parentHistory.push({ role: 'assistant', content: `Assistant response ${i}` });
    }

    // Set up mock runner that captures the history parameter
    spawner.setRunner({
      run: async (task: string, history: any[], model?: string) => {
        capturedHistory = history;
        return {
          response: 'Task completed',
          toolCalls: []
        };
      }
    });

    // ACT: Spawn subagent
    const spawnedAgent = await spawner.spawn({
      parentSessionId: 'test-parent-session-3',
      task: 'Summarize the conversation',
      model: 'test-model',
      parentHistory
    });

    // Wait for subagent to start running
    await new Promise(resolve => setTimeout(resolve, 100));

    // ASSERT: Subagent should receive capped history (max 40 messages = 20 turns)
    // This assertion WILL FAIL on unfixed code (receives empty array)
    expect(capturedHistory).not.toBeNull();
    expect(capturedHistory!.length).toBeGreaterThan(0);
    expect(capturedHistory!.length).toBeLessThanOrEqual(40);

    // ASSERT: History should contain most recent messages
    // This assertion WILL FAIL on unfixed code
    const lastMessage = capturedHistory![capturedHistory!.length - 1];
    expect(lastMessage.content).toContain('24'); // Most recent message should be from turn 24
  });
});

/**
 * EXPECTED COUNTEREXAMPLES (when test runs on unfixed code):
 *
 * 1. Subagent receives empty array [] instead of parent messages
 *    - Root cause: SubagentSpawner.runSubagent() calls runner.run(task, [], model) with hardcoded empty array
 *
 * 2. capturedHistory is [] (length = 0) instead of containing parent messages
 *    - Root cause: No mechanism to pass parent history through SpawnOptions interface
 *
 * 3. No tool calls in history even when parent has tool calls
 *    - Root cause: spawn_agent tool doesn't load parent conversation from ChatHistoryStore
 *
 * 4. History is not capped at 20 turns
 *    - Root cause: No context window protection logic in subagent spawning flow
 *
 * These counterexamples confirm the bug exists and guide the fix implementation.
 */
