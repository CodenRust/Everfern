/**
 * Bug Condition Exploration Test — Ollama Cloud Authentication Failure
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Ollama Cloud Authentication Failure
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when it fails.
 *
 * Expected counterexamples (unfixed code):
 *   - VLM config with engine="cloud", provider="ollama", valid API key results in 401 Unauthorized
 *   - Authentication headers not properly passed to vision model requests
 *   - API key from VLM configuration not correctly mapped to ollama-cloud provider authentication
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

describe('Bug Condition Exploration — Ollama Cloud Authentication Failure', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  /**
   * Test that demonstrates the bug condition: Ollama Cloud authentication failure
   *
   * Bug Condition: VLM config with engine="cloud", provider="ollama", valid API key
   * results in 401 Unauthorized errors during computer use requests
   *
   * On UNFIXED code: Expected to FAIL with 401 Unauthorized error
   * On FIXED code: Should successfully authenticate and complete vision model requests
   */
  it('should successfully authenticate with Ollama Cloud using Bearer token headers', async () => {
    // Mock a 401 Unauthorized response to simulate the bug condition
    const mockClient = {
      provider: 'openai', // Original client provider (not used for VLM)
      chat: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Original client response' } }]
      }),
    } as unknown as AIClient;

    // VLM configuration that triggers the bug condition
    const vlmConfig = {
      engine: 'cloud' as const,
      provider: 'ollama',
      model: 'qwen3-vl:235b-instruct-cloud',
      baseUrl: 'https://ollama.com',
      apiKey: 'sk-test-api-key-12345'
    };

    // Mock fetch to simulate Ollama Cloud API behavior
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string, options: any) => {
      // Check if this is an Ollama Cloud request
      if (url.includes('ollama.com') || url.includes('/api/chat')) {
        const headers = options?.headers || {};

        // Bug condition: Check if Authorization header is missing or incorrect
        if (!headers['Authorization'] || !headers['Authorization'].startsWith('Bearer ')) {
          // Simulate 401 Unauthorized response (the bug)
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ error: 'HTTP 401: Unauthorized' }),
            text: () => Promise.resolve('[ollama] HTTP 401: Unauthorized'),
          });
        }

        // If Authorization header is present and correct, simulate success
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            message: {
              role: 'assistant',
              content: 'I can see the desktop. Task completed successfully.'
            }
          }),
        });
      }

      // For other requests, use original fetch or mock
      return originalFetch ? originalFetch(url, options) : Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    const tool = createComputerUseTool(
      mockClient,
      'darwin', // platform
      undefined, // visionModel
      undefined, // showuiUrl
      undefined, // ollamaBaseUrl
      undefined, // checkPermission
      undefined, // requestPermission
      vlmConfig
    );

    let errorOccurred = false;
    let errorMessage = '';

    try {
      const result = await tool.execute(
        { task: 'Take a screenshot and describe what you see' },
        (msg: string) => {
          if (msg.includes('401') || msg.includes('Unauthorized')) {
            errorOccurred = true;
            errorMessage = msg;
          }
        }
      );

      // On FIXED code: Should succeed with proper authentication
      expect(result.success).toBe(true);
      expect(result.output).toContain('successfully');
      expect(errorOccurred).toBe(false);

    } catch (error: any) {
      // On UNFIXED code: Expected to fail with 401 error
      errorOccurred = true;
      errorMessage = error.message || error.toString();
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }

    // Document the counterexample for unfixed code
    if (errorOccurred) {
      console.log('Counterexample found (confirms bug exists):');
      console.log(`- VLM Config: engine="${vlmConfig.engine}", provider="${vlmConfig.provider}", apiKey="${vlmConfig.apiKey}"`);
      console.log(`- Error: ${errorMessage}`);
      console.log('- Root cause: Authentication headers not properly passed to vision model requests');
    }

    // This assertion encodes the expected behavior (will fail on unfixed code)
    expect(errorOccurred).toBe(false);
    expect(errorMessage).not.toContain('401');
    expect(errorMessage).not.toContain('Unauthorized');

  }, 30000);

  /**
   * Additional test to verify the provider mapping logic works correctly
   */
  it('should correctly map engine="cloud" + provider="ollama" to ollama-cloud provider type', async () => {
    const mockClient = {
      provider: 'openai',
      chat: vi.fn(),
    } as unknown as AIClient;

    const vlmConfig = {
      engine: 'cloud' as const,
      provider: 'ollama',
      model: 'qwen3-vl:235b-instruct-cloud',
      apiKey: 'sk-test-key'
    };

    // Mock AIClient constructor to capture the provider mapping
    let capturedProvider: string | undefined;
    const originalAIClient = (await import('../../../lib/ai-client')).AIClient;

    vi.doMock('../../../lib/ai-client', () => ({
      AIClient: vi.fn().mockImplementation((config: any) => {
        capturedProvider = config.provider;
        return {
          chat: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response' } }]
          }),
        };
      }),
    }));

    const tool = createComputerUseTool(mockClient, 'darwin', undefined, undefined, undefined, undefined, undefined, vlmConfig);

    // The provider should be mapped to 'ollama-cloud'
    expect(capturedProvider).toBe('ollama-cloud');

    vi.doUnmock('../../../lib/ai-client');
  });
});
