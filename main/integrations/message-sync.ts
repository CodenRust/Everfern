/**
 * Cross-Platform Message Synchronization
 *
 * This module implements real-time conversation state synchronization across
 * platforms, handling concurrent message conflicts and conversation export.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { ConversationMessage, ConversationState } from './conversation-context';
import { ConversationLink, ConversationRouter } from './conversation-router';
import { MessagePlatform } from './platform-interface';

/**
 * Sync state for a conversation
 */
export interface ConversationSyncState {
  /** Conversation ID */
  conversationId: string;
  /** Platform name */
  platform: string;
  /** Last synchronized message timestamp */
  lastSyncTimestamp: Date;
  /** Last synchronized message ID */
  lastSyncMessageId: string;
  /** Sync status */
  status: 'synced' | 'syncing' | 'error' | 'paused';
  /** Pending messages to sync */
  pendingMessages: ConversationMessage[];
  /** Sync statistics */
  statistics: {
    totalMessagesSynced: number;
    lastSyncTime: Date;
    syncErrors: number;
    averageSyncDelay: number;
  };
  /** Error information */
  lastError?: {
    message: string;
    timestamp: Date;
    retryCount: number;
  };
}

/**
 * Message conflict information
 */
export interface MessageConflict {
  /** Conflict ID */
  id: string;
  /** Conversation link ID */
  conversationLinkId: string;
  /** Conflicting messages */
  messages: ConversationMessage[];
  /** Conflict type */
  type: 'timestamp_order' | 'duplicate_content' | 'concurrent_edit' | 'platform_specific';
  /** Conflict resolution strategy */
  resolution: {
    strategy: 'timestamp_priority' | 'platform_priority' | 'content_merge' | 'manual';
    resolvedMessage?: ConversationMessage;
    resolvedAt?: Date;
    resolvedBy?: string;
  };
  /** Conflict metadata */
  metadata: {
    detectedAt: Date;
    platforms: string[];
    severity: 'low' | 'medium' | 'high';
    autoResolvable: boolean;
  };
}

/**
 * Conversation export format
 */
export interface ConversationExport {
  /** Export metadata */
  metadata: {
    exportId: string;
    conversationId: string;
    conversationLinkId?: string;
    exportedAt: Date;
    exportedBy: string;
    format: 'json' | 'markdown' | 'html' | 'csv';
    includeAttachments: boolean;
    platforms: string[];
  };
  /** Conversation information */
  conversation: {
    id: string;
    title: string;
    participants: Array<{
      userId: string;
      displayName: string;
      platforms: string[];
    }>;
    createdAt: Date;
    messageCount: number;
    platforms: string[];
  };
  /** Messages */
  messages: Array<{
    id: string;
    timestamp: Date;
    platform: string;
    sender: {
      userId: string;
      displayName: string;
    };
    content: {
      text: string;
      files: Array<{
        name: string;
        mimeType: string;
        size: number;
        exportPath?: string;
      }>;
    };
    metadata: Record<string, any>;
  }>;
  /** Sync information */
  syncInfo?: {
    linkedConversations: string[];
    syncConflicts: MessageConflict[];
    lastSyncTime: Date;
  };
}

/**
 * Sync configuration
 */
export interface MessageSyncConfig {
  /** Base directory for sync data */
  baseDir: string;
  /** Real-time sync settings */
  realTimeSync: {
    enabled: boolean;
    syncInterval: number;
    batchSize: number;
    maxRetries: number;
  };
  /** Conflict resolution settings */
  conflictResolution: {
    timestampToleranceMs: number;
    contentSimilarityThreshold: number;
    autoResolveConflicts: boolean;
    preferredPlatformOrder: string[];
  };
  /** Export settings */
  export: {
    maxExportSize: number;
    includeAttachmentsByDefault: boolean;
    defaultFormat: ConversationExport['metadata']['format'];
    compressionEnabled: boolean;
  };
  /** Performance settings */
  performance: {
    maxConcurrentSyncs: number;
    syncQueueSize: number;
    cacheSize: number;
    cacheTtlMs: number;
  };
}

/**
 * Main message synchronization service
 */
