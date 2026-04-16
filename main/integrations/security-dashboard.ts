/**
 * Security Event Dashboard and Monitoring
 *
 * Provides real-time security monitoring, event analysis, and dashboard functionality
 * for administrators to monitor system security status.
 */

import { EventEmitter } from 'events';
import { SecurityLogger, SecurityEvent, SecurityEventType, SecurityEventSeverity, SecurityMetrics } from './security-logger';
import { AdminNotificationManager, NotificationPriority } from './admin-notification';

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: 'threshold_exceeded' | 'suspicious_pattern' | 'critical_event' | 'system_anomaly';
  severity: SecurityEventSeverity;
  title: string;
  description: string;
  affectedEvents: SecurityEvent[];
  recommendations: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface SecurityTrend {
  timeframe: string;
  eventCounts: Record<SecurityEventType, number>;
  severityCounts: Record<SecurityEventSeverity, number>;
  totalEvents: number;
  anomalies: string[];
}

export interface DashboardData {
  metrics: SecurityMetrics;
  alerts: SecurityAlert[];
  trends: SecurityTrend[];
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
    lastUpdate: Date;
  };
  recentActivity: SecurityEvent[];
}

/**
 * Security Dashboard Manager
 */
export class SecurityDashboardManager extends EventEmitter {
  private securityLogger: SecurityLogger;
  private adminNotificationManager: AdminNotificationManager;
  private alerts: SecurityAlert[] = [];
  private maxAlertsHistory = 500;
  private monitoringInterval?: NodeJS.Timeout;
  private anomalyDetectionEnabled = true;

  // Thresholds for anomaly detection
  private readonly ANOMALY_THRESHOLDS: Partial<Record<SecurityEventType, { count: number; timeWindow: number }>> = {
    [SecurityEventType.AUTHENTICATION_FAILURE]: { count: 10, timeWindow: 60 * 60 * 1000 }, // 10 failures in 1 hour
    [SecurityEventType.RATE_LIMIT_EXCEEDED]: { count: 5, timeWindow: 30 * 60 * 1000 }, // 5 rate limits in 30 minutes
    [SecurityEventType.SUSPICIOUS_ACTIVITY]: { count: 3, timeWindow: 60 * 60 * 1000 }, // 3 suspicious activities in 1 hour
    [SecurityEventType.INPUT_VALIDATION_FAILURE]: { count: 20, timeWindow: 60 * 60 * 1000 }, // 20 validation failures in 1 hour
    [SecurityEventType.DATA_ACCESS_VIOLATION]: { count: 1, timeWindow: 60 * 60 * 1000 } // Any data access violation
  };

  constructor(securityLogger: SecurityLogger, adminNotificationManager: AdminNotificationManager) {
    super();
    this.securityLogger = securityLogger;
    this.adminNotificationManager = adminNotificationManager;

    // Listen for security events
    this.securityLogger.on('securityEvent', this.handleSecurityEvent.bind(this));
  }

  /**
   * Initialize the security dashboard
   */
  async initialize(): Promise<void> {
    try {
      // Start monitoring
      this.startMonitoring();

      // Perform initial security analysis
      await this.performSecurityAnalysis();

      console.log('Security dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security dashboard:', error);
      throw error;
    }
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
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
  getActiveAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Get all alerts with optional filtering
   */
  getAllAlerts(limit: number = 100): SecurityAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.emit('alertAcknowledged', alert);

    // Log the acknowledgment
    await this.securityLogger.logEvent(
      SecurityEventType.CONFIGURATION_CHANGE,
      SecurityEventSeverity.LOW,
      'security-dashboard',
      `Security alert acknowledged: ${alert.title}`,
      { alertId, acknowledgedBy, alertType: alert.type }
    );

    return true;
  }

