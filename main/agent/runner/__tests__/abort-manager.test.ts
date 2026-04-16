import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AbortSignalManager, globalAbortManager, AbortError } from '../abort-manager';

describe('AbortSignalManager', () => {
  let abortManager: AbortSignalManager;

  beforeEach(() => {
    abortManager = new AbortSignalManager();
  });

  describe('streamAborted flag', () => {
    it('should initialize with streamAborted as false', () => {
      expect(abortManager.streamAborted).toBe(false);
    });

    it('should set streamAborted to true when setAborted is called', () => {
      abortManager.setAborted();
      expect(abortManager.streamAborted).toBe(true);
    });

    it('should not change streamAborted if setAborted is called multiple times', () => {
      abortManager.setAborted();
      const firstTime = abortManager.getAbortTiming().elapsedMs;

      // Wait a bit and call again
      setTimeout(() => {
        abortManager.setAborted();
        const secondTime = abortManager.getAbortTiming().elapsedMs;

        expect(abortManager.streamAborted).toBe(true);
        expect(firstTime).toBeLessThanOrEqual(secondTime!);
      }, 10);
    });
  });

  describe('checkAbort method', () => {
    it('should return false when not aborted', () => {
      expect(abortManager.checkAbort()).toBe(false);
    });

    it('should throw AbortError when aborted', () => {
      abortManager.setAborted();

      expect(() => abortManager.checkAbort()).toThrow('Execution aborted by user (stop button clicked)');
    });

    it('should throw error within reasonable time after abort is set', () => {
      const startTime = Date.now();
      abortManager.setAborted();

      try {
        abortManager.checkAbort();
      } catch (error) {
        const elapsedTime = Date.now() - startTime;
        expect(elapsedTime).toBeLessThan(100); // Should be well under 100ms requirement
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Execution aborted by user');
      }
    });
  });

  describe('propagateToTools method', () => {
    it('should abort the AbortController when called after setAborted', () => {
      const controller = abortManager.abortController;
      expect(controller.signal.aborted).toBe(false);

      abortManager.setAborted();
      abortManager.propagateToTools();

      expect(controller.signal.aborted).toBe(true);
    });

    it('should not abort controller if not aborted', () => {
      const controller = abortManager.abortController;
      abortManager.propagateToTools();

      expect(controller.signal.aborted).toBe(false);
    });
  });

  describe('reset method', () => {
    it('should reset abort state', () => {
      abortManager.setAborted();
      expect(abortManager.streamAborted).toBe(true);

      abortManager.reset();
      expect(abortManager.streamAborted).toBe(false);
    });

    it('should create new AbortController after reset', () => {
      const originalController = abortManager.abortController;
      abortManager.setAborted();

      abortManager.reset();
      const newController = abortManager.abortController;

      expect(newController).not.toBe(originalController);
      expect(newController.signal.aborted).toBe(false);
    });

    it('should reset timing information', () => {
      abortManager.setAborted();
      const timingBeforeReset = abortManager.getAbortTiming();
      expect(timingBeforeReset.aborted).toBe(true);
      expect(timingBeforeReset.elapsedMs).toBeGreaterThanOrEqual(0);

      abortManager.reset();
      const timingAfterReset = abortManager.getAbortTiming();
      expect(timingAfterReset.aborted).toBe(false);
      expect(timingAfterReset.elapsedMs).toBeNull();
    });
  });

  describe('createShouldAbortCallback', () => {
    it('should return a function that reflects abort state', () => {
      const shouldAbort = abortManager.createShouldAbortCallback();

      expect(typeof shouldAbort).toBe('function');
      expect(shouldAbort()).toBe(false);

      abortManager.setAborted();
      expect(shouldAbort()).toBe(true);
    });
  });

  describe('getAbortTiming', () => {
    it('should return correct timing information', () => {
      const timing = abortManager.getAbortTiming();
      expect(timing.aborted).toBe(false);
      expect(timing.elapsedMs).toBeNull();

      abortManager.setAborted();
      const timingAfterAbort = abortManager.getAbortTiming();
      expect(timingAfterAbort.aborted).toBe(true);
      expect(timingAfterAbort.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AbortController integration', () => {
    it('should provide access to AbortController', () => {
      const controller = abortManager.abortController;
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal).toBeInstanceOf(AbortSignal);
    });

    it('should abort controller when setAborted is called', () => {
      const controller = abortManager.abortController;
      expect(controller.signal.aborted).toBe(false);

      abortManager.setAborted();
      expect(controller.signal.aborted).toBe(true);
    });
  });
});

describe('globalAbortManager', () => {
  beforeEach(() => {
    globalAbortManager.reset();
  });

  it('should be a singleton instance', () => {
    expect(globalAbortManager).toBeInstanceOf(AbortSignalManager);
  });

  it('should maintain state across imports', () => {
    globalAbortManager.setAborted();
    expect(globalAbortManager.streamAborted).toBe(true);
  });

  it('should provide shouldAbort callback for compatibility', () => {
    const shouldAbort = globalAbortManager.createShouldAbortCallback();
    expect(shouldAbort()).toBe(false);

    globalAbortManager.setAborted();
    expect(shouldAbort()).toBe(true);
  });
});

describe('AbortError', () => {
  it('should be a proper Error subclass', () => {
    const error = new AbortError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AbortError');
    expect(error.message).toBe('Execution aborted by user');
  });

  it('should accept custom message', () => {
    const customMessage = 'Custom abort message';
    const error = new AbortError(customMessage);
    expect(error.message).toBe(customMessage);
    expect(error.name).toBe('AbortError');
  });
});

describe('Requirements Validation', () => {
  beforeEach(() => {
    globalAbortManager.reset();
  });

  it('should meet Requirement 1.1: Stop button sets Stream_Abort_Flag immediately', () => {
    // Simulate stop button click
    globalAbortManager.setAborted();

    // Verify flag is set immediately
    expect(globalAbortManager.streamAborted).toBe(true);
  });

  it('should meet Requirement 1.2: Agent_Runner checks flag before each node execution', () => {
    const shouldAbort = globalAbortManager.createShouldAbortCallback();

    // Before abort
    expect(shouldAbort()).toBe(false);

    // After abort
    globalAbortManager.setAborted();
    expect(shouldAbort()).toBe(true);
  });

  it('should meet Requirement 1.3: Throw abortion error within 100ms', () => {
    const startTime = Date.now();
    globalAbortManager.setAborted();

    try {
      globalAbortManager.checkAbort();
      expect.fail('Should have thrown an error');
    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeLessThan(100);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('should meet Requirement 1.7: Propagate abort to running tool executions', () => {
    const controller = globalAbortManager.abortController;

    // Simulate tool execution with abort signal
    globalAbortManager.setAborted();
    globalAbortManager.propagateToTools();

    expect(controller.signal.aborted).toBe(true);
  });

  it('should provide centralized abort state management', () => {
    // Test that the global manager maintains state
    expect(globalAbortManager.streamAborted).toBe(false);

    globalAbortManager.setAborted();
    expect(globalAbortManager.streamAborted).toBe(true);

    // Test timing tracking
    const timing = globalAbortManager.getAbortTiming();
    expect(timing.aborted).toBe(true);
    expect(timing.elapsedMs).toBeGreaterThanOrEqual(0);

    // Test reset functionality
    globalAbortManager.reset();
    expect(globalAbortManager.streamAborted).toBe(false);
    expect(globalAbortManager.getAbortTiming().elapsedMs).toBeNull();
  });
});
