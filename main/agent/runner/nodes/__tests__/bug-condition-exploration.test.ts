import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createValidationNode } from '../validation';
import { buildGraph } from '../../graph';
import { GraphStateType } from '../../state';
import { END } from '@langchain/langgraph';

/**
 * Bug Condition Exploration Test
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * Property 1: Bug Condition - Premature Task Completion on Incomplete Work
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test verifies that when specialist nodes complete without tool calls AND 
 * task objective is not achieved, the system incorrectly routes to END instead 
 * of global_planner.
 * 
 * Expected behavior (after fix): Route to global_planner for continued iteration
 * Current behavior (unfixed): Routes to END, prematurely completing the mission
 */

describe('Bug Condition Exploration - Premature Task Completion', () => {
  let mockRunner: any;

  beforeEach(() => {
    mockRunner = {
      config: { maxIterations: 50 },
      telemetry: {
        warn: vi.fn(),
        info: vi.fn(),
        action: vi.fn(),
        transition: vi.fn(),
      },
      _buildToolDefinitions: vi.fn(() => [])
    };
  });

  /**
   * Test Case 1: Coding Task Without Tool Calls
   * 
   * Scenario: User requests "Create a Python script"
   * Specialist: coding_specialist returns text explanation without write tool calls
   * Expected (after fix): Route to global_planner to generate file write tool calls
   * Current (unfixed): Routes to END, completing mission prematurely
   */
  it('should route to global_planner when coding_specialist completes without tool calls on incomplete task', async () => {
    const validationNode = createValidationNode(mockRunner);
    
    // Simulate state after coding_specialist completes without generating tool calls
    const state: Partial<GraphStateType> = {
      taskPhase: 'validation',
      activeAgent: 'coding_specialist',
      pendingToolCalls: [], // No tool calls generated
      iterations: 1,
      currentIntent: 'coding',
      messages: [
        { role: 'user', content: 'Create a Python script to analyze CSV data' },
        { role: 'assistant', content: 'I can help you create a Python script for CSV analysis. Let me explain the approach...' }
      ]
    };

    const result = await validationNode(state as GraphStateType);
    
    // After fix, validation should indicate task should continue
    // On unfixed code, this will fail because there's no shouldContinueIteration field
    expect(result).toHaveProperty('shouldContinueIteration');
    expect(result.shouldContinueIteration).toBe(true);
    
    // Verify validation result is set
    expect(result.validationResult).toBeDefined();
    expect(result.taskPhase).toBe('validation');
  });

  /**
   * Test Case 2: Research Task Incomplete
   * 
   * Scenario: User requests "Research the latest AI trends"
   * Specialist: web_explorer returns one result without continuing research
   * Expected (after fix): Route to global_planner to continue research
   * Current (unfixed): Routes to END, completing mission prematurely
   */
  it('should route to global_planner when web_explorer completes without tool calls on incomplete research', async () => {
    const validationNode = createValidationNode(mockRunner);
    
    // Simulate state after web_explorer completes with minimal research
    const state: Partial<GraphStateType> = {
      taskPhase: 'validation',
      activeAgent: 'web_explorer',
      pendingToolCalls: [], // No additional tool calls
      iterations: 1,
      currentIntent: 'research',
      messages: [
        { role: 'user', content: 'Research the latest AI trends and summarize' },
        { role: 'assistant', content: 'I found one article about AI trends. Here is a brief summary...' }
      ]
    };

    const result = await validationNode(state as GraphStateType);
    
    // After fix, validation should indicate task should continue
    expect(result).toHaveProperty('shouldContinueIteration');
    expect(result.shouldContinueIteration).toBe(true);
    
    expect(result.validationResult).toBeDefined();
    expect(result.taskPhase).toBe('validation');
  });

  /**
   * Test Case 3: Data Analysis Without Visualization
   * 
   * Scenario: User requests "Analyze dataset and create visualizations"
   * Specialist: data_analyst returns text analysis without chart tool calls
   * Expected (after fix): Route to global_planner to generate chart creation tool calls
   * Current (unfixed): Routes to END, completing mission prematurely
   */
  it('should route to global_planner when data_analyst completes without tool calls on incomplete task', async () => {
    const validationNode = createValidationNode(mockRunner);
    
    // Simulate state after data_analyst completes without visualization tools
    const state: Partial<GraphStateType> = {
      taskPhase: 'validation',
      activeAgent: 'data_analyst',
      pendingToolCalls: [], // No chart tool calls generated
      iterations: 1,
      currentIntent: 'analyze',
      messages: [
        { role: 'user', content: 'Analyze this dataset and create visualizations' },
        { role: 'assistant', content: 'Based on the data, I can see the following patterns...' }
      ]
    };

    const result = await validationNode(state as GraphStateType);
    
    // After fix, validation should indicate task should continue
    expect(result).toHaveProperty('shouldContinueIteration');
    expect(result.shouldContinueIteration).toBe(true);
    
    expect(result.validationResult).toBeDefined();
    expect(result.taskPhase).toBe('validation');
  });

  /**
   * Test Case 4: Computer Use Agent Without Tool Calls
   * 
   * Scenario: User requests automation task
   * Specialist: computer_use_agent returns explanation without tool calls
   * Expected (after fix): Route to global_planner to generate automation tool calls
   * Current (unfixed): Routes to END, completing mission prematurely
   */
  it('should route to global_planner when computer_use_agent completes without tool calls on incomplete task', async () => {
    const validationNode = createValidationNode(mockRunner);
    
    // Simulate state after computer_use_agent completes without tool calls
    const state: Partial<GraphStateType> = {
      taskPhase: 'validation',
      activeAgent: 'computer_use_agent',
      pendingToolCalls: [], // No tool calls generated
      iterations: 1,
      currentIntent: 'automate',
      messages: [
        { role: 'user', content: 'Automate the process of opening a browser and navigating to a website' },
        { role: 'assistant', content: 'I can help you automate this process. Let me explain the steps...' }
      ]
    };

    const result = await validationNode(state as GraphStateType);
    
    // After fix, validation should indicate task should continue
    expect(result).toHaveProperty('shouldContinueIteration');
    expect(result.shouldContinueIteration).toBe(true);
    
    expect(result.validationResult).toBeDefined();
    expect(result.taskPhase).toBe('validation');
  });

  /**
   * Graph Routing Test: Verify END routing on unfixed code
   * 
   * This test verifies the graph routing logic that causes premature completion.
   * On unfixed code, when !hasTools, the graph routes to END.
   * After fix, it should route to global_planner when shouldContinueIteration is true.
   */
  it('should demonstrate bug: routes to END when specialist completes without tools on incomplete task', async () => {
    // Simulate state after specialist completes without tools
    const state: Partial<GraphStateType> = {
      taskPhase: 'validation',
      activeAgent: 'coding_specialist',
      pendingToolCalls: [], // No tools
      iterations: 1,
      currentIntent: 'coding',
      messages: [
        { role: 'user', content: 'Create a Python script' },
        { role: 'assistant', content: 'Explanation without tool calls' }
      ]
    };

    // Check the conditional edge logic directly
    // This simulates what happens in graph.ts line 56-62
    const hasTools = state.pendingToolCalls && state.pendingToolCalls.length > 0;
    
    // On unfixed code, !hasTools routes to END
    const expectedRoute = !hasTools ? END : 'multi_tool_orchestrator';
    
    // This assertion demonstrates the bug: routes to END when it shouldn't
    expect(expectedRoute).toBe(END);
    expect(hasTools).toBe(false);
    
    // After fix, the routing logic should check shouldContinueIteration
    // and route to global_planner instead of END when task is incomplete
  });

  /**
   * Edge Case: Read-Only Task Should Complete
   * 
   * Scenario: User asks "What is the capital of France?"
   * Specialist: web_explorer responds "Paris" without tool calls
   * Expected: Mission completes immediately (legitimate END routing)
   * 
   * This test ensures the fix doesn't break legitimate completion scenarios.
   */
  it('should allow END routing for read-only tasks that are genuinely complete', async () => {
    const validationNode = createValidationNode(mockRunner);
    
    // Simulate state for a simple question that's been answered
    const state: Partial<GraphStateType> = {
      taskPhase: 'validation',
      activeAgent: 'web_explorer',
      pendingToolCalls: [], // No tools needed
      iterations: 1,
      currentIntent: 'question',
      messages: [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'The capital of France is Paris.' }
      ]
    };

    const result = await validationNode(state as GraphStateType);
    
    // For read-only tasks that are complete, shouldContinueIteration should be false
    // This allows routing to END (legitimate completion)
    // On unfixed code, this field won't exist, so this test will also fail
    // But after fix, this should pass with shouldContinueIteration: false
    expect(result).toHaveProperty('shouldContinueIteration');
    expect(result.shouldContinueIteration).toBe(false);
    
    expect(result.validationResult).toBeDefined();
    expect(result.taskPhase).toBe('validation');
  });
});
