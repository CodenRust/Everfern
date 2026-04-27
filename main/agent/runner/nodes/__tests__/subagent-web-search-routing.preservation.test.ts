/**
 * Preservation Tests — Subagent Web Search Routing
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Non-research subagent tasks are unaffected by the fix.
 * All tests MUST PASS on both unfixed and fixed code.
 *
 * Observed baseline (unfixed code):
 *   - "Click the submit button on the form" → { intent: 'task' }  (no automate pattern in fallback)
 *   - "Refactor the authentication module"  → { intent: 'task' }  (no coding pattern in fallback)
 *   - "Analyze the sales data CSV"          → { intent: 'task' }  (no analyze pattern in fallback)
 *   - "Search for the best Discord bots"    → { intent: 'research' } ✓ (already works)
 *   - "Find me the top news aggregators"    → { intent: 'research' } ✓ (already works)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyIntentFallback } from '../../triage';

describe('Preservation — Non-Research Subagent Tasks Are Unaffected', () => {
  // ── Observed baseline: tasks without matching patterns fall through to 'task' ──

  it('GUI task without explicit automate keyword returns task (baseline)', () => {
    // The fallback has no automate regex — these fall through to default 'task'
    expect(classifyIntentFallback('Click the submit button on the form').intent).toBe('task');
  });

  it('coding task without code file returns task (baseline)', () => {
    expect(classifyIntentFallback('Refactor the authentication module').intent).toBe('task');
  });

  it('data analysis task without data file returns task (baseline)', () => {
    expect(classifyIntentFallback('Analyze the sales data CSV').intent).toBe('task');
  });

  // ── Explicit web-search keywords already work and must remain working ──

  it('should classify explicit web-search task as research', () => {
    expect(classifyIntentFallback('Search for the best Discord bots').intent).toBe('research');
  });

  it('should classify "find me" task as research', () => {
    expect(classifyIntentFallback('Find me the top news aggregators').intent).toBe('research');
  });

  it('should classify "look up" task as research', () => {
    expect(classifyIntentFallback('Look up the latest AI tools').intent).toBe('research');
  });

  // ── Property-Based Tests ───────────────────────────────────────────────────

  it('Property 2a: explicit web-search keywords always classify as research', () => {
    const webArb = fc.constantFrom(
      'Search for the best Discord bots',
      'Look up the latest AI tools',
      'Find me the top news aggregators',
      'Google for open-source Telegram bots',
    );
    fc.assert(
      fc.property(webArb, (task) => {
        return classifyIntentFallback(task).intent === 'research';
      }),
      { numRuns: 10 }
    );
  });

  it('Property 2b: tasks without any matching pattern fall through to task (not research)', () => {
    // These must NOT be reclassified as research by the fix
    const nonResearchArb = fc.constantFrom(
      'Click the submit button on the form',
      'Refactor the authentication module',
      'Analyze the sales data CSV',
      'Open the settings panel',
    );
    fc.assert(
      fc.property(nonResearchArb, (task) => {
        return classifyIntentFallback(task).intent !== 'research';
      }),
      { numRuns: 10 }
    );
  });
});
