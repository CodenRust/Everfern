# Bugfix Implementation Summary — Agent Routing System

This document summarizes the fixes implemented for the 10 bugs identified in the agent routing system audit.

## Bug Fixes Implemented

### 1. Brain Early Pre-check Re-entry (Bugs 1, 6, 10)
- **Problem:** The brain node's early pre-check for web research would fire on every entry, even when returning from a tool call or a specialized agent, causing incorrect routing.
- **Fix:** 
  - Added `brainToolsInFlight` and `returningFromSpecialist` flags to `GraphState`.
  - Updated `createBrainNode` to skip the early pre-check if `iterations > 0`, `brainToolsInFlight` is true, or `returningFromSpecialist` is set.
  - Brain node now sets `brainToolsInFlight: true` when it has pending tool calls.
  - Specialized agents now set `returningFromSpecialist` when routing back to the brain.

### 2. Intent Cache Key Depth (Bug 2)
- **Problem:** The intent cache used only the input string and history length as a key, leading to stale hits when the same input was provided with different conversation history.
- **Fix:** Updated `IntentCache.key` in `triage.ts` to include a content-based hash of the 3 most recent messages in history.

### 3. Affirmative Intent Inheritance (Bug 3)
- **Problem:** Short affirmative responses (e.g., "yes", "ok") always defaulted to the 'task' intent, losing the context of the previous request.
- **Fix:** Updated `classifyIntentFallback` in `triage.ts` to recursively look back through history for the last non-affirmative user message and inherit its intent.

### 4. Brain Prompt Guidance Loss (Bug 4)
- **Problem:** Injecting plan context into the brain node completely replaced the master `SYSTEM_PROMPT.md`, losing critical routing instructions.
- **Fix:** Updated `graph.ts` to prepend the plan context to the loaded master prompt instead of replacing it.

### 5. Web Explorer Infinite Loop (Bug 5)
- **Problem:** The `web_explorer` node could loop indefinitely if it failed to signal completion and produced no tools.
- **Fix:** 
  - Added `webExplorerSelfLoopCount` to `GraphState`.
  - Implemented a 5-iteration limit in the `web_explorer` conditional edge in `graph.ts`.
  - Updated `createWebExplorerNode` to increment the counter on each pass.

### 6. Shallow Graph Caching (Bug 9)
- **Problem:** The graph cache key used only tool names, meaning changes to tool descriptions or schemas wouldn't trigger a new graph build.
- **Fix:** Updated `buildGraph` in `graph.ts` to include a hash of full tool definitions (names, descriptions, and parameters) in the cache key.

### 7. Overly Broad Web Research Regex (Bug 7)
- **Problem:** The `WEB_RESEARCH_EARLY_CHECK` regex matched common coding phrases like "find the best articles", causing false positive routing to web_explorer.
- **Fix:** Refined the regex in `brain.ts` and `graph.ts` to require explicit web-intent keywords (e.g., "online", "web", "search for") alongside the target nouns.

### 8. Subagent Spawner Resilience (Bug 8)
- **Problem:** `spawnBrowserSubagent` would throw a hard error if the runner was not configured, and it used a different depth limit than other spawn paths.
- **Fix:** 
  - Updated `SubagentSpawner.spawn` to log a warning when no runner is present.
  - Updated `web-explorer.ts` to handle spawn failures gracefully and fall back to single-agent mode.
  - Standardized `maxDepth: 3` across all subagent spawn paths.

## Files Modified
- `main/agent/runner/state.ts`
- `main/agent/runner/nodes/brain.ts`
- `main/agent/runner/triage.ts`
- `main/agent/runner/graph.ts`
- `main/agent/runner/subagent-spawn.ts`
- `main/agent/runner/agents/web-explorer.ts`
- `main/agent/runner/agents/coding-specialist.ts`
- `main/agent/runner/agents/computer-use.ts`
- `main/agent/runner/agents/data-analyst.ts`
- `main/agent/runner/agents/deep-research-agent.ts`

## Verification Results
- Linting checks passed for modified files.
- Architectural audit confirmed all 10 bug conditions are now mitigated by state guards or logic improvements.
