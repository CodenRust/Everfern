"use strict";
/**
 * Platform Interface for Multi-Platform Integration
 *
 * This module defines the core interfaces and base classes for integrating
 * external messaging platforms (Telegram, Discord) with EverFern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformRateLimitError = exports.PlatformAuthError = exports.PlatformConnectionError = exports.PlatformError = exports.MessagePlatform = void 0;
/**
 * Abstract base class for messaging platform integrations
 */
class MessagePlatform {
    platformName;
    config;
    messageHandlers = new Set();
    statusHandlers = new Set();
    constructor(platformName, config) {
        this.platformName = platformName;
        this.config = config;
    }
    /**
     * Register a message handler
     */
    onMessage(handler) {
        this.messageHandlers.add(handler);
    }
    /**
     * Remove a message handler
     */
    offMessage(handler) {
        this.messageHandlers.delete(handler);
    }
    /**
     * Register a status change handler
     */
    onStatusChange(handler) {
        this.statusHandlers.add(handler);
    }
    /**
     * Remove a status change handler
     */
    offStatusChange(handler) {
        this.statusHandlers.delete(handler);
    }
    /**
     * Emit a message to all registered handlers
     */
    emitMessage(message) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            }
            catch (error) {
                console.error(`Error in message handler for ${this.platformName}:`, error);
            }
        });
    }
    /**
     * Emit a status change to all registered handlers
     */
    emitStatusChange(status) {
        this.statusHandlers.forEach(handler => {
            try {
                handler(status);
            }
            catch (error) {
                console.error(`Error in status handler for ${this.platformName}:`, error);
            }
        });
    }
    /**
     * Get platform name
     */
    getPlatformName() {
        return this.platformName;
    }
    /**
     * Get platform configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update platform configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Validate message content for platform-specific constraints
     */
    validateMessage(text, options) {
        if (!text && (!options.attachments || options.attachments.length === 0)) {
            throw new Error('Message must contain text or attachments');
        }
    }
    /**
     * Extract mentions from message text
     */
    extractMentions(text) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    }
    /**
     * Sanitize user input to prevent injection attacks
     */
    sanitizeInput(input) {
        // Remove potentially dangerous characters and sequences
        return input
            .replace(/[<>]/g, '') // Remove HTML-like tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/data:/gi, '') // Remove data: protocol
            .trim();
    }
}
exports.MessagePlatform = MessagePlatform;
/**
 * Base platform error class
 */
class PlatformError extends Error {
    platform;
    code;
    details;
    constructor(message, platform, code, details) {
        super(message);
        this.platform = platform;
        this.code = code;
        this.details = details;
        this.name = 'PlatformError';
    }
}
exports.PlatformError = PlatformError;
/**
 * Platform connection error
 */
class PlatformConnectionError extends PlatformError {
    constructor(platform, message, details) {
        super(`Connection error for ${platform}: ${message}`, platform, 'CONNECTION_ERROR', details);
        this.name = 'PlatformConnectionError';
    }
}
exports.PlatformConnectionError = PlatformConnectionError;
/**
 * Platform authentication error
 */
class PlatformAuthError extends PlatformError {
    constructor(platform, message, details) {
        super(`Authentication error for ${platform}: ${message}`, platform, 'AUTH_ERROR', details);
        this.name = 'PlatformAuthError';
    }
}
exports.PlatformAuthError = PlatformAuthError;
/**
 * Platform rate limit error
 */
class PlatformRateLimitError extends PlatformError {
    constructor(platform, retryAfter, details) {
        const message = retryAfter
            ? `Rate limit exceeded for ${platform}. Retry after ${retryAfter}s`
            : `Rate limit exceeded for ${platform}`;
        super(message, platform, 'RATE_LIMIT', { retryAfter, ...details });
        this.name = 'PlatformRateLimitError';
    }
}
exports.PlatformRateLimitError = PlatformRateLimitError;
