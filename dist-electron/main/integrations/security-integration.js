"use strict";
/**
 * Security Integration Service
 *
 * This module integrates the security monitoring system with the existing
 * multi-platform integration components, providing centralized security
 * event handling and monitoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSecurityIntegrationConfig = exports.SecurityIntegrationService = void 0;
exports.getSecurityIntegration = getSecurityIntegration;
exports.createSecurityIntegration = createSecurityIntegration;
const events_1 = require("events");
const security_monitor_1 = require("./security-monitor");
const input_validator_1 = require("./input-validator");
const notification_service_1 = require("./notification-service");
/**
 * Security integration service
 */
class SecurityIntegrationService extends events_1.EventEmitter {
    securityMonitor;
    securityDashboard;
    inputValidator;
    notificationService;
    config;
    isInitialized = false;
    constructor(config) {
        super();
        this.config = config;
        this.notificationService = (0, notification_service_1.getNotificationService)();
    }
    /**
     * Initialize the security integration service
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Initialize security monitor
            this.securityMonitor = (0, security_monitor_1.getSecurityMonitor)(this.config.alerts);
            // Initialize security dashboard (temporarily disabled until fully implemented)
            this.securityDashboard = null; // Placeholder
            // Initialize input validator
            this.inputValidator = (0, input_validator_1.createInputValidator)(this.config.contentFilter, this.config.webhook);
            // Setup event listeners
            this.setupEventListeners();
            // Log initialization
            await this.securityMonitor.logSecurityEvent('configuration_change', 'low', 'system', 'Security System Initialized', 'Security monitoring and integration system has been initialized', {
                context: {
                    enableRealTimeMonitoring: this.config.enableRealTimeMonitoring,
                    enableAutoResponse: this.config.enableAutoResponse,
                    alertsEnabled: this.config.alerts.enableEmailNotifications
                }
            });
            this.isInitialized = true;
            console.log('Security integration service initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize security integration service:', error);
            throw error;
        }
    }
    /**
     * Validate incoming message with security monitoring
     */
    async validateMessage(message, metadata = {}) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        try {
            // Validate message using input validator
            const validationResult = await this.inputValidator.validateMessage(message, metadata);
            // If validation failed with high/critical risk, log additional security event
            if (!validationResult.valid && (validationResult.riskLevel === 'high' || validationResult.riskLevel === 'critical')) {
                const securityEvent = await this.securityMonitor.logValidationFailure(message.platform, message.user.id, validationResult, metadata);
                return {
                    ...validationResult,
                    securityEventId: securityEvent.id
                };
            }
            // Log successful validation for audit trail (low severity)
            if (validationResult.valid && validationResult.warnings.length === 0) {
                await this.securityMonitor.logSecurityEvent('authentication_success', 'low', message.platform, 'Message Validation Successful', `Message from user ${message.user.id} passed validation`, {
                    ...metadata,
                    context: {
                        messageLength: message.content.text.length,
                        fileCount: message.content.files.length
                    }
                }, message.user.id);
            }
            return validationResult;
        }
        catch (error) {
            // Log system error
            await this.securityMonitor.logSystemError(message.platform, error, metadata);
            throw error;
        }
    }
    /**
     * Validate webhook signature with security monitoring
     */
    async validateWebhook(payload, signature, timestamp, platform = 'webhook') {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        try {
            const validationResult = await this.inputValidator.validateWebhookSignature(payload, signature, timestamp);
            if (!validationResult.valid) {
                const securityEvent = await this.securityMonitor.logSecurityEvent('webhook_signature_invalid', 'critical', platform, 'Webhook Signature Validation Failed', 'Invalid webhook signature detected - potential security breach', {
                    context: {
                        signatureProvided: signature,
                        payloadLength: payload.length,
                        timestamp: timestamp,
                        errors: validationResult.errors
                    }
                });
                return {
                    valid: false,
                    securityEventId: securityEvent.id
                };
            }
            return { valid: true };
        }
        catch (error) {
            await this.securityMonitor.logSystemError(platform, error);
            throw error;
        }
    }
    /**
     * Log authentication attempt
     */
    async logAuthenticationAttempt(platform, userId, success, metadata = {}) {
        if (!this.isInitialized) {
            return;
        }
        await this.securityMonitor.logAuthenticationAttempt(platform, userId, success, metadata);
    }
    /**
     * Log suspicious activity
     */
    async logSuspiciousActivity(platform, userId, activity, metadata = {}) {
        if (!this.isInitialized) {
            return;
        }
        await this.securityMonitor.logSuspiciousActivity(platform, userId, activity, metadata);
    }
    /**
     * Get security dashboard data
     */
    async getSecurityDashboard() {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        if (!this.securityDashboard) {
            throw new Error('Security dashboard not available');
        }
        return this.securityDashboard.getDashboardData();
    }
    /**
     * Get security metrics
     */
    async getSecurityMetrics(startDate, endDate) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        return this.securityMonitor.getSecurityMetrics(startDate, endDate);
    }
    /**
     * Block user
     */
    async blockUser(userId, reason) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        await this.securityMonitor.blockUser(userId, reason);
    }
    /**
     * Unblock user
     */
    async unblockUser(userId, reason) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        await this.securityMonitor.unblockUser(userId, reason);
    }
    /**
     * Check if user is blocked
     */
    isUserBlocked(userId) {
        if (!this.isInitialized) {
            return false;
        }
        return this.securityMonitor.isUserBlocked(userId);
    }
    /**
     * Resolve security event
     */
    async resolveSecurityEvent(eventId, resolutionNotes) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        return this.securityMonitor.resolveSecurityEvent(eventId, resolutionNotes);
    }
    /**
     * Export security report
     */
    async exportSecurityReport(format, filters) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        if (!this.securityDashboard) {
            throw new Error('Security dashboard not available');
        }
        // Placeholder implementation - SecurityDashboardManager doesn't have exportSecurityReport yet
        const dashboardData = await this.securityDashboard.getDashboardData();
        if (format === 'json') {
            return {
                data: JSON.stringify(dashboardData, null, 2),
                filename: `security-report-${Date.now()}.json`
            };
        }
        else {
            // Simple CSV export
            const csv = 'Security Report\n' + JSON.stringify(dashboardData);
            return {
                data: csv,
                filename: `security-report-${Date.now()}.csv`
            };
        }
    }
    /**
     * Update security configuration
     */
    async updateConfiguration(newConfig) {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        // Update input validator configuration
        if (newConfig.contentFilter) {
            this.inputValidator.updateContentFilterConfig(newConfig.contentFilter);
        }
        if (newConfig.webhook) {
            this.inputValidator.updateWebhookConfig(newConfig.webhook);
        }
        // Log configuration change
        await this.securityMonitor.logSecurityEvent('configuration_change', 'medium', 'system', 'Security Configuration Updated', 'Security system configuration has been updated', {
            context: {
                oldConfig: this.sanitizeConfig(oldConfig),
                newConfig: this.sanitizeConfig(this.config),
                changedFields: Object.keys(newConfig)
            }
        });
        // Notify administrators
        this.notificationService.createNotification('info', 'Security Configuration Updated', 'Security monitoring configuration has been updated successfully.', { persistent: false });
    }
    /**
     * Get current security status
     */
    async getSecurityStatus() {
        if (!this.isInitialized) {
            throw new Error('Security integration service not initialized');
        }
        const dashboardOverview = await this.securityMonitor.getSecurityDashboard();
        if (!this.securityDashboard) {
            return {
                status: dashboardOverview.systemHealth.status,
                activeThreats: 0,
                blockedUsers: 0,
                lastUpdate: new Date(),
                systemHealth: dashboardOverview.systemHealth
            };
        }
        // Get system health from dashboard
        const systemHealth = await this.securityDashboard.getSystemHealth();
        return {
            status: systemHealth.status,
            activeThreats: this.securityDashboard.getActiveAlerts().length,
            blockedUsers: 0, // Would need to track this separately
            lastUpdate: systemHealth.lastUpdate,
            systemHealth
        };
    }
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Security monitor events
        this.securityMonitor.on('security-event', (event) => {
            this.emit('security-event', event);
        });
        this.securityMonitor.on('critical-alert', (event) => {
            this.emit('critical-alert', event);
            // Create urgent notification
            this.notificationService.createNotification('error', 'Critical Security Alert', `${event.title}: ${event.description}`, {
                persistent: true,
                metadata: { securityEventId: event.id }
            });
        });
        this.securityMonitor.on('user-blocked', (userId, reason) => {
            this.emit('user-blocked', userId, reason);
            // Create notification
            this.notificationService.createWarningNotification('User Blocked', `User ${userId} has been blocked: ${reason}`);
        });
        this.securityMonitor.on('error', (error) => {
            this.emit('error', error);
            console.error('Security monitor error:', error);
        });
        // Security dashboard events (temporarily disabled until fully implemented)
        if (this.securityDashboard) {
            this.securityDashboard.on('health-changed', (status, issues) => {
                this.emit('system-health-changed', status, issues);
                if (status === 'critical') {
                    this.notificationService.createErrorNotification('System Health Critical', `Security system health is critical: ${issues.join(', ')}`);
                }
                else if (status === 'warning') {
                    this.notificationService.createWarningNotification('System Health Warning', `Security system health warning: ${issues.join(', ')}`);
                }
            });
            this.securityDashboard.on('error', (error) => {
                this.emit('error', error);
                console.error('Security dashboard error:', error);
            });
        }
    }
    /**
     * Sanitize configuration for logging (remove sensitive data)
     */
    sanitizeConfig(config) {
        return {
            alerts: {
                ...config.alerts,
                adminEmails: config.alerts.adminEmails.map(() => '[REDACTED]')
            },
            contentFilter: {
                ...config.contentFilter,
                // Content filter config is not sensitive
            },
            webhook: {
                ...config.webhook,
                secretKey: '[REDACTED]'
            },
            enableRealTimeMonitoring: config.enableRealTimeMonitoring,
            enableAutoResponse: config.enableAutoResponse
        };
    }
    /**
     * Cleanup resources
     */
    async destroy() {
        if (this.securityDashboard) {
            this.securityDashboard.stopMonitoring();
        }
        this.removeAllListeners();
        this.isInitialized = false;
        if (this.securityMonitor) {
            await this.securityMonitor.logSecurityEvent('configuration_change', 'low', 'system', 'Security System Shutdown', 'Security monitoring and integration system has been shut down', {});
        }
    }
}
exports.SecurityIntegrationService = SecurityIntegrationService;
/**
 * Default security integration configuration
 */
