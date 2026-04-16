import { vi } from 'vitest';
import type { AIClient } from '../ai-client';

/**
 * Creates a mock AI client for testing purposes
 */
export function createMockAIClient(): AIClient {
  return {
    provider: 'test',
    model: 'test-model',
    setModel: vi.fn(),
    chat: vi.fn().mockResolvedValue({
      content: 'Mock AI response',
      usage: { inputTokens: 10, outputTokens: 20 }
    }),
    streamChat: vi.fn(),
    getModels: vi.fn().mockResolvedValue([]),
    validateConnection: vi.fn().mockResolvedValue(true),
  } as unknown as AIClient;
}
