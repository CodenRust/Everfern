/**
 * Unit Tests for Enhanced Configuration Validation
 *
 * Tests the enhanced validation functionality added in Task 9.2
 */

import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../config-manager';

describe('Enhanced Configuration Validation', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  it('should validate complete configuration structure', () => {
    const validConfig = {
      autoStart: {
        enabled: false,
        minimizeToTray: true
      },
      integrations: {
        telegram: {
          enabled: false,
          groupSettings: {
            requireMention: true,
            allowedGroups: []
          },
          fileHandling: {
            maxFileSize: 50,
            allowedTypes: ['image/jpeg', 'image/png'],
            uploadEnabled: true,
            downloadEnabled: true
          }
        },
        discord: {
          enabled: false,
          serverSettings: {
            requireMention: true,
            respondInDMs: true,
            allowedChannels: []
          },
          fileHandling: {
            maxFileSize: 25,
            allowedTypes: ['image/jpeg', 'image/png'],
            uploadEnabled: true,
            downloadEnabled: true
          }
        }
      },
      security: {
        allowedUsers: [],
        rateLimits: {
          messagesPerHour: 100,
          toolCallsPerDay: 1000
        },
        encryptionEnabled: true
      }
    };

    const result = configManager.validateConfiguration(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required configuration sections', () => {
    const invalidConfig = {} as any;

    const result = configManager.validateConfiguration(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('autoStart configuration is missing or invalid');
    expect(result.errors).toContain('integrations configuration is missing or invalid');
  });

  it('should validate autoStart configuration', () => {
    const invalidConfig = {
      autoStart: {
        enabled: 'not-a-boolean',
        minimizeToTray: 'also-not-a-boolean'
      },
      integrations: {
        telegram: { enabled: false, groupSettings: { requireMention: true }, fileHandling: { maxFileSize: 50, allowedTypes: [], uploadEnabled: true, downloadEnabled: true } },
        discord: { enabled: false, serverSettings: { requireMention: true, respondInDMs: true }, fileHandling: { maxFileSize: 25, allowedTypes: [], uploadEnabled: true, downloadEnabled: true } }
      },
      security: {
        allowedUsers: [],
        rateLimits: { messagesPerHour: 100, toolCallsPerDay: 1000 },
        encryptionEnabled: true
      }
    } as any;

    const result = configManager.validateConfiguration(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('autoStart.enabled must be a boolean');
    expect(result.errors).toContain('autoStart.minimizeToTray must be a boolean');
  });

  it('should validate Telegram configuration when enabled', () => {
    const invalidConfig = {
      autoStart: { enabled: false, minimizeToTray: true },
      integrations: {
        telegram: {
          enabled: true,
          groupSettings: {
            requireMention: 'not-a-boolean'
          },
          fileHandling: {
            maxFileSize: -1,
            allowedTypes: [],
            uploadEnabled: true,
            downloadEnabled: true
          }
        },
        discord: { enabled: false, serverSettings: { requireMention: true, respondInDMs: true }, fileHandling: { maxFileSize: 25, allowedTypes: [], uploadEnabled: true, downloadEnabled: true } }
      },
      security: {
        allowedUsers: [],
        rateLimits: { messagesPerHour: 100, toolCallsPerDay: 1000 },
        encryptionEnabled: true
      }
    } as any;

    const result = configManager.validateConfiguration(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Telegram max file size must be greater than 0');
    expect(result.errors).toContain('Telegram groupSettings.requireMention must be a boolean');
  });

  it('should validate Discord configuration when enabled', () => {
    const invalidConfig = {
      autoStart: { enabled: false, minimizeToTray: true },
      integrations: {
        telegram: { enabled: false, groupSettings: { requireMention: true }, fileHandling: { maxFileSize: 50, allowedTypes: [], uploadEnabled: true, downloadEnabled: true } },
        discord: {
          enabled: true,
          serverSettings: {
            requireMention: 'not-a-boolean',
            respondInDMs: 'also-not-a-boolean'
          },
          fileHandling: {
            maxFileSize: 30, // Exceeds Discord limit
            allowedTypes: [],
            uploadEnabled: true,
            downloadEnabled: true
          }
        }
      },
      security: {
        allowedUsers: [],
        rateLimits: { messagesPerHour: 100, toolCallsPerDay: 1000 },
        encryptionEnabled: true
      }
    } as any;

    const result = configManager.validateConfiguration(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Discord max file size cannot exceed 25MB (Discord limit)');
    expect(result.errors).toContain('Discord serverSettings.requireMention must be a boolean');
    expect(result.errors).toContain('Discord serverSettings.respondInDMs must be a boolean');
  });

  it('should validate security configuration', () => {
    const invalidConfig = {
      autoStart: { enabled: false, minimizeToTray: true },
      integrations: {
        telegram: { enabled: false, groupSettings: { requireMention: true }, fileHandling: { maxFileSize: 50, allowedTypes: [], uploadEnabled: true, downloadEnabled: true } },
        discord: { enabled: false, serverSettings: { requireMention: true, respondInDMs: true }, fileHandling: { maxFileSize: 25, allowedTypes: [], uploadEnabled: true, downloadEnabled: true } }
      },
      security: {
        allowedUsers: 'not-an-array',
        rateLimits: {
          messagesPerHour: -1,
          toolCallsPerDay: 0
        },
        encryptionEnabled: 'not-a-boolean'
      }
    } as any;

    const result = configManager.validateConfiguration(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Messages per hour rate limit must be greater than 0');
    expect(result.errors).toContain('Tool calls per day rate limit must be greater than 0');
    expect(result.errors).toContain('security.encryptionEnabled must be a boolean');
    expect(result.errors).toContain('security.allowedUsers must be an array');
  });

  it('should generate warnings for potential issues', () => {
    const configWithWarnings = {
      autoStart: { enabled: false, minimizeToTray: true },
      integrations: {
        telegram: {
          enabled: true,
          groupSettings: { requireMention: true },
          fileHandling: {
            maxFileSize: 60, // Exceeds recommended limit
            allowedTypes: [], // No allowed types
            uploadEnabled: true,
            downloadEnabled: true
          }
        },
        discord: {
          enabled: true,
          serverSettings: { requireMention: true, respondInDMs: true },
          fileHandling: {
            maxFileSize: 25,
            allowedTypes: [], // No allowed types
            uploadEnabled: true,
            downloadEnabled: true
          }
        }
      },
      security: {
        allowedUsers: [],
        rateLimits: { messagesPerHour: 100, toolCallsPerDay: 1000 },
        encryptionEnabled: true
      }
    };

    const result = configManager.validateConfiguration(configWithWarnings);
    expect(result.valid).toBe(true); // Should be valid but with warnings
    expect(result.warnings).toContain('Telegram max file size exceeds recommended limit of 50MB');
    expect(result.warnings).toContain('No allowed file types specified for Telegram');
    expect(result.warnings).toContain('No allowed file types specified for Discord');
  });
});
