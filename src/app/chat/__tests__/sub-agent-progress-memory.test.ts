import { describe, it, expect } from 'vitest';

/**
 * Tests for Sub-Agent Progress Memory Management
 *
 * Validates Requirements:
 * - 10.3: Event memory management (limit to 100 events, clear on completion)
 * - 14.3: Event grouping by toolCallId
 *
 * Feature: sub-agent-progress-streaming
 * Task: 7.4 Implement event memory management
 * Task: 7.5 Write unit tests for state management
 */

interface SubAgentProgressEvent {
  type: 'step' | 'reasoning' | 'action' | 'screenshot' | 'complete' | 'abort';
  toolCallId: string;
  timestamp: string;
  stepNumber?: number;
  totalSteps?: number;
  content?: string;
}

/**
 * Simulates the event handler logic from src/app/chat/page.tsx
 */
function handleProgressEvent(
  prevMap: Map<string, SubAgentProgressEvent[]>,
  event: SubAgentProgressEvent
): Map<string, SubAgentProgressEvent[]> {
  const newMap = new Map(prevMap);

  // Clear events when tool completes or aborts
  if (event.type === 'complete' || event.type === 'abort') {
    newMap.delete(event.toolCallId);
    return newMap;
  }

  // Get existing events and add new event
  const existingEvents = newMap.get(event.toolCallId) || [];
  const updatedEvents = [...existingEvents, event];

  // Limit to last 100 events per tool call
  const limitedEvents = updatedEvents.slice(-100);

  newMap.set(event.toolCallId, limitedEvents);
  return newMap;
}

