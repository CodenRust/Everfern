/**
 * Platform-Specific Content Adaptation
 *
 * This module handles message formatting conversion between platforms,
 * platform-specific features, and content adaptation for cross-platform compatibility.
 */

import { ConversationMessage } from './conversation-context';
import { PlatformFile } from './platform-interface';

/**
 * Platform capabilities and limitations
 */
export interface PlatformCapabilities {
  /** Platform name */
  platform: string;
  /** Message formatting capabilities */
  formatting: {
    /** Supported markup formats */
    supportedMarkup: ('markdown' | 'html' | 'bbcode' | 'plain')[];
    /** Maximum message length */
    maxMessageLength: number;
    /** Supports rich text formatting */
    supportsRichText: boolean;
    /** Supports code blocks */
    supportsCodeBlocks: boolean;
    /** Supports inline code */
    supportsInlineCode: boolean;
    /** Supports links */
    supportsLinks: boolean;
    /** Supports mentions */
    supportsMentions: boolean;
    /** Supports emojis */
    supportsEmojis: boolean;
    /** Custom emoji support */
    supportsCustomEmojis: boolean;
  };
  /** File and media capabilities */
  media: {
    /** Maximum file size in bytes */
    maxFileSize: number;
    /** Supported file types */
    supportedFileTypes: string[];
    /** Supports inline images */
    supportsInlineImages: boolean;
    /** Supports image galleries */
    supportsImageGalleries: boolean;
    /** Supports video */
    supportsVideo: boolean;
    /** Supports audio */
    supportsAudio: boolean;
    /** Supports voice messages */
    supportsVoiceMessages: boolean;
    /** Maximum number of attachments per message */
    maxAttachmentsPerMessage: number;
  };
  /** Interactive features */
  interactive: {
    /** Supports message reactions */
    supportsReactions: boolean;
    /** Supports message replies */
    supportsReplies: boolean;
    /** Supports message threading */
    supportsThreading: boolean;
    /** Supports message editing */
    supportsEditing: boolean;
    /** Supports message deletion */
    supportsDeletion: boolean;
    /** Supports polls */
    supportsPolls: boolean;
    /** Supports buttons/inline keyboards */
    supportsButtons: boolean;
  };
  /** Platform-specific features */
  platformSpecific: {
    /** Supports embeds (Discord) */
    supportsEmbeds?: boolean;
    /** Supports stickers (Telegram) */
    supportsStickers?: boolean;
    /** Supports GIFs */
    supportsGifs?: boolean;
    /** Supports location sharing */
    supportsLocation?: boolean;
    /** Supports contact sharing */
    supportsContacts?: boolean;
    /** Custom features */
    customFeatures: Record<string, any>;
  };
}

/**
 * Content adaptation result
 */
export interface AdaptedContent {
  /** Adapted text content */
  text: string;
  /** Adapted file attachments */
  files: PlatformFile[];
  /** Platform-specific metadata */
  platformMetadata: Record<string, any>;
  /** Adaptation warnings */
  warnings: string[];
  /** Features that were removed/modified */
  modifications: Array<{
    type: 'removed' | 'modified' | 'converted';
    feature: string;
    reason: string;
    originalValue?: any;
    newValue?: any;
  }>;
}

/**
 * Content adaptation options
 */
export interface AdaptationOptions {
  /** Target platform */
  targetPlatform: string;
  /** Source platform */
  sourcePlatform: string;
  /** Preserve formatting when possible */
  preserveFormatting: boolean;
  /** Fallback to plain text if formatting not supported */
  fallbackToPlainText: boolean;
  /** Convert unsupported files */
  convertUnsupportedFiles: boolean;
  /** Maximum message length override */
  maxLength?: number;
  /** Custom adaptation rules */
  customRules?: Array<{
    pattern: RegExp;
    replacement: string | ((match: string) => string);
  }>;
}

/**
 * Platform-specific content adapter
 */
export abstract class PlatformContentAdapter {
  protected capabilities: PlatformCapabilities;

  constructor(capabilities: PlatformCapabilities) {
    this.capabilities = capabilities;
  }

  /**
   * Adapt content for this platform
   */
  abstract adaptContent(
    message: ConversationMessage,
    options: AdaptationOptions
  ): Promise<AdaptedContent>;

  /**
   * Get platform capabilities
   */
  getCapabilities(): PlatformCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Check if feature is supported
   */
  supportsFeature(feature: string): boolean {
    // This would check various capability flags based on feature name
    return true; // Simplified implementation
  }
}

/**
 * Telegram content adapter
 */
