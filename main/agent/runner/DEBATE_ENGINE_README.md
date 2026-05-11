# 🎭 Peer Agent Debate Engine

A sophisticated multi-agent planning system for EverFern that debates complex tasks **before** executing them. Instead of an AI agent making a plan and immediately executing it (and hoping it works), three specialized agents debate the best approach first.

## 📖 The Problem This Solves

**Before (Traditional AI Agent):**
```
User: "Refactor my entire codebase to use TypeScript"
Agent: "Okay, I'll do it" → starts immediately → breaks things
```

**After (With Debate Engine):**
```
User: "Refactor my entire codebase to use TypeScript"
Vanguard: "Here's my plan: 1. Analyze project, 2. Add tsconfig, 3. Convert files..."
Phantom: "Wait, what about this edge case? And this one? And this security issue?"
Arbiter: "Okay, here's the final plan addressing those concerns..."
Agent: Executes the vetted plan
```

## 🏗️ Architecture

### The Three Agents

```
                    ┌─────────────────────────┐
                    │   User Input            │
                    │ "Complex Task Here"     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Complexity Check      │
                    │   (Simple/Moderate/     │
                    │    Complex?)            │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  DEBATE ENGINE ACTIVATED│
                    │  (for complex tasks)    │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
    ┌────────────┐          ┌────────────┐          ┌────────────┐
    │ VANGUARD   │          │ PHANTOM    │          │ ARBITER    │
    │ Proposer   │          │ Red-teamer │          │ Arbitrator │
    │            │          │            │          │            │
    │ ✓ Creates  │          │ ✓ Finds    │          │ ✓ Merges   │
    │   detailed │          │   problems │          │   concerns │
    │   plan     │          │ ✓ Tests    │          │ ✓ Produces │
    │ ✓ Optimistic
    │            │          │   edge     │          │   final    │
    │ ✓ Forward- │          │   cases    │          │   plan     │
    │   thinking │          │ ✓ Pessimistic
    │            │          │            │          │ ✓ Decisive │
    └──────┬─────┘          └──────┬─────┘          └──────┬─────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │ FINAL EXECUTION PLAN│
                        │ Go/No-Go Decision   │
                        │ Risk Assessment     │
                        │ Mitigations         │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │    EXECUTE PLAN     │
                        │   (With oversight)  │
                        └─────────────────────┘
```

### Agent Personalities

#### 🚀 **Vanguard** (The Proposer)
- **Role**: Optimistic architect
- **Task**: Generate detailed execution plan
- **Mindset**: "Here's the best way forward"
- **Output**: `ExecutionProposal` with steps, tools, dependencies
- **Approach**: Happy path thinking, assumes best case

#### 🔍 **Phantom** (The Red-Teamer)
- **Role**: Pessimistic critic
- **Task**: Attack the plan and find all problems
- **Mindset**: "What could go wrong? EVERYTHING"
- **Output**: `CriticalReview` with concerns, warnings, edge cases
- **Approach**: Adversarial thinking, assumes worst case

#### ⚖️ **Arbiter** (The Decision-Maker)
- **Role**: Pragmatic decision maker
- **Task**: Read both sides, merge concerns into final plan
- **Mindset**: "Balance risk with practicality"
- **Output**: `FinalExecutionPlan` with go/no-go decision
- **Approach**: Takes critical issues seriously, ignores nitpicking

## 🚀 Quick Start

### 1. Initialize the Debate Engine

```typescript
import { PeerAgentDebateEngine } from './debate-engine';

const debateEngine = new PeerAgentDebateEngine(aiClient, {
  enableDebate: true,
  complexityThreshold: 'moderate', // Debate for moderate+ tasks
  verbose: true, // Log transcript
});
```

### 2. Detect Complex Tasks

```typescript
const complexity = await agentRunner.analyzeTaskComplexity(userInput);
// Returns: 'simple' | 'moderate' | 'complex'
```

### 3. Run the Debate

```typescript
if (complexity === 'complex') {
  const debateResult = await debateEngine.debate({
    taskId: 'task-123',
    userInput: 'Refactor codebase to TypeScript',
    conversationHistory: [...],
    availableTools: ['readFile', 'writeFile', ...],
    workspaceContext: 'Next.js project',
    constraints: ['Cannot delete files', ...],
  });

  // debateResult contains:
  // - proposal: Vanguard's plan
  // - review: Phantom's critique
  // - finalPlan: Arbiter's decision
  // - debateTranscript: Full debate log

  if (debateResult.finalPlan.goNogo === 'go') {
    // Execute the plan
    await executeDebatePlan(debateResult.finalPlan);
  } else if (debateResult.finalPlan.goNogo === 'no-go') {
    // Plan is not executable
    throw new Error('Plan deemed not executable');
  }
}
```

