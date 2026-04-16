"use strict";
/**
 * Conversation Router for Cross-Platform Sync
 *
 * This module manages unified conversations across multiple platforms,
 * implementing conversation linking and message synchronization with JSON storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationRouter = void 0;
exports.createConversationRouter = createConversationRouter;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
/**
 * Main conversation router class
 */
class ConversationRouter extends events_1.EventEmitter {
    config;
    conversationLinks = new Map();
    routingRules = new Map();
    syncQueue = [];
    syncConflicts = new Map();
    linkCache = new Map(); // conversationId -> linkId
    processingTimer = null;
    isInitialized = false;
    constructor(config = {}) {
        super();
        this.config = {
            baseDir: path_1.default.join(os_1.default.homedir(), '.everfern', 'conversation-links'),
            defaultSyncDelay: 1000, // 1 second
            maxSyncRetries: 3,
            syncBatchSize: 10,
            conflictDetection: {
                enabled: true,
                timestampToleranceMs: 5000, // 5 seconds
                contentSimilarityThreshold: 0.8,
                duplicateDetectionWindow: 60000 // 1 minute
            },
            autoLinking: {
                enabled: true,
                confidenceThreshold: 0.7,
                maxSuggestionsPerConversation: 3
            },
            performance: {
                cacheSize: 1000,
                cacheTtlMs: 300000, // 5 minutes
                batchProcessingInterval: 5000 // 5 seconds
            },
            ...config
        };
    }
    /**
     * Initialize the conversation router
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Create base directories
            await this.ensureDirectories();
            // Load existing data
            await this.loadConversationLinks();
            await this.loadRoutingRules();
            await this.loadSyncConflicts();
            // Start processing timer
            this.startProcessingTimer();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('ConversationRouter initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize ConversationRouter:', error);
            throw error;
        }
    }
    /**
     * Shutdown the conversation router
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        try {
            // Stop processing timer
            if (this.processingTimer) {
                clearInterval(this.processingTimer);
                this.processingTimer = null;
            }
            // Process remaining sync queue
            await this.processSyncQueue();
            // Save all data
            await this.saveConversationLinks();
            await this.saveRoutingRules();
            await this.saveSyncConflicts();
            // Clear memory
            this.conversationLinks.clear();
            this.routingRules.clear();
            this.syncQueue.length = 0;
            this.syncConflicts.clear();
            this.linkCache.clear();
            this.isInitialized = false;
            this.emit('shutdown');
            console.log('ConversationRouter shutdown successfully');
        }
        catch (error) {
            console.error('Error during ConversationRouter shutdown:', error);
            throw error;
        }
    }
    /**
     * Create a conversation link between multiple platforms
     */
    async createConversationLink(conversations, createdBy, linkType = 'manual', syncSettings) {
        if (conversations.length < 2) {
            throw new Error('At least 2 conversations required to create a link');
        }
        const linkId = `link_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        const primaryConversationId = conversations[0].conversationId;
        const conversationLink = {
            id: linkId,
            primaryConversationId,
            linkedConversations: new Map(conversations.map(conv => [conv.conversationId, {
                    conversationId: conv.conversationId,
                    platform: conv.platform,
                    chatId: conv.chatId,
                    chatName: conv.chatName,
                    linkedAt: new Date(),
                    active: true
                }])),
            metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy,
                linkType,
                tags: []
            },
            syncSettings: {
                enabled: true,
                bidirectional: true,
                syncDelay: this.config.defaultSyncDelay,
                conflictResolution: 'timestamp',
                platformPriority: conversations.map(c => c.platform),
                excludeSystemMessages: false,
                excludeFileAttachments: false,
                ...syncSettings
            },
            statistics: {
                totalMessagesSynced: 0,
                syncErrors: 0,
                conflictsResolved: 0
            }
        };
        this.conversationLinks.set(linkId, conversationLink);
        // Update cache
        for (const conv of conversations) {
            this.linkCache.set(conv.conversationId, linkId);
        }
        await this.saveConversationLinks();
        this.emit('conversationLinkCreated', conversationLink);
        return linkId;
    }
    /**
     * Route a message through the conversation router
     */
    async routeMessage(message) {
        try {
            // Check if conversation is linked
            const linkId = this.linkCache.get(message.conversationId);
            if (!linkId) {
                // Check routing rules for auto-linking
                await this.checkRoutingRules(message);
                return;
            }
            const link = this.conversationLinks.get(linkId);
            if (!link || !link.syncSettings.enabled) {
                return;
            }
            // Create sync entry
            const syncEntry = await this.createSyncEntry(message, link);
            // Add to sync queue
            this.syncQueue.push(syncEntry);
            this.emit('messageQueued', message, linkId);
        }
        catch (error) {
            console.error('Error routing message:', error);
            this.emit('routingError', message, error);
        }
    }
    /**
     * Get conversation link by ID
     */
    getConversationLink(linkId) {
        return this.conversationLinks.get(linkId);
    }
    /**
     * Get conversation link by conversation ID
     */
    getConversationLinkByConversationId(conversationId) {
        const linkId = this.linkCache.get(conversationId);
        return linkId ? this.conversationLinks.get(linkId) : undefined;
    }
    /**
     * Get all conversation links
     */
    getAllConversationLinks() {
        return Array.from(this.conversationLinks.values());
    }
    /**
     * Update conversation link settings
     */
    async updateConversationLink(linkId, updates) {
        const link = this.conversationLinks.get(linkId);
        if (!link) {
            return false;
        }
        if (updates.syncSettings) {
            link.syncSettings = { ...link.syncSettings, ...updates.syncSettings };
        }
        if (updates.metadata) {
            link.metadata = { ...link.metadata, ...updates.metadata, updatedAt: new Date() };
        }
        await this.saveConversationLinks();
        this.emit('conversationLinkUpdated', link);
        return true;
    }
    /**
     * Remove a conversation link
     */
    async removeConversationLink(linkId) {
        const link = this.conversationLinks.get(linkId);
        if (!link) {
            return false;
        }
        // Remove from cache
        for (const [conversationId] of link.linkedConversations) {
            this.linkCache.delete(conversationId);
        }
        // Remove link
        this.conversationLinks.delete(linkId);
        await this.saveConversationLinks();
        this.emit('conversationLinkRemoved', linkId);
        return true;
    }
    /**
     * Add a routing rule
     */
    async addRoutingRule(rule) {
        const ruleId = `rule_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        const routingRule = {
            id: ruleId,
            metadata: {
                createdAt: new Date(),
                createdBy: 'system',
                enabled: true,
                priority: 0
            },
            ...rule
        };
        this.routingRules.set(ruleId, routingRule);
        await this.saveRoutingRules();
        this.emit('routingRuleAdded', routingRule);
        return ruleId;
    }
    /**
     * Get sync conflicts
     */
    getSyncConflicts(status) {
        const conflicts = Array.from(this.syncConflicts.values());
        return status ? conflicts.filter(c => c.resolution.status === status) : conflicts;
    }
    /**
     * Resolve a sync conflict
     */
    async resolveSyncConflict(conflictId, resolution, resolvedBy) {
        const conflict = this.syncConflicts.get(conflictId);
        if (!conflict) {
            return false;
        }
        conflict.resolution = {
            status: 'resolved',
            method: resolution,
            resolvedAt: new Date(),
            resolvedBy
        };
        await this.saveSyncConflicts();
        this.emit('syncConflictResolved', conflict);
        return true;
    }
    /**
     * Get sync statistics
     */
    getSyncStatistics() {
        const activeLinks = Array.from(this.conversationLinks.values())
            .filter(link => link.syncSettings.enabled).length;
        const totalMessagesSynced = Array.from(this.conversationLinks.values())
            .reduce((sum, link) => sum + link.statistics.totalMessagesSynced, 0);
        const syncErrors = Array.from(this.conversationLinks.values())
            .reduce((sum, link) => sum + link.statistics.syncErrors, 0);
        const unresolvedConflicts = Array.from(this.syncConflicts.values())
            .filter(conflict => conflict.resolution.status === 'pending').length;
        return {
            totalLinks: this.conversationLinks.size,
            activeLinks,
            totalMessagesSynced,
            pendingSyncItems: this.syncQueue.length,
            syncErrors,
            unresolvedConflicts
        };
    }
    /**
     * Create a sync entry for a message
     */
    async createSyncEntry(message, link) {
        const syncId = `sync_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        // Determine target conversations (exclude source)
        const targetConversations = Array.from(link.linkedConversations.entries())
            .filter(([convId]) => convId !== message.conversationId &&
            link.linkedConversations.get(convId)?.active);
        const syncEntry = {
            id: syncId,
            originalMessage: message,
            syncedMessages: new Map(targetConversations.map(([convId, conv]) => [convId, {
                    messageId: '',
                    platform: conv.platform,
                    conversationId: convId,
                    syncedAt: new Date(),
                    syncStatus: 'pending'
                }])),
            metadata: {
                syncInitiatedAt: new Date(),
                syncAttempts: 0
            }
        };
        return syncEntry;
    }
    /**
     * Check routing rules for auto-linking
     */
    async checkRoutingRules(message) {
        if (!this.config.autoLinking.enabled) {
            return;
        }
        const applicableRules = Array.from(this.routingRules.values())
            .filter(rule => rule.metadata.enabled && this.isRuleApplicable(rule, message))
            .sort((a, b) => b.metadata.priority - a.metadata.priority);
        for (const rule of applicableRules) {
            if (rule.actions.autoLink?.enabled) {
                await this.processAutoLinkRule(rule, message);
            }
            if (rule.actions.createLink?.enabled) {
                await this.processCreateLinkRule(rule, message);
            }
        }
    }
    /**
     * Check if routing rule applies to message
     */
    isRuleApplicable(rule, message) {
        const conditions = rule.conditions;
        // Check platform patterns
        if (conditions.platformPatterns.length > 0) {
            const matches = conditions.platformPatterns.some(pattern => new RegExp(pattern).test(message.platform));
            if (!matches)
                return false;
        }
        // Check user patterns
        if (conditions.userPatterns.length > 0) {
            const matches = conditions.userPatterns.some(pattern => new RegExp(pattern).test(message.sender.userId));
            if (!matches)
                return false;
        }
        // Check content patterns
        if (conditions.contentPatterns.length > 0) {
            const matches = conditions.contentPatterns.some(pattern => new RegExp(pattern).test(message.content.text));
            if (!matches)
                return false;
        }
        return true;
    }
    /**
     * Process auto-link rule
     */
    async processAutoLinkRule(rule, message) {
        // Implementation would find matching conversations and create links
        // This is a simplified version
        this.emit('autoLinkSuggestion', rule, message);
    }
    /**
     * Process create link rule
     */
    async processCreateLinkRule(rule, message) {
        // Implementation would create new conversation links based on rule
        // This is a simplified version
        this.emit('createLinkSuggestion', rule, message);
    }
    /**
     * Start processing timer
     */
    startProcessingTimer() {
        this.processingTimer = setInterval(async () => {
            try {
                await this.processSyncQueue();
            }
            catch (error) {
                console.error('Error processing sync queue:', error);
            }
        }, this.config.performance.batchProcessingInterval);
    }
    /**
     * Process sync queue
     */
    async processSyncQueue() {
        if (this.syncQueue.length === 0) {
            return;
        }
        const batch = this.syncQueue.splice(0, this.config.syncBatchSize);
        for (const syncEntry of batch) {
            try {
                await this.processSyncEntry(syncEntry);
            }
            catch (error) {
                console.error('Error processing sync entry:', error);
                syncEntry.metadata.syncAttempts++;
                if (syncEntry.metadata.syncAttempts < this.config.maxSyncRetries) {
                    // Re-queue for retry
                    this.syncQueue.push(syncEntry);
                }
                else {
                    this.emit('syncEntryFailed', syncEntry, error);
                }
            }
        }
    }
    /**
     * Process individual sync entry
     */
    async processSyncEntry(syncEntry) {
        syncEntry.metadata.syncAttempts++;
        syncEntry.metadata.lastAttemptAt = new Date();
        // Check for conflicts
        if (this.config.conflictDetection.enabled) {
            const conflicts = await this.detectConflicts(syncEntry);
            if (conflicts.length > 0) {
                for (const conflict of conflicts) {
                    this.syncConflicts.set(conflict.id, conflict);
                }
                this.emit('syncConflictsDetected', conflicts);
                return;
            }
        }
        // Simulate message sync (in real implementation, this would call platform APIs)
        for (const [convId, syncInfo] of syncEntry.syncedMessages) {
            try {
                // Simulate successful sync
                syncInfo.syncStatus = 'synced';
                syncInfo.messageId = `synced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                syncInfo.syncedAt = new Date();
                this.emit('messageSynced', syncEntry.originalMessage, convId, syncInfo.messageId);
            }
            catch (error) {
                syncInfo.syncStatus = 'failed';
                syncInfo.error = String(error);
                this.emit('messageSyncFailed', syncEntry.originalMessage, convId, error);
            }
        }
        syncEntry.metadata.syncCompletedAt = new Date();
        this.emit('syncEntryCompleted', syncEntry);
    }
    /**
     * Detect sync conflicts
     */
    async detectConflicts(syncEntry) {
        const conflicts = [];
        // Simplified conflict detection - in real implementation this would be more sophisticated
        const linkId = this.linkCache.get(syncEntry.originalMessage.conversationId);
        if (!linkId) {
            return conflicts;
        }
        // Check for timestamp collisions
        const timestampTolerance = this.config.conflictDetection.timestampToleranceMs;
        const messageTime = syncEntry.originalMessage.timestamp.getTime();
        // This would check against existing messages in target conversations
        // For now, we'll create a mock conflict for demonstration
        if (Math.random() < 0.1) { // 10% chance of conflict for testing
            const conflictId = `conflict_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
            conflicts.push({
                id: conflictId,
                conversationLinkId: linkId,
                conflictingMessages: [syncEntry.originalMessage],
                type: 'timestamp_collision',
                details: {
                    detectedAt: new Date(),
                    platforms: [syncEntry.originalMessage.platform],
                    affectedMessageIds: [syncEntry.originalMessage.id],
                    conflictReason: 'Simulated timestamp collision'
                },
                resolution: {
                    status: 'pending'
                }
            });
        }
        return conflicts;
    }
    /**
     * Ensure required directories exist
     */
    async ensureDirectories() {
        const dirs = [
            this.config.baseDir,
            path_1.default.join(this.config.baseDir, 'links'),
            path_1.default.join(this.config.baseDir, 'rules'),
            path_1.default.join(this.config.baseDir, 'conflicts')
        ];
        for (const dir of dirs) {
            await fs_1.promises.mkdir(dir, { recursive: true });
        }
    }
    /**
     * Save conversation links to disk
     */
    async saveConversationLinks() {
        const filePath = path_1.default.join(this.config.baseDir, 'links', 'conversation-links.json');
        // Convert Map objects to plain objects for JSON serialization
        const serializable = Array.from(this.conversationLinks.values()).map(link => ({
            ...link,
            linkedConversations: Object.fromEntries(link.linkedConversations)
        }));
        await fs_1.promises.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
    }
    /**
     * Load conversation links from disk
     */
    async loadConversationLinks() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'links', 'conversation-links.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const serialized = JSON.parse(data);
            this.conversationLinks.clear();
            this.linkCache.clear();
            for (const linkData of serialized) {
                const link = {
                    ...linkData,
                    linkedConversations: new Map(Object.entries(linkData.linkedConversations))
                };
                this.conversationLinks.set(link.id, link);
                // Update cache
                for (const [conversationId] of link.linkedConversations) {
                    this.linkCache.set(conversationId, link.id);
                }
            }
        }
        catch (error) {
            // File might not exist yet, which is fine
        }
    }
    /**
     * Save routing rules to disk
     */
    async saveRoutingRules() {
        const filePath = path_1.default.join(this.config.baseDir, 'rules', 'routing-rules.json');
        const rules = Array.from(this.routingRules.values());
        await fs_1.promises.writeFile(filePath, JSON.stringify(rules, null, 2), 'utf-8');
    }
    /**
     * Load routing rules from disk
     */
    async loadRoutingRules() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'rules', 'routing-rules.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const rules = JSON.parse(data);
            this.routingRules.clear();
            for (const rule of rules) {
                this.routingRules.set(rule.id, rule);
            }
        }
        catch (error) {
            // File might not exist yet, which is fine
        }
    }
    /**
     * Save sync conflicts to disk
     */
    async saveSyncConflicts() {
        const filePath = path_1.default.join(this.config.baseDir, 'conflicts', 'sync-conflicts.json');
        const conflicts = Array.from(this.syncConflicts.values());
        await fs_1.promises.writeFile(filePath, JSON.stringify(conflicts, null, 2), 'utf-8');
    }
    /**
     * Load sync conflicts from disk
     */
    async loadSyncConflicts() {
        try {
            const filePath = path_1.default.join(this.config.baseDir, 'conflicts', 'sync-conflicts.json');
            const data = await fs_1.promises.readFile(filePath, 'utf-8');
            const conflicts = JSON.parse(data);
            this.syncConflicts.clear();
            for (const conflict of conflicts) {
                this.syncConflicts.set(conflict.id, conflict);
            }
        }
        catch (error) {
            // File might not exist yet, which is fine
        }
    }
}
exports.ConversationRouter = ConversationRouter;
/**
 * Create a conversation router with default configuration
 */
function createConversationRouter(config = {}) {
    return new ConversationRouter(config);
}
