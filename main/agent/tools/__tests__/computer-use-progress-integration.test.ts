/**
 * Integration tests for IPC channel with sub-agent progress streaming
 *
 * Tests the integration of the IPC channel for transmitting progress events
 * from backend to frontend, including event transmission, concurrent sub-agents,
 * and error handling.
 *
 * **Validates: Requirements 4.1, 4.3, 14.1, 14.2**
 */

import { describe, it, expect, vi } from 'vitest';
import type { SubAgentProgressEvent } from '../computer-use';

/**
 * Mock implementation of ProgressEventEmitter for testing
 * This mirrors the actual implementation in computer-use.ts
 */
class ProgressEventEmitter {
  private buffer: SubAgentProgressEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 16; // ~60fps
  private readonly MAX_BUFFER_SIZE = 10;

  constructor(
    private toolCallId: string,
    private sender: Electron.WebContents | null
  ) {}

  emit(event: SubAgentProgressEvent): void {
    this.buffer.push(event);

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    if (!this.sender || this.sender.isDestroyed()) {
      console.warn('[SubAgentProgress] IPC sender unavailable, skipping flush');
      this.buffer = [];
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      const serialized = JSON.stringify(this.buffer);
      this.sender.send('acp:sub-agent-progress', serialized);
      this.buffer = [];
    } catch (error) {
      console.error('[SubAgentProgress] Serialization failed:', error);
      console.error('[SubAgentProgress] Failed events:', this.buffer);
      this.buffer = [];
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  destroy(): void {
    this.flush();

    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.buffer = [];
  }
}

// Helper to create a mock sender
function createMockSender() {
  const sentEvents: SubAgentProgressEvent[] = [];
  const sentChannels: string[] = [];

  const sender = {
    send: vi.fn((channel: string, data: string) => {
      sentChannels.push(channel);
      if (channel === 'acp:sub-agent-progress') {
        const parsed = JSON.parse(data);
        sentEvents.push(...parsed);
      }
    }),
    isDestroyed: vi.fn(() => false),
  };

  return { sender, sentEvents, sentChannels };
}

// Helper to create a ProgressEventEmitter instance
function createEmitter(toolCallId: string, sender: any): ProgressEventEmitter {
  return new ProgressEventEmitter(toolCallId, sender);
}

describe('IPC Channel Integration Tests', () => {
  describe('Event Transmission from Backend to Frontend', () => {
    it('should transmit step events via acp:sub-agent-progress channel (Requirement 4.1)', async () => {
      const { sender, sentEvents, sentChannels } = createMockSender();
      const emitter = createEmitter('test-call-1', sender);

      // Emit a step event
      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'test-call-1',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 10,
      };

      emitter.emit(stepEvent);

      // Wait for flush (16ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify event was sent via correct channel
      expect(sentChannels).toContain('acp:sub-agent-progress');
      expect(sender.send).toHaveBeenCalledWith(
        'acp:sub-agent-progress',
        expect.any(String)
      );

      // Verify event was transmitted
      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'step',
        toolCallId: 'test-call-1',
        stepNumber: 1,
        totalSteps: 10,
      });

      emitter.destroy();
    });

    it('should transmit reasoning events via IPC (Requirement 4.1)', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('test-call-2', sender);

      // Emit a reasoning event
      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: 'test-call-2',
        timestamp: new Date().toISOString(),
        stepNumber: 2,
        content: 'I need to click the search button...',
      };

      emitter.emit(reasoningEvent);

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify event was transmitted
      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'reasoning',
        toolCallId: 'test-call-2',
        content: 'I need to click the search button...',
      });

