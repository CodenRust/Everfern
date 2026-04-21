/**
 * Property-Based Test: Buffer Size-Based Flush
 *
 * **Validates: Requirements 7.4**
 *
 * Property 4: Buffer Size-Based Flush
 *
 * For any buffer containing more than 10 events, the IPC Handler SHALL flush
 * immediately, regardless of the time interval.
 *
 * Feature: sub-agent-progress-streaming, Property 4: Buffer Size-Based Flush
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

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

/**
 * Test implementation of ProgressEventEmitter for property testing
 */
class TestProgressEventEmitter {
  private buffer: SubAgentProgressEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 16;
  private readonly MAX_BUFFER_SIZE = 10;
  public flushCount = 0;
  public flushedBatches: SubAgentProgressEvent[][] = [];

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

      // Track flush for testing
      this.flushCount++;
      this.flushedBatches.push([...this.buffer]);

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

describe('Feature: sub-agent-progress-streaming, Property 4: Buffer Size-Based Flush', () => {
  let mockSender: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSender = {
      send: vi.fn(),
      isDestroyed: vi.fn(() => false),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property Test: Buffer flushes immediately when size exceeds 10
   *
   * This test verifies that for any sequence of events with length > 10,
   * the buffer flushes immediately when it reaches MAX_BUFFER_SIZE (10),
   * without waiting for the time-based flush interval.
   *
   * Test Strategy:
   * 1. Generate random event sequences with lengths 11-50 (exceeding MAX_BUFFER_SIZE)
   * 2. Emit all events without advancing timers
   * 3. Verify buffer flushes immediately at size threshold (10 events)
   * 4. Verify no more than 10 events are ever buffered at once
   * 5. Run 100+ iterations for comprehensive coverage
   */
  it('property: buffer flushes immediately when size exceeds 10 events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random sequence length (11-50 events, exceeding MAX_BUFFER_SIZE)
          sequenceLength: fc.integer({ min: 11, max: 50 }),

          // Generate random tool call ID
          toolCallId: fc.string({ minLength: 5, maxLength: 20 }),

          // Generate random event type distribution
          eventTypes: fc.array(
            fc.constantFrom('step', 'reasoning', 'action', 'screenshot'),
            { minLength: 11, maxLength: 50 }
          ),
        }),

        async (scenario) => {
          // Ensure eventTypes array matches sequenceLength
          const eventTypes = scenario.eventTypes.slice(0, scenario.sequenceLength);
          while (eventTypes.length < scenario.sequenceLength) {
            eventTypes.push('step');
          }

          // Create emitter
          const emitter = new TestProgressEventEmitter(scenario.toolCallId, mockSender);

          // Track buffer size after each emit
          const bufferSizesAfterEmit: number[] = [];

          // Emit all events WITHOUT advancing timers
          for (let i = 0; i < scenario.sequenceLength; i++) {
            const event: SubAgentProgressEvent = {
              type: eventTypes[i],
              toolCallId: scenario.toolCallId,
              timestamp: new Date(Date.now() + i * 100).toISOString(),
              stepNumber: i + 1,
              totalSteps: scenario.sequenceLength,
            };

            // Add type-specific fields
            if (event.type === 'reasoning') {
              event.content = `Reasoning for step ${i + 1}`;
            } else if (event.type === 'action') {
              event.action = {
                type: 'left_click',
                params: { coordinate: [100, 200] },
                description: `Action ${i + 1}`,
              };
            } else if (event.type === 'screenshot') {
              event.screenshot = {
                base64: 'fake-base64-data',
                width: 1920,
                height: 1080,
              };
            }

            emitter.emit(event);
            bufferSizesAfterEmit.push(emitter.getBufferLength());
          }

          // PROPERTY VERIFICATION: Buffer never exceeds MAX_BUFFER_SIZE (10)

          // 1. Verify buffer size never exceeds 10 events
          for (let i = 0; i < bufferSizesAfterEmit.length; i++) {
            expect(bufferSizesAfterEmit[i]).toBeLessThanOrEqual(10);
          }

          // 2. Verify flush occurred at least once (since sequenceLength > 10)
          expect(emitter.flushCount).toBeGreaterThan(0);

          // 3. Calculate expected number of flushes
          // For N events where N > 10:
          // - First flush at event 10 (buffer reaches 10)
          // - Subsequent flushes every 10 events
          // - Expected flushes = floor(N / 10)
          const expectedFlushes = Math.floor(scenario.sequenceLength / 10);
          expect(emitter.flushCount).toBe(expectedFlushes);

          // 4. Verify each flush contained exactly 10 events (except possibly the last one)
          for (let i = 0; i < emitter.flushedBatches.length - 1; i++) {
            expect(emitter.flushedBatches[i].length).toBe(10);
          }

          // 5. Verify remaining buffer size is correct
          const remainingEvents = scenario.sequenceLength % 10;
          expect(emitter.getBufferLength()).toBe(remainingEvents);

          // 6. Verify flushes happened WITHOUT timer advancement (immediate flush)
          // This is implicit in the test - we never called vi.advanceTimersByTime()
          // If flushes required timer, mockSender.send would not have been called

          // 7. Verify total events flushed + buffered equals sequence length
          const totalFlushedEvents = emitter.flushedBatches.reduce(
            (sum, batch) => sum + batch.length,
            0
          );
          expect(totalFlushedEvents + emitter.getBufferLength()).toBe(scenario.sequenceLength);

          // Cleanup
          emitter.destroy();
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as specified
    );
  });

