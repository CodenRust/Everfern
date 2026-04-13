/**
 * Bug Condition Exploration Tests — Fast Agent Startup
 *
 * **Validates: Requirements 1.2, 1.3, 1.4**
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 *
 * Bug: Two sequential AI calls block agent startup:
 *   1. `classifyIntentAI` in triage.ts has a 30s timeout (should be 3s)
 *   2. `isReadOnlyIntent` in planner.ts has NO timeout (observed ~100s)
 *   3. Both calls execute sequentially, stacking their latencies
 *
 * These tests use a 5s-delay mock client and assert completion within 5s.
 * On unfixed code the assertions FAIL because the functions wait much longer.
 */

import { describe, it, expect, vi } from 'vitest';
import { classifyIntentAI } from '../../triage';
import { createPlannerNode } from '../planner';
import type { GraphStateType } from '../../state';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../../task-decomposer', () => ({
  decomposeTask: vi.fn(() => ({
    id: 'test-decomposed',
    title: 'Test task',
    steps: [],
    totalSteps: 1,
    canParallelize: false,
    executionMode: 'sequential',
  })),
  getAGIHints: vi.fn(() => ''),
  generatePlanText: vi.fn(() => 'Step 1: Do the thing'),
}));

vi.mock('../../mission-integrator', () => ({
  createMissionIntegrator: vi.fn(() => ({
    startNode: vi.fn(),
    completeNode: vi.fn(),
    failNode: vi.fn(),
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a mock AIClient whose chat() resolves after `delayMs` milliseconds.
 * Simulates a slow or unresponsive AI provider.
 */
function makeSlowClient(delayMs: number) {
  return {
    chat: vi.fn(
      () =>
        new Promise<{ content: string }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                content: JSON.stringify({
                  intent: 'task',
                  confidence: 0.8,
                  reasoning: 'slow response',
                  isReadOnly: false,
                }),
              }),
            delayMs
          )
        )
    ),
    provider: 'test',
    model: 'test-model',
    apiKey: '',
    baseUrl: 'http://localhost:9999',
    setModel: vi.fn(),
  };
}

/** Minimal GraphStateType state with a non-trivial intent to avoid fast-paths */
function makeState(intent = 'unknown'): GraphStateType {
  return {
    messages: [{ role: 'user', content: 'build me a React app' } as any],
    currentIntent: intent as any,
    intentConfidence: 0,
    decomposedTask: {
      id: 'test',
      title: 'Test',
      steps: [],
      totalSteps: 1,
      canParallelize: false,
      executionMode: 'sequential',
    } as any,
    agiHints: '',
    taskPhase: 'planning' as any,
    pendingToolCalls: [],
    toolCallRecords: [],
    toolCallHistory: [],
    userConfirmation: undefined as any,
    finalResponse: '',
    pauseGeneration: false,
    iterations: 0,
    activeAgent: '',
    validationResult: undefined as any,
    shouldContinueIteration: false,
    hitlApprovalResult: undefined as any,
    missionId: 'test-mission',
    missionTimeline: null,
    missionSteps: [],
    currentStepId: 'step:planner',
  };
}

/** Minimal mock AgentRunner */
function makeMockRunner(client: ReturnType<typeof makeSlowClient>) {
  return {
    client,
    telemetry: {
      info: vi.fn(),
      warn: vi.fn(),
      action: vi.fn(),
      transition: vi.fn(),
      begin: vi.fn(),
      terminate: vi.fn(),
      updateSpinner: vi.fn(),
    },
    config: { maxIterations: 50 },
    tools: [],
    skills: [],
    _buildToolDefinitions: vi.fn(() => []),
  } as any;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration — Fast Agent Startup', () => {
  /**
   * Test 1.2: classifyIntentAI with 5s-delay client should complete within 5000ms
   *
   * On UNFIXED code: the timeout is 30000ms, so the function waits the full 30s
   * before falling back → elapsed > 5000ms → assertion FAILS (confirms bug).
   *
   * After fix: timeout reduced to 3000ms → fallback fires at ~3s → elapsed < 5000ms.
   */
  it(
    'Test 1.2: classifyIntentAI with 5s-delay client should complete within 5000ms',
    async () => {
      const slowClient = makeSlowClient(5000);

      const start = Date.now();
      const result = await classifyIntentAI(slowClient as any, 'build me a React app', []);
      const elapsed = Date.now() - start;

      // Must return a valid IntentClassification (fallback fired)
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);

      // FAILS on unfixed code — waits for the 5s mock to resolve (no early timeout)
      // After fix: 3s timeout fires first → completes in ~3s < 4000ms
      expect(elapsed).toBeLessThan(4000);
    },
    35000 // allow enough time for unfixed code to run to completion
  );

  /**
   * Test 1.3: isReadOnlyIntent (via createPlannerNode) with 5s-delay client
   * should complete within 5000ms.
   *
   * We use intent 'unknown' so the planner does NOT hit the synchronous fast-path
   * and is forced to call isReadOnlyIntent with the AI client.
   *
   * On UNFIXED code: no timeout on client.chat() → waits ~5s+ for the mock to
   * resolve (or indefinitely for a real slow provider) → elapsed > 5000ms →
   * assertion FAILS (confirms bug).
   *
   * After fix: 3000ms timeout added → fallback fires at ~3s → elapsed < 5000ms.
   */
  it(
    'Test 1.3: isReadOnlyIntent (via createPlannerNode) with 5s-delay client should complete within 5000ms',
    async () => {
      const slowClient = makeSlowClient(5000);
      const runner = makeMockRunner(slowClient);
      const plannerNode = createPlannerNode(runner);
      const state = makeState('unknown');

      const start = Date.now();
      const result = await plannerNode(state);
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.taskPhase).toBeDefined();

      // FAILS on unfixed code — no timeout, waits for the 5s mock to resolve
      // After fix: 3s timeout fires first → completes in ~3s < 4000ms
      expect(elapsed).toBeLessThan(4000);
    },
    35000
  );

  /**
   * Test 1.4: Sequential triage + planner with 5s-delay client should complete
   * within 10000ms total.
   *
   * We simulate triage by calling classifyIntentAI directly (as triage does),
   * then run the planner node. Both use the same slow client.
   *
   * On UNFIXED code: triage waits 30s + planner waits indefinitely → total >> 10s
   * → assertion FAILS (confirms stacking bug).
   *
   * After fix: triage times out at ~3s + planner times out at ~3s → total ~6s < 10s.
   */
  it(
    'Test 1.4: Sequential triage + planner with 5s-delay client should complete within 10000ms total',
    async () => {
      const slowClient = makeSlowClient(5000);
      const runner = makeMockRunner(slowClient);
      const plannerNode = createPlannerNode(runner);

      const start = Date.now();

      // Step 1: simulate triage (classifyIntentAI)
      await classifyIntentAI(slowClient as any, 'build me a React app', []);

      // Step 2: run planner with 'unknown' intent to force AI call
      const state = makeState('unknown');
      await plannerNode(state);

      const elapsed = Date.now() - start;

      // FAILS on unfixed code — triage waits 5s + planner waits 5s = ~10s total
      // After fix: both time out at ~3s each → total ~6s < 8000ms
      expect(elapsed).toBeLessThan(8000);
    },
    70000 // allow enough time for both unfixed calls to complete
  );
});
