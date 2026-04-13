/**
 * Bug Condition Exploration Test — Triage Node Throws on Connection Error
 *
 * **Validates: Requirements 1.1, 1.3, 1.4**
 *
 * Property 1: Bug Condition — Triage Node Survives Connection Errors
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 *
 * Bug: createTriageNode's outer catch block unconditionally re-throws every error,
 * including connection errors (ECONNREFUSED, fetch failed, ETIMEDOUT, ENOTFOUND).
 * When a local AI provider is unreachable, the graph aborts with
 * "Graph mission aborted: fetch failed" instead of falling back gracefully.
 *
 * Root cause: classifyIntentAI has an internal try/catch, but network errors can
 * still escape to the triage node's outer catch via Promise.race or synchronous
 * throws from the HTTP layer. The outer catch unconditionally re-throws.
 *
 * Expected counterexample (unfixed code):
 *   createTriageNode(runner)(state) throws TypeError: fetch failed
 *   instead of returning { currentIntent: 'task', ... }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphStateType } from '../../state';

// ── Mock dependencies ────────────────────────────────────────────────────────

// Mock the triage module so we can control classifyIntent behavior
vi.mock('../../triage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../triage')>();
  return {
    ...actual,
    // classifyIntent is the function called by createTriageNode
    // We override it in specific tests to simulate connection errors escaping
    classifyIntent: actual.classifyIntent,
    classifyIntentFallback: actual.classifyIntentFallback,
  };
});

// Mock task-decomposer (dynamic require inside createTriageNode)
vi.mock('../../task-decomposer', () => ({
  decomposeTask: vi.fn(() => ({
    id: 'test-decomposed',
    title: 'Test task',
    steps: [],
    totalSteps: 1,
    canParallelize: false,
    executionMode: 'sequential',
  })),
  getAGIHints: vi.fn(() => 'test hints'),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

// Minimal GraphStateType state with one user message
const makeState = (): GraphStateType => ({
  messages: [
    { role: 'user', content: 'build me a React app' } as any,
  ],
  currentIntent: 'unknown' as any,
  intentConfidence: 0,
  decomposedTask: undefined as any,
  agiHints: '',
  taskPhase: 'triage' as any,
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
  currentStepId: 'step:triage',
});

/**
 * Creates a mock AgentRunner where client.chat rejects with the given error.
 * This simulates an unreachable local AI provider (Ollama, LM Studio, EverFern).
 */
