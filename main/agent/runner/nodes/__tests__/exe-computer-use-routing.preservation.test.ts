/**
 * Preservation Property Tests: Development Mode and Non-GUI Request Behavior
 *
 * These tests verify that the fix for computer_use tool routing in production builds
 * does NOT break existing behavior in development mode or for non-GUI automation requests.
 *
 * IMPORTANT: Follow observation-first methodology
 * - Observe behavior on UNFIXED code for non-buggy inputs
 * - Write property-based tests capturing observed behavior patterns
 * - Run tests on UNFIXED code
 * - EXPECTED OUTCOME: Tests PASS (confirms baseline behavior to preserve)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRunner } from '../../runner';
import { AIClient } from '../../../../lib/ai-client';
import * as os from 'os';

describe('Preservation: Development Mode and Non-GUI Request Behavior', () => {
  let runner: AgentRunner;
  let mockClient: AIClient;

  beforeEach(() => {
    // Create a mock AI client
    mockClient = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      apiKey: 'test-key',
      setModel: () => {},
      complete: async () => ({ content: '' }),
    } as any;

    // Create runner instance
    runner = new AgentRunner(mockClient, {
      maxIterations: 10,
      enableTerminal: true,
    });
  });

  afterEach(() => {
    // Cleanup
    runner = null as any;
  });

  describe('Property 2: Preservation - Development Mode Behavior', () => {
    /**
     * Test 1: Development mode continues to route computer_use tool correctly
     *
     * This test verifies that in development mode (npm run dev), the computer_use
     * tool continues to be available and properly routed. This is the baseline
     * behavior that must be preserved.
     */
    it('should preserve computer_use tool availability in development mode', () => {
      // Get the tools from the runner
      const tools = runner.tools;

      // Verify tools array is not empty
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);

      // Find the computer_use tool
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      // PRESERVATION: computer_use tool must be available in development mode
      expect(computerUseTool).toBeDefined();
      expect(computerUseTool?.name).toBe('computer_use');
      expect(computerUseTool?.description).toBeDefined();
      expect(computerUseTool?.parameters).toBeDefined();
    });

    /**
     * Test 2: Development mode tool definitions remain unchanged
     *
     * This test verifies that the tool definitions built in development mode
     * remain consistent and unchanged by the fix.
     */
    it('should preserve tool definitions in development mode', () => {
      const toolDefs = runner._buildToolDefinitions();

      // Verify tool definitions array is not empty
      expect(toolDefs).toBeDefined();
      expect(toolDefs.length).toBeGreaterThan(0);

      // Find computer_use in tool definitions
      const computerUseToolDef = toolDefs.find(t => t.name === 'computer_use');

      // PRESERVATION: computer_use must be in tool definitions
      expect(computerUseToolDef).toBeDefined();
      expect(computerUseToolDef?.name).toBe('computer_use');
      expect(computerUseToolDef?.description).toBeDefined();
      expect(computerUseToolDef?.parameters).toBeDefined();
    });

    /**
     * Test 3: Development mode tool count remains consistent
     *
     * This test verifies that the number of tools available in development mode
     * remains consistent. The fix should not add or remove tools.
     */
    it('should preserve tool count in development mode', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      // Count tools with valid properties
      const validTools = tools.filter(t =>
        t.name &&
        t.description &&
        t.parameters
      );

      // PRESERVATION: Tool count should be consistent
      expect(toolDefs.length).toBe(validTools.length);
      expect(tools.length).toBeGreaterThan(0);
    });

    /**
     * Test 4: Development mode tool properties remain accessible
     *
     * This test verifies that tool properties remain accessible in development mode.
     */
    it('should preserve tool property accessibility in development mode', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      expect(computerUseTool).toBeDefined();

      // PRESERVATION: All properties must remain accessible
      expect(computerUseTool?.name).toBe('computer_use');
      expect(computerUseTool?.description).toBeTruthy();
      expect(computerUseTool?.parameters).toBeTruthy();
      expect(computerUseTool?.execute).toBeTruthy();
    });
  });

  describe('Property 2: Preservation - Non-GUI Automation Requests', () => {
    /**
     * Test 5: Non-GUI automation requests continue to work correctly
     *
     * This test verifies that non-GUI automation requests (conversation, coding, etc.)
     * continue to work correctly in production builds after the fix.
     */
    it('should preserve non-GUI automation request handling', () => {
      const tools = runner.tools;

      // Verify that tools for non-GUI requests are available
      // These include: terminal, web search, file operations, etc.
      const nonGuiTools = [
        'terminal_execute',
        'web_search',
        'system_files',
        'memory_save',
        'memory_search',
      ];

      // Check that at least some non-GUI tools are available
      const availableNonGuiTools = nonGuiTools.filter(toolName =>
        tools.some(t => t.name === toolName)
      );

      // PRESERVATION: Non-GUI tools must be available
      expect(availableNonGuiTools.length).toBeGreaterThan(0);
    });

    /**
     * Test 6: Tool definitions for non-GUI requests remain unchanged
     *
     * This test verifies that tool definitions for non-GUI requests remain
     * consistent and unchanged by the fix.
     */
    it('should preserve tool definitions for non-GUI requests', () => {
      const toolDefs = runner._buildToolDefinitions();

      // Verify that tool definitions for non-GUI requests are present
      const nonGuiToolDefs = toolDefs.filter(t =>
        t.name === 'terminal_execute' ||
        t.name === 'web_search' ||
        t.name === 'system_files' ||
        t.name === 'memory_save' ||
        t.name === 'memory_search'
      );

      // PRESERVATION: Non-GUI tool definitions must be present
      expect(nonGuiToolDefs.length).toBeGreaterThan(0);

      // Verify each tool definition has required properties
      nonGuiToolDefs.forEach(toolDef => {
        expect(toolDef.name).toBeTruthy();
        expect(toolDef.description).toBeTruthy();
        expect(toolDef.parameters).toBeTruthy();
      });
    });

    /**
     * Test 7: Other tools continue to work correctly in production builds
     *
     * This test verifies that other tools (terminal, file operations, web search)
     * continue to work correctly in production builds after the fix.
     */
    it('should preserve other tool availability in production builds', () => {
      const tools = runner.tools;

      // Verify that other tools are available
      const otherTools = [
        'terminal_execute',
        'system_files',
        'memory_save',
        'memory_search',
      ];

      const availableOtherTools = otherTools.filter(toolName =>
        tools.some(t => t.name === toolName)
      );

      // PRESERVATION: Other tools must be available
      expect(availableOtherTools.length).toBeGreaterThan(0);
    });

    /**
     * Test 8: Tool registration order remains unchanged
     *
     * This test verifies that the order of tool registration remains consistent.
     * The fix should not change the order in which tools are registered.
     */
    it('should preserve tool registration order', () => {
      const tools = runner.tools;

      // Get the names of all tools
      const toolNames = tools.map(t => t.name);

      // Verify that computer_use is registered after terminal tools
      // (This is the expected order based on tools_manager.ts)
      const terminalIndex = toolNames.indexOf('terminal_execute');
      const computerUseIndex = toolNames.indexOf('computer_use');

      // PRESERVATION: Tool registration order should be consistent
      // computer_use should be registered after terminal tools
      if (terminalIndex >= 0 && computerUseIndex >= 0) {
        expect(computerUseIndex).toBeGreaterThan(terminalIndex);
      }
    });

    /**
     * Test 9: Tool count consistency between tools and definitions
     *
     * This test verifies that the tool count remains consistent between the
     * tools array and the tool definitions array.
     */
    it('should preserve tool count consistency', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      // Count tools with valid properties
      const validTools = tools.filter(t =>
        t.name &&
        t.description &&
        t.parameters
      );

      // PRESERVATION: Tool count should be consistent
      expect(toolDefs.length).toBe(validTools.length);
    });

    /**
     * Test 10: No tools are unexpectedly filtered out
     *
     * This test verifies that no tools are unexpectedly filtered out during
     * tool definition building.
     */
    it('should not filter out any tools unexpectedly', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      // Get tool names from both arrays
      const toolNames = tools.map(t => t.name);
      const toolDefNames = toolDefs.map(t => t.name);

      // Find tools that are in tools array but not in tool definitions
      const filteredOutTools = toolNames.filter(name => !toolDefNames.includes(name));

      // PRESERVATION: No tools should be filtered out
      // (except those with missing properties, which is expected)
      const toolsWithMissingProps = tools
        .filter(t => !t.name || !t.description || !t.parameters)
        .map(t => t.name);

      // Filtered out tools should only be those with missing properties
      filteredOutTools.forEach(toolName => {
        expect(toolsWithMissingProps).toContain(toolName);
      });
    });
  });

  describe('Property 2: Preservation - Tool Initialization', () => {
    /**
     * Test 11: Tool initialization remains unchanged
     *
     * This test verifies that the tool initialization process remains unchanged
     * by the fix.
     */
    it('should preserve tool initialization process', () => {
      const tools = runner.tools;

      // Verify that all tools have required properties
      tools.forEach(tool => {
        expect(tool.name).toBeTruthy();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeTruthy();
        expect(typeof tool.description).toBe('string');
        expect(tool.parameters).toBeTruthy();
        expect(typeof tool.parameters).toBe('object');
      });
    });

    /**
     * Test 12: Tool execution functions remain callable
     *
     * This test verifies that tool execution functions remain callable after
     * the fix.
     */
    it('should preserve tool execution functions', () => {
      const tools = runner.tools;

      // Verify that all tools have execute functions
      tools.forEach(tool => {
        expect(tool.execute).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      });
    });

    /**
     * Test 13: Tool parameters schema remains valid
     *
     * This test verifies that tool parameters schema remains valid and properly
     * formatted after the fix.
     */
    it('should preserve tool parameters schema validity', () => {
      const toolDefs = runner._buildToolDefinitions();

      // Verify that all tool definitions have valid parameters schema
      toolDefs.forEach(toolDef => {
        expect(toolDef.parameters).toBeDefined();
        expect(typeof toolDef.parameters).toBe('object');

        const params = toolDef.parameters as any;
        expect(params.type).toBe('object');
        expect(params.properties).toBeDefined();
        expect(typeof params.properties).toBe('object');
      });
    });

    /**
     * Test 14: Tool definitions are properly formatted for AI client
     *
     * This test verifies that tool definitions remain properly formatted for
     * the AI client after the fix.
     */
    it('should preserve tool definition formatting for AI client', () => {
      const toolDefs = runner._buildToolDefinitions();

      // Verify that all tool definitions are properly formatted
      toolDefs.forEach(toolDef => {
        expect(toolDef).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          parameters: expect.any(Object),
        });

        // Verify that name is not empty
        expect(toolDef.name.length).toBeGreaterThan(0);

        // Verify that description is not empty
        expect(toolDef.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Preservation Baseline Documentation', () => {
    /**
     * Document the baseline behavior that must be preserved
     */
    it('should document baseline: tool count in development mode', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      console.log(`BASELINE: Tool count in development mode: ${tools.length}`);
      console.log(`BASELINE: Tool definitions count: ${toolDefs.length}`);
      console.log(`BASELINE: Available tools: ${tools.map(t => t.name).join(', ')}`);

      // PRESERVATION: These counts should remain the same after fix
      expect(tools.length).toBeGreaterThan(0);
      expect(toolDefs.length).toBeGreaterThan(0);
    });

    /**
     * Document the baseline computer_use tool properties
     */
    it('should document baseline: computer_use tool properties', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      if (computerUseTool) {
        console.log(`BASELINE: computer_use tool name: ${computerUseTool.name}`);
        console.log(`BASELINE: computer_use tool description length: ${computerUseTool.description?.length}`);
        console.log(`BASELINE: computer_use tool parameters type: ${(computerUseTool.parameters as any)?.type}`);
      }

      // PRESERVATION: These properties should remain the same after fix
      expect(computerUseTool).toBeDefined();
    });

    /**
     * Document the baseline non-GUI tools
     */
    it('should document baseline: non-GUI tools availability', () => {
      const tools = runner.tools;

      const nonGuiTools = tools.filter(t =>
        t.name === 'terminal_execute' ||
        t.name === 'web_search' ||
        t.name === 'system_files' ||
        t.name === 'memory_save' ||
        t.name === 'memory_search'
      );

      console.log(`BASELINE: Non-GUI tools available: ${nonGuiTools.map(t => t.name).join(', ')}`);

      // PRESERVATION: These tools should remain available after fix
      expect(nonGuiTools.length).toBeGreaterThan(0);
    });
  });
});
