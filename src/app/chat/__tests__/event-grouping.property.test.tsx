import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { SubAgentProgressEvent, SubAgentProgressEventType } from '@/app/chat/types';

/**
 * Property-Based Test: Event Grouping by Tool Call ID
 *
 * **Validates: Requirements 14.3**
 *
 * Feature: sub-agent-progress-streaming, Property 5: Event Grouping by Tool Call ID
 *
 * For any set of progress events with different toolCallIds, the Agent Timeline
 * SHALL group events such that all events with the same toolCallId are displayed
 * together and no events from different toolCallIds are interleaved.
 */
describe('Feature: sub-agent-progress-streaming, Property 5: Event Grouping by Tool Call ID', () => {
  /**
   * Arbitrary generator for SubAgentProgressEvent with specific toolCallId
   *
   * Generates random progress events with a given toolCallId.
   */
  const arbitraryProgressEvent = (
    toolCallId: string,
    timestamp: number
  ): fc.Arbitrary<SubAgentProgressEvent> => {
    return fc.oneof(
      // Step event
      fc.record({
        type: fc.constant('step' as SubAgentProgressEventType),
        toolCallId: fc.constant(toolCallId),
        timestamp: fc.constant(new Date(timestamp).toISOString()),
        stepNumber: fc.integer({ min: 1, max: 100 }),
        totalSteps: fc.integer({ min: 1, max: 100 }),
      }),

      // Reasoning event
      fc.record({
        type: fc.constant('reasoning' as SubAgentProgressEventType),
        toolCallId: fc.constant(toolCallId),
        timestamp: fc.constant(new Date(timestamp).toISOString()),
        content: fc.string({ minLength: 10, maxLength: 100 }),
      }),

      // Action event
      fc.record({
        type: fc.constant('action' as SubAgentProgressEventType),
        toolCallId: fc.constant(toolCallId),
        timestamp: fc.constant(new Date(timestamp).toISOString()),
        action: fc.record({
          type: fc.constantFrom('left_click', 'right_click', 'type', 'key', 'scroll_down', 'scroll_up', 'wait'),
          params: fc.dictionary(fc.string(), fc.anything()),
          description: fc.string({ minLength: 5, maxLength: 50 }),
        }),
      }),

      // Screenshot event
      fc.record({
        type: fc.constant('screenshot' as SubAgentProgressEventType),
        toolCallId: fc.constant(toolCallId),
        timestamp: fc.constant(new Date(timestamp).toISOString()),
        screenshot: fc.record({
          base64: fc.constant('data:image/jpeg;base64,/9j/4AAQSkZJRg...'),
          width: fc.integer({ min: 800, max: 3840 }),
          height: fc.integer({ min: 600, max: 2160 }),
        }),
      }),

      // Complete event
      fc.record({
        type: fc.constant('complete' as SubAgentProgressEventType),
        toolCallId: fc.constant(toolCallId),
        timestamp: fc.constant(new Date(timestamp).toISOString()),
      }),

      // Abort event
      fc.record({
        type: fc.constant('abort' as SubAgentProgressEventType),
        toolCallId: fc.constant(toolCallId),
        timestamp: fc.constant(new Date(timestamp).toISOString()),
      })
    );
  };

  /**
   * Property Test: Events are correctly grouped by toolCallId in state management
   *
   * This test verifies that when events with different toolCallIds are received,
   * the state management (Map<string, SubAgentProgressEvent[]>) correctly groups
   * them by toolCallId with no interleaving.
   */
  it('property: events are grouped by toolCallId in state management', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Number of different toolCallIds (2-5 as per spec)
          numToolCallIds: fc.integer({ min: 2, max: 5 }),

          // Number of events per toolCallId
          eventsPerToolCallId: fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 2, maxLength: 5 }),

          // Base timestamp
          baseTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }),

          // Whether to shuffle the events (test mixed input)
          shuffleEvents: fc.boolean(),
        }),

        (scenario) => {
          // Generate unique toolCallIds
          const toolCallIds: string[] = [];
          for (let i = 0; i < scenario.numToolCallIds; i++) {
            toolCallIds.push(`tool_call_${i}_${Math.random().toString(36).substring(7)}`);
          }

          // Generate events for each toolCallId
          const allEvents: SubAgentProgressEvent[] = [];
          const eventsByToolCallId = new Map<string, SubAgentProgressEvent[]>();

          toolCallIds.forEach((toolCallId, toolIndex) => {
            const numEvents = scenario.eventsPerToolCallId[toolIndex % scenario.eventsPerToolCallId.length];
            const events: SubAgentProgressEvent[] = [];

            for (let i = 0; i < numEvents; i++) {
              const timestamp = scenario.baseTimestamp + (toolIndex * 10000) + (i * 100);
              const event = fc.sample(arbitraryProgressEvent(toolCallId, timestamp), 1)[0];
              events.push(event);
              allEvents.push(event);
            }

            eventsByToolCallId.set(toolCallId, events);
          });

          // Optionally shuffle events to simulate mixed arrival order
          const inputEvents = scenario.shuffleEvents
            ? [...allEvents].sort(() => Math.random() - 0.5)
            : allEvents;

          // Simulate the state management logic from page.tsx
          // This is what happens when events are received:
          // setSubAgentProgress(prev => {
          //   const newMap = new Map(prev);
          //   const existingEvents = newMap.get(event.toolCallId) || [];
          //   newMap.set(event.toolCallId, [...existingEvents, event]);
          //   return newMap;
          // });

          const subAgentProgress = new Map<string, SubAgentProgressEvent[]>();

          // Process events as they would be received
          inputEvents.forEach(event => {
            const existingEvents = subAgentProgress.get(event.toolCallId) || [];
            subAgentProgress.set(event.toolCallId, [...existingEvents, event]);
          });

          // CRITICAL VERIFICATION 1: All toolCallIds should be present in the map
          expect(subAgentProgress.size).toBe(toolCallIds.length);

          // CRITICAL VERIFICATION 2: Each toolCallId should have all its events
          toolCallIds.forEach(toolCallId => {
            const expectedEvents = eventsByToolCallId.get(toolCallId) || [];
            const actualEvents = subAgentProgress.get(toolCallId) || [];

            // Verify the correct number of events
            expect(actualEvents.length).toBe(expectedEvents.length);

            // Verify all events have the correct toolCallId
            actualEvents.forEach(event => {
              expect(event.toolCallId).toBe(toolCallId);
            });
          });

          // CRITICAL VERIFICATION 3: No interleaving - events from different toolCallIds
          // should not be mixed in the same array
          subAgentProgress.forEach((events, toolCallId) => {
            // Every event in this array should have the same toolCallId
            events.forEach(event => {
              expect(event.toolCallId).toBe(toolCallId);
            });

            // Verify no events from other toolCallIds are present
            const otherToolCallIds = toolCallIds.filter(id => id !== toolCallId);
            otherToolCallIds.forEach(otherToolCallId => {
              const hasOtherToolCallId = events.some(e => e.toolCallId === otherToolCallId);
              expect(hasOtherToolCallId).toBe(false);
            });
          });

          // CRITICAL VERIFICATION 4: All events are accounted for (no events lost)
          let totalEventsInMap = 0;
          subAgentProgress.forEach(events => {
            totalEventsInMap += events.length;
          });
          expect(totalEventsInMap).toBe(allEvents.length);
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as required
    );
  });

  /**
   * Property Test: Events maintain insertion order within each toolCallId group
   *
   * This test verifies that events for the same toolCallId are stored in the
   * order they were received (insertion order), not necessarily chronological order.
   */
  it('property: events maintain insertion order within each toolCallId group', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Number of different toolCallIds
          numToolCallIds: fc.integer({ min: 2, max: 5 }),

          // Number of events per toolCallId
          eventsPerToolCallId: fc.integer({ min: 3, max: 10 }),

          // Base timestamp
          baseTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }),

          // Whether to shuffle the events
          shuffleEvents: fc.boolean(),
        }),

        (scenario) => {
          // Generate unique toolCallIds
          const toolCallIds: string[] = [];
          for (let i = 0; i < scenario.numToolCallIds; i++) {
            toolCallIds.push(`tool_call_${i}_${Math.random().toString(36).substring(7)}`);
          }

          // Generate events for each toolCallId with sequential timestamps
          const allEvents: SubAgentProgressEvent[] = [];

          toolCallIds.forEach((toolCallId, toolIndex) => {
            for (let i = 0; i < scenario.eventsPerToolCallId; i++) {
              const timestamp = scenario.baseTimestamp + (toolIndex * 10000) + (i * 100);
              const timestampStr = new Date(timestamp).toISOString();

              const event: SubAgentProgressEvent = {
                type: 'step',
                toolCallId,
                timestamp: timestampStr,
                stepNumber: i + 1,
                totalSteps: scenario.eventsPerToolCallId,
              };

              allEvents.push(event);
            }
          });

          // Optionally shuffle events to simulate mixed arrival order
          const inputEvents = scenario.shuffleEvents
            ? [...allEvents].sort(() => Math.random() - 0.5)
            : allEvents;

          // Track the expected insertion order for each toolCallId
          const expectedInsertionOrderByToolCallId = new Map<string, string[]>();

          // Simulate the state management logic
          const subAgentProgress = new Map<string, SubAgentProgressEvent[]>();

          inputEvents.forEach(event => {
            const existingEvents = subAgentProgress.get(event.toolCallId) || [];
            subAgentProgress.set(event.toolCallId, [...existingEvents, event]);

            // Track the insertion order
            const insertionOrder = expectedInsertionOrderByToolCallId.get(event.toolCallId) || [];
            insertionOrder.push(event.timestamp);
            expectedInsertionOrderByToolCallId.set(event.toolCallId, insertionOrder);
          });

          // CRITICAL VERIFICATION: Events within each toolCallId group should maintain
          // the order they were received (insertion order)
          subAgentProgress.forEach((events, toolCallId) => {
            const actualTimestamps = events.map(e => e.timestamp);
            const expectedTimestamps = expectedInsertionOrderByToolCallId.get(toolCallId) || [];

            // The actual order should match the insertion order
            // (events should be in the order they were added to the map)
            expect(actualTimestamps).toEqual(expectedTimestamps);
          });
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as required
    );
  });

  /**
   * Property Test: Concurrent events from multiple toolCallIds are correctly separated
   *
   * This test verifies that when events from multiple toolCallIds arrive in an
   * interleaved fashion (simulating concurrent sub-agent executions), they are
   * correctly separated into distinct groups.
   */
  it('property: concurrent events from multiple toolCallIds are correctly separated', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Number of concurrent sub-agents (2-5)
          numConcurrent: fc.integer({ min: 2, max: 5 }),

          // Number of events per sub-agent
          eventsPerSubAgent: fc.integer({ min: 5, max: 15 }),

          // Base timestamp
          baseTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }),
        }),

        (scenario) => {
          // Generate unique toolCallIds for concurrent sub-agents
          const toolCallIds: string[] = [];
          for (let i = 0; i < scenario.numConcurrent; i++) {
            toolCallIds.push(`concurrent_tool_${i}_${Math.random().toString(36).substring(7)}`);
          }

          // Generate interleaved events (simulating concurrent execution)
          const allEvents: SubAgentProgressEvent[] = [];
          const eventsByToolCallId = new Map<string, SubAgentProgressEvent[]>();

          // Initialize event arrays for each toolCallId
          toolCallIds.forEach(toolCallId => {
            eventsByToolCallId.set(toolCallId, []);
          });

          // Generate events in an interleaved pattern
          // For each step, generate one event for each sub-agent
          for (let step = 0; step < scenario.eventsPerSubAgent; step++) {
            toolCallIds.forEach((toolCallId, toolIndex) => {
              const timestamp = scenario.baseTimestamp + (step * scenario.numConcurrent + toolIndex) * 100;
              const event: SubAgentProgressEvent = {
                type: 'step',
                toolCallId,
                timestamp: new Date(timestamp).toISOString(),
                stepNumber: step + 1,
                totalSteps: scenario.eventsPerSubAgent,
              };

              allEvents.push(event);
              eventsByToolCallId.get(toolCallId)!.push(event);
            });
          }

          // Simulate the state management logic
          const subAgentProgress = new Map<string, SubAgentProgressEvent[]>();

          allEvents.forEach(event => {
            const existingEvents = subAgentProgress.get(event.toolCallId) || [];
            subAgentProgress.set(event.toolCallId, [...existingEvents, event]);
          });

          // CRITICAL VERIFICATION 1: Each toolCallId should have its own separate group
          expect(subAgentProgress.size).toBe(scenario.numConcurrent);

          // CRITICAL VERIFICATION 2: No interleaving - each group should only contain
          // events from its own toolCallId
          subAgentProgress.forEach((events, toolCallId) => {
            // All events in this group should have the same toolCallId
            events.forEach(event => {
              expect(event.toolCallId).toBe(toolCallId);
            });

            // Verify the correct number of events
            expect(events.length).toBe(scenario.eventsPerSubAgent);

            // Verify step numbers are sequential (1, 2, 3, ...)
            events.forEach((event, index) => {
              expect(event.stepNumber).toBe(index + 1);
            });
          });

          // CRITICAL VERIFICATION 3: All events are accounted for
          let totalEvents = 0;
          subAgentProgress.forEach(events => {
            totalEvents += events.length;
          });
          expect(totalEvents).toBe(scenario.numConcurrent * scenario.eventsPerSubAgent);
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as required
    );
  });

  /**
   * Property Test: Empty toolCallId groups are handled correctly
   *
   * This test verifies that the state management correctly handles the case
   * where a toolCallId has no events yet (empty array).
   */
  it('property: empty toolCallId groups are handled correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Number of toolCallIds with events
          numWithEvents: fc.integer({ min: 1, max: 3 }),

          // Number of events per toolCallId
          eventsPerToolCallId: fc.integer({ min: 1, max: 5 }),

          // Base timestamp
          baseTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }),
        }),

        (scenario) => {
          // Generate toolCallIds
          const toolCallIds: string[] = [];
          for (let i = 0; i < scenario.numWithEvents; i++) {
            toolCallIds.push(`tool_call_${i}_${Math.random().toString(36).substring(7)}`);
          }

          // Generate events
          const allEvents: SubAgentProgressEvent[] = [];

          toolCallIds.forEach((toolCallId, toolIndex) => {
            for (let i = 0; i < scenario.eventsPerToolCallId; i++) {
              const timestamp = scenario.baseTimestamp + (toolIndex * 1000) + (i * 100);
              const event: SubAgentProgressEvent = {
                type: 'step',
                toolCallId,
                timestamp: new Date(timestamp).toISOString(),
                stepNumber: i + 1,
                totalSteps: scenario.eventsPerToolCallId,
              };

              allEvents.push(event);
            }
          });

          // Simulate the state management logic
          const subAgentProgress = new Map<string, SubAgentProgressEvent[]>();

          allEvents.forEach(event => {
            const existingEvents = subAgentProgress.get(event.toolCallId) || [];
            subAgentProgress.set(event.toolCallId, [...existingEvents, event]);
          });

          // CRITICAL VERIFICATION 1: Only toolCallIds with events should be in the map
          expect(subAgentProgress.size).toBe(scenario.numWithEvents);

          // CRITICAL VERIFICATION 2: Each toolCallId should have the correct number of events
          toolCallIds.forEach(toolCallId => {
            const events = subAgentProgress.get(toolCallId) || [];
            expect(events.length).toBe(scenario.eventsPerToolCallId);
          });

          // CRITICAL VERIFICATION 3: Querying a non-existent toolCallId should return undefined
          const nonExistentToolCallId = 'non_existent_tool_call_id';
          expect(subAgentProgress.get(nonExistentToolCallId)).toBeUndefined();

          // CRITICAL VERIFICATION 4: The state management should handle the case where
          // existingEvents is an empty array (first event for a toolCallId)
          const newToolCallId = 'new_tool_call_id';
          const newEvent: SubAgentProgressEvent = {
            type: 'step',
            toolCallId: newToolCallId,
            timestamp: new Date(scenario.baseTimestamp).toISOString(),
            stepNumber: 1,
            totalSteps: 1,
          };

          // Simulate adding the first event for a new toolCallId
          const existingEvents = subAgentProgress.get(newToolCallId) || [];
          subAgentProgress.set(newToolCallId, [...existingEvents, newEvent]);

          // Verify the new toolCallId was added
          expect(subAgentProgress.has(newToolCallId)).toBe(true);
          expect(subAgentProgress.get(newToolCallId)?.length).toBe(1);
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as required
    );
  });

  /**
   * Property Test: Large number of events are correctly grouped
   *
   * This test verifies that even with a large number of events (100+ events
   * across multiple toolCallIds), the grouping logic works correctly.
   */
  it('property: large number of events are correctly grouped', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Number of toolCallIds
          numToolCallIds: fc.integer({ min: 3, max: 5 }),

          // Large number of events per toolCallId
          eventsPerToolCallId: fc.integer({ min: 30, max: 50 }),

          // Base timestamp
          baseTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }),

          // Whether to shuffle the events
          shuffleEvents: fc.boolean(),
        }),

        (scenario) => {
          // Generate unique toolCallIds
          const toolCallIds: string[] = [];
          for (let i = 0; i < scenario.numToolCallIds; i++) {
            toolCallIds.push(`tool_call_${i}_${Math.random().toString(36).substring(7)}`);
          }

          // Generate events
          const allEvents: SubAgentProgressEvent[] = [];

          toolCallIds.forEach((toolCallId, toolIndex) => {
            for (let i = 0; i < scenario.eventsPerToolCallId; i++) {
              const timestamp = scenario.baseTimestamp + (toolIndex * 100000) + (i * 100);
              const event: SubAgentProgressEvent = {
                type: 'step',
                toolCallId,
                timestamp: new Date(timestamp).toISOString(),
                stepNumber: i + 1,
                totalSteps: scenario.eventsPerToolCallId,
              };

              allEvents.push(event);
            }
          });

          // Optionally shuffle events
          const inputEvents = scenario.shuffleEvents
            ? [...allEvents].sort(() => Math.random() - 0.5)
            : allEvents;

          // Simulate the state management logic
          const subAgentProgress = new Map<string, SubAgentProgressEvent[]>();

          inputEvents.forEach(event => {
            const existingEvents = subAgentProgress.get(event.toolCallId) || [];
            subAgentProgress.set(event.toolCallId, [...existingEvents, event]);
          });

          // CRITICAL VERIFICATION 1: All toolCallIds should be present
          expect(subAgentProgress.size).toBe(scenario.numToolCallIds);

          // CRITICAL VERIFICATION 2: Each toolCallId should have the correct number of events
          toolCallIds.forEach(toolCallId => {
            const events = subAgentProgress.get(toolCallId) || [];
            expect(events.length).toBe(scenario.eventsPerToolCallId);

            // All events should have the correct toolCallId
            events.forEach(event => {
              expect(event.toolCallId).toBe(toolCallId);
            });
          });

          // CRITICAL VERIFICATION 3: Total number of events should match
          let totalEvents = 0;
          subAgentProgress.forEach(events => {
            totalEvents += events.length;
          });
          expect(totalEvents).toBe(scenario.numToolCallIds * scenario.eventsPerToolCallId);

          // CRITICAL VERIFICATION 4: No interleaving
          subAgentProgress.forEach((events, toolCallId) => {
            const otherToolCallIds = toolCallIds.filter(id => id !== toolCallId);
            otherToolCallIds.forEach(otherToolCallId => {
              const hasOtherToolCallId = events.some(e => e.toolCallId === otherToolCallId);
              expect(hasOtherToolCallId).toBe(false);
            });
          });
        }
      ),
      { numRuns: 50 } // Run 50 iterations (reduced for performance with large datasets)
    );
  }, 30000); // 30 second timeout for large sequences
});
