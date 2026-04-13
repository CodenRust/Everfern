"use strict";
/**
 * EverFern Desktop — ACP Control Plane Identity Reconciliation
 *
 * Simulates synchronizing a local agent session's identity with the
 * backend ACP runtime's actual connection handles. Adapted from OpenClaw.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityEquals = identityEquals;
exports.resolveSessionIdentityFromMeta = resolveSessionIdentityFromMeta;
exports.reconcileManagerRuntimeSessionIdentifiers = reconcileManagerRuntimeSessionIdentifiers;
function identityEquals(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    return (a.agentSessionId === b.agentSessionId &&
        a.backendSessionId === b.backendSessionId);
}
function resolveSessionIdentityFromMeta(meta) {
    return meta.identity;
}
/**
 * Reconciles the local session meta with the remote runtime handle,
 * returning updated identity meta if things have shifted unexpectedly.
 */
async function reconcileManagerRuntimeSessionIdentifiers(params) {
    const currentIdentity = resolveSessionIdentityFromMeta(params.meta);
    // Derive next identity
    const nextIdentity = {
        agentSessionId: params.handle.agentSessionId || currentIdentity?.agentSessionId || params.sessionKey,
        backendSessionId: params.runtimeStatus?.backendId || params.handle.backendSessionId || currentIdentity?.backendSessionId,
    };
    const nextHandle = {
        ...params.handle,
        agentSessionId: nextIdentity.agentSessionId,
        backendSessionId: nextIdentity.backendSessionId,
    };
    if (!identityEquals(currentIdentity, nextIdentity)) {
        console.log(`[ACP/ControlPlane] Identity updated for ${params.sessionKey} ` +
            `(${currentIdentity?.agentSessionId} -> ${nextIdentity.agentSessionId})`);
    }
    const nextMeta = {
        ...params.meta,
        identity: nextIdentity,
        lastActivityAt: Date.now(),
    };
    return {
        handle: nextHandle,
        meta: nextMeta,
    };
}
