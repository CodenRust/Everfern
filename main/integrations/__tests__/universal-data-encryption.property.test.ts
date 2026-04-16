/**
 * Property Test: Universal Data Encryption
 *
 * This test validates that all sensitive data stored by the Bot Integration System
 * is properly encrypted before storage, ensuring no plaintext sensitive information
 * persists in the database or file system.
 *
 * **Validates: Requirements 10.1**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ConfigManager, IntegrationConfig, EncryptedCredential } from '../config-manager';

// Test data directory
const TEST_DATA_DIR = path.join(os.tmpdir(), 'everfern-encryption-test');

// Mock configuration for testing
const mockIntegrationConfig: IntegrationConfig = {
  autoStart: {
    enabled: false,
    minimizeToTray: true
  },
  integrations: {
    telegram: {
      enabled: true,
      allowedUsers: [],
      groupSettings: {
        requireMention: true,
        allowedGroups: []
      },
      fileHandling: {
        maxFileSize: 50,
        allowedTypes: ['image/jpeg', 'text/plain'],
        uploadEnabled: true,
        downloadEnabled: true
      }
    },
    discord: {
      enabled: true,
      allowedGuilds: [],
      allowedUsers: [],
      serverSettings: {
        requireMention: true,
        allowedChannels: [],
        respondInDMs: true
      },
      fileHandling: {
        maxFileSize: 25,
        allowedTypes: ['image/png', 'application/pdf'],
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

// Helper class to test encryption directly
class EncryptionTester {
  private configManager: ConfigManager;
  private testDir: string;

  constructor(testDir: string) {
    this.testDir = testDir;
    this.configManager = new ConfigManager();
    // Override the config directory for testing
    (this.configManager as any).configDir = testDir;
    (this.configManager as any).integrationsDir = path.join(testDir, 'integrations');
    (this.configManager as any).backupsDir = path.join(testDir, 'integrations', 'backups');
  }

  async initialize(): Promise<void> {
    await this.configManager.initialize();
  }

  async storeBotToken(platform: 'telegram' | 'discord', token: string): Promise<void> {
    await this.configManager.storeBotToken(platform, token);
  }

  async retrieveBotToken(platform: 'telegram' | 'discord'): Promise<string | null> {
    return await this.configManager.retrieveBotToken(platform);
  }

  async getStoredTokenFile(platform: 'telegram' | 'discord'): Promise<string | null> {
    try {
      const tokenPath = path.join(this.testDir, 'integrations', `${platform}.key`);
      return await fs.readFile(tokenPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async updateConfig(config: IntegrationConfig): Promise<void> {
    await this.configManager.updateConfig(config);
  }

  async getStoredConfigFile(): Promise<string | null> {
    try {
      const configPath = path.join(this.testDir, 'integrations', 'config.json');
      return await fs.readFile(configPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async createBackup(description?: string): Promise<string> {
    return await this.configManager.createBackup(description);
  }

  async getBackupFile(backupPath: string): Promise<string | null> {
    try {
      return await fs.readFile(backupPath, 'utf-8');
    } catch {
      return null;
    }
  }

  getConfig(): IntegrationConfig {
    return this.configManager.getConfig();
  }

  cleanup(): void {
    // Clean up test directory
    try {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Helper function to check if data is encrypted
function isDataEncrypted(data: string): boolean {
  try {
    // Try to parse as JSON to see if it's structured encrypted data
    const parsed = JSON.parse(data);

    // Check if it has encryption structure
    if (parsed.encrypted && parsed.iv && parsed.algorithm && parsed.keyDerivation) {
      // Verify the encrypted data doesn't contain plaintext patterns
      const encryptedContent = parsed.encrypted;

      // Encrypted data should be hex-encoded and not contain common plaintext patterns
      const hexPattern = /^[0-9a-fA-F]+$/;
      if (!hexPattern.test(encryptedContent)) {
        return false;
      }

      // Should not contain common bot token patterns
      const tokenPatterns = [
        /bot\d+:/i,  // Telegram bot token pattern
        /[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}/,  // Discord bot token pattern
        /xoxb-/i,    // Slack token pattern
        /sk-/i       // OpenAI API key pattern
      ];

      for (const pattern of tokenPatterns) {
        if (pattern.test(encryptedContent)) {
          return false;
        }
      }

      return true;
    }

    return false;
  } catch {
    // If it's not valid JSON, check if it looks like raw encrypted data
    // Raw encrypted data should not contain readable text patterns
    const readablePatterns = [
      /bot\d+:/i,
      /[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}/,
      /xoxb-/i,
      /sk-/i,
      /password/i,
      /secret/i,
      /token/i
    ];

    for (const pattern of readablePatterns) {
      if (pattern.test(data)) {
        return false;
      }
    }

    return true;
  }
}

// Helper function to check if configuration data contains sensitive information in plaintext
function containsPlaintextSensitiveData(configData: string): boolean {
  try {
    const config = JSON.parse(configData);

    // Check for bot tokens in plaintext
    if (config.integrations?.telegram?.botToken &&
        typeof config.integrations.telegram.botToken === 'string' &&
        config.integrations.telegram.botToken.includes('bot')) {
      return true;
    }

    if (config.integrations?.discord?.botToken &&
        typeof config.integrations.discord.botToken === 'string' &&
        /[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}/.test(config.integrations.discord.botToken)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

describe('Feature: multi-platform-integration, Property 6: Universal Data Encryption', () => {
  let encryptionTester: EncryptionTester;
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(TEST_DATA_DIR, `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(testDir, { recursive: true });

    encryptionTester = new EncryptionTester(testDir);
    await encryptionTester.initialize();
  });

  afterEach(() => {
    encryptionTester.cleanup();
  });

  /**
   * Property 1: Bot token encryption consistency
   *
   * For any bot token stored by the system, the token SHALL be encrypted
   * before storage and never persist in plaintext form.
   */
  it('should encrypt all bot tokens before storage', { timeout: 30000 }, async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        telegramToken: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.includes('bot')),
        discordToken: fc.string({ minLength: 50, maxLength: 100 }).filter(s => s.includes('.')),
        platform: fc.constantFrom('telegram', 'discord')
      }),
      async (tokenData) => {
        const token = tokenData.platform === 'telegram' ? tokenData.telegramToken : tokenData.discordToken;

        // Store the bot token
        await encryptionTester.storeBotToken(tokenData.platform, token);

        // Verify the stored file is encrypted
        const storedData = await encryptionTester.getStoredTokenFile(tokenData.platform);
        expect(storedData).not.toBeNull();
        expect(isDataEncrypted(storedData!)).toBe(true);

        // Verify the stored data doesn't contain the plaintext token
        expect(storedData!).not.toContain(token);

        // Verify we can retrieve the original token
        const retrievedToken = await encryptionTester.retrieveBotToken(tokenData.platform);
        expect(retrievedToken).toBe(token);
      }
    ), { numRuns: 10 });
  });

  /**
   * Property 2: Configuration data encryption
   *
   * For any configuration data containing sensitive information,
   * the sensitive parts SHALL be encrypted or excluded from storage.
   */
  it('should not store sensitive configuration data in plaintext', { timeout: 30000 }, async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        telegramEnabled: fc.boolean(),
        discordEnabled: fc.boolean(),
        allowedUsers: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
        rateLimitMessages: fc.integer({ min: 1, max: 1000 }),
        rateLimitTools: fc.integer({ min: 1, max: 10000 })
      }),
      async (configData) => {
        const testConfig: IntegrationConfig = {
          ...mockIntegrationConfig,
          integrations: {
            ...mockIntegrationConfig.integrations,
            telegram: {
              ...mockIntegrationConfig.integrations.telegram,
              enabled: configData.telegramEnabled
            },
            discord: {
              ...mockIntegrationConfig.integrations.discord,
              enabled: configData.discordEnabled
            }
          },
          security: {
            ...mockIntegrationConfig.security,
            allowedUsers: configData.allowedUsers,
            rateLimits: {
              messagesPerHour: configData.rateLimitMessages,
              toolCallsPerDay: configData.rateLimitTools
            }
          }
        };

        // Update configuration
        await encryptionTester.updateConfig(testConfig);

        // Verify the stored configuration doesn't contain sensitive data in plaintext
        const storedConfig = await encryptionTester.getStoredConfigFile();
        expect(storedConfig).not.toBeNull();
        expect(containsPlaintextSensitiveData(storedConfig!)).toBe(false);

        // Verify we can retrieve the configuration correctly
        const retrievedConfig = encryptionTester.getConfig();
        expect(retrievedConfig.integrations.telegram.enabled).toBe(configData.telegramEnabled);
        expect(retrievedConfig.integrations.discord.enabled).toBe(configData.discordEnabled);
        expect(retrievedConfig.security.allowedUsers).toEqual(configData.allowedUsers);
      }
    ), { numRuns: 15 });
  });

  /**
   * Property 3: Backup data encryption
   *
   * For any backup created by the system, sensitive data SHALL be
   * encrypted or excluded from the backup to prevent data leakage.
   */
  it('should encrypt or exclude sensitive data from backups', { timeout: 30000 }, async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        telegramToken: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.includes('bot')),
        discordToken: fc.string({ minLength: 50, maxLength: 100 }).filter(s => s.includes('.')),
        backupDescription: fc.string({ minLength: 1, maxLength: 50 })
      }),
      async (backupData) => {
        // Store bot tokens
        await encryptionTester.storeBotToken('telegram', backupData.telegramToken);
        await encryptionTester.storeBotToken('discord', backupData.discordToken);

        // Create backup
        const backupPath = await encryptionTester.createBackup(backupData.backupDescription);

        // Verify backup file exists and doesn't contain plaintext tokens
        const backupContent = await encryptionTester.getBackupFile(backupPath);
        expect(backupContent).not.toBeNull();

        // Backup should not contain plaintext tokens
        expect(backupContent!).not.toContain(backupData.telegramToken);
        expect(backupContent!).not.toContain(backupData.discordToken);

        // Verify backup structure is valid JSON
        const backupJson = JSON.parse(backupContent!);
        expect(backupJson.metadata).toBeDefined();
        expect(backupJson.config).toBeDefined();

        // Verify sensitive data is excluded from backup config
        expect(backupJson.config.integrations?.telegram?.botToken).toBeUndefined();
        expect(backupJson.config.integrations?.discord?.botToken).toBeUndefined();
      }
    ), { numRuns: 15 });
  });

  /**
   * Property 4: Encryption key security
   *
   * For any encryption key used by the system, the key SHALL be
   * stored securely and not be accessible in plaintext through
   * normal configuration or data access methods.
   */
  it('should securely store encryption keys', { timeout: 30000 }, async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        tokenCount: fc.integer({ min: 1, max: 10 }),
        platforms: fc.array(fc.constantFrom('telegram', 'discord'), { minLength: 1, maxLength: 2 })
      }),
      async (keyData) => {
        // Store multiple tokens to ensure key is used
        for (let i = 0; i < keyData.tokenCount; i++) {
          for (const platform of keyData.platforms) {
            const token = platform === 'telegram'
              ? `bot${i}:test-token-${i}`
              : `test.token.${i}${'a'.repeat(27)}`;
            await encryptionTester.storeBotToken(platform, token);
          }
        }

        // Verify encryption key file exists and has proper permissions
        const keyPath = path.join(testDir, '.encryption-key');
        const keyStats = await fs.stat(keyPath);

        // Key file should exist
        expect(keyStats.isFile()).toBe(true);

        // Key file should have restricted permissions (600 = owner read/write only)
        // Note: On Windows, file permissions work differently, so we'll check if it's not world-readable
        const permissions = keyStats.mode & parseInt('777', 8);
        // On Unix-like systems, expect 600 (384), on Windows it might be different
        if (process.platform !== 'win32') {
          expect(permissions).toBe(parseInt('600', 8));
        } else {
          // On Windows, just ensure the file exists and is not empty
          expect(keyStats.size).toBeGreaterThan(0);
        }

        // Key content should not be accessible through normal config methods
        const config = encryptionTester.getConfig();
        const configString = JSON.stringify(config);

        // Configuration should not contain the encryption key
        const keyContent = await fs.readFile(keyPath);
        expect(configString).not.toContain(keyContent.toString('hex'));
        expect(configString).not.toContain(keyContent.toString('base64'));
      }
    ), { numRuns: 10 });
  });

  /**
   * Property 5: Data encryption consistency across operations
   *
   * For any sequence of store/retrieve operations on sensitive data,
   * the data SHALL remain encrypted in storage throughout all operations
   * and only be decrypted when explicitly retrieved.
   */
  it('should maintain encryption consistency across multiple operations', { timeout: 30000 }, async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        operations: fc.array(fc.record({
          action: fc.constantFrom('store', 'retrieve', 'update'),
          platform: fc.constantFrom('telegram', 'discord'),
          token: fc.string({ minLength: 10, maxLength: 100 })
        }), { minLength: 2, maxLength: 10 })
      }),
      async (operationData) => {
        const storedTokens = new Map<string, string>();

        for (const operation of operationData.operations) {
          const key = operation.platform;

          switch (operation.action) {
            case 'store':
              await encryptionTester.storeBotToken(operation.platform, operation.token);
              storedTokens.set(key, operation.token);
              break;

            case 'retrieve':
              if (storedTokens.has(key)) {
                const retrieved = await encryptionTester.retrieveBotToken(operation.platform);
                expect(retrieved).toBe(storedTokens.get(key));
              }
              break;

            case 'update':
              await encryptionTester.storeBotToken(operation.platform, operation.token);
              storedTokens.set(key, operation.token);
              break;
          }

          // After each operation, verify storage is still encrypted
          if (storedTokens.has(key)) {
            const storedData = await encryptionTester.getStoredTokenFile(operation.platform);
            expect(storedData).not.toBeNull();
            expect(isDataEncrypted(storedData!)).toBe(true);
            expect(storedData!).not.toContain(storedTokens.get(key)!);
          }
        }
      }
    ), { numRuns: 15 });
  });

  /**
   * Property 6: Encryption algorithm consistency
   *
   * For any encrypted data stored by the system, the encryption SHALL
   * use consistent, secure algorithms and parameters that meet security
   * standards for sensitive data protection.
   */
  it('should use consistent and secure encryption algorithms', { timeout: 30000 }, async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        tokens: fc.array(fc.record({
          platform: fc.constantFrom('telegram', 'discord'),
          value: fc.string({ minLength: 20, maxLength: 100 })
        }), { minLength: 1, maxLength: 5 })
      }),
      async (encryptionData) => {
        const encryptedStructures: EncryptedCredential[] = [];

        // Store all tokens and collect their encrypted structures
        for (const tokenInfo of encryptionData.tokens) {
          await encryptionTester.storeBotToken(tokenInfo.platform, tokenInfo.value);

          const storedData = await encryptionTester.getStoredTokenFile(tokenInfo.platform);
          expect(storedData).not.toBeNull();

          const encryptedStructure: EncryptedCredential = JSON.parse(storedData!);
          encryptedStructures.push(encryptedStructure);
        }

        // Verify all encrypted data uses consistent algorithms
        for (const encrypted of encryptedStructures) {
          // Should use AES-256-CBC algorithm
          expect(encrypted.algorithm).toBe('aes-256-cbc');

          // Should have proper IV length (16 bytes = 32 hex chars)
          expect(encrypted.iv).toMatch(/^[0-9a-fA-F]{32}$/);

          // Should use PBKDF2 with sufficient iterations
          expect(encrypted.keyDerivation.iterations).toBeGreaterThanOrEqual(100000);

          // Should have proper salt length (32 bytes = 64 hex chars)
          expect(encrypted.keyDerivation.salt).toMatch(/^[0-9a-fA-F]{64}$/);

          // Encrypted data should be hex-encoded
          expect(encrypted.encrypted).toMatch(/^[0-9a-fA-F]+$/);

          // Encrypted data should have reasonable length (not empty, not too short)
          expect(encrypted.encrypted.length).toBeGreaterThan(0);
        }
      }
    ), { numRuns: 15 });
  });
});

