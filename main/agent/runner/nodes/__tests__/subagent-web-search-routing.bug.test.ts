/**
 * Bug Condition Exploration Test — Subagent Web Search Routing Misclassification
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Subagent Research Tasks Misroute to computer_use_agent
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 *
 * Bug: classifyIntentFallback() does not recognise list-compilation, "top N",
 * "find the best", or "compare" patterns as `research`. These task strings fall
 * through to the default `task` intent, causing the subagent brain to route to
 * `computer_use_agent` instead of `web_explorer`.
 *
 * Root cause: The research detection regex in classifyIntentFallback() is missing
 * patterns for "compile.*list", "top \d+", "find the best", "compare", and
 * "comprehensive list". Without these patterns, subagent task strings that describe
 * list-compilation or comparison are classified as `task` instead of `research`.
 *
 * Expected counterexamples (unfixed code):
 *   classifyIntentFallback("Compile a comprehensive list of the top 5-7 news Discord bots")
 *     returns { intent: 'task' } instead of { intent: 'research' }
 *   classifyIntentFallback("Find the top 3 AI coding assistants")
 *     returns { intent: 'task' } instead of { intent: 'research' }
 *   classifyIntentFallback("Find the best open-source Telegram bots for news aggregation")
 *     returns { intent: 'automate' } or { intent: 'task' } instead of { intent: 'research' }
 *   classifyIntentFallback("Compare the top 3 AI coding assistants")
 *     returns { intent: 'task' } instead of { intent: 'research' }
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyIntentFallback } from '../../triage';

// ── Unit Tests ───────────────────────────────────────────────────────────────

describe('Bug Condition Exploration — Subagent Web Search Routing Misclassification', () => {
  /**
   * Test Case 1: "compile a list" pattern
   *
   * On UNFIXED code: returns { intent: 'task' } — FAILS
   * Expected (after fix): returns { intent: 'research' }
   *
   * Counterexample: classifyIntentFallback("Compile a comprehensive list of the top 5-7 news Discord bots")
   *   returns { intent: 'task' } instead of { intent: 'research' }
   */
  it('should classify "Compile a comprehensive list of the top 5-7 news Discord bots" as research', () => {
    const result = classifyIntentFallback('Compile a comprehensive list of the top 5-7 news Discord bots');
    expect(result.intent).toBe('research');
  });

  /**
   * Test Case 2: "top N" pattern
   *
   * On UNFIXED code: returns { intent: 'task' } — FAILS
   * Expected (after fix): returns { intent: 'research' }
   *
   * Counterexample: classifyIntentFallback("Find the top 3 AI coding assistants")
   *   returns { intent: 'task' } instead of { intent: 'research' }
   */
  it('should classify "Find the top 3 AI coding assistants" as research', () => {
    const result = classifyIntentFallback('Find the top 3 AI coding assistants');
    expect(result.intent).toBe('research');
  });

  /**
   * Test Case 3: "find the best" pattern
   *
   * On UNFIXED code: returns { intent: 'automate' } or { intent: 'task' } — FAILS
   * Expected (after fix): returns { intent: 'research' }
   *
   * Counterexample: classifyIntentFallback("Find the best open-source Telegram bots for news aggregation")
   *   returns { intent: 'automate' } or { intent: 'task' } instead of { intent: 'research' }
   */
  it('should classify "Find the best open-source Telegram bots for news aggregation" as research', () => {
    const result = classifyIntentFallback('Find the best open-source Telegram bots for news aggregation');
    expect(result.intent).toBe('research');
  });

  /**
   * Test Case 4: "compare" pattern
   *
   * On UNFIXED code: returns { intent: 'task' } — FAILS
   * Expected (after fix): returns { intent: 'research' }
   *
   * Counterexample: classifyIntentFallback("Compare the top 3 AI coding assistants")
   *   returns { intent: 'task' } instead of { intent: 'research' }
   */
  it('should classify "Compare the top 3 AI coding assistants" as research', () => {
    const result = classifyIntentFallback('Compare the top 3 AI coding assistants');
    expect(result.intent).toBe('research');
  });

  // ── Property-Based Test ────────────────────────────────────────────────────

  /**
   * Property 1: Bug Condition — List-compilation / "top N" / "find the best" / "compare"
   * patterns without explicit web-search keywords SHALL be classified as `research`.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * On UNFIXED code: this property FAILS because classifyIntentFallback returns
   * `task` for these patterns instead of `research`.
   */
  it('Property 1: all task strings matching list-compilation patterns should be classified as research', () => {
    // Generators for each bug-condition pattern
    const bugConditionArb = fc.oneof(
      fc.constantFrom(
        'Compile a comprehensive list of the top 5 Discord bots',
        'compile a list of popular Telegram bots',
      ),
      fc.tuple(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom('Discord bots', 'AI tools', 'news aggregators')
      ).map(([n, subject]) => `Find the top ${n} ${subject}`),
      fc.constantFrom(
        'Find the best open-source Telegram bots for news aggregation',
        'Compare the top 3 AI coding assistants',
      ),
    );

    fc.assert(
      fc.property(bugConditionArb, (taskString) => {
        const result = classifyIntentFallback(taskString);
        return result.intent === 'research';
      }),
      { numRuns: 20 }
    );
  });
});
