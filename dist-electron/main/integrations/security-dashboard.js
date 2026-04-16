"use strict";
/**
 * Security Event Dashboard and Monitoring
 *
 * Provides real-time security monitoring, event analysis, and dashboard functionality
 * for administrators to monitor system security status.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityDashboardManager = void 0;
const events_1 = require("events");
const security_logger_1 = require("./security-logger");
const admin_notification_1 = require("./admin-notification");
/**
 * Security Dashboard Manager
 */
class SecurityDashboardManager extends events_1.EventEmitter {
    securityLogger;
    adminNotificationManager;
    alerts = [];
    maxAlertsHistory = 500;
    monitoringInterval;
    anomalyDetectionEnabled = true;
    // Thresholds for anomaly detection
    ANOMALY_THRESHOLDS = {
        [security_logger_1.SecurityEventType.AUTHENTICATION_FAILURE]: { count: 10, timeWindow: 60 * 60 * 1000 }, // 10 failures in 1 hour
        [security_logger_1.SecurityEventType.RATE_LIMIT_EXCEEDED]: { count: 5, timeWindow: 30 * 60 * 1000 }, // 5 rate limits in 30 minutes
        [security_logger_1.SecurityEventType.SUSPICIOUS_ACTIVITY]: { count: 3, timeWindow: 60 * 60 * 1000 }, // 3 suspicious activities in 1 hour
        [security_logger_1.SecurityEventType.INPUT_VALIDATION_FAILURE]: { count: 20, timeWindow: 60 * 60 * 1000 }, // 20 validation failures in 1 hour
        [security_logger_1.SecurityEventType.DATA_ACCESS_VIOLATION]: { count: 1, timeWindow: 60 * 60 * 1000 } // Any data access violation
    };
    constructor(securityLogger, adminNotificationManager) {
        super();
        this.securityLogger = securityLogger;
        this.adminNotificationManager = adminNotificationManager;
        // Listen for security events
        this.securityLogger.on('securityEvent', this.handleSecurityEvent.bind(this));
    }
    /**
     * Initialize the security dashboard
     */
    async initialize() {
        try {
            // Start monitoring
            this.startMonitoring();
            // Perform initial security analysis
            await this.performSecurityAnalysis();
            console.log('Security dashboard initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize security dashboard:', error);
            throw error;
        }
    }
    /**
     * Get complete dashboard data
     */
    async getDashboardData() {
        const metrics = await this.securityLogger.getMetrics();
        const trends = await this.generateTrends();
        const systemHealth = await this.getSystemHealth();
        const recentActivity = await this.securityLogger.getEvents({ limit: 50 });
        return {
            metrics,
            alerts: this.getActiveAlerts(),
            trends,
            systemHealth,
            recentActivity
        };
    }
    /**
     * Get active (unacknowledged) alerts
     */
    getActiveAlerts() {
        return this.alerts.filter(alert => !alert.acknowledged);
    }
    /**
     * Get all alerts with optional filtering
     */
    getAllAlerts(limit = 100) {
        return this.alerts.slice(0, limit);
    }
    /**
     * Acknowledge an alert
     */
    async acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            return false;
        }
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = new Date();
        this.emit('alertAcknowledged', alert);
        // Log the acknowledgment
        await this.securityLogger.logEvent(security_logger_1.SecurityEventType.CONFIGURATION_CHANGE, security_logger_1.SecurityEventSeverity.LOW, 'security-dashboard', `Security alert acknowledged: ${alert.title}`, { alertId, acknowledgedBy, alertType: alert.type });
        return true;
    }
    /**
     * Generate security trends analysis
     */
    async generateTrends() {
        const trends = [];
        const now = new Date();
        // Generate trends for different timeframes
        const timeframes = [
            { name: 'Last Hour', hours: 1 },
            { name: 'Last 6 Hours', hours: 6 },
            { name: 'Last 24 Hours', hours: 24 },
            { name: 'Last 7 Days', hours: 24 * 7 }
        ];
        for (const timeframe of timeframes) {
            const startTime = new Date(now.getTime() - timeframe.hours * 60 * 60 * 1000);
            const events = await this.securityLogger.getEvents({ startDate: startTime });
            const eventCounts = Object.values(security_logger_1.SecurityEventType)
                .reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
            const severityCounts = {
                [security_logger_1.SecurityEventSeverity.LOW]: 0,
                [security_logger_1.SecurityEventSeverity.MEDIUM]: 0,
                [security_logger_1.SecurityEventSeverity.HIGH]: 0,
                [security_logger_1.SecurityEventSeverity.CRITICAL]: 0
            };
            events.forEach(event => {
                eventCounts[event.type]++;
                severityCounts[event.severity]++;
            });
            const anomalies = this.detectAnomalies(events, timeframe.hours);
            trends.push({
                timeframe: timeframe.name,
                eventCounts,
                severityCounts,
                totalEvents: events.length,
                anomalies
            });
        }
        return trends;
    }
    /**
     * Get system health status
     */
    async getSystemHealth() {
        const issues = [];
        let status = 'healthy';
        // Check for critical alerts
        const criticalAlerts = this.alerts.filter(alert => !alert.acknowledged && alert.severity === security_logger_1.SecurityEventSeverity.CRITICAL);
        if (criticalAlerts.length > 0) {
            status = 'critical';
            issues.push(`${criticalAlerts.length} unacknowledged critical security alerts`);
        }
        // Check for high severity alerts
        const highAlerts = this.alerts.filter(alert => !alert.acknowledged && alert.severity === security_logger_1.SecurityEventSeverity.HIGH);
        if (highAlerts.length > 5) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push(`${highAlerts.length} unacknowledged high severity alerts`);
        }
        // Check recent authentication failures
        const recentEvents = await this.securityLogger.getEvents({
            type: [security_logger_1.SecurityEventType.AUTHENTICATION_FAILURE],
            startDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        });
        if (recentEvents.length > 20) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push(`High number of authentication failures: ${recentEvents.length} in the last hour`);
        }
        // Check for suspicious activity
        const suspiciousEvents = await this.securityLogger.getEvents({
            type: [security_logger_1.SecurityEventType.SUSPICIOUS_ACTIVITY],
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        });
        if (suspiciousEvents.length > 0) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push(`${suspiciousEvents.length} suspicious activities detected in the last 24 hours`);
        }
        return {
            status,
            issues,
            uptime: process.uptime() * 1000, // Convert to milliseconds
            lastUpdate: new Date()
        };
    }
    /**
     * Perform comprehensive security analysis
     */
    async performSecurityAnalysis() {
        try {
            // Analyze recent events for patterns
            const recentEvents = await this.securityLogger.getEvents({
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            });
            // Check for anomalies
            if (this.anomalyDetectionEnabled) {
                await this.detectAndCreateAlerts(recentEvents);
            }
            // Check for suspicious patterns
            await this.detectSuspiciousPatterns(recentEvents);
            this.emit('securityAnalysisComplete', {
                eventsAnalyzed: recentEvents.length,
                alertsGenerated: this.alerts.filter(a => a.timestamp > new Date(Date.now() - 60 * 60 * 1000)).length
            });
        }
        catch (error) {
            console.error('Error performing security analysis:', error);
        }
    }
    /**
     * Handle incoming security events
     */
    async handleSecurityEvent(event) {
        // Check if this event triggers any immediate alerts
        await this.checkEventForAlerts(event);
        // Emit real-time update
        this.emit('securityEventReceived', event);
    }
    /**
     * Check if a security event should trigger alerts
     */
    async checkEventForAlerts(event) {
        // Always create alert for critical events
        if (event.severity === security_logger_1.SecurityEventSeverity.CRITICAL) {
            await this.createAlert('critical_event', security_logger_1.SecurityEventSeverity.CRITICAL, `Critical Security Event: ${event.type}`, `A critical security event has occurred: ${event.message}`, [event], [
                'Investigate the event immediately',
                'Check system logs for related activities',
                'Consider temporarily disabling affected services'
            ]);
        }
        // Check for threshold-based alerts
        const threshold = this.ANOMALY_THRESHOLDS[event.type];
        if (threshold) {
            const recentEvents = await this.securityLogger.getEvents({
                type: [event.type],
                startDate: new Date(Date.now() - threshold.timeWindow)
            });
            if (recentEvents.length >= threshold.count) {
                await this.createAlert('threshold_exceeded', security_logger_1.SecurityEventSeverity.HIGH, `Security Event Threshold Exceeded: ${event.type}`, `${recentEvents.length} occurrences of ${event.type} in the last ${threshold.timeWindow / 60000} minutes`, recentEvents.slice(0, 10), // Include up to 10 recent events
                [
                    'Review the affected user accounts or systems',
                    'Check for potential security breaches',
                    'Consider implementing additional security measures'
                ]);
            }
        }
    }
    /**
     * Detect anomalies in security events
     */
    detectAnomalies(events, timeframeHours) {
        const anomalies = [];
        // Group events by type
        const eventsByType = events.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
        }, {});
        // Check for unusual patterns
        Object.entries(eventsByType).forEach(([type, count]) => {
            const eventType = type;
            const threshold = this.ANOMALY_THRESHOLDS[eventType];
            if (threshold) {
                const expectedMaxCount = Math.ceil((threshold.count * timeframeHours * 60 * 60 * 1000) / threshold.timeWindow);
                if (count > expectedMaxCount) {
                    anomalies.push(`Unusual spike in ${eventType}: ${count} events (expected max: ${expectedMaxCount})`);
                }
            }
        });
        return anomalies;
    }
    /**
     * Detect suspicious patterns in security events
     */
    async detectSuspiciousPatterns(events) {
        // Pattern 1: Multiple failed authentications from same user
        const failuresByUser = events
            .filter(e => e.type === security_logger_1.SecurityEventType.AUTHENTICATION_FAILURE && e.userId)
            .reduce((acc, event) => {
            acc[event.userId] = (acc[event.userId] || 0) + 1;
            return acc;
        }, {});
        for (const [userId, count] of Object.entries(failuresByUser)) {
            if (count >= 5) {
                const userEvents = events.filter(e => e.userId === userId);
                await this.createAlert('suspicious_pattern', security_logger_1.SecurityEventSeverity.HIGH, `Suspicious Activity: Multiple Authentication Failures`, `User ${userId} has ${count} authentication failures`, userEvents, [
                    'Investigate user account for compromise',
                    'Consider temporarily disabling the account',
                    'Check for brute force attack patterns'
                ]);
            }
        }
        // Pattern 2: Rapid succession of different event types from same source
        const eventsBySource = events.reduce((acc, event) => {
            if (!acc[event.source]) {
                acc[event.source] = [];
            }
            acc[event.source].push(event);
            return acc;
        }, {});
        for (const [source, sourceEvents] of Object.entries(eventsBySource)) {
            if (sourceEvents.length >= 10) {
                const uniqueTypes = new Set(sourceEvents.map(e => e.type));
                if (uniqueTypes.size >= 3) {
                    await this.createAlert('suspicious_pattern', security_logger_1.SecurityEventSeverity.MEDIUM, `Suspicious Activity: Multiple Event Types from Single Source`, `Source ${source} generated ${sourceEvents.length} events of ${uniqueTypes.size} different types`, sourceEvents.slice(0, 10), [
                        'Investigate the source system or component',
                        'Check for potential security scanning or probing',
                        'Review system logs for additional context'
                    ]);
                }
            }
        }
    }
    /**
     * Detect and create alerts based on event analysis
     */
    async detectAndCreateAlerts(events) {
        // Check each event type against thresholds
        for (const [eventType, threshold] of Object.entries(this.ANOMALY_THRESHOLDS)) {
            const typeEvents = events.filter(e => e.type === eventType);
            if (typeEvents.length >= threshold.count) {
                // Check if we already have a recent alert for this type
                const recentAlert = this.alerts.find(alert => alert.type === 'threshold_exceeded' &&
                    alert.affectedEvents.some(e => e.type === eventType) &&
                    alert.timestamp > new Date(Date.now() - threshold.timeWindow));
                if (!recentAlert) {
                    await this.createAlert('threshold_exceeded', security_logger_1.SecurityEventSeverity.HIGH, `Security Threshold Exceeded: ${eventType}`, `${typeEvents.length} occurrences of ${eventType} detected`, typeEvents, [
                        'Review affected systems and users',
                        'Check for potential security incidents',
                        'Consider adjusting security policies'
                    ]);
                }
            }
        }
    }
    /**
     * Create a new security alert
     */
    async createAlert(type, severity, title, description, affectedEvents, recommendations) {
        const alert = {
            id: this.generateAlertId(),
            timestamp: new Date(),
            type,
            severity,
            title,
            description,
            affectedEvents,
            recommendations,
            acknowledged: false
        };
        this.alerts.unshift(alert);
        // Limit alerts history
        if (this.alerts.length > this.maxAlertsHistory) {
            this.alerts = this.alerts.slice(0, this.maxAlertsHistory);
        }
        // Send admin notification for high and critical alerts
        if (severity === security_logger_1.SecurityEventSeverity.HIGH || severity === security_logger_1.SecurityEventSeverity.CRITICAL) {
            const priority = severity === security_logger_1.SecurityEventSeverity.CRITICAL ?
                admin_notification_1.NotificationPriority.CRITICAL : admin_notification_1.NotificationPriority.HIGH;
            await this.adminNotificationManager.sendNotification('security_alert', priority, title, description, {
                alertId: alert.id,
                alertType: type,
                affectedEventsCount: affectedEvents.length,
                recommendations
            });
        }
        this.emit('alertCreated', alert);
    }
    /**
     * Generate unique alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Start monitoring for security events
     */
    startMonitoring() {
        // Perform security analysis every 5 minutes
        this.monitoringInterval = setInterval(async () => {
            await this.performSecurityAnalysis();
        }, 5 * 60 * 1000);
    }
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
    }
    /**
     * Enable or disable anomaly detection
     */
    setAnomalyDetection(enabled) {
        this.anomalyDetectionEnabled = enabled;
    }
}
exports.SecurityDashboardManager = SecurityDashboardManager;
// Export the dashboard manager
