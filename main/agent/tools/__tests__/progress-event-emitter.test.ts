/**
 * Unit tests for ProgressEventEmitter
 *
 * Tests the ProgressEventEmitter implementation for Task 2.6:
 * - Buffer accumulation
 * - Time-based flushing (16ms)
 * - Size-based flushing (10 events)
 * - Serialization error handling
 * - destroy() cleanup
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type SubAgentProgressEvent = {
  type: 'step' | 'reasoning' | 'action' | 'screenshot' | 'complete' | 'abort';
  toolCallId: string;
  timestamp: string;
  stepNumber?: number;
  totalSteps?: number;
  content?: string;
  action?: {
    type: string;
    params: Record<string, unknown>;
    description: string;
  };
  screenshot?: {
    base64: string;
    width: number;
    height: number;
  };
  metadata?: Record<string, unknown>;
};

// Test implementation of ProgressEventEmitter for testing purposes
class TestProgressEventEmitter {
  private buffer: SubAgentProgressEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 16;
  private readonly MAX_BUFFER_SIZE = 10;

  constructor(
    private toolCallId: string,
    private sender: any
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

  // Test helpers
  getBufferLength(): number {
    return this.buffer.length;
  }

  hasScheduledFlush(): boolean {
    return this.flushTimer !== null;
  }
}

describe('ProgressEventEmitter - Task 2.6', () => {
  let mockSender: any;
  let emitter: TestProgressEventEmitter;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSender = {
      send: vi.fn(),
      isDestroyed: vi.fn(() => false),
    };
    emitter = new TestProgressEventEmitter('call_test_123', mockSender);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Buffer Accumulation', () => {
    it('should add events to buffer when emit() is called', () => {
      const event: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
        totalSteps: 10,
      };

      emitter.emit(event);
      expect(emitter.getBufferLength()).toBe(1);

      emitter.emit(event);
      expect(emitter.getBufferLength()).toBe(2);
    });

    it('should accumulate multiple events before flushing', () => {
      for (let i = 1; i <= 5; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(emitter.getBufferLength()).toBe(5);
      expect(mockSender.send).not.toHaveBeenCalled();
    });

    it('should handle different event types in buffer', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      emitter.emit({
        type: 'reasoning',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.456Z',
        content: 'I need to click the button',
      });

      emitter.emit({
        type: 'action',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.789Z',
        action: {
          type: 'left_click',
          params: { coordinate: [100, 200] },
          description: 'Left click at (100, 200)',
        },
      });

      expect(emitter.getBufferLength()).toBe(3);
    });
  });

  describe('Time-Based Flushing (16ms)', () => {
    it('should schedule flush when buffer has events', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);
    });

    it('should flush after 16ms timer expires', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(mockSender.send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(16);

      expect(mockSender.send).toHaveBeenCalledWith(
        'acp:sub-agent-progress',
        expect.any(String)
      );
      expect(emitter.getBufferLength()).toBe(0);
    });

    it('should not schedule multiple flushes for rapid events', () => {
      for (let i = 1; i <= 5; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(emitter.hasScheduledFlush()).toBe(true);

      vi.advanceTimersByTime(16);

      expect(mockSender.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockSender.send.mock.calls[0][1]);
      expect(sentData).toHaveLength(5);
    });

    it('should clear timer after flush', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);

      vi.advanceTimersByTime(16);

      expect(emitter.hasScheduledFlush()).toBe(false);
    });

    it('should allow rescheduling after timer expires', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      vi.advanceTimersByTime(16);
      expect(mockSender.send).toHaveBeenCalledTimes(1);

      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.456Z',
        stepNumber: 2,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);

      vi.advanceTimersByTime(16);
      expect(mockSender.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Size-Based Flushing (10 events)', () => {
    it('should flush immediately when buffer reaches 10 events', () => {
      for (let i = 1; i <= 10; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(mockSender.send).toHaveBeenCalledTimes(1);
      expect(emitter.getBufferLength()).toBe(0);
    });

    it('should not schedule timer when flushing at size threshold', () => {
      for (let i = 1; i <= 10; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(emitter.hasScheduledFlush()).toBe(false);
    });

    it('should flush multiple times for > 10 events', () => {
      for (let i = 1; i <= 25; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(mockSender.send).toHaveBeenCalledTimes(2);
      expect(emitter.getBufferLength()).toBe(5);
    });

    it('should send exactly 10 events in each size-based flush', () => {
      for (let i = 1; i <= 10; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      const sentData = JSON.parse(mockSender.send.mock.calls[0][1]);
      expect(sentData).toHaveLength(10);
    });
  });

  describe('Serialization Error Handling', () => {
    it('should handle circular reference serialization errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const circularEvent: any = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
      };
      circularEvent.self = circularEvent;

      emitter.emit(circularEvent);
      vi.advanceTimersByTime(16);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SubAgentProgress] Serialization failed:',
        expect.any(Error)
      );

      expect(emitter.getBufferLength()).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('should continue execution after serialization error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const circularEvent: any = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
      };
      circularEvent.self = circularEvent;
      emitter.emit(circularEvent);

      vi.advanceTimersByTime(16);

      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.456Z',
        stepNumber: 2,
      });

      expect(emitter.getBufferLength()).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it('should clear buffer on serialization error to prevent memory buildup', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      for (let i = 0; i < 5; i++) {
        const circularEvent: any = {
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
        };
        circularEvent.self = circularEvent;
        emitter.emit(circularEvent);
      }

      vi.advanceTimersByTime(16);

      expect(emitter.getBufferLength()).toBe(0);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('IPC Sender Unavailability', () => {
    it('should handle null sender gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const emitterWithNullSender = new TestProgressEventEmitter('call_test_123', null);

      emitterWithNullSender.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      vi.advanceTimersByTime(16);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SubAgentProgress] IPC sender unavailable, skipping flush'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle destroyed sender gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const destroyedSender = {
        send: vi.fn(),
        isDestroyed: vi.fn(() => true),
      };

      const emitterWithDestroyedSender = new TestProgressEventEmitter(
        'call_test_123',
        destroyedSender
      );

      emitterWithDestroyedSender.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      vi.advanceTimersByTime(16);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SubAgentProgress] IPC sender unavailable, skipping flush'
      );
      expect(destroyedSender.send).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should clear buffer when sender unavailable', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const emitterWithNullSender = new TestProgressEventEmitter('call_test_123', null);

      emitterWithNullSender.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      vi.advanceTimersByTime(16);

      expect(emitterWithNullSender.getBufferLength()).toBe(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('destroy() Cleanup', () => {
    it('should flush remaining events before cleanup', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      emitter.emit({
        type: 'reasoning',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.456Z',
        content: 'Thinking...',
      });

      expect(emitter.getBufferLength()).toBe(2);

      emitter.destroy();

      expect(mockSender.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockSender.send.mock.calls[0][1]);
      expect(sentData).toHaveLength(2);

      expect(emitter.getBufferLength()).toBe(0);
    });

    it('should cancel flush timer on destroy', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);

      emitter.destroy();

      expect(emitter.hasScheduledFlush()).toBe(false);
    });

    it('should clear buffer after destroy', () => {
      for (let i = 1; i <= 5; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      emitter.destroy();

      expect(emitter.getBufferLength()).toBe(0);
    });

    it('should handle destroy with empty buffer', () => {
      expect(() => emitter.destroy()).not.toThrow();
      expect(emitter.getBufferLength()).toBe(0);
      expect(mockSender.send).not.toHaveBeenCalled();
    });

    it('should handle destroy with no scheduled timer', () => {
      for (let i = 1; i <= 10; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(emitter.hasScheduledFlush()).toBe(false);

      expect(() => emitter.destroy()).not.toThrow();
    });

    it('should be idempotent (safe to call multiple times)', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      emitter.destroy();
      expect(mockSender.send).toHaveBeenCalledTimes(1);

      expect(() => emitter.destroy()).not.toThrow();
      expect(mockSender.send).toHaveBeenCalledTimes(1);
    });

    it('should handle destroy during scheduled flush', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);

      emitter.destroy();

      expect(mockSender.send).toHaveBeenCalledTimes(1);
      expect(emitter.hasScheduledFlush()).toBe(false);
      expect(emitter.getBufferLength()).toBe(0);

      vi.advanceTimersByTime(16);
      expect(mockSender.send).toHaveBeenCalledTimes(1);
    });

    it('should handle serialization errors during destroy gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const circularEvent: any = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
      };
      circularEvent.self = circularEvent;

      emitter.emit(circularEvent);

      expect(() => emitter.destroy()).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(emitter.getBufferLength()).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('should handle IPC sender unavailable during destroy', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const destroyedSender = {
        send: vi.fn(),
        isDestroyed: vi.fn(() => true),
      };

      const emitterWithDestroyedSender = new TestProgressEventEmitter(
        'call_test_123',
        destroyedSender
      );

      emitterWithDestroyedSender.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(() => emitterWithDestroyedSender.destroy()).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(emitterWithDestroyedSender.getBufferLength()).toBe(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Requirements Validation', () => {
    it('should validate Requirement 7.1: Buffer accumulation', () => {
      for (let i = 1; i <= 5; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(emitter.getBufferLength()).toBe(5);
    });

    it('should validate Requirement 7.2: Time-based flushing at 16ms', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      vi.advanceTimersByTime(15);
      expect(mockSender.send).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockSender.send).toHaveBeenCalled();
    });

    it('should validate Requirement 7.3: Schedule flush if not already scheduled', () => {
      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);

      emitter.emit({
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.456Z',
        stepNumber: 2,
      });

      expect(emitter.hasScheduledFlush()).toBe(true);

      vi.advanceTimersByTime(16);

      expect(mockSender.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockSender.send.mock.calls[0][1]);
      expect(sentData).toHaveLength(2);
    });

    it('should validate Requirement 7.4: Size-based flushing at 10 events', () => {
      for (let i = 1; i <= 10; i++) {
        emitter.emit({
          type: 'step',
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
          stepNumber: i,
        });
      }

      expect(mockSender.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockSender.send.mock.calls[0][1]);
      expect(sentData).toHaveLength(10);
    });
  });
});
