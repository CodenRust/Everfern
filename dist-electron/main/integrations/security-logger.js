"use strict";
/**
 * Security Event Logger and Monitoring System
 *
 * Provides comprehensive audit logging for security events, administrator notifications,
 * and security event monitoring dashboard functionality.
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
exports.securityDashboard = exports.securityLogger = exports.SecurityDashboard = exports.SecurityLogger = exports.SecurityEventSeverity = exports.SecurityEventType = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = require("os");
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["AUTHENTICATION_SUCCESS"] = "auth_success";
    SecurityEventType["AUTHENTICATION_FAILURE"] = "auth_failure";
    SecurityEventType["AUTHORIZATION_DENIED"] = "auth_denied";
    SecurityEventType["RATE_LIMIT_EXCEEDED"] = "rate_limit_exceeded";
    SecurityEventType["SUSPICIOUS_ACTIVITY"] = "suspicious_activity";
    SecurityEventType["CONFIGURATION_CHANGE"] = "config_change";
    SecurityEventType["PLATFORM_CONNECTION_FAILURE"] = "platform_connection_failure";
    SecurityEventType["INPUT_VALIDATION_FAILURE"] = "input_validation_failure";
    SecurityEventType["ENCRYPTION_FAILURE"] = "encryption_failure";
    SecurityEventType["DATA_ACCESS_VIOLATION"] = "data_access_violation";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
var SecurityEventSeverity;
(function (SecurityEventSeverity) {
    SecurityEventSeverity["LOW"] = "low";
    SecurityEventSeverity["MEDIUM"] = "medium";
    SecurityEventSeverity["HIGH"] = "high";
    SecurityEventSeverity["CRITICAL"] = "critical";
})(SecurityEventSeverity || (exports.SecurityEventSeverity = SecurityEventSeverity = {}));
/**
 * Security Event Logger - handles logging, storage, and monitoring of security events
 */
