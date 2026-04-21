/**
 * Property-based tests for sub-agent progress event serialization
 *
 * Tests the serialization and deserialization of SubAgentProgressEvent objects
 * to ensure data integrity across the IPC boundary.
 *
 * Feature: sub-agent-progress-streaming, Property 2: Event Serialization Round-Trip
 * **Validates: Requirements 4.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { SubAgentProgressEvent, SubAgentProgressEventType } from '../computer-use';

/**
 * Arbitrary generator for SubAgentProgressEventType
 */
const arbEventType = (): fc.Arbitrary<SubAgentProgressEventType> =>
  fc.constantFrom('step', 'reasoning', 'action', 'screenshot', 'complete', 'abort');

/**
 * Arbitrary generator for action details
 */
const arbAction = () =>
  fc.record({
    type: fc.constantFrom('left_click', 'right_click', 'type', 'key', 'scroll', 'wait', 'mouse_move'),
    params: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.array(fc.integer(), { maxLength: 2 })
      )
    ),
    description: fc.string({ minLength: 1, maxLength: 100 }),
  });

/**
 * Arbitrary generator for screenshot data
 */
const arbScreenshot = () =>
  fc.record({
    base64: fc.string({ minLength: 10, maxLength: 100 }), // Simplified base64 for testing
    width: fc.integer({ min: 100, max: 3840 }),
    height: fc.integer({ min: 100, max: 2160 }),
  });

/**
 * Arbitrary generator for metadata
 */
const arbMetadata = () =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean()
    ),
    { minKeys: 0, maxKeys: 5 }
  );

/**
 * Arbitrary generator for valid ISO 8601 timestamps
 */
const arbTimestamp = () =>
  fc
    .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in milliseconds
    .map(ms => new Date(ms).toISOString());

/**
 * Arbitrary generator for SubAgentProgressEvent
 *
 * Generates random SubAgentProgressEvent objects covering all event types
 * with varying field combinations.
 */
const arbSubAgentProgressEvent = (): fc.Arbitrary<SubAgentProgressEvent> =>
  fc
    .record({
      type: arbEventType(),
      toolCallId: fc.uuid(),
      timestamp: arbTimestamp(),
      stepNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
      totalSteps: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
      content: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
      action: fc.option(arbAction(), { nil: undefined }),
      screenshot: fc.option(arbScreenshot(), { nil: undefined }),
      metadata: fc.option(arbMetadata(), { nil: undefined }),
    })
    .map((event) => {
      // Ensure stepNumber <= totalSteps when both are present
      if (event.stepNumber !== undefined && event.totalSteps !== undefined) {
        if (event.stepNumber > event.totalSteps) {
          event.stepNumber = event.totalSteps;
        }
      }

      // Add type-specific fields based on event type
      switch (event.type) {
        case 'step':
          // Step events should have stepNumber and totalSteps
          if (event.stepNumber === undefined) {
            event.stepNumber = 1;
          }
          if (event.totalSteps === undefined) {
            event.totalSteps = 10;
          }
          break;

        case 'reasoning':
          // Reasoning events should have content
          if (event.content === undefined) {
            event.content = 'Generated reasoning content';
          }
          break;

        case 'action':
          // Action events should have action details
          if (event.action === undefined) {
            event.action = {
              type: 'left_click',
              params: { coordinate: [100, 200] },
              description: 'Click action',
            };
          }
          break;

        case 'screenshot':
          // Screenshot events should have screenshot data
          if (event.screenshot === undefined) {
            event.screenshot = {
              base64: 'base64encodeddata',
              width: 1920,
              height: 1080,
            };
          }
          break;

        case 'complete':
        case 'abort':
          // Complete and abort events don't require additional fields
          break;
      }

      return event;
    });

