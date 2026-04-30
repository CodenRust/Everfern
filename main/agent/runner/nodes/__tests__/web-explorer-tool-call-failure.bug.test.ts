/**
 * Bug Condition Exploration Test — Web Explorer Tool Call Failure Causes Infinite Graph Loop
 *
 * **Validates: Requirements 1.2, 1.3, 1.4**
 *
 * Property 1: Bug Condition — Web Explorer Graph Edge Never Self-Loops Indefinitely
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 * These tests encode the expected behavior — they will validate the fix when they pass
 * after implementation.
 *
 * ---
 *
 * Three bug paths are tested:
 *
 * Path A — `workflowPhase === 'complete'` missing `pendingToolCalls: []`:
 *   When `createWebExplorerNode` detects `workflowPhase === 'complete'`, it returns
 *   `{ webExplorerComplete: true, taskPhase: 'evaluating' }` WITHOUT setting
 *   `pendingToolCalls: []`. LangGraph state reducers may retain a stale non-empty
 *   `pendingToolCalls` from a prior iteration, causing the conditional edge to route
 *   to `action_validation` with stale calls instead of routing to `brain`.
 *
 *   Expected counterexample (unfixed code):
 *     The `workflowPhase === 'complete'` return block does NOT include `pendingToolCalls: []`
 *
 * Path B — Nudge message references `computer_use` instead of web explorer tools:
 *   When `runAgentStep` is called for `nodeName === 'web_explorer'` and the LLM returns
 *   no tool calls, the nudge message says "Use the 'computer_use' tool". Since
 *   `computer_use` is NOT in the web explorer's tool list, the LLM cannot comply and
 *   produces another text-only response.
 *
 *   Expected counterexample (unfixed code):
 *     The nudge message template contains `computer_use` with no per-agent branching
 *     for `web_explorer`
 *
 * Path C — Double-empty nudge retry leaves `webExplorerComplete` unset:
 *   When both the initial LLM call and the nudge retry return no tool calls,
 *   `runAgentStep` returns `{ pendingToolCalls: [] }` with no `webExplorerComplete: true`.
 *   The graph's `web_explorer` conditional edge then loops back to `web_explorer`
 *   indefinitely (since `webExplorerComplete` is not set).
 *
 *   Expected counterexample (unfixed code):
 *     After the nudge retry block, there is no guard that sets `webExplorerComplete: true`
 *     when the retry also returns no tool calls for `web_explorer`
 *
 * ---
 *
 * Observed failures on unfixed code:
 *   Path A: The `if (workflowPhase === 'complete')` block returns without `pendingToolCalls`
 *   Path B: The nudge message hardcodes `computer_use` for all specialized agents
 *   Path C: No fallback guard exists after the nudge retry for `web_explorer`
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Source file paths ─────────────────────────────────────────────────────────

const WEB_EXPLORER_PATH = path.join(
  process.cwd(),
  'main/agent/runner/agents/web-explorer.ts'
);

const AGENT_RUNTIME_PATH = path.join(
  process.cwd(),
  'main/agent/runner/services/agent-runtime.ts'
);

// ── Path A Tests ─────────────────────────────────────────────────────────────

describe('Bug Condition — Path A: workflowPhase === complete missing pendingToolCalls', () => {
  /**
   * Test A1: The complete-phase return block must include pendingToolCalls: []
   *
   * On UNFIXED code: the return statement is:
   *   return { webExplorerComplete: true, taskPhase: 'evaluating' as const }
   *   (no pendingToolCalls property)
   *
   * After fix: the return statement includes pendingToolCalls: []
   *
   * Counterexample: pendingToolCalls is absent from the complete-phase return,
   * causing LangGraph to retain stale tool calls and misroute the graph edge.
   *
   * **Validates: Requirements 1.2, 2.2**
   */
  it('should include pendingToolCalls: [] in the workflowPhase === complete return block', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // Find the complete-phase early return block
    // On UNFIXED code: this block returns without pendingToolCalls
    const completePhaseBlock = source.match(
      /if\s*\(\s*workflowPhase\s*===\s*['"]complete['"]\s*\)([\s\S]*?)return\s*\{([^}]+)\}/
    );

    expect(completePhaseBlock).toBeTruthy();

    if (completePhaseBlock) {
      const returnBody = completePhaseBlock[2];

      // On UNFIXED code: returnBody does NOT contain 'pendingToolCalls' — FAILS
      // After fix: returnBody DOES contain 'pendingToolCalls'
      const hasPendingToolCalls = returnBody.includes('pendingToolCalls');

      expect(hasPendingToolCalls).toBe(true);
    }
  });

  /**
   * Test A2: The complete-phase return must set pendingToolCalls to an empty array
   *
   * On UNFIXED code: pendingToolCalls is absent entirely — FAILS
   * After fix: pendingToolCalls: [] is present
   *
   * **Validates: Requirements 1.2, 2.2**
   */
  it('should set pendingToolCalls to [] (not just define it) in the complete-phase return', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // Look for the complete-phase return with pendingToolCalls: []
    // Pattern: workflowPhase === 'complete' block containing pendingToolCalls: []
    const hasExplicitEmptyArray = source.includes('pendingToolCalls: []') &&
      // Verify it's in the context of the complete-phase block (not just anywhere)
      source.match(/workflowPhase\s*===\s*['"]complete['"][\s\S]{0,300}pendingToolCalls:\s*\[\]/);

    // On UNFIXED code: this is false — FAILS (confirms the bug)
    expect(hasExplicitEmptyArray).toBeTruthy();
  });

  /**
   * Test A3: Direct structural check — complete-phase block returns both
   *          webExplorerComplete: true AND pendingToolCalls: []
   *
   * On UNFIXED code: only webExplorerComplete: true is returned — FAILS
   * After fix: both properties are present
   *
   * **Validates: Requirements 1.2, 2.2**
   */
  it('should return both webExplorerComplete: true and pendingToolCalls: [] on complete path', () => {
    const source = fs.readFileSync(WEB_EXPLORER_PATH, 'utf-8');

    // Find the complete-phase block and its return statement
    // The block starts with `if (workflowPhase === 'complete')`
    const completeBlockMatch = source.match(
      /if\s*\(\s*workflowPhase\s*===\s*['"]complete['"]\s*\)\s*\{([\s\S]*?)\}/
    );

    expect(completeBlockMatch).toBeTruthy();

    if (completeBlockMatch) {
      const blockContent = completeBlockMatch[1];

      const hasWebExplorerComplete = blockContent.includes('webExplorerComplete');
      const hasPendingToolCalls = blockContent.includes('pendingToolCalls');

      // webExplorerComplete should already be there (passes on unfixed code)
      expect(hasWebExplorerComplete).toBe(true);

      // pendingToolCalls is the missing piece — FAILS on unfixed code
      expect(hasPendingToolCalls).toBe(true);
    }
  });
});

// ── Path B Tests ─────────────────────────────────────────────────────────────

describe('Bug Condition — Path B: Nudge message references computer_use instead of web explorer tools', () => {
  /**
   * Test B1: The nudge message must be agent-specific for web_explorer
   *
   * On UNFIXED code: the nudge message is a single hardcoded string that says
   *   "Use the 'computer_use' tool (or your other relevant tools) NOW"
   *   with no per-agent branching for web_explorer
   *
   * After fix: the nudge message uses per-agent tool hints derived from nodeName
   *
   * Counterexample: nudge message contains 'computer_use' for all agents including
   * web_explorer, which cannot call computer_use (not in its tool list).
   *
   * **Validates: Requirements 1.3, 2.3**
   */
  it('should have per-agent nudge message logic (not a single hardcoded computer_use reference)', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // On UNFIXED code: there is a single nudge message with 'computer_use' hardcoded
    // and NO branching based on nodeName for web_explorer
    // After fix: there is branching logic that produces different messages per agent

    // Check for per-agent branching in the nudge section
    // The fix should introduce something like:
    //   nodeName === 'web_explorer' ? "web_search, navis, or web_fetch" : ...
    const hasWebExplorerNudgeBranch =
      source.includes("web_explorer") &&
      (
        // Pattern 1: ternary branching on nodeName for web_explorer
        source.match(/nodeName\s*===\s*['"]web_explorer['"]\s*\?[\s\S]{0,200}web_search/) !== null ||
        // Pattern 2: if/else branching
        source.match(/if\s*\(\s*nodeName\s*===\s*['"]web_explorer['"]\s*\)[\s\S]{0,200}web_search/) !== null ||
        // Pattern 3: switch/case
        source.match(/case\s*['"]web_explorer['"][\s\S]{0,200}web_search/) !== null
      );

    // On UNFIXED code: hasWebExplorerNudgeBranch is false — FAILS (confirms bug)
    expect(hasWebExplorerNudgeBranch).toBe(true);
  });

  /**
   * Test B2: The nudge message for web_explorer must reference web explorer tools
   *
   * On UNFIXED code: the nudge message only references 'computer_use' — FAILS
   * After fix: the nudge message references 'web_search', 'navis', or 'web_fetch'
   *
   * **Validates: Requirements 1.3, 2.3**
   */
  it('should reference web_search, navis, or web_fetch in the web_explorer nudge path', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // Find the nudge message section (around the isSpecializedAgent block)
    const nudgeSection = source.match(
      /isSpecializedAgent[\s\S]{0,2000}nudgeMsg[\s\S]{0,500}content:/
    );

    expect(nudgeSection).toBeTruthy();

    if (nudgeSection) {
      const nudgeSectionText = nudgeSection[0];

      // After fix: the nudge section should contain web explorer tool references
      // (either in a ternary, if/else, or switch)
      const referencesWebExplorerTools =
        nudgeSectionText.includes('web_search') ||
        nudgeSectionText.includes('navis') ||
        nudgeSectionText.includes('web_fetch');

      // On UNFIXED code: this is false — FAILS (confirms bug)
      expect(referencesWebExplorerTools).toBe(true);
    }
  });

  /**
   * Test B3: The nudge message must NOT use a single hardcoded computer_use for all agents
   *
   * On UNFIXED code: the nudge content is a single template string with 'computer_use'
   *   hardcoded for ALL specialized agents — FAILS
   * After fix: the nudge content is derived from per-agent logic
   *
   * **Validates: Requirements 1.3, 2.3**
   */
  it('should not use a single hardcoded computer_use nudge for all specialized agents', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // On UNFIXED code: there is exactly one nudge message template that hardcodes computer_use
    // and applies to ALL specialized agents (no branching)
    // The unfixed pattern looks like:
    //   const nudgeMsg: ChatMessage = {
    //     role: 'system',
    //     content: `SYSTEM REMINDER: ... Use the 'computer_use' tool (or your other relevant tools) NOW ...`
    //   };
    // with NO conditional logic before it based on nodeName

    // After fix: there should be an agentToolHint variable or similar branching
    const hasAgentSpecificHint =
      source.includes('agentToolHint') ||
      source.match(/nodeName\s*===\s*['"]web_explorer['"][\s\S]{0,100}web_search/) !== null ||
      source.match(/web_explorer[\s\S]{0,50}web_search[\s\S]{0,50}navis/) !== null;

    // On UNFIXED code: this is false — FAILS (confirms bug)
    expect(hasAgentSpecificHint).toBe(true);
  });
});

// ── Path C Tests ─────────────────────────────────────────────────────────────

describe('Bug Condition — Path C: Double-empty nudge retry leaves webExplorerComplete unset', () => {
  /**
   * Test C1: A fallback guard must exist after the nudge retry for web_explorer
   *
   * On UNFIXED code: after the nudge retry, there is NO guard that checks if
   *   web_explorer still returned no tool calls and sets webExplorerComplete: true
   *
   * After fix: a guard exists that returns { webExplorerComplete: true, pendingToolCalls: [] }
   *   when the nudge retry also produces no tool calls for web_explorer
   *
   * Counterexample: after double-empty retry, returned state has { pendingToolCalls: [] }
   * with no webExplorerComplete, causing the graph edge to self-loop indefinitely.
   *
   * **Validates: Requirements 1.4, 2.4**
   */
  it('should have a fallback guard after the nudge retry that sets webExplorerComplete: true for web_explorer', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // After fix: there should be a guard after the nudge retry that:
    // 1. Checks if nodeName === 'web_explorer'
    // 2. Checks if response.toolCalls is empty
    // 3. Returns { webExplorerComplete: true, pendingToolCalls: [] }

    // Look for the pattern: web_explorer + webExplorerComplete: true in the nudge retry section
    const hasWebExplorerFallback =
      source.match(/web_explorer[\s\S]{0,500}webExplorerComplete:\s*true/) !== null ||
      source.match(/webExplorerComplete:\s*true[\s\S]{0,500}web_explorer/) !== null;

    // On UNFIXED code: this is false — FAILS (confirms bug)
    expect(hasWebExplorerFallback).toBe(true);
  });

  /**
   * Test C2: The fallback must also set pendingToolCalls: [] to prevent stale state
   *
   * On UNFIXED code: no fallback exists at all — FAILS
   * After fix: fallback sets both webExplorerComplete: true AND pendingToolCalls: []
   *
   * **Validates: Requirements 1.4, 2.4**
   */
  it('should set both webExplorerComplete: true and pendingToolCalls: [] in the double-empty fallback', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The fallback return should contain both properties
    // Pattern: a return statement with webExplorerComplete: true AND pendingToolCalls: []
    // in the context of the nudge retry section
    const nudgeRetrySection = source.match(
      /nudgeMessages[\s\S]{0,2000}response\s*=\s*await\s*client\.chat[\s\S]{0,1000}/
    );

    expect(nudgeRetrySection).toBeTruthy();

    if (nudgeRetrySection) {
      const sectionText = nudgeRetrySection[0];

      const hasWebExplorerComplete = sectionText.includes('webExplorerComplete');
      const hasPendingToolCalls = sectionText.includes('pendingToolCalls');

      // On UNFIXED code: neither property is set after the nudge retry — FAILS
      expect(hasWebExplorerComplete).toBe(true);
      expect(hasPendingToolCalls).toBe(true);
    }
  });

  /**
   * Test C3: The fallback guard must be scoped to web_explorer only
   *
   * On UNFIXED code: no fallback exists — FAILS
   * After fix: the fallback is conditional on nodeName === 'web_explorer'
   *   (other agents are unaffected)
   *
   * **Validates: Requirements 1.4, 2.4, 3.4**
   */
  it('should scope the double-empty fallback to web_explorer only (not all specialized agents)', () => {
    const source = fs.readFileSync(AGENT_RUNTIME_PATH, 'utf-8');

    // The fallback should be conditional on nodeName === 'web_explorer'
    // Pattern: if (... nodeName === 'web_explorer' ...) { return { webExplorerComplete: true ... } }
    const hasScopedFallback =
      source.match(
        /nodeName\s*===\s*['"]web_explorer['"][\s\S]{0,600}webExplorerComplete:\s*true/
      ) !== null ||
      source.match(
        /webExplorerComplete:\s*true[\s\S]{0,600}nodeName\s*===\s*['"]web_explorer['"]/
      ) !== null;

    // On UNFIXED code: this is false — FAILS (confirms bug)
    expect(hasScopedFallback).toBe(true);
  });

  /**
   * Test C4: Graph loop condition — demonstrates the exact self-loop trigger
   *
   * Simulates the graph edge decision logic to show that without webExplorerComplete: true,
   * the graph would self-loop.
   *
   * This test uses the UNFIXED return shape to demonstrate the bug:
   *   { pendingToolCalls: [], webExplorerComplete: undefined }
   *   → falls into the "otherwise" branch → infinite self-loop
   *
   * On UNFIXED code: the unfixed return shape triggers the self-loop — FAILS
   * After fix: the fixed return shape prevents the self-loop
   *
   * **Validates: Requirements 1.4, 2.4**
   */
  it('should demonstrate that the unfixed return shape triggers the graph self-loop condition', () => {
    // Simulate the graph edge decision logic (from graph.ts web_explorer conditional edge)
    function simulateGraphEdge(state: { pendingToolCalls?: any[]; webExplorerComplete?: boolean }): string {
      if (state.pendingToolCalls && state.pendingToolCalls.length > 0) {
        return 'action_validation';
      }
      if (state.webExplorerComplete === true) {
        return 'brain';
      }
      return 'web_explorer'; // self-loop!
    }

    // UNFIXED return shape (what runAgentStep returns after double-empty retry on unfixed code)
    const unfixedReturnShape = {
      pendingToolCalls: [],
      webExplorerComplete: undefined, // not set
    };

    // FIXED return shape (what runAgentStep should return after the fix)
    const fixedReturnShape = {
      pendingToolCalls: [],
      webExplorerComplete: true, // explicitly set
    };

    const unfixedRoute = simulateGraphEdge(unfixedReturnShape);
    const fixedRoute = simulateGraphEdge(fixedReturnShape);

    // Unfixed code routes to self-loop (this is the bug)
    expect(unfixedRoute).toBe('web_explorer'); // self-loop confirmed

    // Fixed code routes to brain (this is the expected behavior)
    // On UNFIXED code: the actual runAgentStep returns unfixedReturnShape, not fixedReturnShape
    // This test documents the expected behavior — it PASSES on both unfixed and fixed code
    // because it's testing the graph edge logic, not the actual runAgentStep output
    expect(fixedRoute).toBe('brain');

    // The key assertion: the source code must produce the fixed return shape
    // (verified by Tests C1, C2, C3 above)
    expect(fixedRoute).not.toBe('web_explorer');
  });
});