## 📊 Example Debate Output

### Task: "Migrate my Node.js app from CommonJS to ESM"

**Vanguard's Proposal:**
```
Approach: Systematic file-by-file conversion
Steps:
  1. Update package.json with "type": "module"
  2. Convert all require() to import
  3. Update __dirname and __filename usage
  4. Run tests to verify
Estimated Time: 45 seconds
```

**Phantom's Critique:**
```
Concerns Found: 8
- CRITICAL: Third-party packages might not support ESM
- HIGH: __dirname/filename are undefined in ESM
- HIGH: Some Node internals need adjustment
- MEDIUM: Circular dependencies might break
- LOW: Code formatting inconsistencies
```

**Arbiter's Final Plan:**
```
Go/No-Go: PROCEED WITH CAUTION
Risk Level: MEDIUM

Addressed Concerns:
- Add package compatibility check before conversion
- Add helper for __dirname replacement
- Run circular dependency checker

Final Steps (with mitigations):
  1. [NEW] Check third-party package compatibility
  1. Update package.json
  2. Convert require() → import with validation
  3. Handle __dirname/__filename with helper
  4. Run tests + circular dependency check

Execution Guidance:
- Watch for runtime issues with dynamic imports
- Test each file thoroughly
- Have rollback strategy ready
```

## 📁 File Structure

```
main/agent/runner/
├── debate-engine.ts              # Main orchestrator (NEW)
├── debate-types.ts               # Type definitions (NEW)
├── vanguard-agent.ts             # Proposer implementation (NEW)
├── phantom-agent.ts              # Red-teamer implementation (NEW)
├── arbiter-agent.ts              # Decision-maker implementation (NEW)
├── debate-engine-integration.md  # Integration guide (NEW)
├── debate-engine-example.ts      # Example integration (NEW)
├── runner.ts                     # Existing agent runner
├── task-decomposer.ts            # Existing task decomposer
├── triage.ts                     # Existing triage
└── ...
```

## 🔧 Integration Steps

### Step 1: Add to AgentRunner

```typescript
// In main/agent/runner/runner.ts
import { PeerAgentDebateEngine } from './debate-engine';

export class AgentRunner {
  private debateEngine: PeerAgentDebateEngine | null = null;

  constructor(client: AIClient, config: Partial<AgentRunnerConfig> = {}) {
    // ... existing code ...
    this.debateEngine = new PeerAgentDebateEngine(client, {
      enableDebate: true,
      complexityThreshold: 'moderate',
    });
  }
}
```

### Step 2: Detect Complexity in Triage

```typescript
// In main/agent/runner/triage.ts
const complexity = await analyzeTaskComplexity(userInput, client);
// Returns: 'simple' | 'moderate' | 'complex'
```

### Step 3: Activate Debate for Complex Tasks

```typescript
// In your execution flow
const complexity = await classifyIntent(...);
if (complexity === 'complex' || complexity === 'moderate') {
  const debatePlan = await agentRunner.maybeActivateDebate(
    userInput,
    history,
    complexity
  );
  
  if (debatePlan) {
    // Use debate-approved plan
    await executeDebatePlan(debatePlan);
  }
}
```

See `debate-engine-integration.md` for detailed integration guide.

## ⚙️ Configuration

```typescript
interface DebateEngineConfig {
  enableDebate: boolean;                    // Enable/disable debate
  complexityThreshold: 'moderate' | 'complex'; // When to trigger
  timeoutMs?: number;                       // Total debate timeout
  vanguardTimeoutMs?: number;               // Proposal timeout
  phantomTimeoutMs?: number;                // Critique timeout
  arbiterTimeoutMs?: number;                // Arbitration timeout
  maxRetries?: number;                      // Retry on failure
  verbose?: boolean;                        // Log transcript
}
```

## 📊 Decision Matrix

| Scenario | Phantom Assessment | Arbiter Decision | Result |
|----------|-------------------|------------------|--------|
| Good plan, no issues | viable | go | Execute immediately |
| Good plan, minor issues | concerning | proceed-with-caution | Execute with mitigations |
| Critical issues found | problematic | no-go | Reject plan, suggest redesign |
| Edge cases but manageable | concerning | proceed-with-caution | Execute with fallbacks |

## 🛡️ Risk Management

The debate engine assesses and manages risks:

```typescript
interface Concern {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  suggestion?: string; // How to fix it
  tags: string[]; // 'edge-case', 'security', 'performance', etc.
}
```