exports.defaultSecurityIntegrationConfig = {
    alerts: security_monitor_1.defaultSecurityAlertConfig,
    contentFilter: {
        enableProfanityFilter: true,
        enableSpamDetection: true,
        maxMessageLength: 4000,
        maxFileSize: 25 * 1024 * 1024, // 25MB
        allowedFileTypes: [
            'text/plain',
            'text/markdown',
            'text/csv',
            'application/json',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ],
        blockedDomains: [],
        rateLimiting: {
            messagesPerMinute: 30,
            filesPerHour: 10,
            burstAllowance: 5
        }
    },
    webhook: {
        secretKey: '', // Must be set by application
        signatureHeader: 'X-Hub-Signature-256',
        hashAlgorithm: 'sha256',
        maxRequestAge: 300
    },
    enableRealTimeMonitoring: true,
    enableAutoResponse: true
};
/**
 * Global security integration service instance
 */
let globalSecurityIntegration = null;
/**
 * Get or create global security integration service
 */
function getSecurityIntegration(config) {
    if (!globalSecurityIntegration) {
        globalSecurityIntegration = new SecurityIntegrationService(config || exports.defaultSecurityIntegrationConfig);
    }
    return globalSecurityIntegration;
}
/**
 * Create a security integration service instance
 */
function createSecurityIntegration(config) {
    return new SecurityIntegrationService(config);
}
