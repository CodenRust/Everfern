/**
 * EverFern Desktop — Planner Tool
 *
 * Allows the AI to create structured TODO/plan lists.
 * Plans are stored in the agent state and persisted with the conversation.
 */

import { randomUUID } from 'crypto';
import type { AgentTool, ToolResult, PlanRecord, PlanStep } from '../runner/types';

// ── In-memory store (flushed to conversation on save) ────────────────

const _plans: Map<string, PlanRecord> = new Map();

export function getActivePlans(): PlanRecord[] {
  return Array.from(_plans.values());
}

export function clearPlans(): void {
  _plans.clear();
  // Clear the execution plan blocker so a new chat/session can make a plan
  (global as any).__EVERFERN_EXEC_PLANS = new Set<string>();
}

export function loadPlans(plans: PlanRecord[]): void {
  _plans.clear();
  for (const p of plans) _plans.set(p.id, p);
}

// ── Tool Implementation ──────────────────────────────────────────────

export const plannerTool: AgentTool = {
  name: 'create_plan',
  description:
    'MANDATORY: Create a step-by-step plan BEFORE any computer_use action. ' +
    'Break the user\'s goal into clear, ordered sub-goals. ' +
    'Each step should be a single verifiable action. ' +
    'Use update_plan_step to mark steps as in_progress or done as you go. ' +
    'You may revise the plan mid-task if the situation changes.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short title for the plan (e.g. "Build authentication system")',
      },
      steps: {
        type: 'array',
        description: 'Ordered list of step descriptions (strings)',
        items: { type: 'string' },
      },
    },
    required: ['title', 'steps'],
  },

  async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
    const title = String(args['title'] ?? 'Untitled Plan').trim();
    const rawSteps = Array.isArray(args['steps'])
      ? (args['steps'] as unknown[]).filter(s => typeof s === 'string')
      : [];

    if (rawSteps.length === 0) {
      return { success: false, output: 'No steps provided', error: 'steps array is empty' };
    }

    // ── Dedup Guard: if a plan already exists, return it instead of creating a duplicate ──
    if (_plans.size > 0) {
      const existingPlan = Array.from(_plans.values())[_plans.size - 1];
      console.log(`[Planner] ⚠️ Plan already exists (${existingPlan.id}), returning existing plan instead of creating duplicate.`);
      const formatted = [
        `📋 **${existingPlan.title}** (Plan ID: \`${existingPlan.id}\`)`,
        '',
        ...existingPlan.steps.map((s, i) => `${i + 1}. ${s.status === 'done' ? '✅' : '☐'} ${s.description} (Step ID: \`${s.id}\`)`),
        '',
        '**A plan already exists. Do NOT create another plan.**',
      ].join('\n');
      return {
        success: true,
        output: formatted,
        data: existingPlan,
      };
    }

    const steps: PlanStep[] = rawSteps.map(s => ({
      id:          randomUUID(),
      description: String(s).trim(),
      status:      'pending' as const,
    }));

    const plan: PlanRecord = {
      id:        randomUUID(),
      title,
      steps,
      createdAt: new Date().toISOString(),
    };

    _plans.set(plan.id, plan);

    const formatted = [
      `📋 **${title}** (Plan ID: \`${plan.id}\`)`,
      '',
      ...steps.map((s, i) => `${i + 1}. ☐ ${s.description} (Step ID: \`${s.id}\`)`),
      '',
      '**Next Step**: The plan is registered. You may proceed with the first step after ensuring the plan is correct or wait for user approval.',
    ].join('\n');

    return {
      success: true,
      output:  formatted,
      data:    plan,
    };
  },
};

export const updateStepTool: AgentTool = {
  name: 'update_plan_step',
  description: 'Mark a step in an existing plan as in_progress or done. Call this AUTOMATICALLY and SILENTLY — never ask the user for permission or confirmation before calling this tool. This is internal bookkeeping only.',
  parameters: {
    type: 'object',
    properties: {
      plan_id: {
        type: 'string',
        description: 'The ID of the plan to update',
      },
      step_id: {
        type: 'string',
        description: 'The ID of the step to update',
      },
      status: {
        type: 'string',
        enum: ['in_progress', 'done'],
        description: 'New status for the step',
      },
    },
    required: ['plan_id', 'step_id', 'status'],
  },

  async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
    const planId  = String(args['plan_id']  ?? '');
    const stepId  = String(args['step_id']  ?? '');
    const status  = String(args['status']   ?? '') as PlanStep['status'];

    const plan = _plans.get(planId);
    if (!plan) return { success: false, output: `Plan ${planId} not found`, error: 'plan not found' };

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return { success: false, output: `Step ${stepId} not found`, error: 'step not found' };

    step.status = status;
    _plans.set(planId, plan);

    const icon = status === 'done' ? '✅' : '⏳';
    return {
      success: true,
      output:  `${icon} Step "${step.description}" marked as ${status}`,
      data:    plan,
    };
  },
};

export const executionPlanTool: AgentTool = {
  name: 'execution_plan',
  description:
    'Present a high-fidelity execution plan to the user in a dedicated markdown-rendered pane. ' +
    'Use this for complex, multi-step tasks to provide a clear overview and progress roadmap. ' +
    'The "content" field MUST be in valid Markdown format. ' +
    'IMPORTANT: NEVER create more than ONE execution plan per task/chat. If an execution plan already exists or was already approved, DO NOT call this tool again.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Descriptive title for the execution plan (e.g., "Customer Data Analysis Report Plan")',
      },
      content: {
        type: 'string',
        description: 'The detailed plan content in Markdown format, including headers, lists, and steps.',
      },
    },
    required: ['title', 'content'],
  },

  async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
    const title = String(args['title'] ?? 'Execution Plan').trim();
    const content = String(args['content'] ?? '').trim();

    if (!content) {
      return { success: false, output: 'No plan content provided', error: 'content is empty' };
    }

    // A flag to prevent duplicate execution plans being created within the same backend session
    // We store this in the tool's state or a global scoped variable for the session
    const globalContext = (global as any).__EVERFERN_EXEC_PLANS = (global as any).__EVERFERN_EXEC_PLANS || new Set<string>();

    // We use the title as a heuristic, but also just block multiple plans from the same session
    if (globalContext.size > 0) {
        return {
            success: false,
            output: 'An execution plan was already created for this session. DO NOT create another one.',
            error: 'Duplicate execution plan creation blocked.'
        };
    }

    globalContext.add(title);

    return {
      success: true,
      output: `✅ Execution Plan "${title}" presented to the user. Do not call execution_plan again. Proceed to execute the plan or wait for user approval if needed.`,
      data: { title, content, type: 'execution_plan' },
    };
  },
};