**Mitigation Strategies:**
- **Critical**: Redesign or reject
- **High**: Add validation steps or prechecks
- **Medium**: Add fallback strategies
- **Low**: Document and monitor

## 📝 Audit Trail

Every debate produces a complete transcript:

```typescript
interface DebateResult {
  debateId: string;
  timestamp: string;
  context: DebateContext;
  proposal: ExecutionProposal;      // What Vanguard proposed
  review: CriticalReview;            // What Phantom found
  finalPlan: FinalExecutionPlan;    // What Arbiter decided
  debateTranscript: DebateMessage[]; // Full conversation log
}
```

Export for logging/debugging:
```typescript
const json = debateEngine.exportResult(debateResult);
const summary = debateEngine.summarizeDebate(debateResult);
```

## 🧪 Testing

Create tests in `__tests__/debate-engine.test.ts`:

```typescript
describe('PeerAgentDebateEngine', () => {
  it('should run full debate for complex task', async () => {
    const engine = new PeerAgentDebateEngine(mockClient);
    const result = await engine.debate(mockContext);
    
    expect(result.proposal).toBeDefined();
    expect(result.review).toBeDefined();
    expect(result.finalPlan).toBeDefined();
    expect(['go', 'proceed-with-caution', 'no-go']).toContain(
      result.finalPlan.goNogo
    );
  });
});
```

## 🎯 Use Cases

**Ideal for:**
- 🏗️ Major refactorings
- 🔐 Security-sensitive changes
- 📦 Large dependency updates
- 🚀 Production deployments
- 🔄 Complex data migrations
- 🎨 Significant architectural changes

**Not needed for:**
- 📝 Simple file edits
- ❓ Q&A questions
- 💬 Casual conversation
- 🐛 Small bug fixes
- 📖 Reading documentation

## 🔍 How It Works (Deep Dive)

### Phase 1: Vanguard Proposes (15s typical)
1. Receives task and context
2. Analyzes requirements
3. Generates step-by-step plan
4. Estimates time and dependencies
5. Returns `ExecutionProposal`

### Phase 2: Phantom Critiques (20s typical)
1. Receives Vanguard's proposal
2. Systematically attacks each step
3. Identifies worst-case scenarios
4. Tags concerns by severity
5. Returns `CriticalReview`

### Phase 3: Arbiter Arbitrates (15s typical)
1. Reads both proposals
2. Categorizes concerns (critical/medium/low)
3. Adds mitigations for critical/medium issues
4. Makes go/no-go decision
5. Returns `FinalExecutionPlan`

**Total Time:** ~50 seconds for complex tasks

## 📚 API Reference

### PeerAgentDebateEngine

```typescript
class PeerAgentDebateEngine {
  // Main method
  async debate(context: DebateContext): Promise<DebateResult>
  
  // Utilities
  static shouldDebate(complexity: string, threshold: string): boolean
  exportResult(result: DebateResult): string
  summarizeDebate(result: DebateResult): string
}
```

### Agents

```typescript
class VanguardAgent {
  async proposeExecutionPlan(context: DebateContext): Promise<ExecutionProposal>
}

class PhantomAgent {
  async reviewExecutionPlan(proposal: ExecutionProposal, context: DebateContext): Promise<CriticalReview>
}

class ArbiterAgent {
  async arbitrateAndFinalize(proposal: ExecutionProposal, review: CriticalReview, context: DebateContext): Promise<FinalExecutionPlan>
}
```

## 🚀 Future Enhancements

- [ ] Persist debate results to database
- [ ] Learn from past debates (improve Vanguard/Phantom over time)
- [ ] Add human-in-the-loop review for critical plans
- [ ] Parallel debate phases for performance
- [ ] Custom agent personalities for domain-specific tasks
- [ ] Real-time debate transcript streaming to UI
- [ ] Debate metrics dashboard

## 📖 See Also

- [Integration Guide](./debate-engine-integration.md)
- [Example Implementation](./debate-engine-example.ts)
- [Agent System Architecture](../docs/architecture/agent-system.md)

## 🤝 Contributing

To extend the debate engine:

1. Modify system prompts in `vanguard-agent.ts`, `phantom-agent.ts`, `arbiter-agent.ts`
2. Add new concern types to `debate-types.ts`
3. Extend timeout configurations in `DebateEngineConfig`
4. Add new test cases in `__tests__/debate-engine.test.ts`

---

**Remember:** The debate engine's job is to make sure an AI doesn't start executing until it has thoroughly thought through a complex task. It's like having a senior engineer review the plan before the contractor starts swinging a sledgehammer.