  /**
   * Generate security trends analysis
   */
  async generateTrends(): Promise<SecurityTrend[]> {
    const trends: SecurityTrend[] = [];
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

      const eventCounts: Record<SecurityEventType, number> = Object.values(SecurityEventType)
        .reduce((acc, type) => ({ ...acc, [type]: 0 }), {} as Record<SecurityEventType, number>);

      const severityCounts: Record<SecurityEventSeverity, number> = {
        [SecurityEventSeverity.LOW]: 0,
        [SecurityEventSeverity.MEDIUM]: 0,
        [SecurityEventSeverity.HIGH]: 0,
        [SecurityEventSeverity.CRITICAL]: 0
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
  async getSystemHealth(): Promise<DashboardData['systemHealth']> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for critical alerts
    const criticalAlerts = this.alerts.filter(alert =>
      !alert.acknowledged && alert.severity === SecurityEventSeverity.CRITICAL
    );

    if (criticalAlerts.length > 0) {
      status = 'critical';
      issues.push(`${criticalAlerts.length} unacknowledged critical security alerts`);
    }

    // Check for high severity alerts
    const highAlerts = this.alerts.filter(alert =>
      !alert.acknowledged && alert.severity === SecurityEventSeverity.HIGH
    );

    if (highAlerts.length > 5) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`${highAlerts.length} unacknowledged high severity alerts`);
    }

    // Check recent authentication failures
    const recentEvents = await this.securityLogger.getEvents({
      type: [SecurityEventType.AUTHENTICATION_FAILURE],
      startDate: new Date(Date.now() - 60 * 60 * 1000) // Last hour
    });