export class MessageSyncService extends EventEmitter {
  private config: MessageSyncConfig;
  private conversationRouter: ConversationRouter;
  private platforms = new Map<string, MessagePlatform>();
  private syncStates = new Map<string, ConversationSyncState>();
  private messageConflicts = new Map<string, MessageConflict>();
  private syncQueue: Array<{
    message: ConversationMessage;
    targetConversations: string[];
    priority: number;
  }> = [];
  private activeSyncs = new Set<string>();
  private syncTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(
    conversationRouter: ConversationRouter,
    config: Partial<MessageSyncConfig> = {}
  ) {
    super();
    this.conversationRouter = conversationRouter;
    this.config = {
      baseDir: path.join(os.homedir(), '.everfern', 'message-sync'),
      realTimeSync: {
        enabled: true,
        syncInterval: 1000, // 1 second
        batchSize: 10,
        maxRetries: 3
      },
      conflictResolution: {
        timestampToleranceMs: 5000, // 5 seconds
        contentSimilarityThreshold: 0.9,
        autoResolveConflicts: true,
        preferredPlatformOrder: ['telegram', 'discord', 'slack']
      },
      export: {
        maxExportSize: 100 * 1024 * 1024, // 100MB
        includeAttachmentsByDefault: false,
        defaultFormat: 'json',
        compressionEnabled: true
      },
      performance: {
        maxConcurrentSyncs: 5,
        syncQueueSize: 1000,
        cacheSize: 500,
        cacheTtlMs: 300000 // 5 minutes
      },
      ...config
    };
  }

  /**
   * Initialize the message sync service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create base directory
      await fs.mkdir(this.config.baseDir, { recursive: true });

      // Load existing sync states
      await this.loadSyncStates();
      await this.loadMessageConflicts();

      // Set up conversation router event handlers
      this.setupRouterEventHandlers();

      // Start sync timer if real-time sync is enabled
      if (this.config.realTimeSync.enabled) {
        this.startSyncTimer();
      }

      this.isInitialized = true;
      this.emit('initialized');

      console.log('MessageSyncService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MessageSyncService:', error);
      throw error;
    }
  }

  /**
   * Shutdown the message sync service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop sync timer
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }

      // Wait for active syncs to complete
      await this.waitForActiveSyncs();

      // Save data
      await this.saveSyncStates();
      await this.saveMessageConflicts();

      // Clear memory
      this.syncStates.clear();
      this.messageConflicts.clear();
      this.syncQueue.length = 0;
      this.activeSyncs.clear();
      this.platforms.clear();

      this.isInitialized = false;
      this.emit('shutdown');

      console.log('MessageSyncService shutdown successfully');
    } catch (error) {
      console.error('Error during MessageSyncService shutdown:', error);
      throw error;
    }
  }

  /**
   * Register a platform for message synchronization
   */
  registerPlatform(name: string, platform: MessagePlatform): void {
    this.platforms.set(name, platform);
    this.emit('platformRegistered', name);
  }

  /**
   * Synchronize a message across linked conversations
   */
  async syncMessage(message: ConversationMessage): Promise<void> {
    try {
      // Get conversation link
      const link = this.conversationRouter.getConversationLinkByConversationId(message.conversationId);
      if (!link || !link.syncSettings.enabled) {
        return;
      }

      // Get target conversations
      const targetConversations = Array.from(link.linkedConversations.keys())
        .filter(convId => convId !== message.conversationId);

      if (targetConversations.length === 0) {
        return;
      }

      // Check for conflicts
      const conflicts = await this.detectMessageConflicts(message, link);
      if (conflicts.length > 0) {
        for (const conflict of conflicts) {
          this.messageConflicts.set(conflict.id, conflict);
          this.emit('messageConflictDetected', conflict);
        }

        if (!this.config.conflictResolution.autoResolveConflicts) {
          return; // Wait for manual resolution
        }

        // Auto-resolve conflicts
        for (const conflict of conflicts) {
          await this.resolveMessageConflict(conflict.id);
        }
      }

      // Add to sync queue
      this.addToSyncQueue(message, targetConversations);

    } catch (error) {
      console.error('Error syncing message:', error);
      this.emit('messageSyncError', message, error);
    }
  }

  /**
   * Get sync state for a conversation
   */
  getSyncState(conversationId: string): ConversationSyncState | undefined {
    return this.syncStates.get(conversationId);
  }

