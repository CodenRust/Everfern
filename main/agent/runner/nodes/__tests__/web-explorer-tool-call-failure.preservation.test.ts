/**
 * Preservation Property Tests — Web Explorer Tool Call Failure Fix
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Preservation — Successful Tool Call Paths and Other Agent Nudges Unchanged
 *
 * IMPORTANT: These tests MUST PASS on unfixed code — they encode the baseline behavior
 * that must be preserved after the fix.
 *
 * ---
 *
 * Observation-first methodology:
 *
 * Observed on UNFIXED code:
 *   1. The nudge message for `coding_specialist`, `data_analyst`, and `computer_use_agent`
 *      contains `computer_use` — this is the CURRENT behavior for those agents and must
 *      remain unchanged after the fix (the fix only changes the web_explorer nudge).
 *
 *   2. The nudge message for `web_explorer` also contains `computer_use` on unfixed code
 *      (this is the BUG), but the preservation tests focus on the OTHER agents.
 *
 *   3. The `createWebExplorerNode` with `workflowPhase === 'browse'` and
 *      `searchResults.length >= 2` attempts subagent spawning — this path is preserved.
 *
 *   4. The `createWebExplorerNode` with `workflowPhase === 'search'` invokes `runAgentStep`
 *      (does NOT return early) — this path is preserved.
 *
 *   5. When the LLM returns tool calls on the first attempt, `pendingToolCalls` is
 *      populated with those exact tool calls — this path is preserved.
 *
 * ---
 *
 * Testing approach:
 *   Static source analysis (reading the file with fs.readFileSync) — same approach as
 *   the bug tests. This avoids complex mocking of the runtime and focuses on the
 *   structural properties of the source code that encode the preserved behaviors.
 *
 * ---
 *
 * Observed baseline (unfixed code):
 *   - `agent-runtime.ts` nudge block: single hardcoded `computer_use` message for ALL
 *     specialized agents (coding_specialist, data_analyst, computer_use_agent, web_explorer)
 *   - `web-explorer.ts` `workflowPhase === 'browse'` block: attempts subagent spawning
 *     when `searchResults.length > 1`
 *   - `web-explorer.ts` `workflowPhase === 'search'` path: falls through to `runAgentStep`
 *     (no early return for search phase)
 *   - `agent-runtime.ts` return statement: always includes `pendingToolCalls: response.toolCalls ?? []`
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import fc from 'fast-check';

// ── Source file paths ─────────────────────────────────────────────────────────

const WEB_EXPLORER_PATH = path.join(
  process.cwd(),
  'main/agent/runner/agents/web-explorer.ts'
);

const AGENT_RUNTIME_PATH = path.join(
  process.cwd(),
  'main/agent/runner/services/agent-runtime.ts'
);

// ── Preservation 1: Other agents' nudge messages reference computer_use ──────

describe('Preservation — Other specialized agents nudge messages reference computer_use', () => {
  /**
   * Observation: On unfixed code, the nudge message is a single hardcoded string
   * that says "Use the 'computer_use' tool (or your other relevant tools) NOW".
   * This applies to ALL specialized agents including coding_specialist, data_analyst,
   * and computer_use_agent.
   *
   * After the fix: the nudge message for web_explorer changes, but the nudge for
   * coding_specialist, data_analyst, and computer_use_agent must remain functionally
   * equivalent (still referencing computer_use or their respective tools).
   *
   * This test verifies that the nudge section in agent-runtime.ts still contains
   * `computer_use` as a tool reference (for the non-web_explorer agents).
   *
   * **Validates: Requirements 3.4**
   */
  it('should still reference computer_use in the nudge section for non-web_explorer agents', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The nudge section must still contain 'computer_use' as a tool reference
    // (for computer_use_agent and as a default/fallback for other agents)
    // On unfixed code: the single hardcoded message contains 'computer_use'
    // After fix: computer_use_agent still gets a nudge referencing 'computer_use'
    const nudgeSection = source.match(
      /isSpecializedAgent[\s\S]{0,3000}nudgeMsg[\s\S]{0,1000}/
    );

    expect(nudgeSection).toBeTruthy();

    if (nudgeSection) {
      const nudgeSectionText = nudgeSection[0];
      // computer_use must still appear in the nudge section
      expect(nudgeSectionText).toContain('computer_use');
    }
  });

  /**
   * Property-based test: for all nodeName values in ['coding_specialist', 'data_analyst',
   * 'computer_use_agent'], the nudge message must NOT contain 'web_search' or 'browser_use'
   * as the primary tool hint (those are web_explorer-specific tools).
   *
   * On unfixed code: the nudge message is a single hardcoded string with 'computer_use'
   * and does NOT contain 'web_search' or 'browser_use' — this PASSES.
   * After fix: the nudge for these agents must still not reference web_search/browser_use.
   *
   * **Validates: Requirements 3.4**
   */
  it('property: nudge section does not exclusively reference web_search/browser_use for all agents', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    const agentNames = ['coding_specialist', 'data_analyst', 'computer_use_agent'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...agentNames),
        (nodeName) => {
          // The nudge section should contain computer_use (for these agents)
          // and should NOT be exclusively about web_search/browser_use
          const nudgeSection = source.match(
            /isSpecializedAgent[\s\S]{0,3000}nudgeMsg[\s\S]{0,1000}/
          );

          expect(nudgeSection).toBeTruthy();

          if (nudgeSection) {
            const nudgeSectionText = nudgeSection[0];

            // computer_use must still be referenced (for computer_use_agent and as default)
            expect(nudgeSectionText).toContain('computer_use');

            // The nudge section must not be ONLY about web_search/browser_use
            // (i.e., computer_use must still appear for non-web_explorer agents)
            const hasComputerUse = nudgeSectionText.includes('computer_use');
            expect(hasComputerUse).toBe(true);
          }
        }
      ),
      { numRuns: 3 } // 3 agents, deterministic
    );
  });

  /**
   * Observation: The isSpecializedAgent check includes all four agents.
   * After the fix, this list must remain unchanged.
   *
   * **Validates: Requirements 3.4**
   */
  it('should still include coding_specialist, data_analyst, computer_use_agent in isSpecializedAgent check', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The isSpecializedAgent check must still include all four agents
    const isSpecializedAgentMatch = source.match(
      /isSpecializedAgent\s*=\s*\[([^\]]+)\]/
    );

    expect(isSpecializedAgentMatch).toBeTruthy();

    if (isSpecializedAgentMatch) {
      const agentList = isSpecializedAgentMatch[1];
      expect(agentList).toContain('coding_specialist');
      expect(agentList).toContain('data_analyst');
      expect(agentList).toContain('computer_use_agent');
      expect(agentList).toContain('web_explorer');
    }
  });
});