export class TelegramContentAdapter extends PlatformContentAdapter {
  constructor() {
    super({
      platform: 'telegram',
      formatting: {
        supportedMarkup: ['markdown', 'html'],
        maxMessageLength: 4096,
        supportsRichText: true,
        supportsCodeBlocks: true,
        supportsInlineCode: true,
        supportsLinks: true,
        supportsMentions: true,
        supportsEmojis: true,
        supportsCustomEmojis: false
      },
      media: {
        maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
        supportedFileTypes: ['*'], // Supports all file types
        supportsInlineImages: true,
        supportsImageGalleries: true,
        supportsVideo: true,
        supportsAudio: true,
        supportsVoiceMessages: true,
        maxAttachmentsPerMessage: 10
      },
      interactive: {
        supportsReactions: true,
        supportsReplies: true,
        supportsThreading: false,
        supportsEditing: true,
        supportsDeletion: true,
        supportsPolls: true,
        supportsButtons: true
      },
      platformSpecific: {
        supportsStickers: true,
        supportsGifs: true,
        supportsLocation: true,
        supportsContacts: true,
        customFeatures: {
          inlineKeyboards: true,
          botCommands: true,
          channels: true,
          supergroups: true
        }
      }
    });
  }

  async adaptContent(
    message: ConversationMessage,
    options: AdaptationOptions
  ): Promise<AdaptedContent> {
    const warnings: string[] = [];
    const modifications: AdaptedContent['modifications'] = [];
    let adaptedText = message.content.text;
    const adaptedFiles: PlatformFile[] = message.content.files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: 0, // Size not available in ConversationMessage
      url: file.localPath || '' // Use localPath as URL
    }));

    // Convert from other platforms to Telegram format
    if (options.sourcePlatform === 'discord') {
      adaptedText = this.convertFromDiscord(adaptedText, warnings, modifications);
    }

    // Apply Telegram-specific formatting
    adaptedText = this.applyTelegramFormatting(adaptedText, options);

    // Handle file size limits
    const finalAdaptedFiles = await this.adaptFiles(adaptedFiles, warnings, modifications);

    // Truncate if too long
    if (adaptedText.length > this.capabilities.formatting.maxMessageLength) {
      const truncated = adaptedText.substring(0, this.capabilities.formatting.maxMessageLength - 3) + '...';
      modifications.push({
        type: 'modified',
        feature: 'message_length',
        reason: 'Exceeded maximum length',
        originalValue: adaptedText.length,
        newValue: truncated.length
      });
      adaptedText = truncated;
    }

    return {
      text: adaptedText,
      files: finalAdaptedFiles,
      platformMetadata: {
        parseMode: 'MarkdownV2',
        disableWebPagePreview: false
      },
      warnings,
      modifications
    };
  }

  private convertFromDiscord(
    text: string,
    warnings: string[],
    modifications: AdaptedContent['modifications']
  ): string {
    let converted = text;

    // Convert Discord mentions to Telegram format
    converted = converted.replace(/<@!?(\d+)>/g, (match, userId) => {
      modifications.push({
        type: 'converted',
        feature: 'user_mention',
        reason: 'Discord mention format not supported',
        originalValue: match,
        newValue: `@user_${userId}`
      });
      return `@user_${userId}`;
    });

    // Convert Discord channel mentions
    converted = converted.replace(/<#(\d+)>/g, (match, channelId) => {
      modifications.push({
        type: 'converted',
        feature: 'channel_mention',
        reason: 'Discord channel mention not supported',
        originalValue: match,
        newValue: `#channel_${channelId}`
      });
      return `#channel_${channelId}`;
    });

    // Convert Discord custom emojis
    converted = converted.replace(/<a?:(\w+):(\d+)>/g, (match, name, id) => {
      modifications.push({
        type: 'converted',
        feature: 'custom_emoji',
        reason: 'Discord custom emoji not supported',
        originalValue: match,
        newValue: `:${name}:`
      });
      return `:${name}:`;
    });

    return converted;
  }

  private applyTelegramFormatting(text: string, options: AdaptationOptions): string {
    if (!options.preserveFormatting) {
      return text;
    }

    // Escape special characters for MarkdownV2
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  private async adaptFiles(
    files: PlatformFile[],
    warnings: string[],
    modifications: AdaptedContent['modifications']
  ): Promise<PlatformFile[]> {
    const adaptedFiles: PlatformFile[] = [];

    for (const file of files) {
      const platformFile: PlatformFile = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
        caption: file.caption
      };

      if (platformFile.size > this.capabilities.media.maxFileSize) {
        warnings.push(`File ${platformFile.name} exceeds maximum size limit`);
        modifications.push({
          type: 'removed',
          feature: 'file_attachment',
          reason: 'File too large',
          originalValue: platformFile.size
        });
        continue;
      }

      adaptedFiles.push(platformFile);
    }

    return adaptedFiles;
  }
}

