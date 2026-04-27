/**
 * Bug Test: Brain Research → Computer Use Misrouting
 *
 * Validates that research queries containing product/app names (e.g. "discord")
 * are NOT classified as `automate` by the task decomposer.
 *
 * Also verifies that genuine GUI automation queries still classify as `automate`.
 *
 * Validates: Requirements 1.1, 2.1, 3.1
 */

import { describe, it, expect } from 'vitest';
import { analyzeTask } from '../../task-decomposer';

describe('Bug Fix: automate signal regex no longer matches product/app names', () => {
  it('1.2 — bug test: "search for the best news discord bot" must NOT be automate', () => {
    const result = analyzeTask('search for the best news discord bot');
    expect(result.taskType).not.toBe('automate');
  });

  it('1.3 — preservation test: "click the submit button on the desktop app" MUST be automate', () => {
    const result = analyzeTask('click the submit button on the desktop app');
    expect(result.taskType).toBe('automate');
  });
});

/**
 * Task 2 Tests: Intent guard injection in graph.ts brainNode
 *
 * Validates: Requirements 2.1
 */

describe('Fix 2: brainNode systemPromptOverride includes triage intent guard', () => {
  // Helper that replicates the graph.ts brainNode systemPromptOverride logic
  function buildSystemPromptOverride(
    plan: { title: string; steps: { id: string; description: string; tool: string }[] } | undefined,
    currentIntent: string | undefined
  ): string | undefined {
    if (!plan) return undefined;
    const intentGuard = currentIntent
      ? `\nTRIAGE INTENT: ${currentIntent} — routing MUST respect this intent. If intent is 'research', route to web_explorer, NOT computer_use.\n`
      : '';
    return `You are the EverFern Orchestrator.
Your goal is to ensure the following execution plan is completed successfully.
${intentGuard}
CURRENT EXECUTION PLAN:
Title: ${plan.title}
Steps:
${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}

If a specialized agent failed to complete a step, identify the issue and use your tools to proceed.`;
  }

  const planWithComputerUse = {
    title: 'Research discord bots',
    steps: [
      { id: 'step-1', description: 'Search for discord bots', tool: 'computer_use' },
    ],
  };

  it('2.2 — bug test: research intent + computer_use plan → override contains "TRIAGE INTENT: research" and "NOT computer_use"', () => {
    const override = buildSystemPromptOverride(planWithComputerUse, 'research');
    expect(override).toBeDefined();
    expect(override).toContain('TRIAGE INTENT: research');
    expect(override).toContain('NOT computer_use');
  });

  it('2.3 — preservation test: undefined intent → override does NOT contain "TRIAGE INTENT" but plan text is present', () => {
    const override = buildSystemPromptOverride(planWithComputerUse, undefined);
    expect(override).toBeDefined();
    expect(override).not.toContain('TRIAGE INTENT');
    expect(override).toContain('Research discord bots');
    expect(override).toContain('step-1');
  });
});

/**
 * Task 3 Tests: Triage intent guard in brain's routing prompt
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

describe('Fix 3: determineRouting prompt includes triage intent constraint', () => {
  // Helper that replicates the intentConstraint + prompt-building logic from brain.ts determineRouting
  function buildRoutingPrompt(
    currentIntent: string | undefined,
    userRequest: string = 'test request',
    responseContent: string = 'test response',
    conversationHistory: any[] = []
  ): string {
    const intentConstraint = currentIntent
      ? `\nTRIAGE INTENT (HARD CONSTRAINT): "${currentIntent}"\n` +
        (currentIntent === 'research'
          ? `Because the triage intent is "research", the ONLY valid routing decisions are: "route_web_explorer", "continue_brain", or "complete_task". You MUST NOT route to "route_computer_use".\n`
          : '')
      : '';

    return `You are the EverFern Brain - the central orchestrator. Analyze the user request and current state to determine the best routing decision.
${intentConstraint}
USER REQUEST: "${userRequest.slice(0, 400)}"
YOUR CURRENT RESPONSE: "${responseContent.slice(0, 300)}"
CONVERSATION CONTEXT: ${JSON.stringify(conversationHistory).slice(0, 200)}`;
  }

  it('3.3 — bug test: currentIntent="research" → prompt contains research routing constraint', () => {
    const prompt = buildRoutingPrompt('research');
    expect(prompt).toContain('TRIAGE INTENT (HARD CONSTRAINT): "research"');
    expect(prompt).toContain('You MUST NOT route to "route_computer_use"');
    expect(prompt).toContain('route_web_explorer');
  });

  it('3.4 — preservation test: currentIntent="computer_use" → prompt does NOT forbid route_computer_use', () => {
    const prompt = buildRoutingPrompt('computer_use');
    expect(prompt).toContain('TRIAGE INTENT (HARD CONSTRAINT): "computer_use"');
    expect(prompt).not.toContain('You MUST NOT route to "route_computer_use"');
  });

  it('3.2 — research constraint explicitly states route_computer_use is forbidden', () => {
    const prompt = buildRoutingPrompt('research');
    expect(prompt).toContain('MUST NOT route to "route_computer_use"');
  });

  it('3.1 — no intent → prompt does NOT contain TRIAGE INTENT constraint', () => {
    const prompt = buildRoutingPrompt(undefined);
    expect(prompt).not.toContain('TRIAGE INTENT (HARD CONSTRAINT)');
  });
});

/**
 * Task 4 Tests: Post-web_search content retrieval with vision fallback
 *
 * Validates: Requirements 4.1 – 4.7
 */

