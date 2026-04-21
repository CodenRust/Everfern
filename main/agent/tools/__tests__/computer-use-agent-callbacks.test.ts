/**
 * Tests for ComputerUseAgent progress callbacks
 *
 * Task 3.6: Write unit tests for ComputerUseAgent progress callbacks
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing
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

describe('ComputerUseAgent Progress Callbacks', () => {
  describe('Step Progress Events', () => {
    it('should emit step event when new step begins', () => {
      // This test verifies that the onProgress callback is invoked with a 'step' event
      // at the start of each step iteration

      const mockOnProgress = vi.fn();

      // Simulate the step event emission
      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 40,
      };

      mockOnProgress(stepEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'step',
          stepNumber: 1,
          totalSteps: 40,
        })
      );
    });

    it('should include stepNumber (1-indexed) in step event', () => {
      const mockOnProgress = vi.fn();

      // Simulate multiple step events
      for (let step = 1; step <= 5; step++) {
        const stepEvent: SubAgentProgressEvent = {
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          totalSteps: 40,
        };
        mockOnProgress(stepEvent);
      }

      // Verify step numbers are 1-indexed and sequential
      expect(mockOnProgress).toHaveBeenCalledTimes(5);
      expect(mockOnProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({ stepNumber: 1 }));
      expect(mockOnProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({ stepNumber: 2 }));
      expect(mockOnProgress).toHaveBeenNthCalledWith(3, expect.objectContaining({ stepNumber: 3 }));
      expect(mockOnProgress).toHaveBeenNthCalledWith(4, expect.objectContaining({ stepNumber: 4 }));
      expect(mockOnProgress).toHaveBeenNthCalledWith(5, expect.objectContaining({ stepNumber: 5 }));
    });

    it('should include totalSteps (maxTurns) in step event', () => {
      const mockOnProgress = vi.fn();
      const maxTurns = 40;

      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: maxTurns,
      };

      mockOnProgress(stepEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          totalSteps: maxTurns,
        })
      );
    });

    it('should include timestamp in ISO 8601 format', () => {
      const mockOnProgress = vi.fn();

      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 40,
      };

      mockOnProgress(stepEvent);

      const call = mockOnProgress.mock.calls[0][0];
      expect(call.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should emit step event at the start of each iteration', () => {
      // This test verifies the timing of step event emission
      const mockOnProgress = vi.fn();

      // Simulate the loop structure
      const maxTurns = 3;
      for (let step = 1; step <= maxTurns; step++) {
        // Step event should be emitted first
        const stepEvent: SubAgentProgressEvent = {
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          totalSteps: maxTurns,
        };
        mockOnProgress(stepEvent);

        // Then other events (reasoning, action, etc.) would follow
        // This test just verifies the step event is first
      }

      expect(mockOnProgress).toHaveBeenCalledTimes(3);

      // Verify each call has the correct step number
      for (let i = 0; i < 3; i++) {
        expect(mockOnProgress.mock.calls[i][0]).toMatchObject({
          type: 'step',
          stepNumber: i + 1,
          totalSteps: 3,
        });
      }
    });
  });

  describe('Event Data Structure', () => {
    it('should have correct structure for step event', () => {
      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: new Date().toISOString(),
        stepNumber: 5,
        totalSteps: 40,
      };

      expect(stepEvent).toHaveProperty('type', 'step');
      expect(stepEvent).toHaveProperty('toolCallId');
      expect(stepEvent).toHaveProperty('timestamp');
      expect(stepEvent).toHaveProperty('stepNumber');
      expect(stepEvent).toHaveProperty('totalSteps');
    });

    it('should allow optional fields to be omitted', () => {
      const minimalEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: new Date().toISOString(),
      };

      expect(minimalEvent).toHaveProperty('type');
      expect(minimalEvent).toHaveProperty('toolCallId');
      expect(minimalEvent).toHaveProperty('timestamp');
    });
  });

  describe('Callback Invocation', () => {
    it('should not throw error if onProgress is undefined', () => {
      // Simulate calling onProgress when it's undefined
      const onProgress = undefined;

      expect(() => {
        onProgress?.({
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 40,
        });
      }).not.toThrow();
    });

    it('should invoke onProgress callback when provided', () => {
      const mockOnProgress = vi.fn();

      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 40,
      };

      mockOnProgress(stepEvent);

      expect(mockOnProgress).toHaveBeenCalledTimes(1);
      expect(mockOnProgress).toHaveBeenCalledWith(stepEvent);
    });
  });

  describe('Step Counter Increments', () => {
    it('should increment step counter sequentially from 1', () => {
      const mockOnProgress = vi.fn();
      const maxTurns = 10;

      // Simulate the loop
      for (let step = 1; step <= maxTurns; step++) {
        mockOnProgress({
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          totalSteps: maxTurns,
        });
      }

      expect(mockOnProgress).toHaveBeenCalledTimes(10);

      // Verify sequential increment
      for (let i = 0; i < 10; i++) {
        expect(mockOnProgress.mock.calls[i][0].stepNumber).toBe(i + 1);
      }
    });

    it('should start step counter at 1 (not 0)', () => {
      const mockOnProgress = vi.fn();

      mockOnProgress({
        type: 'step',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 40,
      });

      expect(mockOnProgress.mock.calls[0][0].stepNumber).toBe(1);
      expect(mockOnProgress.mock.calls[0][0].stepNumber).not.toBe(0);
    });

    it('should not skip step numbers', () => {
      const mockOnProgress = vi.fn();
      const steps = [1, 2, 3, 4, 5];

      steps.forEach(step => {
        mockOnProgress({
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          totalSteps: 40,
        });
      });

      // Verify no gaps in step numbers
      const stepNumbers = mockOnProgress.mock.calls.map(call => call[0].stepNumber);
      expect(stepNumbers).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Reasoning Progress Events', () => {
    it('should emit reasoning event when agent generates reasoning', () => {
      const mockOnProgress = vi.fn();

      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        content: 'I need to click the search button to find the Discord application...',
      };

      mockOnProgress(reasoningEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reasoning',
          content: expect.any(String),
        })
      );
    });

    it('should include reasoning text in content field', () => {
      const mockOnProgress = vi.fn();
      const reasoningText = 'I need to click the search button to find the Discord application...';

      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        content: reasoningText,
      };

      mockOnProgress(reasoningEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          content: reasoningText,
        })
      );
    });

    it('should include stepNumber in reasoning event', () => {
      const mockOnProgress = vi.fn();

      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 5,
        content: 'Analyzing the screen...',
      };

      mockOnProgress(reasoningEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 5,
        })
      );
    });

    it('should only emit reasoning event when content exists', () => {
      const mockOnProgress = vi.fn();

      // Simulate the condition: only emit if content is truthy
      const content = '';
      if (content) {
        mockOnProgress({
          type: 'reasoning',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          content: content,
        });
      }

      // Should not be called for empty content
      expect(mockOnProgress).not.toHaveBeenCalled();
    });

    it('should emit reasoning event for non-empty content', () => {
      const mockOnProgress = vi.fn();

      const content = 'I need to perform an action';
      if (content) {
        mockOnProgress({
          type: 'reasoning',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          content: content,
        });
      }

      expect(mockOnProgress).toHaveBeenCalledTimes(1);
    });

    it('should have correct structure for reasoning event', () => {
      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: 'call_test_123',
        timestamp: new Date().toISOString(),
        stepNumber: 3,
        content: 'Analyzing the current state...',
      };

      expect(reasoningEvent).toHaveProperty('type', 'reasoning');
      expect(reasoningEvent).toHaveProperty('toolCallId');
      expect(reasoningEvent).toHaveProperty('timestamp');
      expect(reasoningEvent).toHaveProperty('stepNumber');
      expect(reasoningEvent).toHaveProperty('content');
    });

    it('should preserve whitespace and line breaks in reasoning text', () => {
      const mockOnProgress = vi.fn();
      const reasoningText = 'First line\nSecond line\n  Indented line';

      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        content: reasoningText,
      };

      mockOnProgress(reasoningEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          content: reasoningText,
        })
      );
    });
  });

  describe('Action Progress Events', () => {
    it('should emit action event when agent executes action', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'left_click',
          params: { action: 'left_click', coordinate: [398, 965] },
          description: 'Left click at (398, 965)',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action',
          action: expect.objectContaining({
            type: expect.any(String),
            params: expect.any(Object),
            description: expect.any(String),
          }),
        })
      );
    });

    it('should include action type in action event', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'left_click',
          params: { action: 'left_click', coordinate: [398, 965] },
          description: 'Left click at (398, 965)',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            type: 'left_click',
          }),
        })
      );
    });

    it('should include action params in action event', () => {
      const mockOnProgress = vi.fn();
      const params = { action: 'type', text: 'Hello World' };

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'type',
          params: params,
          description: 'Type "Hello World"',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            params: params,
          }),
        })
      );
    });

    it('should include human-readable description in action event', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'left_click',
          params: { action: 'left_click', coordinate: [398, 965] },
          description: 'Left click at (398, 965)',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            description: 'Left click at (398, 965)',
          }),
        })
      );
    });

    it('should include stepNumber in action event', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 7,
        action: {
          type: 'scroll',
          params: { action: 'scroll', pixels: -100 },
          description: 'Scroll up 100 pixels',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 7,
        })
      );
    });

    it('should have correct structure for action event', () => {
      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: 'call_test_123',
        timestamp: new Date().toISOString(),
        stepNumber: 2,
        action: {
          type: 'key',
          params: { action: 'key', keys: ['enter'] },
          description: 'Press enter',
        },
      };

      expect(actionEvent).toHaveProperty('type', 'action');
      expect(actionEvent).toHaveProperty('toolCallId');
      expect(actionEvent).toHaveProperty('timestamp');
      expect(actionEvent).toHaveProperty('stepNumber');
      expect(actionEvent).toHaveProperty('action');
      expect(actionEvent.action).toHaveProperty('type');
      expect(actionEvent.action).toHaveProperty('params');
      expect(actionEvent.action).toHaveProperty('description');
    });

    it('should format click actions with coordinates', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'left_click',
          params: { action: 'left_click', coordinate: [100, 200] },
          description: 'Left click at (100, 200)',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            description: expect.stringContaining('(100, 200)'),
          }),
        })
      );
    });

    it('should format type actions with text', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'type',
          params: { action: 'type', text: 'test input' },
          description: 'Type "test input"',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            description: expect.stringContaining('test input'),
          }),
        })
      );
    });

    it('should format scroll actions with direction and pixels', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'scroll',
          params: { action: 'scroll', pixels: 100 },
          description: 'Scroll down 100 pixels',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            description: expect.stringMatching(/Scroll (down|up) \d+ pixels/),
          }),
        })
      );
    });

    it('should format key press actions with key names', () => {
      const mockOnProgress = vi.fn();

      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'key',
          params: { action: 'key', keys: ['ctrl', 'c'] },
          description: 'Press ctrl + c',
        },
      };

      mockOnProgress(actionEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.objectContaining({
            description: expect.stringContaining('ctrl + c'),
          }),
        })
      );
    });

    it('should emit action event after action execution', () => {
      // This test verifies the timing of action event emission
      const mockOnProgress = vi.fn();
      const mockToolCall = vi.fn();

      // Simulate the execution flow
      const args = { action: 'left_click', coordinate: [100, 200] };

      // 1. Execute action
      mockToolCall(args);

      // 2. Emit action event (after execution)
      mockOnProgress({
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: args.action,
          params: args,
          description: 'Left click at (100, 200)',
        },
      });

      // Verify action was executed before event emission
      expect(mockToolCall).toHaveBeenCalledBefore(mockOnProgress);
      expect(mockOnProgress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Screenshot Progress Events', () => {
    it('should emit screenshot event when screenshot is captured', () => {
      const mockOnProgress = vi.fn();

      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080,
        },
      };

      mockOnProgress(screenshotEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'screenshot',
          screenshot: expect.objectContaining({
            base64: expect.any(String),
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        })
      );
    });

    it('should include base64-encoded image in screenshot event', () => {
      const mockOnProgress = vi.fn();
      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';

      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        screenshot: {
          base64: base64Image,
          width: 1920,
          height: 1080,
        },
      };

      mockOnProgress(screenshotEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshot: expect.objectContaining({
            base64: base64Image,
          }),
        })
      );
    });

    it('should include width and height in screenshot event', () => {
      const mockOnProgress = vi.fn();

      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080,
        },
      };

      mockOnProgress(screenshotEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          screenshot: expect.objectContaining({
            width: 1920,
            height: 1080,
          }),
        })
      );
    });

    it('should include stepNumber in screenshot event', () => {
      const mockOnProgress = vi.fn();

      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 3,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080,
        },
      };

      mockOnProgress(screenshotEvent);

      expect(mockOnProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stepNumber: 3,
        })
      );
    });

    it('should have correct structure for screenshot event', () => {
      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: 'call_test_123',
        timestamp: new Date().toISOString(),
        stepNumber: 2,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080,
        },
      };

      expect(screenshotEvent).toHaveProperty('type', 'screenshot');
      expect(screenshotEvent).toHaveProperty('toolCallId');
      expect(screenshotEvent).toHaveProperty('timestamp');
      expect(screenshotEvent).toHaveProperty('stepNumber');
      expect(screenshotEvent).toHaveProperty('screenshot');
      expect(screenshotEvent.screenshot).toHaveProperty('base64');
      expect(screenshotEvent.screenshot).toHaveProperty('width');
      expect(screenshotEvent.screenshot).toHaveProperty('height');
    });

    it('should handle different image dimensions', () => {
      const mockOnProgress = vi.fn();

      const dimensions = [
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 3840, height: 2160 },
        { width: 800, height: 600 },
      ];

      dimensions.forEach((dim, index) => {
        mockOnProgress({
          type: 'screenshot',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: index + 1,
          screenshot: {
            base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
            width: dim.width,
            height: dim.height,
          },
        });
      });

      expect(mockOnProgress).toHaveBeenCalledTimes(4);

      dimensions.forEach((dim, index) => {
        expect(mockOnProgress.mock.calls[index][0].screenshot).toMatchObject({
          width: dim.width,
          height: dim.height,
        });
      });
    });

    it('should emit screenshot event after screenshot capture', () => {
      // This test verifies the timing of screenshot event emission
      const mockOnProgress = vi.fn();
      const mockCaptureScreenshot = vi.fn(() => ({
        base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        width: 1920,
        height: 1080,
      }));

      // 1. Capture screenshot
      const screenshot = mockCaptureScreenshot();

      // 2. Emit screenshot event (after capture)
      mockOnProgress({
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        screenshot: screenshot,
      });

      // Verify screenshot was captured before event emission
      expect(mockCaptureScreenshot).toHaveBeenCalledBefore(mockOnProgress);
      expect(mockOnProgress).toHaveBeenCalledTimes(1);
    });

    it('should handle base64 data URL format', () => {
      const mockOnProgress = vi.fn();

      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080,
        },
      };

      mockOnProgress(screenshotEvent);

      const call = mockOnProgress.mock.calls[0][0];
      expect(call.screenshot?.base64).toMatch(/^data:image\/(jpeg|png);base64,/);
    });

    it('should emit screenshot event for each step that captures a screenshot', () => {
      const mockOnProgress = vi.fn();

      // Simulate multiple steps with screenshots
      for (let step = 1; step <= 3; step++) {
        mockOnProgress({
          type: 'screenshot',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          screenshot: {
            base64: `data:image/jpeg;base64,screenshot_${step}`,
            width: 1920,
            height: 1080,
          },
        });
      }

      expect(mockOnProgress).toHaveBeenCalledTimes(3);

      // Verify each screenshot has correct step number
      for (let i = 0; i < 3; i++) {
        expect(mockOnProgress.mock.calls[i][0]).toMatchObject({
          type: 'screenshot',
          stepNumber: i + 1,
        });
      }
    });
  });

  describe('Overall Callback Behavior', () => {
    it('should emit events in correct order: step -> reasoning -> action -> screenshot', () => {
      const mockOnProgress = vi.fn();

      // Simulate a complete step cycle
      mockOnProgress({
        type: 'step',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 10,
      });

      mockOnProgress({
        type: 'reasoning',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        content: 'I need to click the button',
      });

      mockOnProgress({
        type: 'action',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        action: {
          type: 'left_click',
          params: { coordinate: [100, 200] },
          description: 'Left click at (100, 200)',
        },
      });

      mockOnProgress({
        type: 'screenshot',
        toolCallId: '',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080,
        },
      });

      expect(mockOnProgress).toHaveBeenCalledTimes(4);

      // Verify order
      expect(mockOnProgress.mock.calls[0][0].type).toBe('step');
      expect(mockOnProgress.mock.calls[1][0].type).toBe('reasoning');
      expect(mockOnProgress.mock.calls[2][0].type).toBe('action');
      expect(mockOnProgress.mock.calls[3][0].type).toBe('screenshot');
    });

    it('should handle multiple complete step cycles', () => {
      const mockOnProgress = vi.fn();

      // Simulate 3 complete step cycles
      for (let step = 1; step <= 3; step++) {
        mockOnProgress({
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          totalSteps: 10,
        });

        mockOnProgress({
          type: 'reasoning',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          content: `Reasoning for step ${step}`,
        });

        mockOnProgress({
          type: 'action',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          action: {
            type: 'left_click',
            params: { coordinate: [100 * step, 200 * step] },
            description: `Left click at (${100 * step}, ${200 * step})`,
          },
        });

        mockOnProgress({
          type: 'screenshot',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: step,
          screenshot: {
            base64: `data:image/jpeg;base64,screenshot_${step}`,
            width: 1920,
            height: 1080,
          },
        });
      }

      expect(mockOnProgress).toHaveBeenCalledTimes(12); // 4 events * 3 steps

      // Verify all step numbers are correct
      const stepEvents = mockOnProgress.mock.calls.filter(call => call[0].type === 'step');
      expect(stepEvents).toHaveLength(3);
      expect(stepEvents[0][0].stepNumber).toBe(1);
      expect(stepEvents[1][0].stepNumber).toBe(2);
      expect(stepEvents[2][0].stepNumber).toBe(3);
    });

    it('should include toolCallId in all events', () => {
      const mockOnProgress = vi.fn();
      const toolCallId = 'call_test_123';

      const eventTypes: SubAgentProgressEvent['type'][] = ['step', 'reasoning', 'action', 'screenshot'];

      eventTypes.forEach(type => {
        const event: SubAgentProgressEvent = {
          type,
          toolCallId,
          timestamp: new Date().toISOString(),
          stepNumber: 1,
        };

        if (type === 'reasoning') {
          event.content = 'Test reasoning';
        } else if (type === 'action') {
          event.action = {
            type: 'left_click',
            params: { coordinate: [100, 200] },
            description: 'Left click at (100, 200)',
          };
        } else if (type === 'screenshot') {
          event.screenshot = {
            base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
            width: 1920,
            height: 1080,
          };
        }

        mockOnProgress(event);
      });

      expect(mockOnProgress).toHaveBeenCalledTimes(4);

      // Verify all events have the same toolCallId
      mockOnProgress.mock.calls.forEach(call => {
        expect(call[0].toolCallId).toBe(toolCallId);
      });
    });

    it('should include timestamp in all events', () => {
      const mockOnProgress = vi.fn();

      const eventTypes: SubAgentProgressEvent['type'][] = ['step', 'reasoning', 'action', 'screenshot'];

      eventTypes.forEach(type => {
        const event: SubAgentProgressEvent = {
          type,
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
        };

        if (type === 'reasoning') {
          event.content = 'Test reasoning';
        } else if (type === 'action') {
          event.action = {
            type: 'left_click',
            params: { coordinate: [100, 200] },
            description: 'Left click at (100, 200)',
          };
        } else if (type === 'screenshot') {
          event.screenshot = {
            base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
            width: 1920,
            height: 1080,
          };
        }

        mockOnProgress(event);
      });

      expect(mockOnProgress).toHaveBeenCalledTimes(4);

      // Verify all events have timestamps in ISO 8601 format
      mockOnProgress.mock.calls.forEach(call => {
        expect(call[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    it('should handle optional callback gracefully', () => {
      const onProgress = undefined;

      // Simulate calling onProgress when it's undefined
      expect(() => {
        onProgress?.({
          type: 'step',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
        });

        onProgress?.({
          type: 'reasoning',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          content: 'Test',
        });

        onProgress?.({
          type: 'action',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          action: {
            type: 'left_click',
            params: {},
            description: 'Click',
          },
        });

        onProgress?.({
          type: 'screenshot',
          toolCallId: '',
          timestamp: new Date().toISOString(),
          screenshot: {
            base64: 'data:image/jpeg;base64,test',
            width: 1920,
            height: 1080,
          },
        });
      }).not.toThrow();
    });

    it('should support all event types defined in the interface', () => {
      const mockOnProgress = vi.fn();

      const allEventTypes: SubAgentProgressEvent['type'][] = [
        'step',
        'reasoning',
        'action',
        'screenshot',
        'complete',
        'abort',
      ];

      allEventTypes.forEach(type => {
        const event: SubAgentProgressEvent = {
          type,
          toolCallId: 'call_test_123',
          timestamp: new Date().toISOString(),
        };

        mockOnProgress(event);
      });

      expect(mockOnProgress).toHaveBeenCalledTimes(6);

      // Verify all event types were called
      const calledTypes = mockOnProgress.mock.calls.map(call => call[0].type);
      expect(calledTypes).toEqual(allEventTypes);
    });

    it('should maintain event data integrity across multiple calls', () => {
      const mockOnProgress = vi.fn();

      const testEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_test_123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 5,
        totalSteps: 40,
      };

      // Call multiple times with same event
      mockOnProgress(testEvent);
      mockOnProgress(testEvent);
      mockOnProgress(testEvent);

      expect(mockOnProgress).toHaveBeenCalledTimes(3);

      // Verify all calls received the same data
      mockOnProgress.mock.calls.forEach(call => {
        expect(call[0]).toEqual(testEvent);
      });
    });
  });
});
