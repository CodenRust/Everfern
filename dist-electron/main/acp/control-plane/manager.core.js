"use strict";
/**
 * EverFern Desktop — ACP Control Plane Core Manager
 *
 * High-level orchestration for EverFern agent sessions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSessionManager = exports.SessionManager = void 0;
const manager_identity_reconcile_1 = require("./manager.identity-reconcile");
const manager_runtime_controls_1 = require("./manager.runtime-controls");
class SessionManager {
    sessions = new Map();
    cache = new Map();
    prepareTurnMutexes = new Map();
    createSession(params) {
        const existing = this.sessions.get(params.sessionId);
        if (existing && existing.status !== 'completed' && existing.status !== 'killed' && existing.status !== 'archived') {
            console.warn(`[ACP/SessionManager] Warning: createSession overwriting active session ${params.sessionId}`);
        }
        const now = Date.now();
        const meta = {
            backend: 'everfern-local',
            agent: params.agentId,
            lastActivityAt: now,
        };
        const record = {
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
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    updateSessionStatus(sessionId, status) {
        const record = this.sessions.get(sessionId);
        if (!record) {
            console.warn(`[ACP/SessionManager] updateSessionStatus: session "${sessionId}" not found`);
            return;
        }
        record.status = status;
        record.updatedAt = Date.now();
    }
    recordTokenUsage(sessionId, tokens) {
        const record = this.sessions.get(sessionId);
        if (!record)
            return;
        record.tokensUsed = (record.tokensUsed ?? 0) + tokens;
        record.updatedAt = Date.now();
    }
    killSession(sessionId) {
        this.updateSessionStatus(sessionId, 'killed');
        console.log(`[ACP/SessionManager] Killed session: ${sessionId}`);
    }
    listSessions(filter) {
        return [...this.sessions.values()].filter((s) => {
            if (filter?.agentId && s.agentId !== filter.agentId)
                return false;
            if (filter?.status && s.status !== filter.status)
                return false;
            return true;
        });
    }
    clearCompletedSessions() {
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
    async prepareTurn(sessionId) {
        const record = this.sessions.get(sessionId);
        if (!record)
            return false;
        // Mutex to prevent race conditions during concurrent parallel-executor turns
        while (this.prepareTurnMutexes.has(sessionId)) {
            await this.prepareTurnMutexes.get(sessionId);
        }
        let releaseMutex;
        const mutexPromise = new Promise(resolve => { releaseMutex = resolve; });
        this.prepareTurnMutexes.set(sessionId, mutexPromise);
        try {
            // 1. Reconcile identity
            const { meta: newMeta } = await (0, manager_identity_reconcile_1.reconcileManagerRuntimeSessionIdentifiers)({
                sessionKey: sessionId,
                handle: { agentSessionId: record.meta.identity?.agentSessionId },
                meta: record.meta,
            });
            record.meta = newMeta;
            // 2. Apply runtime controls (only if signature changed)
            const cached = this.cache.get(sessionId) ?? {};
            const newSignature = await (0, manager_runtime_controls_1.applyManagerRuntimeControls)({
                sessionKey: sessionId,
                handle: { agentSessionId: newMeta.identity?.agentSessionId },
                meta: newMeta,
                cachedSignature: cached.signature,
            });
            this.cache.set(sessionId, { signature: newSignature });
            // Check loop failure and circuit break limits if we had them here...
            return true;
        }
        catch (e) {
            console.error(`[ACP/SessionManager] Turn preparation failed for ${sessionId}:`, e);
            return false;
        }
        finally {
            this.prepareTurnMutexes.delete(sessionId);
            releaseMutex();
        }
    }
}
exports.SessionManager = SessionManager;
// Global default instance to match openclaw's typical stateless global managers bindings
exports.globalSessionManager = new SessionManager();
