# Peer Agent Debate Engine — Visual Architecture & Examples

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         EVERFERN AGENT SYSTEM                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      USER INPUT                                 │   │
│  │          "Refactor my codebase to TypeScript"                   │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                        │
│                               ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    TRIAGE NODE                                  │   │
│  │            Intent: coding                                       │   │
│  │            Complexity: COMPLEX ⚠️                               │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                        │
│                    ┌──────────┴──────────┐                            │
│                    │                     │                            │
│                    ▼                     ▼                            │
│            ┌────────────────┐  ┌──────────────────┐                 │
│            │ Simple/Moderate│  │    COMPLEX ✓     │                 │
│            │   Task?        │  │                  │                 │
│            │   NO DEBATE    │  │ ACTIVATE DEBATE  │                 │
│            └────────────────┘  └────────┬─────────┘                 │
│                    │                    │                            │
│                    │            ┌───────▼────────┐                  │
│                    │            │  DEBATE ENGINE │                  │
│                    │            └───────┬────────┘                  │
│                    │                    │                            │
│                    │    ┌───────────────┼───────────────┐            │
│                    │    │               │               │            │
│                    │    ▼               ▼               ▼            │
│                    │  ┌─────┐        ┌────────┐    ┌────────┐       │
│                    │  │ VAN │        │PHANTOM │    │ARBITER │       │
│                    │  │ ARD │        │        │    │        │       │
│                    │  └──┬──┘        └───┬────┘    └───┬────┘       │
│                    │     │               │            │             │
│                    │     ▼               ▼            ▼             │
│                    │ Proposes ──────► Critiques ── Arbitrates      │
│                    │                                   │             │
│                    │                            ┌──────▼──────┐     │
│                    │                            │ FINAL PLAN  │     │
│                    │                            │ Go/No-Go    │     │
│                    │                            └──────┬──────┘     │
│                    │                                   │             │
│                    └───────────────┬───────────────────┘             │
│                                    ▼                                 │
│         ┌──────────────────────────────────────────────────┐        │
│         │          TASK DECOMPOSER & PLANNER              │        │
│         │      (With debate-approved constraints)         │        │
│         └────────────────────────┬─────────────────────────┘        │
│                                  ▼                                   │
│         ┌──────────────────────────────────────────────────┐        │
│         │         EXECUTE TOOLS & COMMANDS                │        │
│         │     (With appropriate risk mitigations)         │        │
│         └────────────────────────┬─────────────────────────┘        │
│                                  ▼                                   │
│         ┌──────────────────────────────────────────────────┐        │
│         │         RESPONSE TO USER                         │        │
│         └──────────────────────────────────────────────────┘        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Debate Flow Diagram

```
                    START DEBATE
                         │
                         ▼
         ┌────────────────────────────────┐
         │  VANGUARD PROPOSES (15 sec)    │
         │                                │
         │  Inputs:                       │
         │  - User task                   │
         │  - Available tools             │
         │  - Workspace context           │
         │  - Constraints                 │
         │                                │
         │  Process:                      │
         │  • Analyze requirements        │
         │  • Plan steps                  │
         │  • Map dependencies            │
         │  • Estimate time               │
         │                                │
         │  Output:                       │
         │  ExecutionProposal {           │
         │    steps: [...]                │
         │    dependencies: [...]         │
         │    assumptions: [...]          │
         │  }                             │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │  PHANTOM CRITIQUES (20 sec)    │
         │                                │
         │  Inputs:                       │
         │  - Vanguard's proposal         │
         │  - Task context                │
         │  - Constraints                 │
         │                                │
         │  Process:                      │
         │  • Attack each step            │
         │  • Find edge cases             │
         │  • Identify risks              │
         │  • Categorize by severity      │
         │                                │
         │  Output:                       │
         │  CriticalReview {              │
         │    concerns: [{                │
         │      severity: 'high',         │
         │      description: '...',       │
         │      suggestion: '...'         │
         │    }]                          │
         │    assessment: 'concerning'    │
         │  }                             │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │  ARBITER ARBITRATES (15 sec)   │
         │                                │
         │  Inputs:                       │
         │  - Vanguard's proposal         │
         │  - Phantom's review            │
         │  - Task context                │
         │                                │
         │  Process:                      │
         │  • Categorize concerns:        │
         │    ✓ Critical → Address        │
         │    ✓ High → Mitigate           │
         │    ✓ Medium → Fallback         │
         │    ✓ Low → Document            │
         │  • Add mitigations              │
         │  • Make go/no-go decision      │
         │                                │
         │  Output:                       │
         │  FinalExecutionPlan {          │
         │    steps: [...],               │
         │    goNogo: 'go' | 'caution' |  │
         │             'no-go',           │
         │    mitigations: [...],         │
         │    riskAssessment: 'medium'    │
         │  }                             │
         └────────────┬────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────┐
         │    DECISION MATRIX             │
         │                                │
         │  go/no-go = ?                  │
         │  │                             │
         │  ├─→ 'go'                      │
         │  │   │ Execute immediately     │
         │  │   └─→ SUCCESS               │
         │  │                             │
         │  ├─→ 'proceed-with-caution'    │
         │  │   │ Execute with guard      │
         │  │   │ Watch for risks         │
         │  │   └─→ SUCCESS (careful)     │
         │  │                             │
         │  └─→ 'no-go'                   │
         │      │ Reject plan             │
         │      │ Suggest redesign        │
         │      └─→ STOP                  │
         │                                │
         └────────────┬────────────────────┘
                      │
                      ▼
                  END DEBATE
```