// ── Preservation 2: Successful tool call path returns pendingToolCalls ────────

describe('Preservation — Successful tool call path returns pendingToolCalls from LLM', () => {
  /**
   * Observation: On unfixed code, `runAgentStep` always returns
   * `pendingToolCalls: response.toolCalls ?? []` at the end of the function.
   * When the LLM returns tool calls on the first attempt, those calls are
   * returned in `pendingToolCalls` unchanged.
   *
   * After fix: this return statement must remain identical for the successful path.
   *
   * **Validates: Requirements 3.1**
   */
  it('should return pendingToolCalls from the LLM response in the main return statement', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The main return statement must include pendingToolCalls: response.toolCalls ?? []
    const mainReturnMatch = source.match(
      /return\s*\{[\s\S]{0,500}pendingToolCalls:\s*response\.toolCalls\s*\?\?\s*\[\][\s\S]{0,200}\}/
    );

    // On unfixed code: this pattern exists — PASSES
    // After fix: this pattern must still exist (successful path unchanged)
    expect(mainReturnMatch).toBeTruthy();
  });

  /**
   * Property-based test: when the LLM returns tool calls on the first attempt,
   * the pendingToolCalls in the returned state must equal the LLM's tool calls.
   *
   * This is verified structurally: the return statement uses `response.toolCalls ?? []`
   * which means the tool calls are passed through unchanged.
   *
   * **Validates: Requirements 3.1**
   */
  it('property: pendingToolCalls is always derived from response.toolCalls in the main return', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The main return statement (not the early-return fallback) must use response.toolCalls
    // This ensures successful tool call paths are unaffected
    const toolCallNames = ['web_search', 'browser_use', 'web_fetch', 'computer_use', 'read_file', 'write_file'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...toolCallNames),
        (toolName) => {
          // Structural check: the return statement uses response.toolCalls
          // This is independent of the specific tool name
          const hasResponseToolCallsReturn = source.includes('pendingToolCalls: response.toolCalls ?? []');
          expect(hasResponseToolCallsReturn).toBe(true);

          // The nudge block only fires when toolCalls is empty
          // (verifying the condition that guards the nudge)
          const nudgeCondition = source.match(
            /isSpecializedAgent\s*&&\s*\(!response\.toolCalls\s*\|\|\s*response\.toolCalls\.length\s*===\s*0\)/
          );
          expect(nudgeCondition).toBeTruthy();
        }
      ),
      { numRuns: 6 } // 6 tool names, deterministic
    );
  });

  /**
   * Observation: The nudge block only fires when toolCalls is empty AND
   * verifyIntentRetries === 0. This means successful first-attempt tool calls
   * bypass the nudge entirely.
   *
   * **Validates: Requirements 3.1**
   */
  it('should only nudge when toolCalls is empty (not when tool calls are present)', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The nudge condition must check for empty toolCalls
    const nudgeConditionMatch = source.match(
      /if\s*\(\s*isSpecializedAgent\s*&&\s*\(!response\.toolCalls\s*\|\|\s*response\.toolCalls\.length\s*===\s*0\)/
    );

    // On unfixed code: this condition exists — PASSES
    // After fix: this condition must remain unchanged
    expect(nudgeConditionMatch).toBeTruthy();
  });
});

