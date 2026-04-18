/**
 * Bug Condition Exploration Test — Computer Use Intent Classification
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Property 1: Bug Condition — GUI Automation Intent Classification
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 *
 * Bug: The classifyIntentFast and classifyIntentFallback functions in triage.ts
 * do not recognize GUI automation keywords (open, click, type, launch, start, mouse,
 * keyboard, press, scroll, drag, move cursor, gui, window, desktop, screen).
 * This causes GUI automation requests to be misclassified as "task" or "conversation"
 * instead of "automate", which routes them to brain/judge that returns "cannot_proceed"
 * because it lacks GUI automation permissions.
 *
 * Root cause: Missing pattern detection for GUI automation keywords in both
 * classifyIntentFast and classifyIntentFallback functions.
 *
 * Expected counterexamples (unfixed code):
 *   classifyIntentFast("Open Spotify and play my liked songs", [])
 *     → returns null or wrong intent (not "automate")
 *   classifyIntentFallback("Click the start button", [])
 *     → returns "task" instead of "automate"
 */

import { describe, it, expect } from 'vitest';
import { classifyIntentFast, classifyIntentFallback } from '../../triage';

describe('Bug Condition Exploration — Computer Use Intent Classification', () => {
  /**
   * Test Case 1: Application Launch Pattern
   *
   * Input: "Open Spotify and play my liked songs"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null (ambiguous) or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Open Spotify and play my liked songs" as automate intent', () => {
    const input = "Open Spotify and play my liked songs";
    const result = classifyIntentFast(input, []);

    // On unfixed code: result is null or result.intent !== 'automate'
    // Expected (after fix): result.intent === 'automate' && result.confidence >= 0.8
    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 2: Click Action Pattern
   *
   * Input: "Click the start button"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Click the start button" as automate intent', () => {
    const input = "Click the start button";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 3: Type Action Pattern
   *
   * Input: "Type 'hello' in notepad"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it("should classify \"Type 'hello' in notepad\" as automate intent", () => {
    const input = "Type 'hello' in notepad";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 4: Launch Application Pattern
   *
   * Input: "Launch Discord and send a message"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Launch Discord and send a message" as automate intent', () => {
    const input = "Launch Discord and send a message";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 5: Mouse Action Pattern
   *
   * Input: "Move the mouse to the top right corner"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Move the mouse to the top right corner" as automate intent', () => {
    const input = "Move the mouse to the top right corner";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 6: Keyboard Action Pattern
   *
   * Input: "Press Ctrl+C to copy"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Press Ctrl+C to copy" as automate intent', () => {
    const input = "Press Ctrl+C to copy";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 7: Scroll Action Pattern
   *
   * Input: "Scroll down to the bottom of the page"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Scroll down to the bottom of the page" as automate intent', () => {
    const input = "Scroll down to the bottom of the page";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 8: Window Management Pattern
   *
   * Input: "Close the window"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Close the window" as automate intent', () => {
    const input = "Close the window";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 9: Fallback Classification - Application Launch
   *
   * Input: "Launch Discord and send a message"
   * Expected (after fix): classifyIntentFallback returns { intent: 'automate', confidence >= 0.7 }
   * On UNFIXED code: returns "task" or "conversation" instead of "automate"
   *
   * Counterexample: classifyIntentFallback returns intent !== 'automate'
   */
  it('should classify "Launch Discord and send a message" as automate intent in fallback', () => {
    const input = "Launch Discord and send a message";
    const result = classifyIntentFallback(input, []);

    expect(result.intent).toBe('automate');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 10: Fallback Classification - Click Action
   *
   * Input: "Click the start button"
   * Expected (after fix): classifyIntentFallback returns { intent: 'automate', confidence >= 0.7 }
   * On UNFIXED code: returns "task" instead of "automate"
   *
   * Counterexample: classifyIntentFallback returns intent !== 'automate'
   */
  it('should classify "Click the start button" as automate intent in fallback', () => {
    const input = "Click the start button";
    const result = classifyIntentFallback(input, []);

    expect(result.intent).toBe('automate');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 11: Fallback Classification - Type Action
   *
   * Input: "Type 'hello' in notepad"
   * Expected (after fix): classifyIntentFallback returns { intent: 'automate', confidence >= 0.7 }
   * On UNFIXED code: returns "task" instead of "automate"
   *
   * Counterexample: classifyIntentFallback returns intent !== 'automate'
   */
  it("should classify \"Type 'hello' in notepad\" as automate intent in fallback", () => {
    const input = "Type 'hello' in notepad";
    const result = classifyIntentFallback(input, []);

    expect(result.intent).toBe('automate');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 12: Fallback Classification - Open Application
   *
   * Input: "Open Spotify and play my liked songs"
   * Expected (after fix): classifyIntentFallback returns { intent: 'automate', confidence >= 0.7 }
   * On UNFIXED code: returns "task" instead of "automate"
   *
   * Counterexample: classifyIntentFallback returns intent !== 'automate'
   */
  it('should classify "Open Spotify and play my liked songs" as automate intent in fallback', () => {
    const input = "Open Spotify and play my liked songs";
    const result = classifyIntentFallback(input, []);

    expect(result.intent).toBe('automate');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 13: Desktop Interaction Pattern
   *
   * Input: "Show me the desktop"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Show me the desktop" as automate intent', () => {
    const input = "Show me the desktop";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 14: Drag Action Pattern
   *
   * Input: "Drag the file to the folder"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Drag the file to the folder" as automate intent', () => {
    const input = "Drag the file to the folder";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  /**
   * Test Case 15: Start Application Pattern
   *
   * Input: "Start Chrome and navigate to google.com"
   * Expected (after fix): classifyIntentFast returns { intent: 'automate', confidence >= 0.8 }
   * On UNFIXED code: returns null or wrong intent
   *
   * Counterexample: classifyIntentFast returns null or intent !== 'automate'
   */
  it('should classify "Start Chrome and navigate to google.com" as automate intent', () => {
    const input = "Start Chrome and navigate to google.com";
    const result = classifyIntentFast(input, []);

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('automate');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