const makeMockRunner = (chatError: Error) => ({
  client: {
    chat: vi.fn().mockRejectedValue(chatError),
    provider: 'ollama',
    model: 'llama3',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    setModel: vi.fn(),
  },
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
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration — Triage Node Throws on Connection Error', () => {
  /**
   * Test Case 1: fetch failed
   *
   * Simulates: classifyIntentAI throws TypeError('fetch failed') which escapes
   * to the triage node's outer catch block.
   *
   * On UNFIXED code: the outer catch re-throws → test fails with TypeError
   * Expected (after fix): node returns { currentIntent: 'task', ... } without throwing
   *
   * Counterexample: TypeError: fetch failed
   */
  it('should NOT throw when classifyIntent rejects with TypeError("fetch failed")', async () => {
    // Import createTriageNode and override classifyIntent to throw directly
    const triageModule = await import('../../triage');
    const { createTriageNode } = await import('../triage');

    // Spy on classifyIntent to simulate the error escaping its internal try/catch
    const spy = vi.spyOn(triageModule, 'classifyIntent').mockRejectedValueOnce(
      new TypeError('fetch failed')
    );

    const runner = makeMockRunner(new TypeError('fetch failed')) as any;
    const triageNode = createTriageNode(runner);
    const state = makeState();

    // On unfixed code: outer catch re-throws → this throws TypeError: fetch failed
    // Expected (after fix): returns valid state partial
    const result = await triageNode(state);

    spy.mockRestore();

    expect(result).toBeDefined();
    expect(result.currentIntent).toBeDefined();
    const validIntents = ['task', 'coding', 'research', 'fix', 'analyze', 'automate', 'question', 'conversation', 'build', 'unknown'];
    expect(validIntents).toContain(result.currentIntent);
  });

  /**
   * Test Case 2: ECONNREFUSED
   *
   * On UNFIXED code: outer catch re-throws → test fails with ECONNREFUSED error
   * Expected (after fix): node returns valid state partial without throwing
   *
   * Counterexample: Error: connect ECONNREFUSED 127.0.0.1:11434
   */
  it('should NOT throw when classifyIntent rejects with ECONNREFUSED error', async () => {
    const triageModule = await import('../../triage');
    const { createTriageNode } = await import('../triage');

    const spy = vi.spyOn(triageModule, 'classifyIntent').mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 127.0.0.1:11434')
    );

    const runner = makeMockRunner(new Error('connect ECONNREFUSED 127.0.0.1:11434')) as any;
    const triageNode = createTriageNode(runner);
    const state = makeState();

    const result = await triageNode(state);

    spy.mockRestore();

    expect(result).toBeDefined();
    expect(result.currentIntent).toBeDefined();
    const validIntents = ['task', 'coding', 'research', 'fix', 'analyze', 'automate', 'question', 'conversation', 'build', 'unknown'];
    expect(validIntents).toContain(result.currentIntent);
  });

  /**
   * Test Case 3: ETIMEDOUT
   *
   * On UNFIXED code: outer catch re-throws → test fails with ETIMEDOUT error
   * Expected (after fix): node returns valid state partial without throwing
   *
   * Counterexample: Error: ETIMEDOUT
   */
  it('should NOT throw when classifyIntent rejects with ETIMEDOUT error', async () => {
    const triageModule = await import('../../triage');
    const { createTriageNode } = await import('../triage');

    const spy = vi.spyOn(triageModule, 'classifyIntent').mockRejectedValueOnce(
      new Error('ETIMEDOUT')
    );

    const runner = makeMockRunner(new Error('ETIMEDOUT')) as any;
    const triageNode = createTriageNode(runner);
    const state = makeState();

    const result = await triageNode(state);

    spy.mockRestore();

    expect(result).toBeDefined();
    expect(result.currentIntent).toBeDefined();
    const validIntents = ['task', 'coding', 'research', 'fix', 'analyze', 'automate', 'question', 'conversation', 'build', 'unknown'];
    expect(validIntents).toContain(result.currentIntent);
  });

  /**
   * Test Case 4: ENOTFOUND
   *
   * On UNFIXED code: outer catch re-throws → test fails with ENOTFOUND error
   * Expected (after fix): node returns valid state partial without throwing
   *
   * Counterexample: Error: getaddrinfo ENOTFOUND localhost
   */
  it('should NOT throw when classifyIntent rejects with ENOTFOUND error', async () => {
    const triageModule = await import('../../triage');
    const { createTriageNode } = await import('../triage');

    const spy = vi.spyOn(triageModule, 'classifyIntent').mockRejectedValueOnce(
      new Error('getaddrinfo ENOTFOUND localhost')
    );

    const runner = makeMockRunner(new Error('getaddrinfo ENOTFOUND localhost')) as any;
    const triageNode = createTriageNode(runner);
    const state = makeState();

    const result = await triageNode(state);

    spy.mockRestore();

    expect(result).toBeDefined();
    expect(result.currentIntent).toBeDefined();
    const validIntents = ['task', 'coding', 'research', 'fix', 'analyze', 'automate', 'question', 'conversation', 'build', 'unknown'];
    expect(validIntents).toContain(result.currentIntent);
  });

  /**
   * Test Case 5: Fallback classification used (not AI)
   *
   * On UNFIXED code: throws before returning — this assertion is never reached
   * Expected (after fix): classifyIntentFallback is used, intentConfidence > 0
   */
  it('should use fallback classification when connection error occurs', async () => {
    const triageModule = await import('../../triage');
    const { createTriageNode } = await import('../triage');

    const spy = vi.spyOn(triageModule, 'classifyIntent').mockRejectedValueOnce(
      new TypeError('fetch failed')
    );

    const runner = makeMockRunner(new TypeError('fetch failed')) as any;
    const triageNode = createTriageNode(runner);
    const state = makeState();

    const result = await triageNode(state);

    spy.mockRestore();

    // Fallback classification must produce a valid confidence score
    expect(result.intentConfidence).toBeGreaterThan(0);
    expect(result.intentConfidence).toBeLessThanOrEqual(1);
  });

  /**
   * Test Case 6: Direct demonstration of the bug
   *
   * This test directly verifies the outer catch re-throws behavior.
   * On UNFIXED code: the outer catch block calls `throw error` unconditionally.
   * Expected (after fix): connection errors are caught and handled gracefully.
   */
  it('should demonstrate bug: outer catch re-throws connection errors on unfixed code', async () => {
    const triageModule = await import('../../triage');
    const { createTriageNode } = await import('../triage');

    const connectionError = new TypeError('fetch failed');
    const spy = vi.spyOn(triageModule, 'classifyIntent').mockRejectedValueOnce(connectionError);

    const runner = makeMockRunner(connectionError) as any;
    const triageNode = createTriageNode(runner);
    const state = makeState();

    // On unfixed code: this rejects with TypeError: fetch failed
    // On fixed code: this resolves with a valid state partial
    let threw = false;
    let result: any;
    try {
      result = await triageNode(state);
    } catch (err) {
      threw = true;
    }

    spy.mockRestore();

    // On unfixed code: threw === true (confirms the bug)
    // On fixed code: threw === false, result.currentIntent is defined
    expect(threw).toBe(false); // FAILS on unfixed code — confirms the bug
    expect(result?.currentIntent).toBeDefined();
  });
});