/**
 * Discord content adapter
 */
export class DiscordContentAdapter extends PlatformContentAdapter {
  constructor() {
    super({
      platform: 'discord',
      formatting: {
        supportedMarkup: ['markdown'],
        maxMessageLength: 2000,
        supportsRichText: true,
        supportsCodeBlocks: true,
        supportsInlineCode: true,
        supportsLinks: true,
        supportsMentions: true,
        supportsEmojis: true,
        supportsCustomEmojis: true
      },
      media: {
        maxFileSize: 25 * 1024 * 1024, // 25MB (100MB with Nitro)
        supportedFileTypes: ['image/*', 'video/*', 'audio/*', 'text/*', 'application/pdf'],
        supportsInlineImages: true,
        supportsImageGalleries: false,
        supportsVideo: true,
        supportsAudio: true,
        supportsVoiceMessages: false,
        maxAttachmentsPerMessage: 10
      },
      interactive: {
        supportsReactions: true,
        supportsReplies: true,
        supportsThreading: true,
        supportsEditing: true,
        supportsDeletion: true,
        supportsPolls: false,
        supportsButtons: true
      },
      platformSpecific: {
        supportsEmbeds: true,
        supportsGifs: true,
        customFeatures: {
          embeds: true,
          slashCommands: true,
          roles: true,
          channels: true,
          servers: true
        }
      }
    });
  }