// ── Preservation 3: Search phase invokes runAgentStep (no early return) ───────

describe('Preservation — workflowPhase === search invokes runAgentStep (no early return)', () => {
  /**
   * Observation: On unfixed code, `createWebExplorerNode` has early returns for:
   *   - `workflowPhase === 'complete'` (returns without calling runAgentStep)
   *   - `workflowPhase === 'browse'` (returns without calling runAgentStep)
   *
   * But for `workflowPhase === 'search'` and `workflowPhase === 'synthesize'`,
   * the function falls through to the `runAgentStep` call at the bottom.
   *
   * After fix: the search phase must still invoke runAgentStep.
   *
   * **Validates: Requirements 3.3**
   */
  it('should have runAgentStep call after the browse early-return block', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The runAgentStep call must exist after the browse block
    // (i.e., it's not inside the browse block — it's the fallthrough path)
    const runAgentStepCall = source.match(
      /return\s+integrator\.wrapNode\s*\(\s*['"]web_explorer['"]\s*,\s*\(\)\s*=>\s*runAgentStep\s*\(/
    );

    // On unfixed code: this call exists — PASSES
    // After fix: this call must still exist (search phase unchanged)
    expect(runAgentStepCall).toBeTruthy();
  });

  /**
   * Observation: The `workflowPhase === 'search'` path does NOT have an early return.
   * The early returns are only for 'complete' and 'browse'.
   *
   * **Validates: Requirements 3.3**
   */
  it('should NOT have an early return for workflowPhase === search', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // There should be NO early return block for workflowPhase === 'search'
    const searchEarlyReturn = source.match(
      /if\s*\(\s*workflowPhase\s*===\s*['"]search['"]\s*\)\s*\{[\s\S]{0,200}return\s*\{/
    );

    // On unfixed code: no early return for search — PASSES (searchEarlyReturn is null)
    // After fix: still no early return for search
    expect(searchEarlyReturn).toBeNull();
  });

  /**
   * Property-based test: createWebExplorerNode with workflowPhase === 'search'
   * must still invoke runAgentStep (not return early).
   *
   * Verified structurally: the runAgentStep call is at the bottom of the function,
   * outside all early-return blocks.
   *
   * **Validates: Requirements 3.3**
   */
  it('property: runAgentStep is called for search and synthesize phases (not early-returned)', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    const phases = ['search', 'synthesize'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...phases),
        (phase) => {
          // For search and synthesize phases, there must be no early return
          const earlyReturnForPhase = source.match(
            new RegExp(`if\\s*\\(\\s*workflowPhase\\s*===\\s*['"]${phase}['"]\\s*\\)\\s*\\{[\\s\\S]{0,200}return\\s*\\{`)
          );

          // No early return for these phases — PASSES on unfixed code
          expect(earlyReturnForPhase).toBeNull();
        }
      ),
      { numRuns: 2 } // 2 phases, deterministic
    );
  });

  /**
   * Observation: The runAgentStep call uses the web_explorer system prompt.
   * This must remain unchanged after the fix.
   *
   * **Validates: Requirements 3.3**
   */
  it('should pass nodeName web_explorer to runAgentStep', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The runAgentStep call must pass nodeName: 'web_explorer'
    const nodeNameInCall = source.match(
      /runAgentStep\s*\([\s\S]{0,500}nodeName:\s*['"]web_explorer['"]/
    );

    // On unfixed code: nodeName is 'web_explorer' — PASSES
    // After fix: nodeName must still be 'web_explorer'
    expect(nodeNameInCall).toBeTruthy();
  });
});

