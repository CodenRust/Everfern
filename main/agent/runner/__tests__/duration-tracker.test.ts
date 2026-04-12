/**
 * Unit tests for DurationTracker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DurationTracker } from '../duration-tracker';

describe('DurationTracker', () => {
  let tracker: DurationTracker;

  beforeEach(() => {
    tracker = new DurationTracker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('onThoughtStart', () => {
    it('should record start time on first call', () => {
      const startTime = Date.now();
      tracker.onThoughtStart();
      
      const result = tracker.onMissionComplete();
      expect(result).toBeDefined();
      expect(result?.startTime).toBe(startTime);
    });

    it('should not overwrite start time on subsequent calls', () => {
      const startTime = Date.now();
      tracker.onThoughtStart();
      
      vi.advanceTimersByTime(1000);
      tracker.onThoughtStart(); // Second call should not change startTime
      
      const result = tracker.onMissionComplete();
      expect(result?.startTime).toBe(startTime);
    });
  });

  describe('onMissionComplete', () => {
    it('should return undefined if no thinking occurred', () => {
      const result = tracker.onMissionComplete();
      expect(result).toBeUndefined();
    });

    it('should calculate duration correctly', () => {
      const startTime = Date.now();
      tracker.onThoughtStart();
      
      vi.advanceTimersByTime(5000); // 5 seconds
      
      const result = tracker.onMissionComplete();
      expect(result).toBeDefined();
      expect(result?.startTime).toBe(startTime);
      expect(result?.endTime).toBe(startTime + 5000);
      expect(result?.duration).toBe(5000);
    });

    it('should return undefined if endTime < startTime', () => {
      // This is a defensive test - in practice this shouldn't happen
      // but we validate it in the implementation
      tracker.onThoughtStart();
      
      // Manually set a negative time advance (shouldn't happen in real usage)
      vi.setSystemTime(Date.now() - 1000);
      
      const result = tracker.onMissionComplete();
      expect(result).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear start and end times', () => {
      tracker.onThoughtStart();
      vi.advanceTimersByTime(1000);
      tracker.onMissionComplete();
      
      tracker.reset();
      
      const result = tracker.onMissionComplete();
      expect(result).toBeUndefined();
    });

    it('should allow tracking a new mission after reset', () => {
      // First mission
      tracker.onThoughtStart();
      vi.advanceTimersByTime(1000);
      const result1 = tracker.onMissionComplete();
      expect(result1?.duration).toBe(1000);
      
      // Reset
      tracker.reset();
      
      // Second mission
      const newStartTime = Date.now();
      tracker.onThoughtStart();
      vi.advanceTimersByTime(2000);
      const result2 = tracker.onMissionComplete();
      
      expect(result2?.startTime).toBe(newStartTime);
      expect(result2?.duration).toBe(2000);
    });
  });
});