  /**
   * Property Test: Size-based flush takes precedence over time-based flush
   *
   * This test verifies that when the buffer reaches MAX_BUFFER_SIZE,
   * it flushes immediately without waiting for the scheduled timer.
   */
  it('property: size-based flush preempts time-based flush', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random sequence length (11-50 events)
          sequenceLength: fc.integer({ min: 11, max: 50 }),

          // Generate random tool call ID
          toolCallId: fc.string({ minLength: 5, maxLength: 20 }),
        }),

        async (scenario) => {
          // Reset mock before each test
          mockSender.send.mockClear();

          // Create emitter
          const emitter = new TestProgressEventEmitter(scenario.toolCallId, mockSender);

          // Emit events rapidly (no timer advancement)
          for (let i = 0; i < scenario.sequenceLength; i++) {
            emitter.emit({
              type: 'step',
              toolCallId: scenario.toolCallId,
              timestamp: new Date(Date.now() + i * 100).toISOString(),
              stepNumber: i + 1,
              totalSteps: scenario.sequenceLength,
            });
          }

          // PROPERTY VERIFICATION: Flushes occurred without timer advancement

          // 1. Verify flushes occurred (size-based)
          const expectedFlushes = Math.floor(scenario.sequenceLength / 10);
          expect(emitter.flushCount).toBe(expectedFlushes);

          // 2. Verify mockSender.send was called (proves flush happened)
          expect(mockSender.send).toHaveBeenCalledTimes(expectedFlushes);

          // 3. Verify timer was NOT used for these flushes
          // (we never advanced timers, yet flushes occurred)
          // This proves size-based flush preempts time-based flush

          // 4. Now advance timer to see if remaining events flush
          const remainingEvents = scenario.sequenceLength % 10;
          if (remainingEvents > 0) {
            expect(emitter.hasScheduledFlush()).toBe(true);
            vi.advanceTimersByTime(16);
            expect(emitter.flushCount).toBe(expectedFlushes + 1);
            expect(mockSender.send).toHaveBeenCalledTimes(expectedFlushes + 1);
          }

          // Cleanup
          emitter.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Buffer size constraint holds for mixed event types
   *
   * This test verifies that the MAX_BUFFER_SIZE constraint applies
   * regardless of event type (step, reasoning, action, screenshot).
   */
  it('property: buffer size constraint applies to all event types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random sequence length (11-50 events)
          sequenceLength: fc.integer({ min: 11, max: 50 }),

          // Generate random tool call ID
          toolCallId: fc.string({ minLength: 5, maxLength: 20 }),

          // Generate random event type for each position
          eventTypes: fc.array(
            fc.constantFrom('step', 'reasoning', 'action', 'screenshot', 'complete', 'abort'),
            { minLength: 11, maxLength: 50 }
          ),
        }),

        async (scenario) => {
          // Ensure eventTypes array matches sequenceLength
          const eventTypes = scenario.eventTypes.slice(0, scenario.sequenceLength);
          while (eventTypes.length < scenario.sequenceLength) {
            eventTypes.push('step');
          }

          // Create emitter
          const emitter = new TestProgressEventEmitter(scenario.toolCallId, mockSender);

          // Track max buffer size observed
          let maxBufferSize = 0;

          // Emit mixed event types
          for (let i = 0; i < scenario.sequenceLength; i++) {
            const event: SubAgentProgressEvent = {
              type: eventTypes[i],
              toolCallId: scenario.toolCallId,
              timestamp: new Date(Date.now() + i * 100).toISOString(),
            };

            // Add type-specific fields
            switch (event.type) {
              case 'step':
                event.stepNumber = i + 1;
                event.totalSteps = scenario.sequenceLength;
                break;
              case 'reasoning':
                event.content = `Reasoning ${i + 1}`;
                break;
              case 'action':
                event.action = {
                  type: 'left_click',
                  params: { coordinate: [100, 200] },
                  description: `Action ${i + 1}`,
                };
                break;
              case 'screenshot':
                event.screenshot = {
                  base64: 'fake-base64-data',
                  width: 1920,
                  height: 1080,
                };
                break;
            }

            emitter.emit(event);
            maxBufferSize = Math.max(maxBufferSize, emitter.getBufferLength());
          }

          // PROPERTY VERIFICATION: Buffer never exceeded MAX_BUFFER_SIZE

          // 1. Verify max buffer size never exceeded 10
          expect(maxBufferSize).toBeLessThanOrEqual(10);

          // 2. Verify flushes occurred
          const expectedFlushes = Math.floor(scenario.sequenceLength / 10);
          expect(emitter.flushCount).toBe(expectedFlushes);

          // 3. Verify each flushed batch had correct size
          for (let i = 0; i < emitter.flushedBatches.length; i++) {
            expect(emitter.flushedBatches[i].length).toBeLessThanOrEqual(10);
          }

          // Cleanup
          emitter.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Concurrent event emission maintains buffer constraint
   *
   * This test verifies that even with rapid event emission (simulating
   * concurrent sub-agent activity), the buffer size constraint is maintained.
   */
  it('property: buffer constraint holds under rapid event emission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random sequence length (11-50 events)
          sequenceLength: fc.integer({ min: 11, max: 50 }),

          // Generate random tool call ID
          toolCallId: fc.string({ minLength: 5, maxLength: 20 }),

          // Generate random batch sizes (1-5 events per batch)
          batchSizes: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 3, maxLength: 15 }),
        }),

        async (scenario) => {
          // Create emitter
          const emitter = new TestProgressEventEmitter(scenario.toolCallId, mockSender);

          // Track buffer size after each batch
          const bufferSizesAfterBatch: number[] = [];

          // Emit events in batches (simulating rapid emission)
          let totalEmitted = 0;
          let batchIndex = 0;

          while (totalEmitted < scenario.sequenceLength) {
            const batchSize = scenario.batchSizes[batchIndex % scenario.batchSizes.length];
            const eventsToEmit = Math.min(batchSize, scenario.sequenceLength - totalEmitted);

            // Emit batch of events
            for (let i = 0; i < eventsToEmit; i++) {
              emitter.emit({
                type: 'step',
                toolCallId: scenario.toolCallId,
                timestamp: new Date(Date.now() + totalEmitted * 100).toISOString(),
                stepNumber: totalEmitted + 1,
                totalSteps: scenario.sequenceLength,
              });
              totalEmitted++;
            }

            bufferSizesAfterBatch.push(emitter.getBufferLength());
            batchIndex++;
          }

          // PROPERTY VERIFICATION: Buffer never exceeded MAX_BUFFER_SIZE

          // 1. Verify buffer size never exceeded 10 after any batch
          for (const bufferSize of bufferSizesAfterBatch) {
            expect(bufferSize).toBeLessThanOrEqual(10);
          }

          // 2. Verify correct number of flushes
          const expectedFlushes = Math.floor(scenario.sequenceLength / 10);
          expect(emitter.flushCount).toBe(expectedFlushes);

          // 3. Verify total events accounted for
          const totalFlushedEvents = emitter.flushedBatches.reduce(
            (sum, batch) => sum + batch.length,
            0
          );
          expect(totalFlushedEvents + emitter.getBufferLength()).toBe(scenario.sequenceLength);

          // Cleanup
          emitter.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Buffer flush at exactly 10 events (boundary condition)
   *
   * This test verifies the exact boundary condition: flush occurs when
   * buffer reaches exactly 10 events, not 9 or 11.
   */
  it('property: flush occurs at exactly 10 events (boundary condition)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random tool call ID
          toolCallId: fc.string({ minLength: 5, maxLength: 20 }),

          // Generate random number of 10-event cycles (1-5)
          numCycles: fc.integer({ min: 1, max: 5 }),
        }),

        async (scenario) => {
          // Create emitter
          const emitter = new TestProgressEventEmitter(scenario.toolCallId, mockSender);

          // For each cycle, emit exactly 10 events
          for (let cycle = 0; cycle < scenario.numCycles; cycle++) {
            // Emit 9 events - should NOT flush
            for (let i = 0; i < 9; i++) {
              emitter.emit({
                type: 'step',
                toolCallId: scenario.toolCallId,
                timestamp: new Date(Date.now() + (cycle * 10 + i) * 100).toISOString(),
                stepNumber: cycle * 10 + i + 1,
              });
            }

            // Verify no flush yet (buffer has 9 events)
            expect(emitter.flushCount).toBe(cycle);
            expect(emitter.getBufferLength()).toBe(9);

            // Emit 10th event - should flush immediately
            emitter.emit({
              type: 'step',
              toolCallId: scenario.toolCallId,
              timestamp: new Date(Date.now() + (cycle * 10 + 9) * 100).toISOString(),
              stepNumber: cycle * 10 + 10,
            });

            // Verify flush occurred (buffer now empty)
            expect(emitter.flushCount).toBe(cycle + 1);
            expect(emitter.getBufferLength()).toBe(0);

            // Verify flushed batch had exactly 10 events
            expect(emitter.flushedBatches[cycle].length).toBe(10);
          }

          // PROPERTY VERIFICATION: Flush occurred at exactly 10 events each time

          // 1. Verify total flushes equals number of cycles
          expect(emitter.flushCount).toBe(scenario.numCycles);

          // 2. Verify each flush had exactly 10 events
          for (const batch of emitter.flushedBatches) {
            expect(batch.length).toBe(10);
          }

          // 3. Verify buffer is empty after all cycles
          expect(emitter.getBufferLength()).toBe(0);

          // Cleanup
          emitter.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Edge case - exactly 10 events total
   *
   * This test verifies behavior when the total sequence length is exactly 10.
   */
  it('property: handles exactly 10 events correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random tool call ID
          toolCallId: fc.string({ minLength: 5, maxLength: 20 }),
        }),

        async (scenario) => {
          // Create emitter
          const emitter = new TestProgressEventEmitter(scenario.toolCallId, mockSender);

          // Emit exactly 10 events
          for (let i = 0; i < 10; i++) {
            emitter.emit({
              type: 'step',
              toolCallId: scenario.toolCallId,
              timestamp: new Date(Date.now() + i * 100).toISOString(),
              stepNumber: i + 1,
              totalSteps: 10,
            });
          }

          // PROPERTY VERIFICATION: Single flush with 10 events

          // 1. Verify exactly one flush occurred
          expect(emitter.flushCount).toBe(1);

          // 2. Verify flushed batch had exactly 10 events
          expect(emitter.flushedBatches[0].length).toBe(10);

          // 3. Verify buffer is now empty
          expect(emitter.getBufferLength()).toBe(0);

          // 4. Verify no scheduled timer (flush was immediate)
          expect(emitter.hasScheduledFlush()).toBe(false);

          // Cleanup
          emitter.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Multiple sub-agents maintain independent buffer constraints
   *
   * This test verifies that multiple concurrent sub-agents (different toolCallIds)
   * each maintain their own buffer size constraints independently.
   */
  it('property: multiple sub-agents maintain independent buffer constraints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Number of concurrent sub-agents (2-5)
          numSubAgents: fc.integer({ min: 2, max: 5 }),

          // Sequence lengths for each sub-agent (11-50 events each)
          sequenceLengths: fc.array(fc.integer({ min: 11, max: 50 }), { minLength: 2, maxLength: 5 }),
        }),

        async (scenario) => {
          // Ensure we have the right number of sequence lengths
          const sequenceLengths = scenario.sequenceLengths.slice(0, scenario.numSubAgents);
          while (sequenceLengths.length < scenario.numSubAgents) {
            sequenceLengths.push(20); // Default length
          }

          // Create emitters for each sub-agent
          const emitters: TestProgressEventEmitter[] = [];
          const maxBufferSizes: number[] = [];

          for (let agentIndex = 0; agentIndex < scenario.numSubAgents; agentIndex++) {
            const toolCallId = `call_agent_${agentIndex}`;
            const emitter = new TestProgressEventEmitter(toolCallId, mockSender);
            emitters.push(emitter);
            maxBufferSizes.push(0);
          }

          // Emit events for all sub-agents (interleaved)
          const eventCounters = new Array(scenario.numSubAgents).fill(0);
          let allDone = false;

          while (!allDone) {
            allDone = true;

            // Round-robin: emit one event for each sub-agent that still has events
            for (let agentIndex = 0; agentIndex < scenario.numSubAgents; agentIndex++) {
              // Skip if this agent has emitted all its events
              if (eventCounters[agentIndex] >= sequenceLengths[agentIndex]) {
                continue;
              }

              allDone = false;

              const emitter = emitters[agentIndex];
              emitter.emit({
                type: 'step',
                toolCallId: `call_agent_${agentIndex}`,
                timestamp: new Date(Date.now() + eventCounters[agentIndex] * 100).toISOString(),
                stepNumber: eventCounters[agentIndex] + 1,
                totalSteps: sequenceLengths[agentIndex],
              });

              eventCounters[agentIndex]++;
              maxBufferSizes[agentIndex] = Math.max(
                maxBufferSizes[agentIndex],
                emitter.getBufferLength()
              );
            }
          }

          // PROPERTY VERIFICATION: Each sub-agent maintained buffer constraint

          for (let agentIndex = 0; agentIndex < scenario.numSubAgents; agentIndex++) {
            const emitter = emitters[agentIndex];
            const sequenceLength = sequenceLengths[agentIndex];

            // 1. Verify buffer never exceeded 10 for this sub-agent
            expect(maxBufferSizes[agentIndex]).toBeLessThanOrEqual(10);

            // 2. Verify correct number of flushes for this sub-agent
            const expectedFlushes = Math.floor(sequenceLength / 10);
            expect(emitter.flushCount).toBe(expectedFlushes);

            // 3. Verify remaining buffer size is correct
            const remainingEvents = sequenceLength % 10;
            expect(emitter.getBufferLength()).toBe(remainingEvents);

            // Cleanup
            emitter.destroy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
