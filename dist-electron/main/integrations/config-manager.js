"use strict";
/**
 * Secure Configuration Manager for Multi-Platform Integration
 *
 * This module provides secure storage and management of integration configurations,
 * including encrypted bot token storage using system keychain/credential manager.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
exports.createConfigManager = createConfigManager;
exports.getConfigManager = getConfigManager;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const fs_2 = require("fs");
/**
 * Main configuration manager class
 */
class ConfigManager extends events_1.EventEmitter {
    config;
    configDir;
    integrationsDir;
    backupsDir;
    encryptionKey = null;
    isInitialized = false;
    configVersion = '1.0.0';
    configWatcher = null;
    integrationsWatcher = null;
    watcherDebounceTimeout = null;
    lastConfigSnapshot = null;
    constructor() {
        super();
        this.configDir = path_1.default.join(os_1.default.homedir(), '.everfern');
        this.integrationsDir = path_1.default.join(this.configDir, 'integrations');
        this.backupsDir = path_1.default.join(this.integrationsDir, 'backups');
        this.config = this.getDefaultConfig();
    }
    /**
     * Initialize the configuration manager
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Create directories
            await fs_1.promises.mkdir(this.configDir, { recursive: true });
            await fs_1.promises.mkdir(this.integrationsDir, { recursive: true });
            await fs_1.promises.mkdir(this.backupsDir, { recursive: true });
            // Initialize encryption key
            await this.initializeEncryptionKey();
            // Load existing configuration with validation and fallback
            await this.loadConfigurationWithValidation();
            // Initialize file system watchers for real-time configuration updates
            await this.initializeFileWatchers();
            // Create initial configuration snapshot for change detection
            this.lastConfigSnapshot = JSON.stringify(this.config);
            this.isInitialized = true;
            this.emit('config-loaded', this.config);
            console.log('ConfigManager initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize ConfigManager:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return JSON.parse(JSON.stringify(this.config)); // Deep copy
    }
    /**
     * Update configuration
     */
    async updateConfig(updates) {
        try {
            // Create new configuration by merging updates
            const newConfig = { ...this.config, ...updates };
            // Apply changes with notifications
            await this.applyConfigurationChanges(newConfig, 'user');
            // Clean old backups (keep last 10)
            await this.cleanOldBackups(10);
            console.log('Configuration updated successfully');
        }
        catch (error) {
            console.error('Failed to update configuration:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Store bot token securely
     */
    async storeBotToken(platform, token) {
        try {
            if (!this.encryptionKey) {
                throw new Error('Encryption key not initialized');
            }
            // Encrypt the token
            const encrypted = await this.encryptCredential(token);
            // Store encrypted token to file
            const tokenPath = path_1.default.join(this.integrationsDir, `${platform}.key`);
            await fs_1.promises.writeFile(tokenPath, JSON.stringify(encrypted, null, 2), 'utf-8');
            // Set file permissions (owner read/write only)
            await fs_1.promises.chmod(tokenPath, 0o600);
            this.emit('credential-stored', platform);
            console.log(`Bot token stored securely for ${platform}`);
        }
        catch (error) {
            console.error(`Failed to store bot token for ${platform}:`, error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Retrieve bot token securely
     */
    async retrieveBotToken(platform) {
        try {
            if (!this.encryptionKey) {
                throw new Error('Encryption key not initialized');
            }
            const tokenPath = path_1.default.join(this.integrationsDir, `${platform}.key`);
            // Check if token file exists
            try {
                await fs_1.promises.access(tokenPath);
            }
            catch {
                return null; // Token not stored
            }
            // Read and decrypt token
            const encryptedData = await fs_1.promises.readFile(tokenPath, 'utf-8');
            const encrypted = JSON.parse(encryptedData);
            const token = await this.decryptCredential(encrypted);
            this.emit('credential-retrieved', platform);
            return token;
        }
        catch (error) {
            console.error(`Failed to retrieve bot token for ${platform}:`, error);
            this.emit('error', error);
            return null;
        }
    }
    /**
     * Delete stored bot token
     */
    async deleteBotToken(platform) {
        try {
            const tokenPath = path_1.default.join(this.integrationsDir, `${platform}.key`);
            try {
                await fs_1.promises.unlink(tokenPath);
                console.log(`Bot token deleted for ${platform}`);
            }
            catch (error) {
                // File might not exist, which is fine
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        catch (error) {
            console.error(`Failed to delete bot token for ${platform}:`, error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Validate configuration
     */
    validateConfiguration(config) {
        const errors = [];
        const warnings = [];
        // Validate basic structure
        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be a valid object');
            return { valid: false, errors, warnings };
        }
        // Validate autoStart section
        if (!config.autoStart || typeof config.autoStart !== 'object') {
            errors.push('autoStart configuration is missing or invalid');
        }
        else {
            if (typeof config.autoStart.enabled !== 'boolean') {
                errors.push('autoStart.enabled must be a boolean');
            }
            if (typeof config.autoStart.minimizeToTray !== 'boolean') {
                errors.push('autoStart.minimizeToTray must be a boolean');
            }
        }
        // Validate integrations section
        if (!config.integrations || typeof config.integrations !== 'object') {
            errors.push('integrations configuration is missing or invalid');
            return { valid: false, errors, warnings };
        }
        // Validate Telegram configuration
        if (config.integrations?.telegram) {
            const telegram = config.integrations.telegram;
            if (typeof telegram.enabled !== 'boolean') {
                errors.push('Telegram enabled flag must be a boolean');
            }
            if (telegram.enabled) {
                if (!telegram.fileHandling?.maxFileSize || telegram.fileHandling.maxFileSize <= 0) {
                    errors.push('Telegram max file size must be greater than 0');
                }
                if (telegram.fileHandling?.maxFileSize > 50) {
                    warnings.push('Telegram max file size exceeds recommended limit of 50MB');
                }
                if (!telegram.fileHandling?.allowedTypes?.length) {
                    warnings.push('No allowed file types specified for Telegram');
                }
                if (!telegram.groupSettings || typeof telegram.groupSettings !== 'object') {
                    errors.push('Telegram groupSettings configuration is missing or invalid');
                }
                else {
                    if (typeof telegram.groupSettings.requireMention !== 'boolean') {
                        errors.push('Telegram groupSettings.requireMention must be a boolean');
                    }
                }
            }
        }
        // Validate Discord configuration
        if (config.integrations?.discord) {
            const discord = config.integrations.discord;
            if (typeof discord.enabled !== 'boolean') {
                errors.push('Discord enabled flag must be a boolean');
            }
            if (discord.enabled) {
                if (!discord.fileHandling?.maxFileSize || discord.fileHandling.maxFileSize <= 0) {
                    errors.push('Discord max file size must be greater than 0');
                }
                if (discord.fileHandling?.maxFileSize > 25) {
                    errors.push('Discord max file size cannot exceed 25MB (Discord limit)');
                }
                if (!discord.fileHandling?.allowedTypes?.length) {
                    warnings.push('No allowed file types specified for Discord');
                }
                if (!discord.serverSettings || typeof discord.serverSettings !== 'object') {
                    errors.push('Discord serverSettings configuration is missing or invalid');
                }
                else {
                    if (typeof discord.serverSettings.requireMention !== 'boolean') {
                        errors.push('Discord serverSettings.requireMention must be a boolean');
                    }
                    if (typeof discord.serverSettings.respondInDMs !== 'boolean') {
                        errors.push('Discord serverSettings.respondInDMs must be a boolean');
                    }
                }
            }
        }
        // Validate security settings
        if (!config.security || typeof config.security !== 'object') {
            errors.push('security configuration is missing or invalid');
        }
        else {
            if (!config.security.rateLimits || typeof config.security.rateLimits !== 'object') {
                errors.push('security.rateLimits configuration is missing or invalid');
            }
            else {
                if (!config.security.rateLimits.messagesPerHour || config.security.rateLimits.messagesPerHour <= 0) {
                    errors.push('Messages per hour rate limit must be greater than 0');
                }
                if (!config.security.rateLimits.toolCallsPerDay || config.security.rateLimits.toolCallsPerDay <= 0) {
                    errors.push('Tool calls per day rate limit must be greater than 0');
                }
            }
            if (typeof config.security.encryptionEnabled !== 'boolean') {
                errors.push('security.encryptionEnabled must be a boolean');
            }
            if (!Array.isArray(config.security.allowedUsers)) {
                errors.push('security.allowedUsers must be an array');
            }
        }
        const result = {
            valid: errors.length === 0,
            errors,
            warnings
        };
        this.emit('config-validated', result);
        return result;
    }
    /**
     * Reset configuration to defaults
     */
    async resetConfiguration() {
        try {
            // Create backup before reset
            await this.createBackup('Pre-reset backup');
            // Reset to defaults
            this.config = this.getDefaultConfig();
            await this.saveConfiguration();
            // Delete stored tokens
            await this.deleteBotToken('telegram');
            await this.deleteBotToken('discord');
            this.emit('config-saved', this.config);
            console.log('Configuration reset to defaults');
        }
        catch (error) {
            console.error('Failed to reset configuration:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Export configuration (without sensitive data)
     */
    async exportConfiguration() {
        const exportConfig = JSON.parse(JSON.stringify(this.config));
        // Remove sensitive data
        delete exportConfig.integrations.telegram.botToken;
        delete exportConfig.integrations.discord.botToken;
        return JSON.stringify(exportConfig, null, 2);
    }
    /**
     * Import configuration
     */
    async importConfiguration(configJson) {
        try {
            const importedConfig = JSON.parse(configJson);
            // Validate imported configuration
            const validation = this.validateConfiguration(importedConfig);
            if (!validation.valid) {
                throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
            }
            // Merge with current config (preserving tokens)
            const currentTokens = {
                telegram: await this.retrieveBotToken('telegram'),
                discord: await this.retrieveBotToken('discord')
            };
            this.config = importedConfig;
            // Restore tokens if they existed
            if (currentTokens.telegram) {
                await this.storeBotToken('telegram', currentTokens.telegram);
            }
            if (currentTokens.discord) {
                await this.storeBotToken('discord', currentTokens.discord);
            }
            await this.saveConfiguration();
            this.emit('config-saved', this.config);
            console.log('Configuration imported successfully');
        }
        catch (error) {
            console.error('Failed to import configuration:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Create configuration backup with metadata
     */
    async createBackup(description) {
        try {
            const timestamp = new Date().toISOString();
            const backupId = `backup-${timestamp.replace(/[:.]/g, '-')}`;
            // Get current configuration for backup
            const configForBackup = JSON.parse(JSON.stringify(this.config));
            // Remove sensitive data from backup
            delete configForBackup.integrations.telegram.botToken;
            delete configForBackup.integrations.discord.botToken;
            // Create backup metadata
            const metadata = {
                timestamp,
                version: this.configVersion,
                description: description || `Automatic backup created on ${new Date().toLocaleString()}`,
                platforms: [
                    ...(this.config.integrations.telegram.enabled ? ['telegram'] : []),
                    ...(this.config.integrations.discord.enabled ? ['discord'] : [])
                ],
                size: JSON.stringify(configForBackup).length
            };
            // Create backup object
            const backup = {
                metadata,
                config: configForBackup
            };
            // Save backup to file
            const backupPath = path_1.default.join(this.backupsDir, `${backupId}.json`);
            await fs_1.promises.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
            // Set file permissions (owner read/write only)
            await fs_1.promises.chmod(backupPath, 0o600);
            this.emit('config-backup-created', backupPath, metadata);
            console.log(`Configuration backup created: ${backupPath}`);
            return backupPath;
        }
        catch (error) {
            console.error('Failed to create configuration backup:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * List available configuration backups
     */
    async listBackups() {
        try {
            const backupFiles = await fs_1.promises.readdir(this.backupsDir);
            const backups = [];
            for (const file of backupFiles) {
                if (file.endsWith('.json')) {
                    try {
                        const backupPath = path_1.default.join(this.backupsDir, file);
                        const backupData = await fs_1.promises.readFile(backupPath, 'utf-8');
                        const backup = JSON.parse(backupData);
                        backups.push(backup.metadata);
                    }
                    catch (error) {
                        console.warn(`Failed to read backup file ${file}:`, error);
                    }
                }
            }
            // Sort by timestamp (newest first)
            return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        catch (error) {
            console.error('Failed to list configuration backups:', error);
            return [];
        }
    }
    /**
     * Restore configuration from backup
     */
    async restoreFromBackup(backupPath) {
        try {
            // Read backup file
            const backupData = await fs_1.promises.readFile(backupPath, 'utf-8');
            const backup = JSON.parse(backupData);
            // Validate backup structure
            if (!backup.metadata || !backup.config) {
                throw new Error('Invalid backup file structure');
            }
            // Validate configuration
            const validation = this.validateConfiguration(backup.config);
            if (!validation.valid) {
                throw new Error(`Invalid backup configuration: ${validation.errors.join(', ')}`);
            }
            // Create backup of current configuration before restore
            await this.createBackup('Pre-restore backup');
            // Preserve current bot tokens
            const currentTokens = {
                telegram: await this.retrieveBotToken('telegram'),
                discord: await this.retrieveBotToken('discord')
            };
            // Restore configuration
            this.config = backup.config;
            // Restore tokens if they existed
            if (currentTokens.telegram) {
                await this.storeBotToken('telegram', currentTokens.telegram);
            }
            if (currentTokens.discord) {
                await this.storeBotToken('discord', currentTokens.discord);
            }
            // Save restored configuration
            await this.saveConfiguration();
            this.emit('config-restored', backupPath, backup.metadata);
            this.emit('config-saved', this.config);
            console.log(`Configuration restored from backup: ${backupPath}`);
        }
        catch (error) {
            console.error('Failed to restore configuration from backup:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Delete configuration backup
     */
    async deleteBackup(backupPath) {
        try {
            await fs_1.promises.unlink(backupPath);
            console.log(`Configuration backup deleted: ${backupPath}`);
        }
        catch (error) {
            console.error('Failed to delete configuration backup:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Clean old backups (keep only the most recent N backups)
     */
    async cleanOldBackups(keepCount = 10) {
        try {
            const backups = await this.listBackups();
            if (backups.length <= keepCount) {
                return; // Nothing to clean
            }
            // Delete old backups (keep only the most recent ones)
            const backupsToDelete = backups.slice(keepCount);
            for (const backup of backupsToDelete) {
                const backupFileName = `backup-${backup.timestamp.replace(/[:.]/g, '-')}.json`;
                const backupPath = path_1.default.join(this.backupsDir, backupFileName);
                try {
                    await this.deleteBackup(backupPath);
                }
                catch (error) {
                    console.warn(`Failed to delete old backup ${backupPath}:`, error);
                }
            }
            console.log(`Cleaned ${backupsToDelete.length} old configuration backups`);
        }
        catch (error) {
            console.error('Failed to clean old backups:', error);
            this.emit('error', error);
        }
    }
    /**
     * Enable real-time configuration change notifications
     */
    async enableChangeNotifications() {
        if (!this.isInitialized) {
            throw new Error('ConfigManager must be initialized before enabling change notifications');
        }
        await this.initializeFileWatchers();
        console.log('Configuration change notifications enabled');
    }
    /**
     * Disable real-time configuration change notifications
     */
    async disableChangeNotifications() {
        await this.cleanupFileWatchers();
        console.log('Configuration change notifications disabled');
    }
    /**
     * Detect changes between current and new configuration
     */
    detectConfigurationChanges(newConfig) {
        const changes = [];
        const oldConfig = this.config;
        // Helper function to recursively compare objects
        const compareObjects = (oldObj, newObj, basePath = '') => {
            const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
            for (const key of allKeys) {
                const currentPath = basePath ? `${basePath}.${key}` : key;
                const oldValue = oldObj?.[key];
                const newValue = newObj?.[key];
                if (oldValue === undefined && newValue !== undefined) {
                    changes.push({
                        path: currentPath,
                        oldValue: undefined,
                        newValue,
                        type: 'added'
                    });
                }
                else if (oldValue !== undefined && newValue === undefined) {
                    changes.push({
                        path: currentPath,
                        oldValue,
                        newValue: undefined,
                        type: 'removed'
                    });
                }
                else if (oldValue !== newValue) {
                    if (typeof oldValue === 'object' && typeof newValue === 'object' &&
                        oldValue !== null && newValue !== null &&
                        !Array.isArray(oldValue) && !Array.isArray(newValue)) {
                        // Recursively compare nested objects
                        compareObjects(oldValue, newValue, currentPath);
                    }
                    else {
                        changes.push({
                            path: currentPath,
                            oldValue,
                            newValue,
                            type: 'modified'
                        });
                    }
                }
            }
        };
        compareObjects(oldConfig, newConfig);
        // Determine if restart is required based on critical configuration changes
        const requiresRestart = this.determineRestartRequirement(changes);
        return {
            hasChanges: changes.length > 0,
            changes,
            requiresRestart
        };
    }
    /**
     * Apply configuration changes with notifications
     */
    async applyConfigurationChanges(newConfig, source = 'user') {
        try {
            // Detect changes
            const diff = this.detectConfigurationChanges(newConfig);
            if (!diff.hasChanges) {
                console.log('No configuration changes detected');
                return;
            }
            // Emit change detection event
            this.emit('config-change-detected', diff);
            // Validate new configuration
            const validation = this.validateConfiguration(newConfig);
            if (!validation.valid) {
                const notification = {
                    type: 'config-validation-failed',
                    changes: diff.changes,
                    timestamp: new Date(),
                    requiresRestart: false,
                    message: `Configuration validation failed: ${validation.errors.join(', ')}`
                };
                this.emit('config-changed', notification);
                throw new Error(notification.message);
            }
            // Create backup before applying changes
            await this.createBackup(`Pre-change backup (${source})`);
            // Apply configuration changes
            const oldConfig = JSON.parse(JSON.stringify(this.config));
            this.config = newConfig;
            // Save to disk
            await this.saveConfiguration();
            // Update configuration snapshot
            this.lastConfigSnapshot = JSON.stringify(this.config);
            // Create and emit change notification
            const notification = {
                type: diff.requiresRestart ? 'integration-restart-required' : 'config-changed',
                platform: this.determinePlatformFromChanges(diff.changes),
                changes: diff.changes,
                timestamp: new Date(),
                requiresRestart: diff.requiresRestart,
                message: this.generateChangeMessage(diff.changes, diff.requiresRestart)
            };
            this.emit('config-changed', notification);
            // Emit restart required event if needed
            if (diff.requiresRestart) {
                const affectedPlatforms = this.getAffectedPlatforms(diff.changes);
                for (const platform of affectedPlatforms) {
                    this.emit('integration-restart-required', platform, 'Configuration changes require restart');
                }
            }
            console.log(`Configuration changes applied successfully (${diff.changes.length} changes)`);
        }
        catch (error) {
            console.error('Failed to apply configuration changes:', error);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * Force refresh configuration from disk
     */
    async refreshConfiguration() {
        try {
            console.log('Refreshing configuration from disk...');
            // Load configuration from disk
            const configPath = path_1.default.join(this.integrationsDir, 'config.json');
            try {
                await fs_1.promises.access(configPath);
            }
            catch {
                console.log('No configuration file found, using current config');
                return;
            }
            const configData = await fs_1.promises.readFile(configPath, 'utf-8');
            const diskConfig = JSON.parse(configData);
            // Merge with defaults and validate
            const mergedConfig = this.mergeWithDefaults(diskConfig);
            const validation = this.validateConfiguration(mergedConfig);
            if (!validation.valid) {
                console.warn('Configuration on disk is invalid, keeping current config');
                return;
            }
            // Apply changes if different
            const currentSnapshot = JSON.stringify(this.config);
            const newSnapshot = JSON.stringify(mergedConfig);
            if (currentSnapshot !== newSnapshot) {
                await this.applyConfigurationChanges(mergedConfig, 'external');
            }
        }
        catch (error) {
            console.error('Failed to refresh configuration:', error);
            this.emit('error', error);
        }
    }
    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            autoStart: {
                enabled: false,
                minimizeToTray: true
            },
            integrations: {
                telegram: {
                    enabled: false,
                    allowedUsers: [],
                    groupSettings: {
                        requireMention: true,
                        allowedGroups: []
                    },
                    fileHandling: {
                        maxFileSize: 50, // MB
                        allowedTypes: [
                            'image/jpeg',
                            'image/png',
                            'image/gif',
                            'image/webp',
                            'text/plain',
                            'application/pdf',
                            'application/json'
                        ],
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
                        respondInDMs: true
                    },
                    fileHandling: {
                        maxFileSize: 25, // MB (Discord limit)
                        allowedTypes: [
                            'image/jpeg',
                            'image/png',
                            'image/gif',
                            'image/webp',
                            'text/plain',
                            'application/pdf',
                            'application/json'
                        ],
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
    }
    /**
     * Initialize encryption key
     */
    async initializeEncryptionKey() {
        try {
            const keyPath = path_1.default.join(this.configDir, '.encryption-key');
            // Try to load existing key
            try {
                const keyData = await fs_1.promises.readFile(keyPath);
                this.encryptionKey = keyData;
                return;
            }
            catch {
                // Key doesn't exist, create new one
            }
            // Generate new encryption key
            this.encryptionKey = crypto_1.default.randomBytes(32);
            // Save key to file with restricted permissions
            await fs_1.promises.writeFile(keyPath, this.encryptionKey);
            await fs_1.promises.chmod(keyPath, 0o600);
            console.log('New encryption key generated and stored');
        }
        catch (error) {
            console.error('Failed to initialize encryption key:', error);
            throw error;
        }
    }
    /**
     * Encrypt credential
     */
    async encryptCredential(credential) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not available');
        }
        const algorithm = 'aes-256-cbc';
        const iv = crypto_1.default.randomBytes(16);
        const salt = crypto_1.default.randomBytes(32);
        const iterations = 100000;
        // Derive key from master key and salt
        const derivedKey = crypto_1.default.pbkdf2Sync(this.encryptionKey, salt, iterations, 32, 'sha256');
        // Encrypt
        const cipher = crypto_1.default.createCipheriv(algorithm, derivedKey, iv);
        let encrypted = cipher.update(credential, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return {
            encrypted,
            iv: iv.toString('hex'),
            algorithm,
            keyDerivation: {
                salt: salt.toString('hex'),
                iterations
            }
        };
    }
    /**
     * Decrypt credential
     */
    async decryptCredential(encrypted) {
        if (!this.encryptionKey) {
            throw new Error('Encryption key not available');
        }
        const salt = Buffer.from(encrypted.keyDerivation.salt, 'hex');
        const iv = Buffer.from(encrypted.iv, 'hex');
        // Derive key from master key and salt
        const derivedKey = crypto_1.default.pbkdf2Sync(this.encryptionKey, salt, encrypted.keyDerivation.iterations, 32, 'sha256');
        // Decrypt
        const decipher = crypto_1.default.createDecipheriv(encrypted.algorithm, derivedKey, iv);
        let decrypted = decipher.update(encrypted.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Load configuration from disk with validation and graceful failure handling
     */
    async loadConfigurationWithValidation() {
        try {
            const configPath = path_1.default.join(this.integrationsDir, 'config.json');
            // Check if config file exists
            try {
                await fs_1.promises.access(configPath);
            }
            catch {
                // Config doesn't exist, use defaults and save
                console.log('No existing configuration found, using defaults');
                await this.saveConfiguration();
                return;
            }
            // Load configuration
            const configData = await fs_1.promises.readFile(configPath, 'utf-8');
            let loadedConfig;
            try {
                loadedConfig = JSON.parse(configData);
            }
            catch (parseError) {
                console.error('Configuration file is corrupted (invalid JSON):', parseError);
                await this.handleConfigurationLoadingFailure(parseError, 'corrupted');
                return;
            }
            // Merge with defaults to ensure all properties exist
            const mergedConfig = this.mergeWithDefaults(loadedConfig);
            // Validate configuration
            const validation = this.validateConfiguration(mergedConfig);
            if (!validation.valid) {
                console.error('Configuration validation failed:', validation.errors);
                await this.handleConfigurationLoadingFailure(new Error(`Configuration validation failed: ${validation.errors.join(', ')}`), 'invalid');
                return;
            }
            // Log warnings if any
            if (validation.warnings.length > 0) {
                console.warn('Configuration warnings:', validation.warnings);
            }
            // Configuration is valid, use it
            this.config = mergedConfig;
            // Load bot tokens
            try {
                const telegramToken = await this.retrieveBotToken('telegram');
                const discordToken = await this.retrieveBotToken('discord');
                if (telegramToken) {
                    this.config.integrations.telegram.botToken = telegramToken;
                }
                if (discordToken) {
                    this.config.integrations.discord.botToken = discordToken;
                }
            }
            catch (tokenError) {
                console.warn('Failed to load bot tokens:', tokenError);
                // Continue with configuration loading even if tokens fail
            }
            console.log('Configuration loaded and validated successfully');
        }
        catch (error) {
            console.error('Unexpected error during configuration loading:', error);
            await this.handleConfigurationLoadingFailure(error, 'unexpected');
        }
    }
    /**
     * Handle configuration loading failures gracefully
     */
    async handleConfigurationLoadingFailure(error, reason) {
        console.log(`Handling configuration loading failure (${reason}):`, error.message);
        let fallbackUsed = false;
        try {
            // Try to restore from the most recent backup
            const backups = await this.listBackups();
            if (backups.length > 0) {
                const latestBackup = backups[0];
                const backupFileName = `backup-${latestBackup.timestamp.replace(/[:.]/g, '-')}.json`;
                const backupPath = path_1.default.join(this.backupsDir, backupFileName);
                try {
                    console.log(`Attempting to restore from backup: ${backupPath}`);
                    // Read and validate backup
                    const backupData = await fs_1.promises.readFile(backupPath, 'utf-8');
                    const backup = JSON.parse(backupData);
                    const validation = this.validateConfiguration(backup.config);
                    if (validation.valid) {
                        this.config = backup.config;
                        fallbackUsed = true;
                        console.log('Successfully restored configuration from backup');
                    }
                    else {
                        throw new Error('Backup configuration is also invalid');
                    }
                }
                catch (backupError) {
                    console.warn('Failed to restore from backup:', backupError);
                }
            }
            // If backup restore failed or no backups available, use defaults
            if (!fallbackUsed) {
                console.log('Using default configuration as fallback');
                this.config = this.getDefaultConfig();
                fallbackUsed = true;
            }
            // Save the fallback configuration
            await this.saveConfiguration();
            // Emit event about the failure and fallback
            this.emit('config-loading-failed', error, fallbackUsed);
        }
        catch (fallbackError) {
            console.error('Failed to apply fallback configuration:', fallbackError);
            // Last resort: use defaults without saving
            this.config = this.getDefaultConfig();
            this.emit('config-loading-failed', error, false);
        }
    }
    /**
     * Save configuration to disk
     */
    async saveConfiguration() {
        try {
            const configPath = path_1.default.join(this.integrationsDir, 'config.json');
            // Create config without sensitive data
            const saveConfig = JSON.parse(JSON.stringify(this.config));
            delete saveConfig.integrations.telegram.botToken;
            delete saveConfig.integrations.discord.botToken;
            // Save configuration
            await fs_1.promises.writeFile(configPath, JSON.stringify(saveConfig, null, 2), 'utf-8');
            console.log('Configuration saved successfully');
        }
        catch (error) {
            console.error('Failed to save configuration:', error);
            throw error;
        }
    }
    /**
     * Merge loaded config with defaults
     */
    mergeWithDefaults(loadedConfig) {
        const defaults = this.getDefaultConfig();
        // Deep merge function
        const deepMerge = (target, source) => {
            const result = { ...target };
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = deepMerge(target[key] || {}, source[key]);
                }
                else {
                    result[key] = source[key];
                }
            }
            return result;
        };
        return deepMerge(defaults, loadedConfig);
    }
    /**
     * Initialize file system watchers for configuration changes
     */
    async initializeFileWatchers() {
        try {
            // Clean up existing watchers
            await this.cleanupFileWatchers();
            const configPath = path_1.default.join(this.integrationsDir, 'config.json');
            // Watch main configuration file
            this.configWatcher = (0, fs_2.watch)(configPath, { persistent: false }, (eventType, filename) => {
                if (filename && eventType === 'change') {
                    this.handleConfigFileChange(path_1.default.join(this.integrationsDir, filename));
                }
            });
            // Watch integrations directory for token file changes
            this.integrationsWatcher = (0, fs_2.watch)(this.integrationsDir, { persistent: false }, (eventType, filename) => {
                if (filename && (filename.endsWith('.key') || filename === 'config.json')) {
                    this.handleConfigFileChange(path_1.default.join(this.integrationsDir, filename));
                }
            });
            console.log('File system watchers initialized for configuration monitoring');
        }
        catch (error) {
            console.warn('Failed to initialize file system watchers:', error);
            // Don't throw error - file watching is optional
        }
    }
    /**
     * Clean up file system watchers
     */
    async cleanupFileWatchers() {
        if (this.configWatcher) {
            this.configWatcher.close();
            this.configWatcher = null;
        }
        if (this.integrationsWatcher) {
            this.integrationsWatcher.close();
            this.integrationsWatcher = null;
        }
        if (this.watcherDebounceTimeout) {
            clearTimeout(this.watcherDebounceTimeout);
            this.watcherDebounceTimeout = null;
        }
    }
    /**
     * Handle configuration file changes with debouncing
     */
    handleConfigFileChange(filePath) {
        // Debounce file change events to avoid excessive processing
        if (this.watcherDebounceTimeout) {
            clearTimeout(this.watcherDebounceTimeout);
        }
        this.watcherDebounceTimeout = setTimeout(async () => {
            try {
                console.log(`Configuration file changed: ${filePath}`);
                this.emit('external-config-changed', filePath);
                // Only refresh for main config file changes
                if (path_1.default.basename(filePath) === 'config.json') {
                    await this.refreshConfiguration();
                }
            }
            catch (error) {
                console.error('Error handling configuration file change:', error);
                this.emit('error', error);
            }
        }, 500); // 500ms debounce
    }
    /**
     * Determine if configuration changes require integration restart
     */
    determineRestartRequirement(changes) {
        const restartRequiredPaths = [
            'integrations.telegram.enabled',
            'integrations.discord.enabled',
            'integrations.telegram.botToken',
            'integrations.discord.botToken',
            'integrations.telegram.webhookUrl',
            'integrations.discord.applicationId',
            'security.encryptionEnabled'
        ];
        return changes.some(change => restartRequiredPaths.some(path => change.path.startsWith(path)));
    }
    /**
     * Determine affected platform from configuration changes
     */
    determinePlatformFromChanges(changes) {
        const telegramChanges = changes.some(change => change.path.startsWith('integrations.telegram'));
        const discordChanges = changes.some(change => change.path.startsWith('integrations.discord'));
        const globalChanges = changes.some(change => change.path.startsWith('autoStart') ||
            change.path.startsWith('security'));
        if (globalChanges || (telegramChanges && discordChanges)) {
            return 'all';
        }
        else if (telegramChanges) {
            return 'telegram';
        }
        else if (discordChanges) {
            return 'discord';
        }
        return undefined;
    }
    /**
     * Get affected platforms from configuration changes
     */
    getAffectedPlatforms(changes) {
        const platforms = new Set();
        for (const change of changes) {
            if (change.path.startsWith('integrations.telegram')) {
                platforms.add('telegram');
            }
            else if (change.path.startsWith('integrations.discord')) {
                platforms.add('discord');
            }
        }
        return Array.from(platforms);
    }
    /**
     * Generate human-readable change message
     */
    generateChangeMessage(changes, requiresRestart) {
        const changeCount = changes.length;
        const platforms = this.getAffectedPlatforms(changes);
        let message = `${changeCount} configuration change${changeCount > 1 ? 's' : ''} detected`;
        if (platforms.length > 0) {
            message += ` affecting ${platforms.join(' and ')}`;
        }
        if (requiresRestart) {
            message += '. Integration restart required to apply changes.';
        }
        else {
            message += '. Changes applied successfully.';
        }
        return message;
    }
}
exports.ConfigManager = ConfigManager;
/**
 * Create a configuration manager instance
 */
function createConfigManager() {
    return new ConfigManager();
}
/**
 * Global configuration manager instance
 */
let globalConfigManager = null;
/**
 * Get or create global configuration manager
 */
function getConfigManager() {
    if (!globalConfigManager) {
        globalConfigManager = createConfigManager();
    }
    return globalConfigManager;
}
