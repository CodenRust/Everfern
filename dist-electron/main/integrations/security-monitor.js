"use strict";
/**
 * Security Event Monitoring and Logging System
 *
 * This module provides comprehensive security event logging, monitoring,
 * and administrator notification capabilities for the multi-platform
 * integration system.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSecurityAlertConfig = exports.SecurityMonitor = void 0;
exports.getSecurityMonitor = getSecurityMonitor;
exports.createSecurityMonitor = createSecurityMonitor;
const events_1 = require("events");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const notification_service_1 = require("./notification-service");
/**
 * Security event monitoring and logging system
 */
class SecurityMonitor extends events_1.EventEmitter {
    events = new Map();
    blockedUsers = new Set();
    notificationService;
    alertConfig;
    logDirectory;
    metricsCache = null;
    metricsCacheExpiry = 0;
    notificationCounts = new Map();
    constructor(alertConfig) {
        super();
        this.alertConfig = alertConfig;
        this.notificationService = (0, notification_service_1.getNotificationService)();
        this.logDirectory = path_1.default.join(os_1.default.homedir(), '.everfern', 'security-logs');
        this.initializeLogDirectory();
        this.startPeriodicCleanup();
    }
    /**
     * Log a security event
     */
    async logSecurityEvent(type, severity, platform, title, description, metadata = {}, userId) {
        const event = {
            id: this.generateEventId(),
            type,
            severity,
            timestamp: new Date(),
            platform,
            userId,
            title,
            description,
            metadata,
            adminNotified: false,
            resolved: false
        };
        // Store event in memory
        this.events.set(event.id, event);
        // Write to log file
        await this.writeEventToLog(event);
        // Emit event
        this.emit('security-event', event);
        // Check for critical alerts
        if (severity === 'critical' || this.isCriticalEvent(event)) {
            await this.handleCriticalAlert(event);
        }
        // Check for auto-block conditions
        if (userId && this.shouldAutoBlock(userId, type)) {
            await this.blockUser(userId, `Auto-blocked due to ${type}`);
        }
        // Send notifications if needed
        if (this.shouldNotifyAdmins(event)) {
            await this.notifyAdministrators(event);
        }
        // Invalidate metrics cache
        this.invalidateMetricsCache();
        return event;
    }
    /**
     * Log authentication attempt
     */
    async logAuthenticationAttempt(platform, userId, success, metadata = {}) {
        const type = success ? 'authentication_success' : 'authentication_failure';
        const severity = success ? 'low' : 'medium';
        const title = success ? 'Authentication Successful' : 'Authentication Failed';
        const description = success
            ? `User ${userId} successfully authenticated on ${platform}`
            : `Failed authentication attempt for user ${userId} on ${platform}`;
        return this.logSecurityEvent(type, severity, platform, title, description, metadata, userId);
    }
    /**
     * Log validation failure
     */
    async logValidationFailure(platform, userId, validationResult, metadata = {}) {
        const severity = this.mapRiskLevelToSeverity(validationResult.riskLevel);
        const type = this.determineEventTypeFromValidation(validationResult);
        const title = 'Input Validation Failed';
        const description = `Input validation failed for user ${userId}: ${validationResult.errors.join(', ')}`;
        return this.logSecurityEvent(type, severity, platform, title, description, { ...metadata, validationResult }, userId);
    }
    /**
     * Log suspicious activity
     */
    async logSuspiciousActivity(platform, userId, activity, metadata = {}) {
        return this.logSecurityEvent('suspicious_activity', 'high', platform, 'Suspicious Activity Detected', `Suspicious activity detected for user ${userId}: ${activity}`, metadata, userId);
    }
    /**
     * Log system error
     */
    async logSystemError(platform, error, metadata = {}) {
        return this.logSecurityEvent('integration_error', 'medium', platform, 'System Error', `System error occurred: ${error.message}`, {
            ...metadata,
            error: error.message,
            stackTrace: error.stack
        });
    }
    /**
     * Get security events with filtering
     */
    getSecurityEvents(filters = {}) {
        let events = Array.from(this.events.values());
        // Apply filters
        if (filters.severity) {
            events = events.filter(e => filters.severity.includes(e.severity));
        }
        if (filters.type) {
            events = events.filter(e => filters.type.includes(e.type));
        }
        if (filters.platform) {
            events = events.filter(e => filters.platform.includes(e.platform));
        }
        if (filters.userId) {
            events = events.filter(e => e.userId === filters.userId);
        }
        if (filters.startDate) {
            events = events.filter(e => e.timestamp >= filters.startDate);
        }
        if (filters.endDate) {
            events = events.filter(e => e.timestamp <= filters.endDate);
        }
        if (filters.resolved !== undefined) {
            events = events.filter(e => e.resolved === filters.resolved);
        }
        // Sort by timestamp (newest first)
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (filters.limit) {
            events = events.slice(0, filters.limit);
        }
        return events;
    }
    /**
     * Get security metrics
     */
    async getSecurityMetrics(startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    endDate = new Date()) {
        // Check cache
        const now = Date.now();
        if (this.metricsCache && now < this.metricsCacheExpiry) {
            return this.metricsCache;
        }
        const events = this.getSecurityEvents({ startDate, endDate });
        const metrics = {
            totalEvents: events.length,
            eventsBySeverity: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            },
            eventsByType: {},
            eventsByPlatform: {},
            failedAuthAttempts: 0,
            blockedAttacks: 0,
            rateLimitViolations: 0,
            timePeriod: { start: startDate, end: endDate }
        };
        // Calculate metrics
        for (const event of events) {
            metrics.eventsBySeverity[event.severity]++;
            if (!metrics.eventsByType[event.type]) {
                metrics.eventsByType[event.type] = 0;
            }
            metrics.eventsByType[event.type]++;
            if (!metrics.eventsByPlatform[event.platform]) {
                metrics.eventsByPlatform[event.platform] = 0;
            }
            metrics.eventsByPlatform[event.platform]++;
            if (event.type === 'authentication_failure') {
                metrics.failedAuthAttempts++;
            }
            if (event.type === 'injection_attack_detected' || event.type === 'malicious_url_detected') {
                metrics.blockedAttacks++;
            }
            if (event.type === 'rate_limit_exceeded') {
                metrics.rateLimitViolations++;
            }
        }
        // Cache metrics for 5 minutes
        this.metricsCache = metrics;
        this.metricsCacheExpiry = now + 5 * 60 * 1000;
        this.emit('metrics-updated', metrics);
        return metrics;
    }
    /**
     * Block a user
     */
    async blockUser(userId, reason) {
        this.blockedUsers.add(userId);
        await this.logSecurityEvent('privilege_escalation_attempt', 'high', 'system', 'User Blocked', `User ${userId} has been blocked: ${reason}`, { context: { reason } }, userId);
        this.emit('user-blocked', userId, reason);
        // Notify administrators
        this.notificationService.createErrorNotification('User Blocked', `User ${userId} has been automatically blocked due to: ${reason}`);
    }
    /**
     * Unblock a user
     */
    async unblockUser(userId, reason) {
        this.blockedUsers.delete(userId);
        await this.logSecurityEvent('authentication_attempt', 'low', 'system', 'User Unblocked', `User ${userId} has been unblocked: ${reason}`, { context: { reason } }, userId);
    }
    /**
     * Check if user is blocked
     */
    isUserBlocked(userId) {
        return this.blockedUsers.has(userId);
    }
    /**
     * Resolve a security event
     */
    async resolveSecurityEvent(eventId, resolutionNotes) {
        const event = this.events.get(eventId);
        if (!event) {
            return false;
        }
        event.resolved = true;
        event.resolutionNotes = resolutionNotes;
        // Update log file
        await this.writeEventToLog(event);
        return true;
    }
    /**
     * Get security dashboard data
     */
    async getSecurityDashboard() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentEvents = this.getSecurityEvents({
            startDate: last24Hours,
            limit: 50
        });
        const metrics = await this.getSecurityMetrics(last24Hours, now);
        const criticalAlerts = this.getSecurityEvents({
            severity: ['critical'],
            resolved: false,
            limit: 10
        });
        const systemHealth = this.assessSystemHealth(metrics, criticalAlerts);
        return {
            recentEvents,
            metrics,
            blockedUsers: Array.from(this.blockedUsers),
            criticalAlerts,
            systemHealth
        };
    }
    /**
     * Initialize log directory
     */
    async initializeLogDirectory() {
        try {
            await promises_1.default.mkdir(this.logDirectory, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create security log directory:', error);
        }
    }
    /**
     * Write event to log file
     */
    async writeEventToLog(event) {
        try {
            const logDate = event.timestamp.toISOString().split('T')[0];
            const logFile = path_1.default.join(this.logDirectory, `security-${logDate}.log`);
            const logEntry = {
                ...event,
                timestamp: event.timestamp.toISOString()
            };
            const logLine = JSON.stringify(logEntry) + '\n';
            await promises_1.default.appendFile(logFile, logLine, 'utf8');
        }
        catch (error) {
            console.error('Failed to write security event to log:', error);
            this.emit('error', error);
        }
    }
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `sec_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
    }
    /**
     * Check if event is critical
     */
    isCriticalEvent(event) {
        const criticalTypes = [
            'injection_attack_detected',
            'data_breach_attempt',
            'system_compromise_detected',
            'privilege_escalation_attempt'
        ];
        return criticalTypes.includes(event.type) || event.severity === 'critical';
    }
    /**
     * Handle critical alert
     */
    async handleCriticalAlert(event) {
        this.emit('critical-alert', event);
        // Create urgent notification
        this.notificationService.createNotification('error', 'Critical Security Alert', `${event.title}: ${event.description}`, {
            persistent: true,
            actions: [
                {
                    id: 'view-details',
                    label: 'View Details',
                    type: 'primary',
                    handler: () => console.log('View security event details:', event.id)
                },
                {
                    id: 'resolve',
                    label: 'Mark Resolved',
                    type: 'secondary',
                    handler: async () => { await this.resolveSecurityEvent(event.id, 'Resolved by administrator'); }
                }
            ],
            metadata: { securityEventId: event.id }
        });
    }
    /**
     * Check if user should be auto-blocked
     */
    shouldAutoBlock(userId, eventType) {
        const now = Date.now();
        const timeWindow = this.alertConfig.autoBlockThresholds.timeWindowMinutes * 60 * 1000;
        const cutoff = now - timeWindow;
        const recentEvents = this.getSecurityEvents({
            userId,
            startDate: new Date(cutoff)
        });
        // Count relevant events
        let failedAuthCount = 0;
        let injectionCount = 0;
        for (const event of recentEvents) {
            if (event.type === 'authentication_failure') {
                failedAuthCount++;
            }
            if (event.type === 'injection_attack_detected') {
                injectionCount++;
            }
        }
        // Check thresholds
        if (failedAuthCount >= this.alertConfig.autoBlockThresholds.failedAuthAttempts) {
            return true;
        }
        if (injectionCount >= this.alertConfig.autoBlockThresholds.injectionAttempts) {
            return true;
        }
        return false;
    }
    /**
     * Check if administrators should be notified
     */
    shouldNotifyAdmins(event) {
        // Check severity threshold
        const severityLevels = ['low', 'medium', 'high', 'critical'];
        const eventSeverityIndex = severityLevels.indexOf(event.severity);
        const minSeverityIndex = severityLevels.indexOf(this.alertConfig.minNotificationSeverity);
        if (eventSeverityIndex < minSeverityIndex) {
            return false;
        }
        // Check rate limiting
        const now = Date.now();
        const hourAgo = now - 60 * 60 * 1000;
        const notificationKey = `${event.type}_${event.severity}`;
        let notifications = this.notificationCounts.get(notificationKey) || [];
        notifications = notifications.filter(time => time > hourAgo);
        if (notifications.length >= this.alertConfig.notificationRateLimit.maxPerHour) {
            return false;
        }
        // Update notification count
        notifications.push(now);
        this.notificationCounts.set(notificationKey, notifications);
        return true;
    }
    /**
     * Notify administrators
     */
    async notifyAdministrators(event) {
        try {
            // Mark as notified
            event.adminNotified = true;
            // Create notification
            this.notificationService.createNotification(event.severity === 'critical' ? 'error' : 'warning', `Security Alert: ${event.title}`, event.description, {
                persistent: event.severity === 'critical' || event.severity === 'high',
                metadata: { securityEventId: event.id }
            });
            // TODO: Implement email notifications if configured
            if (this.alertConfig.enableEmailNotifications && this.alertConfig.adminEmails.length > 0) {
                // Email notification implementation would go here
                console.log(`Would send email notification to: ${this.alertConfig.adminEmails.join(', ')}`);
            }
        }
        catch (error) {
            console.error('Failed to notify administrators:', error);
            this.emit('error', error);
        }
    }
    /**
     * Map validation risk level to security severity
     */
    mapRiskLevelToSeverity(riskLevel) {
        switch (riskLevel) {
            case 'low': return 'low';
            case 'medium': return 'medium';
            case 'high': return 'high';
            case 'critical': return 'critical';
            default: return 'medium';
        }
    }
    /**
     * Determine event type from validation result
     */
    determineEventTypeFromValidation(result) {
        if (result.errors.some(e => e.includes('injection'))) {
            return 'injection_attack_detected';
        }
        if (result.errors.some(e => e.includes('rate limit'))) {
            return 'rate_limit_exceeded';
        }
        if (result.errors.some(e => e.includes('file'))) {
            return 'file_upload_blocked';
        }
        if (result.warnings.some(w => w.includes('URL'))) {
            return 'malicious_url_detected';
        }
        return 'suspicious_activity';
    }
    /**
     * Assess system health
     */
    assessSystemHealth(metrics, criticalAlerts) {
        const issues = [];
        let status = 'healthy';
        // Check critical alerts
        if (criticalAlerts.length > 0) {
            status = 'critical';
            issues.push(`${criticalAlerts.length} unresolved critical alerts`);
        }
        // Check failed authentication rate
        if (metrics.failedAuthAttempts > 50) {
            status = status === 'healthy' ? 'warning' : status;
            issues.push(`High number of failed authentication attempts: ${metrics.failedAuthAttempts}`);
        }
        // Check blocked attacks
        if (metrics.blockedAttacks > 10) {
            status = status === 'healthy' ? 'warning' : status;
            issues.push(`Multiple attack attempts blocked: ${metrics.blockedAttacks}`);
        }
        // Check rate limit violations
        if (metrics.rateLimitViolations > 20) {
            status = status === 'healthy' ? 'warning' : status;
            issues.push(`High rate limit violations: ${metrics.rateLimitViolations}`);
        }
        if (issues.length === 0) {
            issues.push('All systems operating normally');
        }
        return { status, issues };
    }
    /**
     * Invalidate metrics cache
     */
    invalidateMetricsCache() {
        this.metricsCache = null;
        this.metricsCacheExpiry = 0;
    }
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup() {
        // Clean up old events every hour
        setInterval(() => {
            this.cleanupOldEvents();
            this.cleanupNotificationCounts();
        }, 60 * 60 * 1000);
    }
    /**
     * Clean up old events from memory
     */
    cleanupOldEvents() {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        for (const [id, event] of this.events) {
            if (event.timestamp.getTime() < sevenDaysAgo) {
                this.events.delete(id);
            }
        }
    }
    /**
     * Clean up old notification counts
     */
    cleanupNotificationCounts() {
        const now = Date.now();
        const hourAgo = now - 60 * 60 * 1000;
        for (const [key, notifications] of this.notificationCounts) {
            const filtered = notifications.filter(time => time > hourAgo);
            if (filtered.length === 0) {
                this.notificationCounts.delete(key);
            }
            else {
                this.notificationCounts.set(key, filtered);
            }
        }
    }
}
exports.SecurityMonitor = SecurityMonitor;
/**
 * Default security alert configuration
 */
exports.defaultSecurityAlertConfig = {
    enableEmailNotifications: false,
    adminEmails: [],
    minNotificationSeverity: 'medium',
    notificationRateLimit: {
        maxPerHour: 10,
        cooldownMinutes: 5
    },
    autoBlockThresholds: {
        failedAuthAttempts: 5,
        injectionAttempts: 3,
        timeWindowMinutes: 15
    }
};
/**
 * Global security monitor instance
 */
let globalSecurityMonitor = null;
/**
 * Get or create global security monitor
 */
function getSecurityMonitor(config) {
    if (!globalSecurityMonitor) {
        globalSecurityMonitor = new SecurityMonitor(config || exports.defaultSecurityAlertConfig);
    }
    return globalSecurityMonitor;
}
/**
 * Create a security monitor instance
 */
function createSecurityMonitor(config) {
    return new SecurityMonitor(config);
}
