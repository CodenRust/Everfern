# Sub-Agent System Improvement Implementation Plan

## Phase 1: Core Sub-Agent System

### 1.1 Update `subagent-registry.ts`
**File:** `main/agent/runner/subagent-registry.ts`

Add `AgentType` type after the imports (after line 11):

```typescript
export type AgentType = 'generic' | 'coding-specialist' | 'web-explorer' | 'data-analyst' | 'computer-use';
```

Update `SubagentEntry` interface (lines 13-28) to add `agentType` field:

```typescript
export interface SubagentEntry {
    agentId: string;
    parentSessionId: string;
    sessionKey: string;
    task: string;
    mode: 'run' | 'session';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
    result?: string;
    error?: string;
    workspaceDir?: string;
    maxDepth: number;
    currentDepth: number;
    agentType: AgentType; // NEW FIELD
}
```

### 1.2 Update `subagent-spawn.ts`
**File:** `main/agent/runner/subagent-spawn.ts`

#### Step 1: Update import (after line 9)
```typescript
import { getSubagentRegistry, generateAgentId, type SubagentEntry, type AgentType } from './subagent-registry';
```

#### Step 2: Update SpawnOptions interface (lines 21-29)
Replace the interface with:
```typescript
export interface SpawnOptions {
    parentSessionId: string;
    task: string;
    model?: string;
    mode?: 'run' | 'session';
    workspaceDir?: string;
    maxDepth?: number;
    parentHistory?: Array<{ role: string; content: string | any[] }>;
    // NEW FIELDS:
    agentType?: AgentType;
    systemPrompt?: string;
    context?: string;
}
```

#### Step 3: Update SubagentRunner interface (lines 47-53)
Replace the interface with:
```typescript
export interface SubagentRunner {
    run(
        task: string,
        history: Array<{ role: string; content: string }>,
        model?: string,
        systemPrompt?: string
    ): Promise<{ response: string; toolCalls: Array<{ toolName: string; args: Record<string, unknown> } }>;
}
```

#### Step 4: Update spawn() to register agentType (lines 98-108)
Replace the `registry.register` call with:
```typescript
const entry = registry.register({
    agentId,
    parentSessionId,
    sessionKey,
    task,
    mode,
    status: 'pending',
    workspaceDir,
    maxDepth,
    currentDepth,
    agentType: options.agentType || 'generic'
});
```

