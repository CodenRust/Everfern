/**
 * Fix-Checking Tests — Fast Agent Startup
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * These tests verify that the three fixes work correctly:
 *   Fix 1: classifyIntentAI timeout reduced from 30s → 3s
 *   Fix 2: isReadOnlyIntent has a 3s timeout guard
 *   Fix 3: createPlannerNode has a synchronous fast-path for unambiguous intents
 *
 * All tests MUST PASS on fixed code.
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

/** Minimal GraphStateType state */
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

// ── Fix-Checking Tests ───────────────────────────────────────────────────────

describe('Fix-Checking Tests — Fast Agent Startup', () => {
  /**
   * Test 5.2: classifyIntentAI with 5s-delay client completes within 4000ms
   *
   * Fix 1 reduced the timeout from 30s to 3s.
   * The 3s timeout fires before the 5s mock resolves → fallback fires → returns valid IntentClassification.
   */
  it(
    'Test 5.2: classifyIntentAI with 5s-delay client completes within 4000ms and returns valid IntentClassification',
    async () => {
      const slowClient = makeSlowClient(5000);

      const start = Date.now();
      const result = await classifyIntentAI(slowClient as any, 'build me a React app', []);
      const elapsed = Date.now() - start;

      // Fallback must have fired — result is a valid IntentClassification
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(typeof result.intent).toBe('string');
      expect(result.confidence).toBeGreaterThan(0);
      expect(typeof result.reasoning).toBe('string');

      // Fix 1: 3s timeout fires before 5s mock → completes in ~3s < 4000ms
      expect(elapsed).toBeLessThan(4000);
    },
    10000
  );

  /**
   * Test 5.3: isReadOnlyIntent (via createPlannerNode with 'unknown' intent)
   * with 5s-delay client completes within 4000ms.
   *
   * Fix 2 added a 3s timeout to isReadOnlyIntent's client.chat() call.
   * 'unknown' intent bypasses the fast-path and calls isReadOnlyIntent with AI.
   * The 3s timeout fires before the 5s mock resolves → fallback returns boolean.
   */
  it(
    'Test 5.3: isReadOnlyIntent (via createPlannerNode with unknown intent) with 5s-delay client completes within 4000ms',
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

      // Fix 2: 3s timeout fires before 5s mock → completes in ~3s < 4000ms
      expect(elapsed).toBeLessThan(4000);
    },
    10000
  );

  /**
   * Test 5.4: createPlannerNode with 'conversation' intent completes synchronously
   * (no AI call, fast-path taken) — should complete in < 100ms even with slow client.
   *
   * Fix 3 added a synchronous fast-path: isReadOnlyTask('conversation') returns true
   * immediately, skipping the AI call entirely.
   */
  it(
    'Test 5.4: createPlannerNode with conversation intent completes in < 100ms (fast-path, no AI call)',
    async () => {
      const slowClient = makeSlowClient(5000); // 5s delay — proves AI is NOT called
      const runner = makeMockRunner(slowClient);
      const plannerNode = createPlannerNode(runner);
      const state = makeState('conversation');

      const start = Date.now();
      const result = await plannerNode(state);
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.taskPhase).toBe('executing');

      // Fast-path taken: no AI call → completes synchronously in < 100ms
      expect(elapsed).toBeLessThan(100);

      // Verify the slow client was NOT called
      expect(slowClient.chat).not.toHaveBeenCalled();
    },
    5000
  );

  /**
   * Test 5.5: createPlannerNode with 'coding' intent completes synchronously
   * (no AI call, fast-path taken) — should complete in < 100ms even with slow client.
   *
   * Fix 3: 'coding' is in NON_READONLY_INTENTS set → fast-path skips AI call.
   */
  it(
    'Test 5.5: createPlannerNode with coding intent completes in < 100ms (fast-path, no AI call)',
    async () => {
      const slowClient = makeSlowClient(5000); // 5s delay — proves AI is NOT called
      const runner = makeMockRunner(slowClient);
      const plannerNode = createPlannerNode(runner);
      const state = makeState('coding');

      const start = Date.now();
      const result = await plannerNode(state);
      const elapsed = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.taskPhase).toBe('executing');

      // Fast-path taken: no AI call → completes synchronously in < 100ms
      expect(elapsed).toBeLessThan(100);

      // Verify the slow client was NOT called
      expect(slowClient.chat).not.toHaveBeenCalled();
    },
    5000
  );

  /**
   * Test 5.6: Full triage + planner pipeline with 5s-delay client completes within 8000ms total.
   *
   * Both classifyIntentAI (Fix 1: 3s timeout) and isReadOnlyIntent (Fix 2: 3s timeout)
   * time out at ~3s each → total ~6s < 8000ms.
   * We use 'unknown' intent to force the AI call in the planner.
   */
  it(
    'Test 5.6: Full triage + planner pipeline with 5s-delay client completes within 8000ms total',
    async () => {
      const slowClient = makeSlowClient(5000);
      const runner = makeMockRunner(slowClient);
      const plannerNode = createPlannerNode(runner);

      const start = Date.now();

      // Step 1: triage (classifyIntentAI) — Fix 1 ensures this times out at ~3s
      const triageResult = await classifyIntentAI(slowClient as any, 'build me a React app', []);

      // Step 2: planner with 'unknown' intent — Fix 2 ensures this times out at ~3s
      const state = makeState('unknown');
      const plannerResult = await plannerNode(state);

      const elapsed = Date.now() - start;

      expect(triageResult).toBeDefined();
      expect(triageResult.intent).toBeDefined();
      expect(plannerResult).toBeDefined();
      expect(plannerResult.taskPhase).toBeDefined();

      // Both fixes: ~3s + ~3s = ~6s total < 8000ms
      expect(elapsed).toBeLessThan(8000);
    },
    20000
  );
});