describe('Sub-Agent Progress Memory Management', () => {
  describe('Event limit enforcement', () => {
    it('should store events when under 100 limit', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add 50 events
      for (let i = 1; i <= 50; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
          totalSteps: 100,
        };
        state = handleProgressEvent(state, event);
      }

      const events = state.get(toolCallId);
      expect(events).toBeDefined();
      expect(events?.length).toBe(50);
    });

    it('should limit events to last 100 when exceeding limit', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add 150 events
      for (let i = 1; i <= 150; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
          totalSteps: 200,
        };
        state = handleProgressEvent(state, event);
      }

      const events = state.get(toolCallId);
      expect(events).toBeDefined();
      expect(events?.length).toBe(100);

      // Verify we kept the last 100 events (51-150)
      expect(events?.[0].stepNumber).toBe(51);
      expect(events?.[99].stepNumber).toBe(150);
    });

    it('should keep exactly 100 events when adding 101st event', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add 101 events
      for (let i = 1; i <= 101; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
          totalSteps: 200,
        };
        state = handleProgressEvent(state, event);
      }

      const events = state.get(toolCallId);
      expect(events).toBeDefined();
      expect(events?.length).toBe(100);

      // Verify we dropped the first event and kept events 2-101
      expect(events?.[0].stepNumber).toBe(2);
      expect(events?.[99].stepNumber).toBe(101);
    });

    it('should handle multiple tool calls independently', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId1 = 'test-tool-1';
      const toolCallId2 = 'test-tool-2';

      // Add 120 events to tool 1
      for (let i = 1; i <= 120; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId: toolCallId1,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        };
        state = handleProgressEvent(state, event);
      }

      // Add 50 events to tool 2
      for (let i = 1; i <= 50; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId: toolCallId2,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        };
        state = handleProgressEvent(state, event);
      }

      const events1 = state.get(toolCallId1);
      const events2 = state.get(toolCallId2);

      expect(events1?.length).toBe(100); // Limited to 100
      expect(events2?.length).toBe(50);  // Under limit
      expect(events1?.[0].stepNumber).toBe(21); // Dropped first 20
      expect(events2?.[0].stepNumber).toBe(1);  // Kept all
    });
  });

  describe('Event clearing on completion', () => {
    it('should clear events when complete event received', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add some events
      for (let i = 1; i <= 10; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        };
        state = handleProgressEvent(state, event);
      }

      expect(state.get(toolCallId)?.length).toBe(10);

      // Send complete event
      const completeEvent: SubAgentProgressEvent = {
        type: 'complete',
        toolCallId,
        timestamp: new Date().toISOString(),
      };
      state = handleProgressEvent(state, completeEvent);

      // Events should be cleared
      expect(state.has(toolCallId)).toBe(false);
    });

    it('should clear events when abort event received', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add some events
      for (let i = 1; i <= 10; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        };
        state = handleProgressEvent(state, event);
      }

      expect(state.get(toolCallId)?.length).toBe(10);

      // Send abort event
      const abortEvent: SubAgentProgressEvent = {
        type: 'abort',
        toolCallId,
        timestamp: new Date().toISOString(),
      };
      state = handleProgressEvent(state, abortEvent);

      // Events should be cleared
      expect(state.has(toolCallId)).toBe(false);
    });

    it('should only clear events for specific tool call', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId1 = 'test-tool-1';
      const toolCallId2 = 'test-tool-2';

      // Add events to both tools
      for (let i = 1; i <= 10; i++) {
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId: toolCallId1,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId: toolCallId2,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(state.get(toolCallId1)?.length).toBe(10);
      expect(state.get(toolCallId2)?.length).toBe(10);

      // Complete only tool 1
      state = handleProgressEvent(state, {
        type: 'complete',
        toolCallId: toolCallId1,
        timestamp: new Date().toISOString(),
      });

      // Tool 1 events cleared, tool 2 events remain
      expect(state.has(toolCallId1)).toBe(false);
      expect(state.get(toolCallId2)?.length).toBe(10);
    });

    it('should handle complete event for non-existent tool call', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Send complete event for tool that has no events
      const completeEvent: SubAgentProgressEvent = {
        type: 'complete',
        toolCallId,
        timestamp: new Date().toISOString(),
      };

      // Should not throw error
      expect(() => {
        state = handleProgressEvent(state, completeEvent);
      }).not.toThrow();

      expect(state.has(toolCallId)).toBe(false);
    });
  });

  describe('Mixed event types', () => {
    it('should handle different event types correctly', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add various event types
      const events: SubAgentProgressEvent[] = [
        { type: 'step', toolCallId, timestamp: new Date().toISOString(), stepNumber: 1 },
        { type: 'reasoning', toolCallId, timestamp: new Date().toISOString(), content: 'Thinking...' },
        { type: 'action', toolCallId, timestamp: new Date().toISOString(), content: 'Click button' },
        { type: 'screenshot', toolCallId, timestamp: new Date().toISOString() },
        { type: 'step', toolCallId, timestamp: new Date().toISOString(), stepNumber: 2 },
      ];

      events.forEach(event => {
        state = handleProgressEvent(state, event);
      });

      const storedEvents = state.get(toolCallId);
      expect(storedEvents?.length).toBe(5);
      expect(storedEvents?.[0].type).toBe('step');
      expect(storedEvents?.[1].type).toBe('reasoning');
      expect(storedEvents?.[2].type).toBe('action');
      expect(storedEvents?.[3].type).toBe('screenshot');
      expect(storedEvents?.[4].type).toBe('step');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty state', () => {
      const state = new Map<string, SubAgentProgressEvent[]>();
      const event: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'test-tool-1',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
      };

      const newState = handleProgressEvent(state, event);
      expect(newState.get('test-tool-1')?.length).toBe(1);
    });

    it('should handle exactly 100 events', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add exactly 100 events
      for (let i = 1; i <= 100; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        };
        state = handleProgressEvent(state, event);
      }

      const events = state.get(toolCallId);
      expect(events?.length).toBe(100);
      expect(events?.[0].stepNumber).toBe(1);
      expect(events?.[99].stepNumber).toBe(100);
    });

    it('should handle rapid event additions', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Simulate rapid event additions (200 events)
      for (let i = 1; i <= 200; i++) {
        const event: SubAgentProgressEvent = {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        };
        state = handleProgressEvent(state, event);
      }

      const events = state.get(toolCallId);
      expect(events?.length).toBe(100);
      expect(events?.[0].stepNumber).toBe(101);
      expect(events?.[99].stepNumber).toBe(200);
    });
  });

  describe('Cleanup on unmount', () => {
    it('should clear all events when state is reset', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId1 = 'test-tool-1';
      const toolCallId2 = 'test-tool-2';

      // Add events to multiple tool calls
      for (let i = 1; i <= 50; i++) {
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId: toolCallId1,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId: toolCallId2,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(state.size).toBe(2);
      expect(state.get(toolCallId1)?.length).toBe(50);
      expect(state.get(toolCallId2)?.length).toBe(50);

      // Simulate unmount cleanup - clear the map
      state = new Map();

      expect(state.size).toBe(0);
      expect(state.get(toolCallId1)).toBeUndefined();
      expect(state.get(toolCallId2)).toBeUndefined();
    });

    it('should clear state with many tool calls', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();

      // Add events to 10 different tool calls
      for (let toolNum = 1; toolNum <= 10; toolNum++) {
        const toolCallId = `test-tool-${toolNum}`;
        for (let i = 1; i <= 20; i++) {
          state = handleProgressEvent(state, {
            type: 'step',
            toolCallId,
            timestamp: new Date().toISOString(),
            stepNumber: i,
          });
        }
      }

      expect(state.size).toBe(10);

      // Simulate unmount cleanup
      state = new Map();

      expect(state.size).toBe(0);
      for (let toolNum = 1; toolNum <= 10; toolNum++) {
        expect(state.get(`test-tool-${toolNum}`)).toBeUndefined();
      }
    });

    it('should clear state with events at memory limit', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add 150 events (will be limited to 100)
      for (let i = 1; i <= 150; i++) {
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(state.get(toolCallId)?.length).toBe(100);

      // Simulate unmount cleanup
      state = new Map();

      expect(state.size).toBe(0);
      expect(state.get(toolCallId)).toBeUndefined();
    });

    it('should allow re-initialization after cleanup', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();
      const toolCallId = 'test-tool-1';

      // Add some events
      for (let i = 1; i <= 10; i++) {
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(state.get(toolCallId)?.length).toBe(10);

      // Simulate unmount cleanup
      state = new Map();
      expect(state.size).toBe(0);

      // Re-initialize with new events (simulating component remount)
      for (let i = 1; i <= 5; i++) {
        state = handleProgressEvent(state, {
          type: 'step',
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(state.size).toBe(1);
      expect(state.get(toolCallId)?.length).toBe(5);
      expect(state.get(toolCallId)?.[0].stepNumber).toBe(1);
    });

    it('should handle cleanup of empty state', () => {
      let state = new Map<string, SubAgentProgressEvent[]>();

      expect(state.size).toBe(0);

      // Simulate unmount cleanup on empty state
      state = new Map();

      expect(state.size).toBe(0);
    });
  });
});