#### Step 5: Rewrite runSubagent() method (lines 137-196)
Replace the entire method with:
```typescript
private async runSubagent(
    agent: SpawnedAgent,
    model?: string,
    parentHistory: Array<{ role: string; content: string | any[] }> = [],
    agentType?: AgentType,
    systemPrompt?: string,
    context?: string
): Promise<void> {
    const registry = getSubagentRegistry();
    registry.update(agent.agentId, { status: 'running' });
    agent.status = 'running';

    sessionCreated(agent.sessionKey, {
        parentSessionId: registry.get(agent.agentId)?.parentSessionId,
        task: agent.task
    });

    emitTool(agent.sessionKey, 'agent_start', {
        agentId: agent.agentId,
        task: agent.task
    });

    try {
        // Apply context window cap
        const cappedHistory = parentHistory.slice(-40).map((msg: any) => ({
            role: msg.role || (msg._getType?.() === 'human' ? 'user' : 'assistant'),
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }));

        // Add context as prefixed message if provided
        if (context) {
            cappedHistory.unshift({
                role: 'user',
                content: `Context: ${context}`
            });
        }

        // Dynamic timeout based on agent type
        const timeoutMs = agentType === 'web-explorer' ? 300000 :
            agentType === 'coding-specialist' ? 180000 : 120000;

        // Run with timeout
        const runPromise = this.runner!.run(
            agent.task,
            cappedHistory,
            model,
            systemPrompt
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Subagent timeout after ${timeoutMs}ms`)), timeoutMs)
        );

        const result = await Promise.race([runPromise, timeoutPromise]);

        registry.complete(agent.agentId, result.response);
        sessionCompleted(agent.sessionKey, {
            responseLength: result.response.length,
            toolCalls: result.toolCalls.length
        });

        emitTool(agent.sessionKey, 'agent_end', {
            agentId: agent.agentId,
            success: true
        });

        console.log(`[SubagentSpawner] Agent ${agent.agentId} completed successfully`);

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        registry.complete(agent.agentId, undefined, errMsg);
        sessionFailed(agent.sessionKey, { error: errMsg });
        emitTool(agent.sessionKey, 'agent_end', {
            agentId: agent.agentId,
            success: false,
            error: errMsg
        });
        console.error(`[SubagentSpawner] Agent ${agent.agentId} failed:`, error);
    }
}
```

#### Step 6: Update spawn() call to pass new parameters (line 132)
Replace:
```typescript
this.runSubagent(spawnedAgent, model, parentHistory);
```
With:
```typescript
this.runSubagent(
    spawnedAgent,
    model,
    parentHistory,
    options.agentType,
    options.systemPrompt,
    options.context
);
```

### 1.3 Update `SubagentRunner` interface
Already completed in 1.2 Step 3.

### 1.4 Rewrite `createSpawnAgentTool()` in `runner.ts`
**File:** `main/agent/runner/runner.ts`

#### Add required imports (after line 39):
```typescript
import { type AgentType } from './subagent-registry';
import { loadPrompt } from '../../lib/prompt-sync';
```

#### Replace `createSpawnAgentTool()` method (lines 152-326) with:
```typescript
private createSpawnAgentTool(): AgentTool {
    return {
        name: 'spawn_agent',
        description: 'AGI: Launch parallel sub-agents for complex tasks. Use for: multiple files to process, research on multiple topics, independent operations that can run simultaneously.',
        parameters: {
            type: 'object',
            properties: {
                task: { type: 'string', description: 'The self-contained task for the sub-agent to accomplish.' },
                agent_id: { type: 'string', description: 'Resume an existing agent by ID (optional).' },
                max_depth: { type: 'number', description: 'Maximum spawn depth (default: 2, max: 3)' },
                agent_type: {
                    type: 'string',
                    enum: ['generic', 'coding-specialist', 'web-explorer', 'data-analyst', 'computer-use'],
                    description: 'Type of agent to spawn, determines system prompt and timeout.'
                },
                system_prompt: { type: 'string', description: 'Custom system prompt for the sub-agent (overrides agent_type prompt).' },
                context: { type: 'string', description: 'Additional background context for the sub-agent.' }
            },
            required: ['task']
        },
        execute: async (args, onUpdate, emitEvent, toolCallId) => {
            const task = args.task as string;
            const agentId = args.agent_id as string || crypto.randomUUID();
            const maxDepth = Math.min((args.max_depth as number) || 2, 3);
            const agentType = (args.agent_type as AgentType) || 'generic';
            const customSystemPrompt = args.system_prompt as string;
            const context = args.context as string;

            onUpdate?.(`AGI: Spawning ${agentType} sub-agent for: ${task.substring(0, 50)}...`);

            // Load system prompt based on agent_type
            let systemPrompt = customSystemPrompt;
            if (!systemPrompt) {
                const promptMap: Record<string, string> = {
                    'generic': '',
                    'coding-specialist': 'coding-specialist.md',
                    'web-explorer': 'web-explorer.md',
                    'data-analyst': 'data-analyst.md',
                    'computer-use': 'computer-use.md'
                };
                const promptFile = promptMap[agentType as string];
                if (promptFile) {
                    systemPrompt = loadPrompt(promptFile) || '';
                }
            }

            // Dynamic timeout based on agent type
            const timeoutMs = agentType === 'web-explorer' ? 300000 :
                agentType === 'coding-specialist' ? 180000 : 120000;

            // Enrich task with context if provided
            const enrichedTask = context ? `${task}\n\nContext: ${context}` : task;

            try {
                // Load parent conversation history
                let parentHistory: Array<{ role: string; content: string | any[] }> = [];
                try {
                    const chatHistoryStore = new ChatHistoryStore();
                    const fullConversation = await chatHistoryStore.load(this.currentConversationId || 'default');
                    if (fullConversation && fullConversation.messages.length > 0) {
                        const reconstructed = reconstructFullHistory(fullConversation.messages, '');
                        parentHistory = reconstructed.slice(-40);
                        console.log(`[SubagentSpawn] Loaded ${parentHistory.length} messages from parent conversation`);
                    }
                } catch (historyErr) {
                    console.warn('[SubagentSpawn] Failed to load parent history:', historyErr);
                    parentHistory = [];
                }

                const { getSubagentSpawner } = await import('./subagent-spawn');
                const spawner = getSubagentSpawner();
                spawner.setRunner({
                    run: async (t: string, h: any[], m?: string, sp?: string) => {
                        const subRunner = new AgentRunner(this.client, this.config);
                        subRunner.skills = this.skills;
                        const clonedHistory = [...h] as any[];
                        let lastResponse = '';
                        let toolCalls: any[] = [];
                        const subTask = sp ? `[SYSTEM_PROMPT: ${sp}]\n${t}` : t;
                        const stream = subRunner.runStream(subTask, clonedHistory, m, `sub:${agentId}`);

                        for await (const event of stream) {
                            if (event.type === 'done') break;
                            if (event.type === 'chunk') lastResponse += event.content;
                            if (event.type === 'thought' && emitEvent && toolCallId) {
                                emitEvent({
                                    type: 'subagent-progress',
                                    toolCallId,
                                    timestamp: new Date().toISOString(),
                                    data: {
                                        type: 'reasoning',
                                        toolCallId,
                                        timestamp: new Date().toISOString(),
                                        content: event.content
                                    }
                                });
                            }
                            if (event.type === 'tool_start' && emitEvent && toolCallId) {
                                emitEvent({
                                    type: 'subagent-progress',
                                    toolCallId,
                                    timestamp: new Date().toISOString(),
                                    data: {
                                        type: 'action',
                                        toolCallId,
                                        timestamp: new Date().toISOString(),
                                        content: `Running tool: ${event.toolName}`,
                                        toolName: event.toolName
                                    }
                                });
                            }
                            if (event.type === 'tool_call' && emitEvent && toolCallId) {
                                emitEvent({
                                    type: 'subagent-progress',
                                    toolCallId,
                                    timestamp: new Date().toISOString(),
                                    data: {
                                        type: 'action',
                                        toolCallId,
                                        timestamp: new Date().toISOString(),
                                        content: `Finished ${event.toolCall.toolName}`,
                                        toolName: event.toolCall.toolName,
                                        status: event.toolCall.result.success ? 'success' : 'failure'
                                    }
                                });
                            }
                            if (event.type === 'thought') {
                                if (event.content.includes('\n')) onUpdate?.(`[Sub-Agent] Thinking: ${event.content.trim().split('\n').pop()}`);
                            }
                            if (event.type === 'tool_start') onUpdate?.(`[Sub-Agent] Starting tool: ${event.toolName}`);
                            if (event.type === 'tool_update') onUpdate?.(`[Sub-Agent] Running ${event.toolName}...`);
                            if (event.type === 'tool_call') {
                                toolCalls.push(event.toolCall);
                                onUpdate?.(`[Sub-Agent] Finished tool: ${event.toolCall.toolName}`);
                            }
                        }

                        if (emitEvent && toolCallId) {
                            emitEvent({
                                type: 'subagent-progress',
                                toolCallId,
                                timestamp: new Date().toISOString(),
                                data: {
                                    type: 'complete',
                                    toolCallId,
                                    timestamp: new Date().toISOString()
                                }
                            });
                        }

                        return {
                            response: lastResponse,
                            toolCalls: toolCalls.map(tc => ({
                                toolName: tc.toolName,
                                args: tc.args as Record<string, unknown>
                            }))
                        };
                    }
                });

                const spawnedAgent = await spawner.spawn({
                    parentSessionId: this.currentConversationId || 'default',
                    task: enrichedTask,
                    model: this.client.model,
                    maxDepth,
                    parentHistory,
                    agentType: agentType as AgentType,
                    systemPrompt,
                    context
                });

                const children = await spawner.waitForCompletion(this.currentConversationId || 'default', timeoutMs);
                const myChild = children.find(c => c.agentId === spawnedAgent.agentId);
                if (myChild && myChild.result) {
                    return { success: true, output: `Sub-agent (ID: ${spawnedAgent.agentId}) result:\n${myChild.result}` };
                }
                return { success: false, output: `Sub-agent failed: ${myChild?.error || 'Unknown error'}` };
            } catch (err) {
                return { success: false, output: `Spawn failed: ${err}` };
            }
        }
    };
}
```

## Phase 2: Web Explorer Overhaul

### 2.1 Rewrite `web-explorer.ts`
**File:** `main/agent/runner/agents/web-explorer.ts`

Replace the entire file content with:
```typescript
import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition } from '../../../lib/ai-client';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';
import { loadPrompt } from '../../../lib/prompt-sync';
import { getSubagentSpawner, type SpawnOptions } from '../subagent-spawn';
import { getSubagentRegistry } from '../subagent-registry';
import { emitTool } from '../../infra/agent-events';
import { runAgentStep } from '../services/agent-runtime';
import type { AgentType } from '../subagent-registry';

