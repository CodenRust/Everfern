"use strict";
/**
 * Health Checker Implementations
 *
 * Provides health checker implementations for all integration services.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryHealthChecker = exports.FileSystemHealthChecker = exports.DatabaseHealthChecker = exports.GenericServiceHealthChecker = exports.BotManagerHealthChecker = exports.PlatformHealthChecker = void 0;
exports.createHealthCheckers = createHealthCheckers;
/**
 * Platform health checker
 */
class PlatformHealthChecker {
    name;
    platform;
    constructor(name, platform) {
        this.name = name;
        this.platform = platform;
    }
    async check() {
        const startTime = Date.now();
        try {
            const status = await this.platform.getStatus();
            const responseTime = Date.now() - startTime;
            return {
                healthy: status.connected,
                responseTime,
                error: status.error,
                metadata: {
                    connected: status.connected,
                    lastConnected: status.lastConnected,
                    details: status.details
                }
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async recover() {
        try {
            // Attempt to reconnect the platform
            await this.platform.disconnect();
            await this.platform.initialize();
            return true;
        }
        catch (error) {
            console.error(`Failed to recover platform ${this.name}:`, error);
            return false;
        }
    }
}
exports.PlatformHealthChecker = PlatformHealthChecker;
/**
 * Bot integration manager health checker
 */
class BotManagerHealthChecker {
    name = 'bot-integration-manager';
    botManager;
    constructor(botManager) {
        this.botManager = botManager;
    }
    async check() {
        const startTime = Date.now();
        try {
            // Check platform statuses
            const platformStatuses = await this.botManager.getPlatformStatuses();
            const responseTime = Date.now() - startTime;
            const platforms = Array.from(platformStatuses.entries());
            const connectedPlatforms = platforms.filter(([_, status]) => status.connected).length;
            const totalPlatforms = platforms.length;
            // Consider healthy if at least one platform is connected
            const healthy = connectedPlatforms > 0 || totalPlatforms === 0;
            return {
                healthy,
                responseTime,
                metadata: {
                    totalPlatforms,
                    connectedPlatforms,
                    platforms: Object.fromEntries(platformStatuses)
                }
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.BotManagerHealthChecker = BotManagerHealthChecker;
/**
 * Generic service health checker
 */
class GenericServiceHealthChecker {
    name;
    service;
    healthCheckMethod;
    constructor(name, service, healthCheckMethod = 'healthCheck') {
        this.name = name;
        this.service = service;
        this.healthCheckMethod = healthCheckMethod;
    }
    async check() {
        const startTime = Date.now();
        try {
            // Check if service has health check method
            if (typeof this.service[this.healthCheckMethod] === 'function') {
                const result = await this.service[this.healthCheckMethod]();
                const responseTime = Date.now() - startTime;
                if (typeof result === 'boolean') {
                    return {
                        healthy: result,
                        responseTime
                    };
                }
                else if (typeof result === 'object') {
                    return {
                        healthy: result.healthy ?? true,
                        responseTime,
                        error: result.error,
                        metadata: result.metadata
                    };
                }
            }
            // If no health check method, assume healthy if service exists
            const responseTime = Date.now() - startTime;
            return {
                healthy: true,
                responseTime,
                metadata: {
                    hasHealthCheck: false
                }
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.GenericServiceHealthChecker = GenericServiceHealthChecker;
/**
 * Database health checker
 */
class DatabaseHealthChecker {
    name = 'database';
    db;
    constructor(db) {
        this.db = db;
    }
    async check() {
        const startTime = Date.now();
        try {
            // Perform a simple query to check database connectivity
            await this.db.get('SELECT 1');
            const responseTime = Date.now() - startTime;
            return {
                healthy: true,
                responseTime,
                metadata: {
                    type: 'sqlite'
                }
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.DatabaseHealthChecker = DatabaseHealthChecker;
/**
 * File system health checker
 */
class FileSystemHealthChecker {
    name = 'file-system';
    testPath;
    constructor(testPath) {
        this.testPath = testPath;
    }
    async check() {
        const startTime = Date.now();
        try {
            const fs = require('fs/promises');
            const path = require('path');
            const os = require('os');
            // Check if test path exists and is writable
            const testFile = path.join(this.testPath, '.health-check');
            // Try to write a test file
            await fs.writeFile(testFile, 'health-check', 'utf8');
            // Try to read it back
            await fs.readFile(testFile, 'utf8');
            // Clean up
            await fs.unlink(testFile);
            const responseTime = Date.now() - startTime;
            return {
                healthy: true,
                responseTime,
                metadata: {
                    path: this.testPath
                }
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.FileSystemHealthChecker = FileSystemHealthChecker;
/**
 * Memory health checker
 */
class MemoryHealthChecker {
    name = 'memory';
    maxHeapUsagePercent;
    constructor(maxHeapUsagePercent = 90) {
        this.maxHeapUsagePercent = maxHeapUsagePercent;
    }
    async check() {
        const startTime = Date.now();
        try {
            const memUsage = process.memoryUsage();
            const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            const responseTime = Date.now() - startTime;
            const healthy = heapUsedPercent < this.maxHeapUsagePercent;
            return {
                healthy,
                responseTime,
                error: healthy ? undefined : `Heap usage at ${heapUsedPercent.toFixed(2)}%`,
                metadata: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    heapUsedPercent: heapUsedPercent.toFixed(2),
                    rss: memUsage.rss,
                    external: memUsage.external
                }
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.MemoryHealthChecker = MemoryHealthChecker;
/**
 * Create health checkers for all services
 */
function createHealthCheckers(services) {
    const checkers = [];
    // Bot manager health checker
    if (services.botManager) {
        checkers.push(new BotManagerHealthChecker(services.botManager));
    }
    // Platform health checkers
    if (services.platforms) {
        for (const [name, platform] of services.platforms) {
            checkers.push(new PlatformHealthChecker(name, platform));
        }
    }
    // Database health checker
    if (services.database) {
        checkers.push(new DatabaseHealthChecker(services.database));
    }
    // File system health checker
    if (services.fileSystemPath) {
        checkers.push(new FileSystemHealthChecker(services.fileSystemPath));
    }
    // Memory health checker
    checkers.push(new MemoryHealthChecker());
    return checkers;
}
