"use strict";
/**
 * Comprehensive Error Logging System
 *
 * Provides detailed error logging with context information, error categorization,
 * severity levels, and administrator notification capabilities for the multi-platform
 * integration system.
 *
 * Requirements: 9.6, 9.7
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultErrorNotificationConfig = exports.ErrorLogger = exports.ErrorCategory = exports.ErrorSeverity = void 0;
exports.getErrorLogger = getErrorLogger;
exports.createErrorLogger = createErrorLogger;
const events_1 = require("events");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const security_monitor_1 = require("./security-monitor");
const admin_notification_1 = require("./admin-notification");
/**
 * Error severity levels
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Error categories
 */
var ErrorCategory;
(function (ErrorCategory) {
    // Platform-specific errors
    ErrorCategory["PLATFORM_CONNECTION"] = "platform_connection";
    ErrorCategory["PLATFORM_API"] = "platform_api";
    ErrorCategory["PLATFORM_AUTHENTICATION"] = "platform_authentication";
    ErrorCategory["PLATFORM_RATE_LIMIT"] = "platform_rate_limit";
    // Integration errors
    ErrorCategory["MESSAGE_DELIVERY"] = "message_delivery";
    ErrorCategory["MESSAGE_PROCESSING"] = "message_processing";
    ErrorCategory["FILE_TRANSFER"] = "file_transfer";
    ErrorCategory["CONVERSATION_SYNC"] = "conversation_sync";
    // System errors
    ErrorCategory["DATABASE"] = "database";
    ErrorCategory["FILE_SYSTEM"] = "file_system";
    ErrorCategory["CONFIGURATION"] = "configuration";
    ErrorCategory["ENCRYPTION"] = "encryption";
    // Security errors
    ErrorCategory["AUTHENTICATION"] = "authentication";
    ErrorCategory["AUTHORIZATION"] = "authorization";
    ErrorCategory["INPUT_VALIDATION"] = "input_validation";
    ErrorCategory["SECURITY_VIOLATION"] = "security_violation";
    // Application errors
    ErrorCategory["AGENT_EXECUTION"] = "agent_execution";
    ErrorCategory["TOOL_EXECUTION"] = "tool_execution";
    ErrorCategory["STATE_MANAGEMENT"] = "state_management";
    ErrorCategory["UNKNOWN"] = "unknown";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
/**
 * Comprehensive Error Logger
 */
class ErrorLogger extends events_1.EventEmitter {
    errors = new Map();
    logDirectory;
    notificationConfig;
    notificationCounts = new Map();
    securityMonitor = (0, security_monitor_1.getSecurityMonitor)();
    constructor(config) {
        super();
        this.logDirectory = path_1.default.join(os_1.default.homedir(), '.everfern', 'error-logs');
        this.notificationConfig = {
            enabled: true,
            minSeverity: ErrorSeverity.MEDIUM,
            criticalCategories: [
                ErrorCategory.SECURITY_VIOLATION,
                ErrorCategory.DATABASE,
                ErrorCategory.ENCRYPTION
            ],
            rateLimit: {
                maxPerHour: 20,
                cooldownMinutes: 5
            },
            ...config
        };
        this.initializeLogDirectory();
        this.startPeriodicCleanup();
    }
    /**
     * Log an error with full context
     */
    async logError(error, severity, category, context, retry) {
        const entry = {
            id: this.generateErrorId(),
            timestamp: new Date(),
            severity,
            category,
            message: error.message,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context: {
                ...context,
                environment: this.captureEnvironment()
            },
            adminNotified: false,
            retry
        };
        // Store error
        this.errors.set(entry.id, entry);
        // Write to log file
        await this.writeErrorToLog(entry);
        // Emit event
        this.emit('error-logged', entry);
        // Check for admin notification
        if (this.shouldNotifyAdmins(entry)) {
            await this.notifyAdministrators(entry);
        }
        // Log to security monitor if security-related
        if (this.isSecurityRelated(category)) {
            await this.logToSecurityMonitor(entry);
        }
        return entry;
    }
    /**
     * Log platform connection error
     */
    async logPlatformError(platform, error, operation, metadata) {
        const severity = this.determineSeverity(error, ErrorCategory.PLATFORM_CONNECTION);
        return this.logError(error, severity, ErrorCategory.PLATFORM_CONNECTION, {
            platform,
            component: `${platform}-platform`,
            operation,
            metadata
        });
    }
    /**
     * Log message delivery error
     */
    async logMessageError(platform, userId, error, messageId, conversationId, retry) {
        return this.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.MESSAGE_DELIVERY, {
            platform,
            userId,
            messageId,
            conversationId,
            component: 'bot-manager',
            operation: 'send_message'
        }, retry);
    }
    /**
     * Log file transfer error
     */
    async logFileTransferError(platform, userId, error, filename, operation) {
        return this.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.FILE_TRANSFER, {
            platform,
            userId,
            component: 'file-manager',
            operation,
            metadata: { filename }
        });
    }
    /**
     * Log database error
     */
    async logDatabaseError(error, operation, metadata) {
        return this.logError(error, ErrorSeverity.HIGH, ErrorCategory.DATABASE, {
            component: 'database',
            operation,
            metadata
        });
    }
    /**
     * Log security error
     */
    async logSecurityError(error, category, context) {
        return this.logError(error, ErrorSeverity.CRITICAL, category, context);
    }
    /**
     * Get error logs with filtering
     */
    getErrors(filters = {}) {
        let errors = Array.from(this.errors.values());
        // Apply filters
        if (filters.severity) {
            errors = errors.filter(e => filters.severity.includes(e.severity));
        }
        if (filters.category) {
            errors = errors.filter(e => filters.category.includes(e.category));
        }
        if (filters.platform) {
            errors = errors.filter(e => e.context.platform && filters.platform.includes(e.context.platform));
        }
        if (filters.component) {
            errors = errors.filter(e => filters.component.includes(e.context.component));
        }
        if (filters.userId) {
            errors = errors.filter(e => e.context.userId === filters.userId);
        }
        if (filters.startDate) {
            errors = errors.filter(e => e.timestamp >= filters.startDate);
        }
        if (filters.endDate) {
            errors = errors.filter(e => e.timestamp <= filters.endDate);
        }
        if (filters.resolved !== undefined) {
            errors = errors.filter(e => e.resolution?.resolved === filters.resolved);
        }
        // Sort by timestamp (newest first)
        errors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (filters.limit) {
            errors = errors.slice(0, filters.limit);
        }
        return errors;
    }
    /**
     * Get error statistics
     */
    async getStatistics(startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), endDate = new Date()) {
        const errors = this.getErrors({ startDate, endDate });
        const stats = {
            totalErrors: errors.length,
            bySeverity: {
                [ErrorSeverity.LOW]: 0,
                [ErrorSeverity.MEDIUM]: 0,
                [ErrorSeverity.HIGH]: 0,
                [ErrorSeverity.CRITICAL]: 0
            },
            byCategory: {},
            byPlatform: {},
            byComponent: {},
            errorRate: 0,
            topErrors: [],
            timePeriod: { start: startDate, end: endDate }
        };
        // Initialize category counts
        Object.values(ErrorCategory).forEach(cat => {
            stats.byCategory[cat] = 0;
        });
        // Count errors by various dimensions
        const errorMessages = new Map();
        for (const error of errors) {
            stats.bySeverity[error.severity]++;
            stats.byCategory[error.category]++;
            if (error.context.platform) {
                stats.byPlatform[error.context.platform] = (stats.byPlatform[error.context.platform] || 0) + 1;
            }
            stats.byComponent[error.context.component] = (stats.byComponent[error.context.component] || 0) + 1;
            // Track error messages for top errors
            const key = `${error.category}:${error.message}`;
            errorMessages.set(key, (errorMessages.get(key) || 0) + 1);
        }
        // Calculate error rate (errors per hour)
        const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        stats.errorRate = hours > 0 ? errors.length / hours : 0;
        // Get top 10 errors
        stats.topErrors = Array.from(errorMessages.entries())
            .map(([key, count]) => {
            const [category, message] = key.split(':');
            return { message, count, category: category };
        })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return stats;
    }
    /**
     * Resolve an error
     */
    async resolveError(errorId, resolvedBy, notes) {
        const error = this.errors.get(errorId);
        if (!error) {
            return false;
        }
        error.resolution = {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy,
            notes
        };
        // Update log file
        await this.writeErrorToLog(error);
        this.emit('error-resolved', error);
        return true;
    }
    /**
     * Get error analytics dashboard data
     */
    async getAnalytics() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const statistics = await this.getStatistics(last24Hours, now);
        const recentErrors = this.getErrors({ startDate: last24Hours, limit: 50 });
        const criticalErrors = this.getErrors({
            severity: [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH],
            resolved: false,
            limit: 20
        });
        const unresolvedErrors = this.getErrors({ resolved: false, limit: 100 });
        const errorTrends = this.calculateErrorTrends(last24Hours, now);
        return {
            statistics,
            recentErrors,
            criticalErrors,
            unresolvedErrors,
            errorTrends
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
            console.error('Failed to create error log directory:', error);
        }
    }
    /**
     * Write error to log file
     */
    async writeErrorToLog(entry) {
        try {
            const logDate = entry.timestamp.toISOString().split('T')[0];
            const logFile = path_1.default.join(this.logDirectory, `errors-${logDate}.log`);
            const logEntry = {
                ...entry,
                timestamp: entry.timestamp.toISOString(),
                resolution: entry.resolution ? {
                    ...entry.resolution,
                    resolvedAt: entry.resolution.resolvedAt?.toISOString()
                } : undefined,
                retry: entry.retry ? {
                    ...entry.retry,
                    nextRetryAt: entry.retry.nextRetryAt?.toISOString()
                } : undefined
            };
            const logLine = JSON.stringify(logEntry) + '\n';
            await promises_1.default.appendFile(logFile, logLine, 'utf8');
        }
        catch (error) {
            console.error('Failed to write error to log:', error);
            this.emit('logging-error', error);
        }
    }
    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
    }
    /**
     * Capture environment information
     */
    captureEnvironment() {
        const memUsage = process.memoryUsage();
        return {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal
            }
        };
    }
    /**
     * Determine error severity based on error type and category
     */
    determineSeverity(error, category) {
        // Critical categories
        if ([
            ErrorCategory.SECURITY_VIOLATION,
            ErrorCategory.DATABASE,
            ErrorCategory.ENCRYPTION
        ].includes(category)) {
            return ErrorSeverity.CRITICAL;
        }
        // Check error codes
        const errorCode = error.code;
        if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
            return ErrorSeverity.HIGH;
        }
        // Default to medium
        return ErrorSeverity.MEDIUM;
    }
    /**
     * Check if error category is security-related
     */
    isSecurityRelated(category) {
        return [
            ErrorCategory.AUTHENTICATION,
            ErrorCategory.AUTHORIZATION,
            ErrorCategory.INPUT_VALIDATION,
            ErrorCategory.SECURITY_VIOLATION,
            ErrorCategory.ENCRYPTION
        ].includes(category);
    }
    /**
     * Log to security monitor
     */
    async logToSecurityMonitor(entry) {
        try {
            await this.securityMonitor.logSecurityEvent('integration_error', entry.severity, entry.context.platform || 'system', `Error: ${entry.message}`, entry.message, {
                error: entry.error.message,
                stackTrace: entry.error.stack,
                context: entry.context
            }, entry.context.userId);
        }
        catch (error) {
            console.error('Failed to log to security monitor:', error);
        }
    }
    /**
     * Check if administrators should be notified
     */
    shouldNotifyAdmins(entry) {
        if (!this.notificationConfig.enabled) {
            return false;
        }
        // Always notify for critical categories
        if (this.notificationConfig.criticalCategories.includes(entry.category)) {
            return true;
        }
        // Check severity threshold
        const severityLevels = [ErrorSeverity.LOW, ErrorSeverity.MEDIUM, ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];
        const entrySeverityIndex = severityLevels.indexOf(entry.severity);
        const minSeverityIndex = severityLevels.indexOf(this.notificationConfig.minSeverity);
        if (entrySeverityIndex < minSeverityIndex) {
            return false;
        }
        // Check rate limiting
        const now = Date.now();
        const hourAgo = now - 60 * 60 * 1000;
        const notificationKey = `${entry.category}_${entry.severity}`;
        let notifications = this.notificationCounts.get(notificationKey) || [];
        notifications = notifications.filter(time => time > hourAgo);
        if (notifications.length >= this.notificationConfig.rateLimit.maxPerHour) {
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
    async notifyAdministrators(entry) {
        try {
            entry.adminNotified = true;
            const priority = this.mapSeverityToPriority(entry.severity);
            const title = `Error: ${entry.category}`;
            const message = `${entry.message}\n\nComponent: ${entry.context.component}\nOperation: ${entry.context.operation}`;
            const details = {
                errorId: entry.id,
                severity: entry.severity,
                category: entry.category,
                platform: entry.context.platform,
                component: entry.context.component,
                operation: entry.context.operation,
                error: entry.error,
                context: entry.context
            };
            await admin_notification_1.adminNotificationManager.sendNotification('error', priority, title, message, details);
        }
        catch (error) {
            console.error('Failed to notify administrators:', error);
            this.emit('notification-error', error);
        }
    }
    /**
     * Map error severity to notification priority
     */
    mapSeverityToPriority(severity) {
        const { NotificationPriority } = require('./admin-notification');
        switch (severity) {
            case ErrorSeverity.LOW: return NotificationPriority.LOW;
            case ErrorSeverity.MEDIUM: return NotificationPriority.MEDIUM;
            case ErrorSeverity.HIGH: return NotificationPriority.HIGH;
            case ErrorSeverity.CRITICAL: return NotificationPriority.CRITICAL;
            default: return NotificationPriority.MEDIUM;
        }
    }
    /**
     * Calculate error trends over time
     */
    calculateErrorTrends(startDate, endDate) {
        const hours = 24;
        const trends = {};
        // Initialize trend arrays for each category
        Object.values(ErrorCategory).forEach(cat => {
            trends[cat] = new Array(hours).fill(0);
        });
        const errors = this.getErrors({ startDate, endDate });
        // Count errors per hour
        for (const error of errors) {
            const hoursDiff = Math.floor((endDate.getTime() - error.timestamp.getTime()) / (60 * 60 * 1000));
            const hourIndex = hours - 1 - hoursDiff;
            if (hourIndex >= 0 && hourIndex < hours) {
                trends[error.category][hourIndex]++;
            }
        }
        return trends;
    }
    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup() {
        // Clean up old errors every hour
        setInterval(() => {
            this.cleanupOldErrors();
            this.cleanupNotificationCounts();
        }, 60 * 60 * 1000);
    }
    /**
     * Clean up old errors from memory
     */
    cleanupOldErrors() {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        for (const [id, error] of this.errors) {
            if (error.timestamp.getTime() < sevenDaysAgo) {
                this.errors.delete(id);
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
exports.ErrorLogger = ErrorLogger;
/**
 * Default error notification configuration
 */
exports.defaultErrorNotificationConfig = {
    enabled: true,
    minSeverity: ErrorSeverity.MEDIUM,
    criticalCategories: [
        ErrorCategory.SECURITY_VIOLATION,
        ErrorCategory.DATABASE,
        ErrorCategory.ENCRYPTION
    ],
    rateLimit: {
        maxPerHour: 20,
        cooldownMinutes: 5
    }
};
/**
 * Global error logger instance
 */
let globalErrorLogger = null;
/**
 * Get or create global error logger
 */
function getErrorLogger(config) {
    if (!globalErrorLogger) {
        globalErrorLogger = new ErrorLogger(config);
    }
    return globalErrorLogger;
}
/**
 * Create an error logger instance
 */
function createErrorLogger(config) {
    return new ErrorLogger(config);
}
