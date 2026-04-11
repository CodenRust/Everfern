import { describe, expect, it } from 'vitest';
import {
  applyManagerRuntimeControls,
  buildRuntimeControlSignature,
} from './manager.runtime-controls';
import type { SessionAcpMeta } from './manager.types';

describe('ACP Control Plane — manager.runtime-controls', () => {
  it('buildRuntimeControlSignature normalizes options dict', () => {
    const signature = buildRuntimeControlSignature({ zulu: '5', alpha: '1' });
    expect(signature).toBe('alpha=1;zulu=5');
    
    expect(buildRuntimeControlSignature({})).toBe('');
  });

  it('applyManagerRuntimeControls calculates new signature', async () => {
    const meta: SessionAcpMeta = {
      backend: 'local',
      agent: 'test',
      lastActivityAt: Date.now(),
      runtimeOptions: { fastMode: 'true' },
      mode: 'debug',
    };

    const nextSignature = await applyManagerRuntimeControls({
      sessionKey: 's1',
      handle: {},
      meta,
    });

    expect(nextSignature).toBe('fastMode=true');
  });

  it('applyManagerRuntimeControls skips if signature matches', async () => {
    const meta: SessionAcpMeta = {
      backend: 'local',
      agent: 'test',
      lastActivityAt: Date.now(),
      runtimeOptions: { fastMode: 'true' },
    };

    const nextSignature = await applyManagerRuntimeControls({
      sessionKey: 's1',
      handle: {},
      meta,
      cachedSignature: 'fastMode=true',
    });

    expect(nextSignature).toBe('fastMode=true'); // Skipped side-effects, still returns signature
  });
});
