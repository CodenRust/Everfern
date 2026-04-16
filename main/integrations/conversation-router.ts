/**
 * Conversation Router for Cross-Platform Sync
 *
 * This module manages unified conversations across multiple platforms,
 * implementing conversation linking and message synchronization with JSON storage.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { IncomingMessage } from './platform-interface';
import { ConversationMessage, ConversationState } from './conversation-context';

/**
 * Conversation link information
 */
export interface ConversationLink {
  /** Unique link ID */
  id: string;
  /** Primary conversation ID (usually the first created) */
  primaryConversationId: string;
  /** Linked conversation IDs from different platforms */
  linkedConversations: Map<string, {
    conversationId: string;
    platform: string;
    chatId: string;
    chatName: string;
    linkedAt: Date;
    active: boolean;
  }>;
  /** Link metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string; // User who created the link
    linkType: 'manual' | 'automatic' | 'suggested';
    description?: string;
    tags: string[];
  };
  /** Sync settings for this link */
  syncSettings: {
    enabled: boolean;
    bidirectional: boolean;
    syncDelay: number;
    conflictResolution: 'timestamp' | 'platform_priority' | 'manual';
    platformPriority: string[]; // Ordered list of platform priorities
    excludeSystemMessages: boolean;
    excludeFileAttachments: boolean;
  };
  /** Link statistics */
  statistics: {
    totalMessagesSynced: number;
    lastSyncTime?: Date;
    syncErrors: number;
    conflictsResolved: number;
  };
}

/**
 * Message sync entry
 */
export interface MessageSyncEntry {
  /** Sync entry ID */
  id: string;
  /** Original message */
  originalMessage: ConversationMessage;
  /** Synced message copies */
  syncedMessages: Map<string, {
    messageId: string;
    platform: string;
    conversationId: string;
    syncedAt: Date;
    syncStatus: 'pending' | 'synced' | 'failed' | 'skipped';
    error?: string;
  }>;
  /** Sync metadata */
  metadata: {
    syncInitiatedAt: Date;
    syncCompletedAt?: Date;
    syncAttempts: number;
    lastAttemptAt?: Date;
  };
}

/**
 * Conversation routing rule
 */
export interface ConversationRoutingRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule conditions */
  conditions: {
    /** Platform patterns to match */
    platformPatterns: string[];
    /** User patterns to match */
    userPatterns: string[];
    /** Message content patterns */
    contentPatterns: string[];
    /** Chat type filters */
    chatTypes: ('private' | 'group' | 'channel')[];
  };
  /** Routing actions */
  actions: {
    /** Auto-link to existing conversation */
    autoLink?: {
      enabled: boolean;
      targetConversationPattern: string;
      confidence: number; // 0-1, minimum confidence to auto-link
    };
    /** Create new conversation link */
    createLink?: {
      enabled: boolean;
      linkType: 'manual' | 'automatic' | 'suggested';
      syncSettings: Partial<ConversationLink['syncSettings']>;
    };
    /** Route to specific platforms */
    routeTo?: {
      platforms: string[];
      conditions: string[];
    };
  };
  /** Rule metadata */
  metadata: {
    createdAt: Date;
    createdBy: string;
    enabled: boolean;
    priority: number;
    description?: string;
  };
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  /** Conflict ID */
  id: string;
  /** Conversation link ID */
  conversationLinkId: string;
  /** Conflicting messages */
  conflictingMessages: ConversationMessage[];
  /** Conflict type */
  type: 'timestamp_collision' | 'content_mismatch' | 'duplicate_message' | 'ordering_conflict';
  /** Conflict details */
  details: {
    detectedAt: Date;
    platforms: string[];
    affectedMessageIds: string[];
    conflictReason: string;
  };
  /** Resolution status */
  resolution: {
    status: 'pending' | 'resolved' | 'ignored';
    method?: 'timestamp' | 'platform_priority' | 'manual' | 'merge';
    resolvedAt?: Date;
    resolvedBy?: string;
    resolution?: string;
  };
}

/**
 * Router configuration
 */
export interface ConversationRouterConfig {
  /** Base directory for conversation links storage */
  baseDir: string;
  /** Default sync delay in milliseconds */
  defaultSyncDelay: number;
  /** Maximum sync retries */
  maxSyncRetries: number;
  /** Sync batch size */
  syncBatchSize: number;
  /** Conflict detection sensitivity */
  conflictDetection: {
    enabled: boolean;
    timestampToleranceMs: number;
    contentSimilarityThreshold: number;
    duplicateDetectionWindow: number;
  };
  /** Auto-linking settings */
  autoLinking: {
    enabled: boolean;
    confidenceThreshold: number;
    maxSuggestionsPerConversation: number;
  };
  /** Performance settings */
  performance: {
    cacheSize: number;
    cacheTtlMs: number;
    batchProcessingInterval: number;
  };
}

/**
 * Main conversation router class
 */
