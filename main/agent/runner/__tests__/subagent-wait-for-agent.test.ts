/**
 * Tests for waitForAgent — targeted single-agent status polling.
 * Replaces the broken waitForCompletion that checked ALL children of a parent session.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getSubagentRegistry, generateAgentId } from '../subagent-registry';
import { SubagentSpawner, AGENT_TIMEOUTS } from '../subagent-spawn';

describe('waitForAgent', () => {
  let spawner: SubagentSpawner;
  let registry: ReturnType<typeof getSubagentRegistry>;

  beforeEach(() => {
    spawner = new SubagentSpawner();
    registry = getSubagentRegistry();
  });

  afterEach(() => {
    // Clean up any entries created during tests
    registry.cleanup();
  });

  it('should return immediately for already-completed agent', async () => {
    const agentId = generateAgentId();
    registry.register({
      agentId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${agentId}:test`,
      task: 'test task',
      agentType: 'generic',
      mode: 'run',
      status: 'completed',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
      result: 'done',
    });

    const entry = await spawner.waitForAgent(agentId, 5000);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('completed');
    expect(entry?.result).toBe('done');
  });

  it('should return immediately for already-failed agent', async () => {
    const agentId = generateAgentId();
    registry.register({
      agentId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${agentId}:test`,
      task: 'test task',
      agentType: 'generic',
      mode: 'run',
      status: 'failed',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
      error: 'something broke',
    });

    const entry = await spawner.waitForAgent(agentId, 5000);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('failed');
    expect(entry?.error).toBe('something broke');
  });

  it('should wait until agent completes', async () => {
    const agentId = generateAgentId();
    registry.register({
      agentId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${agentId}:test`,
      task: 'test task',
      agentType: 'generic',
      mode: 'run',
      status: 'running',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
    });

    // Complete the agent after a short delay
    setTimeout(() => {
      registry.complete(agentId, 'success result');
    }, 200);

    const entry = await spawner.waitForAgent(agentId, 5000);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('completed');
    expect(entry?.result).toBe('success result');
  });

  it('should throw on timeout if agent stays running', async () => {
    const agentId = generateAgentId();
    registry.register({
      agentId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${agentId}:test`,
      task: 'test task',
      agentType: 'generic',
      mode: 'run',
      status: 'running',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
    });

    await expect(spawner.waitForAgent(agentId, 300))
      .rejects
      .toThrow(/Timeout waiting for agent/);
  }, 5000);

  it('should ignore other running agents and only wait for the target', async () => {
    const targetId = generateAgentId();
    const otherId = generateAgentId();

    // Register another agent that stays running — should NOT block waitForAgent
    registry.register({
      agentId: otherId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${otherId}:test`,
      task: 'other task',
      agentType: 'generic',
      mode: 'run',
      status: 'running',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
    });

    // Register target agent that will complete
    registry.register({
      agentId: targetId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${targetId}:test`,
      task: 'target task',
      agentType: 'generic',
      mode: 'run',
      status: 'running',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
    });

    setTimeout(() => {
      registry.complete(targetId, 'target result');
    }, 200);

    const entry = await spawner.waitForAgent(targetId, 5000);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('completed');
    expect(entry?.result).toBe('target result');
  });

  it('should handle aborted status', async () => {
    const agentId = generateAgentId();
    registry.register({
      agentId,
      parentSessionId: 'test-parent',
      sessionKey: `agent:${agentId}:test`,
      task: 'test task',
      agentType: 'generic',
      mode: 'run',
      status: 'running',
      workspaceDir: undefined,
      maxDepth: 1,
      currentDepth: 1,
    });

    setTimeout(() => {
      registry.abort(agentId);
    }, 150);

    const entry = await spawner.waitForAgent(agentId, 5000);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('aborted');
  });
});