describe('Property-Based Tests: Event Serialization', () => {
  /**
   * Property 2: Event Serialization Round-Trip
   *
   * For any valid SubAgentProgressEvent object, serializing to JSON and then
   * deserializing SHALL produce an equivalent event with all fields preserved.
   *
   * Feature: sub-agent-progress-streaming, Property 2: Event Serialization Round-Trip
   * **Validates: Requirements 4.2**
   */
  it('property: event serialization round-trip preserves all fields', () => {
    fc.assert(
      fc.property(arbSubAgentProgressEvent(), (originalEvent) => {
        // Serialize to JSON
        const serialized = JSON.stringify(originalEvent);

        // Deserialize from JSON
        const deserialized: SubAgentProgressEvent = JSON.parse(serialized);

        // Verify all fields are preserved
        expect(deserialized.type).toBe(originalEvent.type);
        expect(deserialized.toolCallId).toBe(originalEvent.toolCallId);
        expect(deserialized.timestamp).toBe(originalEvent.timestamp);

        // Optional fields
        if (originalEvent.stepNumber !== undefined) {
          expect(deserialized.stepNumber).toBe(originalEvent.stepNumber);
        } else {
          expect(deserialized.stepNumber).toBeUndefined();
        }

        if (originalEvent.totalSteps !== undefined) {
          expect(deserialized.totalSteps).toBe(originalEvent.totalSteps);
        } else {
          expect(deserialized.totalSteps).toBeUndefined();
        }

        if (originalEvent.content !== undefined) {
          expect(deserialized.content).toBe(originalEvent.content);
        } else {
          expect(deserialized.content).toBeUndefined();
        }

        // Action field (nested object)
        if (originalEvent.action !== undefined) {
          expect(deserialized.action).toBeDefined();
          expect(deserialized.action?.type).toBe(originalEvent.action.type);
          expect(deserialized.action?.description).toBe(originalEvent.action.description);
          expect(deserialized.action?.params).toEqual(originalEvent.action.params);
        } else {
          expect(deserialized.action).toBeUndefined();
        }

        // Screenshot field (nested object)
        if (originalEvent.screenshot !== undefined) {
          expect(deserialized.screenshot).toBeDefined();
          expect(deserialized.screenshot?.base64).toBe(originalEvent.screenshot.base64);
          expect(deserialized.screenshot?.width).toBe(originalEvent.screenshot.width);
          expect(deserialized.screenshot?.height).toBe(originalEvent.screenshot.height);
        } else {
          expect(deserialized.screenshot).toBeUndefined();
        }

        // Metadata field (nested object)
        if (originalEvent.metadata !== undefined) {
          expect(deserialized.metadata).toBeDefined();
          expect(deserialized.metadata).toEqual(originalEvent.metadata);
        } else {
          expect(deserialized.metadata).toBeUndefined();
        }

        // Deep equality check
        expect(deserialized).toEqual(originalEvent);
      }),
      { numRuns: 100 } // Run 100+ iterations as specified in requirements
    );
  });

  /**
   * Property: Event serialization handles all event types correctly
   *
   * Verifies that each event type (step, reasoning, action, screenshot, complete, abort)
   * can be serialized and deserialized without data loss.
   */
  it('property: serialization works for all event types', () => {
    fc.assert(
      fc.property(arbEventType(), arbSubAgentProgressEvent(), (eventType, baseEvent) => {
        // Override the event type to test specific type
        const event: SubAgentProgressEvent = { ...baseEvent, type: eventType };

        // Serialize and deserialize
        const serialized = JSON.stringify(event);
        const deserialized: SubAgentProgressEvent = JSON.parse(serialized);

        // Verify type is preserved
        expect(deserialized.type).toBe(eventType);

        // Verify event is equivalent
        expect(deserialized).toEqual(event);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Event serialization handles edge cases
   *
   * Tests serialization with edge cases like empty strings, zero values,
   * and minimal/maximal field values.
   */
  it('property: serialization handles edge cases correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: arbEventType(),
          toolCallId: fc.uuid(),
          timestamp: arbTimestamp(),
          stepNumber: fc.option(fc.constantFrom(0, 1, 100, 1000), { nil: undefined }),
          totalSteps: fc.option(fc.constantFrom(1, 100, 1000), { nil: undefined }),
          content: fc.option(fc.constantFrom('', 'a', 'x'.repeat(1000)), { nil: undefined }),
        }),
        (event) => {
          // Serialize and deserialize
          const serialized = JSON.stringify(event);
          const deserialized = JSON.parse(serialized);

          // Verify all fields are preserved
          expect(deserialized).toEqual(event);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Serialized events are valid JSON strings
   *
   * Verifies that serialization always produces valid JSON that can be parsed.
   */
  it('property: serialization always produces valid JSON', () => {
    fc.assert(
      fc.property(arbSubAgentProgressEvent(), (event) => {
        // Serialize
        const serialized = JSON.stringify(event);

        // Verify it's a string
        expect(typeof serialized).toBe('string');

        // Verify it can be parsed without throwing
        expect(() => JSON.parse(serialized)).not.toThrow();

        // Verify parsed result is an object
        const parsed = JSON.parse(serialized);
        expect(typeof parsed).toBe('object');
        expect(parsed).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Serialization is idempotent
   *
   * Verifies that serializing and deserializing multiple times produces
   * the same result (no data corruption on repeated operations).
   */
  it('property: serialization is idempotent', () => {
    fc.assert(
      fc.property(arbSubAgentProgressEvent(), (originalEvent) => {
        // First round-trip
        const serialized1 = JSON.stringify(originalEvent);
        const deserialized1: SubAgentProgressEvent = JSON.parse(serialized1);

        // Second round-trip
        const serialized2 = JSON.stringify(deserialized1);
        const deserialized2: SubAgentProgressEvent = JSON.parse(serialized2);

        // Third round-trip
        const serialized3 = JSON.stringify(deserialized2);
        const deserialized3: SubAgentProgressEvent = JSON.parse(serialized3);

        // All deserialized versions should be equal
        expect(deserialized1).toEqual(originalEvent);
        expect(deserialized2).toEqual(originalEvent);
        expect(deserialized3).toEqual(originalEvent);

        // All serialized versions should be equal
        expect(serialized2).toBe(serialized1);
        expect(serialized3).toBe(serialized1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Serialization handles arrays of events
   *
   * Verifies that arrays of events (as used in buffering) can be serialized
   * and deserialized correctly.
   */
  it('property: serialization works for event arrays', () => {
    fc.assert(
      fc.property(
        fc.array(arbSubAgentProgressEvent(), { minLength: 1, maxLength: 20 }),
        (events) => {
          // Serialize array
          const serialized = JSON.stringify(events);

          // Deserialize array
          const deserialized: SubAgentProgressEvent[] = JSON.parse(serialized);

          // Verify array length is preserved
          expect(deserialized.length).toBe(events.length);

          // Verify each event is preserved
          deserialized.forEach((deserializedEvent, index) => {
            expect(deserializedEvent).toEqual(events[index]);
          });

          // Deep equality check
          expect(deserialized).toEqual(events);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Serialization preserves timestamp format
   *
   * Verifies that ISO 8601 timestamp strings are preserved correctly
   * through serialization.
   */
  it('property: serialization preserves ISO 8601 timestamps', () => {
    fc.assert(
      fc.property(arbSubAgentProgressEvent(), (event) => {
        // Serialize and deserialize
        const serialized = JSON.stringify(event);
        const deserialized: SubAgentProgressEvent = JSON.parse(serialized);

        // Verify timestamp is preserved as string
        expect(typeof deserialized.timestamp).toBe('string');
        expect(deserialized.timestamp).toBe(event.timestamp);

        // Verify timestamp is valid ISO 8601 format
        const timestampDate = new Date(deserialized.timestamp);
        expect(timestampDate.toISOString()).toBe(deserialized.timestamp);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Serialization handles nested objects correctly
   *
   * Verifies that nested objects (action, screenshot, metadata) are
   * serialized and deserialized with all nested fields preserved.
   */
  it('property: serialization preserves nested object structures', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant('action' as const),
          toolCallId: fc.uuid(),
          timestamp: arbTimestamp(),
          action: arbAction(),
          metadata: arbMetadata(),
        }),
        (event) => {
          // Serialize and deserialize
          const serialized = JSON.stringify(event);
          const deserialized = JSON.parse(serialized);

          // Verify nested action object is preserved
          expect(deserialized.action).toEqual(event.action);
          expect(deserialized.action.type).toBe(event.action.type);
          expect(deserialized.action.params).toEqual(event.action.params);
          expect(deserialized.action.description).toBe(event.action.description);

          // Verify nested metadata object is preserved
          expect(deserialized.metadata).toEqual(event.metadata);

          // Deep equality check
          expect(deserialized).toEqual(event);
        }
      ),
      { numRuns: 100 }
    );
  });
});
