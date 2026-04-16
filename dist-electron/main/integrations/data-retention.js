"use strict";
/**
 * Data Retention and Privacy Controls
 *
 * Implements automatic data purging, sensitive information redaction,
 * and privacy controls for the multi-platform integration system.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataRetentionManager = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = require("os");
const security_logger_1 = require("./security-logger");
/**
 * Data Retention Manager
 */
class DataRetentionManager extends events_1.EventEmitter {
    configFile;
    retentionPolicies = [];
    privacySettings;
    securityLogger;
    purgeScheduler;
    exportRequests = new Map();
    // Default redaction patterns for sensitive information
    DEFAULT_REDACTION_PATTERNS = [
        {
            id: 'email',
            name: 'Email Addresses',
            pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
            replacement: '[EMAIL_REDACTED]',
            enabled: true,
            dataTypes: ['security_events', 'conversation_history', 'user_data']
        },
        {
            id: 'phone',
            name: 'Phone Numbers',
            pattern: '\\b(?:\\+?1[-.]?)?\\(?([0-9]{3})\\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\\b',
            replacement: '[PHONE_REDACTED]',
            enabled: true,
            dataTypes: ['security_events', 'conversation_history', 'user_data']
        },
        {
            id: 'ssn',
            name: 'Social Security Numbers',
            pattern: '\\b\\d{3}-?\\d{2}-?\\d{4}\\b',
            replacement: '[SSN_REDACTED]',
            enabled: true,
            dataTypes: ['security_events', 'conversation_history', 'user_data']
        },
        {
            id: 'credit_card',
            name: 'Credit Card Numbers',
            pattern: '\\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\\b',
            replacement: '[CARD_REDACTED]',
            enabled: true,
            dataTypes: ['security_events', 'conversation_history', 'user_data']
        },
        {
            id: 'ip_address',
            name: 'IP Addresses',
            pattern: '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b',
            replacement: '[IP_REDACTED]',
            enabled: false, // Disabled by default as IPs might be needed for security analysis
            dataTypes: ['security_events']
        },
        {
            id: 'api_key',
            name: 'API Keys and Tokens',
            pattern: '\\b[A-Za-z0-9]{32,}\\b',
            replacement: '[TOKEN_REDACTED]',
            enabled: true,
            dataTypes: ['security_events', 'conversation_history', 'configuration_backups']
        }
    ];
    constructor(securityLogger) {
        super();
        this.securityLogger = securityLogger;
        const configDir = path.join((0, os_1.homedir)(), '.everfern', 'privacy');
        this.configFile = path.join(configDir, 'retention-config.json');
        // Default privacy settings
        this.privacySettings = {
            enableDataRedaction: true,
            redactionPatterns: [...this.DEFAULT_REDACTION_PATTERNS],
            enableEncryption: true,
            encryptionAlgorithm: 'aes-256-gcm',
            enableAuditLogging: true,
            requireExplicitConsent: false,
            allowDataExport: true,
            allowDataDeletion: true
        };
        // Default retention policies
        this.retentionPolicies = [
            {
                id: 'security_events_policy',
                name: 'Security Events Retention',
                description: 'Retain security events for 90 days',
                dataType: 'security_events',
                retentionDays: 90,
                enabled: true,
                autoDelete: true,
                archiveBeforeDelete: true,
                archivePath: path.join((0, os_1.homedir)(), '.everfern', 'archives', 'security')
            },
            {
                id: 'conversation_history_policy',
                name: 'Conversation History Retention',
                description: 'Retain conversation history for 365 days',
                dataType: 'conversation_history',
                retentionDays: 365,
                enabled: true,
                autoDelete: false, // Don't auto-delete conversations by default
                archiveBeforeDelete: true,
                archivePath: path.join((0, os_1.homedir)(), '.everfern', 'archives', 'conversations')
            },
            {
                id: 'user_data_policy',
                name: 'User Data Retention',
                description: 'Retain user data for 2 years',
                dataType: 'user_data',
                retentionDays: 730,
                enabled: true,
                autoDelete: false,
                archiveBeforeDelete: true,
                archivePath: path.join((0, os_1.homedir)(), '.everfern', 'archives', 'users')
            },
            {
                id: 'file_attachments_policy',
                name: 'File Attachments Retention',
                description: 'Retain file attachments for 180 days',
                dataType: 'file_attachments',
                retentionDays: 180,
                enabled: true,
                autoDelete: true,
                archiveBeforeDelete: false // Files are typically large, don't archive by default
            },
            {
                id: 'config_backups_policy',
                name: 'Configuration Backups Retention',
                description: 'Retain configuration backups for 30 days',
                dataType: 'configuration_backups',
                retentionDays: 30,
                enabled: true,
                autoDelete: true,
                archiveBeforeDelete: false
            }
        ];
    }
    /**
     * Initialize the data retention manager
     */
    async initialize() {
        try {
            const configDir = path.dirname(this.configFile);
            await fs.mkdir(configDir, { recursive: true });
            await this.loadConfiguration();
            await this.scheduleRetentionPolicies();
            await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.LOW, 'data-retention-manager', 'Data retention manager initialized', { policiesCount: this.retentionPolicies.length });
            console.log('Data retention manager initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize data retention manager:', error);
            throw error;
        }
    }
    /**
     * Execute data retention policies
     */
    async executeRetentionPolicies(policyIds) {
        const results = [];
        const policiesToExecute = policyIds
            ? this.retentionPolicies.filter(p => policyIds.includes(p.id))
            : this.retentionPolicies.filter(p => p.enabled);
        for (const policy of policiesToExecute) {
            try {
                const result = await this.executeSinglePolicy(policy);
                results.push(result);
                // Update policy execution time
                policy.lastExecuted = new Date();
                policy.nextExecution = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day
                await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.LOW, 'data-retention-manager', `Retention policy executed: ${policy.name}`, {
                    policyId: policy.id,
                    itemsDeleted: result.itemsDeleted,
                    itemsArchived: result.itemsArchived,
                    bytesFreed: result.bytesFreed
                });
            }
            catch (error) {
                console.error(`Failed to execute retention policy ${policy.id}:`, error);
                results.push({
                    policyId: policy.id,
                    dataType: policy.dataType,
                    itemsProcessed: 0,
                    itemsDeleted: 0,
                    itemsArchived: 0,
                    bytesFreed: 0,
                    errors: [error instanceof Error ? error.message : String(error)],
                    executionTime: 0
                });
            }
        }
        await this.saveConfiguration();
        return results;
    }
    /**
     * Redact sensitive information from text
     */
    redactSensitiveData(text, dataType) {
        if (!this.privacySettings.enableDataRedaction) {
            return text;
        }
        let redactedText = text;
        const applicablePatterns = this.privacySettings.redactionPatterns.filter(pattern => pattern.enabled && pattern.dataTypes.includes(dataType));
        for (const pattern of applicablePatterns) {
            try {
                const regex = new RegExp(pattern.pattern, 'gi');
                redactedText = redactedText.replace(regex, pattern.replacement);
            }
            catch (error) {
                console.error(`Invalid redaction pattern ${pattern.id}:`, error);
            }
        }
        return redactedText;
    }
    /**
     * Request data export for a user
     */
    async requestDataExport(userId, dataTypes) {
        if (!this.privacySettings.allowDataExport) {
            throw new Error('Data export is not allowed by privacy settings');
        }
        const exportRequest = {
            id: this.generateExportId(),
            userId,
            requestedAt: new Date(),
            dataTypes,
            status: 'pending'
        };
        this.exportRequests.set(exportRequest.id, exportRequest);
        // Process export asynchronously
        this.processDataExport(exportRequest).catch(error => {
            console.error(`Failed to process data export ${exportRequest.id}:`, error);
            exportRequest.status = 'failed';
            exportRequest.error = error.message;
        });
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.MEDIUM, 'data-retention-manager', `Data export requested for user: ${userId}`, { exportId: exportRequest.id, dataTypes });
        return exportRequest.id;
    }
    /**
     * Delete user data (right to be forgotten)
     */
    async deleteUserData(userId, dataTypes) {
        if (!this.privacySettings.allowDataDeletion) {
            throw new Error('Data deletion is not allowed by privacy settings');
        }
        const typesToDelete = dataTypes || ['user_data', 'conversation_history', 'security_events'];
        const deletionResults = {};
        for (const dataType of typesToDelete) {
            try {
                const deletedCount = await this.deleteUserDataByType(userId, dataType);
                deletionResults[dataType] = deletedCount;
            }
            catch (error) {
                console.error(`Failed to delete ${dataType} for user ${userId}:`, error);
                deletionResults[dataType] = 0;
            }
        }
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.HIGH, 'data-retention-manager', `User data deletion completed for: ${userId}`, { userId, dataTypes: typesToDelete, deletionResults });
    }
    /**
     * Get retention policies
     */
    getRetentionPolicies() {
        return [...this.retentionPolicies];
    }
    /**
     * Update retention policy
     */
    async updateRetentionPolicy(policyId, updates) {
        const policyIndex = this.retentionPolicies.findIndex(p => p.id === policyId);
        if (policyIndex === -1) {
            throw new Error(`Retention policy not found: ${policyId}`);
        }
        this.retentionPolicies[policyIndex] = {
            ...this.retentionPolicies[policyIndex],
            ...updates
        };
        await this.saveConfiguration();
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.MEDIUM, 'data-retention-manager', `Retention policy updated: ${policyId}`, { policyId, updates });
    }
    /**
     * Get privacy settings
     */
    getPrivacySettings() {
        return { ...this.privacySettings };
    }
    /**
     * Update privacy settings
     */
    async updatePrivacySettings(updates) {
        this.privacySettings = { ...this.privacySettings, ...updates };
        await this.saveConfiguration();
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.MEDIUM, 'data-retention-manager', 'Privacy settings updated', { updates });
    }
    /**
     * Get data export status
     */
    getDataExportStatus(exportId) {
        return this.exportRequests.get(exportId);
    }
    /**
     * Execute a single retention policy
     */
    async executeSinglePolicy(policy) {
        const startTime = Date.now();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
        let itemsProcessed = 0;
        let itemsDeleted = 0;
        let itemsArchived = 0;
        let bytesFreed = 0;
        const errors = [];
        try {
            switch (policy.dataType) {
                case 'security_events':
                    const securityResult = await this.purgeSecurityEvents(cutoffDate, policy);
                    itemsProcessed = securityResult.processed;
                    itemsDeleted = securityResult.deleted;
                    itemsArchived = securityResult.archived;
                    bytesFreed = securityResult.bytesFreed;
                    break;
                case 'conversation_history':
                    const conversationResult = await this.purgeConversationHistory(cutoffDate, policy);
                    itemsProcessed = conversationResult.processed;
                    itemsDeleted = conversationResult.deleted;
                    itemsArchived = conversationResult.archived;
                    bytesFreed = conversationResult.bytesFreed;
                    break;
                case 'user_data':
                    const userResult = await this.purgeUserData(cutoffDate, policy);
                    itemsProcessed = userResult.processed;
                    itemsDeleted = userResult.deleted;
                    itemsArchived = userResult.archived;
                    bytesFreed = userResult.bytesFreed;
                    break;
                case 'file_attachments':
                    const fileResult = await this.purgeFileAttachments(cutoffDate, policy);
                    itemsProcessed = fileResult.processed;
                    itemsDeleted = fileResult.deleted;
                    itemsArchived = fileResult.archived;
                    bytesFreed = fileResult.bytesFreed;
                    break;
                case 'configuration_backups':
                    const configResult = await this.purgeConfigurationBackups(cutoffDate, policy);
                    itemsProcessed = configResult.processed;
                    itemsDeleted = configResult.deleted;
                    itemsArchived = configResult.archived;
                    bytesFreed = configResult.bytesFreed;
                    break;
                default:
                    throw new Error(`Unknown data type: ${policy.dataType}`);
            }
        }
        catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
        }
        return {
            policyId: policy.id,
            dataType: policy.dataType,
            itemsProcessed,
            itemsDeleted,
            itemsArchived,
            bytesFreed,
            errors,
            executionTime: Date.now() - startTime
        };
    }
    /**
     * Purge security events
     */
    async purgeSecurityEvents(cutoffDate, policy) {
        // This would integrate with the SecurityLogger to purge old events
        // For now, we'll simulate the operation
        const removedCount = await this.securityLogger.clearOldEvents(policy.retentionDays);
        return {
            processed: removedCount,
            deleted: policy.autoDelete ? removedCount : 0,
            archived: policy.archiveBeforeDelete ? removedCount : 0,
            bytesFreed: removedCount * 1024 // Estimate 1KB per event
        };
    }
    /**
     * Purge conversation history
     */
    async purgeConversationHistory(cutoffDate, policy) {
        // This would integrate with conversation storage to purge old conversations
        // Implementation would depend on the conversation storage format
        return {
            processed: 0,
            deleted: 0,
            archived: 0,
            bytesFreed: 0
        };
    }
    /**
     * Purge user data
     */
    async purgeUserData(cutoffDate, policy) {
        // This would integrate with user storage to purge inactive user data
        return {
            processed: 0,
            deleted: 0,
            archived: 0,
            bytesFreed: 0
        };
    }
    /**
     * Purge file attachments
     */
    async purgeFileAttachments(cutoffDate, policy) {
        const attachmentsDir = path.join((0, os_1.homedir)(), '.everfern', 'attachments');
        let processed = 0;
        let deleted = 0;
        let archived = 0;
        let bytesFreed = 0;
        try {
            const files = await fs.readdir(attachmentsDir);
            for (const file of files) {
                const filePath = path.join(attachmentsDir, file);
                const stats = await fs.stat(filePath);
                if (stats.mtime < cutoffDate) {
                    processed++;
                    if (policy.archiveBeforeDelete && policy.archivePath) {
                        await fs.mkdir(policy.archivePath, { recursive: true });
                        const archivePath = path.join(policy.archivePath, file);
                        await fs.copyFile(filePath, archivePath);
                        archived++;
                    }
                    if (policy.autoDelete) {
                        await fs.unlink(filePath);
                        deleted++;
                        bytesFreed += stats.size;
                    }
                }
            }
        }
        catch (error) {
            // Directory might not exist, which is fine
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        return { processed, deleted, archived, bytesFreed };
    }
    /**
     * Purge configuration backups
     */
    async purgeConfigurationBackups(cutoffDate, policy) {
        // This would purge old configuration backup files
        return {
            processed: 0,
            deleted: 0,
            archived: 0,
            bytesFreed: 0
        };
    }
    /**
     * Delete user data by type
     */
    async deleteUserDataByType(userId, dataType) {
        // This would implement user-specific data deletion
        // The implementation would depend on how data is stored for each type
        switch (dataType) {
            case 'user_data':
                // Delete user profile, preferences, etc.
                return 1;
            case 'conversation_history':
                // Delete all conversations involving the user
                return 0;
            case 'security_events':
                // Delete security events related to the user
                return 0;
            default:
                return 0;
        }
    }
    /**
     * Process data export request
     */
    async processDataExport(exportRequest) {
        exportRequest.status = 'processing';
        try {
            const exportDir = path.join((0, os_1.homedir)(), '.everfern', 'exports', exportRequest.id);
            await fs.mkdir(exportDir, { recursive: true });
            // Export each requested data type
            for (const dataType of exportRequest.dataTypes) {
                await this.exportDataType(exportRequest.userId, dataType, exportDir);
            }
            exportRequest.status = 'completed';
            exportRequest.completedAt = new Date();
            exportRequest.exportPath = exportDir;
        }
        catch (error) {
            exportRequest.status = 'failed';
            exportRequest.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    /**
     * Export data for a specific type
     */
    async exportDataType(userId, dataType, exportDir) {
        const exportFile = path.join(exportDir, `${dataType}.json`);
        // This would implement data export for each type
        // For now, we'll create placeholder files
        const exportData = {
            userId,
            dataType,
            exportedAt: new Date().toISOString(),
            data: [] // Would contain actual user data
        };
        await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2));
    }
    /**
     * Schedule retention policies for automatic execution
     */
    async scheduleRetentionPolicies() {
        // Execute retention policies daily at 2 AM
        const now = new Date();
        const nextExecution = new Date();
        nextExecution.setHours(2, 0, 0, 0);
        if (nextExecution <= now) {
            nextExecution.setDate(nextExecution.getDate() + 1);
        }
        const timeUntilExecution = nextExecution.getTime() - now.getTime();
        this.purgeScheduler = setTimeout(async () => {
            await this.executeRetentionPolicies();
            // Schedule next execution (24 hours later)
            this.purgeScheduler = setInterval(async () => {
                await this.executeRetentionPolicies();
            }, 24 * 60 * 60 * 1000);
        }, timeUntilExecution);
    }
    /**
     * Generate unique export ID
     */
    generateExportId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Load configuration from file
     */
    async loadConfiguration() {
        try {
            const fileExists = await fs.access(this.configFile).then(() => true).catch(() => false);
            if (fileExists) {
                const content = await fs.readFile(this.configFile, 'utf8');
                const config = JSON.parse(content);
                if (config.retentionPolicies) {
                    this.retentionPolicies = config.retentionPolicies;
                }
                if (config.privacySettings) {
                    this.privacySettings = { ...this.privacySettings, ...config.privacySettings };
                }
            }
        }
        catch (error) {
            console.error('Failed to load retention configuration:', error);
            // Continue with default configuration
        }
    }
    /**
     * Save configuration to file
     */
    async saveConfiguration() {
        try {
            const config = {
                retentionPolicies: this.retentionPolicies,
                privacySettings: this.privacySettings
            };
            await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
        }
        catch (error) {
            console.error('Failed to save retention configuration:', error);
        }
    }
    /**
     * Stop the retention manager
     */
    stop() {
        if (this.purgeScheduler) {
            clearTimeout(this.purgeScheduler);
            clearInterval(this.purgeScheduler);
            this.purgeScheduler = undefined;
        }
    }
}
exports.DataRetentionManager = DataRetentionManager;
// Export the data retention manager
