/**
 * Mission Integration Adapter
 * 
 * Safe integration of MissionTracker throughout the graph without breaking
 * existing node implementations. Nodes can optionally use mission tracking.
 */

import type { MissionTracker, MissionStep, StepStatus } from './mission-tracker';
import type { GraphStateType } from './state';

export class MissionIntegrator {
  private tracker?: MissionTracker;
  private nodeStepMap: Map<string, string> = new Map(); // node name → step id

  constructor(tracker?: MissionTracker) {
    this.tracker = tracker;
  }

  /**
   * Begin tracking a node's execution
   */
  startNode(nodeId: string, description: string): void {
    if (!this.tracker) return;

    const stepId = `step:${nodeId}`;
    this.nodeStepMap.set(nodeId, stepId);

    // Check if step exists, create if not
    let step = this.tracker.getStep(stepId);
    if (!step) {
      step = this.tracker.addStep({
        id: stepId,
        name: nodeId.replace(/_/g, ' ').toUpperCase(),
        description,
        phase: 'execution',
      });
    }

    this.tracker.startStep(stepId);
  }

  /**
   * Complete a node's execution
   */
  completeNode(nodeId: string, result?: string): void {
    if (!this.tracker) return;

    const stepId = this.nodeStepMap.get(nodeId) || `step:${nodeId}`;
    this.tracker.completeStep(stepId, result);
  }

  /**
   * Fail a node's execution
   */
  failNode(nodeId: string, error: string): void {
    if (!this.tracker) return;

    const stepId = this.nodeStepMap.get(nodeId) || `step:${nodeId}`;
    this.tracker.failStep(stepId, error);
  }

  /**
   * Record tool calls for current node
   */
  recordToolCalls(nodeId: string, toolNames: string[]): void {
    if (!this.tracker) return;

    const stepId = this.nodeStepMap.get(nodeId) || `step:${nodeId}`;
    const step = this.tracker.getStep(stepId);
    if (step) {
      this.tracker.updateStep(stepId, {
        toolCalls: toolNames,
      });
    }
  }

  /**
   * Update node metadata
   */
  setMetadata(nodeId: string, metadata: Record<string, any>): void {
    if (!this.tracker) return;

    const stepId = this.nodeStepMap.get(nodeId) || `step:${nodeId}`;
    const step = this.tracker.getStep(stepId);
    if (step) {
      this.tracker.updateStep(stepId, {
        metadata: { ...step.metadata, ...metadata },
      });
    }
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return !!this.tracker;
  }

  /**
   * Wrap node execution with tracking
   */
  async wrapNode<T>(
    nodeId: string,
    nodeFunc: () => Promise<T>,
    description?: string
  ): Promise<T> {
    if (!this.tracker) {
      return nodeFunc();
    }

    try {
      this.startNode(nodeId, description || `Executing ${nodeId}`);
      const result = await nodeFunc();
      this.completeNode(nodeId, JSON.stringify(result, null, 2).slice(0, 500));
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.failNode(nodeId, errorMsg);
      throw error;
    }
  }

  /**
   * Get the underlying tracker (if you need direct access)
   */
  getTracker(): MissionTracker | undefined {
    return this.tracker;
  }
}

/**
 * Create a no-op integrator when tracker is not available
 * This allows using the same API regardless of whether tracking is enabled
 */
export function createMissionIntegrator(tracker?: MissionTracker): MissionIntegrator {
  return new MissionIntegrator(tracker);
}
