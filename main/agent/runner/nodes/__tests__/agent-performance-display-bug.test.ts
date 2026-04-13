import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildGraph } from '../../graph';
import { GraphStateType } from '../../state';
import { AgentRunner } from '../../runner';
import { classifyIntent } from '../../triage';
import { createJudgeNode } from '../judge';
import { createBrainNode } from '../brain';

/**
 * Bug Condition Exploration Test - Performance Timeout and Display Issues
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 *
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 *
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 *
 * Bug Conditions:
 * 1.1 Intent classification times out after 3 seconds with "Intent classification timed out. Using fallback"
 * 1.2 Judge evaluation times out after 10 seconds with "Judge timed out"
 * 1.3 Mission completion occurs while judge evaluation is still running (timing conflict)
 * 1.4 Mission tracking events are not displayed in frontend (commented out code)
 * 1.5 Planning phases are not visible to users during execution
 */

describe('Bug Condition Exploration - Performance Timeout and Display Issues', () => {
  let mockRunner: AgentRunner;
  let mockClient: any;
  let eventQueue: any[];
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    eventQueue = [];
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock AI client that simulates slow responses
    mockClient = {
      chat: vi.fn(),
      model: 'test-model'
    };

    mockRunner = {
      config: { maxIterations: 50 },
      telemetry: {
        warn: vi.fn(),
        info: vi.fn(),
        action: vi.fn(),
        transition: vi.fn(),
      },
      _buildToolDefinitions: vi.fn(() => []),
      client: mockClient
    } as any;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  /**
   * Property 1: Bug Condition - Intent Classification Timeout
   *
   * EXPECTED OUTCOME: Test FAILS (this is correct - it proves the bug exists)
   *
   * Bug Condition: Intent classification times out after 3 seconds with fallback message
   * Expected Behavior: Intent classification should complete within reasonable time without timing out
   */
  it('PROPERTY 1.1: Intent classification should complete within reasonable time without timing out', async () => {
    // Arrange: Mock slow AI response that exceeds 3 second timeout
    mockClient.chat.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        content: JSON.stringify({
          intent: 'coding',
          confidence: 0.8,
          reasoning: 'User wants to write code'
        })
      }), 5000)) // 5 second delay - exceeds 3 second timeout
    );

    const userInput = 'Help me write a Python function';
    const history: any[] = [];

    // Act: Attempt intent classification
    const startTime = Date.now();
    const result = await classifyIntent(userInput, mockClient, history);
    const duration = Date.now() - startTime;

    // Assert: Expected behavior (will FAIL on unfixed code)
    // On unfixed code: timeout occurs at 3000ms with fallback message
    // After fix: should complete within reasonable time (< 2000ms) without timeout

    expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    expect(result.intent).toBe('coding'); // Should get actual AI classification, not fallback
    expect(result.reasoning).not.toContain('Fallback'); // Should not use fallback logic
    expect(result.reasoning).not.toContain('timed out'); // Should not timeout

    // Verify no timeout warnings were logged
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Intent classification timed out')
    );
  });

  /**
   * Property 1: Bug Condition - Judge Evaluation Timeout
   *
   * EXPECTED OUTCOME: Test FAILS (this is correct - it proves the bug exists)
   *
   * Bug Condition: Judge evaluation times out after 10 seconds with "Judge timed out"
   * Expected Behavior: Judge evaluation should complete before mission completion within appropriate timeout
   */
  it('PROPERTY 1.2: Judge evaluation should complete within appropriate timeout limits', async () => {
    // Arrange: Mock slow AI response that exceeds 10 second timeout
    mockClient.chat.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        content: JSON.stringify({
          verdict: 'complete',
          confidence: 0.9,
          reasoning: 'Task has been completed successfully'
        })
      }), 12000)) // 12 second delay - exceeds 10 second timeout
    );

    const judgeNode = createJudgeNode(mockRunner, eventQueue);

    const state: Partial<GraphStateType> = {
      iterations: 1,
      currentIntent: 'coding',
      messages: [
        { role: 'user', content: 'Write a function' },
        { role: 'assistant', content: 'Here is your function: def hello(): print("hello")' }
      ],
      completionSignal: null // No signal from brain - judge must use AI fallback
    };

    // Act: Execute judge node
    const startTime = Date.now();
    const result = await judgeNode(state as GraphStateType);
    const duration = Date.now() - startTime;

    // Assert: Expected behavior (will FAIL on unfixed code)
    // On unfixed code: timeout occurs at 10000ms with "Judge timed out" error
    // After fix: should complete within 7000ms without timeout

    expect(duration).toBeLessThan(7000); // Should complete within 7 seconds (optimized timeout)
    expect(result.shouldContinueIteration).toBe(false); // Should complete successfully

    // Verify no timeout errors were logged
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Judge timed out')
    );

    // Verify judge made a proper decision
    expect(result.taskPhase).toBe('executing');
  });

  /**
   * Property 1: Bug Condition - Mission Completion Timing Conflict
   *
   * EXPECTED OUTCOME: Test FAILS (this is correct - it proves the bug exists)
   *
   * Bug Condition: Mission completion occurs while judge evaluation is still running
   * Expected Behavior: Judge evaluation should complete BEFORE mission completion is marked
   */
  it('PROPERTY 1.3: Judge evaluation should complete before mission completion', async () => {
    // Arrange: Mock brain node that sets completion signal
    const brainNode = createBrainNode(mockRunner, eventQueue);
    const judgeNode = createJudgeNode(mockRunner, eventQueue);

    // Mock AI client for brain completion signal
    mockClient.chat.mockImplementation((request: any) => {
      const prompt = request.messages[0].content;

      if (prompt.includes('completion signal')) {
        // Brain completion signal - should be fast
        return Promise.resolve({
          content: JSON.stringify({
            reason: 'task_complete',
            explanation: 'Task has been completed successfully'
          })
        });
      } else {
        // Judge evaluation - simulate slow response
        return new Promise(resolve => setTimeout(() => resolve({
          content: JSON.stringify({
            verdict: 'complete',
            confidence: 0.9,
            reasoning: 'Task completed'
          })
        }), 8000)); // 8 second delay
      }
    });

    const initialState: Partial<GraphStateType> = {
      iterations: 1,
      currentIntent: 'coding',
      messages: [
        { role: 'user', content: 'Write a function' },
        { role: 'assistant', content: 'Here is your function: def hello(): print("hello")' }
      ],
      pendingToolCalls: [] // No tool calls - brain will set completion signal
    };

    // Act: Execute brain node first (sets completion signal)
    const brainStartTime = Date.now();
    const brainResult = await brainNode(initialState as GraphStateType);
    const brainDuration = Date.now() - brainStartTime;

    // Then execute judge node (should use the completion signal, not AI fallback)
    const judgeStartTime = Date.now();
    const judgeResult = await judgeNode({ ...initialState, ...brainResult } as GraphStateType);
    const judgeDuration = Date.now() - judgeStartTime;

    // Assert: Expected behavior (will FAIL on unfixed code)
    // On unfixed code: judge evaluation takes too long, mission might complete before judge finishes
    // After fix: judge should complete quickly when brain provides completion signal

    expect(brainResult.completionSignal).toBeDefined(); // Brain should set completion signal
    expect(brainResult.completionSignal?.reason).toBe('task_complete');

    // Judge should complete quickly when completion signal is provided
    expect(judgeDuration).toBeLessThan(1000); // Should be fast when signal is available
    expect(judgeResult.shouldContinueIteration).toBe(false); // Should complete

    // Total time should be reasonable
    const totalTime = brainDuration + judgeDuration;
    expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds total
  });

  /**
   * Property 1: Bug Condition - Mission Tracking Events Not Displayed
   *
   * EXPECTED OUTCOME: Test FAILS (this is correct - it proves the bug exists)
   *
   * Bug Condition: Mission tracking events are commented out in chat page
   * Expected Behavior: Mission tracking events should be displayed to show system progress
   */
  it('PROPERTY 1.4: Mission tracking events should be displayed in frontend', async () => {
    // Arrange: Create mission tracker and event queue
    const missionTracker = {
      startMission: vi.fn(),
      updateStep: vi.fn(),
      changePhase: vi.fn(),
      completeMission: vi.fn(),
      getCurrentTimeline: vi.fn(() => ({
        missionId: 'test-mission',
        startTime: Date.now(),
        currentPhase: 'triage',
        steps: []
      }))
    };

    // Act: Simulate mission tracking events being generated
    missionTracker.updateStep({
      id: 'step-1',
      name: 'triage',
      status: 'running',
      startTime: Date.now()
    });

    missionTracker.changePhase('planning');

    // Check if events are pushed to event queue
    const stepUpdateEvent = eventQueue.find(e => e.type === 'mission_step_update');
    const phaseChangeEvent = eventQueue.find(e => e.type === 'mission_phase_change');

    // Assert: Expected behavior (will FAIL on unfixed code)
    // On unfixed code: mission tracking events are commented out, not displayed
    // After fix: mission tracking events should be properly generated and displayed

    expect(stepUpdateEvent).toBeDefined(); // Should have step update event
    expect(phaseChangeEvent).toBeDefined(); // Should have phase change event

    if (stepUpdateEvent) {
      expect(stepUpdateEvent.step).toBeDefined();
      expect(stepUpdateEvent.timeline).toBeDefined();
    }

    if (phaseChangeEvent) {
      expect(phaseChangeEvent.phase).toBe('planning');
      expect(phaseChangeEvent.timeline).toBeDefined();
    }
  });

  /**
   * Property 1: Bug Condition - Planning Phases Not Visible
   *
   * EXPECTED OUTCOME: Test FAILS (this is correct - it proves the bug exists)
   *
   * Bug Condition: Users cannot see planning phases, triage, or execution steps
   * Expected Behavior: Users should see planning phases, triage, and execution steps
   */
  it('PROPERTY 1.5: Planning phases and execution steps should be visible to users', async () => {
    // Arrange: Build graph with event tracking
    const graph = buildGraph(mockRunner, [], [], eventQueue, 'test-conversation');

    const initialState: Partial<GraphStateType> = {
      messages: [
        { role: 'user', content: 'Help me write a Python function' }
      ],
      iterations: 0,
      pendingToolCalls: []
    };

    // Act: Execute graph and track events
    try {
      await graph.invoke(initialState, {
        configurable: { thread_id: 'test-planning-visibility' }
      });
    } catch (error) {
      // Graph execution might fail due to mocking, but we care about events generated
    }

    // Assert: Expected behavior (will FAIL on unfixed code)
    // On unfixed code: planning phases are not visible to users
    // After fix: users should see triage, planning, and execution phases

    // Check for triage phase visibility
    const triageEvents = eventQueue.filter(e =>
      e.type === 'thought' && e.content.includes('Triage')
    );
    expect(triageEvents.length).toBeGreaterThan(0); // Should show triage progress

    // Check for planning phase visibility
    const planningEvents = eventQueue.filter(e =>
      e.type === 'thought' && (
        e.content.includes('planning') ||
        e.content.includes('Compiling execution pipeline')
      )
    );
    expect(planningEvents.length).toBeGreaterThan(0); // Should show planning progress

    // Check for execution phase visibility
    const executionEvents = eventQueue.filter(e =>
      e.type === 'thought' && (
        e.content.includes('execution') ||
        e.content.includes('Processing request')
      )
    );
    expect(executionEvents.length).toBeGreaterThan(0); // Should show execution progress

    // Check for mission phase change events
    const missionPhaseEvents = eventQueue.filter(e => e.type === 'mission_phase_change');
    expect(missionPhaseEvents.length).toBeGreaterThan(0); // Should track mission phases
  });

  /**
   * Integration Test: All Performance Issues Combined
   *
   * This test combines all the performance issues to demonstrate the cumulative impact
   */
  it('INTEGRATION: All performance issues should be resolved for optimal user experience', async () => {
    // Arrange: Mock slow responses for all components
    let intentClassificationTime = 0;
    let judgeEvaluationTime = 0;
    let missionTrackingEvents = 0;
    let planningVisibilityEvents = 0;

    mockClient.chat.mockImplementation((request: any) => {
      const prompt = request.messages[0].content;

      if (prompt.includes('Intent Classification')) {
        // Intent classification - should be fast
        const startTime = Date.now();
        return new Promise(resolve => {
          setTimeout(() => {
            intentClassificationTime = Date.now() - startTime;
            resolve({
              content: JSON.stringify({
                intent: 'coding',
                confidence: 0.8,
                reasoning: 'User wants to write code'
              })
            });
          }, 1500); // Should complete within optimized timeout
        });
      } else if (prompt.includes('completion signal')) {
        // Brain completion signal
        return Promise.resolve({
          content: JSON.stringify({
            reason: 'task_complete',
            explanation: 'Task completed'
          })
        });
      } else {
        // Judge evaluation - should be fast with completion signal
        const startTime = Date.now();
        return new Promise(resolve => {
          setTimeout(() => {
            judgeEvaluationTime = Date.now() - startTime;
            resolve({
              content: JSON.stringify({
                verdict: 'complete',
                confidence: 0.9,
                reasoning: 'Task completed'
              })
            });
          }, 500); // Should be very fast with completion signal
        });
      }
    });

    // Act: Execute full workflow
    const totalStartTime = Date.now();

    // Test intent classification
    const userInput = 'Help me write a Python function';
    const classification = await classifyIntent(userInput, mockClient, []);

    // Test judge evaluation with completion signal
    const brainNode = createBrainNode(mockRunner, eventQueue);
    const judgeNode = createJudgeNode(mockRunner, eventQueue);

    const state: Partial<GraphStateType> = {
      iterations: 1,
      currentIntent: 'coding',
      messages: [
        { role: 'user', content: userInput },
        { role: 'assistant', content: 'Here is your function' }
      ],
      pendingToolCalls: []
    };

    const brainResult = await brainNode(state as GraphStateType);
    const judgeResult = await judgeNode({ ...state, ...brainResult } as GraphStateType);

    const totalTime = Date.now() - totalStartTime;

    // Count mission tracking and planning visibility events
    missionTrackingEvents = eventQueue.filter(e =>
      e.type === 'mission_step_update' || e.type === 'mission_phase_change'
    ).length;

    planningVisibilityEvents = eventQueue.filter(e =>
      e.type === 'thought' && (
        e.content.includes('Triage') ||
        e.content.includes('planning') ||
        e.content.includes('execution')
      )
    ).length;

    // Assert: All performance issues should be resolved
    // EXPECTED OUTCOME: These assertions will FAIL on unfixed code

    // 1. Intent classification should be fast
    expect(intentClassificationTime).toBeLessThan(2000); // Optimized from 3000ms
    expect(classification.reasoning).not.toContain('timed out');

    // 2. Judge evaluation should be fast
    expect(judgeEvaluationTime).toBeLessThan(1000); // Should be very fast with completion signal

    // 3. No timing conflicts - total time should be reasonable
    expect(totalTime).toBeLessThan(4000); // Should complete within 4 seconds total

    // 4. Mission tracking events should be generated
    expect(missionTrackingEvents).toBeGreaterThan(0);

    // 5. Planning phases should be visible
    expect(planningVisibilityEvents).toBeGreaterThan(0);

    // 6. No timeout warnings
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('timed out')
    );
  });
});
