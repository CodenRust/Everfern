/**
 * Test for Task 3.8: Fix premature task completion in validation.ts
 *
 * Validates that decomposed tasks don't complete prematurely
 */

import { describe, it, expect, vi } from 'vitest';
import { createValidationNode } from '../validation';
import { DecomposedTask, GraphStateType } from '../../state';

describe('ValidationNode - Task Completion Logic', () => {
  const mockRunner = {
    telemetry: { transition: vi.fn() },
    client: {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          isComplete: false,
          confidence: 0.5,
          reasoning: 'Task not complete'
        })
      })
    }
  } as any;

  it('should not complete when decomposed task has critical steps not executed', async () => {
    const decomposedTask: DecomposedTask = {
      id: 'task_1',
      title: 'Analyze data',
      steps: [
        { id: 'step_1', description: 'Read file', tool: 'view_file', canParallelize: false, priority: 'critical' },
        { id: 'step_2', description: 'Analyze data', tool: 'write', canParallelize: false, priority: 'critical' },
        { id: 'step_3', description: 'Present results', tool: 'present_files', canParallelize: false, priority: 'normal' }
      ],
      totalSteps: 3,
      canParallelize: false,
      executionMode: 'sequential'
    };

    const state: Partial<GraphStateType> = {
      currentIntent: 'analyze',
      decomposedTask,
      toolCallHistory: [], // No tools executed yet
      toolCallRecords: [],
      messages: [],
      iterations: 1
    };

    const node = createValidationNode(mockRunner);
    const result = await node(state as GraphStateType);

    // Should NOT complete because critical steps haven't been executed
    expect(result.shouldContinueIteration).toBe(true);
  });

  it('should allow completion when critical steps have been executed', async () => {
    const decomposedTask: DecomposedTask = {
      id: 'task_1',
      title: 'Analyze data',
      steps: [
        { id: 'step_1', description: 'Read file', tool: 'view_file', canParallelize: false, priority: 'critical' },
        { id: 'step_2', description: 'Analyze data', tool: 'write', canParallelize: false, priority: 'critical' }
      ],
      totalSteps: 2,
      canParallelize: false,
      executionMode: 'sequential'
    };

    const state: Partial<GraphStateType> = {
      currentIntent: 'analyze',
      decomposedTask,
      toolCallHistory: [
        { name: 'view_file', args: { path: 'data.csv' } },
        { name: 'write', args: { path: 'analysis.html' } }
      ],
      toolCallRecords: [
        { name: 'view_file', args: { path: 'data.csv' } },
        { name: 'write', args: { path: 'analysis.html' } }
      ],
      messages: [
        { role: 'user', content: 'analyze data' },
        { role: 'assistant', content: 'I have completed the analysis and created a visualization.' }
      ],
      iterations: 2
    };

    // Mock AI to say task is complete
    mockRunner.client.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        isComplete: true,
        confidence: 0.9,
        reasoning: 'Task complete'
      })
    });

    const node = createValidationNode(mockRunner);
    const result = await node(state as GraphStateType);

    // Should complete because critical steps have been executed and AI confirms completion
    expect(result.shouldContinueIteration).toBe(false);
  });

  it('should not complete complex tasks with insufficient tool calls', async () => {
    const decomposedTask: DecomposedTask = {
      id: 'task_1',
      title: 'Build full application',
      steps: [
        { id: 'step_1', description: 'Read skill', tool: 'skill', canParallelize: false, priority: 'critical' },
        { id: 'step_2', description: 'Create plan', tool: 'execution_plan', canParallelize: false, priority: 'critical' },
        { id: 'step_3', description: 'Write main file', tool: 'write', canParallelize: false, priority: 'normal' },
        { id: 'step_4', description: 'Write config', tool: 'write', canParallelize: false, priority: 'normal' },
        { id: 'step_5', description: 'Install deps', tool: 'run_command', canParallelize: false, priority: 'normal' },
        { id: 'step_6', description: 'Build', tool: 'run_command', canParallelize: false, priority: 'normal' }
      ],
      totalSteps: 6,
      canParallelize: false,
      executionMode: 'sequential'
    };

    const state: Partial<GraphStateType> = {
      currentIntent: 'build',
      decomposedTask,
      toolCallHistory: [
        { name: 'skill', args: {} },
        { name: 'execution_plan', args: {} }
      ], // Only 2 out of 6 steps executed (33%, less than 50% threshold)
      toolCallRecords: [
        { name: 'skill', args: {} },
        { name: 'execution_plan', args: {} }
      ],
      messages: [],
      iterations: 1
    };

    const node = createValidationNode(mockRunner);
    const result = await node(state as GraphStateType);

    // Should NOT complete because only 33% of steps executed (need at least 50%)
    expect(result.shouldContinueIteration).toBe(true);
  });

  it('should allow completion for read-only tasks without decomposition', async () => {
    const state: Partial<GraphStateType> = {
      currentIntent: 'question',
      decomposedTask: undefined,
      toolCallHistory: [],
      toolCallRecords: [],
      messages: [
        { role: 'user', content: 'what is TypeScript?' },
        { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' }
      ],
      iterations: 1
    };

    const node = createValidationNode(mockRunner);
    const result = await node(state as GraphStateType);

    // Should complete because it's a read-only question task
    expect(result.shouldContinueIteration).toBe(false);
  });

  it('should force completion at max iterations', async () => {
    const decomposedTask: DecomposedTask = {
      id: 'task_1',
      title: 'Complex task',
      steps: [
        { id: 'step_1', description: 'Step 1', tool: 'write', canParallelize: false, priority: 'critical' }
      ],
      totalSteps: 1,
      canParallelize: false,
      executionMode: 'sequential'
    };

    const state: Partial<GraphStateType> = {
      currentIntent: 'coding',
      decomposedTask,
      toolCallHistory: [],
      toolCallRecords: [],
      messages: [],
      iterations: 50 // MAX_ITERATIONS
    };

    const node = createValidationNode(mockRunner);
    const result = await node(state as GraphStateType);

    // Should complete at max iterations to prevent infinite loops
    expect(result.shouldContinueIteration).toBe(false);
  });
});
