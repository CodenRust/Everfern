"use strict";
/**
 * User Authentication Service for Multi-Platform Integration
 *
 * This module manages user authentication, registration, and authorization
 * across multiple messaging platforms with JSON file storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAuthenticationService = void 0;
exports.createUserAuthenticationService = createUserAuthenticationService;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
/**
 * Main user authentication service
 */
class UserAuthenticationService extends events_1.EventEmitter {
    config;
    users = new Map();
    platformUserMap = new Map(); // platform:platformId -> userId
    failedAttempts = new Map();
    securityEvents = [];
    isInitialized = false;
    constructor(config = {}) {
        super();
        this.config = {
            baseDir: path_1.default.join(os_1.default.homedir(), '.everfern', 'users'),
            sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
            maxFailedAttempts: 5,
            lockoutDuration: 30 * 60 * 1000, // 30 minutes
            requireEmailVerification: false,
            defaultRole: 'user',
            availableCapabilities: [
                'send_messages',
                'receive_messages',
                'upload_files',
                'download_files',
                'create_conversations',
                'manage_settings',
                'view_logs',
                'moderate_users',
                'admin_access'
            ],
            autoApproval: {
                enabled: true,
                allowedDomains: [],
                requireInvite: false
            },
            ...config
        };
    }
    /**
     * Initialize the authentication service
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Create base directory
            await fs_1.promises.mkdir(this.config.baseDir, { recursive: true });
            // Load existing users
            await this.loadUsers();
            // Load security events
            await this.loadSecurityEvents();
            // Start cleanup timer for expired sessions
            this.startCleanupTimer();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('UserAuthenticationService initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize UserAuthenticationService:', error);
            throw error;
        }
    }
    /**
     * Shutdown the authentication service
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        try {
            // Save all user data
            await this.saveAllUsers();
            // Save security events
            await this.saveSecurityEvents();
            // Clear memory
            this.users.clear();
            this.platformUserMap.clear();
            this.failedAttempts.clear();
            this.isInitialized = false;
            this.emit('shutdown');
            console.log('UserAuthenticationService shutdown successfully');
        }
        catch (error) {
            console.error('Error during UserAuthenticationService shutdown:', error);
            throw error;
        }
    }
    /**
     * Register a new user
     */
    async registerUser(registrationData) {
        try {
            // Check if user already exists on this platform
            const existingUserId = this.platformUserMap.get(`${registrationData.platform}:${registrationData.platformId}`);
            if (existingUserId) {
                return {
                    success: false,
                    error: 'User already registered on this platform'
                };
            }
            // Check auto-approval settings
            if (!this.config.autoApproval.enabled) {
                return {
                    success: false,
                    error: 'Registration requires manual approval'
                };
            }
            // Generate unique user ID
            const userId = this.generateUserId();
            // Create user account
            const user = {
                id: userId,
                profile: {
                    displayName: registrationData.displayName,
                    email: registrationData.email,
                    avatar: registrationData.avatar
                },
                platformIdentities: new Map([[registrationData.platform, {
                            platformId: registrationData.platformId,
                            username: registrationData.username,
                            displayName: registrationData.displayName,
                            avatar: registrationData.avatar,
                            linkedAt: new Date(),
                            verified: true
                        }]]),
                permissions: {
                    role: this.config.defaultRole,
                    capabilities: new Set(['send_messages', 'receive_messages', 'upload_files', 'download_files']),
                    restrictions: new Set()
                },
                status: {
                    active: true,
                    verified: !this.config.requireEmailVerification,
                    suspended: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                security: {
                    apiKeys: new Map(),
                    sessions: new Map()
                }
            };
            // Store user
            this.users.set(userId, user);
            this.platformUserMap.set(`${registrationData.platform}:${registrationData.platformId}`, userId);
            // Save to disk
            await this.saveUser(user);
            // Log security event
            await this.logSecurityEvent({
                type: 'registration',
                userId,
                platform: registrationData.platform,
                details: {
                    metadata: {
                        username: registrationData.username,
                        ...registrationData.metadata
                    }
                },
                severity: 'low'
            });
            // Create session
            const sessionToken = await this.createSession(userId, registrationData.platform);
            this.emit('userRegistered', user);
            return {
                success: true,
                user,
                sessionToken
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Registration failed: ${error}`
            };
        }
    }
    /**
     * Authenticate a user by platform identity
     */
    async authenticateUser(platform, platformId, metadata) {
        try {
            // Check for account lockout
            const lockoutKey = `${platform}:${platformId}`;
            if (this.isAccountLocked(lockoutKey)) {
                await this.logSecurityEvent({
                    type: 'failed_login',
                    platform,
                    details: {
                        reason: 'Account locked',
                        metadata: {
                            platformId,
                            ...metadata
                        }
                    },
                    severity: 'medium'
                });
                return {
                    success: false,
                    error: 'Account is temporarily locked due to too many failed attempts'
                };
            }
            // Find user by platform identity
            const userId = this.platformUserMap.get(`${platform}:${platformId}`);
            if (!userId) {
                await this.recordFailedAttempt(lockoutKey);
                await this.logSecurityEvent({
                    type: 'failed_login',
                    platform,
                    details: {
                        reason: 'User not found',
                        metadata: {
                            platformId,
                            ...metadata
                        }
                    },
                    severity: 'low'
                });
                return {
                    success: false,
                    error: 'User not found'
                };
            }
            const user = this.users.get(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'User account not found'
                };
            }
            // Check account status
            if (!user.status.active) {
                await this.logSecurityEvent({
                    type: 'failed_login',
                    userId,
                    platform,
                    details: {
                        reason: 'Account inactive',
                        metadata
                    },
                    severity: 'medium'
                });
                return {
                    success: false,
                    error: 'Account is inactive'
                };
            }
            if (user.status.suspended) {
                await this.logSecurityEvent({
                    type: 'failed_login',
                    userId,
                    platform,
                    details: {
                        reason: 'Account suspended',
                        metadata: {
                            suspensionReason: user.status.suspensionReason,
                            ...metadata
                        }
                    },
                    severity: 'medium'
                });
                return {
                    success: false,
                    error: `Account is suspended: ${user.status.suspensionReason || 'No reason provided'}`
                };
            }
            // Clear failed attempts on successful authentication
            this.failedAttempts.delete(lockoutKey);
            // Update last login
            user.status.lastLogin = new Date();
            user.status.updatedAt = new Date();
            // Create session
            const sessionToken = await this.createSession(userId, platform, metadata);
            // Log successful login
            await this.logSecurityEvent({
                type: 'login',
                userId,
                platform,
                details: { metadata },
                severity: 'low'
            });
            this.emit('userAuthenticated', user, platform);
            return {
                success: true,
                user,
                sessionToken
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Authentication failed: ${error}`
            };
        }
    }
    /**
     * Link a platform identity to an existing user
     */
    async linkPlatformIdentity(userId, platform, platformId, username, displayName, avatar) {
        try {
            const user = this.users.get(userId);
            if (!user) {
                return false;
            }
            // Check if platform identity is already linked to another user
            const existingUserId = this.platformUserMap.get(`${platform}:${platformId}`);
            if (existingUserId && existingUserId !== userId) {
                return false;
            }
            // Add platform identity
            user.platformIdentities.set(platform, {
                platformId,
                username,
                displayName,
                avatar,
                linkedAt: new Date(),
                verified: true
            });
            // Update platform user map
            this.platformUserMap.set(`${platform}:${platformId}`, userId);
            // Update user
            user.status.updatedAt = new Date();
            await this.saveUser(user);
            this.emit('platformIdentityLinked', userId, platform, platformId);
            return true;
        }
        catch (error) {
            console.error('Error linking platform identity:', error);
            return false;
        }
    }
    /**
     * Check user permissions
     */
    checkPermission(userId, capability) {
        const user = this.users.get(userId);
        if (!user) {
            return {
                granted: false,
                reason: 'User not found'
            };
        }
        if (!user.status.active || user.status.suspended) {
            return {
                granted: false,
                reason: 'Account is inactive or suspended',
                userRole: user.permissions.role
            };
        }
        // Check if user has the specific capability
        if (user.permissions.capabilities.has(capability)) {
            return { granted: true };
        }
        // Check if user has restrictions
        if (user.permissions.restrictions.has(capability)) {
            return {
                granted: false,
                reason: 'Capability is explicitly restricted',
                userRole: user.permissions.role
            };
        }
        // Check role-based permissions
        const roleCapabilities = this.getRoleCapabilities(user.permissions.role);
        if (roleCapabilities.has(capability)) {
            return { granted: true };
        }
        return {
            granted: false,
            reason: 'Insufficient permissions',
            requiredRole: this.getRequiredRoleForCapability(capability),
            userRole: user.permissions.role
        };
    }
    /**
     * Update user permissions
     */
    async updateUserPermissions(userId, updates) {
        try {
            const user = this.users.get(userId);
            if (!user) {
                return false;
            }
            // Update role
            if (updates.role) {
                user.permissions.role = updates.role;
            }
            // Update capabilities
            if (updates.addCapabilities) {
                updates.addCapabilities.forEach(cap => user.permissions.capabilities.add(cap));
            }
            if (updates.removeCapabilities) {
                updates.removeCapabilities.forEach(cap => user.permissions.capabilities.delete(cap));
            }
            // Update restrictions
            if (updates.addRestrictions) {
                updates.addRestrictions.forEach(res => user.permissions.restrictions.add(res));
            }
            if (updates.removeRestrictions) {
                updates.removeRestrictions.forEach(res => user.permissions.restrictions.delete(res));
            }
            // Update timestamp
            user.status.updatedAt = new Date();
            await this.saveUser(user);
            this.emit('userPermissionsUpdated', userId, updates);
            return true;
        }
        catch (error) {
            console.error('Error updating user permissions:', error);
            return false;
        }
    }
    /**
     * Suspend or unsuspend a user account
     */
    async suspendUser(userId, suspended, reason) {
        try {
            const user = this.users.get(userId);
            if (!user) {
                return false;
            }
            user.status.suspended = suspended;
            user.status.suspensionReason = suspended ? reason : undefined;
            user.status.updatedAt = new Date();
            // Invalidate all sessions if suspending
            if (suspended) {
                user.security.sessions.clear();
            }
            await this.saveUser(user);
            // Log security event
            await this.logSecurityEvent({
                type: suspended ? 'account_locked' : 'login',
                userId,
                platform: 'system',
                details: {
                    metadata: {
                        action: suspended ? 'suspended' : 'unsuspended',
                        reason
                    }
                },
                severity: suspended ? 'high' : 'medium'
            });
            this.emit('userSuspensionChanged', userId, suspended, reason);
            return true;
        }
        catch (error) {
            console.error('Error updating user suspension status:', error);
            return false;
        }
    }
    /**
     * Get user by ID
     */
    getUser(userId) {
        return this.users.get(userId);
    }
    /**
     * Get user by platform identity
     */
    getUserByPlatformId(platform, platformId) {
        const userId = this.platformUserMap.get(`${platform}:${platformId}`);
        return userId ? this.users.get(userId) : undefined;
    }
    /**
     * Get all users (admin function)
     */
    getAllUsers() {
        return Array.from(this.users.values());
    }
    /**
     * Get security events
     */
    getSecurityEvents(limit = 100) {
        return this.securityEvents.slice(-limit);
    }
    /**
     * Generate unique user ID
     */
    generateUserId() {
        return `user_${Date.now()}_${crypto_1.default.randomBytes(8).toString('hex')}`;
    }
    /**
     * Create a session for a user
     */
    async createSession(userId, platform, metadata) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const sessionToken = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + this.config.sessionTimeout);
        user.security.sessions.set(sessionToken, {
            platform,
            deviceInfo: metadata?.userAgent,
            createdAt: new Date(),
            lastActivity: new Date(),
            expiresAt
        });
        await this.saveUser(user);
        return sessionToken;
    }
    /**
     * Check if account is locked due to failed attempts
     */
    isAccountLocked(lockoutKey) {
        const attempts = this.failedAttempts.get(lockoutKey);
        if (!attempts) {
            return false;
        }
        if (attempts.count >= this.config.maxFailedAttempts) {
            const lockoutExpiry = new Date(attempts.lastAttempt.getTime() + this.config.lockoutDuration);
            return new Date() < lockoutExpiry;
        }
        return false;
    }
    /**
     * Record a failed authentication attempt
     */
    async recordFailedAttempt(lockoutKey) {
        const existing = this.failedAttempts.get(lockoutKey);
        if (existing) {
            existing.count++;
            existing.lastAttempt = new Date();
        }
        else {
            this.failedAttempts.set(lockoutKey, {
                count: 1,
                lastAttempt: new Date()
            });
        }
    }
    /**
     * Get capabilities for a role
     */
    getRoleCapabilities(role) {
        const capabilities = new Set();
        switch (role) {
            case 'owner':
                capabilities.add('admin_access');
            // Fall through
            case 'admin':
                capabilities.add('moderate_users');
                capabilities.add('view_logs');
            // Fall through
            case 'moderator':
                capabilities.add('manage_settings');
            // Fall through
            case 'user':
                capabilities.add('send_messages');
                capabilities.add('receive_messages');
                capabilities.add('upload_files');
                capabilities.add('download_files');
                capabilities.add('create_conversations');
                break;
        }
        return capabilities;
    }
    /**
     * Get required role for a capability
     */
    getRequiredRoleForCapability(capability) {
        const roleMap = {
            'admin_access': 'admin',
            'moderate_users': 'admin',
            'view_logs': 'admin',
            'manage_settings': 'moderator',
            'send_messages': 'user',
            'receive_messages': 'user',
            'upload_files': 'user',
            'download_files': 'user',
            'create_conversations': 'user'
        };
        return roleMap[capability] || 'admin';
    }
    /**
     * Log a security event
     */
    async logSecurityEvent(event) {
        const securityEvent = {
            id: `event_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`,
            timestamp: new Date(),
            ...event
        };
        this.securityEvents.push(securityEvent);
        // Keep only recent events in memory
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-500);
        }
        this.emit('securityEvent', securityEvent);
    }
    /**
     * Start cleanup timer for expired sessions
     */
    startCleanupTimer() {
        setInterval(async () => {
            try {
                await this.cleanupExpiredSessions();
            }
            catch (error) {
                console.error('Error during session cleanup:', error);
            }
        }, 60 * 60 * 1000); // Run every hour
    }
    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;
        for (const user of this.users.values()) {
            const expiredSessions = [];
            for (const [token, session] of user.security.sessions) {
                if (session.expiresAt < now) {
                    expiredSessions.push(token);
                }
            }
            if (expiredSessions.length > 0) {
                expiredSessions.forEach(token => user.security.sessions.delete(token));
                await this.saveUser(user);
                cleanedCount += expiredSessions.length;
            }
        }
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired sessions`);
        }
    }
    /**
     * Save user to disk
     */
    async saveUser(user) {
        const filePath = path_1.default.join(this.config.baseDir, `${user.id}.json`);
        // Convert Map objects to plain objects for JSON serialization
        const serializable = {
            ...user,
            platformIdentities: Object.fromEntries(user.platformIdentities),
            permissions: {
                ...user.permissions,
                capabilities: Array.from(user.permissions.capabilities),
                restrictions: Array.from(user.permissions.restrictions)
            },
            security: {
                ...user.security,
                apiKeys: Object.fromEntries(user.security.apiKeys),
                sessions: Object.fromEntries(user.security.sessions)
            }
        };
        await fs_1.promises.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
    }
    /**
     * Save all users to disk
     */
    async saveAllUsers() {
        const savePromises = Array.from(this.users.values()).map(user => this.saveUser(user));
        await Promise.allSettled(savePromises);
    }
    /**
     * Load users from disk
     */
    async loadUsers() {
        try {
            const files = await fs_1.promises.readdir(this.config.baseDir);
            for (const filename of files) {
                if (filename.endsWith('.json') && filename !== 'security-events.json') {
                    try {
                        const filePath = path_1.default.join(this.config.baseDir, filename);
                        const data = await fs_1.promises.readFile(filePath, 'utf-8');
                        const serialized = JSON.parse(data);
                        // Convert back to Map objects
                        const user = {
                            ...serialized,
                            platformIdentities: new Map(Object.entries(serialized.platformIdentities)),
                            permissions: {
                                ...serialized.permissions,
                                capabilities: new Set(serialized.permissions.capabilities),
                                restrictions: new Set(serialized.permissions.restrictions)
                            },
                            security: {
                                ...serialized.security,
                                apiKeys: new Map(Object.entries(serialized.security.apiKeys || {})),
                                sessions: new Map(Object.entries(serialized.security.sessions || {}))
                            }
                        };
                        this.users.set(user.id, user);
                        // Build platform user map
                        for (const [platform, identity] of user.platformIdentities) {
                            this.platformUserMap.set(`${platform}:${identity.platformId}`, user.id);
                        }
                    }
                    catch (error) {
                        console.error(`Error loading user from ${filename}:`, error);
                    }
                }
            }
        }
        catch (error) {
            // Directory might not exist yet, which is fine
        }
    }
    /**
     * Save security events to disk
     */
    async saveSecurityEvents() {
        const filePath = path_1.default.join(this.config.baseDir, 'security-events.json');
        await fs_1.promises.writeFile(filePath, JSON.stringify(this.securityEvents, null, 2), 'utf-8');
    }
    /**
     * Load security events from disk
     */
    async loadSecurityEvents() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'security-events.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            this.securityEvents = JSON.parse(data);
        }
        catch (error) {
            // File might not exist yet, which is fine
            this.securityEvents = [];
        }
    }
}
exports.UserAuthenticationService = UserAuthenticationService;
/**
 * Create a user authentication service with default configuration
 */
function createUserAuthenticationService(config = {}) {
    return new UserAuthenticationService(config);
}