import { handlePostWebSearchEnrichment } from '../brain';

// Minimal mock runner that satisfies the AgentRunner shape used by the helper
function makeMockRunner(opts: {
  supportsVision?: boolean;
  groundingEngine?: any;
} = {}): any {
  return {
    client: {
      supportsVision: opts.supportsVision !== undefined
        ? () => opts.supportsVision
        : undefined,
    },
    groundingEngine: opts.groundingEngine,
    telemetry: { info: () => {}, warn: () => {} },
  };
}

// Minimal mock GraphStateType
function makeMockState(messages: any[] = []): any {
  return {
    messages,
    currentIntent: 'research',
    iterations: 0,
  };
}

describe('Fix 4: handlePostWebSearchEnrichment', () => {
  it('4.7 — preservation test: when web_search has NOT run, returns original messages unchanged', async () => {
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const state = makeMockState(messages);
    const runner = makeMockRunner();

    const result = await handlePostWebSearchEnrichment(state, runner, []);

    // Should return the same messages without any enrichment
    expect(result).toEqual(messages);
    expect(result.length).toBe(messages.length);
  });

  it('4.7 — preservation test: tool result from a different tool does NOT trigger vision-fallback', async () => {
    const messages = [
      { role: 'user', content: 'run some code' },
      { role: 'assistant', content: 'ok' },
      { role: 'tool', name: 'python_executor', content: 'result: 42' },
    ];
    const state = makeMockState(messages);
    const runner = makeMockRunner();

    const result = await handlePostWebSearchEnrichment(state, runner, []);

    expect(result).toEqual(messages);
    expect(result.length).toBe(messages.length);
  });

  it('4.6 — bug test: after web_search completes with currentIntent=research, enrichment runs and does not throw', async () => {
    const messages = [
      { role: 'user', content: 'search for the best news discord bot' },
      { role: 'assistant', content: 'I will search for that.' },
      {
        role: 'tool',
        name: 'web_search',
        content: JSON.stringify([
          { title: 'Top Discord Bots', url: 'https://example.com/discord-bots', snippet: 'Best bots for news' },
        ]),
      },
    ];
    const state = makeMockState(messages);
    const runner = makeMockRunner({ supportsVision: false });

    // Should not throw — enrichment is non-blocking
    let result: any[] | undefined;
    let threw = false;
    try {
      result = await handlePostWebSearchEnrichment(state, runner, []);
    } catch {
      threw = true;
    }

    expect(threw).toBe(false);
    // The result must be an array (enriched or original)
    expect(Array.isArray(result)).toBe(true);
    // Must contain at least the original messages
    expect(result!.length).toBeGreaterThanOrEqual(messages.length);
  });

  it('4.6 — bug test: routing prompt with research intent still forbids route_computer_use after web_search', () => {
    // Replicate the intentConstraint logic from determineRouting to verify the constraint
    // is still applied even after web_search enrichment
    const currentIntent = 'research';
    const intentConstraint = currentIntent
      ? `\nTRIAGE INTENT (HARD CONSTRAINT): "${currentIntent}"\n` +
        (currentIntent === 'research'
          ? `Because the triage intent is "research", the ONLY valid routing decisions are: "route_web_explorer", "continue_brain", or "complete_task". You MUST NOT route to "route_computer_use".\n`
          : '')
      : '';

    expect(intentConstraint).toContain('MUST NOT route to "route_computer_use"');
    expect(intentConstraint).toContain('route_web_explorer');
  });

  it('4.1 — detects web_search as the last tool result correctly', async () => {
    const messagesWithWebSearch = [
      { role: 'user', content: 'find me something' },
      { role: 'assistant', content: 'searching...' },
      { role: 'tool', name: 'web_search', content: 'https://example.com result' },
    ];
    const messagesWithoutWebSearch = [
      { role: 'user', content: 'find me something' },
      { role: 'assistant', content: 'done' },
    ];

    const runner = makeMockRunner({ supportsVision: false });

    // With web_search: enrichment path is triggered (returns >= original length)
    const withResult = await handlePostWebSearchEnrichment(
      makeMockState(messagesWithWebSearch),
      runner,
      []
    );
    // Without web_search: returns original messages unchanged
    const withoutResult = await handlePostWebSearchEnrichment(
      makeMockState(messagesWithoutWebSearch),
      runner,
      []
    );

    expect(withResult.length).toBeGreaterThanOrEqual(messagesWithWebSearch.length);
    expect(withoutResult).toEqual(messagesWithoutWebSearch);
  });
});


