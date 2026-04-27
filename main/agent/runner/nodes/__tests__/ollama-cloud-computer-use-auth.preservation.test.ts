/**
 * Preservation Property Tests — Non-Ollama-Cloud VLM Behavior
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation — Non-Ollama-Cloud VLM Behavior
 *
 * These tests observe and capture the CORRECT baseline behavior for VLM configs
 * that are NOT affected by the Ollama Cloud auth bug. They run on UNFIXED code
 * and MUST PASS — confirming the baseline to preserve after the fix is applied.
 *
 * Preservation guarantees:
 *   - Local Ollama (engine: "local", provider: "ollama") → no Authorization header
 *   - OpenAI VLM → provider stays "openai", unaffected by any mapping
 *   - Anthropic VLM → provider stays "anthropic", unaffected
 *   - Ollama with no engine field → treated as local, no auth header
 *   - Any config where engine !== "cloud" OR provider !== "ollama" → unchanged behavior
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AIClient } from '../../../../lib/ai-client';

// ── Helper: construct AIClient the same way agent-runtime.ts does (buggy path) ──

function constructVlmClientLikeAgentRuntime(vlm: {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}): AIClient {
  return new AIClient({
    provider: vlm.provider as any,
    model: vlm.model,
    apiKey: vlm.apiKey,
    baseUrl: vlm.baseUrl,
  });
}

// ── Helper: get _ollamaHeaders via cast ──

function getOllamaHeaders(client: AIClient): Record<string, string> {
  return (client as any)._ollamaHeaders as Record<string, string>;
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Preservation — Non-Ollama-Cloud VLM Behavior', () => {
  /**
   * Requirement 3.1: Local Ollama Preservation
   *
   * When engine is "local" and provider is "ollama", the AIClient should be
   * constructed with provider "ollama" (not "ollama-cloud"), and _ollamaHeaders
   * must NOT include an Authorization header.
   */
  describe('3.1 Local Ollama Preservation', () => {
    it('local Ollama: provider stays "ollama"', () => {
      const vlm = { engine: 'local', provider: 'ollama', apiKey: 'sk-test', model: 'llava' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      expect(client.provider).toBe('ollama');
    });

    it('local Ollama: _ollamaHeaders has no Authorization header', () => {
      const vlm = { engine: 'local', provider: 'ollama', apiKey: 'sk-test', model: 'llava' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      const headers = getOllamaHeaders(client);
      expect(headers['Authorization']).toBeUndefined();
    });

    it('local Ollama: _ollamaHeaders only has Content-Type', () => {
      const vlm = { engine: 'local', provider: 'ollama', apiKey: 'sk-test', model: 'llava' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      const headers = getOllamaHeaders(client);
      expect(headers['Content-Type']).toBe('application/json');
      expect(Object.keys(headers)).toHaveLength(1);
    });
  });

  /**
   * Requirement 3.2: OpenAI VLM Preservation
   *
   * When provider is "openai", the AIClient should be constructed with provider
   * "openai" and the Ollama headers getter is not relevant (OpenAI uses _oaiHeaders).
   * The provider must remain "openai" regardless of any mapping logic.
   */
  describe('3.2 OpenAI VLM Preservation', () => {
    it('OpenAI VLM: provider stays "openai"', () => {
      const vlm = { provider: 'openai', apiKey: 'sk-openai-key', model: 'gpt-4o' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      expect(client.provider).toBe('openai');
    });

    it('OpenAI VLM: provider is not remapped to ollama-cloud', () => {
      const vlm = { provider: 'openai', apiKey: 'sk-openai-key', model: 'gpt-4o' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      expect(client.provider).not.toBe('ollama-cloud');
      expect(client.provider).not.toBe('ollama');
    });
  });

  /**
   * Requirement 3.3: Anthropic VLM Preservation
   *
   * When provider is "anthropic", the AIClient should be constructed with provider
   * "anthropic" and remain unaffected by any Ollama Cloud mapping.
   */
  describe('3.3 Anthropic VLM Preservation', () => {
    it('Anthropic VLM: provider stays "anthropic"', () => {
      const vlm = { provider: 'anthropic', apiKey: 'ant-key', model: 'claude-3-5-sonnet-20241022' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      expect(client.provider).toBe('anthropic');
    });

    it('Anthropic VLM: provider is not remapped to ollama-cloud', () => {
      const vlm = { provider: 'anthropic', apiKey: 'ant-key', model: 'claude-3-5-sonnet-20241022' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      expect(client.provider).not.toBe('ollama-cloud');
    });
  });

  /**
   * Requirement 3.1: Undefined Engine Preservation
   *
   * When provider is "ollama" but no engine field is present, the config should
   * be treated as local Ollama — no Authorization header, provider stays "ollama".
   */
  describe('Undefined Engine Preservation', () => {
    it('no engine field + provider "ollama": provider stays "ollama"', () => {
      const vlm = { provider: 'ollama', apiKey: 'sk-test', model: 'llava' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      expect(client.provider).toBe('ollama');
    });

    it('no engine field + provider "ollama": no Authorization header', () => {
      const vlm = { provider: 'ollama', apiKey: 'sk-test', model: 'llava' };
      const client = constructVlmClientLikeAgentRuntime(vlm);
      const headers = getOllamaHeaders(client);
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  /**
   * Property-Based Test: Preservation across all non-bug-condition VLM configs
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any VLM config where engine !== "cloud" OR provider !== "ollama",
   * the provider mapping should be unchanged (provider stays as-is).
   *
   * This is the core preservation property: the fix must not affect any config
   * that doesn't match the bug condition.
   */
  describe('Property-Based: Non-bug-condition configs are unaffected', () => {
    it('property: provider is unchanged for all non-Ollama-Cloud configs', () => {
      // Arbitraries for non-bug-condition VLM configs
      const nonCloudOllamaProvider = fc.oneof(
        fc.constant('openai'),
        fc.constant('anthropic'),
        fc.constant('deepseek'),
        fc.constant('lmstudio'),
        fc.constant('everfern'),
        fc.constant('ollama'), // local ollama — only non-bug when engine !== "cloud"
      );

      const nonCloudEngine = fc.oneof(
        fc.constant('local'),
        fc.constant(undefined),
        fc.constant(''),
      );

      const apiKey = fc.oneof(
        fc.constant(''),
        fc.constant(undefined),
        fc.string({ minLength: 1, maxLength: 40 }).map(s => `sk-${s}`),
      );

      // Case A: provider is not "ollama" (any engine is fine)
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('openai'),
            fc.constant('anthropic'),
            fc.constant('deepseek'),
          ),
          apiKey,
          (provider, key) => {
            const client = constructVlmClientLikeAgentRuntime({ provider, apiKey: key });
            // Provider must remain exactly as passed — no remapping
            return client.provider === provider;
          }
        ),
        { numRuns: 50 }
      );

      // Case B: provider is "ollama" but engine is NOT "cloud"
      fc.assert(
        fc.property(
          nonCloudEngine,
          apiKey,
          (engine, key) => {
            const vlm: any = { provider: 'ollama', apiKey: key };
            if (engine !== undefined) vlm.engine = engine;
            const client = constructVlmClientLikeAgentRuntime(vlm);
            // Local ollama must stay "ollama", never become "ollama-cloud"
            return client.provider === 'ollama';
          }
        ),
        { numRuns: 50 }
      );
    });

    it('property: local Ollama never gets Authorization header regardless of apiKey', () => {
      const apiKey = fc.oneof(
        fc.constant(''),
        fc.constant(undefined),
        fc.string({ minLength: 1, maxLength: 40 }).map(s => `sk-${s}`),
      );

      fc.assert(
        fc.property(apiKey, (key) => {
          const client = constructVlmClientLikeAgentRuntime({
            provider: 'ollama',
            apiKey: key,
          });
          const headers = getOllamaHeaders(client);
          // Local Ollama must NEVER have Authorization header
          return headers['Authorization'] === undefined;
        }),
        { numRuns: 100 }
      );
    });

    it('property: ollama-cloud always gets Authorization header when apiKey is present', () => {
      // This is the positive case — ollama-cloud with apiKey should have auth
      // (This is the FIXED behavior, but also the baseline for ollama-cloud provider directly)
      // Note: AIClient constructor strips apiKey via regex /sk-[A-Za-z0-9T\-]+/
      // so we generate keys that match that pattern exactly.
      const validApiKey = fc
        .stringMatching(/^[A-Za-z0-9T\-]{1,36}$/)
        .map(s => `sk-${s}`);

      fc.assert(
        fc.property(validApiKey, (key) => {
          const client = new AIClient({
            provider: 'ollama-cloud',
            apiKey: key,
            model: 'llava',
          });
          const headers = getOllamaHeaders(client);
          return headers['Authorization'] === `Bearer ${key}`;
        }),
        { numRuns: 50 }
      );
    });
  });
});
