/**
 * Unit tests for provider IPC handlers
 */

import { getModelsForProvider, formatModelName, PROVIDER_REGISTRY, FlatModelEntry } from '../providers';
import type { ProviderType } from '../../acp/types';

describe('providers:get-models IPC handler logic', () => {
  it('should return formatted model entries for anthropic provider', () => {
    const providerType: ProviderType = 'anthropic';
    const models = getModelsForProvider(providerType);
    const providerMeta = PROVIDER_REGISTRY[providerType];

    const result: FlatModelEntry[] = models.map(modelId => ({
      id: modelId,
      name: formatModelName(modelId),
      provider: providerMeta?.name || providerType,
      providerType: providerType
    }));

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('provider');
    expect(result[0]).toHaveProperty('providerType');
    expect(result[0].provider).toBe('Anthropic');
    expect(result[0].providerType).toBe('anthropic');
  });

  it('should return formatted model entries for openai provider', () => {
    const providerType: ProviderType = 'openai';
    const models = getModelsForProvider(providerType);
    const providerMeta = PROVIDER_REGISTRY[providerType];

    const result: FlatModelEntry[] = models.map(modelId => ({
      id: modelId,
      name: formatModelName(modelId),
      provider: providerMeta?.name || providerType,
      providerType: providerType
    }));

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].provider).toBe('OpenAI');
    expect(result[0].providerType).toBe('openai');
  });

  it('should format known model names correctly', () => {
    expect(formatModelName('gpt-4o')).toBe('GPT-4o');
    expect(formatModelName('claude-sonnet-4-20250514')).toBe('Claude Sonnet 4');
    expect(formatModelName('deepseek-v4-pro')).toBe('DeepSeek V4 Pro');
  });

  it('should return model ID as name for unknown models', () => {
    const unknownModel = 'unknown-model-xyz';
    expect(formatModelName(unknownModel)).toBe(unknownModel);
  });

  it('should handle empty model list for local providers', () => {
    const providerType: ProviderType = 'ollama';
    const models = getModelsForProvider(providerType);

    expect(models).toEqual([]);
  });
});
