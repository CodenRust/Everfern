/**
 * Integration tests for mission_complete event with thinkingDuration
 * 
 * Validates Requirements 8.2, 8.3, 8.4
 */

import { describe, it, expect } from 'vitest';
import type { StreamEvent, ThinkingDuration } from '../state';
import { isMissionCompleteEvent, hasThinkingDuration, isValidThinkingDuration } from '../state';

describe('Mission Complete Event with Duration', () => {
  describe('Event Structure', () => {
    it('should include thinkingDuration in mission_complete event payload', () => {
      // Simulate the event structure emitted by runner.ts
      const thinkingDuration: ThinkingDuration = {
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
      };

      const event: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
        thinkingDuration,
      };

      expect(isMissionCompleteEvent(event)).toBe(true);
      expect(hasThinkingDuration(event)).toBe(true);
      
      if (hasThinkingDuration(event)) {
        expect(event.thinkingDuration).toBeDefined();
        expect(event.thinkingDuration.startTime).toBe(thinkingDuration.startTime);
        expect(event.thinkingDuration.endTime).toBe(thinkingDuration.endTime);
        expect(event.thinkingDuration.duration).toBe(thinkingDuration.duration);
      }
    });

    it('should handle mission_complete event without thinkingDuration', () => {
      // When no thinking occurred
      const event: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
        thinkingDuration: undefined,
      };

      expect(isMissionCompleteEvent(event)).toBe(true);
      expect(hasThinkingDuration(event)).toBe(false);
    });
  });

  describe('IPC Serialization Preservation', () => {
    it('should preserve all duration fields after JSON serialization', () => {
      const originalEvent: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
        thinkingDuration: {
          startTime: 1000,
          endTime: 2000,
          duration: 1000,
        },
      };

      // Simulate IPC serialization (JSON.stringify/parse)
      const serialized = JSON.stringify(originalEvent);
      const deserialized = JSON.parse(serialized) as StreamEvent;

      expect(isMissionCompleteEvent(deserialized)).toBe(true);
      expect(hasThinkingDuration(deserialized)).toBe(true);
      
      if (hasThinkingDuration(deserialized)) {
        expect(deserialized.thinkingDuration.startTime).toBe(1000);
        expect(deserialized.thinkingDuration.endTime).toBe(2000);
        expect(deserialized.thinkingDuration.duration).toBe(1000);
      }
    });

    it('should preserve undefined duration after JSON serialization', () => {
      const originalEvent: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
        thinkingDuration: undefined,
      };

      // Simulate IPC serialization
      const serialized = JSON.stringify(originalEvent);
      const deserialized = JSON.parse(serialized) as StreamEvent;

      expect(isMissionCompleteEvent(deserialized)).toBe(true);
      expect(hasThinkingDuration(deserialized)).toBe(false);
    });

    it('should handle partial duration data after serialization', () => {
      const originalEvent: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
        thinkingDuration: {
          startTime: 1000,
          // endTime and duration not yet set
        },
      };

      // Simulate IPC serialization
      const serialized = JSON.stringify(originalEvent);
      const deserialized = JSON.parse(serialized) as StreamEvent;

      expect(isMissionCompleteEvent(deserialized)).toBe(true);
      expect(hasThinkingDuration(deserialized)).toBe(true);
      
      if (hasThinkingDuration(deserialized)) {
        expect(deserialized.thinkingDuration.startTime).toBe(1000);
        expect(deserialized.thinkingDuration.endTime).toBeUndefined();
        expect(deserialized.thinkingDuration.duration).toBeUndefined();
      }
    });
  });

  describe('Duration Validation', () => {
    it('should validate complete duration data', () => {
      const duration: ThinkingDuration = {
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
      };

      expect(isValidThinkingDuration(duration)).toBe(true);
    });

    it('should reject invalid duration data', () => {
      const invalidDurations: (ThinkingDuration | undefined)[] = [
        undefined,
        { startTime: -1000 },
        { startTime: 2000, endTime: 1000 },
        { startTime: 1000, endTime: 2000, duration: -500 },
        { startTime: 1000, endTime: 2000, duration: 500 }, // Mismatch
      ];

      invalidDurations.forEach(duration => {
        expect(isValidThinkingDuration(duration)).toBe(false);
      });
    });
  });

  describe('Event Payload Structure', () => {
    it('should include all required fields in mission_complete event', () => {
      const event: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
        thinkingDuration: {
          startTime: 1000,
          endTime: 2000,
          duration: 1000,
        },
      };

      // Verify all required fields are present
      expect(event.type).toBe('mission_complete');
      expect(event.timeline).toBeDefined();
      expect(event.steps).toBeDefined();
      expect(Array.isArray(event.steps)).toBe(true);
      
      if (hasThinkingDuration(event)) {
        expect(event.thinkingDuration.startTime).toBeDefined();
        expect(typeof event.thinkingDuration.startTime).toBe('number');
        expect(event.thinkingDuration.endTime).toBeDefined();
        expect(typeof event.thinkingDuration.endTime).toBe('number');
        expect(event.thinkingDuration.duration).toBeDefined();
        expect(typeof event.thinkingDuration.duration).toBe('number');
      }
    });
  });
});
