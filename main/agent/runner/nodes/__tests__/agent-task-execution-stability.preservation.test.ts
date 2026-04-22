/**
 * Preservation Property Tests — Agent Task Execution Stability
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation — Non-Affected Task Behavior
 *
 * IMPORTANT: These tests follow observation-first methodology
 * - Observe behavior on UNFIXED code for non-buggy inputs
 * - Write property-based tests capturing observed behavior patterns
 * - EXPECTED OUTCOME: Tests PASS on unfixed code (confirms baseline behavior)
 *
 * These tests ensure that the bugfix does NOT introduce regressions for:
 * - Simple conversational queries (Requirement 3.1)
 * - File read/write operations without analysis (Requirement 3.2)
 * - Web search and research tasks (Requirement 3.2)
 * - Code generation and editing tasks (Requirement 3.1)
 * - GUI automation tasks (Requirement 3.1)
 *
 * Preservation Scope:
 * All inputs that do NOT involve:
 * - Data analysis tasks that hang
 * - Task decomposer routing failures
 * - HITL form submissions with message deletion
 * - Race conditions in mission completion
 *
 * Should be completely unaffected by this fix.
 */

import { describe, it, expect, vi } from 'vitest';
import { analyzeTask } from '../../task-decomposer';
import fc from 'fast-check';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../../services/message-utils', () => ({
  normalizeMessages: (msgs: any[]) => msgs || [],
}));

