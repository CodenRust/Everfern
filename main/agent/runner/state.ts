import { Annotation } from '@langchain/langgraph';
import type { ChatMessage, ToolCall } from '../../lib/ai-client';
import type { ToolCallRecord } from './types';
import type { ToolCallHistoryEntry } from './loop-detection';

// ── Intent Types ─────────────────────────────────────────────────────────

export type IntentType = 'unknown' | 'coding' | 'research' | 'task' | 'question' | 'conversation' | 'build' | 'fix' | 'analyze' | 'automate';
export type TaskPhase = 'receiving' | 'classifying' | 'planning' | 'executing' | 'evaluating' | 'finalizing';

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  reasoning: string;
}

// ── Context/Memory Types ──────────────────────────────────────────────

export interface ContextSnapshot {
  completedSteps: string[];
  pendingSteps: string[];
  filesModified: string[];
  commandsRun: string[];
  errors: string[];
}

export interface MemoryEntry {
  fact: string;
  source: string;
  timestamp: number;
}

// ── Plan Types ────────────────────────────────────────────────────────

export interface PlanStep {
  id: string;
  description: string;
  tool?: string;
  status: 'pending' | 'in_progress' | 'done' | 'skipped' | 'failed';
  dependsOn?: string[];
}

export interface ExecutionPlan {
  id: string;
  title: string;
  steps: PlanStep[];
  createdAt: number;
}

// ── Response Types ────────────────────────────────────────────────────

export interface ResponseMetadata {
  intent: string;
  confidence: number;
  toolsUsed: string[];
  filesModified: string[];
  iterations: number;
}

// ── Approval Types ────────────────────────────────────────────────────

export interface PendingApproval {
  toolCall: ToolCallRecord;
  reason: string;
}

export interface TaskStep {
  id: string;
  description: string;
  tool?: string;
  parallelGroup?: number;
  dependsOn: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  canParallelize: boolean;
  priority: 'critical' | 'normal' | 'optional';
  agentPrompt?: string;
}

export interface DecomposedTask {
  id: string;
  title: string;
  steps: TaskStep[];
  canParallelize: boolean;
  estimatedParallelGroups: number;
  totalSteps: number;
  executionMode: 'sequential' | 'parallel' | 'hybrid';
  estimatedDurationMs: number;
}

// ── LangGraph State Schema (6-Node Architecture) ─────────────────────