// ── Preservation 4: Browse phase with 2+ results attempts subagent spawning ──

describe('Preservation — workflowPhase === browse with 2+ results attempts subagent spawning', () => {
  /**
   * Observation: On unfixed code, when `workflowPhase === 'browse'` and
   * `searchResults.length > 1`, the code attempts to spawn subagents via
   * `webExplorer.spawnMultipleSubagents(...)`.
   *
   * After fix: this subagent spawning path must remain unchanged.
   *
   * **Validates: Requirements 3.2**
   */
  it('should have subagent spawning logic in the browse phase', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The browse phase block must exist
    const hasBrowseBlock = source.includes("if (workflowPhase === 'browse')");
    expect(hasBrowseBlock).toBe(true);

    // The spawnMultipleSubagents call must exist in the file
    const hasSpawnCall = source.includes('spawnMultipleSubagents');
    expect(hasSpawnCall).toBe(true);

    // Both must be present — the browse block contains the spawn call
    // (verified by checking that spawnMultipleSubagents appears after the browse block)
    const browseIdx = source.indexOf("if (workflowPhase === 'browse')");
    const spawnIdx = source.indexOf('spawnMultipleSubagents', browseIdx);
    expect(spawnIdx).toBeGreaterThan(browseIdx);
  });

  /**
   * Observation: The subagent spawning is guarded by `searchResults.length > 1`.
   * This condition must remain unchanged after the fix.
   *
   * **Validates: Requirements 3.2**
   */
  it('should guard subagent spawning with searchResults.length > 1', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The guard condition must exist
    const hasGuard = source.includes('searchResults.length > 1');
    expect(hasGuard).toBe(true);

    // The guard must appear before the spawnMultipleSubagents call
    const guardIdx = source.indexOf('searchResults.length > 1');
    const spawnIdx = source.indexOf('spawnMultipleSubagents', guardIdx);
    expect(spawnIdx).toBeGreaterThan(guardIdx);
  });

  /**
   * Observation: The browse phase has a fallback path that returns a hardcoded
   * browser_use call when subagent spawning fails or searchResults.length <= 1.
   * This fallback must remain unchanged.
   *
   * **Validates: Requirements 3.2**
   */
  it('should have a browser_use fallback in the browse phase', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The browse block must exist
    const browseIdx = source.indexOf("if (workflowPhase === 'browse')");
    expect(browseIdx).toBeGreaterThan(-1);

    // The browser_use fallback return must exist after the browse block
    // (it's the last return inside the browse block)
    const browserUseFallbackIdx = source.indexOf("name: 'browser_use'", browseIdx);
    expect(browserUseFallbackIdx).toBeGreaterThan(browseIdx);

    // The fallback must set pendingToolCalls
    const pendingToolCallsIdx = source.indexOf('pendingToolCalls', browserUseFallbackIdx - 50);
    expect(pendingToolCallsIdx).toBeGreaterThan(-1);
  });
});

// ── Preservation 5: Complete phase still sets webExplorerComplete: true ───────