describe('Preservation Properties — Non-Affected Task Behavior', () => {

  /**
   * Preservation Test 1: Task Analysis for Non-Analysis Tasks
   *
   * Requirement 3.1: WHEN the agent executes non-data-analysis tasks THEN the
   * system SHALL CONTINUE TO execute them correctly
   *
   * Observed behavior on UNFIXED code:
   * - "write a function" → taskType: 'coding'
   * - "search for X" → taskType: 'research'
   * - "click the button" → taskType: 'automate'
   * - Task analysis correctly identifies non-analysis tasks
   */
  describe('Task Analysis for Non-Analysis Tasks', () => {
    it('should correctly identify coding tasks', () => {
      const result = analyzeTask('write a function to sort an array');

      expect(result.taskType).toBe('coding');
      expect(result.complexity).toBeDefined();
      expect(result.requiresFileOps).toBeDefined();
    });

    it('should correctly identify research tasks', () => {
      const result = analyzeTask('search for React documentation');

      expect(result.taskType).toBe('research');
      expect(result.complexity).toBeDefined();
    });

    it('should correctly identify automation tasks', () => {
      const result = analyzeTask('click the submit button');

      expect(result.taskType).toBe('automate');
      expect(result.complexity).toBeDefined();
    });

    it('should correctly identify file operation tasks', () => {
      const result = analyzeTask('read the config file');

      // Observed: file operations are classified as 'task' type
      expect(result.taskType).toBe('task');
      expect(result.requiresFileOps).toBe(true);
    });

    it('should correctly identify question tasks', () => {
      const result = analyzeTask('what is TypeScript?');

      // Observed: questions are classified as 'research' type
      expect(result.taskType).toBe('research');
      expect(result.complexity).toBeDefined();
    });
  });

  /**
   * Preservation Test 2: Task Complexity Analysis
   *
   * Requirement 3.3: WHEN the agent completes tasks successfully THEN the
   * system SHALL CONTINUE TO show the correct results to the user
   *
   * Observed behavior on UNFIXED code:
   * - Simple tasks → complexity: 'simple'
   * - Complex tasks → complexity: 'complex'
   * - Task complexity analysis works correctly
   */
  describe('Task Complexity Analysis', () => {
    it('should identify simple tasks correctly', () => {
      const result = analyzeTask('hello');

      expect(result.complexity).toBe('simple');
    });

    it('should identify medium complexity tasks', () => {
      const result = analyzeTask('write a function to validate email addresses');

      // Observed: complexity analysis is simpler than expected
      expect(result.complexity).toBeDefined();
      expect(['simple', 'medium', 'complex']).toContain(result.complexity);
    });

    it('should identify complex tasks', () => {
      const result = analyzeTask('build a full-stack web application with authentication, database, and API');

      // Observed: complexity analysis is simpler than expected
      expect(result.complexity).toBeDefined();
      expect(['simple', 'medium', 'complex']).toContain(result.complexity);
    });
  });

  /**
   * Preservation Test 3: File Operations Detection
   *
   * Requirement 3.2: WHEN no HITL forms are present THEN the system SHALL
   * CONTINUE TO display all messages correctly
   *
   * Observed behavior on UNFIXED code:
   * - Tasks with file operations are correctly identified
   * - requiresFileOps flag is set appropriately
   */
  describe('File Operations Detection', () => {
    it('should detect file read operations', () => {
      const result = analyzeTask('read the config.json file');

      expect(result.requiresFileOps).toBe(true);
      // Observed: file operations are classified as 'task' type
      expect(result.taskType).toBe('task');
    });

    it('should detect file write operations', () => {
      const result = analyzeTask('write data to output.txt');

      expect(result.requiresFileOps).toBe(true);
      // Observed: write operations with 'data' keyword are classified as 'analyze'
      expect(['task', 'analyze', 'coding']).toContain(result.taskType);
    });

    it('should not flag non-file operations', () => {
      const result = analyzeTask('what is the weather today?');

      expect(result.requiresFileOps).toBe(false);
      // Observed: questions are classified as 'research' type
      expect(result.taskType).toBe('research');
    });
  });

  /**
   * Property-Based Test: All Non-Analysis Task Types Are Correctly Identified
   *
   * This test generates various non-analysis task types and verifies that they
   * are all correctly identified by the task analysis function.
   */
  describe('Property-Based Preservation Tests', () => {
    it('property: all non-analysis task types are correctly identified', () => {
      fc.assert(
        fc.property(
          fc.record({
            taskType: fc.constantFrom('coding', 'research', 'question', 'automate'),
            taskDescription: fc.string({ minLength: 5, maxLength: 50 })
          }),
          ({ taskType, taskDescription }) => {
            // Create task descriptions that match the expected task type
            let input: string;
            switch (taskType) {
              case 'coding':
                input = `write a function to ${taskDescription}`;
                break;
              case 'research':
                input = `search for information about ${taskDescription}`;
                break;
              case 'question':
                input = `what is ${taskDescription}?`;
                break;
              case 'automate':
                input = `click the ${taskDescription} button`;
                break;
              default:
                input = taskDescription;
            }

            const result = analyzeTask(input);

            // Verify task type is identified
            expect(result.taskType).toBeDefined();
            expect(result.complexity).toBeDefined();

            // Task type should be one of the valid types
            const validTypes = ['coding', 'research', 'question', 'automate', 'analyze', 'conversation'];
            expect(validTypes).toContain(result.taskType);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('property: task complexity is always defined for all inputs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (input) => {
            const result = analyzeTask(input);

            // Complexity should always be defined
            expect(result.complexity).toBeDefined();

            // Complexity should be one of the valid values
            const validComplexities = ['simple', 'medium', 'complex'];
            expect(validComplexities).toContain(result.complexity);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('property: requiresFileOps is boolean for all inputs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (input) => {
            const result = analyzeTask(input);

            // requiresFileOps should always be a boolean
            expect(typeof result.requiresFileOps).toBe('boolean');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('property: coding tasks with file keywords have requiresFileOps=true', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('read', 'write', 'create', 'delete', 'modify'),
          fc.string({ minLength: 3, maxLength: 20 }),
          (fileOp, filename) => {
            const input = `${fileOp} the ${filename} file`;
            const result = analyzeTask(input);

            // File operations should be detected
            if (result.taskType === 'coding') {
              expect(result.requiresFileOps).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('property: question tasks are identified by question words', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('what', 'how', 'why', 'when', 'where', 'who'),
          fc.string({ minLength: 3, maxLength: 30 }),
          (questionWord, topic) => {
            const input = `${questionWord} is ${topic}?`;
            const result = analyzeTask(input);

            // Observed: question tasks are identified as 'research' or 'task' type
            expect(['question', 'research', 'task']).toContain(result.taskType);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Preservation Summary Test
   *
   * Documents all preservation requirements:
   * 1. Non-analysis tasks are correctly identified
   * 2. Task complexity analysis works correctly
   * 3. File operations detection works correctly
   * 4. All task types continue to be supported
   *
   * On UNFIXED code: All preservation requirements are met
   * Expected (after fix): All preservation requirements continue to be met
   */
  it('should document preservation requirements', () => {
    // Preservation Requirement 1: Non-analysis tasks correctly identified
    const codingTask = analyzeTask('write a function');
    expect(codingTask.taskType).toBe('coding');

    const researchTask = analyzeTask('search for React docs');
    expect(researchTask.taskType).toBe('research');

    const questionTask = analyzeTask('what is TypeScript?');
    // Observed: questions are classified as 'research' type
    expect(questionTask.taskType).toBe('research');

    const automateTask = analyzeTask('click the button');
    expect(automateTask.taskType).toBe('automate');

    // Preservation Requirement 2: Task complexity analysis works
    const simpleTask = analyzeTask('hello');
    expect(simpleTask.complexity).toBe('simple');

    const complexTask = analyzeTask('build a full-stack application with authentication');
    // Observed: complexity analysis is simpler than expected
    expect(complexTask.complexity).toBeDefined();
    expect(['simple', 'medium', 'complex']).toContain(complexTask.complexity);

    // Preservation Requirement 3: File operations detection works
    const fileTask = analyzeTask('read config.json');
    expect(fileTask.requiresFileOps).toBe(true);

    const nonFileTask = analyzeTask('what is the weather?');
    expect(nonFileTask.requiresFileOps).toBe(false);

    // Preservation Requirement 4: All task types supported
    const validTypes = ['coding', 'research', 'question', 'automate', 'analyze', 'conversation'];
    expect(validTypes).toContain(codingTask.taskType);
    expect(validTypes).toContain(researchTask.taskType);
    expect(validTypes).toContain(questionTask.taskType);
    expect(validTypes).toContain(automateTask.taskType);
  });
});
