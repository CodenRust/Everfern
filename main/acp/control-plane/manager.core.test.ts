import { describe, expect, it } from 'vitest';
import { SessionManager } from './manager.core';

describe('ACP Control Plane — manager.core', () => {
  it('should create and retrieve a session', () => {
    const manager = new SessionManager();
    const session = manager.createSession({
      sessionId: 'session-123',
      agentId: 'agent-xy',
    });

    expect(session.status).toBe('idle');
    expect(session.sessionId).toBe('session-123');
    expect(session.agentId).toBe('agent-xy');

    const retrieved = manager.getSession('session-123');
    expect(retrieved).toBe(session);
  });

  it('should track token usage', () => {
    const manager = new SessionManager();
    manager.createSession({ sessionId: 'session-tok', agentId: 'ag-1' });
    manager.recordTokenUsage('session-tok', 500);
    manager.recordTokenUsage('session-tok', 1500);

    const session = manager.getSession('session-tok');
    expect(session?.tokensUsed).toBe(2000);
  });

  it('should list sessions by status', () => {
    const manager = new SessionManager();
    manager.createSession({ sessionId: 's1', agentId: 'ag-A' });
    manager.createSession({ sessionId: 's2', agentId: 'ag-A' });
    manager.updateSessionStatus('s2', 'completed');

    const completed = manager.listSessions({ status: 'completed' });
    expect(completed.length).toBe(1);
    expect(completed[0].sessionId).toBe('s2');
  });

  it('should kill and clear sessions', () => {
    const manager = new SessionManager();
    manager.createSession({ sessionId: 's-kill', agentId: 'ag' });
    manager.killSession('s-kill');

    expect(manager.getSession('s-kill')?.status).toBe('killed');
    const cleared = manager.clearCompletedSessions();
    expect(cleared).toBe(1);
    expect(manager.getSession('s-kill')).toBeUndefined();
  });
});