export const GraphState = Annotation.Root({
  messages: Annotation<ChatMessage[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => [],
  }),
  toolCallRecords: Annotation<ToolCallRecord[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => [],
  }),
  iterations: Annotation<number>({
    reducer: (_existing, incoming) => incoming,
    default: () => 0,
  }),
  pendingToolCalls: Annotation<ToolCall[]>({
    reducer: (_existing, incoming) => incoming,
    default: () => [],
  }),
  finalResponse: Annotation<string>({
    reducer: (_existing, incoming) => incoming,
    default: () => '',
  }),
  userConfirmation: Annotation<'ACT' | 'STAY_ON_NOMINAL' | undefined>({
    reducer: (_existing, incoming) => incoming,
    default: () => undefined,
  }),
  pauseGeneration: Annotation<boolean>({
    reducer: (_existing, incoming) => incoming,
    default: () => false,
  }),
  toolCallHistory: Annotation<ToolCallHistoryEntry[]>({
    reducer: (_existing, incoming) => incoming,
    default: () => [],
  }),

  // ── NEW: 6-Node Architecture Fields ───────────────────────────────
  currentIntent: Annotation<IntentType>({
    reducer: (_existing, incoming) => incoming,
    default: () => 'unknown' as IntentType,
  }),
  intentConfidence: Annotation<number>({
    reducer: (_existing, incoming) => incoming,
    default: () => 0,
  }),
  taskPhase: Annotation<TaskPhase>({
    reducer: (_existing, incoming) => incoming,
    default: () => 'receiving' as TaskPhase,
  }),
  executionPlan: Annotation<ExecutionPlan | null>({
    reducer: (_existing, incoming) => incoming,
    default: () => null,
  }),
  context: Annotation<ContextSnapshot>({
    reducer: (existing, incoming) => ({ ...existing, ...incoming }),
    default: () => ({
      completedSteps: [],
      pendingSteps: [],
      filesModified: [],
      commandsRun: [],
      errors: []
    }),
  }),
  shortTermMemory: Annotation<MemoryEntry[]>({
    reducer: (existing, incoming) => {
      const combined = [...existing, ...incoming];
      return combined.slice(-10);
    },
    default: () => [],
  }),
  lastToolResult: Annotation<ToolCallRecord | null>({
    reducer: (_existing, incoming) => incoming,
    default: () => null,
  }),
  needsHumanApproval: Annotation<boolean>({
    reducer: (_existing, incoming) => incoming,
    default: () => false,
  }),
  pendingApproval: Annotation<PendingApproval | null>({
    reducer: (_existing, incoming) => incoming,
    default: () => null,
  }),
  responseMetadata: Annotation<ResponseMetadata>({
    reducer: (_existing, incoming) => ({ ..._existing, ...incoming }),
    default: () => ({
      intent: 'unknown',
      confidence: 0,
      toolsUsed: [],
      filesModified: [],
      iterations: 0
    }),
  }),

  // ── AGI-Specific Fields ─────────────────────────────────────────────
  // Tracks spawned sub-agents for coordination
  activeAgents: Annotation<string[]>({
    reducer: (existing, incoming) => [...existing, ...incoming].filter((v, i, a) => a.indexOf(v) === i),
    default: () => [],
  }),
  // Tracks parallel execution groups
  parallelGroups: Annotation<number>({
    reducer: (_existing, incoming) => incoming,
    default: () => 0,
  }),
  // Task decomposition state
  decomposedTask: Annotation<DecomposedTask | null>({
    reducer: (_existing, incoming) => incoming,
    default: () => null,
  }),
  // AGI hints for system prompt
  agiHints: Annotation<string>({
    reducer: (_existing, incoming) => incoming,
    default: () => '',
  }),
});

export type GraphStateType = typeof GraphState.State;

// ── Stream Emitter Type ──────────────────────────────────────────────

export type StreamEvent =
  | { type: 'tool_start'; toolName: string; toolArgs: Record<string, unknown> }
  | { type: 'tool_call'; toolCall: ToolCallRecord }
  | { type: 'chunk'; content: string }
  | { type: 'thought'; content: string }
  | { type: 'optima'; event: 'cache_hit' | 'prompt_slimmed'; details: string }
  | { type: 'tool_update'; toolName: string; update: string }
  | { type: 'show_artifact'; name: string }
  | { type: 'show_plan'; chatId: string; content: string }
  | { type: 'view_skill'; name: string; filePath: string }
  | { type: 'skill_detected'; skillName: string; skillDescription: string; reason: string }
  | { type: 'done' }
  // ── NEW: 6-Node Architecture Events ──────────────────────────────────
  | { type: 'intent_classified'; intent: string; confidence: number; phase: string }
  | { type: 'plan_created'; plan: { id: string; title: string; steps: number } }
  | { type: 'phase_changed'; from: string; to: string }
  | { type: 'human_approval_required'; toolCall: ToolCallRecord; reason: string }
  | { type: 'memory_updated'; context: Record<string, unknown> }
  | { type: 'json_view'; data: string; eventType: string }
  // ── AGI Architecture Events ──────────────────────────────────────────
  | { type: 'task_analyzed'; analysis: { complexity: string; canParallelize: boolean; suggestedApproach: string } }
  | { type: 'parallel_group_start'; groupIndex: number; toolNames: string[] }
  | { type: 'parallel_group_end'; groupIndex: number; durationMs: number }
  | { type: 'subagent_spawned'; agentId: string; task: string }
  | { type: 'subagent_completed'; agentId: string; success: boolean }
  | { type: 'loop_detected'; toolName: string; level: string; message: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number; totalTokens: number }
  // ── A2UI (Agent to User Interface) Events ────────────────────────────
  | { type: 'surface_action'; action: 'create' | 'update' | 'delete'; surfaceId: string; catalogId?: string; components?: any[]; data?: any };
