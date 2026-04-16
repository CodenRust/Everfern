"use strict";
/**
 * Health Monitoring System
 *
 * Provides health check endpoints for system monitoring, service availability tracking,
 * and graceful degradation when platforms are unavailable.
 *
 * Requirements: 9.8, 9.9, 9.10
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultHealthCheckConfig = exports.HealthMonitor = exports.HealthStatus = void 0;
exports.getHealthMonitor = getHealthMonitor;
exports.createHealthMonitor = createHealthMonitor;
const events_1 = require("events");
const error_logger_1 = require("./error-logger");
/**
 * Health status levels
 */
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "healthy";
    HealthStatus["DEGRADED"] = "degraded";
    HealthStatus["UNHEALTHY"] = "unhealthy";
    HealthStatus["UNKNOWN"] = "unknown";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
/**
 * Health monitoring system
 */
class HealthMonitor extends events_1.EventEmitter {
    config;
    services = new Map();
    healthChecks = new Map();
    checkInterval;
    recoveryAttempts = new Map();
    startTime = Date.now();
    errorLogger = (0, error_logger_1.getErrorLogger)();
    isRunning = false;
    constructor(config) {
        super();
        this.config = {
            checkInterval: 30000, // 30 seconds
            checkTimeout: 5000, // 5 seconds
            failureThreshold: 3,
            successThreshold: 2,
            enableAutoRecovery: true,
            recoveryInterval: 60000, // 1 minute
            maxRecoveryAttempts: 5,
            ...config
        };
    }
    /**
     * Register a service for health monitoring
     */
    registerService(checker) {
        this.services.set(checker.name, checker);
        // Initialize health check record
        this.healthChecks.set(checker.name, {
            service: checker.name,
            status: HealthStatus.UNKNOWN,
            available: false,
            consecutiveFailures: 0,
            metadata: {}
        });
        this.emit('serviceRegistered', checker.name);
        console.log(`[HealthMonitor] Registered service: ${checker.name}`);
    }
    /**
     * Unregister a service from health monitoring
     */
    unregisterService(serviceName) {
        this.services.delete(serviceName);
        this.healthChecks.delete(serviceName);
        this.recoveryAttempts.delete(serviceName);
        this.emit('serviceUnregistered', serviceName);
        console.log(`[HealthMonitor] Unregistered service: ${serviceName}`);
    }
    /**
     * Start health monitoring
     */
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.startTime = Date.now();
        // Perform initial health check
        this.performHealthChecks().catch(error => {
            console.error('[HealthMonitor] Initial health check failed:', error);
        });
        // Start periodic health checks
        this.checkInterval = setInterval(() => {
            this.performHealthChecks().catch(error => {
                console.error('[HealthMonitor] Health check failed:', error);
            });
        }, this.config.checkInterval);
        this.emit('started');
        console.log('[HealthMonitor] Health monitoring started');
    }
    /**
     * Stop health monitoring
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
        }
        this.isRunning = false;
        this.emit('stopped');
        console.log('[HealthMonitor] Health monitoring stopped');
    }
    /**
     * Get current system health
     */
    async getSystemHealth() {
        // Perform fresh health checks
        await this.performHealthChecks();
        const services = {};
        const degradedServices = [];
        const unavailableServices = [];
        let healthyCount = 0;
        let degradedCount = 0;
        let unhealthyCount = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;
        for (const [name, check] of this.healthChecks) {
            services[name] = { ...check };
            if (check.status === HealthStatus.HEALTHY) {
                healthyCount++;
            }
            else if (check.status === HealthStatus.DEGRADED) {
                degradedCount++;
                degradedServices.push(name);
            }
            else if (check.status === HealthStatus.UNHEALTHY) {
                unhealthyCount++;
                unavailableServices.push(name);
            }
            if (check.responseTime !== undefined) {
                totalResponseTime += check.responseTime;
                responseTimeCount++;
            }
        }
        // Determine overall system status
        let overallStatus;
        if (unhealthyCount > 0) {
            overallStatus = HealthStatus.UNHEALTHY;
        }
        else if (degradedCount > 0) {
            overallStatus = HealthStatus.DEGRADED;
        }
        else if (healthyCount > 0) {
            overallStatus = HealthStatus.HEALTHY;
        }
        else {
            overallStatus = HealthStatus.UNKNOWN;
        }
        return {
            status: overallStatus,
            timestamp: new Date(),
            uptime: Date.now() - this.startTime,
            services,
            degradedServices,
            unavailableServices,
            metrics: {
                totalServices: this.services.size,
                healthyServices: healthyCount,
                degradedServices: degradedCount,
                unhealthyServices: unhealthyCount,
                avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0
            }
        };
    }
    /**
     * Get health check for specific service
     */
    getServiceHealth(serviceName) {
        return this.healthChecks.get(serviceName);
    }
    /**
     * Check if service is available
     */
    isServiceAvailable(serviceName) {
        const check = this.healthChecks.get(serviceName);
        return check?.available ?? false;
    }
    /**
     * Get all unavailable services
     */
    getUnavailableServices() {
        const unavailable = [];
        for (const [name, check] of this.healthChecks) {
            if (!check.available) {
                unavailable.push(name);
            }
        }
        return unavailable;
    }
    /**
     * Manually trigger health check for specific service
     */
    async checkService(serviceName) {
        const checker = this.services.get(serviceName);
        if (!checker) {
            throw new Error(`Service not registered: ${serviceName}`);
        }
        await this.performServiceHealthCheck(serviceName, checker);
        const check = this.healthChecks.get(serviceName);
        if (!check) {
            throw new Error(`Health check not found for service: ${serviceName}`);
        }
        return check;
    }
    /**
     * Manually trigger recovery for specific service
     */
    async recoverService(serviceName) {
        const checker = this.services.get(serviceName);
        if (!checker || !checker.recover) {
            return false;
        }
        try {
            console.log(`[HealthMonitor] Attempting manual recovery for service: ${serviceName}`);
            const recovered = await checker.recover();
            if (recovered) {
                // Reset recovery attempts
                this.recoveryAttempts.delete(serviceName);
                // Perform health check to update status
                await this.performServiceHealthCheck(serviceName, checker);
                this.emit('serviceRecovered', serviceName);
                console.log(`[HealthMonitor] Service recovered: ${serviceName}`);
            }
            return recovered;
        }
        catch (error) {
            console.error(`[HealthMonitor] Recovery failed for service ${serviceName}:`, error);
            return false;
        }
    }
    /**
     * Update health check configuration
     */
    updateConfig(newConfig) {
        const oldInterval = this.config.checkInterval;
        this.config = { ...this.config, ...newConfig };
        // Restart monitoring if interval changed
        if (this.isRunning && oldInterval !== this.config.checkInterval) {
            this.stop();
            this.start();
        }
        this.emit('configUpdated', this.config);
    }
    /**
     * Get health monitoring statistics
     */
    getStatistics() {
        const stats = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageResponseTime: 0,
            uptime: Date.now() - this.startTime,
            serviceStats: {}
        };
        // Calculate statistics from health checks
        for (const [name, check] of this.healthChecks) {
            const serviceStats = {
                totalChecks: 0,
                successfulChecks: 0,
                failedChecks: check.consecutiveFailures,
                averageResponseTime: check.responseTime || 0,
                availability: check.available ? 100 : 0
            };
            stats.serviceStats[name] = serviceStats;
            stats.totalChecks += serviceStats.totalChecks;
            stats.successfulChecks += serviceStats.successfulChecks;
            stats.failedChecks += serviceStats.failedChecks;
        }
        return stats;
    }
    /**
     * Perform health checks for all services
     */
    async performHealthChecks() {
        const checks = [];
        for (const [name, checker] of this.services) {
            checks.push(this.performServiceHealthCheck(name, checker));
        }
        await Promise.allSettled(checks);
    }
    /**
     * Perform health check for specific service
     */
    async performServiceHealthCheck(serviceName, checker) {
        const startTime = Date.now();
        let check = this.healthChecks.get(serviceName);
        if (!check) {
            check = {
                service: serviceName,
                status: HealthStatus.UNKNOWN,
                available: false,
                consecutiveFailures: 0
            };
            this.healthChecks.set(serviceName, check);
        }
        try {
            // Perform health check with timeout
            const result = await this.withTimeout(checker.check(), this.config.checkTimeout, `Health check timeout for ${serviceName}`);
            const responseTime = Date.now() - startTime;
            if (result.healthy) {
                // Service is healthy
                check.status = HealthStatus.HEALTHY;
                check.available = true;
                check.responseTime = responseTime;
                check.lastSuccess = new Date();
                check.consecutiveFailures = 0;
                check.error = undefined;
                check.metadata = result.metadata;
                // Reset recovery attempts on success
                this.recoveryAttempts.delete(serviceName);
                this.emit('serviceHealthy', serviceName, check);
            }
            else {
                // Service check failed
                this.handleServiceFailure(serviceName, check, result.error, responseTime);
            }
        }
        catch (error) {
            // Health check threw an error
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.handleServiceFailure(serviceName, check, errorMessage, responseTime);
        }
        this.healthChecks.set(serviceName, check);
    }
    /**
     * Handle service health check failure
     */
    async handleServiceFailure(serviceName, check, error, responseTime) {
        check.consecutiveFailures++;
        check.lastFailure = new Date();
        check.responseTime = responseTime;
        check.error = error;
        // Determine status based on failure threshold
        if (check.consecutiveFailures >= this.config.failureThreshold) {
            check.status = HealthStatus.UNHEALTHY;
            check.available = false;
            // Log error
            await this.errorLogger.logError(new Error(`Service unhealthy: ${serviceName} - ${error}`), error_logger_1.ErrorSeverity.HIGH, error_logger_1.ErrorCategory.PLATFORM_CONNECTION, {
                component: 'health-monitor',
                operation: 'health_check',
                platform: serviceName,
                metadata: {
                    consecutiveFailures: check.consecutiveFailures,
                    error
                }
            });
            this.emit('serviceUnhealthy', serviceName, check);
            // Attempt recovery if enabled
            if (this.config.enableAutoRecovery) {
                await this.attemptServiceRecovery(serviceName);
            }
        }
        else {
            check.status = HealthStatus.DEGRADED;
            check.available = true; // Still available but degraded
            this.emit('serviceDegraded', serviceName, check);
        }
    }
    /**
     * Attempt to recover an unhealthy service
     */
    async attemptServiceRecovery(serviceName) {
        const checker = this.services.get(serviceName);
        if (!checker || !checker.recover) {
            return;
        }
        const attempts = this.recoveryAttempts.get(serviceName) || 0;
        if (attempts >= this.config.maxRecoveryAttempts) {
            console.warn(`[HealthMonitor] Max recovery attempts reached for service: ${serviceName}`);
            return;
        }
        // Schedule recovery attempt
        setTimeout(async () => {
            try {
                console.log(`[HealthMonitor] Attempting recovery for service: ${serviceName} (attempt ${attempts + 1}/${this.config.maxRecoveryAttempts})`);
                const recovered = await checker.recover();
                if (recovered) {
                    // Reset recovery attempts
                    this.recoveryAttempts.delete(serviceName);
                    // Perform health check to update status
                    await this.performServiceHealthCheck(serviceName, checker);
                    this.emit('serviceRecovered', serviceName);
                    console.log(`[HealthMonitor] Service recovered: ${serviceName}`);
                }
                else {
                    // Increment recovery attempts
                    this.recoveryAttempts.set(serviceName, attempts + 1);
                }
            }
            catch (error) {
                console.error(`[HealthMonitor] Recovery attempt failed for service ${serviceName}:`, error);
                this.recoveryAttempts.set(serviceName, attempts + 1);
            }
        }, this.config.recoveryInterval);
    }
    /**
     * Execute promise with timeout
     */
    async withTimeout(promise, timeoutMs, timeoutMessage) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(timeoutMessage));
            }, timeoutMs);
            promise
                .then(result => {
                clearTimeout(timeout);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
}
exports.HealthMonitor = HealthMonitor;
/**
 * Default health check configuration
 */
exports.defaultHealthCheckConfig = {
    checkInterval: 30000, // 30 seconds
    checkTimeout: 5000, // 5 seconds
    failureThreshold: 3,
    successThreshold: 2,
    enableAutoRecovery: true,
    recoveryInterval: 60000, // 1 minute
    maxRecoveryAttempts: 5
};
/**
 * Global health monitor instance
 */
let globalHealthMonitor = null;
/**
 * Get or create global health monitor
 */
function getHealthMonitor(config) {
    if (!globalHealthMonitor) {
        globalHealthMonitor = new HealthMonitor(config);
    }
    return globalHealthMonitor;
}
/**
 * Create a health monitor instance
 */
function createHealthMonitor(config) {
    return new HealthMonitor(config);
}
