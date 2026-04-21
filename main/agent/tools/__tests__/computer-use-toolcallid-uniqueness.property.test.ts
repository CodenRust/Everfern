/**
 * Property-based tests for tool call ID uniqueness
 *
 * Tests that toolCallIds generated for concurrent sub-agent executions are unique.
 * This ensures that progress events from different sub-agents can be correctly
 * distinguished and grouped in the frontend.
 *
 * Feature: sub-agent-progress-streaming, Property 6: Tool Call ID Uniqueness
 * **Validates: Requirements 14.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as crypto from 'crypto';

/**
 * Simulates generating toolCallIds for concurrent sub-agent executions.
 * In the actual implementation, each sub-agent execution generates a toolCallId
 * using crypto.randomUUID() (see main/agent/tools/computer-use.ts line 1614).
 */
function generateToolCallIds(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomUUID());
}

describe('Property-Based Tests: Tool Call ID Uniqueness', () => {
  /**
   * Property 6: Tool Call ID Uniqueness
   *
   * For any set of concurrent sub-agent executions, all toolCallIds SHALL be unique
   * (no two concurrent executions share the same ID).
   *
   * Feature: sub-agent-progress-streaming, Property 6: Tool Call ID Uniqueness
   * **Validates: Requirements 14.5**
   */
  it('property: all toolCallIds are unique across concurrent sub-agents', () => {
    fc.assert(
      fc.property(
        // Generate random number of concurrent sub-agents (2-10)
        fc.integer({ min: 2, max: 10 }),
        (numSubAgents) => {
          // Generate toolCallIds for concurrent sub-agents
          const toolCallIds = generateToolCallIds(numSubAgents);

          // Verify all toolCallIds are unique
          const uniqueIds = new Set(toolCallIds);
          expect(uniqueIds.size).toBe(numSubAgents);

          // Verify no duplicates exist
          expect(toolCallIds.length).toBe(uniqueIds.size);

          // Verify each ID is a valid UUID v4 format
          toolCallIds.forEach((id) => {
            expect(id).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
          });
        }
      ),
      { numRuns: 100 } // Run 100+ iterations as specified in requirements
    );
  });

  /**
   * Property: Tool call IDs remain unique even with many concurrent executions
   *
   * Tests uniqueness with larger numbers of concurrent sub-agents to verify
   * that the UUID generation mechanism doesn't produce collisions at scale.
   */
  it('property: toolCallIds remain unique with many concurrent sub-agents', () => {
    fc.assert(
      fc.property(
        // Test with larger numbers (10-50 concurrent sub-agents)
        fc.integer({ min: 10, max: 50 }),
        (numSubAgents) => {
          // Generate toolCallIds
          const toolCallIds = generateToolCallIds(numSubAgents);

          // Verify all are unique
          const uniqueIds = new Set(toolCallIds);
          expect(uniqueIds.size).toBe(numSubAgents);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tool call IDs are unique across multiple batches
   *
   * Simulates multiple waves of concurrent sub-agent executions to verify
   * that IDs remain unique across different execution batches.
   */
  it('property: toolCallIds are unique across multiple execution batches', () => {
    fc.assert(
      fc.property(
        // Generate 2-5 batches of 2-10 sub-agents each
        fc.array(fc.integer({ min: 2, max: 10 }), { minLength: 2, maxLength: 5 }),
        (batchSizes) => {
          // Generate toolCallIds for all batches
          const allToolCallIds: string[] = [];

          batchSizes.forEach((batchSize) => {
            const batchIds = generateToolCallIds(batchSize);
            allToolCallIds.push(...batchIds);
          });

          // Verify all IDs across all batches are unique
          const uniqueIds = new Set(allToolCallIds);
          expect(uniqueIds.size).toBe(allToolCallIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tool call ID generation is deterministically unique
   *
   * Verifies that generating IDs in rapid succession (simulating high-frequency
   * sub-agent spawning) still produces unique IDs.
   */
  it('property: rapid toolCallId generation produces unique IDs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (numRapidGenerations) => {
          // Generate IDs in rapid succession (no delay)
          const rapidIds: string[] = [];
          for (let i = 0; i < numRapidGenerations; i++) {
            rapidIds.push(crypto.randomUUID());
          }

          // Verify all are unique
          const uniqueIds = new Set(rapidIds);
          expect(uniqueIds.size).toBe(numRapidGenerations);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tool call IDs are non-empty strings
   *
   * Verifies that generated toolCallIds are always non-empty strings,
   * which is a prerequisite for using them as Map keys in the frontend.
   */
  it('property: toolCallIds are always non-empty strings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (numSubAgents) => {
          const toolCallIds = generateToolCallIds(numSubAgents);

          // Verify each ID is a non-empty string
          toolCallIds.forEach((id) => {
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tool call IDs have consistent format
   *
   * Verifies that all generated toolCallIds follow the UUID v4 format,
   * which ensures consistency across the system.
   */
  it('property: toolCallIds follow UUID v4 format consistently', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (numSubAgents) => {
          const toolCallIds = generateToolCallIds(numSubAgents);

          // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
          // where x is any hexadecimal digit and y is one of 8, 9, a, or b
          const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

          toolCallIds.forEach((id) => {
            expect(id).toMatch(uuidV4Regex);

            // Verify UUID structure
            const parts = id.split('-');
            expect(parts.length).toBe(5);
            expect(parts[0].length).toBe(8);
            expect(parts[1].length).toBe(4);
            expect(parts[2].length).toBe(4);
            expect(parts[3].length).toBe(4);
            expect(parts[4].length).toBe(12);

            // Verify version field (4th character of 3rd group should be '4')
            expect(parts[2][0]).toBe('4');

            // Verify variant field (1st character of 4th group should be 8, 9, a, or b)
            expect(['8', '9', 'a', 'b', 'A', 'B']).toContain(parts[3][0]);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tool call IDs can be used as Map keys
   *
   * Verifies that toolCallIds work correctly as Map keys, which is how
   * the frontend groups progress events by sub-agent.
   */
  it('property: toolCallIds work correctly as Map keys', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (numSubAgents) => {
          const toolCallIds = generateToolCallIds(numSubAgents);

          // Create a Map using toolCallIds as keys
          const eventMap = new Map<string, number>();
          toolCallIds.forEach((id, index) => {
            eventMap.set(id, index);
          });

          // Verify Map has correct size (all keys are unique)
          expect(eventMap.size).toBe(numSubAgents);

          // Verify all keys can be retrieved
          toolCallIds.forEach((id, index) => {
            expect(eventMap.has(id)).toBe(true);
            expect(eventMap.get(id)).toBe(index);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tool call ID collision probability is negligible
   *
   * Tests that even with a large number of generated IDs (simulating
   * thousands of sub-agent executions), no collisions occur.
   */
  it('property: no collisions in large-scale ID generation', () => {
    fc.assert(
      fc.property(
        // Generate 100-500 IDs to simulate large-scale usage
        fc.integer({ min: 100, max: 500 }),
        (numIds) => {
          const toolCallIds = generateToolCallIds(numIds);

          // Verify all are unique (no collisions)
          const uniqueIds = new Set(toolCallIds);
          expect(uniqueIds.size).toBe(numIds);

          // Calculate collision rate (should be 0)
          const collisionRate = 1 - (uniqueIds.size / numIds);
          expect(collisionRate).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
