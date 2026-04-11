/**
 * EverFern Desktop — ACP Control Plane Identity Reconciliation
 *
 * Simulates synchronizing a local agent session's identity with the
 * backend ACP runtime's actual connection handles. Adapted from OpenClaw.
 */

import type { SessionAcpMeta, AgentIdentity } from './manager.types';

export interface AcpRuntimeStatus {
  connected: boolean;
  backendId: string;
  activeSessions: string[];
}

export interface AcpRuntimeHandle {
  agentSessionId?: string;
  backendSessionId?: string;
}

export function identityEquals(a?: AgentIdentity, b?: AgentIdentity): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.agentSessionId === b.agentSessionId &&
    a.backendSessionId === b.backendSessionId
  );
}

export function resolveSessionIdentityFromMeta(meta: SessionAcpMeta): AgentIdentity | undefined {
  return meta.identity;
}

/**
 * Reconciles the local session meta with the remote runtime handle,
 * returning updated identity meta if things have shifted unexpectedly.
 */
export async function reconcileManagerRuntimeSessionIdentifiers(params: {
  sessionKey: string;
  handle: AcpRuntimeHandle;
  meta: SessionAcpMeta;
  runtimeStatus?: AcpRuntimeStatus;
}): Promise<{
  handle: AcpRuntimeHandle;
  meta: SessionAcpMeta;
}> {
  const currentIdentity = resolveSessionIdentityFromMeta(params.meta);

  // Derive next identity
  const nextIdentity: AgentIdentity = {
    agentSessionId: params.handle.agentSessionId || currentIdentity?.agentSessionId || params.sessionKey,
    backendSessionId: params.runtimeStatus?.backendId || params.handle.backendSessionId || currentIdentity?.backendSessionId,
  };

  const nextHandle: AcpRuntimeHandle = {
    ...params.handle,
    agentSessionId: nextIdentity.agentSessionId,
    backendSessionId: nextIdentity.backendSessionId,
  };

  if (!identityEquals(currentIdentity, nextIdentity)) {
    console.log(`[ACP/ControlPlane] Identity updated for ${params.sessionKey} ` +
      `(${currentIdentity?.agentSessionId} -> ${nextIdentity.agentSessionId})`);
  }

  const nextMeta: SessionAcpMeta = {
    ...params.meta,
    identity: nextIdentity,
    lastActivityAt: Date.now(),
  };

  return {
    handle: nextHandle,
    meta: nextMeta,
  };
}
