/**
 * EverFern Desktop — ACP Control Plane Core Manager
 *
 * High-level orchestration for EverFern agent sessions.
 */

import type { SessionRecord, SessionStatus, SessionAcpMeta } from './manager.types';
import { reconcileManagerRuntimeSessionIdentifiers } from './manager.identity-reconcile';
import { applyManagerRuntimeControls } from './manager.runtime-controls';

export class SessionManager {
  private sessions = new Map<string, SessionRecord>();
  private cache = new Map<string, { signature?: string }>();
  private sessionLocks = new Map<string, Promise<void>>();

  private async runWithLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const currentLock = this.sessionLocks.get(sessionId) || Promise.resolve();
    
    let release!: () => void;
    const nextLock = new Promise<void>((resolve) => { release = resolve; });
    
    // Chain the lock to ensure operations are processed sequentially for the session
    const lockPromise = currentLock.then(() => nextLock, () => nextLock);
    this.sessionLocks.set(sessionId, lockPromise);

    try {
      await currentLock;
      return await fn();
    } finally {
      release();
      // Cleanup the lock from the map only if no other operations have queued up behind us
      if (this.sessionLocks.get(sessionId) === lockPromise) {
        this.sessionLocks.delete(sessionId);
      }
    }
  }

  createSession(params: {
    sessionId: string;
    agentId: string;
    parentSessionId?: string;
  }): SessionRecord {
    const existing = this.sessions.get(params.sessionId);
    if (existing && existing.status !== 'completed' && existing.status !== 'killed' && existing.status !== 'archived') {
      throw new Error(`[ACP/SessionManager] Cannot overwrite active session: ${params.sessionId}`);
    }

    const now = Date.now();
    const meta: SessionAcpMeta = {
      backend: 'everfern-local',
      agent: params.agentId,
      lastActivityAt: now,
    };

    const record: SessionRecord = {
      sessionId: params.sessionId,
      agentId: params.agentId,
      status: 'idle',
      createdAt: now,
      updatedAt: now,
      tokensUsed: 0,
      parentSessionId: params.parentSessionId,
      meta,
    };
    this.sessions.set(params.sessionId, record);
    console.log(`[ACP/SessionManager] Created session: ${params.sessionId} (agent: ${params.agentId})`);
    return record;
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): void {
    const record = this.sessions.get(sessionId);
    if (!record) {
      console.warn(`[ACP/SessionManager] updateSessionStatus: session "${sessionId}" not found`);
      return;
    }
    record.status = status;
    record.updatedAt = Date.now();
  }

  recordTokenUsage(sessionId: string, tokens: number): void {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    record.tokensUsed = (record.tokensUsed ?? 0) + tokens;
    record.updatedAt = Date.now();
  }

  killSession(sessionId: string): void {
    this.updateSessionStatus(sessionId, 'killed');
    console.log(`[ACP/SessionManager] Killed session: ${sessionId}`);
  }

  listSessions(filter?: { agentId?: string; status?: SessionStatus }): SessionRecord[] {
    return [...this.sessions.values()].filter((s) => {
      if (filter?.agentId && s.agentId !== filter.agentId) return false;
      if (filter?.status && s.status !== filter.status) return false;
      return true;
    });
  }

  clearCompletedSessions(): number {
    let cleared = 0;
    for (const [id, record] of this.sessions) {
      if (record.status === 'completed' || record.status === 'killed') {
        record.status = 'archived';
        // Delete from execution cache but keep the record in memory for history
        this.cache.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Prepares a session for execution by reconciling its remote identity
   * and applying config/mode before throwing work at the agent.
   */
  async prepareTurn(sessionId: string): Promise<boolean> {
    return this.runWithLock(sessionId, async () => {
      const record = this.sessions.get(sessionId);
      if (!record) return false;

      try {
        // 1. Reconcile identity (async but non-blocking for other sessions)
        const identityPromise = reconcileManagerRuntimeSessionIdentifiers({
          sessionKey: sessionId,
          handle: { agentSessionId: record.meta.identity?.agentSessionId },
          meta: record.meta,
        });

        // 2. Get cached signature while identity reconciliation is running
        const cached = this.cache.get(sessionId) ?? {};
        
        // Wait for identity reconciliation to complete
        const { meta: newMeta } = await identityPromise;
        record.meta = newMeta;

        // 3. Apply runtime controls (only if signature changed)
        const newSignature = await applyManagerRuntimeControls({
          sessionKey: sessionId,
          handle: { agentSessionId: newMeta.identity?.agentSessionId },
          meta: newMeta,
          cachedSignature: cached.signature,
        });
        
        this.cache.set(sessionId, { signature: newSignature });

        // Check loop failure and circuit break limits if we had them here...
        return true;
      } catch (e) {
        console.error(`[ACP/SessionManager] Turn preparation failed for ${sessionId}:`, e);
        throw e;
      }
    });
  }
}

// Global default instance to match openclaw's typical stateless global managers bindings
export const globalSessionManager = new SessionManager();
