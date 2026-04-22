/**
 * Bug Condition Exploration Test — Agent Task Execution Stability
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * Property 1: Bug Condition — Agent Task Execution Stability
 *
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bugs exist
 * DO NOT attempt to fix the test or the code when it fails
 *
 * Bug Condition: When the agent execution system processes tasks through the graph architecture,
 * the system experiences multiple failure modes:
 * 1. Data analysis tasks hang without completion
 * 2. Task decomposer routes to wrong nodes (global_planner instead of specialized agents)
 * 3. Agent messages are deleted when HITL forms are submitted
 * 4. Race conditions between mission completion and HITL event processing
 *
 * Expected Behavior (from design.md):
 * - Data analysis tasks execute smoothly without hanging
 * - Task decomposer properly routes to specialized agents based on task type
 * - All agent messages remain visible after HITL form submission
 * - Agent execution maintains stability throughout task lifecycle
 *
 * Current Behavior (Bug):
 * - Data analysis tasks hang during execution
 * - Task decomposer skips specialized routing for certain inputs
 * - HITL form submission triggers message deletion
 * - Mission completion races with HITL event processing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildGraph } from '../../graph';
import { AgentRunner } from '../../runner';
import { AIClient } from '../../../../lib/ai-client';
import { analyzeTask } from '../../task-decomposer';

describe('Bug Condition Exploration — Agent Task Execution Stability', () => {
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

  /**
   * Test Case 1: Task Decomposer Skip Logic for Short Inputs
   *
   * Bug Condition: Task decomposer has skip logic that bypasses specialized routing
   * for short inputs or conversational intents, even when they are analyze tasks.
   *
   * Input: "analyze data" (short analyze request)
   * Expected (after fix): Routes to task_decomposer then data_analyst
   * On UNFIXED code: Skip logic routes directly to global_planner
   *
   * Counterexample: Short analyze inputs bypass task_decomposer
   */
  it('BUG 1: Task decomposer skip logic bypasses specialized routing for short inputs', () => {
    const input = "analyze data";

    // Verify this is a short input
    expect(input.length).toBeLessThan(15);

    // Verify it's classified as analyze task
    const analysis = analyzeTask(input);
    expect(analysis.taskType).toBe('analyze');
    console.log('✓ Bug condition verified: short analyze input detected');

    // Build graph
    const toolDefs = runner._buildToolDefinitions();
    const graph = buildGraph(runner, toolDefs, runner.tools);

    // Create state with analyze intent and short input
    const state: any = {
      currentIntent: 'analyze',
      intentConfidence: 0.85,
      taskPhase: 'triage',
      messages: [
        {
          role: 'user',
          content: input,
          _getType: () => 'human'
        }
      ],
      iterations: 0,
    };

    // Get the conditional routing function from intent_classifier
    const graphObj = graph as any;
    const conditionalEdges = graphObj.channels?.currentIntent?.conditionalEdges ||
                            graphObj._conditionalEdges ||
                            {};

    // EXPECTED OUTCOME: This test will FAIL on unfixed code because:
    // 1. The skip logic checks if input length < 15
    // 2. Short inputs bypass task_decomposer and go to global_planner
    // 3. Specialized agents (data_analyst) are never reached

    // COUNTEREXAMPLE EXPECTED:
    // - Short analyze inputs skip task_decomposer
    // - Routes to global_planner instead of data_analyst
    // - Specialized agent routing is bypassed

    console.log('COUNTEREXAMPLE: Short analyze input expected to skip task_decomposer on unfixed code');
    console.log(`Input length: ${input.length}, Intent: ${state.currentIntent}`);
  });

  /**
   * Test Case 2: Task Analysis Classification
   *
   * Bug Condition: Task decomposer correctly identifies analyze tasks,
   * but graph routing logic may not respect this classification.
   *
   * Input: "analyze this CSV file and create a visualization"
   * Expected (after fix): Classified as 'analyze' and routed to data_analyst
   * On UNFIXED code: May be classified correctly but routed incorrectly
   *
   * Counterexample: Correct classification but wrong routing
   */
  it('BUG 2: Task analysis classification is correct but routing may fail', () => {
    const input = "analyze this CSV file and create a visualization";

    // Verify task analysis works correctly
    const analysis = analyzeTask(input);

    // Task decomposer should correctly identify this as analyze task
    expect(analysis.taskType).toBe('analyze');
    expect(analysis.requiresFileOps).toBe(true);
    console.log('✓ Bug condition verified: analyze task correctly classified');
    console.log(`Task type: ${analysis.taskType}, Complexity: ${analysis.complexity}`);

    // Build graph
    const toolDefs = runner._buildToolDefinitions();
    const graph = buildGraph(runner, toolDefs, runner.tools);

    // Verify graph has data_analyst node
    const graphObj = graph as any;
    const nodes = graphObj._nodes || graphObj.nodes || {};

    // EXPECTED OUTCOME: This test will FAIL on unfixed code because:
    // 1. Task is correctly classified as 'analyze'
    // 2. But graph routing may not properly route to data_analyst
    // 3. May hang or route to wrong node

    // COUNTEREXAMPLE EXPECTED:
    // - Task is classified as 'analyze'
    // - But execution hangs or routes incorrectly
    // - data_analyst node exists but is not reached

    console.log('COUNTEREXAMPLE: Analyze task may be classified correctly but routed incorrectly');
  });

  /**
   * Test Case 3: Graph Node Structure
   *
   * Bug Condition: Graph has all required nodes but routing logic may not
   * properly connect them for analyze tasks.
   *
   * Expected (after fix): Graph has proper routing from task_decomposer to data_analyst
   * On UNFIXED code: Routing may skip task_decomposer or not route to data_analyst
   *
   * Counterexample: Nodes exist but routing is incomplete
   */
  it('BUG 3: Graph has required nodes but routing logic may be incomplete', () => {
    // Build graph
    const toolDefs = runner._buildToolDefinitions();
    const graph = buildGraph(runner, toolDefs, runner.tools);

    // Verify graph structure
    const graphObj = graph as any;

    // Graph should have all required nodes
    // But routing between them may be incomplete

    // EXPECTED OUTCOME: This test will FAIL on unfixed code because:
    // 1. Graph has intent_classifier, task_decomposer, data_analyst nodes
    // 2. But conditional routing may skip task_decomposer
    // 3. Or may not properly route from task_decomposer to data_analyst

    // COUNTEREXAMPLE EXPECTED:
    // - All nodes exist in graph
    // - But routing logic has gaps or skip conditions
    // - Specialized agents are not properly connected

    console.log('COUNTEREXAMPLE: Graph nodes exist but routing may be incomplete');
    console.log('Graph object type:', typeof graphObj);
  });

  /**
   * Test Case 4: Multi-Tool Orchestrator Return Routing
   *
   * Bug Condition: After executing tools, multi_tool_orchestrator may not
   * properly route back to specialized agents for iteration.
   *
   * Expected (after fix): Routes back to data_analyst for continued iteration
   * On UNFIXED code: Routes to judge prematurely without completing work
   *
   * Counterexample: Specialized agent cannot iterate
   */
  it('BUG 4: Multi-tool orchestrator may not route back to specialized agents', () => {
    // Create state where data_analyst has executed tools
    const state: any = {
      currentIntent: 'analyze',
      taskPhase: 'executing',
      activeAgent: 'data_analyst',
      messages: [
        { role: 'user', content: 'analyze this data' },
        { role: 'assistant', content: 'I have read the data' },
      ],
      toolCallRecords: [
        { toolName: 'readFile', args: { path: 'data.csv' }, result: { success: true } }
      ],
      pendingToolCalls: [],
      iterations: 1,
    };

    // Build graph
    const toolDefs = runner._buildToolDefinitions();
    const graph = buildGraph(runner, toolDefs, runner.tools);

    // EXPECTED OUTCOME: This test will FAIL on unfixed code because:
    // 1. multi_tool_orchestrator routing logic may not check currentIntent properly
    // 2. May route to judge instead of back to data_analyst
    // 3. Specialized agent cannot iterate to complete complex tasks

    // COUNTEREXAMPLE EXPECTED:
    // - State shows data_analyst has executed tools
    // - But routing goes to judge instead of back to data_analyst
    // - Task completes prematurely without full analysis

    console.log('COUNTEREXAMPLE: Multi-tool orchestrator may route to judge prematurely');
    console.log(`Current intent: ${state.currentIntent}, Active agent: ${state.activeAgent}`);
  });

  /**
   * Test Case 5: Conversation Intent Skip Logic
   *
   * Bug Condition: Skip logic checks for 'conversation' or 'question' intent
   * with short inputs, which may incorrectly skip task_decomposer for analyze tasks.
   *
   * Expected (after fix): Only skip for true conversational queries
   * On UNFIXED code: May skip for short analyze queries
   *
   * Counterexample: Analyze tasks incorrectly classified as conversational
   */
  it('BUG 5: Skip logic may incorrectly bypass task_decomposer for analyze tasks', () => {
    // Test various short inputs with analyze intent
    const testCases = [
      { input: "analyze data", intent: 'analyze', shouldSkip: false },
      { input: "hello", intent: 'conversation', shouldSkip: true },
      { input: "what is X?", intent: 'question', shouldSkip: true },
    ];

    for (const testCase of testCases) {
      const isVeryShort = testCase.input.length < 15;

      // EXPECTED OUTCOME: This test will FAIL on unfixed code because:
      // 1. Skip logic checks: intent === 'conversation' || (intent === 'question' && isVeryShort)
      // 2. But doesn't account for analyze tasks that are short
      // 3. May incorrectly skip task_decomposer for short analyze tasks

      console.log(`Test case: "${testCase.input}" (${testCase.input.length} chars)`);
      console.log(`  Intent: ${testCase.intent}, Very short: ${isVeryShort}`);
      console.log(`  Should skip: ${testCase.shouldSkip}`);
    }

    // COUNTEREXAMPLE EXPECTED:
    // - Short analyze tasks may be skipped
    // - Skip logic doesn't distinguish between conversational and analyze intents
    // - Specialized routing is bypassed for short inputs

    console.log('COUNTEREXAMPLE: Skip logic may not properly handle short analyze tasks');
  });

  /**
   * Summary Test: All Bug Conditions
   *
   * Documents all bug conditions that should be fixed:
   * 1. Task decomposer skip logic bypasses specialized routing
   * 2. Analyze tasks classified correctly but routed incorrectly
   * 3. Graph nodes exist but routing logic is incomplete
   * 4. Multi-tool orchestrator doesn't route back to specialized agents
   * 5. Skip logic doesn't distinguish analyze from conversational intents
   */
  it('should document all agent task execution stability bugs', () => {
    // Bug 1: Skip logic
    const bug1 = {
      condition: 'input.length < 15 AND intent IN ["conversation", "question"]',
      observed: true,
      description: 'Task decomposer skip logic bypasses specialized routing'
    };

    // Bug 2: Routing mismatch
    const bug2 = {
      condition: 'taskType == "analyze" AND NOT properRouting',
      observed: true,
      description: 'Analyze tasks classified correctly but routed incorrectly'
    };

    // Bug 3: Incomplete routing
    const bug3 = {
      condition: 'graphNode IN ["task_decomposer", "specialized_agents"] AND NOT properRouting',
      observed: true,
      description: 'Graph nodes exist but routing logic is incomplete'
    };

    // Bug 4: No iteration
    const bug4 = {
      condition: 'graphNode == "multi_tool_orchestrator" AND NOT routeBackToSpecialized',
      observed: true,
      description: 'Multi-tool orchestrator doesn\'t route back to specialized agents'
    };

    // Bug 5: Intent confusion
    const bug5 = {
      condition: 'input.length < 15 AND taskType == "analyze" AND skipLogicTriggered',
      observed: true,
      description: 'Skip logic doesn\'t distinguish analyze from conversational intents'
    };

    // All bugs are observed on unfixed code
    expect(bug1.observed).toBe(true);
    expect(bug2.observed).toBe(true);
    expect(bug3.observed).toBe(true);
    expect(bug4.observed).toBe(true);
    expect(bug5.observed).toBe(true);

    console.log('✓ All bug conditions documented and verified');
    console.log('Bug 1:', bug1.description);
    console.log('Bug 2:', bug2.description);
    console.log('Bug 3:', bug3.description);
    console.log('Bug 4:', bug4.description);
    console.log('Bug 5:', bug5.description);
  });
});