export class ConversationRouter extends EventEmitter {
  private config: ConversationRouterConfig;
  private conversationLinks = new Map<string, ConversationLink>();
  private routingRules = new Map<string, ConversationRoutingRule>();
  private syncQueue: MessageSyncEntry[] = [];
  private syncConflicts = new Map<string, SyncConflict>();
  private linkCache = new Map<string, string>(); // conversationId -> linkId
  private processingTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<ConversationRouterConfig> = {}) {
    super();
    this.config = {
      baseDir: path.join(os.homedir(), '.everfern', 'conversation-links'),
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
  async initialize(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to initialize ConversationRouter:', error);
      throw error;
    }
  }

  /**
   * Shutdown the conversation router
   */
  async shutdown(): Promise<void> {
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
    } catch (error) {
      console.error('Error during ConversationRouter shutdown:', error);
      throw error;
    }
  }

  /**
   * Create a conversation link between multiple platforms
   */
  async createConversationLink(
    conversations: Array<{
      conversationId: string;
      platform: string;
      chatId: string;
      chatName: string;
    }>,
    createdBy: string,
    linkType: ConversationLink['metadata']['linkType'] = 'manual',
    syncSettings?: Partial<ConversationLink['syncSettings']>
  ): Promise<string> {
    if (conversations.length < 2) {
      throw new Error('At least 2 conversations required to create a link');
    }

    const linkId = `link_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const primaryConversationId = conversations[0].conversationId;

    const conversationLink: ConversationLink = {
      id: linkId,
      primaryConversationId,
      linkedConversations: new Map(
        conversations.map(conv => [conv.conversationId, {
          conversationId: conv.conversationId,
          platform: conv.platform,
          chatId: conv.chatId,
          chatName: conv.chatName,
          linkedAt: new Date(),
          active: true
        }])
      ),
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
  async routeMessage(message: ConversationMessage): Promise<void> {
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
    } catch (error) {
      console.error('Error routing message:', error);
      this.emit('routingError', message, error);
    }
  }

  /**
   * Get conversation link by ID
   */
  getConversationLink(linkId: string): ConversationLink | undefined {
    return this.conversationLinks.get(linkId);
  }

  /**
   * Get conversation link by conversation ID
   */
  getConversationLinkByConversationId(conversationId: string): ConversationLink | undefined {
    const linkId = this.linkCache.get(conversationId);
    return linkId ? this.conversationLinks.get(linkId) : undefined;
  }

  /**
   * Get all conversation links
   */
  getAllConversationLinks(): ConversationLink[] {
    return Array.from(this.conversationLinks.values());
  }

  /**
   * Update conversation link settings
   */
  async updateConversationLink(
    linkId: string,
    updates: {
      syncSettings?: Partial<ConversationLink['syncSettings']>;
      metadata?: Partial<ConversationLink['metadata']>;
    }
  ): Promise<boolean> {
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
  async removeConversationLink(linkId: string): Promise<boolean> {
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
  async addRoutingRule(rule: Omit<ConversationRoutingRule, 'id' | 'metadata'>): Promise<string> {
    const ruleId = `rule_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const routingRule: ConversationRoutingRule = {
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
  getSyncConflicts(status?: SyncConflict['resolution']['status']): SyncConflict[] {
    const conflicts = Array.from(this.syncConflicts.values());
    return status ? conflicts.filter(c => c.resolution.status === status) : conflicts;
  }

  /**
   * Resolve a sync conflict
   */
  async resolveSyncConflict(
    conflictId: string,
    resolution: SyncConflict['resolution']['method'],
    resolvedBy: string
  ): Promise<boolean> {
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
  getSyncStatistics(): {
    totalLinks: number;
    activeLinks: number;
    totalMessagesSynced: number;
    pendingSyncItems: number;
    syncErrors: number;
    unresolvedConflicts: number;
  } {
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
  private async createSyncEntry(
    message: ConversationMessage,
    link: ConversationLink
  ): Promise<MessageSyncEntry> {
    const syncId = `sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Determine target conversations (exclude source)
    const targetConversations = Array.from(link.linkedConversations.entries())
      .filter(([convId]) => convId !== message.conversationId &&
                            link.linkedConversations.get(convId)?.active);

    const syncEntry: MessageSyncEntry = {
      id: syncId,
      originalMessage: message,
      syncedMessages: new Map(
        targetConversations.map(([convId, conv]) => [convId, {
          messageId: '',
          platform: conv.platform,
          conversationId: convId,
          syncedAt: new Date(),
          syncStatus: 'pending'
        }])
      ),
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
  private async checkRoutingRules(message: ConversationMessage): Promise<void> {
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
  private isRuleApplicable(rule: ConversationRoutingRule, message: ConversationMessage): boolean {
    const conditions = rule.conditions;

    // Check platform patterns
    if (conditions.platformPatterns.length > 0) {
      const matches = conditions.platformPatterns.some(pattern =>
        new RegExp(pattern).test(message.platform)
      );
      if (!matches) return false;
    }

    // Check user patterns
    if (conditions.userPatterns.length > 0) {
      const matches = conditions.userPatterns.some(pattern =>
        new RegExp(pattern).test(message.sender.userId)
      );
      if (!matches) return false;
    }

    // Check content patterns
    if (conditions.contentPatterns.length > 0) {
      const matches = conditions.contentPatterns.some(pattern =>
        new RegExp(pattern).test(message.content.text)
      );
      if (!matches) return false;
    }

    return true;
  }

  /**
   * Process auto-link rule
   */
  private async processAutoLinkRule(
    rule: ConversationRoutingRule,
    message: ConversationMessage
  ): Promise<void> {
    // Implementation would find matching conversations and create links
    // This is a simplified version
    this.emit('autoLinkSuggestion', rule, message);
  }

  /**
   * Process create link rule
   */
  private async processCreateLinkRule(
    rule: ConversationRoutingRule,
    message: ConversationMessage
  ): Promise<void> {
    // Implementation would create new conversation links based on rule
    // This is a simplified version
    this.emit('createLinkSuggestion', rule, message);
  }

  /**
   * Start processing timer
   */
  private startProcessingTimer(): void {
    this.processingTimer = setInterval(async () => {
      try {
        await this.processSyncQueue();
      } catch (error) {
        console.error('Error processing sync queue:', error);
      }
    }, this.config.performance.batchProcessingInterval);
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    const batch = this.syncQueue.splice(0, this.config.syncBatchSize);

    for (const syncEntry of batch) {
      try {
        await this.processSyncEntry(syncEntry);
      } catch (error) {
        console.error('Error processing sync entry:', error);
        syncEntry.metadata.syncAttempts++;

        if (syncEntry.metadata.syncAttempts < this.config.maxSyncRetries) {
          // Re-queue for retry
          this.syncQueue.push(syncEntry);
        } else {
          this.emit('syncEntryFailed', syncEntry, error);
        }
      }
    }
  }

  /**
   * Process individual sync entry
   */
  private async processSyncEntry(syncEntry: MessageSyncEntry): Promise<void> {
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
      } catch (error) {
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
  private async detectConflicts(syncEntry: MessageSyncEntry): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

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
      const conflictId = `conflict_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

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
  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.baseDir,
      path.join(this.config.baseDir, 'links'),
      path.join(this.config.baseDir, 'rules'),
      path.join(this.config.baseDir, 'conflicts')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Save conversation links to disk
   */
  private async saveConversationLinks(): Promise<void> {
    const filePath = path.join(this.config.baseDir, 'links', 'conversation-links.json');

    // Convert Map objects to plain objects for JSON serialization
    const serializable = Array.from(this.conversationLinks.values()).map(link => ({
      ...link,
      linkedConversations: Object.fromEntries(link.linkedConversations)
    }));

    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
  }

  /**
   * Load conversation links from disk
   */
  private async loadConversationLinks(): Promise<void> {
    try {
      const filePath = path.join(this.config.baseDir, 'links', 'conversation-links.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const serialized = JSON.parse(data);

      this.conversationLinks.clear();
      this.linkCache.clear();

      for (const linkData of serialized) {
        const link: ConversationLink = {
          ...linkData,
          linkedConversations: new Map(Object.entries(linkData.linkedConversations))
        };

        this.conversationLinks.set(link.id, link);

        // Update cache
        for (const [conversationId] of link.linkedConversations) {
          this.linkCache.set(conversationId, link.id);
        }
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Save routing rules to disk
   */
  private async saveRoutingRules(): Promise<void> {
    const filePath = path.join(this.config.baseDir, 'rules', 'routing-rules.json');
    const rules = Array.from(this.routingRules.values());
    await fs.writeFile(filePath, JSON.stringify(rules, null, 2), 'utf-8');
  }

  /**
   * Load routing rules from disk
   */
  private async loadRoutingRules(): Promise<void> {
    try {
      const filePath = path.join(this.config.baseDir, 'rules', 'routing-rules.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const rules: ConversationRoutingRule[] = JSON.parse(data);

      this.routingRules.clear();
      for (const rule of rules) {
        this.routingRules.set(rule.id, rule);
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }

  /**
   * Save sync conflicts to disk
   */
  private async saveSyncConflicts(): Promise<void> {
    const filePath = path.join(this.config.baseDir, 'conflicts', 'sync-conflicts.json');
    const conflicts = Array.from(this.syncConflicts.values());
    await fs.writeFile(filePath, JSON.stringify(conflicts, null, 2), 'utf-8');
  }

  /**
   * Load sync conflicts from disk
   */
  private async loadSyncConflicts(): Promise<void> {
    try {
      const filePath = path.join(this.config.baseDir, 'conflicts', 'sync-conflicts.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const conflicts: SyncConflict[] = JSON.parse(data);

      this.syncConflicts.clear();
      for (const conflict of conflicts) {
        this.syncConflicts.set(conflict.id, conflict);
      }
    } catch (error) {
      // File might not exist yet, which is fine
    }
  }
}

/**
 * Create a conversation router with default configuration
 */
export function createConversationRouter(
  config: Partial<ConversationRouterConfig> = {}
): ConversationRouter {
  return new ConversationRouter(config);
}
