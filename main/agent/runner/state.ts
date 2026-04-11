import { Annotation, MessagesAnnotation } from '@langchain/langgraph';
import type { MissionTimeline, MissionStep } from './mission-tracker';

// Type definitions to fix imports
export type IntentType = 'unknown' | 'coding' | 'research' | 'task' | 'question' | 'conversation' | 'build' | 'fix' | 'analyze' | 'automate';
export type TaskPhase = 'triage' | 'planning' | 'routing' | 'specialized_agent' | 'validation' | 'hitl' | 'orchestrating' | 'executing' | 'evaluating';

export interface TaskStep {
  id: string;
  description: string;
  tool: string;
  canParallelize: boolean;
  priority?: 'low' | 'normal' | 'critical' | string;
  estimatedComplexity?: 'simple' | 'moderate' | 'complex' | 'low' | 'medium' | 'high' | string;
  dependsOn?: string[];
  parallelGroup?: number;
  agentPrompt?: string;
}

export interface DecomposedTask {
  id: string;
  title: string;
  steps: TaskStep[];
  totalSteps: number;
  canParallelize: boolean;
  executionMode: string;
  estimatedParallelGroups?: number;
  estimatedDurationMs?: number;
}

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  reasoning: string;
}

export interface StreamEvent {
  type: string;
  [key: string]: any;
}

export const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  currentIntent: Annotation<IntentType>(),
  intentConfidence: Annotation<number>(),
  decomposedTask: Annotation<DecomposedTask>(),
  agiHints: Annotation<string>(),
  taskPhase: Annotation<TaskPhase>(),
  pendingToolCalls: Annotation<any[]>(),
  toolCallRecords: Annotation<any[]>(),
  toolCallHistory: Annotation<any[]>(), // Compatibility
  userConfirmation: Annotation<any>(), // Compatibility
  finalResponse: Annotation<string>(), // Compatibility
  pauseGeneration: Annotation<boolean>(),
  iterations: Annotation<number>(),
  // Multi-Agent State
  activeAgent: Annotation<string>(),
  validationResult: Annotation<{
    isHighRisk: boolean;
    reasoning: string;
  }>(),
  shouldContinueIteration: Annotation<boolean>(),
  // Mission Tracking (OpenClaw style)
  missionId: Annotation<string>(),
  missionTimeline: Annotation<MissionTimeline | null>(),
  missionSteps: Annotation<MissionStep[]>(),
  currentStepId: Annotation<string>(),
});

export type GraphStateType = typeof GraphState.State;