  async adaptContent(
    message: ConversationMessage,
    options: AdaptationOptions
  ): Promise<AdaptedContent> {
    const warnings: string[] = [];
    const modifications: AdaptedContent['modifications'] = [];
    let adaptedText = message.content.text;
    const adaptedFiles: PlatformFile[] = message.content.files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: 0, // Size not available in ConversationMessage
      url: file.localPath || '' // Use localPath as URL
    }));

    // Convert from other platforms to Discord format
    if (options.sourcePlatform === 'telegram') {
      adaptedText = this.convertFromTelegram(adaptedText, warnings, modifications);
    }

    // Apply Discord-specific formatting
    adaptedText = this.applyDiscordFormatting(adaptedText, options);

    // Handle file size limits
    const finalAdaptedFiles = await this.adaptFiles(adaptedFiles, warnings, modifications);

    // Truncate if too long
    if (adaptedText.length > this.capabilities.formatting.maxMessageLength) {
      const truncated = adaptedText.substring(0, this.capabilities.formatting.maxMessageLength - 3) + '...';
      modifications.push({
        type: 'modified',
        feature: 'message_length',
        reason: 'Exceeded maximum length',
        originalValue: adaptedText.length,
        newValue: truncated.length
      });
      adaptedText = truncated;
    }

    return {
      text: adaptedText,
      files: finalAdaptedFiles,
      platformMetadata: {
        allowedMentions: { parse: ['users', 'roles'] },
        embeds: []
      },
      warnings,
      modifications
    };
  }

  private convertFromTelegram(
    text: string,
    warnings: string[],
    modifications: AdaptedContent['modifications']
  ): string {
    let converted = text;

    // Remove Telegram-specific escaping
    converted = converted.replace(/\\([_*\[\]()~`>#+\-=|{}.!])/g, '$1');

    // Convert Telegram bot commands
    converted = converted.replace(/\/(\w+)(@\w+)?/g, (match, command, bot) => {
      modifications.push({
        type: 'converted',
        feature: 'bot_command',
        reason: 'Telegram bot command format',
        originalValue: match,
        newValue: `/${command}`
      });
      return `/${command}`;
    });

    return converted;
  }

  private applyDiscordFormatting(text: string, options: AdaptationOptions): string {
    if (!options.preserveFormatting) {
      return text;
    }

    // Discord uses standard markdown, no special escaping needed
    return text;
  }

  private async adaptFiles(
    files: { id: string; name: string; mimeType: string; localPath?: string; size?: number; url?: string }[],
    warnings: string[],
    modifications: AdaptedContent['modifications']
  ): Promise<PlatformFile[]> {
    const adaptedFiles: PlatformFile[] = [];

    for (const file of files) {
      const platformFile: PlatformFile = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size || 0,
        url: file.url || file.localPath || ''
      };

      if (platformFile.size > this.capabilities.media.maxFileSize) {
        warnings.push(`File ${platformFile.name} exceeds maximum size limit`);
        modifications.push({
          type: 'removed',
          feature: 'file_attachment',
          reason: 'File too large',
          originalValue: platformFile.size
        });
        continue;
      }

      // Check file type support
      const isSupported = this.capabilities.media.supportedFileTypes.some(type => {
        if (type === '*') return true;
        if (type.endsWith('/*')) {
          return platformFile.mimeType.startsWith(type.slice(0, -1));
        }
        return platformFile.mimeType === type;
      });

      if (!isSupported) {
        warnings.push(`File type ${platformFile.mimeType} not supported`);
        modifications.push({
          type: 'removed',
          feature: 'file_attachment',
          reason: 'Unsupported file type',
          originalValue: platformFile.mimeType
        });
        continue;
      }

      adaptedFiles.push(platformFile);
    }

    return adaptedFiles;
  }
}

/**
 * Main content adaptation service
 */
export class ContentAdaptationService {
  private adapters = new Map<string, PlatformContentAdapter>();

  constructor() {
    // Register default adapters
    this.registerAdapter('telegram', new TelegramContentAdapter());
    this.registerAdapter('discord', new DiscordContentAdapter());
  }

  /**
   * Register a platform adapter
   */
  registerAdapter(platform: string, adapter: PlatformContentAdapter): void {
    this.adapters.set(platform, adapter);
  }

  /**
   * Get platform adapter
   */
  getAdapter(platform: string): PlatformContentAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Adapt content for target platform
   */
  async adaptContent(
    message: ConversationMessage,
    targetPlatform: string,
    options: Partial<AdaptationOptions> = {}
  ): Promise<AdaptedContent> {
    const adapter = this.adapters.get(targetPlatform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${targetPlatform}`);
    }

    const adaptationOptions: AdaptationOptions = {
      targetPlatform,
      sourcePlatform: message.platform,
      preserveFormatting: true,
      fallbackToPlainText: true,
      convertUnsupportedFiles: true,
      ...options
    };

    return adapter.adaptContent(message, adaptationOptions);
  }

  /**
   * Get platform capabilities
   */
  getPlatformCapabilities(platform: string): PlatformCapabilities | undefined {
    const adapter = this.adapters.get(platform);
    return adapter?.getCapabilities();
  }

  /**
   * Check compatibility between platforms
   */
  checkCompatibility(
    sourcePlatform: string,
    targetPlatform: string
  ): {
    compatible: boolean;
    issues: Array<{
      feature: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  } {
    const sourceAdapter = this.adapters.get(sourcePlatform);
    const targetAdapter = this.adapters.get(targetPlatform);

    if (!sourceAdapter || !targetAdapter) {
      return {
        compatible: false,
        issues: [{
          feature: 'platform_support',
          issue: 'One or both platforms not supported',
          severity: 'high'
        }]
      };
    }

    const sourceCaps = sourceAdapter.getCapabilities();
    const targetCaps = targetAdapter.getCapabilities();
    const issues: Array<{ feature: string; issue: string; severity: 'low' | 'medium' | 'high' }> = [];

    // Check message length compatibility
    if (sourceCaps.formatting.maxMessageLength > targetCaps.formatting.maxMessageLength) {
      issues.push({
        feature: 'message_length',
        issue: `Target platform has lower message length limit (${targetCaps.formatting.maxMessageLength} vs ${sourceCaps.formatting.maxMessageLength})`,
        severity: 'medium'
      });
    }

    // Check file size compatibility
    if (sourceCaps.media.maxFileSize > targetCaps.media.maxFileSize) {
      issues.push({
        feature: 'file_size',
        issue: `Target platform has lower file size limit`,
        severity: 'medium'
      });
    }

    // Check markup compatibility
    const sourceMarkup = new Set(sourceCaps.formatting.supportedMarkup);
    const targetMarkup = new Set(targetCaps.formatting.supportedMarkup);
    const unsupportedMarkup = [...sourceMarkup].filter(m => !targetMarkup.has(m));

    if (unsupportedMarkup.length > 0) {
      issues.push({
        feature: 'markup_format',
        issue: `Target platform doesn't support: ${unsupportedMarkup.join(', ')}`,
        severity: 'low'
      });
    }

    return {
      compatible: issues.filter(i => i.severity === 'high').length === 0,
      issues
    };
  }

  /**
   * Get adaptation statistics
   */
  getAdaptationStatistics(): {
    supportedPlatforms: string[];
    totalAdaptations: number;
    adaptationsByPlatform: Record<string, number>;
    commonIssues: Array<{
      issue: string;
      frequency: number;
    }>;
  } {
    // This would track actual usage statistics in a real implementation
    return {
      supportedPlatforms: Array.from(this.adapters.keys()),
      totalAdaptations: 0,
      adaptationsByPlatform: {},
      commonIssues: []
    };
  }
}

/**
 * Create a content adaptation service with default adapters
 */
export function createContentAdaptationService(): ContentAdaptationService {
  return new ContentAdaptationService();
}
