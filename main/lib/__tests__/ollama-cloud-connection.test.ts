/**
 * Bug Condition Exploration Test - Ollama Cloud Connection
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * Bug Condition: provider === 'ollama-cloud' AND (endpointIsIncorrect() OR authenticationIsMissing() OR usesOpenAISDK())
 * Expected Behavior: Successful connection to https://ollama.com with proper authentication using native Ollama API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIClient } from '../ai-client';
import { PROVIDER_REGISTRY } from '../providers';

describe('Bug Condition Exploration - Ollama Cloud Connection', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('Property 1: Ollama Cloud should connect to correct endpoint https://ollama.com', () => {
    // Test that DEFAULT_URLS and PROVIDER_REGISTRY have correct endpoint
    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key',
    });

    // Check that the client is configured with correct endpoint
    // @ts-ignore - accessing private config for testing
    const baseUrl = client.config.baseUrl;
    
    // Expected: https://ollama.com
    // Actual (unfixed): http://localhost:11434 or https://cloud.ollama.ai/v1
    expect(baseUrl).toBe('https://ollama.com');
    
    // Also verify PROVIDER_REGISTRY consistency
    expect(PROVIDER_REGISTRY['ollama-cloud'].baseUrl).toBe('https://ollama.com');
  });

  it('Property 1: Ollama Cloud should include Authorization header in API calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'test response' }, model: 'llama3.3' }),
    });
    global.fetch = mockFetch;

    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key-12345',
    });

    try {
      await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    } catch (err) {
      // May fail due to endpoint issues, but we can still check the call
    }

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalled();
    
    // Get the fetch call arguments
    const fetchCall = mockFetch.mock.calls[0];
    const [url, options] = fetchCall;
    
    // Expected: Authorization header should be present
    // Actual (unfixed): No Authorization header
    expect(options.headers).toHaveProperty('Authorization');
    expect(options.headers.Authorization).toBe('Bearer test-api-key-12345');
  });

  it('Property 1: Ollama Cloud should use native Ollama API format (/api/chat)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'test response' }, model: 'llama3.3' }),
    });
    global.fetch = mockFetch;

    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key',
    });

    try {
      await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    } catch (err) {
      // May fail, but we can check the URL
    }

    // Verify the endpoint uses native Ollama API format
    expect(mockFetch).toHaveBeenCalled();
    const fetchCall = mockFetch.mock.calls[0];
    const [url] = fetchCall;
    
    // Expected: https://ollama.com/api/chat
    // Should NOT be OpenAI-compatible format like /v1/chat/completions
    expect(url).toContain('/api/chat');
    expect(url).not.toContain('/v1/chat/completions');
  });

  it('Property 1: Ollama Cloud should NOT initialize OpenAI SDK client', () => {
    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key',
    });

    // @ts-ignore - accessing private field for testing
    const openaiClient = client.openaiClient;
    
    // Expected: undefined (Ollama Cloud should use native API)
    // Actual (unfixed): May be initialized incorrectly
    expect(openaiClient).toBeUndefined();
  });

  it('Property 1: Configuration consistency - DEFAULT_URLS matches PROVIDER_REGISTRY', () => {
    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key',
    });

    // @ts-ignore - accessing private config
    const clientBaseUrl = client.config.baseUrl;
    const registryBaseUrl = PROVIDER_REGISTRY['ollama-cloud'].baseUrl;
    
    // Expected: Both should be https://ollama.com
    // Actual (unfixed): Mismatch between files
    expect(clientBaseUrl).toBe(registryBaseUrl);
    expect(clientBaseUrl).toBe('https://ollama.com');
  });
});

describe('Bug Condition Exploration - Error Cases', () => {
  it('Should document DNS resolution failure on unfixed code', async () => {
    // This test documents the actual error we see in production
    // Expected to fail with: getaddrinfo ENOTFOUND cloud.ollama.ai
    
    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key',
    });

    // @ts-ignore
    const baseUrl = client.config.baseUrl;
    
    // Document the bug: wrong endpoint causes DNS errors
    if (baseUrl.includes('cloud.ollama.ai')) {
      console.log('BUG CONFIRMED: Using non-existent endpoint cloud.ollama.ai');
      console.log('This will cause: getaddrinfo ENOTFOUND cloud.ollama.ai');
    }
    
    if (baseUrl === 'http://localhost:11434') {
      console.log('BUG CONFIRMED: Using local Ollama endpoint for cloud provider');
      console.log('This will cause: Connection to local server when cloud is expected');
    }
  });

  it('Should document 401 unauthorized error on unfixed code', async () => {
    // This test documents the authentication error we see
    // Expected to fail with: HTTP 401: unauthorized
    
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Unauthorized',
    });
    global.fetch = mockFetch;

    const client = new AIClient({
      provider: 'ollama-cloud',
      apiKey: 'test-api-key',
    });

    try {
      await client.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    } catch (err: any) {
      // Document the bug: missing Authorization header causes 401
      if (err.message.includes('401')) {
        console.log('BUG CONFIRMED: 401 Unauthorized error');
        console.log('Cause: Missing Authorization header in request');
      }
    }

    // Check if Authorization header was missing
    if (mockFetch.mock.calls.length > 0) {
      const [, options] = mockFetch.mock.calls[0];
      if (!options.headers?.Authorization) {
        console.log('BUG CONFIRMED: No Authorization header in request');
      }
    }
  });
});
