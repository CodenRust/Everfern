# Brain-Centric Architecture

## Overview

The EverFern agent system now features a **Brain Node** - the central intelligence that uses the main system prompt (SYSTEM_PROMPT.md) and acts as the primary agent. The Brain has full access to all tools and capabilities, and can optionally delegate to specialist nodes when their expertise is needed.

## Key Concept

**The Brain IS the main agent** - it's not just a router or orchestrator. The Brain:
- Uses the complete system prompt from `SYSTEM_PROMPT.md`
- Has access to ALL tools and capabilities
- Handles most requests directly
- Can optionally delegate to specialists for specialized tasks
- Maintains full context and decision-making authority

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         USER INPUT                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │    TRIAGE     │ (Intent Classification)
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │    PLANNER    │ (Task Decomposition)
                  └───────┬───────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │         🧠 BRAIN NODE (PRIMARY)          │
        │                                          │
        │  • Uses main SYSTEM_PROMPT.md           │
        │  • Has ALL tools and capabilities       │
        │  • Handles most requests directly       │
        │  • Can delegate to specialists          │
        │  • Makes all strategic decisions        │
        │  • Maintains full context               │
        └─────────────┬───────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        │ (Optional   │  Delegation) │             │
        ▼             ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│   CODING     │ │   DATA   │ │ COMPUTER │ │   WEB    │
│  SPECIALIST  │ │ ANALYST  │ │   USE    │ │ EXPLORER │
│  (Optional)  │ │(Optional)│ │(Optional)│ │(Optional)│
└──────┬───────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
       │              │            │            │
       └──────────────┴────────────┴────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  VALIDATION   │
              └───────┬───────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌────────┐  ┌──────────┐    ┌─────┐
   │  HITL  │  │   TOOL   │    │ END │
   │APPROVAL│  │EXECUTOR  │    └─────┘
   └────────┘  └──────────┘
```

## Brain Node Capabilities

### 1. Primary Agent with Full System Prompt
The Brain uses the complete `SYSTEM_PROMPT.md` file, which includes:
- Complete EverFern identity and capabilities
- All tool definitions and usage guidelines
- Context about the user's system and environment
- Session management and file tracking
- Skills and plugins
- All rules and guidelines

### 2. Direct Task Execution
The Brain handles most tasks directly:
- Conversations and greetings
- Code writing and debugging
- File operations
- Web research
- Data analysis
- System commands
- All tool usage

### 3. Optional Specialist Delegation
The Brain can delegate to specialists when beneficial:
- **Coding Specialist**: For complex code refactoring or large-scale implementations
- **Data Analyst**: For advanced statistical analysis or complex data transformations
- **Computer Use Agent**: For GUI automation requiring visual feedback
- **Web Explorer**: For extensive research requiring multiple sources

### 4. Strategic Decision Making
The Brain makes all high-level decisions:
- Whether to handle a task directly or delegate
- Which tools to use
- How to sequence operations
- When to ask for clarification
- How to synthesize information

## Execution Flow

### Typical Flow (Brain Handles Directly)
```
User: "Create a React component for a login form"
  ↓
TRIAGE: Identifies as "coding" intent
  ↓
PLANNER: No decomposition needed
  ↓
BRAIN: Uses system prompt, analyzes request
  ↓
BRAIN: Generates tool calls (fsWrite, etc.)
  ↓
VALIDATION: Checks tool calls
  ↓
TOOL EXECUTOR: Executes file operations
  ↓
END: Returns completed component
```

### Delegation Flow (Brain Delegates to Specialist)
```
User: "Refactor entire codebase to use TypeScript strict mode"
  ↓
TRIAGE: Identifies as "coding" intent
  ↓
PLANNER: Decomposes into subtasks
  ↓
BRAIN: Analyzes complexity, decides to delegate
  ↓
BRAIN: Delegates to Coding Specialist
  ↓
CODING SPECIALIST: Handles refactoring
  ↓
VALIDATION: Checks implementation
  ↓
TOOL EXECUTOR: Executes changes
  ↓
END: Returns refactored codebase
```

## Benefits of Brain-Centric Architecture

### 1. Unified Intelligence
- Single agent with complete context
- No context loss between nodes
- Consistent decision-making
- Better understanding of user intent

### 2. Simplified Architecture
- Brain handles 90%+ of requests directly
- Specialists only used when truly beneficial
- Clearer execution paths
- Easier to debug and maintain

### 3. Better Performance
- Fewer node transitions
- Reduced overhead
- Direct tool execution
- Faster response times

### 4. Enhanced Flexibility
- Brain can adapt to any request type
- No rigid routing rules
- Dynamic decision-making
- Easy to extend capabilities

### 5. Complete System Prompt Access
- Brain has full context from SYSTEM_PROMPT.md
- All rules and guidelines available
- Complete tool definitions
- Full session context

## Specialist Nodes (Optional Delegates)

Specialists are now **optional** - the Brain can handle their tasks directly in most cases.

### When to Use Specialists

**Coding Specialist**:
- Large-scale refactoring (100+ files)
- Complex architectural changes
- Multi-step build processes

**Data Analyst**:
- Advanced statistical modeling
- Complex data transformations
- Large dataset processing

**Computer Use Agent**:
- GUI automation requiring visual feedback
- Complex desktop app interactions
- OS-level automation sequences

**Web Explorer**:
- Extensive research (10+ sources)
- Deep documentation analysis
- Comparative research tasks

### When Brain Handles Directly

**Most Common Cases** (90%+ of requests):
- Simple to moderate coding tasks
- File operations
- Web searches
- Conversations
- Questions
- Data processing
- System commands
- Tool usage

## Configuration

The Brain automatically uses the system prompt from `main/agent/runner/prompts/SYSTEM_PROMPT.md`. No additional configuration is required.

### System Prompt Structure

The system prompt includes:
- EverFern identity and role
- Complete tool definitions
- Usage guidelines and rules
- Context variables (OS, paths, session)
- Skills and capabilities
- Safety and security guidelines

## Migration from Old Architecture

### Old Architecture
```
PLANNER → [Intent-Based Routing] → SPECIALIST → VALIDATION
```
Problems:
- Specialists had limited context
- Rigid routing rules
- Context loss between nodes
- Overhead from multiple transitions

### New Architecture
```
PLANNER → BRAIN (with full system prompt) → VALIDATION
```
Benefits:
- Brain has complete context
- Flexible decision-making
- Direct tool execution
- Minimal overhead

## Monitoring and Debugging

### Brain Decision Tracking
The Brain logs its decisions:
- Whether it handled the task directly
- If it delegated, which specialist and why
- Tool calls generated
- Reasoning for decisions

### Performance Metrics
Track Brain performance:
- Direct handling rate (target: 90%+)
- Delegation rate (target: <10%)
- Average response time
- Tool execution success rate

## Future Enhancements

### Planned Features
1. **Learning System**: Brain learns optimal handling strategies
2. **Dynamic Delegation**: Brain decides delegation based on load and complexity
3. **Specialist Pooling**: Multiple specialist instances for parallel work
4. **Context Sharing**: Specialists inherit Brain's context
5. **Feedback Loop**: Brain learns from specialist outputs

## Summary

The Brain-Centric Architecture provides:
- ✅ Unified intelligence with complete system prompt
- ✅ Direct handling of most requests (90%+)
- ✅ Optional specialist delegation when beneficial
- ✅ Simplified architecture with fewer transitions
- ✅ Better performance and response times
- ✅ Complete context and decision-making authority
- ✅ Enhanced flexibility and maintainability

**The Brain IS the main agent** - specialists are optional helpers, not required intermediaries.
