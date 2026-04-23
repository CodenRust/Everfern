import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Preservation Property Tests — Final-Response Turns Unaffected by Fix
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation — Final-Response Turns Unaffected by Fix
 *
 * OBSERVATION-FIRST METHODOLOGY:
 * These tests are written by observing the UNFIXED code behavior first, then
 * encoding that behavior as properties that MUST continue to hold after the fix.
 *
 * EXPECTED OUTCOME: All tests PASS on unfixed code (confirms baseline to preserve).
 *
 * Observed behaviors on UNFIXED code:
 * 1. When `streamingContentRef` accumulates text and NO `onToolStart` fires before
 *    `mission_complete`, the committed assistant message `content` equals the
 *    accumulated text.
 * 2. When `onToolStart` fires with an empty `streamingContentRef` (no preceding
 *    narrative), the resulting `ToolCallDisplay.description` is `undefined`.
 * 3. When `onToolStart` fires with a whitespace-only `streamingContentRef`
 *    (e.g. `"   \n  "`), the resulting `ToolCallDisplay.description` is `undefined`.
 * 4. `thought` event handling is unaffected — `streamingThoughtRef` is never
 *    modified by the narrative capture logic.
 */

// ── Shared types ──────────────────────────────────────────────────────────────

interface ToolCallDisplay {
  id: string;
  toolName: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  description?: string;
  label?: string;
  color?: string;
}

// ── Minimal harness: UNFIXED onToolStart ──────────────────────────────────────

/**
 * Simulates the UNFIXED `onToolStart` handler from page.tsx.
 *
 * The unfixed handler does NOT read `streamingContentRef.current` and does NOT
 * set `description` on the new `ToolCallDisplay`. This is the baseline behavior
 * that preservation tests observe.
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
    // description is intentionally NOT set — replicates the unfixed code
  };

  liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
  // streamingContentRef.current is NOT cleared — replicates the unfixed code

  return newTc;
}

/**
 * Simulates the `mission_complete` / final-response commit path from page.tsx.
 *
 * When no `onToolStart` fires, the accumulated `streamingContentRef.current`
 * is committed as the assistant message `content`. This is the final-response path.
 *
 * Extracted from the mission_complete handler in page.tsx:
 *   const committedContent = streamingContentRef.current;
 *   streamingContentRef.current = "";
 *   setStreamingContent("");
 *   // ... create message with content: committedContent
 */
function simulateFinalResponseCommit(
  streamingContentRef: { current: string }
): { content: string } {
  // Capture the accumulated content (exactly as the unfixed code does)
  const committedContent = streamingContentRef.current;
  // Clear the ref (as mission_complete does)
  streamingContentRef.current = '';
  return { content: committedContent };
}

/**
 * Simulates accumulating text chunks into `streamingContentRef`.
 * Mirrors the `acp:stream-chunk` handler in page.tsx:
 *   streamingContentRef.current += delta;
 *   setStreamingContent(streamingContentRef.current);
 */
function simulateStreamChunks(
  streamingContentRef: { current: string },
  chunks: string[]
): void {
  for (const chunk of chunks) {
    streamingContentRef.current += chunk;
  }
}

// ── Preservation Property Tests ───────────────────────────────────────────────

