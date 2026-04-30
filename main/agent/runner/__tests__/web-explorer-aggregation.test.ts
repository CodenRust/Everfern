import { describe, expect, it, beforeEach } from 'vitest';
import { EnhancedWebExplorer } from '../agents/web-explorer';
import { getSubagentRegistry } from '../subagent-registry';

describe('EnhancedWebExplorer Result Aggregation', () => {
  let webExplorer: EnhancedWebExplorer;
  let registry: ReturnType<typeof getSubagentRegistry>;

  beforeEach(() => {
    webExplorer = new EnhancedWebExplorer({
      enableSubagentSpawning: true,
      maxConcurrentSubagents: 3,
      subagentTimeout: 2000, // Shorter timeout for tests
    });
    registry = getSubagentRegistry();
  });

  describe('aggregateSubagentResults', () => {
    it('should handle empty subagent list', async () => {
      const parentSessionId = 'parent_web_explorer_empty';
      const subagents: any[] = [];

      const result = await webExplorer.aggregateSubagentResults(parentSessionId, subagents);

      expect(result).toBe('No subagents were spawned.');
    });

    it('should aggregate results from multiple subagents', async () => {
      const parentSessionId = 'parent_web_explorer_1';

      // Register subagents
      registry.register({
        agentId: 'web_agent_1',
        parentSessionId,
        sessionKey: 'session_web_1',
        task: 'Research about AI',
        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'AI is a transformative technology...',
      });

      registry.register({
        agentId: 'web_agent_2',
        parentSessionId,
        sessionKey: 'session_web_2',
        task: 'Research about machine learning',
        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Machine learning enables computers to learn...',
      });

      const subagents = [
        {
          id: 'web_agent_1',
          type: 'navis' as const,
          task: 'Research about AI',
          status: 'completed' as const,
          progressEvents: [],
        },
        {
          id: 'web_agent_2',
          type: 'navis' as const,
          task: 'Research about machine learning',
          status: 'completed' as const,
          progressEvents: [],
        },
      ];

      const result = await webExplorer.aggregateSubagentResults(parentSessionId, subagents);

      expect(result).toBeDefined();
      expect(result).toContain('Comprehensive Research Summary');
    });
  });

  describe('subagent management', () => {
    it('should clear subagents', () => {
      webExplorer.clearSubagents();
      const subagents = webExplorer.getSubagents();
      expect(subagents).toHaveLength(0);
    });
  });
});
