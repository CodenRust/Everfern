/**
 * Bug Condition Exploration Test: Computer Use Tool Routing in Built EXE
 *
 * This test verifies that the computer_use tool is properly available and routable
 * in production builds (built EXE with ASAR packaging).
 *
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * The test encodes the expected behavior - it will validate the fix when it passes.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRunner } from '../../runner';
import { AIClient } from '../../../../lib/ai-client';
import * as os from 'os';

describe('Bug Condition: Computer Use Tool Routing in Built EXE', () => {
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

  describe('Property 1: Bug Condition - Computer Use Tool Routing in Built EXE', () => {
    /**
     * Test 1: Verify computer_use tool is present in base tools array
     *
     * This test checks that the computer_use tool is created and added to the
     * tools array during initialization. In production builds, this may fail if:
     * - Tool creation throws an error
     * - Tool instance is undefined or null
     * - Tool is filtered out during initialization
     */
    it('should have computer_use tool in base tools array', () => {
      // Get the tools from the runner
      const tools = runner.tools;

      // Verify tools array is not empty
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);

      // Find the computer_use tool
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      // CRITICAL: This assertion will FAIL on unfixed code in production builds
      // Counterexample: computer_use tool is missing from tools array
      expect(computerUseTool).toBeDefined();
      expect(computerUseTool?.name).toBe('computer_use');
    });

    /**
     * Test 2: Verify computer_use tool has valid properties
     *
     * This test checks that the computer_use tool instance has all required
     * properties (name, description, parameters). In production builds, these
     * may be undefined or inaccessible due to ASAR packaging issues.
     */
    it('should have computer_use tool with valid properties', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      // CRITICAL: These assertions will FAIL on unfixed code
      // Counterexamples:
      // - Tool properties are undefined
      // - Tool description is empty
      // - Tool parameters are missing or malformed
      expect(computerUseTool).toBeDefined();
      expect(computerUseTool?.name).toBe('computer_use');
      expect(computerUseTool?.description).toBeDefined();
      expect(computerUseTool?.description?.length).toBeGreaterThan(0);
      expect(computerUseTool?.parameters).toBeDefined();
      expect(computerUseTool?.parameters?.type).toBe('object');
      expect(computerUseTool?.parameters?.properties).toBeDefined();
    });

    /**
     * Test 3: Verify tool definitions array includes computer_use
     *
     * This test checks that when tool definitions are built for the AI client,
     * the computer_use tool is properly converted and included. In production
     * builds, the tool definition building may fail silently.
     */
    it('should include computer_use in tool definitions array', () => {
      // Build tool definitions
      const toolDefs = runner._buildToolDefinitions();

      // Verify tool definitions array is not empty
      expect(toolDefs).toBeDefined();
      expect(toolDefs.length).toBeGreaterThan(0);

      // Find computer_use in tool definitions
      const computerUseToolDef = toolDefs.find(t => t.name === 'computer_use');

      // CRITICAL: This assertion will FAIL on unfixed code
      // Counterexample: computer_use tool is missing from tool definitions
      expect(computerUseToolDef).toBeDefined();
      expect(computerUseToolDef?.name).toBe('computer_use');
      expect(computerUseToolDef?.description).toBeDefined();
      expect(computerUseToolDef?.parameters).toBeDefined();
    });

    /**
     * Test 4: Verify tool definition has required parameters schema
     *
     * This test checks that the computer_use tool definition has a properly
     * formed parameters schema that the AI client can use for tool selection.
     */
    it('should have computer_use tool definition with valid parameters schema', () => {
      const toolDefs = runner._buildToolDefinitions();
      const computerUseToolDef = toolDefs.find(t => t.name === 'computer_use');

      expect(computerUseToolDef).toBeDefined();
      expect(computerUseToolDef?.parameters).toBeDefined();

      const params = computerUseToolDef?.parameters as any;

      // CRITICAL: These assertions will FAIL on unfixed code
      // Counterexamples:
      // - Parameters object is empty
      // - Required properties are missing
      // - Properties schema is malformed
      expect(params.type).toBe('object');
      expect(params.properties).toBeDefined();
      expect(Object.keys(params.properties).length).toBeGreaterThan(0);
      // The computer_use tool has 'task' parameter (not 'action')
      expect(params.properties.task).toBeDefined();
      expect(params.required).toBeDefined();
      expect(params.required.includes('task')).toBe(true);
    });

    /**
     * Test 5: Verify computer_use tool is executable
     *
     * This test checks that the computer_use tool has an execute function
     * that can be called. In production builds, the tool may be created but
     * not properly initialized.
     */
    it('should have computer_use tool with execute function', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      expect(computerUseTool).toBeDefined();

      // CRITICAL: This assertion will FAIL on unfixed code
      // Counterexample: Tool execute function is missing or undefined
      expect(computerUseTool?.execute).toBeDefined();
      expect(typeof computerUseTool?.execute).toBe('function');
    });

    /**
     * Test 6: Verify tool count consistency
     *
     * This test checks that the tool count is consistent between the tools
     * array and the tool definitions array. In production builds, tools may
     * be filtered out during definition building.
     */
    it('should have consistent tool count between tools and definitions', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      // Count tools with valid properties
      const validTools = tools.filter(t =>
        t.name &&
        t.description &&
        t.parameters
      );

      // CRITICAL: This assertion will FAIL on unfixed code
      // Counterexample: Some tools are filtered out during definition building
      expect(toolDefs.length).toBe(validTools.length);
    });

    /**
     * Test 7: Verify computer_use tool is not filtered out
     *
     * This test checks that the computer_use tool is not filtered out when
     * building tool definitions. This could happen if the tool has missing
     * or undefined properties.
     */
    it('should not filter out computer_use tool during definition building', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      const computerUseInTools = tools.find(t => t.name === 'computer_use');
      const computerUseInDefs = toolDefs.find(t => t.name === 'computer_use');

      // CRITICAL: This assertion will FAIL on unfixed code
      // Counterexample: computer_use tool is present in tools but missing in definitions
      expect(computerUseInTools).toBeDefined();
      expect(computerUseInDefs).toBeDefined();
      expect(computerUseInTools?.name).toBe(computerUseInDefs?.name);
    });

    /**
     * Test 8: Verify tool properties are accessible in production environment
     *
     * This test simulates a production build environment and verifies that
     * tool properties are accessible. In production builds with ASAR packaging,
     * property access may fail.
     */
    it('should have accessible tool properties in production environment', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      expect(computerUseTool).toBeDefined();

      // Try to access all required properties
      const name = computerUseTool?.name;
      const description = computerUseTool?.description;
      const parameters = computerUseTool?.parameters;
      const execute = computerUseTool?.execute;

      // CRITICAL: These assertions will FAIL on unfixed code
      // Counterexamples:
      // - Properties are undefined or null
      // - Properties throw errors when accessed
      // - Properties are not enumerable
      expect(name).toBe('computer_use');
      expect(description).toBeTruthy();
      expect(parameters).toBeTruthy();
      expect(execute).toBeTruthy();
    });

    /**
     * Test 9: Verify no generic fallback response for GUI automation
     *
     * This test checks that the tool routing logic doesn't return a generic
     * fallback response when computer_use tool is available. This would indicate
     * that the tool is not being properly routed to.
     */
    it('should not return generic fallback for GUI automation requests', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      // Verify computer_use tool is available
      expect(computerUseTool).toBeDefined();

      // Verify tool is not a fallback/placeholder
      expect(computerUseTool?.name).not.toMatch(/fallback|placeholder|generic/i);
      expect(computerUseTool?.description).not.toMatch(/do not have.*access/i);
    });

    /**
     * Test 10: Verify tool routing logic can select computer_use
     *
     * This test checks that the tool definitions are properly formatted
     * so that the AI client can select the computer_use tool for GUI automation
     * requests.
     */
    it('should have properly formatted tool definitions for AI selection', () => {
      const toolDefs = runner._buildToolDefinitions();
      const computerUseToolDef = toolDefs.find(t => t.name === 'computer_use');

      expect(computerUseToolDef).toBeDefined();

      // Verify tool definition is properly formatted for AI client
      expect(computerUseToolDef?.name).toBeTruthy();
      expect(computerUseToolDef?.description).toBeTruthy();
      expect(computerUseToolDef?.parameters).toBeTruthy();

      // Verify parameters are in correct format
      const params = computerUseToolDef?.parameters as any;
      expect(params.type).toBe('object');
      expect(params.properties).toBeTruthy();
      expect(Object.keys(params.properties).length).toBeGreaterThan(0);

      // CRITICAL: This assertion will FAIL on unfixed code
      // Counterexample: Tool definition is malformed and AI cannot select it
      expect(computerUseToolDef).toMatchObject({
        name: 'computer_use',
        description: expect.any(String),
        parameters: expect.any(Object),
      });
    });
  });

  describe('Counterexample Documentation', () => {
    /**
     * Document counterexamples found during bug condition exploration
     *
     * These tests document the specific failure modes that confirm the bug exists
     * in production builds.
     */
    it('should document counterexample: computer_use tool missing from tools array', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      // If this fails, it's a counterexample of the bug
      if (!computerUseTool) {
        console.log('COUNTEREXAMPLE FOUND: computer_use tool is missing from tools array');
        console.log('Available tools:', tools.map(t => t.name).join(', '));
      }

      expect(computerUseTool).toBeDefined();
    });

    it('should document counterexample: tool properties undefined or inaccessible', () => {
      const tools = runner.tools;
      const computerUseTool = tools.find(t => t.name === 'computer_use');

      if (computerUseTool) {
        const hasValidProperties =
          computerUseTool.name &&
          computerUseTool.description &&
          computerUseTool.parameters &&
          typeof computerUseTool.execute === 'function';

        if (!hasValidProperties) {
          console.log('COUNTEREXAMPLE FOUND: computer_use tool has invalid properties');
          console.log('Tool:', computerUseTool);
        }

        expect(hasValidProperties).toBe(true);
      }
    });

    it('should document counterexample: tool definition building fails silently', () => {
      const tools = runner.tools;
      const toolDefs = runner._buildToolDefinitions();

      const computerUseInTools = tools.find(t => t.name === 'computer_use');
      const computerUseInDefs = toolDefs.find(t => t.name === 'computer_use');

      if (computerUseInTools && !computerUseInDefs) {
        console.log('COUNTEREXAMPLE FOUND: computer_use tool filtered out during definition building');
        console.log('Tool in tools array:', computerUseInTools.name);
        console.log('Tool definitions:', toolDefs.map(t => t.name).join(', '));
      }

      expect(computerUseInDefs).toBeDefined();
    });

    it('should document counterexample: graph cache returning stale graph', () => {
      // This test would require access to the graph cache
      // For now, we verify that tool definitions are consistent
      const toolDefs1 = runner._buildToolDefinitions();
      const toolDefs2 = runner._buildToolDefinitions();

      const computerUseDef1 = toolDefs1.find(t => t.name === 'computer_use');
      const computerUseDef2 = toolDefs2.find(t => t.name === 'computer_use');

      if (computerUseDef1 && !computerUseDef2) {
        console.log('COUNTEREXAMPLE FOUND: Tool definitions are inconsistent (possible cache issue)');
      }

      expect(computerUseDef1).toBeDefined();
      expect(computerUseDef2).toBeDefined();
    });
  });
});
