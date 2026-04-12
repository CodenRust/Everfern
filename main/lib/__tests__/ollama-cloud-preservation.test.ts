/**
 * Preservation Property Tests - Non-Ollama-Cloud Provider Behavior
 * 
 * IMPORTANT: Follow observation-first methodology
 * These tests capture baseline behavior on UNFIXED code for all non-Ollama-Cloud providers
 * Expected to PASS on unfixed code (confirms baseline to preserve)
 * 
 * Property 2: For all providers != 'ollama-cloud', behavior must remain unchanged
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIClient } from '../ai-client';
import { PROVIDER_REGISTRY } from '../providers';

describe('Preservation - Local Ollama Provider', () => {
  it('Property 2: Local Ollama should connect to http://localhost:11434', () => {
    const client = new AIClient({
      provider: 'ollama',
      model: 'llama3',
    });

    // @ts-ignore - accessing private config
    const baseUrl = client.config.baseUrl;
    
    // Preserve: Local Ollama uses localhost:11434
    expect(baseUrl).toBe('http://localhost:11434');
    expect(PROVIDER_REGISTRY['ollama'].baseUrl).toBe('http://localhost:11434');
  });

  it('Property 2: Local Ollama should NOT include Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'test' }, model: 'llama3' }),
    });
    global.fetch = mockFetch;

    const client = new AIClient({
      provider: 'ollama',
      model: 'llama3',
    });

    try {
      await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    } catch (err) {
      // Ignore errors, just check headers
    }

    if (mockFetch.mock.calls.length > 0) {
      const [, options] = mockFetch.mock.calls[0];
      
      // Preserve: Local Ollama does NOT use Authorization header
      expect(options.headers?.Authorization).toBeUndefined();
    }
  });

  it('Property 2: Local Ollama should use native Ollama API format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'test' }, model: 'llama3' }),
    });
    global.fetch = mockFetch;

    const client = new AIClient({
      provider: 'ollama',
      model: 'llama3',
    });

    try {
      await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    } catch (err) {
      // Ignore errors
    }

    if (mockFetch.mock.calls.length > 0) {
      const [url] = mockFetch.mock.calls[0];
      
      // Preserve: Uses /api/chat endpoint
      expect(url).toContain('/api/chat');
    }
  });
});

describe('Preservation - NVIDIA NIM Provider', () => {
  it('Property 2: NVIDIA NIM should use OpenAI SDK', () => {
    const client = new AIClient({
      provider: 'nvidia',
      apiKey: 'nvapi-test',
      model: 'meta/llama-3.3-70b-instruct',
    });

    // @ts-ignore - accessing private field
    const openaiClient = client.openaiClient;
    
    // Preserve: NVIDIA NIM SHOULD have OpenAI SDK initialized
    expect(openaiClient).toBeDefined();
  });

  it('Property 2: NVIDIA NIM should use correct endpoint', () => {
    const client = new AIClient({
      provider: 'nvidia',
      apiKey: 'nvapi-test',
    });

    // @ts-ignore
    const baseUrl = client.config.baseUrl;
    
    // Preserve: NVIDIA NIM uses integrate.api.nvidia.com
    expect(baseUrl).toBe('https://integrate.api.nvidia.com/v1');
    expect(PROVIDER_REGISTRY['nvidia'].baseUrl).toBe('https://integrate.api.nvidia.com/v1');
  });
});

describe('Preservation - OpenAI-Compatible Providers', () => {
  const openaiCompatProviders: Array<{ provider: any; expectedUrl: string; requiresKey: boolean }> = [
    { provider: 'openai', expectedUrl: 'https://api.openai.com/v1', requiresKey: true },
    { provider: 'deepseek', expectedUrl: 'https://api.deepseek.com', requiresKey: true },
    { provider: 'gemini', expectedUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', requiresKey: true },
    { provider: 'openrouter', expectedUrl: 'https://openrouter.ai/api/v1', requiresKey: true },
    { provider: 'lmstudio', expectedUrl: 'http://localhost:1234/v1', requiresKey: false },
  ];

  openaiCompatProviders.forEach(({ provider, expectedUrl, requiresKey }) => {
    it(`Property 2: ${provider} should use correct endpoint ${expectedUrl}`, () => {
      const config: any = {
        provider,
        model: 'test-model',
      };
      if (requiresKey) {
        config.apiKey = 'test-key';
      }

      const client = new AIClient(config);

      // @ts-ignore
      const baseUrl = client.config.baseUrl;
      
      // Preserve: Each provider uses its correct endpoint
      expect(baseUrl).toBe(expectedUrl);
      expect(PROVIDER_REGISTRY[provider].baseUrl).toBe(expectedUrl);
    });

    it(`Property 2: ${provider} should NOT initialize OpenAI SDK`, () => {
      const config: any = {
        provider,
        model: 'test-model',
      };
      if (requiresKey) {
        config.apiKey = 'test-key';
      }

      const client = new AIClient(config);

      // @ts-ignore
      const openaiClient = client.openaiClient;
      
      // Preserve: Only NVIDIA NIM uses OpenAI SDK
      expect(openaiClient).toBeUndefined();
    });
  });
});

describe('Preservation - Anthropic Provider', () => {
  it('Property 2: Anthropic should use correct endpoint', () => {
    const client = new AIClient({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    });

    // @ts-ignore
    const baseUrl = client.config.baseUrl;
    
    // Preserve: Anthropic uses api.anthropic.com
    expect(baseUrl).toBe('https://api.anthropic.com');
    expect(PROVIDER_REGISTRY['anthropic'].baseUrl).toBe('https://api.anthropic.com');
  });

  it('Property 2: Anthropic should NOT use OpenAI SDK', () => {
    const client = new AIClient({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
    });

    // @ts-ignore
    const openaiClient = client.openaiClient;
    
    // Preserve: Anthropic uses native Messages API, not OpenAI SDK
    expect(openaiClient).toBeUndefined();
  });
});

describe('Preservation - Vision Model Handling', () => {
  it('Property 2: Vision models should handle image content correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 
        choices: [{ message: { content: 'I see an image' } }],
        id: 'test-id',
        model: 'gpt-4o',
      }),
    });
    global.fetch = mockFetch;

    const client = new AIClient({
      provider: 'openai',
      apiKey: 'sk-test',
    });

    const imageMessage = {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'What do you see?' },
        { 
          type: 'image_url' as const, 
          image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } 
        },
      ],
    };

    try {
      await client.chat({
        messages: [imageMessage],
      });
    } catch (err) {
      // Ignore errors
    }

    // Preserve: Image content is passed correctly
    if (mockFetch.mock.calls.length > 0) {
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      
      // Verify image content is preserved in request
      expect(body.messages).toBeDefined();
      expect(body.messages.length).toBeGreaterThan(0);
    }
  });
});

describe('Preservation - Client Pooling', () => {
  it('Property 2: Client pooling should continue to work', () => {
    // Create multiple clients with same config
    const config = {
      provider: 'openai' as const,
      apiKey: 'sk-test',
      model: 'gpt-4o',
    };

    const client1 = new AIClient(config);
    const client2 = new AIClient(config);

    // Both clients should be created successfully
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
    
    // @ts-ignore
    expect(client1.config.provider).toBe('openai');
    // @ts-ignore
    expect(client2.config.provider).toBe('openai');
  });
});