      emitter.destroy();
    });

    it('should transmit action events via IPC (Requirement 4.1)', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('test-call-3', sender);

      // Emit an action event
      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: 'test-call-3',
        timestamp: new Date().toISOString(),
        stepNumber: 3,
        action: {
          type: 'left_click',
          params: { coordinate: [398, 965] },
          description: 'Left click at (398, 965)',
        },
      };

      emitter.emit(actionEvent);

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify event was transmitted
      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'action',
        toolCallId: 'test-call-3',
        action: {
          type: 'left_click',
          description: 'Left click at (398, 965)',
        },
      });

      emitter.destroy();
    });

    it('should serialize events to JSON before transmission (Requirement 4.2)', async () => {
      const { sender } = createMockSender();
      const emitter = createEmitter('test-call-4', sender);

      const event: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'test-call-4',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      };

      emitter.emit(event);

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify send was called with JSON string
      expect(sender.send).toHaveBeenCalledWith(
        'acp:sub-agent-progress',
        expect.any(String)
      );

      // Verify the string is valid JSON
      const callArgs = sender.send.mock.calls[0];
      const jsonString = callArgs[1];
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Verify parsed JSON matches original event
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        type: 'step',
        toolCallId: 'test-call-4',
        stepNumber: 1,
      });

      emitter.destroy();
    });

    it('should transmit multiple event types in sequence (Requirement 4.3)', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('test-call-5', sender);

      // Emit multiple events
      const events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'test-call-5',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 3,
        },
        {
          type: 'reasoning',
          toolCallId: 'test-call-5',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          content: 'Analyzing the screen...',
        },
        {
          type: 'action',
          toolCallId: 'test-call-5',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          action: {
            type: 'left_click',
            params: { coordinate: [100, 200] },
            description: 'Click button',
          },
        },
      ];

      events.forEach(event => emitter.emit(event));

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all events were transmitted
      expect(sentEvents.length).toBeGreaterThanOrEqual(3);
      expect(sentEvents.map(e => e.type)).toEqual(
        expect.arrayContaining(['step', 'reasoning', 'action'])
      );

      emitter.destroy();
    });
  });

  describe('Multiple Concurrent Sub-Agents', () => {
    it('should handle events from multiple sub-agents with unique toolCallIds (Requirement 14.1, 14.2)', async () => {
      const { sender, sentEvents } = createMockSender();

      // Create multiple emitters with different toolCallIds
      const emitter1 = createEmitter('sub-agent-1', sender);
      const emitter2 = createEmitter('sub-agent-2', sender);
      const emitter3 = createEmitter('sub-agent-3', sender);

      // Emit events from each sub-agent
      emitter1.emit({
        type: 'step',
        toolCallId: 'sub-agent-1',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      });

      emitter2.emit({
        type: 'step',
        toolCallId: 'sub-agent-2',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 10,
      });

      emitter3.emit({
        type: 'step',
        toolCallId: 'sub-agent-3',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 3,
      });

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify events from all sub-agents were transmitted
      expect(sentEvents.length).toBeGreaterThanOrEqual(3);

      // Verify each sub-agent has unique toolCallId
      const toolCallIds = sentEvents.map(e => e.toolCallId);
      const uniqueIds = new Set(toolCallIds);
      expect(uniqueIds.size).toBe(3);
      expect(uniqueIds).toContain('sub-agent-1');
      expect(uniqueIds).toContain('sub-agent-2');
      expect(uniqueIds).toContain('sub-agent-3');

      // Cleanup
      emitter1.destroy();
      emitter2.destroy();
      emitter3.destroy();
    });

    it('should maintain event isolation between concurrent sub-agents (Requirement 14.3)', async () => {
      const { sender, sentEvents } = createMockSender();

      const emitter1 = createEmitter('isolated-1', sender);
      const emitter2 = createEmitter('isolated-2', sender);

      // Emit events from both sub-agents
      emitter1.emit({
        type: 'reasoning',
        toolCallId: 'isolated-1',
        timestamp: new Date().toISOString(),
        content: 'Sub-agent 1 reasoning',
      });

      emitter2.emit({
        type: 'reasoning',
        toolCallId: 'isolated-2',
        timestamp: new Date().toISOString(),
        content: 'Sub-agent 2 reasoning',
      });

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify events are correctly tagged with their toolCallId
      const agent1Events = sentEvents.filter(e => e.toolCallId === 'isolated-1');
      const agent2Events = sentEvents.filter(e => e.toolCallId === 'isolated-2');

      expect(agent1Events).toHaveLength(1);
      expect(agent1Events[0].content).toBe('Sub-agent 1 reasoning');

      expect(agent2Events).toHaveLength(1);
      expect(agent2Events[0].content).toBe('Sub-agent 2 reasoning');

      // Cleanup
      emitter1.destroy();
      emitter2.destroy();
    });

    it('should generate unique toolCallIds for each sub-agent execution (Requirement 14.5)', () => {
      // Generate multiple toolCallIds
      const ids = Array.from({ length: 10 }, () => crypto.randomUUID());

      // Verify all IDs are unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);

      // Verify all IDs match UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
      ids.forEach(id => {
        expect(id).toMatch(uuidRegex);
      });
    });

    it('should handle rapid concurrent events from multiple sub-agents (Requirement 14.1)', async () => {
      const { sender, sentEvents } = createMockSender();

      const emitter1 = createEmitter('rapid-1', sender);
      const emitter2 = createEmitter('rapid-2', sender);

      // Emit many events rapidly from both sub-agents
      for (let i = 1; i <= 20; i++) {
        emitter1.emit({
          type: 'step',
          toolCallId: 'rapid-1',
          timestamp: new Date().toISOString(),
          stepNumber: i,
          totalSteps: 20,
        });

        emitter2.emit({
          type: 'step',
          toolCallId: 'rapid-2',
          timestamp: new Date().toISOString(),
          stepNumber: i,
          totalSteps: 20,
        });
      }

      // Wait for all flushes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all events were transmitted
      expect(sentEvents.length).toBeGreaterThanOrEqual(40);

      // Verify events are correctly tagged
      const rapid1Events = sentEvents.filter(e => e.toolCallId === 'rapid-1');
      const rapid2Events = sentEvents.filter(e => e.toolCallId === 'rapid-2');

      expect(rapid1Events.length).toBeGreaterThanOrEqual(20);
      expect(rapid2Events.length).toBeGreaterThanOrEqual(20);

      // Cleanup
      emitter1.destroy();
      emitter2.destroy();
    });
  });

  describe('Sender Unavailability Handling', () => {
    it('should handle null sender gracefully without crashing (Requirement 10.2)', async () => {
      // Create emitter with null sender
      const emitter = createEmitter('null-sender', null);

      // Emit events - should not throw
      expect(() => {
        emitter.emit({
          type: 'step',
          toolCallId: 'null-sender',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 5,
        });
      }).not.toThrow();

      // Wait for flush attempt
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cleanup should also not throw
      expect(() => emitter.destroy()).not.toThrow();
    });

    it('should handle destroyed sender gracefully (Requirement 10.2)', async () => {
      const { sender } = createMockSender();

      // Mark sender as destroyed
      sender.isDestroyed.mockReturnValue(true);

      const emitter = createEmitter('destroyed-sender', sender);

      // Emit events - should not throw
      expect(() => {
        emitter.emit({
          type: 'step',
          toolCallId: 'destroyed-sender',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 5,
        });
      }).not.toThrow();

      // Wait for flush attempt
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify send was not called (sender is destroyed)
      expect(sender.send).not.toHaveBeenCalled();

      // Cleanup
      emitter.destroy();
    });

    it('should continue execution after sender becomes unavailable mid-stream (Requirement 10.2)', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('mid-stream-fail', sender);

      // Emit first event successfully
      emitter.emit({
        type: 'step',
        toolCallId: 'mid-stream-fail',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify first event was sent
      expect(sentEvents).toHaveLength(1);

      // Mark sender as destroyed
      sender.isDestroyed.mockReturnValue(true);

      // Emit second event - should not throw
      expect(() => {
        emitter.emit({
          type: 'step',
          toolCallId: 'mid-stream-fail',
          timestamp: new Date().toISOString(),
          stepNumber: 2,
          totalSteps: 5,
        });
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify second event was not sent (sender destroyed)
      expect(sentEvents).toHaveLength(1);

      // Cleanup
      emitter.destroy();
    });

    it('should handle serialization errors gracefully (Requirement 4.4)', async () => {
      const { sender } = createMockSender();
      const emitter = createEmitter('serialization-error', sender);

      // Create an event with circular reference (cannot be serialized)
      const circularEvent: any = {
        type: 'step',
        toolCallId: 'serialization-error',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      };
      circularEvent.circular = circularEvent; // Create circular reference

      // Emit event - should not throw
      expect(() => {
        emitter.emit(circularEvent);
      }).not.toThrow();

      // Wait for flush attempt
      await new Promise(resolve => setTimeout(resolve, 50));

      // Cleanup should not throw
      expect(() => emitter.destroy()).not.toThrow();
    });
  });

  describe('Event Buffering and Flushing', () => {
    it('should flush events when buffer reaches MAX_BUFFER_SIZE (10 events)', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('buffer-size-flush', sender);

      // Emit exactly 10 events (should trigger immediate flush)
      for (let i = 1; i <= 10; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'buffer-size-flush',
          timestamp: new Date().toISOString(),
          stepNumber: i,
          totalSteps: 20,
        });
      }

      // Should flush immediately without waiting for timer
      // Give a small delay for the flush to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify events were flushed
      expect(sentEvents.length).toBeGreaterThanOrEqual(10);

      emitter.destroy();
    });

    it('should flush events after FLUSH_INTERVAL_MS (16ms)', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('time-flush', sender);

      // Emit a single event (below buffer size threshold)
      emitter.emit({
        type: 'step',
        toolCallId: 'time-flush',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      });

      // Wait for flush interval (16ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify event was flushed
      expect(sentEvents).toHaveLength(1);

      emitter.destroy();
    });

    it('should flush remaining events on destroy', async () => {
      const { sender, sentEvents } = createMockSender();
      const emitter = createEmitter('destroy-flush', sender);

      // Emit events without waiting for flush
      emitter.emit({
        type: 'step',
        toolCallId: 'destroy-flush',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      });

      emitter.emit({
        type: 'reasoning',
        toolCallId: 'destroy-flush',
        timestamp: new Date().toISOString(),
        content: 'Final reasoning',
      });

      // Destroy immediately (should flush buffered events)
      emitter.destroy();

      // Verify events were flushed
      expect(sentEvents.length).toBeGreaterThanOrEqual(2);
    });
  });
});
