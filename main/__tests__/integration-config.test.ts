/**
 * Tests for IntegrationConfig interface extensions
 * Validates that model and provider fields are properly handled
 */

import { describe, it, expect } from 'vitest';
import { IntegrationServiceConfig } from '../integrations/integration-service';

describe('IntegrationConfig Interface', () => {
  it('should accept model and provider fields for telegram', () => {
    const config: Partial<IntegrationServiceConfig> = {
      telegram: {
        enabled: true,
        botToken: 'test-token',
        webhookUrl: 'https://example.com/webhook',
        connected: true,
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
      },
      discord: {
        enabled: false,
        botToken: '',
        applicationId: '',
        connected: false,
      },
    };

    expect(config.telegram?.model).toBe('claude-sonnet-4-20250514');
    expect(config.telegram?.provider).toBe('anthropic');
  });

  it('should accept model and provider fields for discord', () => {
    const config: Partial<IntegrationServiceConfig> = {
      telegram: {
        enabled: false,
        botToken: '',
        connected: false,
      },
      discord: {
        enabled: true,
        botToken: 'test-token',
        applicationId: 'test-app-id',
        connected: true,
        model: 'gpt-4o',
        provider: 'openai',
      },
    };

    expect(config.discord?.model).toBe('gpt-4o');
    expect(config.discord?.provider).toBe('openai');
  });

  it('should allow optional model and provider fields', () => {
    const config: Partial<IntegrationServiceConfig> = {
      telegram: {
        enabled: true,
        botToken: 'test-token',
        connected: false,
      },
      discord: {
        enabled: true,
        botToken: 'test-token',
        applicationId: 'test-app-id',
        connected: false,
      },
    };

    expect(config.telegram?.model).toBeUndefined();
    expect(config.telegram?.provider).toBeUndefined();
    expect(config.discord?.model).toBeUndefined();
    expect(config.discord?.provider).toBeUndefined();
  });

  it('should support backward compatibility with old configs', () => {
    // Simulate loading an old config without model/provider fields
    const oldConfig: any = {
      telegram: {
        enabled: true,
        botToken: 'old-token',
        connected: true,
      },
      discord: {
        enabled: false,
        botToken: '',
        applicationId: '',
        connected: false,
      },
    };

    // Merge with defaults (simulating loadIntegrationConfig behavior)
    const defaults: any = {
      telegram: {
        enabled: false,
        botToken: '',
        webhookUrl: '',
        connected: false,
      },
      discord: {
        enabled: false,
        botToken: '',
        applicationId: '',
        connected: false,
      },
    };

    const merged: Partial<IntegrationServiceConfig> = {
      telegram: {
        ...defaults.telegram,
        ...oldConfig.telegram,
      },
      discord: {
        ...defaults.discord,
        ...oldConfig.discord,
      },
    };

    expect(merged.telegram?.enabled).toBe(true);
    expect(merged.telegram?.botToken).toBe('old-token');
    expect(merged.telegram?.model).toBeUndefined();
    expect(merged.telegram?.provider).toBeUndefined();
  });
});
