/**
 * Integration Tests for ConfigManager
 *
 * Tests the actual functionality without complex mocking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager, IntegrationConfig } from '../config-manager';

describe('ConfigManager Integration Tests', () => {
  let configManager: ConfigManager;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `everfern-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Override the config directory for testing
    configManager = new ConfigManager();
    (configManager as any).configDir = testDir;
    (configManager as any).integrationsDir = path.join(testDir, 'integrations');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(configManager.initialize()).resolves.not.toThrow();

      // Check that directories were created
      const configDirExists = await fs.access(testDir).then(() => true).catch(() => false);
      const integrationsDirExists = await fs.access(path.join(testDir, 'integrations')).then(() => true).catch(() => false);

      expect(configDirExists).toBe(true);
      expect(integrationsDirExists).toBe(true);
    });

    it('should create default configuration', async () => {
      await configManager.initialize();

      const config = configManager.getConfig();
      expect(config).toMatchObject({
        autoStart: {
          enabled: false,
          minimizeToTray: true
        },
        integrations: {
          telegram: {
            enabled: false
          },
          discord: {
            enabled: false
          }
        },
        security: {
          encryptionEnabled: true
        }
      });
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should update configuration successfully', async () => {
      const updates: Partial<IntegrationConfig> = {
        autoStart: {
          enabled: true,
          minimizeToTray: false
        }
      };

      await configManager.updateConfig(updates);

      const config = configManager.getConfig();
      expect(config.autoStart.enabled).toBe(true);
      expect(config.autoStart.minimizeToTray).toBe(false);
    });

    it('should persist configuration to disk', async () => {
      const updates: Partial<IntegrationConfig> = {
        autoStart: {
          enabled: true,
          minimizeToTray: false
        }
      };

      await configManager.updateConfig(updates);

      // Create a new config manager to test persistence
      const newConfigManager = new ConfigManager();
      (newConfigManager as any).configDir = testDir;
      (newConfigManager as any).integrationsDir = path.join(testDir, 'integrations');

      await newConfigManager.initialize();

      const config = newConfigManager.getConfig();
      expect(config.autoStart.enabled).toBe(true);
      expect(config.autoStart.minimizeToTray).toBe(false);
    });
  });

  describe('bot token management', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should store and retrieve bot token', async () => {
      const token = 'test-telegram-token-12345';

      await configManager.storeBotToken('telegram', token);
      const retrievedToken = await configManager.retrieveBotToken('telegram');

      expect(retrievedToken).toBe(token);
    });

    it('should return null for non-existent token', async () => {
      const token = await configManager.retrieveBotToken('discord');
      expect(token).toBeNull();
    });

    it('should delete bot token', async () => {
      const token = 'test-token';

      await configManager.storeBotToken('telegram', token);
      expect(await configManager.retrieveBotToken('telegram')).toBe(token);

      await configManager.deleteBotToken('telegram');
      expect(await configManager.retrieveBotToken('telegram')).toBeNull();
    });

    it('should encrypt stored tokens', async () => {
      const token = 'secret-token-12345';

      await configManager.storeBotToken('telegram', token);

      // Read the raw file to verify it's encrypted
      const tokenPath = path.join(testDir, 'integrations', 'telegram.key');
      const rawData = await fs.readFile(tokenPath, 'utf-8');

      // Should not contain the plain text token
      expect(rawData).not.toContain(token);
      // Should be valid JSON with encryption metadata
      const encryptedData = JSON.parse(rawData);
      expect(encryptedData).toHaveProperty('encrypted');
      expect(encryptedData).toHaveProperty('algorithm');
      expect(encryptedData).toHaveProperty('keyDerivation');
    });
  });

  describe('configuration validation', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should validate valid configuration', () => {
      const config = configManager.getConfig();
      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid Telegram file size', () => {
      const config = configManager.getConfig();
      config.integrations.telegram.enabled = true;
      config.integrations.telegram.fileHandling.maxFileSize = 0;

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Telegram max file size must be greater than 0');
    });

    it('should detect Discord file size exceeding limit', () => {
      const config = configManager.getConfig();
      config.integrations.discord.enabled = true;
      config.integrations.discord.fileHandling.maxFileSize = 30;

      const result = configManager.validateConfiguration(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Discord max file size cannot exceed 25MB (Discord limit)');
    });

    it('should generate warnings for potential issues', () => {
      const config = configManager.getConfig();
      config.integrations.telegram.enabled = true;
      config.integrations.telegram.fileHandling.maxFileSize = 60;
      config.integrations.telegram.fileHandling.allowedTypes = [];

      const result = configManager.validateConfiguration(config);

      expect(result.warnings).toContain('Telegram max file size exceeds recommended limit of 50MB');
      expect(result.warnings).toContain('No allowed file types specified for Telegram');
    });
  });

  describe('configuration export/import', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should export configuration without sensitive data', async () => {
      // Store a token first
      await configManager.storeBotToken('telegram', 'secret-token');

      const exported = await configManager.exportConfiguration();
      const exportedConfig = JSON.parse(exported);

      expect(exportedConfig.integrations.telegram.botToken).toBeUndefined();
      expect(exportedConfig.integrations.discord.botToken).toBeUndefined();
      expect(exportedConfig.autoStart).toBeDefined();
      expect(exportedConfig.security).toBeDefined();
    });

    it('should import valid configuration', async () => {
      const importConfig = {
        autoStart: { enabled: true, minimizeToTray: false },
        integrations: {
          telegram: {
            enabled: true,
            allowedUsers: [],
            groupSettings: { requireMention: false, allowedGroups: [] },
            fileHandling: {
              maxFileSize: 40,
              allowedTypes: ['image/jpeg'],
              uploadEnabled: true,
              downloadEnabled: true
            }
          },
          discord: {
            enabled: false,
            allowedGuilds: [],
            allowedUsers: [],
            serverSettings: {
              requireMention: true,
              allowedChannels: [],
              respondInDMs: false
            },
            fileHandling: {
              maxFileSize: 20,
              allowedTypes: ['image/png'],
              uploadEnabled: false,
              downloadEnabled: true
            }
          }
        },
        security: {
          allowedUsers: ['user1'],
          rateLimits: { messagesPerHour: 50, toolCallsPerDay: 500 },
          encryptionEnabled: true
        }
      };

      await configManager.importConfiguration(JSON.stringify(importConfig));

      const config = configManager.getConfig();
      expect(config.autoStart.enabled).toBe(true);
      expect(config.integrations.telegram.enabled).toBe(true);
      expect(config.integrations.telegram.groupSettings.requireMention).toBe(false);
    });

    it('should reject invalid imported configuration', async () => {
      const invalidConfig = {
        security: {
          rateLimits: { messagesPerHour: -1, toolCallsPerDay: 0 }
        }
      };

      await expect(configManager.importConfiguration(JSON.stringify(invalidConfig)))
        .rejects.toThrow('Invalid configuration');
    });
  });

  describe('configuration reset', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('should reset configuration to defaults', async () => {
      // First modify the configuration
      await configManager.updateConfig({
        autoStart: { enabled: true, minimizeToTray: false }
      });
      await configManager.storeBotToken('telegram', 'test-token');

      // Reset configuration
      await configManager.resetConfiguration();

      const config = configManager.getConfig();
      expect(config.autoStart.enabled).toBe(false);
      expect(config.autoStart.minimizeToTray).toBe(true);

      // Tokens should be deleted
      expect(await configManager.retrieveBotToken('telegram')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle initialization with invalid directory', async () => {
      const invalidConfigManager = new ConfigManager();
      (invalidConfigManager as any).configDir = '/invalid/path/that/cannot/be/created';
      (invalidConfigManager as any).integrationsDir = '/invalid/path/that/cannot/be/created/integrations';

      await expect(invalidConfigManager.initialize()).rejects.toThrow();
    });

    it('should handle corrupted token files gracefully', async () => {
      await configManager.initialize();

      // Write corrupted data to token file
      const tokenPath = path.join(testDir, 'integrations', 'telegram.key');
      await fs.writeFile(tokenPath, 'corrupted data', 'utf-8');

      const token = await configManager.retrieveBotToken('telegram');
      expect(token).toBeNull();
    });
  });
});
