/**
 * EverFern Desktop — Peer Agent Debate Engine Integration Guide
 *
 * This guide explains how to integrate the Peer Agent Debate Engine
 * into the existing agent execution pipeline.
 */

// ════════════════════════════════════════════════════════════════════════════
// INTEGRATION OVERVIEW
// ════════════════════════════════════════════════════════════════════════════

/*
The Peer Agent Debate Engine sits between the Triage/Task Decomposer nodes
and the actual tool execution. Here's the flow:

BEFORE (Current):
  User Input → Triage → Task Decomposer → Planner → Execute Tools → Response

AFTER (With Debate Engine):
  User Input → Triage → Task Decomposer → [DEBATE ENGINE] → Planner → Execute Tools → Response

The Debate Engine is OPTIONAL and only activates for complex tasks:
- Complexity: "complex" (or "moderate" if configured)
- Decision is made by Triage node
- Debate takes 30-60 seconds typically
- Produces a refined execution plan for the Planner

*/

// ════════════════════════════════════════════════════════════════════════════
// STEP 1: ADD DEBATE ENGINE TO AGENT RUNNER
// ════════════════════════════════════════════════════════════════════════════

/*
In main/agent/runner/runner.ts, add:

```typescript
import { PeerAgentDebateEngine, type DebateContext } from './debate-engine';

export class AgentRunner {
  public debateEngine: PeerAgentDebateEngine | null = null;

  constructor(client: AIClient, config: Partial<AgentRunnerConfig> = {}) {
    // ... existing code ...
    this.tools = getBaseTools(this);

    // Initialize debate engine
    this.debateEngine = new PeerAgentDebateEngine(client, {
      enableDebate: true,
      complexityThreshold: 'moderate', // Debate for moderate and complex tasks
      verbose: true, // Log debate transcript
    });
  }
}
```
*/

// ════════════════════════════════════════════════════════════════════════════
// STEP 2: DETECT COMPLEX TASKS IN TRIAGE
// ════════════════════════════════════════════════════════════════════════════

/*
In main/agent/runner/triage.ts, after classification, export complexity info:

```typescript
export interface TriageResult {
  intent: IntentType;
  confidence: number;
  reasoning: string;
  complexity?: 'simple' | 'moderate' | 'complex'; // ADD THIS
}

export async function classifyIntent(
  userInput: string,
  client?: AIClient,
  history: any[] = []
): Promise<TriageResult> {
  // ... existing classification code ...

  // After getting intent, determine complexity
  const complexity = await analyzeComplexity(userInput, client);

  return {
    intent,
    confidence,
    reasoning,
    complexity, // Include it
  };
}

async function analyzeComplexity(
  userInput: string,
  client: AIClient
): Promise<'simple' | 'moderate' | 'complex'> {
  const systemPrompt = `You are a task complexity analyzer.
  Classify the complexity of this task as: simple, moderate, or complex.

  simple: Straightforward, single operation
  moderate: Multiple steps, some coordination needed
  complex: Many interdependencies, requires careful planning

  Respond with JSON: {"complexity": "simple|moderate|complex"}`;

  const response = await client.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ],
    temperature: 0,
    maxTokens: 100,
  });

  try {
    const json = JSON.parse(
      typeof response.content === 'string' ? response.content : '{}'
    );
    return json.complexity || 'moderate';
  } catch {
    return 'moderate';
  }
}
```
*/

// ════════════════════════════════════════════════════════════════════════════
// STEP 3: ACTIVATE DEBATE ENGINE FOR COMPLEX TASKS
// ════════════════════════════════════════════════════════════════════════════

/*
In main/agent/runner/runner.ts, add a method:

```typescript
public async maybeRunDebate(
  userInput: string,
  conversationHistory: Array<{ role: string; content: string }>,
  complexity: 'simple' | 'moderate' | 'complex'
): Promise<FinalExecutionPlan | null> {
  if (!this.debateEngine) return null;

  const shouldDebate = PeerAgentDebateEngine.shouldDebate(
    complexity,
    this.debateEngine.config?.complexityThreshold || 'moderate'
  );

  if (!shouldDebate) {
    console.log('[AgentRunner] Skipping debate for simple task');
    return null;
  }

  console.log('[AgentRunner] 🎭 Activating Peer Agent Debate Engine');

  const context: DebateContext = {
    taskId: crypto.randomUUID(),
    userInput,
    conversationHistory,
    availableTools: this.tools.map(t => t.name),
    workspaceContext: this.getWorkspaceContext(),
    constraints: this.getTaskConstraints(),
  };

  try {
    const debateResult = await this.debateEngine.debate(context);

    // Store debate result for audit trail
    this.storeLast DebateResult(debateResult);

    // If plan is not executable, throw error
    if (debateResult.finalPlan.goNogo === 'no-go') {
      throw new Error(
        `Debate concluded plan is not executable: ${debateResult.finalPlan.explanation}`
      );
    }

    return debateResult.finalPlan;
  } catch (error) {
    console.error('[AgentRunner] Debate engine failed:', error);
    // Fall back to normal execution
    return null;
  }
}

private getWorkspaceContext(): string {
  // Return current workspace info for the debate
  return \`
Workspace: \${this.workspaceDir}
Project: \${this.projectId}
Current time: \${new Date().toISOString()}
  \`;
}

private getTaskConstraints(): string[] {
  return [
    'Cannot delete critical system files',
    'Must preserve user data',
    'Should not modify unrelated code',
  ];
}

private storeLastDebateResult(result: DebateResult): void {
  // Store in database or file system for audit trail
  // This could be a mission tracker or event log
}
```
*/

