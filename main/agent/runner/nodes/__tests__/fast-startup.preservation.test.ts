/**
 * Preservation Tests — Fast Agent Startup
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * These tests verify that non-buggy inputs (fast AI provider, cache hits,
 * short affirmatives, no-client fallback) are unaffected by the fixes.
 *
 * All tests MUST PASS on fixed code.
 */

import { describe, it, expect, vi } from 'vitest';
import { classifyIntentAI, classifyIntent, classifyIntentFallback } from '../../triage';
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
 * Creates a fast mock client that resolves after `delayMs` (default 100ms).
 * Simulates a reachable AI provider — NOT a bug condition.
 */
function makeFastClient(
  delayMs = 100,
  intentResponse = { intent: 'coding', confidence: 0.8, reasoning: 'AI result' }
) {
  return {
    chat: vi.fn(
      () =>
        new Promise<{ content: string }>((resolve) =>
          setTimeout(
            () => resolve({ content: JSON.stringify(intentResponse) }),
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

/**
 * Creates a fast mock client for isReadOnlyIntent tests.
 */
function makeFastReadOnlyClient(
  delayMs = 100,
  readOnlyResponse = { isReadOnly: false, confidence: 0.9, reasoning: 'AI result' }
) {
  return makeFastClient(delayMs, readOnlyResponse as any);
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
function makeMockRunner(client: ReturnType<typeof makeFastClient> | null) {
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

// Counter to generate unique messages (bypasses the intent cache)
let msgCounter = 0;
const uniqueMessage = (base = 'build me a React app') => `${base} ${++msgCounter}`;

// ── Preservation Tests ───────────────────────────────────────────────────────

describe('Preservation Tests — Fast Agent Startup', () => {
  /**
   * Test 6.2: classifyIntentAI with a fast mock client (<1s, 100ms delay)
   * returns the AI result (not fallback).
   *
   * The mock returns { intent: 'coding', confidence: 0.8, reasoning: 'AI result' }.
   * The fallback would return confidence 0.4 (task intent) or 0.6 (conversation).
   * We verify confidence is 0.8 (AI result), not the fallback's lower value.
   */
  it(
    'Test 6.2: classifyIntentAI with fast client (100ms) returns AI result, not fallback — confidence should be 0.8',
    async () => {
      const fastClient = makeFastClient(100, { intent: 'coding', confidence: 0.8, reasoning: 'AI result' });

      const result = await classifyIntentAI(fastClient as any, uniqueMessage('build me a React app'), []);

      // AI result must be returned (not fallback)
      expect(result.intent).toBe('coding');
      expect(result.confidence).toBe(0.8);
      expect(result.reasoning).toBe('AI result');

      // Verify the client was actually called (AI path taken)
      expect(fastClient.chat).toHaveBeenCalledTimes(1);
    },
    5000
  );

  /**
   * Test 6.3: classifyIntent cache hit still bypasses AI call and returns cached result.
   *
   * Call once to populate cache, then call again with the same input.
   * The client.chat should only be called once total (second call hits cache).
   */
  it(
    'Test 6.3: classifyIntent cache hit bypasses AI call — client.chat called only once for two identical calls',
    async () => {
      const fastClient = makeFastClient(100, { intent: 'coding', confidence: 0.8, reasoning: 'AI result' });

      // Use a fixed message (not unique) so both calls share the same cache key
      const fixedMessage = `cache-test-message-${Date.now()}`;

      // First call — populates cache
      const result1 = await classifyIntent(fixedMessage, fastClient as any, []);
      expect(result1.intent).toBe('coding');
      expect(result1.confidence).toBe(0.8);

      // Second call — should hit cache, not call AI again
      const result2 = await classifyIntent(fixedMessage, fastClient as any, []);
      expect(result2.intent).toBe('coding');
      expect(result2.confidence).toBe(0.8);

      // client.chat must have been called only once (cache hit on second call)
      expect(fastClient.chat).toHaveBeenCalledTimes(1);
    },
    5000
  );

  /**
   * Test 6.4: Short affirmative input "yes" with conversation history containing
   * a previous 'coding' intent (via a .ts file attachment) still inherits 'coding'
   * without AI call.
   *
   * Context inheritance: "yes" is a short affirmative → extractPreviousIntent checks
   * the last user message. A .ts file attachment returns 'coding' directly (no AI).
   */
  it(
    'Test 6.4: short affirmative "yes" with .ts file attachment history inherits coding intent without AI call',
    async () => {
      const fastClient = makeFastClient(100, { intent: 'coding', confidence: 0.8, reasoning: 'AI result' });

      // History with a previous message that has a .ts file attachment
      // extractPreviousIntent returns 'coding' for .ts files without AI
      const history = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'please review this file' },
            { type: 'file', name: 'utils.ts', path: '/src/utils.ts' },
          ],
        },
        { role: 'assistant', content: 'Sure! Here is my review...' },
      ];

      const result = await classifyIntent('yes', fastClient as any, history);

      // Should inherit 'coding' from the .ts file attachment via context inheritance
      expect(result.intent).toBe('coding');
      // Context inheritance path — AI should NOT be called
      expect(fastClient.chat).not.toHaveBeenCalled();
    },
    5000
  );

  /**
   * Test 6.5: classifyIntent with no AI client (undefined) still calls
   * classifyIntentFallback directly and returns a valid result.
   *
   * When no client is provided, the function must fall back gracefully.
   */
  it(
    'Test 6.5: classifyIntent with no AI client (undefined) returns a valid fallback result',
    async () => {
      const result = await classifyIntent(uniqueMessage('build me a React app'), undefined, []);

      // Must return a valid IntentClassification
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(typeof result.intent).toBe('string');
      expect(result.confidence).toBeGreaterThan(0);
      expect(typeof result.reasoning).toBe('string');

      // Fallback result for a long message defaults to 'task' with confidence 0.4
      // (or 'conversation' for short messages)
      const validFallbackIntents = ['task', 'conversation', 'coding', 'fix', 'build', 'research', 'analyze', 'automate', 'question'];
      expect(validFallbackIntents).toContain(result.intent);
    },
    5000
  );

  /**
   * Test 6.6: isReadOnlyIntent (via createPlannerNode with 'unknown' intent)
   * with a fast mock client (<1s) returns the AI result — the planner uses AI result,
   * not the heuristic fallback.
   *
   * The mock returns { isReadOnly: false, confidence: 0.9, reasoning: 'AI result' }.
   * 'unknown' is not in NON_READONLY_INTENTS and not in isReadOnlyTask → AI is called.
   * AI returns isReadOnly: false with confidence 0.9 > 0.7 → planner proceeds with plan.
   */
  it(
    'Test 6.6: isReadOnlyIntent with fast client (100ms) returns AI result — planner uses AI result not heuristic',
    async () => {
      const fastClient = makeFastReadOnlyClient(100, { isReadOnly: false, confidence: 0.9, reasoning: 'AI result' });
      const runner = makeMockRunner(fastClient);
      const plannerNode = createPlannerNode(runner);
      const state = makeState('unknown');

      const result = await plannerNode(state);

      // AI returned isReadOnly: false with confidence 0.9 > 0.7 → non-read-only path
      // Planner should proceed to compile execution pipeline (not skip it)
      expect(result).toBeDefined();
      expect(result.taskPhase).toBe('executing');

      // The AI client must have been called (AI path taken for 'unknown' intent)
      expect(fastClient.chat).toHaveBeenCalledTimes(1);
    },
    5000
  );

  /**
   * Test 6.7: isReadOnlyIntent with no client (via createPlannerNode with no client,
   * 'unknown' intent) still returns heuristic fallback.
   *
   * 'unknown' is not 'conversation' or 'question' → heuristic returns false (non-read-only).
   * Planner should proceed with the execution pipeline.
   */
  it(
    'Test 6.7: isReadOnlyIntent with no client and unknown intent returns heuristic fallback (false = non-read-only)',
    async () => {
      const runner = makeMockRunner(null); // no client
      const plannerNode = createPlannerNode(runner);
      const state = makeState('unknown');

      const result = await plannerNode(state);

      // Heuristic: 'unknown' is not 'conversation' or 'question' → isReadOnly = false
      // Planner should proceed with execution pipeline (non-read-only path)
      expect(result).toBeDefined();
      expect(result.taskPhase).toBe('executing');
    },
    5000
  );
});
