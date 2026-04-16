"use strict";
/**
 * User Permission Management System
 *
 * This module provides advanced permission management including allowlists,
 * blocklists, rate limiting, and security event logging.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissionManager = void 0;
exports.createUserPermissionManager = createUserPermissionManager;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const events_1 = require("events");
/**
 * Main permission manager class
 */
class UserPermissionManager extends events_1.EventEmitter {
    config;
    authService;
    aclEntries = new Map();
    rateLimits = new Map(); // userId:platform -> RateLimitEntry
    globalRateLimits = new Map(); // ip -> RateLimitEntry
    aclCache = new Map();
    isInitialized = false;
    constructor(authService, config = {}) {
        super();
        this.authService = authService;
        this.config = {
            baseDir: path_1.default.join(os_1.default.homedir(), '.everfern', 'permissions'),
            defaultRateLimits: new Map([
                ['telegram', { windowMs: 60000, maxRequests: 30, burstAllowance: 5, penaltyDuration: 300000 }],
                ['discord', { windowMs: 60000, maxRequests: 30, burstAllowance: 5, penaltyDuration: 300000 }]
            ]),
            globalRateLimit: { windowMs: 60000, maxRequests: 100, burstAllowance: 10, penaltyDuration: 600000 },
            enableIpRestrictions: true,
            maxAclEntries: 10000,
            aclCacheTtl: 300000, // 5 minutes
            securityEventRetentionDays: 90,
            ...config
        };
    }
    /**
     * Initialize the permission manager
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Create base directory
            await fs_1.promises.mkdir(this.config.baseDir, { recursive: true });
            // Load ACL entries
            await this.loadAclEntries();
            // Start cleanup timers
            this.startCleanupTimers();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('UserPermissionManager initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize UserPermissionManager:', error);
            throw error;
        }
    }
    /**
     * Shutdown the permission manager
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        try {
            // Save ACL entries
            await this.saveAclEntries();
            // Clear memory
            this.aclEntries.clear();
            this.rateLimits.clear();
            this.globalRateLimits.clear();
            this.aclCache.clear();
            this.isInitialized = false;
            this.emit('shutdown');
            console.log('UserPermissionManager shutdown successfully');
        }
        catch (error) {
            console.error('Error during UserPermissionManager shutdown:', error);
            throw error;
        }
    }
    /**
     * Check permissions with comprehensive access control
     */
    async checkPermission(context) {
        try {
            // Check basic user authentication and permissions
            const basicPermission = this.authService.checkPermission(context.userId, context.capability);
            if (!basicPermission.granted) {
                await this.logSecurityEvent({
                    type: 'permission_denied',
                    userId: context.userId,
                    platform: context.platform,
                    details: {
                        reason: basicPermission.reason,
                        ip: context.metadata.ip,
                        metadata: {
                            capability: context.capability
                        }
                    },
                    severity: 'low'
                });
                return {
                    granted: false,
                    reason: basicPermission.reason || 'Permission denied',
                    rateLimit: await this.getRateLimitStatus(context.userId, context.platform),
                    context: { basicPermissionCheck: false }
                };
            }
            // Check ACL rules
            const aclDecision = await this.checkAclRules(context);
            if (!aclDecision.granted) {
                await this.logSecurityEvent({
                    type: 'permission_denied',
                    userId: context.userId,
                    platform: context.platform,
                    details: {
                        reason: 'ACL rule violation',
                        ip: context.metadata.ip,
                        metadata: {
                            capability: context.capability,
                            rule: aclDecision.appliedRule?.id
                        }
                    },
                    severity: 'medium'
                });
                return aclDecision;
            }
            // Check rate limits
            const rateLimitCheck = await this.checkRateLimit(context);
            if (!rateLimitCheck.granted) {
                await this.logSecurityEvent({
                    type: 'permission_denied',
                    userId: context.userId,
                    platform: context.platform,
                    details: {
                        reason: 'Rate limit exceeded',
                        ip: context.metadata.ip,
                        metadata: {
                            capability: context.capability
                        }
                    },
                    severity: 'medium'
                });
                return rateLimitCheck;
            }
            // All checks passed
            return {
                granted: true,
                reason: 'Permission granted',
                rateLimit: await this.getRateLimitStatus(context.userId, context.platform),
                context: {
                    basicPermissionCheck: true,
                    aclCheck: true,
                    rateLimitCheck: true
                }
            };
        }
        catch (error) {
            await this.logSecurityEvent({
                type: 'permission_denied',
                userId: context.userId,
                platform: context.platform,
                details: {
                    reason: 'Permission check error',
                    ip: context.metadata.ip,
                    metadata: {
                        capability: context.capability,
                        error: String(error)
                    }
                },
                severity: 'high'
            });
            return {
                granted: false,
                reason: 'Permission check failed',
                rateLimit: await this.getRateLimitStatus(context.userId, context.platform),
                context: { error: String(error) }
            };
        }
    }
    /**
     * Add an ACL entry
     */
    async addAclEntry(entry) {
        if (this.aclEntries.size >= this.config.maxAclEntries) {
            throw new Error('Maximum ACL entries limit reached');
        }
        const id = `acl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const aclEntry = {
            id,
            createdAt: new Date(),
            ...entry
        };
        this.aclEntries.set(id, aclEntry);
        await this.saveAclEntries();
        // Clear ACL cache
        this.aclCache.clear();
        this.emit('aclEntryAdded', aclEntry);
        return id;
    }
    /**
     * Remove an ACL entry
     */
    async removeAclEntry(id) {
        const removed = this.aclEntries.delete(id);
        if (removed) {
            await this.saveAclEntries();
            this.aclCache.clear();
            this.emit('aclEntryRemoved', id);
        }
        return removed;
    }
    /**
     * Get all ACL entries
     */
    getAclEntries() {
        return Array.from(this.aclEntries.values());
    }
    /**
     * Update rate limit configuration for a platform
     */
    updateRateLimitConfig(platform, config) {
        this.config.defaultRateLimits.set(platform, config);
        this.emit('rateLimitConfigUpdated', platform, config);
    }
    /**
     * Get rate limit status for a user
     */
    async getRateLimitStatus(userId, platform) {
        const key = `${userId}:${platform}`;
        const entry = this.rateLimits.get(key);
        const config = this.config.defaultRateLimits.get(platform) || this.config.globalRateLimit;
        if (!entry) {
            return {
                remaining: config.maxRequests,
                resetTime: new Date(Date.now() + config.windowMs),
                penalized: false
            };
        }
        // Clean old requests
        const now = new Date();
        const windowStart = new Date(now.getTime() - config.windowMs);
        entry.requests = entry.requests.filter(req => req > windowStart);
        // Check penalty status
        const penalized = entry.penalized && entry.penaltyExpires && entry.penaltyExpires > now;
        return {
            remaining: Math.max(0, config.maxRequests - entry.requests.length),
            resetTime: new Date(Math.min(...entry.requests.map(r => r.getTime())) + config.windowMs),
            penalized: penalized || false
        };
    }
    /**
     * Get security statistics
     */
    getSecurityStats() {
        const now = new Date();
        const penalizedUsers = Array.from(this.rateLimits.values()).filter(entry => entry.penalized && entry.penaltyExpires && entry.penaltyExpires > now).length;
        const recentEvents = this.authService.getSecurityEvents(100).filter(event => event.timestamp > new Date(now.getTime() - 24 * 60 * 60 * 1000)).length;
        return {
            totalAclEntries: this.aclEntries.size,
            activeRateLimits: this.rateLimits.size,
            penalizedUsers,
            recentSecurityEvents: recentEvents
        };
    }
    /**
     * Check ACL rules against context
     */
    async checkAclRules(context) {
        const cacheKey = `${context.userId}:${context.platform}:${context.capability}`;
        const cached = this.aclCache.get(cacheKey);
        if (cached && cached.expires > new Date()) {
            return {
                granted: cached.result,
                reason: cached.result ? 'ACL allow (cached)' : 'ACL deny (cached)',
                rateLimit: await this.getRateLimitStatus(context.userId, context.platform),
                context: { cached: true }
            };
        }
        // Get applicable rules
        const applicableRules = Array.from(this.aclEntries.values())
            .filter(rule => this.isRuleApplicable(rule, context))
            .sort((a, b) => b.priority - a.priority); // Higher priority first
        // Check for expired rules
        const now = new Date();
        const activeRules = applicableRules.filter(rule => !rule.expiresAt || rule.expiresAt > now);
        // Apply rules in priority order
        for (const rule of activeRules) {
            if (rule.action === 'deny') {
                // Cache deny result
                this.aclCache.set(cacheKey, {
                    result: false,
                    expires: new Date(Date.now() + this.config.aclCacheTtl)
                });
                return {
                    granted: false,
                    reason: `Access denied by ACL rule: ${rule.description}`,
                    appliedRule: rule,
                    rateLimit: await this.getRateLimitStatus(context.userId, context.platform),
                    context: { aclRuleId: rule.id }
                };
            }
        }
        // Check for explicit allow rules
        const allowRule = activeRules.find(rule => rule.action === 'allow');
        const granted = allowRule !== undefined;
        // Cache result
        this.aclCache.set(cacheKey, {
            result: granted,
            expires: new Date(Date.now() + this.config.aclCacheTtl)
        });
        return {
            granted,
            reason: granted ? `Access allowed by ACL rule: ${allowRule.description}` : 'No explicit allow rule found',
            appliedRule: allowRule,
            rateLimit: await this.getRateLimitStatus(context.userId, context.platform),
            context: { aclRuleId: allowRule?.id }
        };
    }
    /**
     * Check if ACL rule applies to context
     */
    isRuleApplicable(rule, context) {
        // Check platform
        if (rule.platforms.length > 0 && !rule.platforms.includes(context.platform)) {
            return false;
        }
        // Check capability
        if (rule.capabilities.length > 0 && !rule.capabilities.includes(context.capability)) {
            return false;
        }
        // Check rule type and value
        switch (rule.type) {
            case 'user':
                return rule.value === context.userId;
            case 'platform':
                return rule.value === context.platformUserId;
            case 'ip':
                return rule.value === context.metadata.ip;
            case 'domain':
                // Extract domain from user agent or other metadata
                const userAgent = context.metadata.userAgent || '';
                return userAgent.toLowerCase().includes(rule.value.toLowerCase());
            case 'pattern':
                // Use regex pattern matching
                try {
                    const regex = new RegExp(rule.value);
                    return regex.test(context.platformUserId) ||
                        regex.test(context.userId) ||
                        regex.test(context.metadata.userAgent || '');
                }
                catch {
                    return false;
                }
            default:
                return false;
        }
    }
    /**
     * Check rate limits
     */
    async checkRateLimit(context) {
        const key = `${context.userId}:${context.platform}`;
        const config = this.config.defaultRateLimits.get(context.platform) || this.config.globalRateLimit;
        let entry = this.rateLimits.get(key);
        if (!entry) {
            entry = {
                requests: [],
                penalized: false,
                violationCount: 0
            };
            this.rateLimits.set(key, entry);
        }
        const now = new Date();
        // Check if user is currently penalized
        if (entry.penalized && entry.penaltyExpires && entry.penaltyExpires > now) {
            return {
                granted: false,
                reason: 'User is temporarily penalized for rate limit violations',
                rateLimit: {
                    remaining: 0,
                    resetTime: entry.penaltyExpires,
                    penalized: true
                },
                context: { penaltyExpires: entry.penaltyExpires }
            };
        }
        // Clean old requests
        const windowStart = new Date(now.getTime() - config.windowMs);
        entry.requests = entry.requests.filter(req => req > windowStart);
        // Check if within limits
        const currentRequests = entry.requests.length;
        const allowedRequests = config.maxRequests + config.burstAllowance;
        if (currentRequests >= allowedRequests) {
            // Rate limit exceeded
            entry.violationCount++;
            entry.penalized = true;
            entry.penaltyExpires = new Date(now.getTime() + config.penaltyDuration);
            return {
                granted: false,
                reason: 'Rate limit exceeded',
                rateLimit: {
                    remaining: 0,
                    resetTime: entry.penaltyExpires,
                    penalized: true
                },
                context: {
                    currentRequests,
                    allowedRequests,
                    violationCount: entry.violationCount
                }
            };
        }
        // Add current request
        entry.requests.push(now);
        // Clear penalty if it was set
        if (entry.penalized && (!entry.penaltyExpires || entry.penaltyExpires <= now)) {
            entry.penalized = false;
            entry.penaltyExpires = undefined;
        }
        return {
            granted: true,
            reason: 'Within rate limits',
            rateLimit: {
                remaining: Math.max(0, config.maxRequests - entry.requests.length),
                resetTime: new Date(Math.min(...entry.requests.map(r => r.getTime())) + config.windowMs),
                penalized: false
            },
            context: {
                currentRequests: entry.requests.length,
                allowedRequests: config.maxRequests
            }
        };
    }
    /**
     * Log security event
     */
    async logSecurityEvent(event) {
        // Delegate to auth service for consistent logging
        this.emit('securityEvent', event);
    }
    /**
     * Start cleanup timers
     */
    startCleanupTimers() {
        // Clean up rate limit entries every 10 minutes
        setInterval(() => {
            this.cleanupRateLimits();
        }, 10 * 60 * 1000);
        // Clean up ACL cache every 5 minutes
        setInterval(() => {
            this.cleanupAclCache();
        }, 5 * 60 * 1000);
    }
    /**
     * Clean up old rate limit entries
     */
    cleanupRateLimits() {
        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        for (const [key, entry] of this.rateLimits) {
            // Remove entries with no recent requests and no active penalties
            const hasRecentRequests = entry.requests.some(req => req > cutoff);
            const hasPenalty = entry.penalized && entry.penaltyExpires && entry.penaltyExpires > now;
            if (!hasRecentRequests && !hasPenalty) {
                this.rateLimits.delete(key);
            }
        }
    }
    /**
     * Clean up expired ACL cache entries
     */
    cleanupAclCache() {
        const now = new Date();
        for (const [key, cached] of this.aclCache) {
            if (cached.expires <= now) {
                this.aclCache.delete(key);
            }
        }
    }
    /**
     * Save ACL entries to disk
     */
    async saveAclEntries() {
        const filePath = path_1.default.join(this.config.baseDir, 'acl-entries.json');
        const entries = Array.from(this.aclEntries.values());
        await fs_1.promises.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    }
    /**
     * Load ACL entries from disk
     */
    async loadAclEntries() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'acl-entries.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const entries = JSON.parse(data);
            this.aclEntries.clear();
            for (const entry of entries) {
                this.aclEntries.set(entry.id, entry);
            }
        }
        catch (error) {
            // File might not exist yet, which is fine
        }
    }
}
exports.UserPermissionManager = UserPermissionManager;
/**
 * Create a user permission manager with default configuration
 */
function createUserPermissionManager(authService, config = {}) {
    return new UserPermissionManager(authService, config);
}