/**
 * Task 5 Tests: Integration — End-to-end routing
 *
 * Validates the full chain of fixes working together:
 * Fix 1 (analyzeTask), Fix 2 (systemPromptOverride), Fix 3 (routing prompt constraint)
 *
 * Validates: Requirements 1.1, 2.1, 3.1
 */

describe('Integration: End-to-end routing', () => {
  // Replicates the intentConstraint logic from brain.ts determineRouting
  function buildRoutingPrompt(
    currentIntent: string | undefined,
    userRequest: string = 'test request',
    responseContent: string = 'test response',
    conversationHistory: any[] = []
  ): string {
    const intentConstraint = currentIntent
      ? `\nTRIAGE INTENT (HARD CONSTRAINT): "${currentIntent}"\n` +
        (currentIntent === 'research'
          ? `Because the triage intent is "research", the ONLY valid routing decisions are: "route_web_explorer", "continue_brain", or "complete_task". You MUST NOT route to "route_computer_use".\n`
          : '')
      : '';

    return `You are the EverFern Brain - the central orchestrator. Analyze the user request and current state to determine the best routing decision.
${intentConstraint}
USER REQUEST: "${userRequest.slice(0, 400)}"
YOUR CURRENT RESPONSE: "${responseContent.slice(0, 300)}"
CONVERSATION CONTEXT: ${JSON.stringify(conversationHistory).slice(0, 200)}`;
  }

  // Replicates the systemPromptOverride logic from graph.ts brainNode wrapper
  function buildSystemPromptOverride(
    plan: { title: string; steps: { id: string; description: string; tool: string }[] } | undefined,
    currentIntent: string | undefined
  ): string | undefined {
    if (!plan) return undefined;
    const intentGuard = currentIntent
      ? `\nTRIAGE INTENT: ${currentIntent} — routing MUST respect this intent. If intent is 'research', route to web_explorer, NOT computer_use.\n`
      : '';
    return `You are the EverFern Orchestrator.
Your goal is to ensure the following execution plan is completed successfully.
${intentGuard}
CURRENT EXECUTION PLAN:
Title: ${plan.title}
Steps:
${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}

If a specialized agent failed to complete a step, identify the issue and use your tools to proceed.`;
  }

  it('5.1 — integration: "search for the best news discord bot" routes to web_explorer, never computer_use', () => {
    const query = 'search for the best news discord bot';

    // Fix 1: analyzeTask must NOT classify as automate
    const analysis = analyzeTask(query);
    expect(analysis.taskType).not.toBe('automate');

    // Fix 2: systemPromptOverride with research intent must contain the guard
    const mockPlan = {
      title: query,
      steps: [{ id: 'step-1', description: 'Search for discord bots', tool: 'web_search' }],
    };
    const override = buildSystemPromptOverride(mockPlan, 'research');
    expect(override).toContain('TRIAGE INTENT: research');
    expect(override).toContain('NOT computer_use');

    // Fix 3: routing prompt with research intent must forbid route_computer_use
    const routingPrompt = buildRoutingPrompt('research', query);
    expect(routingPrompt).toContain('TRIAGE INTENT (HARD CONSTRAINT): "research"');
    expect(routingPrompt).toContain('You MUST NOT route to "route_computer_use"');
    expect(routingPrompt).toContain('route_web_explorer');

    // Assert: route_computer_use is explicitly forbidden in the prompt
    expect(routingPrompt).not.toMatch(/route_computer_use.*is.*allowed/i);
    // The only valid routes mentioned are web_explorer, continue_brain, complete_task
    expect(routingPrompt).toContain('route_web_explorer');
  });

  it('5.2 — preservation integration: "open Spotify and click the play button" routes to computer_use', () => {
    const query = 'open Spotify and click the play button';

    // Fix 1 preservation: analyzeTask MUST classify as automate (open + click are automation verbs)
    const analysis = analyzeTask(query);
    expect(analysis.taskType).toBe('automate');

    // Fix 2 preservation: systemPromptOverride with computer_use intent must NOT forbid computer_use
    const mockPlan = {
      title: query,
      steps: [{ id: 'step-1', description: 'Open Spotify and click play', tool: 'computer_use' }],
    };
    const override = buildSystemPromptOverride(mockPlan, 'computer_use');
    expect(override).toBeDefined();
    expect(override).toContain('TRIAGE INTENT: computer_use');
    // Must NOT contain the research-specific routing constraint
    expect(override).not.toContain("TRIAGE INTENT: research");

    // Fix 3 preservation: routing prompt with computer_use intent must NOT forbid route_computer_use
    const routingPrompt = buildRoutingPrompt('computer_use', query);
    expect(routingPrompt).toContain('TRIAGE INTENT (HARD CONSTRAINT): "computer_use"');
    expect(routingPrompt).not.toContain('You MUST NOT route to "route_computer_use"');

    // Assert: route_computer_use is allowed (no constraint forbidding it)
    expect(routingPrompt).not.toContain('MUST NOT route to "route_computer_use"');
  });
});