  /**
   * Update sync state for a conversation
   */
  async updateSyncState(
    conversationId: string,
    updates: Partial<ConversationSyncState>
  ): Promise<void> {
    let syncState = this.syncStates.get(conversationId);

    if (!syncState) {
      syncState = {
        conversationId,
        platform: updates.platform || 'unknown',
        lastSyncTimestamp: new Date(0),
        lastSyncMessageId: '',
        status: 'synced',
        pendingMessages: [],
        statistics: {
          totalMessagesSynced: 0,
          lastSyncTime: new Date(),
          syncErrors: 0,
          averageSyncDelay: 0
        }
      };
    }

    // Apply updates
    Object.assign(syncState, updates);
    this.syncStates.set(conversationId, syncState);

    await this.saveSyncStates();
    this.emit('syncStateUpdated', syncState);
  }

  /**
   * Export conversation with sync information
   */
  async exportConversation(
    conversationId: string,
    options: {
      format?: ConversationExport['metadata']['format'];
      includeAttachments?: boolean;
      includeSyncInfo?: boolean;
      exportedBy: string;
    }
  ): Promise<ConversationExport> {
    const exportId = `export_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const link = this.conversationRouter.getConversationLinkByConversationId(conversationId);

    // This is a simplified implementation - in reality, this would fetch
    // actual conversation data from the conversation context manager
    const conversationExport: ConversationExport = {
      metadata: {
        exportId,
        conversationId,
        conversationLinkId: link?.id,
        exportedAt: new Date(),
        exportedBy: options.exportedBy,
        format: options.format || this.config.export.defaultFormat,
        includeAttachments: options.includeAttachments || false,
        platforms: link ? Array.from(link.linkedConversations.values()).map(c => c.platform) : []
      },
      conversation: {
        id: conversationId,
        title: `Conversation ${conversationId}`,
        participants: [],
        createdAt: new Date(),
        messageCount: 0,
        platforms: []
      },
      messages: []
    };

    // Add sync information if requested
    if (options.includeSyncInfo && link) {
      conversationExport.syncInfo = {
        linkedConversations: Array.from(link.linkedConversations.keys()),
        syncConflicts: Array.from(this.messageConflicts.values())
          .filter(conflict => conflict.conversationLinkId === link.id),
        lastSyncTime: new Date()
      };
    }

    this.emit('conversationExported', conversationExport);
    return conversationExport;
  }

  /**
   * Get message conflicts
   */
  getMessageConflicts(conversationLinkId?: string): MessageConflict[] {
    const conflicts = Array.from(this.messageConflicts.values());
    return conversationLinkId
      ? conflicts.filter(c => c.conversationLinkId === conversationLinkId)
      : conflicts;
  }

  /**
   * Resolve a message conflict
   */
  async resolveMessageConflict(
    conflictId: string,
    strategy?: MessageConflict['resolution']['strategy'],
    resolvedBy?: string
  ): Promise<boolean> {
    const conflict = this.messageConflicts.get(conflictId);
    if (!conflict) {
      return false;
    }

    try {
      const resolutionStrategy = strategy || this.determineResolutionStrategy(conflict);
      const resolvedMessage = await this.applyResolutionStrategy(conflict, resolutionStrategy);

      conflict.resolution = {
        strategy: resolutionStrategy,
        resolvedMessage,
        resolvedAt: new Date(),
        resolvedBy
      };

      await this.saveMessageConflicts();
      this.emit('messageConflictResolved', conflict);

      return true;
    } catch (error) {
      console.error('Error resolving message conflict:', error);
      return false;
    }
  }

  /**
   * Get synchronization statistics
   */
  getSyncStatistics(): {
    totalConversations: number;
    activeSyncs: number;
    pendingMessages: number;
    totalConflicts: number;
    unresolvedConflicts: number;
    averageSyncDelay: number;
  } {
    const totalConversations = this.syncStates.size;
    const activeSyncs = this.activeSyncs.size;
    const pendingMessages = Array.from(this.syncStates.values())
      .reduce((sum, state) => sum + state.pendingMessages.length, 0);
    const totalConflicts = this.messageConflicts.size;
    const unresolvedConflicts = Array.from(this.messageConflicts.values())
      .filter(conflict => !conflict.resolution.resolvedAt).length;
    const averageSyncDelay = Array.from(this.syncStates.values())
      .reduce((sum, state) => sum + state.statistics.averageSyncDelay, 0) / totalConversations || 0;

    return {
      totalConversations,
      activeSyncs,
      pendingMessages,
      totalConflicts,
      unresolvedConflicts,
      averageSyncDelay
    };
  }

  /**
   * Detect message conflicts
   */
  private async detectMessageConflicts(
    message: ConversationMessage,
    link: ConversationLink
  ): Promise<MessageConflict[]> {
    const conflicts: MessageConflict[] = [];

    // Check for timestamp conflicts
    const timestampConflicts = await this.detectTimestampConflicts(message, link);
    conflicts.push(...timestampConflicts);

    // Check for content conflicts
    const contentConflicts = await this.detectContentConflicts(message, link);
    conflicts.push(...contentConflicts);

    return conflicts;
  }

  /**
   * Detect timestamp conflicts
   */
  private async detectTimestampConflicts(
    message: ConversationMessage,
    link: ConversationLink
  ): Promise<MessageConflict[]> {
    const conflicts: MessageConflict[] = [];
    const tolerance = this.config.conflictResolution.timestampToleranceMs;

    // This is a simplified implementation
    // In reality, this would check against recent messages in linked conversations

    return conflicts;
  }

  /**
   * Detect content conflicts
   */
  private async detectContentConflicts(
    message: ConversationMessage,
    link: ConversationLink
  ): Promise<MessageConflict[]> {
    const conflicts: MessageConflict[] = [];
    const threshold = this.config.conflictResolution.contentSimilarityThreshold;

    // This is a simplified implementation
    // In reality, this would check for similar content in recent messages

    return conflicts;
  }

  /**
   * Determine resolution strategy for a conflict
   */
  private determineResolutionStrategy(conflict: MessageConflict): MessageConflict['resolution']['strategy'] {
    switch (conflict.type) {
      case 'timestamp_order':
        return 'timestamp_priority';
      case 'duplicate_content':
        return 'content_merge';
      case 'concurrent_edit':
        return 'platform_priority';
      case 'platform_specific':
        return 'platform_priority';
      default:
        return 'timestamp_priority';
    }
  }

  /**
   * Apply resolution strategy to conflict
   */
  private async applyResolutionStrategy(
    conflict: MessageConflict,
    strategy: MessageConflict['resolution']['strategy']
  ): Promise<ConversationMessage> {
    const messages = conflict.messages;

    switch (strategy) {
      case 'timestamp_priority':
        return messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

      case 'platform_priority':
        const platformOrder = this.config.conflictResolution.preferredPlatformOrder;
        for (const platform of platformOrder) {
          const message = messages.find(m => m.platform === platform);
          if (message) return message;
        }
        return messages[0];

      case 'content_merge':
        // Simplified merge - in reality this would be more sophisticated
        const mergedMessage = { ...messages[0] };
        mergedMessage.content.text = messages.map(m => m.content.text).join(' | ');
        return mergedMessage;

      default:
        return messages[0];
    }
  }

  /**
   * Add message to sync queue
   */
  private addToSyncQueue(
    message: ConversationMessage,
    targetConversations: string[],
    priority = 0
  ): void {
    if (this.syncQueue.length >= this.config.performance.syncQueueSize) {
      // Remove oldest low-priority item
      const oldestIndex = this.syncQueue.findIndex(item => item.priority <= priority);
      if (oldestIndex !== -1) {
        this.syncQueue.splice(oldestIndex, 1);
      } else {
        return; // Queue full with higher priority items
      }
    }

    this.syncQueue.push({
      message,
      targetConversations,
      priority
    });

    this.syncQueue.sort((a, b) => b.priority - a.priority);
    this.emit('messageQueuedForSync', message, targetConversations);
  }

  /**
   * Set up conversation router event handlers
   */
  private setupRouterEventHandlers(): void {
    this.conversationRouter.on('messageQueued', (message, linkId) => {
      // Message was queued by router, we can process it for sync
      this.emit('messageReceivedForSync', message, linkId);
    });

    this.conversationRouter.on('conversationLinkCreated', (link) => {
      // Initialize sync states for new link
      for (const [convId, conv] of link.linkedConversations) {
        this.updateSyncState(convId, {
          platform: conv.platform,
          status: 'synced'
        });
      }
    });
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    this.syncTimer = setInterval(async () => {
      try {
        await this.processSyncQueue();
      } catch (error) {
        console.error('Error processing sync queue:', error);
      }
    }, this.config.realTimeSync.syncInterval);
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0 ||
        this.activeSyncs.size >= this.config.performance.maxConcurrentSyncs) {
      return;
    }

    const batch = this.syncQueue.splice(0, this.config.realTimeSync.batchSize);

    for (const syncItem of batch) {
      if (this.activeSyncs.size >= this.config.performance.maxConcurrentSyncs) {
        // Re-queue remaining items
        this.syncQueue.unshift(...batch.slice(batch.indexOf(syncItem)));
        break;
      }

      this.processSyncItem(syncItem);
    }
  }

  /**
   * Process individual sync item
   */
  private async processSyncItem(syncItem: {
    message: ConversationMessage;
    targetConversations: string[];
    priority: number;
  }): Promise<void> {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeSyncs.add(syncId);

    try {
      for (const targetConvId of syncItem.targetConversations) {
        await this.syncMessageToConversation(syncItem.message, targetConvId);
      }

      this.emit('messageSyncCompleted', syncItem.message, syncItem.targetConversations);
    } catch (error) {
      console.error('Error processing sync item:', error);
      this.emit('messageSyncFailed', syncItem.message, error);
    } finally {
      this.activeSyncs.delete(syncId);
    }
  }

  /**
   * Sync message to specific conversation
   */
  private async syncMessageToConversation(
    message: ConversationMessage,
    targetConversationId: string
  ): Promise<void> {
    // Update sync state
    await this.updateSyncState(targetConversationId, {
      status: 'syncing',
      lastSyncTimestamp: new Date()
    });

    try {
      // In a real implementation, this would send the message to the target platform
      // For now, we'll simulate successful sync

      const syncState = this.syncStates.get(targetConversationId);
      if (syncState) {
        syncState.statistics.totalMessagesSynced++;
        syncState.statistics.lastSyncTime = new Date();
        syncState.lastSyncMessageId = message.id;
        syncState.status = 'synced';
      }

      this.emit('messagesSyncedToConversation', message, targetConversationId);
    } catch (error) {
      // Update sync state with error
      await this.updateSyncState(targetConversationId, {
        status: 'error',
        lastError: {
          message: String(error),
          timestamp: new Date(),
          retryCount: 0
        }
      });
      throw error;
    }
  }

  /**
   * Wait for active syncs to complete
   */
  private async waitForActiveSyncs(timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.activeSyncs.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Save sync states to disk
   */
  private async saveSyncStates(): Promise<void> {
    const filePath = path.join(this.config.baseDir, 'sync-states.json');
    const states = Array.from(this.syncStates.values());
    await fs.writeFile(filePath, JSON.stringify(states, null, 2), 'utf-8');
  }

  /**
   * Load sync states from disk
   */
  private async loadSyncStates(): Promise<void> {
    try {
      const filePath = path.join(this.config.baseDir, 'sync-states.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const states: ConversationSyncState[] = JSON.parse(data);

      this.syncStates.clear();
      for (const state of states) {
        this.syncStates.set(state.conversationId, state);
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Save message conflicts to disk
   */
  private async saveMessageConflicts(): Promise<void> {
    const filePath = path.join(this.config.baseDir, 'message-conflicts.json');
    const conflicts = Array.from(this.messageConflicts.values());
    await fs.writeFile(filePath, JSON.stringify(conflicts, null, 2), 'utf-8');
  }

  /**
   * Load message conflicts from disk
   */
  private async loadMessageConflicts(): Promise<void> {
    try {
      const filePath = path.join(this.config.baseDir, 'message-conflicts.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const conflicts: MessageConflict[] = JSON.parse(data);

      this.messageConflicts.clear();
      for (const conflict of conflicts) {
        this.messageConflicts.set(conflict.id, conflict);
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }
}

/**
 * Create a message sync service with default configuration
 */
export function createMessageSyncService(
  conversationRouter: ConversationRouter,
  config: Partial<MessageSyncConfig> = {}
): MessageSyncService {
  return new MessageSyncService(conversationRouter, config);
}
