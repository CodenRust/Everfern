"use strict";
/**
 * Mission Step Tracker - OpenClaw Style Orchestration
 *
 * Tracks the lifecycle of mission steps with proper state management
 * and event emission for IPC communication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionTracker = void 0;
exports.getMissionTracker = getMissionTracker;
exports.createMissionTracker = createMissionTracker;
exports.clearMissionTracker = clearMissionTracker;
class MissionTracker {
    timeline;
    stepMap = new Map();
    stepCallbacks = [];
    phaseCallbacks = [];
    constructor(missionId) {
        this.timeline = {
            missionId,
            startTime: Date.now(),
            currentPhase: 'triage',
            steps: [],
            completedSteps: 0,
            totalSteps: 0,
            isComplete: false,
        };
    }
    /**
     * Add a step to the mission timeline
     */
    addStep(step) {
        const newStep = {
            ...step,
            status: 'pending',
        };
        this.stepMap.set(step.id, newStep);
        this.timeline.steps.push(newStep);
        this.timeline.totalSteps++;
        return newStep;
    }
    /**
     * Update step status and emit events
     */
    updateStep(stepId, updates) {
        const step = this.stepMap.get(stepId);
        if (!step)
            return null;
        const oldStatus = step.status;
        Object.assign(step, updates);
        // Track timing
        if (oldStatus === 'pending' && step.status === 'in-progress') {
            step.startTime = Date.now();
        }
        else if (oldStatus !== 'completed' && step.status === 'completed') {
            step.endTime = Date.now();
            step.duration = step.endTime - (step.startTime || Date.now());
            this.timeline.completedSteps++;
        }
        // Emit callbacks
        this.stepCallbacks.forEach(cb => cb(step, this.timeline));
        return step;
    }
    /**
     * Mark a step as started
     */
    startStep(stepId) {
        return this.updateStep(stepId, {
            status: 'in-progress',
            startTime: Date.now(),
        });
    }
    /**
     * Mark a step as completed
     */
    completeStep(stepId, result) {
        return this.updateStep(stepId, {
            status: 'completed',
            result,
            endTime: Date.now(),
        });
    }
    /**
     * Mark a step as failed
     */
    failStep(stepId, error) {
        return this.updateStep(stepId, {
            status: 'failed',
            error,
            endTime: Date.now(),
        });
    }
    /**
     * Change mission phase
     */
    setPhase(phase) {
        this.timeline.currentPhase = phase;
        this.phaseCallbacks.forEach(cb => cb(phase, this.timeline));
        return this.timeline;
    }
    /**
     * Complete the mission
     */
    complete(finalResult) {
        this.timeline.isComplete = true;
        this.timeline.finalResult = finalResult;
        this.timeline.currentPhase = 'completion';
        return this.timeline;
    }
    /**
     * Fail the mission
     */
    fail(error) {
        this.timeline.isComplete = true;
        this.timeline.error = error;
        return this.timeline;
    }
    /**
     * Subscribe to step updates
     */
    onStepUpdate(callback) {
        this.stepCallbacks.push(callback);
        return () => {
            const idx = this.stepCallbacks.indexOf(callback);
            if (idx >= 0)
                this.stepCallbacks.splice(idx, 1);
        };
    }
    /**
     * Subscribe to phase changes
     */
    onPhaseChange(callback) {
        this.phaseCallbacks.push(callback);
        return () => {
            const idx = this.phaseCallbacks.indexOf(callback);
            if (idx >= 0)
                this.phaseCallbacks.splice(idx, 1);
        };
    }
    /**
     * Get current timeline state
     */
    getTimeline() {
        return { ...this.timeline };
    }
    /**
     * Get specific step
     */
    getStep(stepId) {
        return this.stepMap.get(stepId) || null;
    }
    /**
     * Get all steps
     */
    getSteps() {
        return Array.from(this.stepMap.values());
    }
    /**
     * Get completion percentage
     */
    getProgress() {
        return this.timeline.totalSteps > 0
            ? Math.round((this.timeline.completedSteps / this.timeline.totalSteps) * 100)
            : 0;
    }
    /**
     * Serialize for IPC
     */
    serialize() {
        return {
            timeline: this.timeline,
            steps: Array.from(this.stepMap.values()),
            progress: this.getProgress(),
        };
    }
}
exports.MissionTracker = MissionTracker;
// Global mission tracker registry (one per conversation)
const missionTrackers = new Map();
function getMissionTracker(missionId) {
    if (!missionTrackers.has(missionId)) {
        missionTrackers.set(missionId, new MissionTracker(missionId));
    }
    return missionTrackers.get(missionId);
}
function createMissionTracker(missionId) {
    const tracker = new MissionTracker(missionId);
    missionTrackers.set(missionId, tracker);
    return tracker;
}
function clearMissionTracker(missionId) {
    missionTrackers.delete(missionId);
}
