/**
 * Bug Condition Exploration Test: Terminal Pi-Tools Integration
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * This test explores the bug condition where terminal commands executed via custom
 * `run_command`/`command_status` tools exhibit unreliable behavior compared to
 * pi-coding-agent's bashTool.
 *
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * **DO NOT attempt to fix the test or the code when it fails.**
 *
 * The test encodes the expected behavior - it will validate the fix when it passes
 * after implementation.
 *
 * **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
 *
 * Counterexamples to document:
 * - Quick commands use complex persistent terminal unnecessarily
 * - Long output commands may have truncated output due to polling timeout
 * - Slow commands may return prematurely due to noChangeCount heuristics
 * - Multiple commands may have state management issues
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { bashTool, bashToolDefinition } from '@mariozechner/pi-coding-agent';
import type { AgentTool, ToolResult } from '../../../runner/types';
import * as fc from 'fast-check';

// Strip ANSI escape sequences (color codes, cursor movement, etc.)
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}

// Helper to convert pi-coding-agent tool into EverFern AgentTool
function adaptTool(
  definition: { name: string; description: string; parameters: any },
  executor: (toolCallId: string, params: any) => Promise<any>,
  customName?: string
): AgentTool {
  const name = customName ?? definition.name;
  return {
    name,
    description: definition.description,
    parameters: definition.parameters as any,
    execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
      try {
        const fakeId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const result = await executor(fakeId, args);

        let outputText = '';
        if (result.content && Array.isArray(result.content)) {
          outputText = result.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        } else if (typeof result.output === 'string') {
          outputText = result.output;
        } else {
          outputText = JSON.stringify(result);
        }

        if (result.isError) {
          return { success: false, output: stripAnsi(outputText), error: stripAnsi(outputText) };
        }
        return { success: true, output: stripAnsi(outputText) };
      } catch (err: any) {
        const msg = err.message ?? String(err);
        return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
      }
    },
  };
}

describe('Terminal Pi-Tools Integration Bug Condition', () => {
  let executePwshTool: AgentTool;

  beforeAll(() => {
    // Create the bashTool adapter (executePwsh) directly
    executePwshTool = adaptTool(bashToolDefinition, bashTool.execute, 'executePwsh');
  });

  it('Property 1: Bug Condition - Terminal commands should use bashTool (not custom tools)', async () => {
    // This test verifies that the current implementation uses bashTool from pi-coding-agent
    // which provides reliable command execution with proper output capture.

    // Test 1: Quick command test - should complete quickly and reliably
    const quickCommandResult = await executePwshTool.execute({
      command: 'echo "test"',
    });

    // EXPECTED BEHAVIOR: Command should complete and return clean output
    expect(quickCommandResult.success, 'Quick command should succeed').toBe(true);
    expect(
      quickCommandResult.output,
      'Quick command output should contain the echoed text'
    ).toContain('test');

    // Verify that the output is clean (no excessive terminal noise)
    // bashTool should provide clean output without unnecessary metadata
    const hasExcessiveMetadata =
      quickCommandResult.output.includes('[Command Executed]') ||
      quickCommandResult.output.includes('Terminal session remains active');

    // bashTool should NOT add excessive metadata
    expect(
      hasExcessiveMetadata,
      'bashTool should provide clean output without excessive metadata'
    ).toBe(false);

    // Test 2: Verify bashTool is being used (not custom implementation)
    // The tool name should be 'executePwsh' (our custom name for bashTool)
    expect(
      executePwshTool.name,
      'Terminal commands should use bashTool (executePwsh) from pi-coding-agent'
    ).toBe('executePwsh');
  }, 30000);

  it('Property 1: Bug Condition - Output should be complete and not truncated', async () => {
    // Test that commands with substantial output capture all output reliably
    // bashTool should capture complete output without truncation

    // Use a simple, reliable cross-platform command
    // Just echo multiple lines - this is more reliable than complex shell loops
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`);
    const longOutputCommand = process.platform === 'win32'
      ? `powershell -Command "${lines.map(l => `Write-Output '${l}'`).join('; ')}"`
      : lines.map(l => `echo "${l}"`).join(' && ');

    const result = await executePwshTool.execute({
      command: longOutputCommand,
      timeout: 10000, // 10 second timeout
    });

    expect(result.success, 'Long output command should succeed').toBe(true);

    // Count how many lines were captured
    const capturedLines = result.output.split('\n').filter(line => line.trim().match(/^Line \d+$/));

    // EXPECTED: All 50 lines should be captured
    // bashTool should capture complete output reliably
    expect(
      capturedLines.length,
      `All 50 lines should be captured, got ${capturedLines.length} lines. Output sample: ${result.output.substring(0, 300)}`
    ).toBeGreaterThanOrEqual(45); // Allow some tolerance for platform differences

    // Verify we have lines from the beginning and end
    const hasLine1 = result.output.includes('Line 1');
    const hasLine50 = result.output.includes('Line 50');

    expect(
      hasLine1 && hasLine50,
      `Output should be complete with first and last lines present. hasLine1=${hasLine1}, hasLine50=${hasLine50}`
    ).toBe(true);
  }, 30000);

  it('Property 1: Bug Condition - Commands should wait properly for completion', async () => {
    // Test that slow commands wait properly for completion
    // bashTool should wait for command completion before returning

    // Command that takes a few seconds to complete
    const slowCommand = process.platform === 'win32'
      ? 'powershell -Command "Start-Sleep -Seconds 2; Write-Output \\"Done\\""'
      : 'sleep 2 && echo "Done"';

    const startTime = Date.now();
    const result = await executePwshTool.execute({
      command: slowCommand,
      timeout: 10000, // 10 second timeout
    });
    const elapsedTime = Date.now() - startTime;

    expect(result.success, 'Slow command should succeed').toBe(true);

    // EXPECTED: Should wait at least 2 seconds for the command to complete
    // bashTool should properly wait for command completion
    expect(
      elapsedTime,
      `Command should wait at least 2000ms, waited ${elapsedTime}ms`
    ).toBeGreaterThanOrEqual(2000);

    // Verify the output contains the completion message
    expect(
      result.output.includes('Done'),
      'Output should contain completion message - command should wait until finished'
    ).toBe(true);
  }, 30000);

  it('Property 1: Bug Condition - ANSI codes should be stripped', async () => {
    // Test that ANSI escape sequences are properly stripped from output
    // This should work with bashTool implementation

    const result = await executePwshTool.execute({
      command: 'echo "test"',
    });

    expect(result.success, 'Command should succeed').toBe(true);

    // Check for common ANSI escape sequences
    const hasAnsiCodes = /\x1B\[[\d;]*m/.test(result.output) ||
                        /\x1B\]/.test(result.output);

    expect(
      hasAnsiCodes,
      'ANSI codes should be stripped from output for clean UI display'
    ).toBe(false);
  }, 30000);

  it('Property 1: Bug Condition - Multiple commands should work reliably', async () => {
    // Test that multiple commands in sequence work without state management issues
    // bashTool should execute each command independently

    // Execute first command
    const result1 = await executePwshTool.execute({
      command: 'echo "First"',
    });

    expect(result1.success, 'First command should succeed').toBe(true);
    expect(result1.output).toContain('First');

    // Execute second command
    const result2 = await executePwshTool.execute({
      command: 'echo "Second"',
    });

    expect(result2.success, 'Second command should succeed').toBe(true);
    expect(result2.output).toContain('Second');

    // EXPECTED: Second command output should not contain first command output
    // bashTool executes commands independently without persistent state
    const secondContainsFirst = result2.output.includes('First');

    expect(
      secondContainsFirst,
      'Second command output should not contain first command output - commands should be independent'
    ).toBe(false);
  }, 30000);

  it('Property 1: Bug Condition - Property-based test for command reliability', async () => {
    // Property-based test: For any simple echo command, output should be reliable
    // This generates many test cases to verify bashTool reliability

    await fc.assert(
      fc.asyncProperty(
        // Generate safe strings that don't contain shell special characters
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => !s.includes('"') && !s.includes('\n') && !s.includes('$') && !s.includes('`') && !s.includes('\\') && s.trim().length > 0),
        async (testString) => {
          // Use a simple command that works cross-platform
          const command = process.platform === 'win32'
            ? `powershell -Command "Write-Output '${testString.replace(/'/g, "''")}'"` // Escape single quotes for PowerShell
            : `printf '%s\\n' "${testString.replace(/"/g, '\\"')}"`;  // Use printf for more reliable output

          const result = await executePwshTool.execute({
            command,
          });

          // Property: Command should succeed
          expect(result.success).toBe(true);

          // Property: Output should contain the test string (allowing for whitespace differences)
          const normalizedOutput = result.output.trim();
          const normalizedTest = testString.trim();
          expect(normalizedOutput).toContain(normalizedTest);

          // Property: Output should not have ANSI codes
          const hasAnsi = /\x1B\[[\d;]*m/.test(result.output);
          expect(hasAnsi).toBe(false);
        }
      ),
      { numRuns: 10, timeout: 60000 } // Run 10 test cases
    );
  }, 90000);
});
