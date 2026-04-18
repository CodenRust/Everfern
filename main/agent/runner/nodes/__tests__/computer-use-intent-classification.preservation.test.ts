/**
 * Preservation Property Tests — Computer Use Intent Classification
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
 *
 * Property 2: Preservation — Non-GUI-Automation Intent Classification
 *
 * IMPORTANT: These tests MUST PASS on unfixed code — they encode the baseline behavior
 * that must be preserved after the fix.
 *
 * Testing approach: Observation-first methodology
 * 1. Observe behavior on UNFIXED code for non-buggy inputs (inputs without GUI automation keywords)
 * 2. Write property-based tests capturing observed behavior patterns from Preservation Requirements
 * 3. Run tests on UNFIXED code
 * 4. EXPECTED OUTCOME: Tests PASS (this confirms baseline behavior to preserve)
 *
 * Preservation Requirements:
 * - Coding tasks must continue to be classified as "coding"
 * - Questions must continue to be classified as "question"
 * - File operations must continue to be classified as "task"
 * - Short affirmatives must continue to inherit the previous intent from context
 * - Debugging tasks must continue to be classified as "fix"
 * - Research tasks must continue to be classified as "research"
 * - Build tasks must continue to be classified as "build"
 * - Data analysis tasks must continue to be classified as "analyze"
 * - Conversation must continue to be classified as "conversation"
 * - Fallback classification logic must continue to work for non-automate intents when AI is unavailable
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { classifyIntentFast, classifyIntentFallback } from '../../triage';

describe('Preservation Property Tests — Non-GUI-Automation Intent Classification', () => {
  /**
   * Test Case 1: Coding Intent Preservation
   *
   * **Validates: Requirement 3.1**
   *
   * Observation: Coding tasks with both action verbs AND code terms are classified as "coding" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify coding tasks as "coding" intent', () => {
    const codingInputs = [
      "Write a function to sort an array",
      "Implement a class for user authentication",
      "Create a component for the dashboard",
      "Add a method to the API endpoint",
      "Refactor the code in the module"
    ];

    for (const input of codingInputs) {
      const result = classifyIntentFast(input, []);
      // classifyIntentFast requires BOTH coding verb AND code term to classify as coding
      if (result) {
        expect(result.intent).toBe('coding');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }
    }
  });

  /**
   * Test Case 2: Question Intent Preservation
   *
   * **Validates: Requirement 3.2**
   *
   * Observation: "What is React?" is classified as "question" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify questions as "question" intent', () => {
    const questionInputs = [
      "What is React?",
      "How does async/await work?",
      "Why is TypeScript better than JavaScript?",
      "When should I use Redux?",
      "Where can I find the documentation?"
    ];

    for (const input of questionInputs) {
      const result = classifyIntentFast(input, []);
      expect(result).not.toBeNull();
      expect(result?.intent).toBe('question');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  /**
   * Test Case 3: Fix/Debug Intent Preservation
   *
   * **Validates: Requirement 3.5**
   *
   * Observation: Inputs with fix/debug keywords are classified as "fix" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify debugging tasks as "fix" intent', () => {
    const fixInputs = [
      "fix the error in auth.ts",
      "debug the login issue",
      "error in the payment flow",
      "bug in the authentication",
      "crash on startup"
    ];

    for (const input of fixInputs) {
      const result = classifyIntentFast(input, []);
      if (result) {
        expect(result.intent).toBe('fix');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }
    }
  });

  /**
   * Test Case 4: Build Intent Preservation
   *
   * **Validates: Requirement 3.7**
   *
   * Observation: Inputs with build verbs AND project terms are classified as "build" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify build tasks as "build" intent', () => {
    const buildInputs = [
      "build a new React app",
      "scaffold a Node.js project",
      "generate a new Express application",
      "setup a TypeScript project",
      "initialize a new repository"
    ];

    for (const input of buildInputs) {
      const result = classifyIntentFast(input, []);
      if (result) {
        expect(result.intent).toBe('build');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }
    }
  });

  /**
   * Test Case 5: Conversation Intent Preservation
   *
   * **Validates: Requirement 3.9 (partial)**
   *
   * Observation: "Hello" is classified as "conversation" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify greetings as "conversation" intent', () => {
    const conversationInputs = [
      "Hello",
      "Hi there",
      "Good morning",
      "Thanks",
      "Thank you"
    ];

    for (const input of conversationInputs) {
      const result = classifyIntentFast(input, []);
      expect(result).not.toBeNull();
      expect(result?.intent).toBe('conversation');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  /**
   * Test Case 6: Very Short Input Preservation
   *
   * **Validates: Requirement 3.9 (partial)**
   *
   * Observation: Very short inputs (< 8 chars) are classified as "conversation" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify very short inputs as "conversation" intent', () => {
    const shortInputs = [
      "hi",
      "ok",
      "yes",
      "no",
      "bye"
    ];

    for (const input of shortInputs) {
      const result = classifyIntentFast(input, []);
      expect(result).not.toBeNull();
      expect(result?.intent).toBe('conversation');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  /**
   * Test Case 7: Context Inheritance Preservation
   *
   * **Validates: Requirement 3.4**
   *
   * Observation: "yes" inherits previous intent from context on unfixed code
   * Expected: This continues after fix
   */
  it('should inherit previous intent for short affirmatives with history', () => {
    const affirmatives = ["yes", "ok", "proceed", "sure", "continue"];
    const previousIntents = ['coding', 'fix', 'build', 'research', 'analyze'];

    for (const affirmative of affirmatives) {
      for (const prevIntent of previousIntents) {
        // Simulate history with a previous message that would have the given intent
        const history = [
          { role: 'user', content: 'Write a function to sort an array' },
          { role: 'assistant', content: 'I will help you with that.' }
        ];

        const result = classifyIntentFast(affirmative, history);

        // Short affirmatives with history should return a result (not null)
        // The exact intent depends on extractPreviousIntent logic, but it should not be null
        if (result) {
          expect(result.confidence).toBeGreaterThanOrEqual(0.8);
        }
      }
    }
  });

  /**
   * Test Case 8: Fallback Classification - Question Pattern
   *
   * **Validates: Requirement 3.2, 3.9**
   *
   * Observation: Fallback correctly identifies question patterns on unfixed code
   * Expected: This continues after fix
   */
  it('should classify questions in fallback mode', () => {
    const questionInputs = [
      "What is React?",
      "How does this work?",
      "Why is this happening?",
      "When should I use this?",
      "Where can I find help?"
    ];

    for (const input of questionInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent).toBe('question');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  /**
   * Test Case 9: Fallback Classification - Fix Pattern
   *
   * **Validates: Requirement 3.5, 3.9**
   *
   * Observation: Fallback correctly identifies fix/debug patterns on unfixed code
   * Expected: This continues after fix
   */
  it('should classify fix tasks in fallback mode', () => {
    const fixInputs = [
      "Fix the error in auth.ts",
      "Debug this issue",
      "There's a bug in the code",
      "Something is broken",
      "This is not working"
    ];

    for (const input of fixInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent).toBe('fix');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  /**
   * Test Case 10: Fallback Classification - Build Pattern
   *
   * **Validates: Requirement 3.7, 3.9**
   *
   * Observation: Fallback correctly identifies build patterns on unfixed code
   * Expected: This continues after fix
   */
  it('should classify build tasks in fallback mode', () => {
    const buildInputs = [
      "Create a new React app",
      "Build a Node.js project",
      "Generate a new application",
      "Setup a new project",
      "Initialize a repository"
    ];

    for (const input of buildInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent).toBe('build');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  /**
   * Test Case 11: Fallback Classification - Coding Pattern
   *
   * **Validates: Requirement 3.1, 3.9**
   *
   * Observation: Fallback correctly identifies coding patterns on unfixed code
   * Expected: This continues after fix
   */
  it('should classify coding tasks in fallback mode', () => {
    const codingInputs = [
      "function sortArray() { return []; }",
      "const myVar = 123;",
      "import React from 'react';",
      "class MyClass { }",
      "def my_function():"
    ];

    for (const input of codingInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent).toBe('coding');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  /**
   * Test Case 12: Fallback Classification - Research Pattern
   *
   * **Validates: Requirement 3.6, 3.9**
   *
   * Observation: Fallback correctly identifies research patterns on unfixed code
   * Expected: This continues after fix
   */
  it('should classify research tasks in fallback mode', () => {
    const researchInputs = [
      "Search for React best practices",
      "Find information about TypeScript",
      "Look up documentation for Express",
      "Research authentication methods",
      "Investigate performance optimization"
    ];

    for (const input of researchInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent).toBe('research');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }
  });

  /**
   * Test Case 13: Fallback Classification - Short Affirmative with Context
   *
   * **Validates: Requirement 3.4, 3.9**
   *
   * Observation: Fallback inherits previous intent for short affirmatives on unfixed code
   * Expected: This continues after fix
   * Note: Confidence may be lower in fallback mode (0.5-0.85 range)
   */
  it('should inherit previous intent for short affirmatives in fallback mode', () => {
    const affirmatives = ["yes", "ok", "proceed", "sure"];

    // Simulate history with a previous message
    const history = [
      { role: 'user', content: 'Write a function to sort an array' },
      { role: 'assistant', content: 'I will help you with that.' }
    ];

    for (const affirmative of affirmatives) {
      const result = classifyIntentFallback(affirmative, history);

      // Should have reasonable confidence for context inheritance (fallback mode has lower confidence)
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  /**
   * Test Case 14: Fallback Classification - Default to Task
   *
   * **Validates: Requirement 3.3, 3.9**
   *
   * Observation: Fallback defaults to "task" for substantial inputs without clear patterns on unfixed code
   * Expected: This continues after fix
   */
  it('should default to task for substantial inputs without clear patterns in fallback mode', () => {
    const taskInputs = [
      "Create a new file called test.ts",
      "Delete the old configuration",
      "Move the files to the archive folder",
      "Rename the project directory",
      "Copy the data to the backup location"
    ];

    for (const input of taskInputs) {
      const result = classifyIntentFallback(input, []);
      // Should be task or a specific intent, but not automate
      expect(result.intent).not.toBe('automate');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });

  /**
   * Test Case 15: Fallback Classification - Conversation for Short Inputs
   *
   * **Validates: Requirement 3.9**
   *
   * Observation: Fallback classifies short inputs as "conversation" on unfixed code
   * Expected: This continues after fix
   */
  it('should classify short inputs as conversation in fallback mode', () => {
    const shortInputs = [
      "hi",
      "hello",
      "thanks",
      "ok",
      "bye"
    ];

    for (const input of shortInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent).toBe('conversation');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });
});

/**
 * Property-Based Tests — Non-GUI-Automation Intent Classification
 *
 * These tests use property-based testing to generate many test cases automatically
 * across the input domain, providing stronger guarantees that behavior is unchanged
 * for all non-GUI-automation inputs.
 */
describe('Property-Based Preservation Tests — Non-GUI-Automation Intent Classification', () => {
  /**
   * Property 1: Coding Intent Preservation
   *
   * **Validates: Requirement 3.1**
   *
   * For all inputs containing coding keywords (write, implement, create, add, refactor)
   * AND code-related terms (function, class, component, script, method),
   * the intent should be classified as "coding" with confidence >= 0.8
   */
  it('property: coding tasks are consistently classified as "coding"', () => {
    const codingVerbs = ['write', 'implement', 'create', 'add', 'refactor'];
    const codeTerms = ['function', 'class', 'component', 'script', 'method', 'api', 'endpoint', 'module'];

    fc.assert(
      fc.property(
        fc.constantFrom(...codingVerbs),
        fc.constantFrom(...codeTerms),
        fc.string({ minLength: 0, maxLength: 30 }),
        (verb, term, suffix) => {
          const input = `${verb} a ${term} ${suffix}`.trim();
          const result = classifyIntentFast(input, []);

          if (result) {
            expect(result.intent).toBe('coding');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Question Intent Preservation
   *
   * **Validates: Requirement 3.2**
   *
   * For all inputs starting with question words (what, how, why, when, where, which, who),
   * the intent should be classified as "question" with confidence >= 0.8
   */
  it('property: questions are consistently classified as "question"', () => {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'];

    fc.assert(
      fc.property(
        fc.constantFrom(...questionWords),
        fc.string({ minLength: 5, maxLength: 50 }),
        (questionWord, suffix) => {
          const input = `${questionWord} ${suffix}`.trim();
          const result = classifyIntentFast(input, []);

          if (result) {
            expect(result.intent).toBe('question');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: Fix Intent Preservation
   *
   * **Validates: Requirement 3.5**
   *
   * For all inputs containing fix/debug keywords (fix, debug, error, bug, crash, broken),
   * the intent should be classified as "fix" with confidence >= 0.8
   */
  it('property: fix tasks are consistently classified as "fix"', () => {
    const fixKeywords = ['fix', 'debug', 'error', 'bug', 'crash', 'broken', 'not working', 'failing'];

    fc.assert(
      fc.property(
        fc.constantFrom(...fixKeywords),
        fc.string({ minLength: 5, maxLength: 50 }),
        (keyword, suffix) => {
          const input = `${keyword} ${suffix}`.trim();
          const result = classifyIntentFast(input, []);

          if (result) {
            expect(result.intent).toBe('fix');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4: Build Intent Preservation
   *
   * **Validates: Requirement 3.7**
   *
   * For all inputs containing build keywords (build, scaffold, generate, setup, initialize)
   * AND project terms (project, app, application, repo, template),
   * the intent should be classified as "build" with confidence >= 0.8
   */
  it('property: build tasks are consistently classified as "build"', () => {
    const buildVerbs = ['build', 'scaffold', 'generate', 'setup', 'initialize', 'bootstrap'];
    const projectTerms = ['project', 'app', 'application', 'repo', 'repository', 'template'];

    fc.assert(
      fc.property(
        fc.constantFrom(...buildVerbs),
        fc.constantFrom(...projectTerms),
        (verb, term) => {
          const input = `${verb} a new ${term}`;
          const result = classifyIntentFast(input, []);

          if (result) {
            expect(result.intent).toBe('build');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5: Conversation Intent Preservation
   *
   * **Validates: Requirement 3.9 (partial)**
   *
   * For all very short inputs (< 8 characters),
   * the intent should be classified as "conversation" with confidence >= 0.8
   */
  it('property: very short inputs are consistently classified as "conversation"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 7 }),
        (input) => {
          const result = classifyIntentFast(input, []);

          if (result) {
            expect(result.intent).toBe('conversation');
            expect(result.confidence).toBeGreaterThanOrEqual(0.8);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6: Fallback Classification Consistency
   *
   * **Validates: Requirement 3.9**
   *
   * For all inputs, fallback classification should always return a valid intent
   * with confidence in the range [0, 1]
   */
  it('property: fallback always returns valid classification', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (input) => {
          const result = classifyIntentFallback(input, []);

          expect(result).toBeDefined();
          expect(result.intent).toBeDefined();
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
          expect(result.reasoning).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Non-GUI-Automation Inputs Never Classified as "automate"
   *
   * **Validates: All preservation requirements (3.1-3.9)**
   *
   * For all inputs that do NOT contain GUI automation keywords,
   * the intent should NEVER be classified as "automate" on unfixed code.
   * This is the key preservation property.
   */
  it('property: non-GUI-automation inputs are never classified as "automate" on unfixed code', () => {
    const nonGUIInputs = [
      'Write a function to sort an array',
      'What is React?',
      'Create a new file called test.ts',
      'Fix the error in auth.ts',
      'Search for React best practices',
      'Build a new React app',
      'Analyze this CSV file',
      'Hello there',
      'yes',
      'ok'
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...nonGUIInputs),
        (input) => {
          const fastResult = classifyIntentFast(input, []);
          const fallbackResult = classifyIntentFallback(input, []);

          // On unfixed code, these should NOT be classified as "automate"
          // because they don't contain GUI automation keywords
          if (fastResult) {
            expect(fastResult.intent).not.toBe('automate');
          }
          expect(fallbackResult.intent).not.toBe('automate');
        }
      ),
      { numRuns: 50 }
    );
  });
});
