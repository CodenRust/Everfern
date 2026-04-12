/**
 * Tests for StreamEvent type guards and validation
 * 
 * Validates Requirements 8.3, 8.4
 */

import { describe, it, expect } from 'vitest';
import {
  isMissionCompleteEvent,
  hasThinkingDuration,
  isValidThinkingDuration,
  type StreamEvent,
  type ThinkingDuration,
} from '../state';

describe('StreamEvent Type Guards', () => {
  describe('isMissionCompleteEvent', () => {
    it('should return true for mission_complete events', () => {
      const event: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
      };
      
      expect(isMissionCompleteEvent(event)).toBe(true);
    });

    it('should return false for non-mission_complete events', () => {
      const events: StreamEvent[] = [
        { type: 'thought', content: 'thinking...' },
        { type: 'chunk', content: 'response' },
        { type: 'done' },
      ];
      
      events.forEach(event => {
        expect(isMissionCompleteEvent(event)).toBe(false);
      });
    });
  });

  describe('hasThinkingDuration', () => {
    it('should return true for mission_complete events with thinkingDuration', () => {
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
      
      expect(hasThinkingDuration(event)).toBe(true);
    });

    it('should return false for mission_complete events without thinkingDuration', () => {
      const event: StreamEvent = {
        type: 'mission_complete',
        timeline: null,
        steps: [],
      };
      
      expect(hasThinkingDuration(event)).toBe(false);
    });

    it('should return false for non-mission_complete events', () => {
      const event: StreamEvent = {
        type: 'thought',
        content: 'thinking...',
      };
      
      expect(hasThinkingDuration(event)).toBe(false);
    });
  });

  describe('isValidThinkingDuration', () => {
    it('should return true for valid duration with all fields', () => {
      const duration: ThinkingDuration = {
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
      };
      
      expect(isValidThinkingDuration(duration)).toBe(true);
    });

    it('should return true for valid duration with only startTime', () => {
      const duration: ThinkingDuration = {
        startTime: 1000,
      };
      
      expect(isValidThinkingDuration(duration)).toBe(true);
    });

    it('should return false for undefined duration', () => {
      expect(isValidThinkingDuration(undefined)).toBe(false);
    });

    it('should return false for negative startTime', () => {
      const duration: ThinkingDuration = {
        startTime: -1000,
      };
      
      expect(isValidThinkingDuration(duration)).toBe(false);
    });

    it('should return false when endTime < startTime', () => {
      const duration: ThinkingDuration = {
        startTime: 2000,
        endTime: 1000,
      };
      
      expect(isValidThinkingDuration(duration)).toBe(false);
    });

    it('should return false for negative duration', () => {
      const duration: ThinkingDuration = {
        startTime: 1000,
        endTime: 2000,
        duration: -1000,
      };
      
      expect(isValidThinkingDuration(duration)).toBe(false);
    });

    it('should return false when duration does not match endTime - startTime', () => {
      const duration: ThinkingDuration = {
        startTime: 1000,
        endTime: 2000,
        duration: 500, // Should be 1000
      };
      
      expect(isValidThinkingDuration(duration)).toBe(false);
    });

    it('should allow small rounding errors in duration calculation', () => {
      const duration: ThinkingDuration = {
        startTime: 1000,
        endTime: 2000,
        duration: 1000.5, // Within 1ms tolerance
      };
      
      expect(isValidThinkingDuration(duration)).toBe(true);
    });
  });
});

describe('StreamEvent Structure Completeness', () => {
  it('mission_complete event should include all duration fields when present', () => {
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
    
    expect(isMissionCompleteEvent(event)).toBe(true);
    expect(hasThinkingDuration(event)).toBe(true);
    
    if (hasThinkingDuration(event)) {
      expect(event.thinkingDuration.startTime).toBe(1000);
      expect(event.thinkingDuration.endTime).toBe(2000);
      expect(event.thinkingDuration.duration).toBe(1000);
    }
  });

  it('mission_complete event should handle undefined duration gracefully', () => {
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
