import { describe, expect, it } from 'vitest';
import {
  identityEquals,
  reconcileManagerRuntimeSessionIdentifiers,
} from './manager.identity-reconcile';
import type { SessionAcpMeta } from './manager.types';

describe('ACP Control Plane — manager.identity-reconcile', () => {
  it('identityEquals compares correctly', () => {
    const idA = { agentSessionId: 'a', backendSessionId: 'b' };
    const idB = { agentSessionId: 'a', backendSessionId: 'b' };
    const idC = { agentSessionId: 'x' };

    expect(identityEquals(idA, idB)).toBe(true);
    expect(identityEquals(idA, idC)).toBe(false);
    expect(identityEquals(undefined, undefined)).toBe(true);
    expect(identityEquals(idA, undefined)).toBe(false);
  });

  it('reconcile syncs identities', async () => {
    const meta: SessionAcpMeta = {
      backend: 'local',
      agent: 'test',
      lastActivityAt: Date.now(),
      identity: { agentSessionId: 'a' },
    };

    const { handle, meta: newMeta } = await reconcileManagerRuntimeSessionIdentifiers({
      sessionKey: 's1',
      handle: {},
      meta,
      runtimeStatus: {
        connected: true,
        backendId: 'b1',
        activeSessions: [],
      },
    });

    expect(handle.agentSessionId).toBe('a');
    expect(handle.backendSessionId).toBe('b1');
    expect(newMeta.identity?.agentSessionId).toBe('a');
    expect(newMeta.identity?.backendSessionId).toBe('b1');
  });
});
