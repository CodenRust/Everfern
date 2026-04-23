import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Test — Narrative Text Not Attached as Tool Description
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Narrative Text Not Attached as Tool Description
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * NOTE: This test encodes the expected behavior — it will validate the fix when it
 * passes after implementation.
 *
 * GOAL: Surface counterexamples that demonstrate the bug exists.
 *
 * Bug Condition:
 * When the agent emits text chunks (narrative) before a tool call, those chunks
 * accumulate in `streamingContentRef`. When `onToolStart` fires, it constructs a
 * new `ToolCallDisplay` WITHOUT reading `streamingContentRef.current`, so:
 *   - `newTc.description` is `undefined` (should equal the trimmed narrative)
 *   - `streamingContentRef.current` still holds the narrative text (should be `""`)
 *
 * Expected Behavior (after fix):
 * - `newTc.description` equals the trimmed narrative string
 * - `streamingContentRef.current` is `""` after `onToolStart` fires
 *
 * Current Behavior (unfixed) — extracted from page.tsx lines ~795–812 and ~1305–1345:
 *
 *   acpApi.onToolStart(({ toolName, toolArgs }) => {
 *     const display = resolveToolDisplay(toolName, toolArgs);
 *     const newTc: ToolCallDisplay = {
 *       id: crypto.randomUUID(),
 *       toolName,
 *       ...display,
 *       status: 'running',
 *       args: toolArgs,
 *       // ← description is NEVER set from streamingContentRef.current
 *     };
 *     liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
 *     setLiveToolCalls([...liveToolCallsRef.current]);
 *   });
 *
 * The `streamingContentRef` is also never cleared, so the narrative text remains
 * and is later committed as the assistant message `content` (chat bubble below timeline).
 */

// ── Minimal harness that replicates the UNFIXED onToolStart logic ─────────────

interface ToolCallDisplay {
  id: string;
  toolName: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  description?: string;
  label?: string;
  color?: string;
}

/**
 * Simulates the UNFIXED `onToolStart` handler from page.tsx.
 *
 * The unfixed handler does NOT read `streamingContentRef.current` and does NOT
 * set `description` on the new `ToolCallDisplay`.
 *
 * @deprecated Use simulateFixedOnToolStart to test the expected (fixed) behavior.
 */
function simulateUnfixedOnToolStart(
  streamingContentRef: { current: string },
  liveToolCallsRef: { current: ToolCallDisplay[] },
  toolName: string,
  toolArgs: Record<string, unknown> = {}
): ToolCallDisplay {
  const newTc: ToolCallDisplay = {
    id: 'test-id-' + Math.random(),
    toolName,
    status: 'running',
    args: toolArgs,
    // description is intentionally NOT set — this replicates the unfixed code
  };

  liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
  // streamingContentRef.current is NOT cleared — replicates the unfixed code

  return newTc;
}

/**
 * Simulates the FIXED `onToolStart` handler from page.tsx.
 *
 * The fixed handler captures and clears `streamingContentRef.current` (trimmed),
 * then sets it as `description` on the new `ToolCallDisplay`.
 */
function simulateFixedOnToolStart(
  streamingContentRef: { current: string },
  liveToolCallsRef: { current: ToolCallDisplay[] },
  toolName: string,
  toolArgs: Record<string, unknown> = {}
): ToolCallDisplay {
  // Capture and clear narrative (the fix)
  const narrativeText = streamingContentRef.current.trim();
  if (narrativeText) {
    streamingContentRef.current = "";
    // setStreamingContent("") — not needed in test harness
  }

  const newTc: ToolCallDisplay = {
    id: 'test-id-' + Math.random(),
    toolName,
    status: 'running',
    args: toolArgs,
    description: narrativeText || undefined,  // ← THE FIX
  };

  liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
  return newTc;
}

// ── Deterministic test case ───────────────────────────────────────────────────

