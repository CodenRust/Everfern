/**
 * Integration Tests for ConfigManager Backup and Restore Functionality
 *
 * Tests the new backup/restore features added in Task 9.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../config-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ConfigManager Backup and Restore Integration', () => {
  let configManager: ConfigManager;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `config-manager-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Mock homedir to use our test directory
    const originalHomedir = os.homedir;
    os.homedir = () => testDir;

    configManager = new ConfigManager();
    await configManager.initialize();

    // Restore original homedir after initialization
    os.homedir = originalHomedir;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create and list configuration backups', async () => {
    // Create a backup
    const backupPath = await configManager.createBackup('Test backup');

    expect(backupPath).toContain('backup-');
    expect(backupPath.endsWith('.json')).toBe(true);

    // Verify backup file exists
    const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);

    // List backups
    const backups = await configManager.listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].description).toBe('Test backup');
    expect(backups[0].version).toBe('1.0.0');
  });

  it('should restore configuration from backup', async () => {
    // Modify configuration
    await configManager.updateConfig({
      autoStart: { enabled: true, minimizeToTray: false }
    });

    let config = configManager.getConfig();
    expect(config.autoStart.enabled).toBe(true);

    // Create backup
    const backupPath = await configManager.createBackup('Before restore test');

    // Modify configuration again
    await configManager.updateConfig({
      autoStart: { enabled: false, minimizeToTray: true }
    });

    config = configManager.getConfig();
    expect(config.autoStart.enabled).toBe(false);

    // Restore from backup
    await configManager.restoreFromBackup(backupPath);

    // Verify configuration was restored
    config = configManager.getConfig();
    expect(config.autoStart.enabled).toBe(true);
    expect(config.autoStart.minimizeToTray).toBe(false);
  });

  it('should validate configuration on startup', async () => {
    const config = configManager.getConfig();
    const validation = configManager.validateConfiguration(config);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should clean old backups', async () => {
    // Create multiple backups
    await configManager.createBackup('Backup 1');
    await configManager.createBackup('Backup 2');
    await configManager.createBackup('Backup 3');

    let backups = await configManager.listBackups();
    expect(backups.length).toBeGreaterThanOrEqual(3);

    // Clean old backups, keeping only 2
    await configManager.cleanOldBackups(2);

    backups = await configManager.listBackups();
    expect(backups.length).toBeLessThanOrEqual(2);
  });

  it('should handle configuration validation errors gracefully', async () => {
    const invalidConfig = {
      autoStart: { enabled: false, minimizeToTray: true },
      integrations: {
        telegram: {
          enabled: true,
          groupSettings: { requireMention: true },
          fileHandling: {
            maxFileSize: -1, // Invalid
            allowedTypes: [],
            uploadEnabled: true,
            downloadEnabled: true
          }
        },
        discord: {
          enabled: false,
          serverSettings: { requireMention: true, respondInDMs: true },
          fileHandling: {
            maxFileSize: 25,
            allowedTypes: [],
            uploadEnabled: true,
            downloadEnabled: true
          }
        }
      },
      security: {
        allowedUsers: [],
        rateLimits: { messagesPerHour: 0, toolCallsPerDay: 1000 }, // Invalid
        encryptionEnabled: true
      }
    } as any;

    const validation = configManager.validateConfiguration(invalidConfig);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors).toContain('Telegram max file size must be greater than 0');
    expect(validation.errors).toContain('Messages per hour rate limit must be greater than 0');
  });
});
