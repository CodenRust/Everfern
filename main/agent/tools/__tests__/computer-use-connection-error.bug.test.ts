/**
 * Bug Condition Exploration Test — Computer Use Connection Error Handling
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Connection Error Count Never Incremented
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when it fails.
 *
 * Expected counterexamples (unfixed code):
 *   - Agent runs all 40 steps despite consecutive connection errors
 *   - Final answer is "Sub-agent task completed" with no mention of connection issues
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  screen: {
    getAllDisplays: vi.fn(() => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]),
    getPrimaryDisplay: vi.fn(() => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } })),
  },
}));

vi.mock('@jitsi/robotjs', () => ({
  moveMouse: vi.fn(),
  mouseClick: vi.fn(),
  typeString: vi.fn(),
  keyTap: vi.fn(),
  setMouseDelay: vi.fn(),
  getMousePos: vi.fn(() => ({ x: 0, y: 0 })),
}));

vi.mock('screenshot-desktop', () => {
  const fn: any = vi.fn().mockResolvedValue(Buffer.from('fake-screenshot'));
  fn.listDisplays = vi.fn().mockResolvedValue([{ id: 0, name: 'Display 1' }]);
  return { default: fn };
});

vi.mock('sharp', () => {
  const sharpMock: any = vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    extract: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  });
  return { default: sharpMock };
});

vi.mock('worker_threads', () => {
  const WorkerMock = vi.fn().mockImplementation((_scriptPath: string, _options: any) => {
    const workerInstance = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'message') {
          setImmediate(() => handler({
            success: true,
            data: { encoded: 'ZmFrZS1zY3JlZW5zaG90', width: 1920, height: 1080, newW: 1280, newH: 720 },
          }));
        }
        return workerInstance;
      }),
      terminate: vi.fn(),
    };
    return workerInstance;
  });
  return { Worker: WorkerMock, workerData: {}, parentPort: { postMessage: vi.fn() }, isMainThread: true };
});

import { createComputerUseTool } from '../computer-use';
import type { AIClient } from '../../../lib/ai-client';

describe('Bug Condition Exploration — Computer Use Connection Error Handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  /**
   * Single focused test covering the core bug condition.
   *
   * On UNFIXED code: agent runs all 40 steps, returns "Sub-agent task completed".
   * On FIXED code: agent exits after ≤ 3 steps with "Unable to reach VLM provider".
   *
   * Counterexample documented: agent ran 40 steps, returned "Sub-agent task completed",
   * errorCount stayed 0, MAX_ERRORS = 3 is dead code.
   */
  it('should exit after ≤ 3 steps with VLM-unreachable message on consecutive ECONNREFUSED errors', async () => {
    const mockClient = {
      provider: 'ollama',
      chat: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434')),
    } as unknown as AIClient;

    const tool = createComputerUseTool(mockClient);

    let stepCount = 0;
    const result = await tool.execute({ task: 'Test task' }, (msg: string) => {
      if (msg.includes('Sub-Agent Turn')) stepCount++;
    });

    // Fixed: exits after ≤ 3 steps with descriptive error
    expect(stepCount).toBeLessThanOrEqual(3);
    expect(result.output).toContain('Unable to reach VLM provider');
    expect(result.output).toContain('verify');
    expect(result.output).toContain('ECONNREFUSED');
  }, 30000);
});
