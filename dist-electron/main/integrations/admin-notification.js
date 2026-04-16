"use strict";
/**
 * Administrator Notification System
 *
 * Handles critical error notifications and security alerts for administrators.
 * Supports multiple notification channels and escalation policies.
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
exports.adminNotificationManager = exports.AdminNotificationManager = exports.NotificationPriority = exports.NotificationChannel = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = require("os");
const security_logger_1 = require("./security-logger");
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["WEBHOOK"] = "webhook";
    NotificationChannel["DESKTOP"] = "desktop";
    NotificationChannel["LOG"] = "log";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["MEDIUM"] = "medium";
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["CRITICAL"] = "critical";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
/**
 * Administrator Notification Manager
 */
class AdminNotificationManager extends events_1.EventEmitter {
    configFile;
    notificationLog;
    config;
    pendingNotifications = [];
    notificationHistory = [];
    maxHistorySize = 1000;
    constructor() {
        super();
        const configDir = path.join((0, os_1.homedir)(), '.everfern', 'admin');
        this.configFile = path.join(configDir, 'notification-config.json');
        this.notificationLog = path.join(configDir, 'notifications.jsonl');
        // Default configuration
        this.config = {
            enabled: true,
            channels: [NotificationChannel.LOG, NotificationChannel.DESKTOP],
            desktopConfig: {
                enabled: true,
                soundEnabled: true
            }
        };
    }
    /**
     * Initialize the notification manager
     */
    async initialize() {
        try {
            const configDir = path.dirname(this.configFile);
            await fs.mkdir(configDir, { recursive: true });
            await this.loadConfiguration();
            await this.loadNotificationHistory();
            // Start processing pending notifications
            this.startNotificationProcessor();
        }
        catch (error) {
            console.error('Failed to initialize admin notification manager:', error);
            throw error;
        }
    }
    /**
     * Send an admin notification
     */
    async sendNotification(type, priority, title, message, details = {}, channels) {
        if (!this.config.enabled) {
            return;
        }
        const notification = {
            id: this.generateNotificationId(),
            timestamp: new Date(),
            type,
            priority,
            title,
            message,
            details,
            channels: channels || this.config.channels,
            sent: false,
            retryCount: 0,
            maxRetries: this.getMaxRetries(priority)
        };
        this.pendingNotifications.push(notification);
        this.emit('notificationQueued', notification);
        console.log(`Admin notification queued: ${priority} - ${title}`);
    }
    /**
     * Send security event notification
     */
    async sendSecurityNotification(event) {
        const priority = this.mapSeverityToPriority(event.severity);
        const title = `Security Alert: ${event.type}`;
        const message = `${event.message}\nSource: ${event.source}\nTime: ${event.timestamp.toISOString()}`;
        const details = {
            eventId: event.id,
            eventType: event.type,
            severity: event.severity,
            source: event.source,
            userId: event.userId,
            platformId: event.platformId,
            ...event.details
        };
        await this.sendNotification('security_event', priority, title, message, details);
    }
    /**
     * Send critical error notification
     */
    async sendCriticalError(component, error, context = {}) {
        const title = `Critical Error in ${component}`;
        const message = `A critical error occurred in ${component}:\n${error.message}\n\nStack trace:\n${error.stack}`;
        const details = {
            component,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            context
        };
        await this.sendNotification('critical_error', NotificationPriority.CRITICAL, title, message, details, [NotificationChannel.LOG, NotificationChannel.DESKTOP, NotificationChannel.WEBHOOK]);
    }
    /**
     * Get notification history
     */
    async getNotificationHistory(limit = 100) {
        return this.notificationHistory.slice(0, limit);
    }
    /**
     * Get pending notifications
     */
    getPendingNotifications() {
        return [...this.pendingNotifications];
    }
    /**
     * Update notification configuration
     */
    async updateConfiguration(config) {
        this.config = { ...this.config, ...config };
        await this.saveConfiguration();
        this.emit('configurationUpdated', this.config);
    }
    /**
     * Get current configuration
     */
    getConfiguration() {
        return { ...this.config };
    }
    /**
     * Test notification system
     */
    async testNotification(channel) {
        try {
            const testNotification = {
                id: this.generateNotificationId(),
                timestamp: new Date(),
                type: 'test',
                priority: NotificationPriority.LOW,
                title: 'Test Notification',
                message: 'This is a test notification to verify the system is working correctly.',
                details: { test: true },
                channels: [channel],
                sent: false,
                retryCount: 0,
                maxRetries: 1
            };
            const success = await this.sendNotificationToChannel(testNotification, channel);
            return success;
        }
        catch (error) {
            console.error(`Failed to send test notification to ${channel}:`, error);
            return false;
        }
    }
    /**
     * Generate unique notification ID
     */
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Map security event severity to notification priority
     */
    mapSeverityToPriority(severity) {
        switch (severity) {
            case security_logger_1.SecurityEventSeverity.LOW:
                return NotificationPriority.LOW;
            case security_logger_1.SecurityEventSeverity.MEDIUM:
                return NotificationPriority.MEDIUM;
            case security_logger_1.SecurityEventSeverity.HIGH:
                return NotificationPriority.HIGH;
            case security_logger_1.SecurityEventSeverity.CRITICAL:
                return NotificationPriority.CRITICAL;
            default:
                return NotificationPriority.MEDIUM;
        }
    }
    /**
     * Get maximum retry attempts based on priority
     */
    getMaxRetries(priority) {
        switch (priority) {
            case NotificationPriority.CRITICAL:
                return 5;
            case NotificationPriority.HIGH:
                return 3;
            case NotificationPriority.MEDIUM:
                return 2;
            case NotificationPriority.LOW:
                return 1;
            default:
                return 2;
        }
    }
    /**
     * Start the notification processor
     */
    startNotificationProcessor() {
        setInterval(async () => {
            await this.processPendingNotifications();
        }, 5000); // Process every 5 seconds
    }
    /**
     * Process pending notifications
     */
    async processPendingNotifications() {
        const notifications = [...this.pendingNotifications];
        this.pendingNotifications = [];
        for (const notification of notifications) {
            try {
                const success = await this.processNotification(notification);
                if (success) {
                    notification.sent = true;
                    notification.sentAt = new Date();
                    this.addToHistory(notification);
                }
                else {
                    notification.retryCount++;
                    if (notification.retryCount < notification.maxRetries) {
                        // Re-queue for retry
                        this.pendingNotifications.push(notification);
                    }
                    else {
                        // Max retries reached, log failure
                        console.error(`Failed to send notification after ${notification.maxRetries} attempts:`, notification.title);
                        notification.sent = false;
                        this.addToHistory(notification);
                    }
                }
            }
            catch (error) {
                console.error('Error processing notification:', error);
                notification.retryCount++;
                if (notification.retryCount < notification.maxRetries) {
                    this.pendingNotifications.push(notification);
                }
            }
        }
    }
    /**
     * Process a single notification
     */
    async processNotification(notification) {
        let allSuccessful = true;
        for (const channel of notification.channels) {
            try {
                const success = await this.sendNotificationToChannel(notification, channel);
                if (!success) {
                    allSuccessful = false;
                }
            }
            catch (error) {
                console.error(`Failed to send notification to ${channel}:`, error);
                allSuccessful = false;
            }
        }
        return allSuccessful;
    }
    /**
     * Send notification to a specific channel
     */
    async sendNotificationToChannel(notification, channel) {
        switch (channel) {
            case NotificationChannel.LOG:
                return this.sendLogNotification(notification);
            case NotificationChannel.DESKTOP:
                return this.sendDesktopNotification(notification);
            case NotificationChannel.WEBHOOK:
                return this.sendWebhookNotification(notification);
            case NotificationChannel.EMAIL:
                return this.sendEmailNotification(notification);
            default:
                console.warn(`Unknown notification channel: ${channel}`);
                return false;
        }
    }
    /**
     * Send log notification
     */
    async sendLogNotification(notification) {
        try {
            const logEntry = {
                timestamp: notification.timestamp.toISOString(),
                level: 'ADMIN_NOTIFICATION',
                priority: notification.priority,
                title: notification.title,
                message: notification.message,
                details: notification.details
            };
            console.log(`[ADMIN NOTIFICATION] ${notification.priority.toUpperCase()}: ${notification.title}`);
            console.log(`Message: ${notification.message}`);
            // Also write to notification log file
            await fs.appendFile(this.notificationLog, JSON.stringify(logEntry) + '\n', 'utf8');
            return true;
        }
        catch (error) {
            console.error('Failed to send log notification:', error);
            return false;
        }
    }
    /**
     * Send desktop notification
     */
    async sendDesktopNotification(notification) {
        try {
            if (!this.config.desktopConfig?.enabled) {
                return true; // Consider it successful if disabled
            }
            // Emit event for the main process to handle desktop notification
            this.emit('desktopNotification', {
                title: notification.title,
                body: notification.message,
                priority: notification.priority,
                sound: this.config.desktopConfig.soundEnabled
            });
            return true;
        }
        catch (error) {
            console.error('Failed to send desktop notification:', error);
            return false;
        }
    }
    /**
     * Send webhook notification
     */
    async sendWebhookNotification(notification) {
        try {
            if (!this.config.webhookConfig?.url) {
                return true; // Consider it successful if not configured
            }
            const payload = {
                id: notification.id,
                timestamp: notification.timestamp.toISOString(),
                type: notification.type,
                priority: notification.priority,
                title: notification.title,
                message: notification.message,
                details: notification.details
            };
            // Note: In a real implementation, you would use fetch or axios here
            // For now, we'll just log the webhook attempt
            console.log(`Webhook notification would be sent to: ${this.config.webhookConfig.url}`);
            console.log('Payload:', JSON.stringify(payload, null, 2));
            return true;
        }
        catch (error) {
            console.error('Failed to send webhook notification:', error);
            return false;
        }
    }
    /**
     * Send email notification
     */
    async sendEmailNotification(notification) {
        try {
            if (!this.config.emailConfig) {
                return true; // Consider it successful if not configured
            }
            // Note: In a real implementation, you would use nodemailer or similar
            // For now, we'll just log the email attempt
            console.log(`Email notification would be sent to: ${this.config.emailConfig.toAddresses.join(', ')}`);
            console.log(`Subject: ${notification.title}`);
            console.log(`Body: ${notification.message}`);
            return true;
        }
        catch (error) {
            console.error('Failed to send email notification:', error);
            return false;
        }
    }
    /**
     * Add notification to history
     */
    addToHistory(notification) {
        this.notificationHistory.unshift(notification);
        if (this.notificationHistory.length > this.maxHistorySize) {
            this.notificationHistory = this.notificationHistory.slice(0, this.maxHistorySize);
        }
    }
    /**
     * Load configuration from file
     */
    async loadConfiguration() {
        try {
            const fileExists = await fs.access(this.configFile).then(() => true).catch(() => false);
            if (fileExists) {
                const content = await fs.readFile(this.configFile, 'utf8');
                const savedConfig = JSON.parse(content);
                this.config = { ...this.config, ...savedConfig };
            }
        }
        catch (error) {
            console.error('Failed to load notification configuration:', error);
            // Continue with default configuration
        }
    }
    /**
     * Save configuration to file
     */
    async saveConfiguration() {
        try {
            await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
        }
        catch (error) {
            console.error('Failed to save notification configuration:', error);
        }
    }
    /**
     * Load notification history from file
     */
    async loadNotificationHistory() {
        try {
            const fileExists = await fs.access(this.notificationLog).then(() => true).catch(() => false);
            if (!fileExists) {
                return;
            }
            const content = await fs.readFile(this.notificationLog, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.length > 0);
            // Load last 1000 notifications
            const recentLines = lines.slice(-this.maxHistorySize);
            this.notificationHistory = recentLines.map(line => {
                try {
                    const data = JSON.parse(line);
                    // Convert log entry back to notification format
                    return {
                        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        timestamp: new Date(data.timestamp),
                        type: 'historical',
                        priority: data.priority,
                        title: data.title,
                        message: data.message,
                        details: data.details,
                        channels: [NotificationChannel.LOG],
                        sent: true,
                        sentAt: new Date(data.timestamp),
                        retryCount: 0,
                        maxRetries: 1
                    };
                }
                catch (error) {
                    console.error('Failed to parse notification history line:', error);
                    return null;
                }
            }).filter(notification => notification !== null);
        }
        catch (error) {
            console.error('Failed to load notification history:', error);
            // Continue with empty history
        }
    }
}
exports.AdminNotificationManager = AdminNotificationManager;
// Export singleton instance
exports.adminNotificationManager = new AdminNotificationManager();