class SecurityLogger extends events_1.EventEmitter {
    logDirectory;
    logFile;
    metricsFile;
    events = [];
    maxEventsInMemory = 1000;
    adminNotificationThresholds = new Map();
    constructor() {
        super();
        this.logDirectory = path.join((0, os_1.homedir)(), '.everfern', 'security');
        this.logFile = path.join(this.logDirectory, 'security-events.jsonl');
        this.metricsFile = path.join(this.logDirectory, 'security-metrics.json');
        // Set default notification thresholds
        this.adminNotificationThresholds.set(SecurityEventType.AUTHENTICATION_FAILURE, 5);
        this.adminNotificationThresholds.set(SecurityEventType.RATE_LIMIT_EXCEEDED, 10);
        this.adminNotificationThresholds.set(SecurityEventType.SUSPICIOUS_ACTIVITY, 1);
        this.adminNotificationThresholds.set(SecurityEventType.DATA_ACCESS_VIOLATION, 1);
    }
    /**
     * Initialize the security logger
     */
    async initialize() {
        try {
            await fs.mkdir(this.logDirectory, { recursive: true });
            await this.loadRecentEvents();
        }
        catch (error) {
            console.error('Failed to initialize security logger:', error);
            throw error;
        }
    }
    /**
     * Log a security event
     */
    async logEvent(type, severity, source, message, details = {}, userId, platformId, ipAddress, userAgent) {
        const event = {
            id: this.generateEventId(),
            timestamp: new Date(),
            type,
            severity,
            source,
            message,
            details,
            userId,
            platformId,
            ipAddress,
            userAgent
        };
        try {
            // Add to in-memory storage
            this.events.push(event);
            if (this.events.length > this.maxEventsInMemory) {
                this.events.shift(); // Remove oldest event
            }
            // Persist to file
            await this.persistEvent(event);
            // Emit event for real-time monitoring
            this.emit('securityEvent', event);
            // Check for admin notification triggers
            await this.checkAdminNotificationTriggers(event);
            console.log(`Security event logged: ${type} - ${severity} - ${message}`);
        }
        catch (error) {
            console.error('Failed to log security event:', error);
            // Don't throw - security logging should not break the application
        }
    }
    /**
     * Get security events with optional filtering
     */
    async getEvents(filter = {}) {
        let filteredEvents = [...this.events];
        // Apply filters
        if (filter.type && filter.type.length > 0) {
            filteredEvents = filteredEvents.filter(event => filter.type.includes(event.type));
        }
        if (filter.severity && filter.severity.length > 0) {
            filteredEvents = filteredEvents.filter(event => filter.severity.includes(event.severity));
        }
        if (filter.source && filter.source.length > 0) {
            filteredEvents = filteredEvents.filter(event => filter.source.includes(event.source));
        }
        if (filter.userId) {
            filteredEvents = filteredEvents.filter(event => event.userId === filter.userId);
        }
        if (filter.startDate) {
            filteredEvents = filteredEvents.filter(event => event.timestamp >= filter.startDate);
        }
        if (filter.endDate) {
            filteredEvents = filteredEvents.filter(event => event.timestamp <= filter.endDate);
        }
        // Sort by timestamp (newest first)
        filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (filter.limit && filter.limit > 0) {
            filteredEvents = filteredEvents.slice(0, filter.limit);
        }
        return filteredEvents;
    }
    /**
     * Get security metrics and statistics
     */
    async getMetrics() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentEvents = this.events.filter(event => event.timestamp >= last24Hours);
        const eventsBySeverity = {
            [SecurityEventSeverity.LOW]: 0,
            [SecurityEventSeverity.MEDIUM]: 0,
            [SecurityEventSeverity.HIGH]: 0,
            [SecurityEventSeverity.CRITICAL]: 0
        };
        const eventsByType = Object.values(SecurityEventType)
            .reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
        let suspiciousActivityCount = 0;
        let failedAuthenticationCount = 0;
        recentEvents.forEach(event => {
            eventsBySeverity[event.severity]++;
            eventsByType[event.type]++;
            if (event.type === SecurityEventType.SUSPICIOUS_ACTIVITY) {
                suspiciousActivityCount++;
            }
            if (event.type === SecurityEventType.AUTHENTICATION_FAILURE) {
                failedAuthenticationCount++;
            }
        });
        return {
            totalEvents: recentEvents.length,
            eventsBySeverity,
            eventsByType,
            recentEvents: recentEvents.slice(0, 10), // Last 10 events
            suspiciousActivityCount,
            failedAuthenticationCount
        };
    }
    /**
     * Set admin notification threshold for a specific event type
     */
    setNotificationThreshold(eventType, threshold) {
        this.adminNotificationThresholds.set(eventType, threshold);
    }
    /**
     * Clear old security events (data retention)
     */
    async clearOldEvents(retentionDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const initialCount = this.events.length;
        this.events = this.events.filter(event => event.timestamp >= cutoffDate);
        const removedCount = initialCount - this.events.length;
        if (removedCount > 0) {
            await this.logEvent(SecurityEventType.CONFIGURATION_CHANGE, SecurityEventSeverity.LOW, 'security-logger', `Cleared ${removedCount} old security events`, { retentionDays, removedCount });
        }
        return removedCount;
    }
    /**
     * Generate a unique event ID
     */
    generateEventId() {
        return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Persist event to file
     */
    async persistEvent(event) {
        const eventLine = JSON.stringify(event) + '\n';
        await fs.appendFile(this.logFile, eventLine, 'utf8');
    }
    /**
     * Load recent events from file on startup
     */
    async loadRecentEvents() {
        try {
            const fileExists = await fs.access(this.logFile).then(() => true).catch(() => false);
            if (!fileExists) {
                return;
            }
            const content = await fs.readFile(this.logFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.length > 0);
            // Load last 1000 events
            const recentLines = lines.slice(-this.maxEventsInMemory);
            this.events = recentLines.map(line => {
                try {
                    const event = JSON.parse(line);
                    event.timestamp = new Date(event.timestamp);
                    return event;
                }
                catch (error) {
                    console.error('Failed to parse security event line:', error);
                    return null;
                }
            }).filter(event => event !== null);
        }
        catch (error) {
            console.error('Failed to load recent security events:', error);
            // Continue with empty events array
        }
    }
    /**
     * Check if admin notification should be triggered
     */
    async checkAdminNotificationTriggers(event) {
        const threshold = this.adminNotificationThresholds.get(event.type);
        if (!threshold) {
            return;
        }
        // Count recent events of the same type (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentSimilarEvents = this.events.filter(e => e.type === event.type &&
            e.timestamp >= oneHourAgo);
        if (recentSimilarEvents.length >= threshold) {
            this.emit('adminNotification', {
                type: 'security_threshold_exceeded',
                eventType: event.type,
                count: recentSimilarEvents.length,
                threshold,
                latestEvent: event
            });
        }
        // Always notify for critical events
        if (event.severity === SecurityEventSeverity.CRITICAL) {
            this.emit('adminNotification', {
                type: 'critical_security_event',
                event
            });
        }
    }
}
exports.SecurityLogger = SecurityLogger;
/**
 * Security Event Dashboard - provides monitoring interface
 */
class SecurityDashboard {
    securityLogger;
    constructor(securityLogger) {
        this.securityLogger = securityLogger;
    }
    /**
     * Get dashboard data for security monitoring
     */
    async getDashboardData() {
        const metrics = await this.securityLogger.getMetrics();
        // Get high and critical severity events as alerts
        const alerts = await this.securityLogger.getEvents({
            severity: [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL],
            limit: 20
        });
        // Generate trend data (events per hour for last 24 hours)
        const trends = await this.generateTrendData();
        return {
            metrics,
            alerts,
            trends
        };
    }
    /**
     * Generate trend data for the dashboard
     */
    async generateTrendData() {
        const now = new Date();
        const trends = {};
        // Initialize trend arrays for each event type
        Object.values(SecurityEventType).forEach(type => {
            trends[type] = new Array(24).fill(0);
        });
        // Get events from last 24 hours
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentEvents = await this.securityLogger.getEvents({
            startDate: last24Hours
        });
        // Count events per hour
        recentEvents.forEach(event => {
            const hoursDiff = Math.floor((now.getTime() - event.timestamp.getTime()) / (60 * 60 * 1000));
            const hourIndex = 23 - hoursDiff; // Reverse order (most recent = index 23)
            if (hourIndex >= 0 && hourIndex < 24) {
                trends[event.type][hourIndex]++;
            }
        });
        return trends;
    }
}
exports.SecurityDashboard = SecurityDashboard;
// Export singleton instance
exports.securityLogger = new SecurityLogger();
exports.securityDashboard = new SecurityDashboard(exports.securityLogger);