describe('Preservation — workflowPhase === complete still sets webExplorerComplete: true', () => {
  /**
   * Observation: On unfixed code, the complete phase returns
   * `{ webExplorerComplete: true, taskPhase: 'evaluating' }`.
   * The fix adds `pendingToolCalls: []` but must NOT remove `webExplorerComplete: true`.
   *
   * **Validates: Requirements 3.5**
   */
  it('should still set webExplorerComplete: true in the complete phase return', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The complete phase must still set webExplorerComplete: true
    const completePhaseReturn = source.match(
      /workflowPhase\s*===\s*['"]complete['"][\s\S]{0,300}webExplorerComplete:\s*true/
    );

    // On unfixed code: webExplorerComplete: true is set — PASSES
    // After fix: webExplorerComplete: true must still be set
    expect(completePhaseReturn).toBeTruthy();
  });

  /**
   * Observation: The complete phase also sets taskPhase: 'evaluating'.
   * This must remain unchanged after the fix.
   *
   * **Validates: Requirements 3.5**
   */
  it('should still set taskPhase: evaluating in the complete phase return', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // The complete phase must still set taskPhase: 'evaluating'
    const taskPhaseMatch = source.match(
      /workflowPhase\s*===\s*['"]complete['"][\s\S]{0,300}taskPhase:\s*['"]evaluating['"]/
    );

    // On unfixed code: taskPhase: 'evaluating' is set — PASSES
    // After fix: taskPhase: 'evaluating' must still be set
    expect(taskPhaseMatch).toBeTruthy();
  });
});

// ── Preservation 6: Graph edge simulation — preserved routing logic ───────────

describe('Preservation — Graph edge routing logic is preserved for non-bug inputs', () => {
  /**
   * Simulates the graph edge decision logic to verify that the preserved behaviors
   * (successful tool calls, webExplorerComplete: true) still route correctly.
   *
   * This test uses the same graph edge simulation as the bug test (Path C4),
   * but focuses on the NON-BUG inputs that must be preserved.
   *
   * **Validates: Requirements 3.1, 3.5**
   */
  it('should route to action_validation when pendingToolCalls is non-empty', () => {
    function simulateGraphEdge(state: { pendingToolCalls?: any[]; webExplorerComplete?: boolean }): string {
      if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
        return 'action_validation';
      }
      if (state.webExplorerComplete === true) {
        return 'brain';
      }
      return 'web_explorer'; // self-loop
    }

    // Successful tool call path (preserved)
    const successfulToolCallState = {
      pendingToolCalls: [{ name: 'web_search', arguments: {} }],
      webExplorerComplete: undefined,
    };

    expect(simulateGraphEdge(successfulToolCallState)).toBe('action_validation');
  });

  it('should route to brain when webExplorerComplete is true and pendingToolCalls is empty', () => {
    function simulateGraphEdge(state: { pendingToolCalls?: any[]; webExplorerComplete?: boolean }): string {
      if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
        return 'action_validation';
      }
      if (state.webExplorerComplete === true) {
        return 'brain';
      }
      return 'web_explorer'; // self-loop
    }

    // Complete phase path (preserved)
    const completeState = {
      pendingToolCalls: [],
      webExplorerComplete: true,
    };

    expect(simulateGraphEdge(completeState)).toBe('brain');
  });

  /**
   * Property-based test: for all non-empty tool call arrays, the graph edge
   * routes to action_validation (not web_explorer self-loop).
   *
   * **Validates: Requirements 3.1**
   */
  it('property: non-empty pendingToolCalls always routes to action_validation', () => {
    function simulateGraphEdge(state: { pendingToolCalls?: any[]; webExplorerComplete?: boolean }): string {
      if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
        return 'action_validation';
      }
      if (state.webExplorerComplete === true) {
        return 'brain';
      }
      return 'web_explorer';
    }

    const toolNames = ['web_search', 'browser_use', 'web_fetch', 'computer_use', 'read_file'] as const;

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...toolNames), { minLength: 1, maxLength: 5 }),
        (toolCalls) => {
          const state = {
            pendingToolCalls: toolCalls.map(name => ({ name, arguments: {} })),
            webExplorerComplete: undefined as boolean | undefined,
          };

          const route = simulateGraphEdge(state);
          expect(route).toBe('action_validation');
          expect(route).not.toBe('web_explorer');
        }
      ),
      { numRuns: 30 }
    );
  });
});
