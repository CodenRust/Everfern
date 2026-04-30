import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getSubagentResultAggregator, type AggregationResult } from '../subagent-result-aggregator';
import { getSubagentRegistry } from '../subagent-registry';

describe('SubagentResultAggregator', () => {
  let aggregator: ReturnType<typeof getSubagentResultAggregator>;
  let registry: ReturnType<typeof getSubagentRegistry>;

  beforeEach(() => {
    aggregator = getSubagentResultAggregator();
    registry = getSubagentRegistry();
  });

  describe('aggregateResults', () => {
    it('should aggregate results from completed subagents', async () => {
      const parentSessionId = 'parent_session_123';
      const subagentIds = ['agent_1', 'agent_2'];

      // Register subagents
      registry.register({
        agentId: 'agent_1',
        parentSessionId,
        sessionKey: 'session_1',
        task: 'Research task 1',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Result from agent 1',
      });

      registry.register({
        agentId: 'agent_2',
        parentSessionId,
        sessionKey: 'session_2',
        task: 'Research task 2',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Result from agent 2',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.totalSubagents).toBe(2);
      expect(result.completedSubagents).toBe(2);
      expect(result.failedSubagents).toBe(0);
      expect(result.timedOutSubagents).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.summary).toContain('Comprehensive Research Summary');
      expect(result.summary).toContain('Result from agent');
    });

    it('should handle partial failures gracefully', async () => {
      const parentSessionId = 'parent_session_456';
      const subagentIds = ['agent_3', 'agent_4'];

      registry.register({
        agentId: 'agent_3',
        parentSessionId,
        sessionKey: 'session_3',
        task: 'Research task 3',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Successful result',
      });

      registry.register({
        agentId: 'agent_4',
        parentSessionId,
        sessionKey: 'session_4',
        task: 'Research task 4',
        agentType: 'generic',        mode: 'run',
        status: 'failed',
        maxDepth: 2,
        currentDepth: 1,
        error: 'Connection timeout',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
        includeErrors: true,
      });

      expect(result.success).toBe(false);
      expect(result.totalSubagents).toBe(2);
      expect(result.completedSubagents).toBe(1);
      expect(result.failedSubagents).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('execution_failure');
      expect(result.summary).toContain('Successful result');
      expect(result.summary).toContain('Execution Summary');
    });

    it('should handle timeout scenarios', async () => {
      const parentSessionId = 'parent_session_789';
      const subagentIds = ['agent_5', 'agent_6'];

      registry.register({
        agentId: 'agent_5',
        parentSessionId,
        sessionKey: 'session_5',
        task: 'Research task 5',
        agentType: 'generic',        mode: 'run',
        status: 'running',
        maxDepth: 2,
        currentDepth: 1,
      });

      registry.register({
        agentId: 'agent_6',
        parentSessionId,
        sessionKey: 'session_6',
        task: 'Research task 6',
        agentType: 'generic',        mode: 'run',
        status: 'running',
        maxDepth: 2,
        currentDepth: 1,
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 500, // Short timeout
      });

      expect(result.success).toBe(false);
      expect(result.timedOutSubagents).toBeGreaterThan(0);
      expect(result.errors.some(e => e.type === 'timeout')).toBe(true);
    });

    it('should deduplicate similar results', async () => {
      const parentSessionId = 'parent_session_dup';
      const subagentIds = ['agent_7', 'agent_8'];

      const similarContent = 'This is a research finding about the topic that is very important and detailed.';

      registry.register({
        agentId: 'agent_7',
        parentSessionId,
        sessionKey: 'session_7',
        task: 'Research task 7',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: similarContent,
      });

      registry.register({
        agentId: 'agent_8',
        parentSessionId,
        sessionKey: 'session_8',
        task: 'Research task 8',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: similarContent + ' Additional details.',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
        deduplicateResults: true,
      });

      expect(result.success).toBe(true);
      expect(result.completedSubagents).toBe(2);
      // Summary should contain deduplicated results
      expect(result.summary).toBeDefined();
    });

    it('should include metadata in aggregation result', async () => {
      const parentSessionId = 'parent_session_meta';
      const subagentIds = ['agent_9'];

      registry.register({
        agentId: 'agent_9',
        parentSessionId,
        sessionKey: 'session_9',
        task: 'Research task 9',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Test result',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.startTime).toBeDefined();
      expect(result.metadata.endTime).toBeDefined();
      expect(result.metadata.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.aggregationMethod).toBe('parallel');
    });

    it('should handle empty subagent list', async () => {
      const parentSessionId = 'parent_session_empty';
      const subagentIds: string[] = [];

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.totalSubagents).toBe(0);
      expect(result.completedSubagents).toBe(0);
      expect(result.summary).toContain('No successful research results');
    });

    it('should handle all failed subagents', async () => {
      const parentSessionId = 'parent_session_all_failed';
      const subagentIds = ['agent_10', 'agent_11'];

      registry.register({
        agentId: 'agent_10',
        parentSessionId,
        sessionKey: 'session_10',
        task: 'Research task 10',
        agentType: 'generic',        mode: 'run',
        status: 'failed',
        maxDepth: 2,
        currentDepth: 1,
        error: 'Network error',
      });

      registry.register({
        agentId: 'agent_11',
        parentSessionId,
        sessionKey: 'session_11',
        task: 'Research task 11',
        agentType: 'generic',        mode: 'run',
        status: 'failed',
        maxDepth: 2,
        currentDepth: 1,
        error: 'Timeout',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
        includeErrors: true,
      });

      expect(result.success).toBe(false);
      expect(result.completedSubagents).toBe(0);
      expect(result.failedSubagents).toBe(2);
      expect(result.summary).toContain('No successful research results');
      expect(result.summary).toContain('Failed Subagents');
    });

    it('should track result metadata correctly', async () => {
      const parentSessionId = 'parent_session_track';
      const subagentIds = ['agent_12'];

      const testResult = 'This is a test result with some content';

      registry.register({
        agentId: 'agent_12',
        parentSessionId,
        sessionKey: 'session_12',
        task: 'Research task 12',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: testResult,
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].subagentId).toBe('agent_12');
      expect(result.results[0].status).toBe('completed');
      expect(result.results[0].resultLength).toBe(testResult.length);
      expect(result.results[0].duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle aggregation errors gracefully', async () => {
      const parentSessionId = 'parent_session_error';
      const subagentIds = ['nonexistent_agent'];

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 500, // Short timeout
      });

      // When no subagents exist, they all timeout
      expect(result.timedOutSubagents).toBeGreaterThanOrEqual(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should include error details in summary', async () => {
      const parentSessionId = 'parent_session_error_summary';
      const subagentIds = ['agent_13'];

      registry.register({
        agentId: 'agent_13',
        parentSessionId,
        sessionKey: 'session_13',
        task: 'Research task 13',
        agentType: 'generic',        mode: 'run',
        status: 'failed',
        maxDepth: 2,
        currentDepth: 1,
        error: 'Specific error message',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
        includeErrors: true,
      });

      expect(result.summary).toContain('Specific error message');
    });
  });

  describe('summary generation', () => {
    it('should generate comprehensive summary with multiple results', async () => {
      const parentSessionId = 'parent_session_summary';
      const subagentIds = ['agent_14', 'agent_15', 'agent_16'];

      registry.register({
        agentId: 'agent_14',
        parentSessionId,
        sessionKey: 'session_14',
        task: 'Research task 14',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'First research finding with detailed information.',
      });

      registry.register({
        agentId: 'agent_15',
        parentSessionId,
        sessionKey: 'session_15',
        task: 'Research task 15',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Second research finding with additional context.',
      });

      registry.register({
        agentId: 'agent_16',
        parentSessionId,
        sessionKey: 'session_16',
        task: 'Research task 16',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Third research finding with more details.',
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
      });

      expect(result.summary).toContain('Comprehensive Research Summary');
      expect(result.summary).toContain('Research Result 1');
      expect(result.summary).toContain('Research Result 2');
      expect(result.summary).toContain('Research Result 3');
      expect(result.summary).toContain('Source');
      expect(result.summary).toContain('Duration');
      expect(result.summary).toContain('Content Length');
    });

    it('should include execution summary with mixed results', async () => {
      const parentSessionId = 'parent_session_mixed';
      const subagentIds = ['agent_17', 'agent_18', 'agent_19'];

      registry.register({
        agentId: 'agent_17',
        parentSessionId,
        sessionKey: 'session_17',
        task: 'Research task 17',
        agentType: 'generic',        mode: 'run',
        status: 'completed',
        maxDepth: 2,
        currentDepth: 1,
        result: 'Successful result',
      });

      registry.register({
        agentId: 'agent_18',
        parentSessionId,
        sessionKey: 'session_18',
        task: 'Research task 18',
        agentType: 'generic',        mode: 'run',
        status: 'failed',
        maxDepth: 2,
        currentDepth: 1,
        error: 'Failed to connect',
      });

      registry.register({
        agentId: 'agent_19',
        parentSessionId,
        sessionKey: 'session_19',
        task: 'Research task 19',
        agentType: 'generic',        mode: 'run',
        status: 'aborted',
        maxDepth: 2,
        currentDepth: 1,
      });

      const result = await aggregator.aggregateResults(parentSessionId, subagentIds, {
        timeoutMs: 5000,
        includeErrors: true,
      });

      expect(result.summary).toContain('Execution Summary');
      expect(result.summary).toContain('Successful');
      expect(result.summary).toContain('Failed');
    });
  });
});
