"use strict";
/**
 * Conversation Context Management
 *
 * This module manages conversation state and context across multiple platforms,
 * enabling seamless conversation flow and history synchronization.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationContextManager = void 0;
exports.createConversationContextManager = createConversationContextManager;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const events_1 = require("events");
/**
 * Main conversation context manager
 */
class ConversationContextManager extends events_1.EventEmitter {
    config;
    conversations = new Map();
    platforms = new Map();
    saveTimer = null;
    isInitialized = false;
    constructor(config = {}) {
        super();
        this.config = {
            baseDir: path_1.default.join(os_1.default.homedir(), '.everfern', 'conversations'),
            maxContextMessages: 50,
            maxContextTokens: 8000,
            saveInterval: 30000, // 30 seconds
            retentionDays: 90,
            enableSummarization: true,
            crossPlatformSync: {
                enabled: true,
                syncDelay: 1000, // 1 second
                conflictResolution: 'timestamp'
            },
            ...config
        };
    }
    /**
     * Initialize the conversation context manager
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Create base directory
            await fs_1.promises.mkdir(this.config.baseDir, { recursive: true });
            // Load existing conversations
            await this.loadConversations();
            // Start periodic save timer
            this.startSaveTimer();
            this.isInitialized = true;
            this.emit('initialized');
            console.log('ConversationContextManager initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize ConversationContextManager:', error);
            throw error;
        }
    }
    /**
     * Shutdown the context manager
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        try {
            // Stop save timer
            if (this.saveTimer) {
                clearInterval(this.saveTimer);
                this.saveTimer = null;
            }
            // Save all conversations
            await this.saveAllConversations();
            // Clear memory
            this.conversations.clear();
            this.platforms.clear();
            this.isInitialized = false;
            this.emit('shutdown');
            console.log('ConversationContextManager shutdown successfully');
        }
        catch (error) {
            console.error('Error during ConversationContextManager shutdown:', error);
            throw error;
        }
    }
    /**
     * Register a platform for context management
     */
    registerPlatform(name, platform) {
        this.platforms.set(name, platform);
        this.emit('platformRegistered', name);
    }
    /**
     * Process an incoming message and update conversation context
     */
    async processMessage(message) {
        const conversationId = this.generateConversationId(message);
        // Get or create conversation
        let conversation = this.conversations.get(conversationId);
        if (!conversation) {
            conversation = await this.createConversation(conversationId, message);
        }
        // Add participant if not exists
        await this.ensureParticipant(conversation, message);
        // Create conversation message
        const conversationMessage = {
            id: message.id,
            conversationId,
            sender: await this.getParticipant(conversation, message.user.id),
            content: {
                text: message.content.text,
                files: message.content.files.map(f => ({
                    id: f.id,
                    name: f.name,
                    mimeType: f.mimeType
                })),
                metadata: {
                    isMention: message.content.isMention,
                    replyTo: message.content.replyTo,
                    platform: message.platform
                }
            },
            timestamp: message.timestamp,
            platform: message.platform,
            isSystem: false
        };
        // Add message to context
        await this.addMessageToContext(conversation, conversationMessage);
        // Update conversation metadata
        conversation.metadata.lastActivity = new Date();
        conversation.metadata.messageCount++;
        conversation.platforms.add(message.platform);
        // Handle cross-platform sync
        if (this.config.crossPlatformSync.enabled && conversation.syncSettings.enabled) {
            await this.syncConversationAcrossPlatforms(conversation, conversationMessage);
        }
        this.emit('messageProcessed', conversationId, conversationMessage);
        return conversation;
    }
    /**
     * Add a system message to conversation context
     */
    async addSystemMessage(conversationId, content, metadata = {}) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            return;
        }
        const systemMessage = {
            id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conversationId,
            sender: {
                userId: 'system',
                platforms: new Map(),
                role: 'system',
                lastActive: new Date()
            },
            content: {
                text: content,
                files: [],
                metadata
            },
            timestamp: new Date(),
            platform: 'system',
            isSystem: true
        };
        await this.addMessageToContext(conversation, systemMessage);
        this.emit('systemMessageAdded', conversationId, systemMessage);
    }
    /**
     * Handle stop command from any platform
     */
    async handleStopCommand(conversationId, userId, platform) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        const stopCommand = {
            id: `stop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            conversationId,
            userId,
            platform,
            timestamp: new Date(),
            propagated: false
        };
        // Mark conversation as stopped
        conversation.stopRequested = true;
        conversation.status = 'stopped';
        // Add system message about stop
        await this.addSystemMessage(conversationId, `Stop command issued by user ${userId} from ${platform}`, { stopCommand: stopCommand.id });
        // Propagate stop to other platforms if cross-sync is enabled
        if (conversation.syncSettings.enabled) {
            await this.propagateStopCommand(conversation, stopCommand);
        }
        this.emit('stopCommandReceived', stopCommand);
        return stopCommand;
    }
    /**
     * Get conversation by ID
     */
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    }
    /**
     * Get conversation context for agent processing
     */
    getConversationContext(conversationId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            return [];
        }
        return [...conversation.contextWindow.currentMessages];
    }
    /**
     * Update conversation sync settings
     */
    updateSyncSettings(conversationId, settings) {
        const conversation = this.conversations.get(conversationId);
        if (conversation) {
            conversation.syncSettings = { ...conversation.syncSettings, ...settings };
            this.emit('syncSettingsUpdated', conversationId, conversation.syncSettings);
        }
    }
    /**
     * Archive old conversations
     */
    async archiveOldConversations() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        let archivedCount = 0;
        for (const [id, conversation] of this.conversations) {
            if (conversation.metadata.lastActivity < cutoffDate && conversation.status !== 'active') {
                conversation.status = 'archived';
                await this.saveConversation(conversation);
                this.conversations.delete(id);
                archivedCount++;
            }
        }
        return archivedCount;
    }
    /**
     * Generate conversation ID from message
     */
    generateConversationId(message) {
        // Use platform and chat ID to create unique conversation ID
        return `${message.platform}_${message.chat.id}`;
    }
    /**
     * Create a new conversation
     */
    async createConversation(conversationId, initialMessage) {
        const conversation = {
            id: conversationId,
            title: initialMessage.chat.name || `Conversation ${conversationId}`,
            participants: new Map(),
            platforms: new Set([initialMessage.platform]),
            status: 'active',
            metadata: {
                createdAt: new Date(),
                lastActivity: new Date(),
                messageCount: 0,
                tags: [],
                priority: 'normal'
            },
            contextWindow: {
                maxMessages: this.config.maxContextMessages,
                maxTokens: this.config.maxContextTokens,
                currentMessages: []
            },
            stopRequested: false,
            syncSettings: {
                enabled: this.config.crossPlatformSync.enabled,
                syncPlatforms: [],
                syncDelay: this.config.crossPlatformSync.syncDelay
            }
        };
        this.conversations.set(conversationId, conversation);
        this.emit('conversationCreated', conversation);
        return conversation;
    }
    /**
     * Ensure participant exists in conversation
     */
    async ensureParticipant(conversation, message) {
        const userId = message.user.id; // This would be unified user ID in real implementation
        if (!conversation.participants.has(userId)) {
            const participant = {
                userId,
                platforms: new Map([[message.platform, {
                            id: message.user.id,
                            name: message.user.name,
                            avatar: message.user.avatar
                        }]]),
                role: 'user',
                lastActive: new Date()
            };
            conversation.participants.set(userId, participant);
        }
        else {
            // Update platform info
            const participant = conversation.participants.get(userId);
            participant.platforms.set(message.platform, {
                id: message.user.id,
                name: message.user.name,
                avatar: message.user.avatar
            });
            participant.lastActive = new Date();
        }
    }
    /**
     * Get participant by user ID
     */
    async getParticipant(conversation, userId) {
        const participant = conversation.participants.get(userId);
        if (!participant) {
            throw new Error(`Participant ${userId} not found in conversation`);
        }
        return participant;
    }
    /**
     * Add message to conversation context
     */
    async addMessageToContext(conversation, message) {
        const context = conversation.contextWindow;
        // Add message to context
        context.currentMessages.push(message);
        // Trim context if it exceeds limits
        while (context.currentMessages.length > context.maxMessages) {
            const removed = context.currentMessages.shift();
            if (removed && this.config.enableSummarization) {
                // In a real implementation, this would create a summary
                context.summary = `Previous messages summarized (${context.currentMessages.length} messages removed)`;
            }
        }
        // Estimate tokens and trim if necessary
        const estimatedTokens = this.estimateTokens(context.currentMessages);
        while (estimatedTokens > context.maxTokens && context.currentMessages.length > 1) {
            context.currentMessages.shift();
        }
    }
    /**
     * Sync conversation across platforms
     */
    async syncConversationAcrossPlatforms(conversation, message) {
        if (!conversation.syncSettings.enabled) {
            return;
        }
        // Delay sync to batch multiple messages
        setTimeout(async () => {
            try {
                for (const platformName of conversation.syncSettings.syncPlatforms) {
                    if (platformName !== message.platform) {
                        const platform = this.platforms.get(platformName);
                        if (platform) {
                            // Send message to other platforms
                            // Implementation would depend on specific sync requirements
                            this.emit('messageSynced', conversation.id, message.id, platformName);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error syncing message across platforms:', error);
            }
        }, conversation.syncSettings.syncDelay);
    }
    /**
     * Propagate stop command to other platforms
     */
    async propagateStopCommand(conversation, stopCommand) {
        for (const platformName of conversation.platforms) {
            if (platformName !== stopCommand.platform) {
                const platform = this.platforms.get(platformName);
                if (platform) {
                    try {
                        // Send stop notification to other platforms
                        // Implementation would depend on platform capabilities
                        this.emit('stopCommandPropagated', stopCommand.id, platformName);
                    }
                    catch (error) {
                        console.error(`Error propagating stop command to ${platformName}:`, error);
                    }
                }
            }
        }
        stopCommand.propagated = true;
    }
    /**
     * Estimate token count for messages
     */
    estimateTokens(messages) {
        // Simple estimation: ~4 characters per token
        let totalChars = 0;
        for (const message of messages) {
            totalChars += message.content.text.length;
        }
        return Math.ceil(totalChars / 4);
    }
    /**
     * Start periodic save timer
     */
    startSaveTimer() {
        this.saveTimer = setInterval(async () => {
            try {
                await this.saveAllConversations();
            }
            catch (error) {
                console.error('Error during periodic save:', error);
            }
        }, this.config.saveInterval);
    }
    /**
     * Save all conversations to disk
     */
    async saveAllConversations() {
        const savePromises = Array.from(this.conversations.values()).map(conversation => this.saveConversation(conversation));
        await Promise.allSettled(savePromises);
    }
    /**
     * Save individual conversation to disk
     */
    async saveConversation(conversation) {
        const filePath = path_1.default.join(this.config.baseDir, `${conversation.id}.json`);
        // Convert Map objects to plain objects for JSON serialization
        const serializable = {
            ...conversation,
            participants: Object.fromEntries(Array.from(conversation.participants.entries()).map(([id, participant]) => [
                id,
                {
                    ...participant,
                    platforms: Object.fromEntries(participant.platforms)
                }
            ])),
            platforms: Array.from(conversation.platforms)
        };
        await fs_1.promises.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
    }
    /**
     * Load conversations from disk
     */
    async loadConversations() {
        try {
            const files = await fs_1.promises.readdir(this.config.baseDir);
            for (const filename of files) {
                if (filename.endsWith('.json')) {
                    try {
                        const filePath = path_1.default.join(this.config.baseDir, filename);
                        const data = await fs_1.promises.readFile(filePath, 'utf-8');
                        const serialized = JSON.parse(data);
                        // Convert back to Map objects
                        const conversation = {
                            ...serialized,
                            participants: new Map(Object.entries(serialized.participants).map(([id, participant]) => [
                                id,
                                {
                                    ...participant,
                                    platforms: new Map(Object.entries(participant.platforms))
                                }
                            ])),
                            platforms: new Set(serialized.platforms)
                        };
                        this.conversations.set(conversation.id, conversation);
                    }
                    catch (error) {
                        console.error(`Error loading conversation from ${filename}:`, error);
                    }
                }
            }
        }
        catch (error) {
            // Directory might not exist yet, which is fine
        }
    }
}
exports.ConversationContextManager = ConversationContextManager;
/**
 * Create a conversation context manager with default configuration
 */
function createConversationContextManager(config = {}) {
    return new ConversationContextManager(config);
}
