import { describe, it, expect, vi } from 'vitest';
import { createValidationNode } from '../validation';

describe('ValidationNode', () => {
  it('should flag write and bash as high risk', async () => {
    const runner = { telemetry: { transition: vi.fn() } } as any;
    const node = createValidationNode(runner);
    
    const state = {
      pendingToolCalls: [{ name: 'write', arguments: {} }]
    } as any;
    
    const result = await node(state);
    expect(result.validationResult?.isHighRisk).toBe(true);
  });

  it('should flag safe operations as low risk', async () => {
    const runner = { telemetry: { transition: vi.fn() } } as any;
    const node = createValidationNode(runner);
    
    const state = {
      pendingToolCalls: [{ name: 'read_file', arguments: {} }]
    } as any;
    
    const result = await node(state);
    expect(result.validationResult?.isHighRisk).toBe(false);
  });
});