/**
 * Simplified Web Explorer Node
 * Pipeline: Search → Select Top 2 URLs → Spawn 2 Sub-Agents → Synthesize
 */
export const createWebExplorerNode = (
    runner: AgentRunner,
    eventQueue?: StreamEvent[],
    missionTracker?: MissionTracker,
    toolDefs?: ToolDefinition[]
) => {
    const integrator = createMissionIntegrator(missionTracker);
    const spawner = getSubagentSpawner();
    const registry = getSubagentRegistry();

    return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
        const allTools = toolDefs || (runner as any)._buildToolDefinitions();
        const messages = state.messages || [];
        const subagentSpawned = state.subagentSpawned || [];

        // PHASE 1: Initial Search
        const hasSearchResults = messages.some((m: any) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');

        if (!hasSearchResults) {
            eventQueue?.push({ type: 'thought', content: '\n🌐 WEB EXPLORER: Initiating search for research topic...' });
            const result = await integrator.wrapNode('web_explorer', () => runAgentStep(state, {
                runner,
                toolDefs: allTools,
                eventQueue,
                nodeName: 'web_explorer',
                systemPromptOverride: (loadPrompt('web-explorer.md') || '') +
                    '\n\nPHASE: SEARCH. Use web_search to find relevant sources. Return only the search results.'
            }), 'Web Explorer: Initial Search');
            return {
                ...result,
                returningFromSpecialist: 'web_explorer'
            };
        }

        // PHASE 2: Select Top 2 URLs, Spawn Sub-Agents
        const searchResult = messages.find((m: any) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
        const hasSpawnedSubagents = subagentSpawned.length > 0;

        if (hasSearchResults && !hasSpawnedSubagents) {
            const searchContent = typeof searchResult.content === 'string' ? searchResult.content : JSON.stringify(searchResult.content);
            const urls = extractTopUrls(searchContent, 2);

            if (urls.length === 0) {
                eventQueue?.push({ type: 'thought', content: '\n⚠️ WEB EXPLORER: No URLs found in search results.' });
                return { webExplorerComplete: true, taskPhase: 'evaluating' as const, returningFromSpecialist: 'web_explorer' };
            }

            eventQueue?.push({
                type: 'thought',
                content: `\n🎯 WEB EXPLORER: Spawning 2 sub-agents to investigate:\n${urls.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}`
            });

            const originalTask = getOriginalTask(messages);
            const spawnPromises = urls.map((url) => {
                const task = `Investigate URL: ${url} for research task: ${originalTask}`;
                return spawner.spawn({
                    parentSessionId: runner.currentConversationId || 'default',
                    task,
                    model: runner.client.model,
                    agentType: 'web-explorer' as AgentType,
                    context: `Original research task: ${originalTask}`,
                    maxDepth: 2
                } as SpawnOptions);
            });

            const spawned = await Promise.all(spawnPromises);
            return {
                subagentSpawned: spawned,
                webExplorerComplete: false,
                taskPhase: 'specialized_agent' as const,
                returningFromSpecialist: 'web_explorer'
            };
        }

        // PHASE 3: Wait for Sub-Agents, Synthesize Results
        if (hasSpawnedSubagents) {
            const pending = registry.hasPendingChildren(runner.currentConversationId || 'default');
            if (pending) {
                return { webExplorerComplete: false, returningFromSpecialist: 'web_explorer' };
            }

            const children = registry.getChildren(runner.currentConversationId || 'default');
            const results = children.map(c => `## Sub-Agent ${c.agentId}\n${c.result || 'No result'}`).join('\n\n');

            eventQueue?.push({ type: 'thought', content: '\n✅ WEB EXPLORER: Synthesizing final research report...' });

            return {
                messages: [
                    ...state.messages,
                    {
                        role: 'assistant',
                        content: `[RESEARCH COMPLETE]

## Final Research Report

${results}

## Mission Complete`
                    } as any
                ],
                webExplorerComplete: true,
                taskPhase: 'evaluating' as const,
                returningFromSpecialist: 'web_explorer'
            };
        }

        return { webExplorerComplete: true, returningFromSpecialist: 'web_explorer' };
    };
};

// Helper: Extract top URLs from search content
function extractTopUrls(searchContent: string, max: number): string[] {
    const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
    const matches = searchContent.match(urlRegex) || [];
    const SEARCH_ENGINES = ['google.com', 'bing.com', 'duckduckgo.com', 'brave.com', 'yahoo.com'];
    const LOW_QUALITY = ['pinterest.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'];

    const cleanUrls = [...new Set(matches)].filter(u =>
        !SEARCH_ENGINES.some(se => u.includes(se)) &&
        !LOW_QUALITY.some(lq => u.includes(lq))
    );
    return cleanUrls.slice(0, max);
}

// Helper: Get original user task
function getOriginalTask(messages: any[]): string {
    const userMsg = messages.find((m: any) => m.role === 'user');
    return typeof userMsg?.content === 'string' ? userMsg.content : JSON.stringify(userMsg?.content) || 'Unknown task';
}
```

### 2.2 Update `state.ts`
**File:** `main/agent/runner/state.ts`

Add import after line 2:
```typescript
import { SubagentEntry } from './subagent-registry';
```

Update line 149, replace:
```typescript
subagentSpawned: Annotation<any>(),
```
With:
```typescript
subagentSpawned: Annotation<SubagentEntry[]>(),
```

## Phase 3: Prompt Updates

### 3.1 Update `SYSTEM_PROMPT.md`
**File:** `main/agent/prompts/SYSTEM_PROMPT.md`

Add after line 269 (before section 2.7):

```markdown
### Enhanced spawn_agent Usage with agent_type

Use `spawn_agent` with these parameters for better control:

| Parameter | Type | Description |
|-----------|------|-------------|
| `task` | string (required) | Self-contained task for the sub-agent |
| `agent_type` | enum | `generic`, `coding-specialist`, `web-explorer`, `data-analyst`, `computer-use` |
| `system_prompt` | string | Custom system prompt (overrides agent_type) |
| `context` | string | Additional background information for the sub-agent |
| `max_depth` | number | Maximum spawn depth (default: 2, max: 3) |

**Rules:**
- Choose `agent_type` to match the task: `web-explorer` for research, `coding-specialist` for code tasks
- Keep nesting to 2 levels max
- Use `context` to pass original task details to sub-agents
```

### 3.2 Update `coding-specialist.md`
**File:** `main/agent/prompts/coding-specialist.md`

Replace the "Subagent Delegation" section (lines 144-151) with:
```markdown
## Subagent Delegation (for complex tasks)

After plan approval, for large tasks you may spawn subagents using proper agent_type:

\```typescript
spawn_agent({ 
  task: "Implement the database schema from tasks 1-3 in .everfern/plan/tasks.md",
  agent_type: "coding-specialist"
})

spawn_agent({ 
  task: "Build the API endpoints from tasks 4-6 in .everfern/plan/tasks.md",
  agent_type: "coding-specialist"
})
\```

Keep nesting to 2 levels max. Always integrate and validate subagent output.
```

### 3.3 Update `web-explorer.md`
**File:** `main/agent/prompts/web-explorer.md`

Add before the "Critical Rules" section (before line 116):
```markdown
## Sub-Agent Delegation (Deep Research)

For deep research beyond initial search, spawn focused investigators:

\```typescript
spawn_agent({ 
  task: "Investigate [URL] for [research goal]", 
  agent_type: "web-explorer",
  context: "Research goal: [original task]"
})
\```

Limit to 2 sub-agents maximum. Synthesize their findings into your final report.
```

### 3.4 Clean up hints in `utils.ts` and `task-decomposer.ts`

**File:** `main/agent/runner/utils.ts`

Remove lines 213-215:
```typescript
if (analysis.complexity === 'complex') {
    hints.push('COMPLEX: Consider using spawn_agent for subtasks.');
}
```

**File:** `main/agent/runner/task-decomposer.ts`

Remove lines 443-445:
```typescript
if (analysis.complexity === 'complex') {
    hints.push('COMPLEX: Consider using spawn_agent for subtasks.');
}
```

## Execution Steps

1. Apply all Phase 1 changes first (core system)
2. Apply Phase 2 changes (web explorer overhaul)
3. Apply Phase 3 changes (prompt updates)
4. Run lint/typecheck: `npm run lint && npm run typecheck`
5. Test sub-agent spawning with different `agent_type` values
6. Verify web explorer pipeline with sample research task
