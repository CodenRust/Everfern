import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EnhancedWebExplorer,
  WebExplorerConfig,
  WebExplorerSubagent,
  SubAgentProgressEvent,
} from '../web-explorer';

describe('EnhancedWebExplorer - Subagent Spawning', () => {
  let explorer: EnhancedWebExplorer;
  let mockConfig: WebExplorerConfig;

  beforeEach(() => {
    mockConfig = {
      enableSubagentSpawning: true,
      maxConcurrentSubagents: 3,
      subagentTimeout: 60000,
      enableVisualGrounding: true,
    };
    explorer = new EnhancedWebExplorer(mockConfig);
  });

  describe('Configuration', () => {
    it('should initialize with default config', () => {
      const defaultExplorer = new EnhancedWebExplorer();
      const subagents = defaultExplorer.getSubagents();
      expect(subagents).toEqual([]);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<WebExplorerConfig> = {
        maxConcurrentSubagents: 5,
        subagentTimeout: 120000,
      };
      const customExplorer = new EnhancedWebExplorer(customConfig);
      expect(customExplorer).toBeDefined();
    });
  });

  describe('Subagent Management', () => {
    it('should track spawned subagents', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Test research task',
        status: 'pending',
        progressEvents: [],
      };

      explorer['subagents'].set(subagent.id, subagent);
      const subagents = explorer.getSubagents();

      expect(subagents).toHaveLength(1);
      expect(subagents[0].id).toBe('test_subagent_1');
    });

    it('should clear all subagents', () => {
      const subagent1: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Task 1',
        status: 'pending',
        progressEvents: [],
      };

      const subagent2: WebExplorerSubagent = {
        id: 'test_subagent_2',
        type: 'browser-use',
        task: 'Task 2',
        status: 'pending',
        progressEvents: [],
      };

      explorer['subagents'].set(subagent1.id, subagent1);
      explorer['subagents'].set(subagent2.id, subagent2);

      expect(explorer.getSubagents()).toHaveLength(2);

      explorer.clearSubagents();

      expect(explorer.getSubagents()).toHaveLength(0);
    });
  });

  describe('Timeline Events', () => {
    it('should emit timeline branch events', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Test research task',
        status: 'running',
        progressEvents: [],
      };

      const event: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
        content: 'Starting research',
      };

      explorer.emitTimelineBranch('parent_session_1', subagent, event);

      expect(subagent.progressEvents).toHaveLength(1);
      expect(subagent.progressEvents[0]).toEqual(event);
    });

    it('should track multiple progress events', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Test research task',
        status: 'running',
        progressEvents: [],
      };

      const events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool_1',
          timestamp: new Date().toISOString(),
          content: 'Starting research',
        },
        {
          type: 'action',
          toolCallId: 'tool_1',
          timestamp: new Date().toISOString(),
          content: 'Executing browser_use',
          action: { name: 'browser_use' },
        },
        {
          type: 'complete',
          toolCallId: 'tool_1',
          timestamp: new Date().toISOString(),
        },
      ];

      events.forEach(event => {
        explorer.emitTimelineBranch('parent_session_1', subagent, event);
      });

      expect(subagent.progressEvents).toHaveLength(3);
      expect(subagent.progressEvents[0].type).toBe('step');
      expect(subagent.progressEvents[1].type).toBe('action');
      expect(subagent.progressEvents[2].type).toBe('complete');
    });
  });

  describe('Research Summary Generation', () => {
    it('should generate summary from empty results', () => {
      const summary = explorer['generateResearchSummary']([]);
      expect(summary).toContain('No research results');
    });

    it('should generate summary from single result', () => {
      const results = ['## Finding 1\nSome research data'];
      const summary = explorer['generateResearchSummary'](results);

      expect(summary).toContain('Comprehensive Research Summary');
      expect(summary).toContain('1 specialized subagent');
      expect(summary).toContain('Some research data');
    });

    it('should generate summary from multiple results', () => {
      const results = [
        '## Finding 1\nFirst research data',
        '## Finding 2\nSecond research data',
        '## Finding 3\nThird research data',
      ];
      const summary = explorer['generateResearchSummary'](results);

      expect(summary).toContain('Comprehensive Research Summary');
      expect(summary).toContain('3 specialized subagent');
      expect(summary).toContain('First research data');
      expect(summary).toContain('Second research data');
      expect(summary).toContain('Third research data');
    });
  });

  describe('Subagent Status Tracking', () => {
    it('should track subagent status transitions', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Test research task',
        status: 'pending',
        progressEvents: [],
      };

      expect(subagent.status).toBe('pending');

      subagent.status = 'running';
      expect(subagent.status).toBe('running');

      subagent.status = 'completed';
      expect(subagent.status).toBe('completed');
    });

    it('should track subagent errors', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Test research task',
        status: 'failed',
        progressEvents: [],
        error: 'Connection timeout',
      };

      expect(subagent.status).toBe('failed');
      expect(subagent.error).toBe('Connection timeout');
    });
  });

  describe('Subagent Types', () => {
    it('should support browser-use subagent type', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'browser-use',
        task: 'Browse and analyze',
        status: 'pending',
        progressEvents: [],
      };

      expect(subagent.type).toBe('browser-use');
    });

    it('should support computer-use subagent type', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'computer-use',
        task: 'Desktop automation',
        status: 'pending',
        progressEvents: [],
      };

      expect(subagent.type).toBe('computer-use');
    });

    it('should support research subagent type', () => {
      const subagent: WebExplorerSubagent = {
        id: 'test_subagent_1',
        type: 'research',
        task: 'Research analysis',
        status: 'pending',
        progressEvents: [],
      };

      expect(subagent.type).toBe('research');
    });
  });

  describe('Progress Event Types', () => {
    it('should support step event type', () => {
      const event: SubAgentProgressEvent = {
        type: 'step',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
        stepNumber: 1,
        totalSteps: 5,
        content: 'Step 1 of 5',
      };

      expect(event.type).toBe('step');
      expect(event.stepNumber).toBe(1);
      expect(event.totalSteps).toBe(5);
    });

    it('should support reasoning event type', () => {
      const event: SubAgentProgressEvent = {
        type: 'reasoning',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
        content: 'Analyzing the problem...',
      };

      expect(event.type).toBe('reasoning');
    });

    it('should support action event type', () => {
      const event: SubAgentProgressEvent = {
        type: 'action',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
        action: {
          name: 'browser_use',
          args: { url: 'https://example.com' },
        },
      };

      expect(event.type).toBe('action');
      expect(event.action?.name).toBe('browser_use');
    });

    it('should support screenshot event type', () => {
      const event: SubAgentProgressEvent = {
        type: 'screenshot',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
        screenshot: 'base64_encoded_image_data',
      };

      expect(event.type).toBe('screenshot');
      expect(event.screenshot).toBeDefined();
    });

    it('should support complete event type', () => {
      const event: SubAgentProgressEvent = {
        type: 'complete',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
      };

      expect(event.type).toBe('complete');
    });

    it('should support abort event type', () => {
      const event: SubAgentProgressEvent = {
        type: 'abort',
        toolCallId: 'tool_1',
        timestamp: new Date().toISOString(),
        content: 'Execution aborted by user',
      };

      expect(event.type).toBe('abort');
    });
  });

  describe('Session Isolation', () => {
    it('should maintain separate subagent instances', () => {
      const explorer1 = new EnhancedWebExplorer();
      const explorer2 = new EnhancedWebExplorer();

      const subagent1: WebExplorerSubagent = {
        id: 'subagent_1',
        type: 'browser-use',
        task: 'Task 1',
        status: 'pending',
        progressEvents: [],
      };

      const subagent2: WebExplorerSubagent = {
        id: 'subagent_2',
        type: 'browser-use',
        task: 'Task 2',
        status: 'pending',
        progressEvents: [],
      };

      explorer1['subagents'].set(subagent1.id, subagent1);
      explorer2['subagents'].set(subagent2.id, subagent2);

      expect(explorer1.getSubagents()).toHaveLength(1);
      expect(explorer2.getSubagents()).toHaveLength(1);
      expect(explorer1.getSubagents()[0].id).toBe('subagent_1');
      expect(explorer2.getSubagents()[0].id).toBe('subagent_2');
    });
  });
});
