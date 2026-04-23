"use strict";
/**
 * EverFern Desktop — Learning System Configuration
 *
 * Configuration management for the continuous learning system.
 * Provides default settings, validation, and runtime configuration updates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_PRESETS = exports.LearningConfigManager = void 0;
exports.getLearningConfig = getLearningConfig;
exports.initializeLearningConfig = initializeLearningConfig;
const logger_1 = require("./logger");
class LearningConfigManager {
    config;
    logger = (0, logger_1.getLearningLogger)();
    constructor(initialConfig) {
        this.config = this.mergeWithDefaults(initialConfig || {});
        this.validateConfig(this.config);
    }
    /**
     * Get current configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration with new values.
     */
    updateConfig(updates) {
        const newConfig = { ...this.config, ...updates };
        this.validateConfig(newConfig);
        const oldConfig = this.config;
        this.config = newConfig;
        this.logger.logPerformance('config-update', 0, {
            changes: this.getConfigChanges(oldConfig, newConfig)
        });
    }
    /**
     * Reset configuration to defaults.
     */
    resetToDefaults() {
        this.config = this.getDefaultConfig();
        this.logger.logPerformance('config-reset', 0);
    }
    /**
     * Check if learning is enabled for a specific domain.
     */
    isDomainEnabled(domain) {
        return this.config.enabled &&
            (this.config.domains[domain]?.enabled ?? true);
    }
    /**
     * Get priority for a specific domain.
     */
    getDomainPriority(domain) {
        return this.config.domains[domain]?.priority ?? 5;
    }
    /**
     * Validate configuration values.
     */
    validateConfig(config) {
        const errors = [];
        if (config.analysisTimeoutMs <= 0) {
            errors.push('analysisTimeoutMs must be positive');
        }
        if (config.maxCpuPercent <= 0 || config.maxCpuPercent > 100) {
            errors.push('maxCpuPercent must be between 0 and 100');
        }
        if (config.maxMemoryMB <= 0) {
            errors.push('maxMemoryMB must be positive');
        }
        if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
            errors.push('confidenceThreshold must be between 0 and 1');
        }
        if (config.pruningInterval <= 0) {
            errors.push('pruningInterval must be positive');
        }
        if (errors.length > 0) {
            throw new Error(`Invalid learning configuration: ${errors.join(', ')}`);
        }
    }
    /**
     * Merge user config with defaults.
     */
    mergeWithDefaults(userConfig) {
        const defaults = this.getDefaultConfig();
        return {
            ...defaults,
            ...userConfig,
            domains: {
                ...defaults.domains,
                ...userConfig.domains
            }
        };
    }
    /**
     * Get default configuration.
     */
    getDefaultConfig() {
        return {
            enabled: true,
            analysisTimeoutMs: 10000, // 10 seconds
            maxCpuPercent: 5,
            maxMemoryMB: 100,
            confidenceThreshold: 0.7,
            pruningInterval: 86400000, // 24 hours in ms
            encryptSensitivePatterns: true,
            logLearningActivities: true,
            domains: {
                'coding': { enabled: true, priority: 1 },
                'data-analysis': { enabled: true, priority: 2 },
                'file-management': { enabled: true, priority: 3 },
                'web-browsing': { enabled: true, priority: 4 },
                'system-administration': { enabled: false, priority: 5 },
                'terminal': { enabled: true, priority: 3 },
                'memory-operations': { enabled: true, priority: 2 },
                'planning': { enabled: true, priority: 1 }
            },
            backgroundProcessing: {
                enabled: true,
                maxCpuPercent: 5,
                maxMemoryMB: 100,
                idleThresholdMs: 5000
            },
            privacy: {
                enablePIIDetection: true,
                enableEncryption: true,
                dataRetentionDays: 30
            },
            quality: {
                minConfidenceThreshold: 0.7,
                pruningInterval: 86400000,
                maxKnowledgeEntries: 10000
            },
            transparency: {
                enableLogging: true,
                enableUserQueries: true,
                enableExplanations: true
            }
        };
    }
    /**
     * Get differences between two configurations.
     */
    getConfigChanges(oldConfig, newConfig) {
        const changes = {};
        for (const [key, value] of Object.entries(newConfig)) {
            if (key === 'domains') {
                // Handle domains separately
                const domainChanges = this.getDomainChanges(oldConfig.domains, newConfig.domains);
                if (Object.keys(domainChanges).length > 0) {
                    changes.domains = domainChanges;
                }
            }
            else if (oldConfig[key] !== value) {
                changes[key] = {
                    old: oldConfig[key],
                    new: value
                };
            }
        }
        return changes;
    }
    /**
     * Get differences between domain configurations.
     */
    getDomainChanges(oldDomains, newDomains) {
        const changes = {};
        for (const [domain, config] of Object.entries(newDomains)) {
            const oldConfig = oldDomains[domain];
            if (!oldConfig ||
                oldConfig.enabled !== config.enabled ||
                oldConfig.priority !== config.priority) {
                changes[domain] = {
                    old: oldConfig,
                    new: config
                };
            }
        }
        return changes;
    }
}
exports.LearningConfigManager = LearningConfigManager;
/**
 * Global configuration instance.
 */
let globalConfig = null;
/**
 * Get the global learning configuration manager.
 */
function getLearningConfig() {
    if (!globalConfig) {
        globalConfig = new LearningConfigManager();
    }
    return globalConfig;
}
/**
 * Initialize learning configuration with custom settings.
 */
function initializeLearningConfig(config) {
    globalConfig = new LearningConfigManager(config);
}
/**
 * Configuration presets for different use cases.
 */
