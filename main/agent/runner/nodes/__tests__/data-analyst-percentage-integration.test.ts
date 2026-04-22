import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataAnalystNode } from '../specialized_agents';
import { GraphStateType, StreamEvent, DecomposedTask } from '../../state';
import { AgentRunner } from '../../runner';

/**
 * Integration test for Data Analyst percentage tracking with decomposed tasks
 * Validates: Requirement 1.5
 */
describe('Data Analyst Multi-Step Analysis with Percentage Tracking', () => {
  let mockRunner: AgentRunner;
  let eventQueue: StreamEvent[];
  let mockState: GraphStateType;

  beforeEach(() => {
    eventQueue = [];

    // Mock AgentRunner
    mockRunner = {
      config: {
        vlm: null,
      },
      tools: [],
      telemetry: {
        transition: vi.fn(),
        metrics: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      client: {
        provider: 'openai',
        model: 'gpt-4',
        chat: vi.fn().mockResolvedValue({
          content: 'Analysis complete',
          toolCalls: [],
          finishReason: 'stop',
        }),
      },
      _buildToolDefinitions: vi.fn().mockReturnValue([]),
      shouldCaptureScreenshot: vi.fn().mockReturnValue(false),
      getClient: vi.fn(),
      releaseClient: vi.fn(),
    } as any;

    // Mock state with decomposed task
    const decomposedTask: DecomposedTask = {
      id: 'task-1',
      title: 'Analyze sales data',
      steps: [
        {
          id: 'step-1',
          description: 'Load CSV file',
          tool: 'readFile',
          canParallelize: false,
        },
        {
          id: 'step-2',
          description: 'Compute statistics',
          tool: 'terminal_execute',
          canParallelize: false,
        },
        {
          id: 'step-3',
          description: 'Generate visualization',
          tool: 'visualize',
          canParallelize: false,
        },
      ],
      totalSteps: 3,
      canParallelize: false,
      executionMode: 'sequential',
    };

    mockState = {
      messages: [
        { role: 'user', content: 'Analyze sales.csv' }
      ],
      iterations: 0,
      decomposedTask,
    } as GraphStateType;
  });

  /**
   * Validates: Requirement 1.5
   * THE Progress_Streamer SHALL include percentage completion estimates for multi-step analyses
   */
  it('should initialize progress tracking when decomposed task exists', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    // Verify initial event was emitted
    const startEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('Initializing analysis')
    );
    expect(startEvent).toBeDefined();
  });

  /**
   * Validates: Requirement 1.5
   * Verify percentage is calculated and included in progress events
   */
  it('should emit progress with percentage after completion', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    // Find progress event with percentage
    const progressWithPercentage = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('[') && e.content.includes('%]')
    );

    expect(progressWithPercentage).toBeDefined();
    expect(progressWithPercentage?.content).toMatch(/\[\d+%\]/);
  });

  /**
   * Validates: Requirement 1.5
   * Verify percentage calculation is correct for 3-step task
   */
  it('should calculate 33% completion for 1 of 3 steps', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    // After one execution, should show 33% (1/3 steps)
    const progressEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('[33%]')
    );

    expect(progressEvent).toBeDefined();
  });

  /**
   * Validates: Requirement 1.5
   * Verify no percentage tracking when no decomposed task exists
   */
  it('should not emit percentage when no decomposed task exists', async () => {
    // Remove decomposed task from state
    const stateWithoutPlan = {
      ...mockState,
      decomposedTask: undefined,
    } as GraphStateType;

    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(stateWithoutPlan);

    // Should not have any percentage events
    const progressWithPercentage = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('[') && e.content.includes('%]')
    );

    expect(progressWithPercentage).toBeUndefined();
  });

  /**
   * Validates: Requirement 1.5
   * Verify percentage tracking handles zero total steps
   */
  it('should handle decomposed task with zero total steps', async () => {
    const stateWithZeroSteps = {
      ...mockState,
      decomposedTask: {
        ...mockState.decomposedTask!,
        totalSteps: 0,
      },
    } as GraphStateType;

    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(stateWithZeroSteps);

    // Should not crash and should not emit percentage
    const progressWithPercentage = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('[') && e.content.includes('%]')
    );

    expect(progressWithPercentage).toBeUndefined();
  });

  /**
   * Validates: Requirement 1.5
   * Verify plan context is included in system prompt
   */
  it('should include plan context in system prompt when decomposed task exists', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    const chatCall = (mockRunner.client.chat as any).mock.calls[0][0];
    const systemMessage = chatCall.messages.find((m: any) => m.role === 'system');

    expect(systemMessage.content).toContain('CURRENT EXECUTION PLAN');
    expect(systemMessage.content).toContain('Analyze sales data');
    expect(systemMessage.content).toContain('step-1');
    expect(systemMessage.content).toContain('Load CSV file');
  });

  /**
   * Validates: Requirement 1.5
   * Verify multiple steps can be tracked sequentially
   */
  it('should track multiple steps in sequence', async () => {
    // Simulate multiple step executions
    const decomposedTask: DecomposedTask = {
      id: 'task-2',
      title: 'Complex analysis',
      steps: [
        { id: 'step-1', description: 'Load data', tool: 'readFile', canParallelize: false },
        { id: 'step-2', description: 'Clean data', tool: 'terminal_execute', canParallelize: false },
        { id: 'step-3', description: 'Analyze', tool: 'terminal_execute', canParallelize: false },
        { id: 'step-4', description: 'Visualize', tool: 'visualize', canParallelize: false },
        { id: 'step-5', description: 'Export', tool: 'fsWrite', canParallelize: false },
      ],
      totalSteps: 5,
      canParallelize: false,
      executionMode: 'sequential',
    };

    const stateWithFiveSteps = {
      ...mockState,
      decomposedTask,
    } as GraphStateType;

    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(stateWithFiveSteps);

    // After one execution, should show 20% (1/5 steps)
    const progressEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('[20%]')
    );

    expect(progressEvent).toBeDefined();
  });
});
