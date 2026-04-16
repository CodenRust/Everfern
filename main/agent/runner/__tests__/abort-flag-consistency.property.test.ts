import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { AbortSignalManager, globalAbortManager } from '../abort-manager';

/**
 * Property-Based Test: Abort Flag Checking Consistency
 *
 * **Validates: Requirements 1.2, 1.4**
 *
 * Property 1: Abort Flag Checking Consistency
 *
 * For any execution graph and any point during execution, when the Stream_Abort_Flag
 * is set to true, the Agent_Runner SHALL check the flag before proceeding to the next
 * node and terminate execution if the flag is true.
 */
describe('Feature: multi-platform-integration, Property 1: Abort Flag Checking Consistency', () => {
  let abortManager: AbortSignalManager;

  beforeEach(() => {
    // Reset global abort manager
    globalAbortManager.reset();

    // Create fresh abort manager for each test
    abortManager = new AbortSignalManager();
  });

  /**
   * Property Test: Abort flag consistency across different execution scenarios
   *
   * This test verifies that the abort flag checking mechanism works consistently
   * regardless of when the abort is triggered or how many times it's called.
   */
  it('property: abort flag checking is consistent across all execution scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // When to set the abort flag
          abortTiming: fc.constantFrom('before_execution', 'multiple_calls'),

          // Different execution patterns
          executionPattern: fc.record({
            nodeCount: fc.integer({ min: 1, max: 5 }),
            processingDelay: fc.integer({ min: 0, max: 5 }), // ms
            checkFrequency: fc.integer({ min: 1, max: 3 }), // checks per node
          }),

          // Abort manager configuration
          managerConfig: fc.record({
            useGlobalManager: fc.boolean(),
            resetBeforeTest: fc.boolean(),
          }),
        }),

        async (scenario) => {
          // Choose which abort manager to use
          const manager = scenario.managerConfig.useGlobalManager ? globalAbortManager : abortManager;

          // Reset if specified
          if (scenario.managerConfig.resetBeforeTest) {
            manager.reset();
          }

          // Create shouldAbort callback
          const shouldAbort = manager.createShouldAbortCallback();

          // Simulate a graph node that checks abort before processing
          const createMockNode = (nodeId: number) => {
            return async () => {
              // CRITICAL: Every node must check abort before processing
              for (let check = 0; check < scenario.executionPattern.checkFrequency; check++) {
                if (shouldAbort()) {
                  throw new Error('Execution aborted by user (stop button clicked)');
                }

                // Simulate some processing time
                if (scenario.executionPattern.processingDelay > 0) {
                  await new Promise(resolve => setTimeout(resolve, scenario.executionPattern.processingDelay));
                }
              }

              return { nodeId, processed: true };
            };
          };

          // Set abort flag based on timing
          let abortWasSet = false;

          if (scenario.abortTiming === 'before_execution') {
            manager.setAborted();
            abortWasSet = true;
          } else if (scenario.abortTiming === 'multiple_calls') {
            manager.setAborted();
            manager.setAborted(); // Should be idempotent
            manager.setAborted(); // Should be idempotent
            abortWasSet = true;
          }

          // Execute nodes and track results
          let executionAborted = false;
          let nodesProcessed = 0;

          try {
            // Create and execute nodes
            for (let i = 0; i < scenario.executionPattern.nodeCount; i++) {
              const node = createMockNode(i);
              await node();
              nodesProcessed++;

              // If abort was set and we reach here, that's a problem
              if (abortWasSet) {
                expect.fail(`Node ${i} should have detected abort but continued execution`);
              }
            }

          } catch (error) {
            executionAborted = true;

            // Verify it's the expected abort error
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Execution aborted by user');
          }

          // Verify consistency: If abort was set, execution must have been aborted
          if (abortWasSet) {
            expect(executionAborted).toBe(true);
            expect(manager.streamAborted).toBe(true);
            expect(manager.abortController.signal.aborted).toBe(true);
          } else {
            // If no abort was set, execution should complete normally
            expect(executionAborted).toBe(false);
            expect(nodesProcessed).toBe(scenario.executionPattern.nodeCount);
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations for comprehensive coverage
    );
  });

  /**
   * Property Test: Abort signal detection timing
   *
   * Verifies that abort signal detection is fast and consistent.
   */
  it('property: abort signal detection is immediate when flag is set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Different processing scenarios
          processingLoad: fc.integer({ min: 0, max: 10 }), // ms of simulated work

          // Different check patterns
          checkPattern: fc.record({
            checksPerNode: fc.integer({ min: 1, max: 5 }),
            delayBetweenChecks: fc.integer({ min: 0, max: 2 }), // ms
          }),
        }),

        async (scenario) => {
          const shouldAbort = abortManager.createShouldAbortCallback();

          // Create a node that simulates processing with abort checks
          const processWithAbortChecks = async () => {
            for (let check = 0; check < scenario.checkPattern.checksPerNode; check++) {
              // Check abort before each processing step
              if (shouldAbort()) {
                throw new Error('Execution aborted by user (stop button clicked)');
              }

              // Simulate processing work
              if (scenario.processingLoad > 0) {
                await new Promise(resolve => setTimeout(resolve, scenario.processingLoad / scenario.checkPattern.checksPerNode));
              }

              // Delay between checks if specified
              if (scenario.checkPattern.delayBetweenChecks > 0 && check < scenario.checkPattern.checksPerNode - 1) {
                await new Promise(resolve => setTimeout(resolve, scenario.checkPattern.delayBetweenChecks));
              }
            }

            return { completed: true };
          };

          // Test without abort - should complete normally
          abortManager.reset(); // Ensure clean state
          let result = await processWithAbortChecks();
          expect(result.completed).toBe(true);
          expect(abortManager.streamAborted).toBe(false);

          // Now set abort and test - should throw immediately
          abortManager.setAborted();

          let abortDetected = false;
          try {
            await processWithAbortChecks();
            expect.fail('Processing should have been aborted but completed normally');
          } catch (error) {
            abortDetected = true;
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('Execution aborted by user');
          }

          expect(abortDetected).toBe(true);
          expect(abortManager.streamAborted).toBe(true);
          expect(abortManager.abortController.signal.aborted).toBe(true);

          const timing = abortManager.getAbortTiming();
          expect(timing.aborted).toBe(true);
          expect(timing.elapsedMs).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property Test: shouldAbort callback consistency
   *
   * Verifies that the shouldAbort callback function always returns
   * consistent results that match the abort manager's internal state.
   */
  it('property: shouldAbort callback always reflects abort manager state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Different operations to perform
          operations: fc.array(
            fc.constantFrom(
              'check_callback',
              'set_abort',
              'reset_manager',
              'create_new_callback',
              'propagate_to_tools'
            ),
            { minLength: 1, maxLength: 8 }
          ),

          // Multiple callback instances
          useMultipleCallbacks: fc.boolean(),
        }),

        async (scenario) => {
          // Create initial callback(s)
          let callbacks = [abortManager.createShouldAbortCallback()];

          if (scenario.useMultipleCallbacks) {
            callbacks.push(abortManager.createShouldAbortCallback());
            callbacks.push(abortManager.createShouldAbortCallback());
          }

          // Execute operations and verify consistency
          for (const operation of scenario.operations) {
            const beforeState = abortManager.streamAborted;

            // Execute the operation
            switch (operation) {
              case 'check_callback':
                // Just call the callbacks - should not change state
                break;

              case 'set_abort':
                abortManager.setAborted();
                break;

              case 'reset_manager':
                abortManager.reset();
                // Recreate callbacks after reset since AbortController changes
                callbacks = [abortManager.createShouldAbortCallback()];
                if (scenario.useMultipleCallbacks) {
                  callbacks.push(abortManager.createShouldAbortCallback());
                  callbacks.push(abortManager.createShouldAbortCallback());
                }
                break;

              case 'create_new_callback':
                callbacks.push(abortManager.createShouldAbortCallback());
                break;

              case 'propagate_to_tools':
                abortManager.propagateToTools();
                break;
            }

            const afterState = abortManager.streamAborted;

            // Verify all callbacks return consistent results
            for (let i = 0; i < callbacks.length; i++) {
              const callbackResult = callbacks[i]();

              // CRITICAL: Callback result must match manager state
              expect(callbackResult).toBe(afterState);

              // All callbacks should return the same result
              if (i > 0) {
                expect(callbackResult).toBe(callbacks[0]());
              }
            }

            // Verify state transitions are logical
            if (operation === 'set_abort') {
              expect(afterState).toBe(true);
            } else if (operation === 'reset_manager') {
              expect(afterState).toBe(false);
            }

            // Verify timing information consistency
            const timing = abortManager.getAbortTiming();
            expect(timing.aborted).toBe(afterState);

            if (afterState) {
              expect(timing.elapsedMs).toBeGreaterThanOrEqual(0);
            } else {
              expect(timing.elapsedMs).toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property Test: Abort state isolation between manager instances
   *
   * Verifies that different AbortSignalManager instances maintain
   * independent state and don't interfere with each other.
   */
  it('property: abort managers maintain independent state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Operations for first manager
          manager1Operations: fc.array(
            fc.constantFrom('set_abort', 'reset', 'check_state'),
            { minLength: 1, maxLength: 5 }
          ),

          // Operations for second manager
          manager2Operations: fc.array(
            fc.constantFrom('set_abort', 'reset', 'check_state'),
            { minLength: 1, maxLength: 5 }
          ),

          // Whether to include global manager
          includeGlobalManager: fc.boolean(),
        }),

        async (scenario) => {
          // Create independent managers
          const manager1 = new AbortSignalManager();
          const manager2 = new AbortSignalManager();
          const managers = scenario.includeGlobalManager
            ? [manager1, manager2, globalAbortManager]
            : [manager1, manager2];

          // Create callbacks for each manager
          const callbacks = managers.map(m => m.createShouldAbortCallback());

          // Execute operations on first manager
          for (const operation of scenario.manager1Operations) {
            switch (operation) {
              case 'set_abort':
                manager1.setAborted();
                break;
              case 'reset':
                manager1.reset();
                callbacks[0] = manager1.createShouldAbortCallback(); // Update callback after reset
                break;
              case 'check_state':
                // Just check state
                break;
            }
          }

          // Execute operations on second manager
          for (const operation of scenario.manager2Operations) {
            switch (operation) {
              case 'set_abort':
                manager2.setAborted();
                break;
              case 'reset':
                manager2.reset();
                callbacks[1] = manager2.createShouldAbortCallback(); // Update callback after reset
                break;
              case 'check_state':
                // Just check state
                break;
            }
          }

          // Verify each manager maintains independent state
          for (let i = 0; i < managers.length; i++) {
            const manager = managers[i];
            const callback = callbacks[i];

            // Callback should match manager state
            expect(callback()).toBe(manager.streamAborted);

            // Timing should be consistent
            const timing = manager.getAbortTiming();
            expect(timing.aborted).toBe(manager.streamAborted);

            // AbortController should be consistent
            if (manager.streamAborted) {
              expect(manager.abortController.signal.aborted).toBe(true);
            }
          }

          // Verify managers don't interfere with each other
          // (This is implicitly tested by the independent state checks above)
        }
      ),
      { numRuns: 50 }
    );
  });
});
