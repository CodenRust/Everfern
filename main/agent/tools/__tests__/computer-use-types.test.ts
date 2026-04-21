/**
 * Tests for SubAgentProgressEvent type definitions
 *
 * This test file verifies that the type definitions are correctly structured
 * and can be used for type-safe progress event handling.
 */

import { SubAgentProgressEvent, SubAgentProgressEventType, SubAgentProgressBatch } from '../computer-use';

describe('SubAgentProgressEvent Types', () => {
  describe('SubAgentProgressEventType', () => {
    it('should include all expected event types', () => {
      const eventTypes: SubAgentProgressEventType[] = [
        'step',
        'reasoning',
        'action',
        'screenshot',
        'complete',
        'abort'
      ];

      // This test verifies the type definition exists and is usable
      expect(eventTypes).toHaveLength(6);
      expect(eventTypes).toContain('step');
      expect(eventTypes).toContain('reasoning');
      expect(eventTypes).toContain('action');
      expect(eventTypes).toContain('screenshot');
      expect(eventTypes).toContain('complete');
      expect(eventTypes).toContain('abort');
    });
  });

  describe('SubAgentProgressEvent', () => {
    it('should create a valid step event', () => {
      const stepEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 5,
        totalSteps: 40
      };

      expect(stepEvent.type).toBe('step');
      expect(stepEvent.toolCallId).toBe('call_abc123');
      expect(stepEvent.stepNumber).toBe(5);
      expect(stepEvent.totalSteps).toBe(40);
    });

    it('should create a valid reasoning event', () => {
      const reasoningEvent: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:30:45.456Z',
        stepNumber: 5,
        content: 'I need to click the search button to find the Discord application...'
      };

      expect(reasoningEvent.type).toBe('reasoning');
      expect(reasoningEvent.content).toBeDefined();
      expect(reasoningEvent.content).toContain('Discord');
    });

    it('should create a valid action event', () => {
      const actionEvent: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:30:46.789Z',
        stepNumber: 5,
        action: {
          type: 'left_click',
          params: {
            coordinate: [398, 965]
          },
          description: 'Left click at (398, 965)'
        }
      };

      expect(actionEvent.type).toBe('action');
      expect(actionEvent.action).toBeDefined();
      expect(actionEvent.action?.type).toBe('left_click');
      expect(actionEvent.action?.description).toContain('Left click');
    });

    it('should create a valid screenshot event', () => {
      const screenshotEvent: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:30:47.012Z',
        stepNumber: 5,
        screenshot: {
          base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
          width: 1920,
          height: 1080
        }
      };

      expect(screenshotEvent.type).toBe('screenshot');
      expect(screenshotEvent.screenshot).toBeDefined();
      expect(screenshotEvent.screenshot?.width).toBe(1920);
      expect(screenshotEvent.screenshot?.height).toBe(1080);
    });

    it('should create a valid complete event', () => {
      const completeEvent: SubAgentProgressEvent = {
        type: 'complete',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:31:00.000Z',
        content: 'Task completed successfully'
      };

      expect(completeEvent.type).toBe('complete');
      expect(completeEvent.content).toBeDefined();
    });

    it('should create a valid abort event', () => {
      const abortEvent: SubAgentProgressEvent = {
        type: 'abort',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:30:50.000Z',
        content: 'Aborted by user'
      };

      expect(abortEvent.type).toBe('abort');
      expect(abortEvent.content).toBe('Aborted by user');
    });

    it('should support optional metadata field', () => {
      const eventWithMetadata: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_abc123',
        timestamp: '2024-01-15T10:30:45.123Z',
        stepNumber: 1,
        totalSteps: 40,
        metadata: {
          model: 'qwen3-vl:235b-instruct-cloud',
          provider: 'ollama',
          customField: 'customValue'
        }
      };

      expect(eventWithMetadata.metadata).toBeDefined();
      expect(eventWithMetadata.metadata?.model).toBe('qwen3-vl:235b-instruct-cloud');
      expect(eventWithMetadata.metadata?.provider).toBe('ollama');
    });
  });

  describe('SubAgentProgressBatch', () => {
    it('should create a valid batch of events', () => {
      const batch: SubAgentProgressBatch = {
        toolCallId: 'call_abc123',
        events: [
          {
            type: 'step',
            toolCallId: 'call_abc123',
            timestamp: '2024-01-15T10:30:45.123Z',
            stepNumber: 1,
            totalSteps: 40
          },
          {
            type: 'reasoning',
            toolCallId: 'call_abc123',
            timestamp: '2024-01-15T10:30:45.456Z',
            stepNumber: 1,
            content: 'Analyzing the screen...'
          }
        ],
        timestamp: '2024-01-15T10:30:45.500Z'
      };

      expect(batch.toolCallId).toBe('call_abc123');
      expect(batch.events).toHaveLength(2);
      expect(batch.events[0].type).toBe('step');
      expect(batch.events[1].type).toBe('reasoning');
    });
  });

  describe('Type Safety', () => {
    it('should enforce required fields', () => {
      // This test verifies TypeScript compilation enforces required fields
      const minimalEvent: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'call_123',
        timestamp: '2024-01-15T10:30:45.123Z'
      };

      expect(minimalEvent.type).toBe('step');
      expect(minimalEvent.toolCallId).toBe('call_123');
      expect(minimalEvent.timestamp).toBeDefined();
    });

    it('should allow optional fields to be omitted', () => {
      const eventWithoutOptionals: SubAgentProgressEvent = {
        type: 'complete',
        toolCallId: 'call_123',
        timestamp: '2024-01-15T10:30:45.123Z'
      };

      expect(eventWithoutOptionals.stepNumber).toBeUndefined();
      expect(eventWithoutOptionals.totalSteps).toBeUndefined();
      expect(eventWithoutOptionals.content).toBeUndefined();
      expect(eventWithoutOptionals.action).toBeUndefined();
      expect(eventWithoutOptionals.screenshot).toBeUndefined();
      expect(eventWithoutOptionals.metadata).toBeUndefined();
    });
  });
});