/**
 * Integration test helper for testing encryption in real scenarios
 */
export class UniversalEncryptionTester {
  private configManager: ConfigManager;
  private testDir: string;

  constructor(testDir?: string) {
    this.testDir = testDir || path.join(os.tmpdir(), `everfern-encryption-integration-${Date.now()}`);
    this.configManager = new ConfigManager();

    // Override directories for testing
    (this.configManager as any).configDir = this.testDir;
    (this.configManager as any).integrationsDir = path.join(this.testDir, 'integrations');
    (this.configManager as any).backupsDir = path.join(this.testDir, 'integrations', 'backups');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.testDir, { recursive: true });
    await this.configManager.initialize();
  }

  /**
   * Test encryption for a complete integration workflow
   */
  async testIntegrationEncryption(
    telegramToken: string,
    discordToken: string
  ): Promise<{
    encrypted: boolean;
    consistent: boolean;
    secure: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let encrypted = true;
    let consistent = true;
    let secure = true;

    try {
      // Store tokens
      await this.configManager.storeBotToken('telegram', telegramToken);
      await this.configManager.storeBotToken('discord', discordToken);

      // Check if tokens are encrypted in storage
      const telegramFile = path.join(this.testDir, 'integrations', 'telegram.key');
      const discordFile = path.join(this.testDir, 'integrations', 'discord.key');

      const telegramData = await fs.readFile(telegramFile, 'utf-8');
      const discordData = await fs.readFile(discordFile, 'utf-8');

      if (!isDataEncrypted(telegramData) || !isDataEncrypted(discordData)) {
        encrypted = false;
        errors.push('Tokens are not properly encrypted in storage');
      }

      // Check if plaintext tokens are not present
      if (telegramData.includes(telegramToken) || discordData.includes(discordToken)) {
        secure = false;
        errors.push('Plaintext tokens found in storage files');
      }

      // Test retrieval consistency
      const retrievedTelegram = await this.configManager.retrieveBotToken('telegram');
      const retrievedDiscord = await this.configManager.retrieveBotToken('discord');

      if (retrievedTelegram !== telegramToken || retrievedDiscord !== discordToken) {
        consistent = false;
        errors.push('Retrieved tokens do not match original tokens');
      }

      // Test backup encryption
      const backupPath = await this.configManager.createBackup('Test backup');
      const backupData = await fs.readFile(backupPath, 'utf-8');

      if (backupData.includes(telegramToken) || backupData.includes(discordToken)) {
        secure = false;
        errors.push('Plaintext tokens found in backup files');
      }

      return { encrypted, consistent, secure, errors };
    } catch (error) {
      errors.push(`Integration test failed: ${error}`);
      return { encrypted: false, consistent: false, secure: false, errors };
    }
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
