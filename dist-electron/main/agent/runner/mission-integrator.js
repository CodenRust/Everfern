"use strict";
/**
 * Mission Integration Adapter
 *
 * Safe integration of MissionTracker throughout the graph without breaking
 * existing node implementations. Nodes can optionally use mission tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionIntegrator = void 0;
exports.createMissionIntegrator = createMissionIntegrator;
class MissionIntegrator {
    tracker;
    nodeStepMap = new Map(); // node name → step id
    constructor(tracker) {
        this.tracker = tracker;
    }
    /**
     * Begin tracking a node's execution
     */
    startNode(nodeId, description) {
        if (!this.tracker)
            return;
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
    completeNode(nodeId, result) {
        if (!this.tracker)
            return;
        const stepId = this.nodeStepMap.get(nodeId) || `step:${nodeId}`;
        this.tracker.completeStep(stepId, result);
    }
    /**
     * Fail a node's execution
     */
    failNode(nodeId, error) {
        if (!this.tracker)
            return;
        const stepId = this.nodeStepMap.get(nodeId) || `step:${nodeId}`;
        this.tracker.failStep(stepId, error);
    }
    /**
     * Record tool calls for current node
     */
    recordToolCalls(nodeId, toolNames) {
        if (!this.tracker)
            return;
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
    setMetadata(nodeId, metadata) {
        if (!this.tracker)
            return;
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
    isEnabled() {
        return !!this.tracker;
    }
    /**
     * Wrap node execution with tracking
     */
    async wrapNode(nodeId, nodeFunc, description) {
        if (!this.tracker) {
            return nodeFunc();
        }
        try {
            this.startNode(nodeId, description || `Executing ${nodeId}`);
            const result = await nodeFunc();
            this.completeNode(nodeId, JSON.stringify(result, null, 2).slice(0, 500));
            return result;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.failNode(nodeId, errorMsg);
            throw error;
        }
    }
    /**
     * Get the underlying tracker (if you need direct access)
     */
    getTracker() {
        return this.tracker;
    }
}
exports.MissionIntegrator = MissionIntegrator;
/**
 * Create a no-op integrator when tracker is not available
 * This allows using the same API regardless of whether tracking is enabled
 */
function createMissionIntegrator(tracker) {
    return new MissionIntegrator(tracker);
}
