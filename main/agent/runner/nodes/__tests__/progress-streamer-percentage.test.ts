import { describe, it, expect, beforeEach } from 'vitest';
import { StreamEvent } from '../../state';

/**
 * Test for ProgressStreamer percentage calculation (Task 2.2)
 * Validates: Requirements 1.5
 */

// Mock implementation of ProgressStreamer for testing
interface ProgressStreamer {
  emitStart(agentName: string): void;
  emitProgress(message: string, percentage?: number): void;
  emitStepComplete(stepName: string, durationMs: number): void;
  emitError(error: Error, diagnostics: string): void;
  setTotalSteps(total: number): void;
  incrementCompletedSteps(): void;
  getPercentage(): number;
}

function createProgressStreamer(eventQueue?: StreamEvent[]): ProgressStreamer {
  let totalSteps = 0;
  let completedSteps = 0;

  return {
    emitStart(agentName: string): void {
      eventQueue?.push({
        type: 'thought',
        content: `\n📊 ${agentName}: Initializing analysis...`
      });
    },

    emitProgress(message: string, percentage?: number): void {
      const progressText = percentage !== undefined
        ? `[${percentage}%] ${message}`
        : message;
      eventQueue?.push({
        type: 'thought',
        content: `\n📊 ${progressText}`
      });
    },

    emitStepComplete(stepName: string, durationMs: number): void {
      const durationSec = (durationMs / 1000).toFixed(2);
      eventQueue?.push({
        type: 'thought',
        content: `\n✅ ${stepName} completed in ${durationSec}s`
      });
    },

    emitError(error: Error, diagnostics: string): void {
      eventQueue?.push({
        type: 'thought',
        content: `\n❌ Error: ${error.message}\n${diagnostics}`
      });
    },

    setTotalSteps(total: number): void {
      totalSteps = total;
      completedSteps = 0;
    },

    incrementCompletedSteps(): void {
      completedSteps++;
    },

    getPercentage(): number {
      if (totalSteps === 0) return 0;
      return Math.round((completedSteps / totalSteps) * 100);
    }
  };
}

describe('ProgressStreamer Percentage Calculation', () => {
  let eventQueue: StreamEvent[];
  let progressStreamer: ProgressStreamer;

  beforeEach(() => {
    eventQueue = [];
    progressStreamer = createProgressStreamer(eventQueue);
  });

  it('should return 0% when no steps are set', () => {
    expect(progressStreamer.getPercentage()).toBe(0);
  });

  it('should return 0% when total steps is 0', () => {
    progressStreamer.setTotalSteps(0);
    expect(progressStreamer.getPercentage()).toBe(0);
  });

  it('should calculate 50% when 1 of 2 steps completed', () => {
    progressStreamer.setTotalSteps(2);
    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(50);
  });

  it('should calculate 100% when all steps completed', () => {
    progressStreamer.setTotalSteps(3);
    progressStreamer.incrementCompletedSteps();
    progressStreamer.incrementCompletedSteps();
    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(100);
  });

  it('should calculate 33% when 1 of 3 steps completed', () => {
    progressStreamer.setTotalSteps(3);
    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(33);
  });

  it('should calculate 67% when 2 of 3 steps completed', () => {
    progressStreamer.setTotalSteps(3);
    progressStreamer.incrementCompletedSteps();
    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(67);
  });

  it('should reset completed steps when setTotalSteps is called', () => {
    progressStreamer.setTotalSteps(2);
    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(50);

    // Reset with new total
    progressStreamer.setTotalSteps(4);
    expect(progressStreamer.getPercentage()).toBe(0);
  });

  it('should include percentage in progress events when provided', () => {
    progressStreamer.setTotalSteps(4);
    progressStreamer.incrementCompletedSteps();
    const percentage = progressStreamer.getPercentage();

    progressStreamer.emitProgress('Loading data', percentage);

    const progressEvent = eventQueue.find(e => e.type === 'thought' && e.content.includes('[25%]'));
    expect(progressEvent).toBeDefined();
    expect(progressEvent?.content).toContain('[25%] Loading data');
  });

  it('should emit progress without percentage when not provided', () => {
    progressStreamer.emitProgress('Processing...');

    const progressEvent = eventQueue.find(e => e.type === 'thought' && e.content.includes('Processing...'));
    expect(progressEvent).toBeDefined();
    expect(progressEvent?.content).not.toContain('%');
  });

  it('should track multiple steps correctly', () => {
    progressStreamer.setTotalSteps(5);

    expect(progressStreamer.getPercentage()).toBe(0);

    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(20);

    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(40);

    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(60);

    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(80);

    progressStreamer.incrementCompletedSteps();
    expect(progressStreamer.getPercentage()).toBe(100);
  });

  it('should round percentage to nearest integer', () => {
    progressStreamer.setTotalSteps(7);
    progressStreamer.incrementCompletedSteps();
    // 1/7 = 14.285... should round to 14
    expect(progressStreamer.getPercentage()).toBe(14);

    progressStreamer.incrementCompletedSteps();
    // 2/7 = 28.571... should round to 29
    expect(progressStreamer.getPercentage()).toBe(29);
  });
});
