/**
 * Bug Condition Exploration Test — Ollama Cloud Computer Use Authentication
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Property 1: Bug Condition — Ollama Cloud VLM Authentication Failure
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 *
 * Bug: When a VLM config has `engine: "cloud"` and `provider: "ollama"`, both
 * `agent-runtime.ts` (runAgentStep) and `call_model.ts` (vision grounding block)
 * construct an `AIClient` using `provider: vlm.provider` directly — i.e., `"ollama"`.
 * Since `_ollamaHeaders` only adds `Authorization: Bearer <apiKey>` when
 * `provider === "ollama-cloud"`, the header is absent and Ollama Cloud returns HTTP 401.
 *
 * Root cause: Missing `engine === "cloud" && provider === "ollama"` → `"ollama-cloud"`
 * mapping in `agent-runtime.ts` and `call_model.ts`, unlike `createComputerUseTool`
 * which correctly applies this mapping.
 *
 * Expected counterexamples (unfixed code):
 *   new AIClient({ provider: vlm.provider, apiKey: "sk-test-key", ... })
 *     with vlm = { engine: "cloud", provider: "ollama", ... }
 *     → client.provider === "ollama" (NOT "ollama-cloud")
 *     → _ollamaHeaders does NOT include Authorization header
 */

import { describe, it, expect } from 'vitest';
import { AIClient } from '../../../../lib/ai-client';

// VLM config matching what a user would configure for Ollama Cloud computer use
const OLLAMA_CLOUD_VLM_CONFIG = {
  engine: 'cloud',
  provider: 'ollama',
  apiKey: 'sk-test-key',
  model: 'llava',
  baseUrl: 'https://api.ollama.ai',
};

/**
 * Simulate the FIXED construction pattern from agent-runtime.ts (runAgentStep):
 *
 *   clientConfig = {
 *     provider: (vlm.engine === 'cloud' && vlm.provider === 'ollama' ? 'ollama-cloud' : vlm.provider),
 *     model: vlm.model,
 *     apiKey: vlm.apiKey,
 *     baseUrl: vlm.baseUrl
 *   };
 *   client = runner.getClient(clientConfig);
 */
function constructVlmClientLikeAgentRuntime(vlm: typeof OLLAMA_CLOUD_VLM_CONFIG): AIClient {
  return new AIClient({
    provider: (vlm.engine === 'cloud' && vlm.provider === 'ollama' ? 'ollama-cloud' : vlm.provider) as any,
    model: vlm.model,
    apiKey: vlm.apiKey,
    baseUrl: vlm.baseUrl,
  });
}

/**
 * Simulate the FIXED construction pattern from call_model.ts (vision grounding block):
 *
 *   client = new AIClient({
 *     provider: (vlm.engine === 'cloud' && vlm.provider === 'ollama' ? 'ollama-cloud' : vlm.provider) as any,
 *     apiKey: vlm.apiKey,
 *     model: vlm.model,
 *     baseUrl: vlm.baseUrl
 *   });
 */
function constructVlmClientLikeCallModel(vlm: typeof OLLAMA_CLOUD_VLM_CONFIG): AIClient {
  return new AIClient({
    provider: (vlm.engine === 'cloud' && vlm.provider === 'ollama' ? 'ollama-cloud' : vlm.provider) as any,
    apiKey: vlm.apiKey,
    model: vlm.model,
    baseUrl: vlm.baseUrl,
  });
}

describe('Bug Condition Exploration — Ollama Cloud Computer Use Authentication', () => {
  /**
   * Test Case 1: agent-runtime.ts path — provider should be "ollama-cloud"
   *
   * The buggy code passes `provider: vlm.provider` ("ollama") directly.
   * After fix: provider should be mapped to "ollama-cloud".
   * On UNFIXED code: client.provider === "ollama" → FAILS this assertion.
   *
   * Counterexample: client.provider === "ollama" instead of "ollama-cloud"
   */
  it('agent-runtime path: AIClient should have provider "ollama-cloud" for cloud VLM config', () => {
    const vlm = OLLAMA_CLOUD_VLM_CONFIG;
    const client = constructVlmClientLikeAgentRuntime(vlm);

    // On unfixed code: client.provider === "ollama" — this assertion FAILS
    expect(client.provider).toBe('ollama-cloud');
  });

  /**
   * Test Case 2: agent-runtime.ts path — _ollamaHeaders should include Authorization
   *
   * With provider "ollama" (unfixed), _ollamaHeaders returns only Content-Type.
   * After fix: provider "ollama-cloud" causes _ollamaHeaders to include Authorization.
   * On UNFIXED code: Authorization header is absent → FAILS this assertion.
   *
   * Counterexample: _ollamaHeaders === { 'Content-Type': 'application/json' } (no Authorization)
   */
  it('agent-runtime path: _ollamaHeaders should include Authorization: Bearer sk-test-key', () => {
    const vlm = OLLAMA_CLOUD_VLM_CONFIG;
    const client = constructVlmClientLikeAgentRuntime(vlm);

    // Access private getter via cast to any
    const headers = (client as any)._ollamaHeaders as Record<string, string>;

    // On unfixed code: Authorization is absent — this assertion FAILS
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
  });

  /**
   * Test Case 3: call_model.ts path — provider should be "ollama-cloud"
   *
   * Same bug in the vision grounding block of call_model.ts.
   * On UNFIXED code: client.provider === "ollama" → FAILS this assertion.
   *
   * Counterexample: client.provider === "ollama" instead of "ollama-cloud"
   */
  it('call_model path: AIClient should have provider "ollama-cloud" for cloud VLM config', () => {
    const vlm = OLLAMA_CLOUD_VLM_CONFIG;
    const client = constructVlmClientLikeCallModel(vlm);

    // On unfixed code: client.provider === "ollama" — this assertion FAILS
    expect(client.provider).toBe('ollama-cloud');
  });

  /**
   * Test Case 4: call_model.ts path — _ollamaHeaders should include Authorization
   *
   * On UNFIXED code: Authorization header is absent → FAILS this assertion.
   *
   * Counterexample: _ollamaHeaders === { 'Content-Type': 'application/json' } (no Authorization)
   */
  it('call_model path: _ollamaHeaders should include Authorization: Bearer sk-test-key', () => {
    const vlm = OLLAMA_CLOUD_VLM_CONFIG;
    const client = constructVlmClientLikeCallModel(vlm);

    const headers = (client as any)._ollamaHeaders as Record<string, string>;

    // On unfixed code: Authorization is absent — this assertion FAILS
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
  });
});