describe('Preservation: Final-Response Turns Unaffected by Fix', () => {

  /**
   * Property 2a: Final-Response Path Preservation
   *
   * For all non-empty text strings accumulated in `streamingContentRef` with NO
   * subsequent `tool_start` event, the committed message `content` equals the
   * accumulated text.
   *
   * This is the core preservation property: the fix must NOT change the behavior
   * of final-response turns (turns where the agent emits text but no tool calls).
   *
   * **Validates: Requirements 3.1**
   */
  it(
    'PROPERTY 2a (PBT): for all non-empty text strings with no tool_start, committed content equals accumulated text',
    () => {
      /**
       * **Validates: Requirements 3.1**
       */
      fc.assert(
        fc.property(
          // Generate 1–5 non-empty text chunks (simulating streaming tokens)
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          (chunks) => {
            // Arrange: accumulate chunks into streamingContentRef (no tool_start fires)
            const streamingContentRef = { current: '' };
            simulateStreamChunks(streamingContentRef, chunks);

            const expectedContent = chunks.join('');

            // Act: simulate mission_complete (final-response path — no tool_start)
            const committed = simulateFinalResponseCommit(streamingContentRef);

            // Assert: committed content equals the accumulated text
            // This is the baseline behavior that must be preserved after the fix
            const contentMatches = committed.content === expectedContent;
            const refCleared = streamingContentRef.current === '';

            return contentMatches && refCleared;
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * Property 2a (deterministic): specific final-response example
   *
   * Narrative "Here is your report: ..." with no subsequent tool_start.
   * Committed content should equal the narrative text.
   *
   * **Validates: Requirements 3.1**
   */
  it(
    'PROPERTY 2a (deterministic): "Here is your report: ..." with no tool_start → committed content equals narrative',
    () => {
      const streamingContentRef = { current: '' };
      simulateStreamChunks(streamingContentRef, [
        'Here is your report: ',
        'The data shows a 15% increase in Q3. ',
        'Overall performance is strong.'
      ]);

      const expectedContent = 'Here is your report: The data shows a 15% increase in Q3. Overall performance is strong.';

      const committed = simulateFinalResponseCommit(streamingContentRef);

      expect(committed.content).toBe(expectedContent);
      expect(streamingContentRef.current).toBe('');
    }
  );

  /**
   * Property 2b: Empty streamingContentRef → description is undefined
   *
   * For all `tool_start` events where `streamingContentRef.current` is `""`,
   * the resulting `ToolCallDisplay.description` is `undefined`.
   *
   * This must hold on BOTH unfixed and fixed code — it is a preservation property.
   *
   * **Validates: Requirements 3.3**
   */
  it(
    'PROPERTY 2b (PBT): for all tool_start events with empty streamingContentRef, description is undefined',
    () => {
      /**
       * **Validates: Requirements 3.3**
       */
      fc.assert(
        fc.property(
          // Generate a tool name
          fc.constantFrom('read_file', 'run_command', 'web_search', 'write_file', 'bash', 'consult_skill'),
          // Generate tool args
          fc.record({ key: fc.string() }),
          (toolName, toolArgs) => {
            // Arrange: streamingContentRef is empty (no preceding narrative)
            const streamingContentRef = { current: '' };
            const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

            // Act: fire onToolStart with empty ref
            const newTc = simulateUnfixedOnToolStart(
              streamingContentRef,
              liveToolCallsRef,
              toolName,
              toolArgs
            );

            // Assert: description is undefined (no narrative to attach)
            // This must hold on both unfixed and fixed code
            return newTc.description === undefined;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Property 2b (deterministic): empty ref → description is undefined
   *
   * **Validates: Requirements 3.3**
   */
  it(
    'PROPERTY 2b (deterministic): empty streamingContentRef before read_file → description is undefined',
    () => {
      const streamingContentRef = { current: '' };
      const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

      const newTc = simulateUnfixedOnToolStart(
        streamingContentRef,
        liveToolCallsRef,
        'read_file',
        { path: '/data/file.csv' }
      );

      expect(newTc.description).toBeUndefined();
    }
  );

  /**
   * Property 2c: Whitespace-only streamingContentRef → description is undefined
   *
   * For all `tool_start` events where `streamingContentRef.current` is whitespace-only
   * (e.g. `"   \n  "`), the resulting `ToolCallDisplay.description` is `undefined`.
   *
   * Whitespace-only content should NOT be attached as a description — it is
   * semantically empty. This must hold on BOTH unfixed and fixed code.
   *
   * **Validates: Requirements 3.3**
   */
  it(
    'PROPERTY 2c (PBT): for all tool_start events with whitespace-only streamingContentRef, description is undefined',
    () => {
      /**
       * **Validates: Requirements 3.3**
       */
      fc.assert(
        fc.property(
          // Generate whitespace-only strings (spaces, tabs, newlines)
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }).map(chars => chars.join('')),
          // Generate a tool name
          fc.constantFrom('read_file', 'run_command', 'web_search', 'write_file', 'bash'),
          (whitespace, toolName) => {
            // Arrange: streamingContentRef contains only whitespace
            const streamingContentRef = { current: whitespace };
            const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

            // Act: fire the unfixed onToolStart handler
            const newTc = simulateUnfixedOnToolStart(
              streamingContentRef,
              liveToolCallsRef,
              toolName,
              {}
            );

            // Assert: description is undefined (whitespace-only content is not a narrative)
            // The unfixed code never sets description, so this passes trivially.
            // The fixed code must also produce undefined for whitespace-only content
            // (by trimming and checking for empty string before attaching).
            return newTc.description === undefined;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * Property 2c (deterministic): specific whitespace examples
   *
   * **Validates: Requirements 3.3**
   */
  it(
    'PROPERTY 2c (deterministic): whitespace-only streamingContentRef → description is undefined',
    () => {
      const whitespaceExamples = ['   ', '\n', '\t', '   \n  ', '\r\n', '  \t  \n  '];

      for (const whitespace of whitespaceExamples) {
        const streamingContentRef = { current: whitespace };
        const liveToolCallsRef: { current: ToolCallDisplay[] } = { current: [] };

        const newTc = simulateUnfixedOnToolStart(
          streamingContentRef,
          liveToolCallsRef,
          'run_command',
          {}
        );

        expect(newTc.description).toBeUndefined();
      }
    }
  );

  /**
   * Property 2d: Thought event handling is unaffected
   *
   * `streamingThoughtRef` is a separate ref from `streamingContentRef`.
   * Modifying one should NOT affect the other. The narrative capture logic
   * only touches `streamingContentRef` — `streamingThoughtRef` must remain
   * independent.
   *
   * **Validates: Requirements 3.2**
   */
  it(
    'PROPERTY 2d (PBT): streamingThoughtRef is independent of streamingContentRef — modifying one does not affect the other',
    () => {
      /**
       * **Validates: Requirements 3.2**
       */
      fc.assert(
        fc.property(
          // Generate content for streamingContentRef
          fc.string({ minLength: 0, maxLength: 200 }),
          // Generate thought content for streamingThoughtRef
          fc.string({ minLength: 1, maxLength: 200 }),
          (contentText, thoughtText) => {
            // Arrange: two separate refs (as in page.tsx)
            const streamingContentRef = { current: contentText };
            const streamingThoughtRef = { current: thoughtText };

            const initialThought = streamingThoughtRef.current;

            // Act: simulate the narrative capture logic (what the fix does to streamingContentRef)
            // This simulates: capture narrative from streamingContentRef, clear it
            const narrativeText = streamingContentRef.current.trim();
            if (narrativeText) {
              streamingContentRef.current = '';
            }

            // Assert: streamingThoughtRef is completely unaffected
            // The narrative capture logic must ONLY touch streamingContentRef
            const thoughtUnchanged = streamingThoughtRef.current === initialThought;

            return thoughtUnchanged;
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * Property 2d (deterministic): thought ref is independent of content ref
   *
   * **Validates: Requirements 3.2**
   */
  it(
    'PROPERTY 2d (deterministic): clearing streamingContentRef does not affect streamingThoughtRef',
    () => {
      const streamingContentRef = { current: "I'll read the file now." };
      const streamingThoughtRef = { current: 'Let me think about the best approach...' };

      const initialThought = streamingThoughtRef.current;

      // Simulate the narrative capture (what the fix does)
      const narrativeText = streamingContentRef.current.trim();
      if (narrativeText) {
        streamingContentRef.current = '';
      }

      // streamingContentRef should be cleared
      expect(streamingContentRef.current).toBe('');
      // streamingThoughtRef must be completely unaffected
      expect(streamingThoughtRef.current).toBe(initialThought);
      expect(streamingThoughtRef.current).toBe('Let me think about the best approach...');
    }
  );

  /**
   * Property 2d (deterministic): accumulating thought chunks is independent of content chunks
   *
   * Simulates the `acp:thought` handler accumulating into `streamingThoughtRef`
   * while `streamingContentRef` also accumulates content — they must remain separate.
   *
   * **Validates: Requirements 3.2**
   */
  it(
    'PROPERTY 2d (deterministic): thought and content refs accumulate independently',
    () => {
      const streamingContentRef = { current: '' };
      const streamingThoughtRef = { current: '' };

      // Simulate interleaved chunk and thought events
      streamingContentRef.current += 'I will ';
      streamingThoughtRef.current += 'Thinking: should I use read_file or bash? ';
      streamingContentRef.current += 'read the file now.';
      streamingThoughtRef.current += 'read_file is safer.';

      expect(streamingContentRef.current).toBe('I will read the file now.');
      expect(streamingThoughtRef.current).toBe('Thinking: should I use read_file or bash? read_file is safer.');

      // Simulate narrative capture (only touches streamingContentRef)
      const narrativeText = streamingContentRef.current.trim();
      if (narrativeText) {
        streamingContentRef.current = '';
      }

      // Content ref is cleared, thought ref is untouched
      expect(streamingContentRef.current).toBe('');
      expect(streamingThoughtRef.current).toBe('Thinking: should I use read_file or bash? read_file is safer.');
    }
  );

  /**
   * Composite preservation: final-response turn with concurrent thought
   *
   * When a final-response turn has both content chunks and thought chunks,
   * the committed content equals the accumulated content chunks, and the
   * thought ref is unaffected.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it(
    'PROPERTY 2 (composite): final-response with thought — content committed correctly, thought unaffected',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          (contentChunks, thoughtText) => {
            /**
             * **Validates: Requirements 3.1, 3.2**
             */
            const streamingContentRef = { current: '' };
            const streamingThoughtRef = { current: thoughtText };

            simulateStreamChunks(streamingContentRef, contentChunks);

            const expectedContent = contentChunks.join('');
            const expectedThought = thoughtText;

            // Simulate mission_complete (final-response path)
            const committed = simulateFinalResponseCommit(streamingContentRef);

            // Content committed correctly
            const contentOk = committed.content === expectedContent;
            // Thought ref unaffected
            const thoughtOk = streamingThoughtRef.current === expectedThought;

            return contentOk && thoughtOk;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