## Risk Severity Levels

```
┌────────────────────────────────────────────────────────────────┐
│ SEVERITY │ MEANING           │ ACTION     │ EXECUTION IMPACT  │
├────────────────────────────────────────────────────────────────┤
│          │                   │            │                   │
│ CRITICAL │ Plan breaks       │ REDESIGN   │ NO-GO decision    │
│          │ completely        │ OR REJECT  │ Block execution   │
│          │                   │            │                   │
│ HIGH     │ Major failure     │ ADD STEP   │ PROCEED WITH      │
│          │ mode likely       │ MITIGATE   │ CAUTION           │
│          │                   │ VALIDATE   │                   │
│          │                   │            │                   │
│ MEDIUM   │ Partial failure   │ ADD        │ EXECUTE WITH      │
│          │ possible          │ FALLBACK   │ EXTRA CARE        │
│          │                   │            │                   │
│ LOW      │ Edge case,        │ DOCUMENT   │ NORMAL            │
│          │ rare scenario     │ MONITOR    │ EXECUTION         │
│          │                   │            │                   │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow Example: TypeScript Migration

```
USER INPUT
│
│ "Migrate codebase to TypeScript"
│
├──────────────────────────────────────────────┐
│                                              │
│  VANGUARD GENERATES:                         │
│                                              │
│  ExecutionProposal:                          │
│  {                                           │
│    taskSummary: "Migrate to TypeScript",     │
│    approach: "Systematic file conversion",   │
│    steps: [                                  │
│      {                                       │
│        sequence: 1,                          │
│        description: "Analyze project",       │
│        action: "Scan files",                 │
│        toolsNeeded: ["readFile"],            │
│        riskLevel: "low"                      │
│      },                                      │
│      {                                       │
│        sequence: 2,                          │
│        description: "Create tsconfig",       │
│        action: "Generate config",            │
│        toolsNeeded: ["writeFile"],           │
│        riskLevel: "low"                      │
│      },                                      │
│      {                                       │
│        sequence: 3,                          │
│        description: "Convert files",         │
│        action: "Rename .js to .ts",          │
│        toolsNeeded: ["readFile", "writeFile"],
│        riskLevel: "medium"                   │
│      }                                       │
│    ]                                         │
│  }                                           │
│                                              │
└──────────────────────────────────────────────┘
│
├──────────────────────────────────────────────┐
│                                              │
│  PHANTOM IDENTIFIES:                         │
│                                              │
│  CriticalReview:                             │
│  {                                           │
│    overallAssessment: "concerning",          │
│    concerns: [                               │
│      {                                       │
│        severity: "CRITICAL",                 │
│        title: "Circular dependencies",       │
│        description: "If circular deps exist, │
│                     conversion fails",       │
│        impact: "Partial migration, broken    │
│                code",                        │
│        suggestion: "Check deps before        │
│                    converting"               │
│      },                                      │
│      {                                       │
│        severity: "HIGH",                     │
│        title: "Type errors massive",         │
│        description: "JS has implicit types", │
│        suggestion: "Use lenient tsconfig"    │
│      },                                      │
│      {                                       │
│        severity: "LOW",                      │
│        title: "Missing @types packages",     │
│        suggestion: "Install as needed"       │
│      }                                       │
│    ]                                         │
│  }                                           │
│                                              │
└──────────────────────────────────────────────┘
│
├──────────────────────────────────────────────┐
│                                              │
│  ARBITER PRODUCES:                           │
│                                              │
│  FinalExecutionPlan:                         │
│  {                                           │
│    goNogo: "proceed-with-caution",           │
│    overallRiskAssessment: "medium",          │
│    steps: [                                  │
│      {                                       │
│        sequence: 1,                          │
│        description: "Check circular deps",   │
│        mitigation: "Fail early if found",    │
│      },                                      │
│      {                                       │
│        sequence: 2,                          │
│        description: "Analyze project",       │
│      },                                      │
│      {                                       │
│        sequence: 3,                          │
│        description: "Create lenient         │
│                     tsconfig",               │
│        mitigation: "Start loose, tighten     │
│                    after",                   │
│      },                                      │
│      {                                       │
│        sequence: 4,                          │
│        description: "Convert files",         │
│        mitigation: "Test each file"          │
│      }                                       │
│    ],                                        │
│    addressedConcerns: [...],                 │
│    executionGuidance: [                      │
│      "Check dependencies first",             │
│      "Use strict mode gradually",            │
│      "Test after each conversion",           │
│      "Have rollback strategy"                │
│    ]                                         │
│  }                                           │
│                                              │
└──────────────────────────────────────────────┘
│
└──────────────────────────────────────────────┐
│                                              │
│  RESULT: Audited plan with mitigations       │
│          High confidence execution           │
│          Known risks documented              │
│                                              │
└──────────────────────────────────────────────┘
```

## Integration Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: INITIALIZATION (Once)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AgentRunner.constructor()                                       │
│    ├─ Initialize AI Client                                       │
│    ├─ Initialize Tools                                           │
│    └─ Initialize Debate Engine  ← NEW                           │
│          const debateEngine = new PeerAgentDebateEngine(client) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────┐
│ PHASE 2: EXECUTION (Per Task)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  receiveUserTask(userInput)                                      │
│    │                                                             │
│    ├─ Step 1: Triage                                             │
│    │  const intent = classifyIntent(userInput)                   │
│    │  const complexity = analyzeComplexity(userInput) ← NEW      │
│    │                                                             │
│    └─ Step 2: Check if Debate Needed                             │
│       if (complexity === 'complex') {                            │
│         │                                                        │
│         ├─ Step 2a: Run Debate ← NEW                             │
│         │  const debatePlan = await debateEngine.debate(context) │
│         │                                                        │
│         └─ Step 2b: Check Result                                 │
│            if (debatePlan.goNogo !== 'no-go') {                  │
│              ├─ Execute Debate Plan (use FinalExecutionPlan)     │
│              └─ Return to User                                   │
│            } else {                                              │
│              └─ Reject and ask for redesign                      │
│            }                                                     │
│       } else {                                                   │
│         └─ Step 3: Normal Execution (existing flow)              │
│            const plan = generatePlan(userInput)                  │
│            executePlan(plan)                                     │
│       }                                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Personality Examples

### 🚀 Vanguard's Mindset

```
"Here's my plan:
Step 1: Read all files ✓ (straightforward)
Step 2: Analyze structure ✓ (no problem)
Step 3: Convert each file ✓ (will work)
Step 4: Run tests ✓ (should pass)

Confidence: ⭐⭐⭐⭐⭐ Very high
Time estimate: 30 seconds
This will work!"
```

### 🔍 Phantom's Mindset

```
"Wait, let me attack this:
What if... circular dependencies exist?
        ↓ Entire conversion fails
What if... third-party packages don't have types?
        ↓ Build breaks
What if... test mocking is wrong?
        ↓ False positives in tests
What if... __dirname is used?
        ↓ Runtime errors in ESM

CONCERNS FOUND: 8
Assessment: CONCERNING"
```

### ⚖️ Arbiter's Mindset

```
"Vanguard proposed a solid plan.
Phantom found 8 concerns (3 major).

My decision:
- Critical issues? None, but 3 HIGH
  ACTION: Add prechecks ✓
- Will it work? Yes, with mitigations
  ACTION: Provide execution guidance ✓
- Risk level? Medium (manageable)
  ACTION: Flag risky steps ✓

FINAL DECISION: PROCEED WITH CAUTION ⚠️"
```

---

This visual guide helps understand:
- How debate fits into EverFern's architecture
- What each agent does in the debate flow
- How risks are categorized and handled
- What the complete integration lifecycle looks like
- How the three agents think differently