exports.CONFIG_PRESETS = {
    /**
     * High-performance preset with aggressive learning.
     */
    AGGRESSIVE: {
        enabled: true,
        analysisTimeoutMs: 15000,
        maxCpuPercent: 10,
        maxMemoryMB: 200,
        confidenceThreshold: 0.6,
        pruningInterval: 43200000, // 12 hours
        encryptSensitivePatterns: true,
        logLearningActivities: true,
        domains: {
            'coding': { enabled: true, priority: 1 },
            'data-analysis': { enabled: true, priority: 1 },
            'file-management': { enabled: true, priority: 2 },
            'web-browsing': { enabled: true, priority: 2 },
            'system-administration': { enabled: true, priority: 3 },
            'terminal': { enabled: true, priority: 2 },
            'memory-operations': { enabled: true, priority: 1 },
            'planning': { enabled: true, priority: 1 }
        },
        backgroundProcessing: {
            enabled: true,
            maxCpuPercent: 10,
            maxMemoryMB: 200,
            idleThresholdMs: 3000
        },
        privacy: {
            enablePIIDetection: true,
            enableEncryption: true,
            dataRetentionDays: 60
        },
        quality: {
            minConfidenceThreshold: 0.6,
            pruningInterval: 43200000,
            maxKnowledgeEntries: 20000
        },
        transparency: {
            enableLogging: true,
            enableUserQueries: true,
            enableExplanations: true
        }
    },
    /**
     * Conservative preset with minimal resource usage.
     */
    CONSERVATIVE: {
        enabled: true,
        analysisTimeoutMs: 5000,
        maxCpuPercent: 2,
        maxMemoryMB: 50,
        confidenceThreshold: 0.8,
        pruningInterval: 172800000, // 48 hours
        encryptSensitivePatterns: true,
        logLearningActivities: false,
        domains: {
            'coding': { enabled: true, priority: 1 },
            'data-analysis': { enabled: false, priority: 5 },
            'file-management': { enabled: true, priority: 3 },
            'web-browsing': { enabled: false, priority: 5 },
            'system-administration': { enabled: false, priority: 5 },
            'terminal': { enabled: false, priority: 5 },
            'memory-operations': { enabled: true, priority: 2 },
            'planning': { enabled: true, priority: 1 }
        },
        backgroundProcessing: {
            enabled: true,
            maxCpuPercent: 2,
            maxMemoryMB: 50,
            idleThresholdMs: 10000
        },
        privacy: {
            enablePIIDetection: true,
            enableEncryption: true,
            dataRetentionDays: 14
        },
        quality: {
            minConfidenceThreshold: 0.8,
            pruningInterval: 172800000,
            maxKnowledgeEntries: 5000
        },
        transparency: {
            enableLogging: false,
            enableUserQueries: false,
            enableExplanations: false
        }
    },
    /**
     * Privacy-focused preset with enhanced security.
     */
    PRIVACY_FOCUSED: {
        enabled: true,
        analysisTimeoutMs: 8000,
        maxCpuPercent: 3,
        maxMemoryMB: 75,
        confidenceThreshold: 0.75,
        pruningInterval: 86400000, // 24 hours
        encryptSensitivePatterns: true,
        logLearningActivities: false,
        domains: {
            'coding': { enabled: true, priority: 1 },
            'data-analysis': { enabled: false, priority: 5 },
            'file-management': { enabled: true, priority: 4 },
            'web-browsing': { enabled: false, priority: 5 },
            'system-administration': { enabled: false, priority: 5 },
            'terminal': { enabled: false, priority: 5 },
            'memory-operations': { enabled: true, priority: 3 },
            'planning': { enabled: true, priority: 2 }
        },
        backgroundProcessing: {
            enabled: true,
            maxCpuPercent: 3,
            maxMemoryMB: 75,
            idleThresholdMs: 8000
        },
        privacy: {
            enablePIIDetection: true,
            enableEncryption: true,
            dataRetentionDays: 7
        },
        quality: {
            minConfidenceThreshold: 0.75,
            pruningInterval: 86400000,
            maxKnowledgeEntries: 3000
        },
        transparency: {
            enableLogging: false,
            enableUserQueries: false,
            enableExplanations: false
        }
    },
    /**
     * Development preset optimized for coding tasks.
     */
    DEVELOPMENT: {
        enabled: true,
        analysisTimeoutMs: 12000,
        maxCpuPercent: 7,
        maxMemoryMB: 150,
        confidenceThreshold: 0.65,
        pruningInterval: 86400000, // 24 hours
        encryptSensitivePatterns: true,
        logLearningActivities: true,
        domains: {
            'coding': { enabled: true, priority: 1 },
            'data-analysis': { enabled: true, priority: 3 },
            'file-management': { enabled: true, priority: 2 },
            'web-browsing': { enabled: true, priority: 4 },
            'system-administration': { enabled: true, priority: 4 },
            'terminal': { enabled: true, priority: 2 },
            'memory-operations': { enabled: true, priority: 2 },
            'planning': { enabled: true, priority: 1 }
        },
        backgroundProcessing: {
            enabled: true,
            maxCpuPercent: 7,
            maxMemoryMB: 150,
            idleThresholdMs: 5000
        },
        privacy: {
            enablePIIDetection: true,
            enableEncryption: true,
            dataRetentionDays: 30
        },
        quality: {
            minConfidenceThreshold: 0.65,
            pruningInterval: 86400000,
            maxKnowledgeEntries: 15000
        },
        transparency: {
            enableLogging: true,
            enableUserQueries: true,
            enableExplanations: true
        }
    }
};