    if (recentEvents.length > 20) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`High number of authentication failures: ${recentEvents.length} in the last hour`);
    }

    // Check for suspicious activity
    const suspiciousEvents = await this.securityLogger.getEvents({
      type: [SecurityEventType.SUSPICIOUS_ACTIVITY],
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
  async performSecurityAnalysis(): Promise<void> {
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
        alertsGenerated: this.alerts.filter(a =>
          a.timestamp > new Date(Date.now() - 60 * 60 * 1000)
        ).length
      });

    } catch (error) {
      console.error('Error performing security analysis:', error);
    }
  }

  /**
   * Handle incoming security events
   */
  private async handleSecurityEvent(event: SecurityEvent): Promise<void> {
    // Check if this event triggers any immediate alerts
    await this.checkEventForAlerts(event);

    // Emit real-time update
    this.emit('securityEventReceived', event);
  }

  /**
   * Check if a security event should trigger alerts
   */
  private async checkEventForAlerts(event: SecurityEvent): Promise<void> {
    // Always create alert for critical events
    if (event.severity === SecurityEventSeverity.CRITICAL) {
      await this.createAlert(
        'critical_event',
        SecurityEventSeverity.CRITICAL,
        `Critical Security Event: ${event.type}`,
        `A critical security event has occurred: ${event.message}`,
        [event],
        [
          'Investigate the event immediately',
          'Check system logs for related activities',
          'Consider temporarily disabling affected services'
        ]
      );
    }

    // Check for threshold-based alerts
    const threshold = this.ANOMALY_THRESHOLDS[event.type];
    if (threshold) {
      const recentEvents = await this.securityLogger.getEvents({
        type: [event.type],
        startDate: new Date(Date.now() - threshold.timeWindow)
      });

      if (recentEvents.length >= threshold.count) {
        await this.createAlert(
          'threshold_exceeded',
          SecurityEventSeverity.HIGH,
          `Security Event Threshold Exceeded: ${event.type}`,
          `${recentEvents.length} occurrences of ${event.type} in the last ${threshold.timeWindow / 60000} minutes`,
          recentEvents.slice(0, 10), // Include up to 10 recent events
          [
            'Review the affected user accounts or systems',
            'Check for potential security breaches',
            'Consider implementing additional security measures'
          ]
        );
      }
    }
  }

  /**
   * Detect anomalies in security events
   */
  private detectAnomalies(events: SecurityEvent[], timeframeHours: number): string[] {
    const anomalies: string[] = [];

    // Group events by type
    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventType, number>);

    // Check for unusual patterns
    Object.entries(eventsByType).forEach(([type, count]) => {
      const eventType = type as SecurityEventType;
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
  private async detectSuspiciousPatterns(events: SecurityEvent[]): Promise<void> {
    // Pattern 1: Multiple failed authentications from same user
    const failuresByUser = events
      .filter(e => e.type === SecurityEventType.AUTHENTICATION_FAILURE && e.userId)
      .reduce((acc, event) => {
        acc[event.userId!] = (acc[event.userId!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    for (const [userId, count] of Object.entries(failuresByUser)) {
      if (count >= 5) {
        const userEvents = events.filter(e => e.userId === userId);
        await this.createAlert(
          'suspicious_pattern',
          SecurityEventSeverity.HIGH,
          `Suspicious Activity: Multiple Authentication Failures`,
          `User ${userId} has ${count} authentication failures`,
          userEvents,
          [
            'Investigate user account for compromise',
            'Consider temporarily disabling the account',
            'Check for brute force attack patterns'
          ]
        );
      }
    }

    // Pattern 2: Rapid succession of different event types from same source
    const eventsBySource = events.reduce((acc, event) => {
      if (!acc[event.source]) {
        acc[event.source] = [];
      }
      acc[event.source].push(event);
      return acc;
    }, {} as Record<string, SecurityEvent[]>);

    for (const [source, sourceEvents] of Object.entries(eventsBySource)) {
      if (sourceEvents.length >= 10) {
        const uniqueTypes = new Set(sourceEvents.map(e => e.type));
        if (uniqueTypes.size >= 3) {
          await this.createAlert(
            'suspicious_pattern',
            SecurityEventSeverity.MEDIUM,
            `Suspicious Activity: Multiple Event Types from Single Source`,
            `Source ${source} generated ${sourceEvents.length} events of ${uniqueTypes.size} different types`,
            sourceEvents.slice(0, 10),
            [
              'Investigate the source system or component',
              'Check for potential security scanning or probing',
              'Review system logs for additional context'
            ]
          );
        }
      }
    }
  }

  /**
   * Detect and create alerts based on event analysis
   */
  private async detectAndCreateAlerts(events: SecurityEvent[]): Promise<void> {
    // Check each event type against thresholds
    for (const [eventType, threshold] of Object.entries(this.ANOMALY_THRESHOLDS)) {
      const typeEvents = events.filter(e => e.type === eventType as SecurityEventType);

      if (typeEvents.length >= threshold.count) {
        // Check if we already have a recent alert for this type
        const recentAlert = this.alerts.find(alert =>
          alert.type === 'threshold_exceeded' &&
          alert.affectedEvents.some(e => e.type === eventType) &&
          alert.timestamp > new Date(Date.now() - threshold.timeWindow)
        );

        if (!recentAlert) {
          await this.createAlert(
            'threshold_exceeded',
            SecurityEventSeverity.HIGH,
            `Security Threshold Exceeded: ${eventType}`,
            `${typeEvents.length} occurrences of ${eventType} detected`,
            typeEvents,
            [
              'Review affected systems and users',
              'Check for potential security incidents',
              'Consider adjusting security policies'
            ]
          );
        }
      }
    }
  }

  /**
   * Create a new security alert
   */
  private async createAlert(
    type: SecurityAlert['type'],
    severity: SecurityEventSeverity,
    title: string,
    description: string,
    affectedEvents: SecurityEvent[],
    recommendations: string[]
  ): Promise<void> {
    const alert: SecurityAlert = {
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
    if (severity === SecurityEventSeverity.HIGH || severity === SecurityEventSeverity.CRITICAL) {
      const priority = severity === SecurityEventSeverity.CRITICAL ?
        NotificationPriority.CRITICAL : NotificationPriority.HIGH;

      await this.adminNotificationManager.sendNotification(
        'security_alert',
        priority,
        title,
        description,
        {
          alertId: alert.id,
          alertType: type,
          affectedEventsCount: affectedEvents.length,
          recommendations
        }
      );
    }

    this.emit('alertCreated', alert);
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start monitoring for security events
   */
  private startMonitoring(): void {
    // Perform security analysis every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.performSecurityAnalysis();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Enable or disable anomaly detection
   */
  setAnomalyDetection(enabled: boolean): void {
    this.anomalyDetectionEnabled = enabled;
  }
}

// Export the dashboard manager