// ════════════════════════════════════════════════════════════════════════════
// STEP 4: INTEGRATE WITH EXISTING EXECUTION FLOW
// ════════════════════════════════════════════════════════════════════════════

/*
In your main execution loop (likely in runner.ts or graph.ts):

```typescript
async function executeTask(userInput: string, history: Array<...>) {
  // 1. Triage the task
  const triageResult = await classifyIntent(userInput, aiClient, history);
  console.log(\`Task complexity: \${triageResult.complexity}\`);

  // 2. Possibly run debate for complex tasks
  const debateResult = await agentRunner.maybeRunDebate(
    userInput,
    history,
    triageResult.complexity
  );

  if (debateResult) {
    // Use debate-approved plan
    console.log('Using debate-approved execution plan');
    const approvedPlan = debateResult;
    return await executeAuditedPlan(approvedPlan);
  }

  // 3. Fall back to normal execution
  console.log('Using standard execution path');
  const taskAnalysis = await analyzeTask(userInput);
  const executionPlan = await generatePlan(taskAnalysis);
  return await executePlan(executionPlan);
}
```
*/

// ════════════════════════════════════════════════════════════════════════════
// STEP 5: CONVERT DEBATE PLAN TO EXECUTABLE STEPS
// ════════════════════════════════════════════════════════════════════════════

/*
Create a converter from FinalExecutionPlan to executable tool calls:

```typescript
function convertDebatePlanToSteps(
  finalPlan: FinalExecutionPlan
): ExecutableStep[] {
  return finalPlan.steps.map(step => ({
    id: step.originalStepId,
    description: step.description,
    action: step.action,
    tools: step.toolsNeeded,
    preconditions: step.dependencies,
    estimatedDuration: step.estimatedDurationMs,
    riskMitigation: step.mitigation,
    fallback: getAppropriateFallback(step),
  }));
}

async function executeAuditedPlan(finalPlan: FinalExecutionPlan): Promise<string> {
  const steps = convertDebatePlanToSteps(finalPlan);

  console.log(\`Executing \${finalPlan.goNogo} plan with \${steps.length} steps\`);
  console.log('Risk Level: ' + finalPlan.overallRiskAssessment);

  if (finalPlan.goNogo === 'proceed-with-caution') {
    console.log('Key things to watch:');
    finalPlan.executionGuidance.forEach(g => console.log('  - ' + g));
  }

  for (const step of steps) {
    console.log(\`Executing: \${step.description}\`);
    // Execute each step, applying mitigations
    try {
      await executeStep(step);
    } catch (error) {
      if (step.fallback) {
        console.log(\`Executing fallback: \${step.fallback}\`);
        await executeFallback(step.fallback);
      } else {
        throw error;
      }
    }
  }

  return 'Plan executed successfully';
}
```
*/

// ════════════════════════════════════════════════════════════════════════════
// STEP 6: ENABLE/DISABLE IN PRODUCTION
// ════════════════════════════════════════════════════════════════════════════

/*
Make it configurable:

```typescript
interface AgentRunnerConfig {
  maxIterations: number;
  enableTerminal: boolean;

  // NEW: Debate Engine Config
  enableDebateEngine?: boolean;
  debateComplexityThreshold?: 'simple' | 'moderate' | 'complex';
  debateTimeoutMs?: number;
  debateVerbose?: boolean;
}

// Then in UI or config file:
{
  "agent": {
    "enableDebateEngine": true,
    "debateComplexityThreshold": "moderate",
    "debateTimeoutMs": 60000,
    "debateVerbose": true
  }
}
```
*/

// ════════════════════════════════════════════════════════════════════════════
// TESTING THE DEBATE ENGINE
// ════════════════════════════════════════════════════════════════════════════

/*
Create tests in __tests__/debate-engine.test.ts:

```typescript
import { PeerAgentDebateEngine } from '../debate-engine';
import { createMockAIClient } from './mocks';

describe('PeerAgentDebateEngine', () => {
  it('should run full debate for complex task', async () => {
    const aiClient = createMockAIClient();
    const engine = new PeerAgentDebateEngine(aiClient, {
      enableDebate: true,
      complexityThreshold: 'moderate',
    });

    const context = {
      taskId: 'test-task',
      userInput: 'Refactor my entire codebase to use TypeScript',
      conversationHistory: [],
      availableTools: ['readFile', 'writeFile', 'runCommand'],
      workspaceContext: 'Current project: MyApp (Next.js)',
      constraints: ['Cannot break existing functionality'],
    };

    const result = await engine.debate(context);

    expect(result.proposal).toBeDefined();
    expect(result.review).toBeDefined();
    expect(result.finalPlan).toBeDefined();
    expect(result.finalPlan.goNogo).toMatch(/go|proceed-with-caution|no-go/);
  });

  it('should detect critical issues and set no-go', async () => {
    // Test scenario where Phantom finds showstoppers
    // and Arbiter correctly sets no-go
  });

  it('should timeout gracefully', async () => {
    // Test that timeouts are handled correctly
  });
});
```
*/

export const DEBATE_ENGINE_INTEGRATION_GUIDE = true;
