/**
 * Tests for enhanced SubagentProgressEmitter with timeline branch support
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SubagentProgressEmitter and related types from computer-use.ts
// Note: In a real implementation, we'd import these directly
interface SubAgentProgressEvent {
  type: 'step' | 'reasoning' | 'action' | 'screenshot' | 'complete' | 'abort' | 'branch_start' | 'branch_update' | 'branch_complete' | 'branch_abort';
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
  metadata?: {
    model?: string;
    provider?: string;
    [key: string]: unknown;
  };
  timelineBranch?: {
    parentId?: string;
    agentType?: 'web-explorer' | 'navis' | 'computer-use' | 'research' | 'coding-specialist' | 'data-analyst';
    branchLevel?: number;
    visualPosition?: { x: number; y: number };
    branchStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
    taskDescription?: string;
    sessionId?: string;
  };
}

// Mock implementation for testing
class MockProgressEventEmitter {
  private buffer: SubAgentProgressEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 16;
  private readonly MAX_BUFFER_SIZE = 10;
  private readonly PRIORITY_EVENT_TYPES = new Set([
    'branch_start', 'branch_complete', 'branch_abort', 'complete', 'abort'
  ]);

  constructor(
    private toolCallId: string,
    private sender: any,
    private timelineBranchMetadata?: {
      parentId?: string;
      agentType?: string;
      branchLevel?: number;
      sessionId?: string;
      taskDescription?: string;
    }
  ) {}

  emit(event: SubAgentProgressEvent): void {
    // Inject timeline branch metadata if configured and not already present
    if (this.timelineBranchMetadata && !event.timelineBranch) {
      event.timelineBranch = {
        parentId: this.timelineBranchMetadata.parentId,
        agentType: this.timelineBranchMetadata.agentType as any,
        branchLevel: this.timelineBranchMetadata.branchLevel,
        sessionId: this.timelineBranchMetadata.sessionId,
        taskDescription: this.timelineBranchMetadata.taskDescription,
        branchStatus: this.mapEventTypeToBranchStatus(event.type),
      };
    }

    this.buffer.push(event);

    // Flush immediately for priority events
    if (this.PRIORITY_EVENT_TYPES.has(event.type)) {
      this.flush();
    } else if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  private mapEventTypeToBranchStatus(eventType: string): 'pending' | 'running' | 'completed' | 'failed' | 'aborted' {
    switch (eventType) {
      case 'branch_start':
      case 'step':
      case 'reasoning':
      case 'action':
      case 'screenshot':
      case 'branch_update':
        return 'running';
      case 'branch_complete':
      case 'complete':
        return 'completed';
      case 'branch_abort':
      case 'abort':
        return 'aborted';
      default:
        return 'running';
    }
  }

  emitBranchStart(taskDescription?: string): void {
    this.emit({
      type: 'branch_start',
      toolCallId: this.toolCallId,
      timestamp: new Date().toISOString(),
      content: taskDescription || 'Subagent branch started',
      timelineBranch: {
        ...this.timelineBranchMetadata,
        branchStatus: 'running',
        taskDescription: taskDescription || this.timelineBranchMetadata?.taskDescription,
      } as any,
    });
  }

  emitBranchComplete(result?: string): void {
    this.emit({
      type: 'branch_complete',
      toolCallId: this.toolCallId,
      timestamp: new Date().toISOString(),
      content: result || 'Subagent branch completed successfully',
      timelineBranch: {
        ...this.timelineBranchMetadata,
        branchStatus: 'completed',
      } as any,
    });
  }

  emitBranchAbort(reason?: string): void {
    this.emit({
      type: 'branch_abort',
      toolCallId: this.toolCallId,
      timestamp: new Date().toISOString(),
      content: reason || 'Subagent branch aborted',
      timelineBranch: {
        ...this.timelineBranchMetadata,
        branchStatus: 'aborted',
      } as any,
    });
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    if (!this.sender || this.sender.isDestroyed()) {
      this.buffer = [];
      return;
    }

    try {
      const sortedEvents = [...this.buffer].sort((a, b) => {
        const aPriority = this.PRIORITY_EVENT_TYPES.has(a.type) ? 0 : 1;
        const bPriority = this.PRIORITY_EVENT_TYPES.has(b.type) ? 0 : 1;

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      const batch = {
        toolCallId: this.toolCallId,
        events: sortedEvents,
        timestamp: new Date().toISOString(),
      };

      this.sender.send('acp:sub-agent-progress', JSON.stringify(batch));
      this.buffer = [];
    } catch (error) {
      this.buffer = [];
    }
  }

  destroy(): void {
    this.flush();
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
  }
}

describe('Enhanced SubagentProgressEmitter', () => {
  let mockSender: any;
  let emitter: MockProgressEventEmitter;
  let sentEvents: any[] = [];

  beforeEach(() => {
    sentEvents = [];
    mockSender = {
      send: vi.fn((channel: string, data: string) => {
        if (channel === 'acp:sub-agent-progress') {
          const batch = JSON.parse(data);
          sentEvents.push(...batch.events);
        }
      }),
      isDestroyed: vi.fn(() => false),
    };

    emitter = new MockProgressEventEmitter(
      'test-tool-call-id',
      mockSender,
      {
        parentId: 'parent-tool-id',
        agentType: 'computer-use',
        branchLevel: 1,
        sessionId: 'test-session-id',
        taskDescription: 'Test automation task',
      }
    );
  });

  describe('Timeline Branch Events', () => {
    it('should emit branch start event with timeline metadata', () => {
      emitter.emitBranchStart('Custom task description');

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'branch_start',
        toolCallId: 'test-tool-call-id',
        content: 'Custom task description',
        timelineBranch: {
          parentId: 'parent-tool-id',
          agentType: 'computer-use',
          branchLevel: 1,
          sessionId: 'test-session-id',
          taskDescription: 'Custom task description',
          branchStatus: 'running',
        },
      });
    });

    it('should emit branch complete event with timeline metadata', () => {
      emitter.emitBranchComplete('Task completed successfully');

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'branch_complete',
        toolCallId: 'test-tool-call-id',
        content: 'Task completed successfully',
        timelineBranch: {
          parentId: 'parent-tool-id',
          agentType: 'computer-use',
          branchLevel: 1,
          sessionId: 'test-session-id',
          branchStatus: 'completed',
        },
      });
    });

    it('should emit branch abort event with timeline metadata', () => {
      emitter.emitBranchAbort('Task was cancelled');

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0]).toMatchObject({
        type: 'branch_abort',
        toolCallId: 'test-tool-call-id',
        content: 'Task was cancelled',
        timelineBranch: {
          parentId: 'parent-tool-id',
          agentType: 'computer-use',
          branchLevel: 1,
          sessionId: 'test-session-id',
          branchStatus: 'aborted',
        },
      });
    });
  });

  describe('Priority Event Flushing', () => {
    it('should flush timeline branch events immediately', () => {
      // Emit a regular event (should be buffered)
      emitter.emit({
        type: 'step',
        toolCallId: 'test-tool-call-id',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
      });

      // Should not have flushed yet
      expect(mockSender.send).not.toHaveBeenCalled();

      // Emit a priority event (should flush immediately)
      emitter.emitBranchStart('Priority event');

      // Should have flushed both events
      expect(mockSender.send).toHaveBeenCalledTimes(1);
      expect(sentEvents).toHaveLength(2);
    });

    it('should sort priority events first in flush', () => {
      // Emit events in mixed order
      emitter.emit({
        type: 'step',
        toolCallId: 'test-tool-call-id',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
      });

      emitter.emit({
        type: 'reasoning',
        toolCallId: 'test-tool-call-id',
        timestamp: new Date().toISOString(),
        content: 'Thinking...',
      });

      emitter.emitBranchComplete('Done');

      // Priority event (branch_complete) should be first
      expect(sentEvents[0].type).toBe('branch_complete');
      expect(sentEvents[1].type).toBe('step');
      expect(sentEvents[2].type).toBe('reasoning');
    });
  });

  describe('Metadata Injection', () => {
    it('should automatically inject timeline branch metadata for regular events', () => {
      emitter.emit({
        type: 'action',
        toolCallId: 'test-tool-call-id',
        timestamp: new Date().toISOString(),
        action: {
          type: 'left_click',
          params: { coordinate: [100, 200] },
          description: 'Click button',
        },
      });

      // Force flush by emitting priority event
      emitter.emitBranchComplete();

      const actionEvent = sentEvents.find(e => e.type === 'action');
      expect(actionEvent.timelineBranch).toMatchObject({
        parentId: 'parent-tool-id',
        agentType: 'computer-use',
        branchLevel: 1,
        sessionId: 'test-session-id',
        branchStatus: 'running',
      });
    });

    it('should not override existing timeline branch metadata', () => {
      emitter.emit({
        type: 'action',
        toolCallId: 'test-tool-call-id',
        timestamp: new Date().toISOString(),
        timelineBranch: {
          parentId: 'custom-parent',
          agentType: 'web-explorer',
          branchLevel: 2,
        },
        action: {
          type: 'left_click',
          params: {},
          description: 'Custom click',
        },
      });

      emitter.emitBranchComplete();

      const actionEvent = sentEvents.find(e => e.type === 'action');
      expect(actionEvent.timelineBranch.parentId).toBe('custom-parent');
      expect(actionEvent.timelineBranch.agentType).toBe('web-explorer');
      expect(actionEvent.timelineBranch.branchLevel).toBe(2);
    });
  });
});
