/**
 * Duration Tracker for Agent Thinking Time
 * 
 * Tracks the duration from the first thought event to mission completion.
 * Used to display "Thought for X seconds" in the UI.
 */

export interface ThinkingDuration {
  startTime: number; // Unix timestamp in milliseconds
  endTime?: number; // Unix timestamp in milliseconds
  duration?: number; // Total duration in milliseconds
}

/**
 * Tracks thinking duration for a single mission/conversation
 */
export class DurationTracker {
  private startTime?: number;
  private endTime?: number;

  /**
   * Called when the first thought event occurs
   * Only records the timestamp on the first call
   */
  onThoughtStart(): void {
    if (!this.startTime) {
      this.startTime = Date.now();
    }
  }

  /**
   * Called when the mission completes
   * Returns the thinking duration or undefined if no thinking occurred
   */
  onMissionComplete(): ThinkingDuration | undefined {
    if (!this.startTime) {
      return undefined;
    }

    this.endTime = Date.now();

    // Validate that endTime > startTime
    if (this.endTime < this.startTime) {
      console.warn('[DurationTracker] Invalid duration: endTime < startTime');
      return undefined;
    }

    const duration = this.endTime - this.startTime;

    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration,
    };
  }

  /**
   * Reset the tracker for a new mission
   */
  reset(): void {
    this.startTime = undefined;
    this.endTime = undefined;
  }
}