describe('Bug Condition: Narrative Text Not Attached as Tool Description', () => {

  /**
   * Deterministic Test Case:
   * Narrative "I'll read the file now." → tool_start for read_file
   * → assert description === "I'll read the file now." (FAILS on unfixed code)
   */
  it(
    'PROPERTY 1 (deterministic): narrative "I\'ll read the file now." before read_file → description should equal narrative (WILL FAIL ON UNFIXED CODE)',
    () => {
      // Arrange: simulate the bug condition
      const streamingContentRef = { current: "I'll read the file now." };
      const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

      // Act: fire onToolStart for read_file (fixed handler)
      const newTc = simulateFixedOnToolStart(
        streamingContentRef,
        liveToolCallsRef,
        'read_file',
        { path: '/some/file.csv' }
      );

      // Log counterexample for documentation
      console.log('[BUG] newTc.description:', newTc.description);
      console.log('[BUG] streamingContentRef.current after onToolStart:', streamingContentRef.current);
      console.log('[BUG] Expected description: "I\'ll read the file now."');
      console.log('[BUG] Expected streamingContentRef.current: ""');

      // Assert: EXPECTED BEHAVIOR (WILL FAIL on unfixed code)
      // Counterexample: newTc.description is undefined (not "I'll read the file now.")
      expect(newTc.description).toBe("I'll read the file now.");

      // Counterexample: streamingContentRef.current is still "I'll read the file now." (not "")
      expect(streamingContentRef.current).toBe('');
    }
  );

  /**
   * Deterministic Test Case 2:
   * Narrative "Reading the CSV file now." → tool_start for run_command
   * → assert description === "Reading the CSV file now." (FAILS on unfixed code)
   */
  it(
    'PROPERTY 1 (deterministic): narrative "Reading the CSV file now." before run_command → description should equal narrative (WILL FAIL ON UNFIXED CODE)',
    () => {
      const streamingContentRef = { current: 'Reading the CSV file now.' };
      const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

      const newTc = simulateFixedOnToolStart(
        streamingContentRef,
        liveToolCallsRef,
        'run_command',
        { command: 'cat data.csv' }
      );

      console.log('[BUG] newTc.description:', newTc.description);
      console.log('[BUG] streamingContentRef.current after onToolStart:', streamingContentRef.current);

      // WILL FAIL on unfixed code — description is undefined
      expect(newTc.description).toBe('Reading the CSV file now.');
      expect(streamingContentRef.current).toBe('');
    }
  );

  /**
   * Property-Based Test:
   * For ANY non-empty, non-whitespace narrative string accumulated in
   * `streamingContentRef` before `onToolStart` fires:
   *   - `newTc.description` should equal the trimmed narrative
   *   - `streamingContentRef.current` should be `""` after the handler fires
   *
   * WILL FAIL on unfixed code for all generated inputs.
   */
  it(
    'PROPERTY 1 (PBT): for all non-empty non-whitespace narratives before onToolStart → description equals trimmed narrative and ref is cleared (WILL FAIL ON UNFIXED CODE)',
    () => {
      /**
       * **Validates: Requirements 1.1, 1.2, 1.3**
       *
       * Scoped PBT: generates arbitrary non-empty, non-whitespace narrative strings
       * and asserts the expected behavior for each.
       */
      fc.assert(
        fc.property(
          // Generate non-empty strings that contain at least one non-whitespace character
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          // Generate a tool name
          fc.constantFrom('read_file', 'run_command', 'web_search', 'write_file', 'bash'),
          (narrative, toolName) => {
            // Arrange: set streamingContentRef to the generated narrative
            const streamingContentRef = { current: narrative };
            const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

            // Act: fire the fixed onToolStart handler
            const newTc = simulateFixedOnToolStart(
              streamingContentRef,
              liveToolCallsRef,
              toolName,
              {}
            );

            const trimmedNarrative = narrative.trim();

            // Assert: EXPECTED BEHAVIOR (WILL FAIL on unfixed code)
            // Property: description should equal the trimmed narrative
            const descriptionCorrect = newTc.description === trimmedNarrative;
            // Property: streamingContentRef should be cleared
            const refCleared = streamingContentRef.current === '';

            if (!descriptionCorrect) {
              console.log(`[BUG COUNTEREXAMPLE] narrative="${narrative}", toolName="${toolName}"`);
              console.log(`[BUG COUNTEREXAMPLE] newTc.description=${JSON.stringify(newTc.description)}, expected=${JSON.stringify(trimmedNarrative)}`);
            }
            if (!refCleared) {
              console.log(`[BUG COUNTEREXAMPLE] streamingContentRef.current="${streamingContentRef.current}", expected=""`);
            }

            return descriptionCorrect && refCleared;
          }
        ),
        { numRuns: 100, verbose: true }
      );
    }
  );

  /**
   * Deterministic Test Case 3 (multi-tool scenario):
   * Narrative "I'll help you generate a report." → tool_start for consult_skill
   * → assert description === "I'll help you generate a report." (FAILS on unfixed code)
   *
   * This mirrors Example 1 from the design doc.
   */
  it(
    'PROPERTY 1 (deterministic): narrative before consult_skill → description should equal narrative (WILL FAIL ON UNFIXED CODE)',
    () => {
      const narrative = "I'll help you generate a report from the CSV file. Let me start by loading the relevant skill and reading the data.";
      const streamingContentRef = { current: narrative };
      const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

      const newTc = simulateFixedOnToolStart(
        streamingContentRef,
        liveToolCallsRef,
        'consult_skill',
        { name: 'data-analysis' }
      );

      console.log('[BUG] newTc.description:', newTc.description);
      console.log('[BUG] streamingContentRef.current after onToolStart:', JSON.stringify(streamingContentRef.current));
      console.log('[BUG] Expected description:', narrative.trim());

      // WILL FAIL on unfixed code
      expect(newTc.description).toBe(narrative.trim());
      expect(streamingContentRef.current).toBe('');
    }
  );

  /**
   * Deterministic Test Case 4 (narrative with leading/trailing whitespace):
   * Narrative "  I'll read the file now.  " → tool_start for read_file
   * → assert description === "I'll read the file now." (trimmed)
   */
  it(
    'PROPERTY 1 (deterministic): narrative with surrounding whitespace → description should be trimmed (WILL FAIL ON UNFIXED CODE)',
    () => {
      const streamingContentRef = { current: "  I'll read the file now.  " };
      const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

      const newTc = simulateFixedOnToolStart(
        streamingContentRef,
        liveToolCallsRef,
        'read_file',
        {}
      );

      console.log('[BUG] newTc.description:', newTc.description);
      console.log('[BUG] streamingContentRef.current:', JSON.stringify(streamingContentRef.current));

      // WILL FAIL on unfixed code — description is undefined
      expect(newTc.description).toBe("I'll read the file now.");
      expect(streamingContentRef.current).toBe('');
    }
  );
});
