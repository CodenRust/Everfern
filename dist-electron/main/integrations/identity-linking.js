"use strict";
/**
 * Platform Identity Linking System
 *
 * This module manages the linking of platform-specific identities to unified
 * user accounts, including identity verification and conflict resolution.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityLinkingService = void 0;
exports.createIdentityLinkingService = createIdentityLinkingService;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
/**
 * Main identity linking service
 */
class IdentityLinkingService extends events_1.EventEmitter {
    config;
    authService;
    verificationRequests = new Map();
    identityConflicts = new Map();
    linkingAttempts = new Map(); // userId -> timestamps
    isInitialized = false;
    constructor(authService, config = {}) {
        super();
        this.authService = authService;
        this.config = {
            baseDir: path_1.default.join(os_1.default.homedir(), '.everfern', 'identity-linking'),
            verificationCodeLength: 6,
            verificationExpirationMs: 10 * 60 * 1000, // 10 minutes
            maxVerificationAttempts: 3,
            requireVerification: true,
            conflictResolution: {
                enabled: true,
                preference: 'verified',
                requireAdminApproval: false
            },
            suspiciousActivityDetection: {
                enabled: true,
                maxIdentitiesPerUser: 5,
                maxLinkingAttemptsPerHour: 10,
                flagRapidLinking: true
            },
            ...config
        };
    }
    /**
     * Initialize the identity linking service
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Create base directory
            await fs_1.promises.mkdir(this.config.baseDir, { recursive: true });
            // Load existing data
            await this.loadVerificationRequests();
            await this.loadIdentityConflicts();
            // Start cleanup timer
            this.startCleanupTimer();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('IdentityLinkingService initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize IdentityLinkingService:', error);
            throw error;
        }
    }
    /**
     * Shutdown the identity linking service
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        try {
            // Save data
            await this.saveVerificationRequests();
            await this.saveIdentityConflicts();
            // Clear memory
            this.verificationRequests.clear();
            this.identityConflicts.clear();
            this.linkingAttempts.clear();
            this.isInitialized = false;
            this.emit('shutdown');
            console.log('IdentityLinkingService shutdown successfully');
        }
        catch (error) {
            console.error('Error during IdentityLinkingService shutdown:', error);
            throw error;
        }
    }
    /**
     * Request to link a platform identity to a user account
     */
    async requestIdentityLinking(userId, platform, platformUserId, username, displayName, avatar, metadata) {
        try {
            // Check if user exists
            const user = this.authService.getUser(userId);
            if (!user) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }
            // Check for suspicious activity
            const suspiciousActivity = await this.detectSuspiciousActivity(userId, platform);
            if (suspiciousActivity) {
                return {
                    success: false,
                    error: 'Suspicious activity detected. Please contact support.'
                };
            }
            // Check for existing identity conflicts
            const existingUser = this.authService.getUserByPlatformId(platform, platformUserId);
            if (existingUser && existingUser.id !== userId) {
                const conflict = await this.createIdentityConflict(platform, platformUserId, existingUser.id, userId, { username, displayName, avatar });
                return {
                    success: false,
                    conflict,
                    error: 'Identity is already linked to another user'
                };
            }
            // Check if identity is already linked to this user
            if (existingUser && existingUser.id === userId) {
                return {
                    success: true,
                    user: existingUser,
                    details: { alreadyLinked: true }
                };
            }
            // Create verification request if required
            if (this.config.requireVerification) {
                const verificationRequest = await this.createVerificationRequest(userId, platform, platformUserId, username, displayName, avatar, metadata);
                return {
                    success: false,
                    verificationRequest,
                    details: { verificationRequired: true }
                };
            }
            // Link identity directly
            const linked = await this.authService.linkPlatformIdentity(userId, platform, platformUserId, username, displayName, avatar);
            if (linked) {
                this.recordLinkingAttempt(userId);
                this.emit('identityLinked', userId, platform, platformUserId);
                return {
                    success: true,
                    user: this.authService.getUser(userId)
                };
            }
            else {
                return {
                    success: false,
                    error: 'Failed to link identity'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: `Identity linking failed: ${error}`
            };
        }
    }
    /**
     * Verify an identity linking request
     */
    async verifyIdentityLinking(requestId, verificationCode) {
        const request = this.verificationRequests.get(requestId);
        if (!request) {
            throw new Error('Verification request not found');
        }
        // Check if request has expired
        if (new Date() > request.expiresAt) {
            request.status = 'expired';
            await this.saveVerificationRequests();
            return {
                success: false,
                request,
                error: 'Verification request has expired',
                remainingAttempts: 0
            };
        }
        // Check if request has exceeded max attempts
        if (request.attempts >= request.maxAttempts) {
            request.status = 'failed';
            await this.saveVerificationRequests();
            return {
                success: false,
                request,
                error: 'Maximum verification attempts exceeded',
                remainingAttempts: 0
            };
        }
        // Increment attempt count
        request.attempts++;
        // Verify code
        const isValid = this.verifyCode(request.verificationData, verificationCode);
        if (!isValid) {
            await this.saveVerificationRequests();
            return {
                success: false,
                request,
                error: 'Invalid verification code',
                remainingAttempts: request.maxAttempts - request.attempts
            };
        }
        // Verification successful - link the identity
        const linked = await this.authService.linkPlatformIdentity(request.userId, request.platform, request.platformUserId, request.username, request.displayName, request.avatar);
        if (linked) {
            request.status = 'verified';
            this.recordLinkingAttempt(request.userId);
            this.emit('identityLinked', request.userId, request.platform, request.platformUserId);
            this.emit('identityVerified', request);
        }
        else {
            request.status = 'failed';
        }
        await this.saveVerificationRequests();
        return {
            success: linked,
            request,
            error: linked ? undefined : 'Failed to link identity after verification',
            remainingAttempts: request.maxAttempts - request.attempts
        };
    }
    /**
     * Resolve an identity conflict
     */
    async resolveIdentityConflict(conflictId, resolution, resolvedBy, reason) {
        const conflict = this.identityConflicts.get(conflictId);
        if (!conflict) {
            return false;
        }
        try {
            let success = false;
            switch (resolution) {
                case 'keep_existing':
                    // No action needed - existing identity remains
                    success = true;
                    break;
                case 'replace_with_new':
                    // Unlink from existing user and link to requesting user
                    const existingUser = this.authService.getUser(conflict.existingUserId);
                    const requestingUser = this.authService.getUser(conflict.requestingUserId);
                    if (existingUser && requestingUser) {
                        // Remove identity from existing user
                        existingUser.platformIdentities.delete(conflict.platform);
                        // Link to requesting user
                        success = await this.authService.linkPlatformIdentity(conflict.requestingUserId, conflict.platform, conflict.platformUserId, conflict.details.platformInfo.username, conflict.details.platformInfo.displayName, conflict.details.platformInfo.avatar);
                    }
                    break;
                case 'manual_review':
                    // Mark for manual review - no automatic action
                    success = true;
                    break;
            }
            // Update conflict resolution
            conflict.resolution = {
                status: success ? 'resolved' : 'rejected',
                method: 'admin_override',
                resolvedBy,
                resolvedAt: new Date(),
                reason
            };
            await this.saveIdentityConflicts();
            this.emit('conflictResolved', conflict, resolution);
            return success;
        }
        catch (error) {
            console.error('Error resolving identity conflict:', error);
            return false;
        }
    }
    /**
     * Get pending verification requests for a user
     */
    getPendingVerificationRequests(userId) {
        return Array.from(this.verificationRequests.values())
            .filter(req => req.userId === userId && req.status === 'pending');
    }
    /**
     * Get identity conflicts
     */
    getIdentityConflicts(status) {
        const conflicts = Array.from(this.identityConflicts.values());
        return status ? conflicts.filter(c => c.resolution.status === status) : conflicts;
    }
    /**
     * Get user's linked identities
     */
    getUserIdentities(userId) {
        const user = this.authService.getUser(userId);
        if (!user) {
            return [];
        }
        return Array.from(user.platformIdentities.entries()).map(([platform, identity]) => ({
            platform,
            platformUserId: identity.platformId,
            username: identity.username,
            displayName: identity.displayName,
            avatar: identity.avatar,
            linkedAt: identity.linkedAt,
            verified: identity.verified
        }));
    }
    /**
     * Unlink a platform identity
     */
    async unlinkPlatformIdentity(userId, platform) {
        try {
            const user = this.authService.getUser(userId);
            if (!user) {
                return false;
            }
            const identity = user.platformIdentities.get(platform);
            if (!identity) {
                return false;
            }
            // Remove identity
            user.platformIdentities.delete(platform);
            user.status.updatedAt = new Date();
            this.emit('identityUnlinked', userId, platform, identity.platformId);
            return true;
        }
        catch (error) {
            console.error('Error unlinking platform identity:', error);
            return false;
        }
    }
    /**
     * Create a verification request
     */
    async createVerificationRequest(userId, platform, platformUserId, username, displayName, avatar, metadata) {
        const requestId = `verify_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        const verificationCode = this.generateVerificationCode();
        const request = {
            id: requestId,
            userId,
            platform,
            platformUserId,
            username,
            displayName,
            avatar,
            verificationMethod: 'code',
            verificationData: verificationCode,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.config.verificationExpirationMs),
            status: 'pending',
            attempts: 0,
            maxAttempts: this.config.maxVerificationAttempts,
            metadata: metadata || {}
        };
        this.verificationRequests.set(requestId, request);
        await this.saveVerificationRequests();
        this.emit('verificationRequestCreated', request);
        return request;
    }
    /**
     * Create an identity conflict
     */
    async createIdentityConflict(platform, platformUserId, existingUserId, requestingUserId, platformInfo) {
        const conflictId = `conflict_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        const existingUser = this.authService.getUser(existingUserId);
        const requestingUser = this.authService.getUser(requestingUserId);
        const existingIdentity = existingUser.platformIdentities.get(platform);
        const conflict = {
            id: conflictId,
            platform,
            platformUserId,
            existingUserId,
            requestingUserId,
            type: 'already_linked',
            details: {
                existingUserInfo: {
                    displayName: existingUser.profile.displayName,
                    linkedAt: existingIdentity.linkedAt,
                    verified: existingIdentity.verified
                },
                requestingUserInfo: {
                    displayName: requestingUser.profile.displayName,
                    requestedAt: new Date()
                },
                platformInfo
            },
            resolution: {
                status: 'pending'
            },
            createdAt: new Date()
        };
        this.identityConflicts.set(conflictId, conflict);
        await this.saveIdentityConflicts();
        this.emit('identityConflictDetected', conflict);
        return conflict;
    }
    /**
     * Detect suspicious activity
     */
    async detectSuspiciousActivity(userId, platform) {
        if (!this.config.suspiciousActivityDetection.enabled) {
            return false;
        }
        const user = this.authService.getUser(userId);
        if (!user) {
            return true; // User not found is suspicious
        }
        // Check maximum identities per user
        if (user.platformIdentities.size >= this.config.suspiciousActivityDetection.maxIdentitiesPerUser) {
            return true;
        }
        // Check linking attempt rate
        const attempts = this.linkingAttempts.get(userId) || [];
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentAttempts = attempts.filter(attempt => attempt > oneHourAgo);
        if (recentAttempts.length >= this.config.suspiciousActivityDetection.maxLinkingAttemptsPerHour) {
            return true;
        }
        // Check for rapid successive attempts
        if (this.config.suspiciousActivityDetection.flagRapidLinking && recentAttempts.length >= 3) {
            const timeDiffs = recentAttempts.slice(1).map((attempt, i) => attempt.getTime() - recentAttempts[i].getTime());
            const avgTimeDiff = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
            // Flag if average time between attempts is less than 5 minutes
            if (avgTimeDiff < 5 * 60 * 1000) {
                return true;
            }
        }
        return false;
    }
    /**
     * Record a linking attempt
     */
    recordLinkingAttempt(userId) {
        const attempts = this.linkingAttempts.get(userId) || [];
        attempts.push(new Date());
        // Keep only recent attempts (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentAttempts = attempts.filter(attempt => attempt > oneDayAgo);
        this.linkingAttempts.set(userId, recentAttempts);
    }
    /**
     * Generate verification code
     */
    generateVerificationCode() {
        const chars = '0123456789';
        let code = '';
        for (let i = 0; i < this.config.verificationCodeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    /**
     * Verify code
     */
    verifyCode(storedCode, providedCode) {
        return storedCode === providedCode;
    }
    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        setInterval(async () => {
            await this.cleanupExpiredRequests();
        }, 60 * 60 * 1000); // Run every hour
    }
    /**
     * Clean up expired verification requests
     */
    async cleanupExpiredRequests() {
        const now = new Date();
        let cleanedCount = 0;
        for (const [id, request] of this.verificationRequests) {
            if (request.expiresAt < now && request.status === 'pending') {
                request.status = 'expired';
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            await this.saveVerificationRequests();
            console.log(`Cleaned up ${cleanedCount} expired verification requests`);
        }
    }
    /**
     * Save verification requests to disk
     */
    async saveVerificationRequests() {
        const filePath = path_1.default.join(this.config.baseDir, 'verification-requests.json');
        const requests = Array.from(this.verificationRequests.values());
        await fs_1.promises.writeFile(filePath, JSON.stringify(requests, null, 2), 'utf-8');
    }
    /**
     * Load verification requests from disk
     */
    async loadVerificationRequests() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'verification-requests.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const requests = JSON.parse(data);
            this.verificationRequests.clear();
            for (const request of requests) {
                this.verificationRequests.set(request.id, request);
            }
        }
        catch (error) {
            // File might not exist yet, which is fine
        }
    }
    /**
     * Save identity conflicts to disk
     */
    async saveIdentityConflicts() {
        const filePath = path_1.default.join(this.config.baseDir, 'identity-conflicts.json');
        const conflicts = Array.from(this.identityConflicts.values());
        await fs_1.promises.writeFile(filePath, JSON.stringify(conflicts, null, 2), 'utf-8');
    }
    /**
     * Load identity conflicts from disk
     */
    async loadIdentityConflicts() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'identity-conflicts.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const conflicts = JSON.parse(data);
            this.identityConflicts.clear();
            for (const conflict of conflicts) {
                this.identityConflicts.set(conflict.id, conflict);
            }
        }
        catch (error) {
            // File might not exist yet, which is fine
        }
    }
}
exports.IdentityLinkingService = IdentityLinkingService;
/**
 * Create an identity linking service with default configuration
 */
function createIdentityLinkingService(authService, config = {}) {
    return new IdentityLinkingService(authService, config);
}
