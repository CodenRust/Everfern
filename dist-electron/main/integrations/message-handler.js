"use strict";
/**
 * Message Handler for Bot Integrations
 *
 * This module handles incoming messages from bot platforms (Discord, Telegram),
 * processes them through the agent runner, and sends responses back to users.
 *
 * Features:
 * - Streaming responses with message editing
 * - Thinking indicators with emojis during tool calls
 * - File handling (receiving and sending)
 * - Rate limit management
 *
 * Requirements: 4.1-4.7, 5.1-5.4, 6.1-6.6
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const runner_1 = require("../agent/runner/runner");
/**
 * Rate limiter for Discord API
 */
class RateLimiter {
    messageTimestamps = [];
    editTimestamps = [];
    messageLimit = 5; // 5 messages per 5 seconds
    editLimit = 5; // 5 edits per 5 seconds
    window = 5000; // 5 seconds
    async waitForMessageSlot() {
        await this.waitForSlot(this.messageTimestamps, this.messageLimit);
    }
    async waitForEditSlot() {
        await this.waitForSlot(this.editTimestamps, this.editLimit);
    }
    async waitForSlot(timestamps, limit) {
        const now = Date.now();
        // Remove timestamps outside the window
        while (timestamps.length > 0 && timestamps[0] < now - this.window) {
            timestamps.shift();
        }
        // If we're at the limit, wait until the oldest timestamp expires
        if (timestamps.length >= limit) {
            const oldestTimestamp = timestamps[0];
            const waitTime = (oldestTimestamp + this.window) - now;
            if (waitTime > 0) {
                console.log(`[RateLimiter] Waiting ${waitTime}ms to respect rate limit`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                // Recursively check again
                return this.waitForSlot(timestamps, limit);
            }
        }
        // Add current timestamp
        timestamps.push(now);
    }
}
/**
 * Message handler class
 * Bridges bot manager events with agent runner processing
 */
class MessageHandler extends events_1.EventEmitter {
    config;
    activeRunners = new Map();
    rateLimiter = new RateLimiter();
    activeMessages = new Map();
    pendingHitlRequests = new Map();
    processedMessages = new Set(); // Track processed message IDs to prevent duplicates
    constructor(config) {
        super();
        this.config = config;
        this.setupEventHandlers();
    }
    /**
     * Set up event handlers for bot manager
     * Requirement 4.1: Listen to messageReceived event
     */
    setupEventHandlers() {
        // Listen to bot manager message events
        this.config.botManager.on('messageReceived', (context) => {
            this.handleMessage(context).catch(error => {
                console.error('[MessageHandler] Unhandled error in handleMessage:', error);
            });
        });
        console.log('[MessageHandler] Event handlers initialized');
    }
    /**
     * Handle incoming message from bot platform
     * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
     */
    async handleMessage(context) {
        const { message } = context;
        const platform = message.platform;
        // Create unique message identifier to prevent duplicate processing
        const messageKey = `${platform}_${message.chat.id}_${message.id}`;
        // Check if we've already processed this message
        if (this.processedMessages.has(messageKey)) {
            console.log(`[MessageHandler] ⏭️ Skipping duplicate message: ${messageKey}`);
            return;
        }
        // Mark message as processed
        this.processedMessages.add(messageKey);
        // Clean up old processed messages (keep last 1000)
        if (this.processedMessages.size > 1000) {
            const messagesToDelete = Array.from(this.processedMessages).slice(0, 100);
            messagesToDelete.forEach(key => this.processedMessages.delete(key));
        }
        console.log(`[MessageHandler] 📥 Received message from ${platform}`);
        console.log(`[MessageHandler] User: ${message.user.name} (${message.user.id})`);
        console.log(`[MessageHandler] Chat: ${message.chat.name} (${message.chat.id})`);
        console.log(`[MessageHandler] Content: ${message.content.text.substring(0, 100)}${message.content.text.length > 100 ? '...' : ''}`);
        // Log files if any
        if (message.content.files && message.content.files.length > 0) {
            console.log(`[MessageHandler] 📎 Files attached: ${message.content.files.length}`);
            message.content.files.forEach(file => {
                console.log(`[MessageHandler]   - ${file.name} (${file.mimeType}, ${(file.size / 1024).toFixed(2)} KB)`);
            });
        }
        const sessionId = `${platform}_${message.chat.id}`;
        // Check if this is a HITL response
        if (this.pendingHitlRequests.has(sessionId)) {
            console.log(`[MessageHandler] 🔔 Detected HITL response for session ${sessionId}`);
            await this.processHitlResponse(sessionId, message.content.text, message.chat.id, platform);
            return; // Don't process as a new message
        }
        try {
            // Requirement 4.3: Retrieve model and provider config for this platform
            const platformConfig = this.config.integrationConfig[platform];
            if (!platformConfig) {
                console.error(`[MessageHandler] ❌ Unknown platform: ${platform}`);
                return;
            }
            console.log(`[MessageHandler] Platform config: provider=${platformConfig.provider}, model=${platformConfig.model}`);
            // Requirement 6.1: Check if model is configured
            if (!platformConfig.model) {
                console.warn(`[MessageHandler] ⚠️ No model configured for ${platform}`);
                await this.sendErrorMessage(message.chat.id, platform, '⚠️ Bot not configured with an AI model. Please configure in settings.');
                return;
            }
            // Requirement 6.2: Check if provider is configured
            if (!platformConfig.provider) {
                console.warn(`[MessageHandler] ⚠️ No provider configured for ${platform}`);
                await this.sendErrorMessage(message.chat.id, platform, '⚠️ Bot not configured with an AI provider. Please configure in settings.');
                return;
            }
            // Requirement 5.1: Send typing indicator
            console.log(`[MessageHandler] ⌨️ Sending typing indicator...`);
            const botPlatform = this.config.botManager.getPlatform(platform);
            if (botPlatform) {
                await botPlatform.sendTyping(message.chat.id);
            }
            // Requirement 4.4: Create or reuse agent runner session
            const sessionId = `${platform}_${message.chat.id}`;
            let runner = this.activeRunners.get(sessionId);
            if (!runner) {
                console.log(`[MessageHandler] 🆕 Creating new agent runner session: ${sessionId}`);
                // Get API key for the provider
                const apiKey = await this.getApiKeyForProvider(platformConfig.provider);
                // Configure ACP manager with platform-specific model/provider
                console.log(`[MessageHandler] 🔧 Configuring ACP manager with provider=${platformConfig.provider}, model=${platformConfig.model}`);
                this.config.acpManager.setProvider({
                    provider: platformConfig.provider,
                    model: platformConfig.model,
                    apiKey: apiKey || undefined,
                });
                // Create AI client from ACP manager
                const client = this.config.acpManager.getClient();
                // Requirement 6.3: Check if client is available
                if (!client) {
                    console.error(`[MessageHandler] ❌ Failed to create AI client`);
                    await this.sendErrorMessage(message.chat.id, platform, '❌ Failed to initialize AI client. Please check your provider configuration.');
                    return;
                }
                // Create new agent runner
                runner = new runner_1.AgentRunner(client, {
                    maxIterations: 100,
                    enableTerminal: false, // Disable terminal for bot integrations
                });
                this.activeRunners.set(sessionId, runner);
                console.log(`[MessageHandler] ✅ Agent runner session created: ${sessionId}`);
            }
            else {
                console.log(`[MessageHandler] ♻️ Reusing existing agent runner session: ${sessionId}`);
            }
            // Send initial thinking message
            await this.rateLimiter.waitForMessageSlot();
            const thinkingMessageId = await botPlatform.sendMessage('🤔 *Thinking...*', { chatId: message.chat.id, parseMode: 'markdown' });
            // Store the message ID for editing
            this.activeMessages.set(sessionId, {
                messageId: thinkingMessageId,
                chatId: message.chat.id,
                platform
            });
            // Prepare message text with file information
            let messageText = message.content.text;
            if (message.content.files && message.content.files.length > 0) {
                messageText += '\n\n📎 **Attached files:**\n';
                message.content.files.forEach(file => {
                    messageText += `- ${file.name} (${file.mimeType})\n`;
                });
                messageText += '\n*Note: File content analysis is not yet implemented.*';
            }
            // Requirement 4.5: Process message through agent runner with streaming
            console.log(`[MessageHandler] 🤖 Processing message through agent runner...`);
            console.log(`[MessageHandler] Message text: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`);
            // Use runStream to get access to HITL events
            const stream = runner.runStream(messageText, [], platformConfig.model, sessionId);
            let response = '';
            let lastToolName = '';
            for await (const event of stream) {
                if (event.type === 'chunk') {
                    response += event.content;
                }
                else if (event.type === 'tool_call') {
                    // Update message with tool being used
                    const toolName = event.toolCall.toolName;
                    if (toolName !== lastToolName) {
                        lastToolName = toolName;
                        const emoji = this.getToolEmoji(toolName);
                        await this.updateMessage(sessionId, `${emoji} Using tool: **${toolName}**...`);
                    }
                }
                else if (event.type === 'hitl_request') {
                    // Handle HITL request - send to user and wait for their next message
                    console.log(`[MessageHandler] 🔔 HITL request received`);
                    await this.sendHitlRequest(event.request, sessionId, message.chat.id, platform);
                    // The agent has paused and is waiting for user response
                    // The next message from the user will be processed as a HITL response
                    return; // Exit this message handler, wait for HITL response
                }
                else if (event.type === 'done') {
                    break;
                }
            }
            console.log(`[MessageHandler] ✅ Agent runner completed`);
            console.log(`[MessageHandler] Response length: ${response.length} characters`);
            // Send final response by editing the thinking message
            await this.updateMessage(sessionId, response);
            // Clean up
            this.activeMessages.delete(sessionId);
            console.log(`[MessageHandler] ✅ Successfully processed message for ${sessionId}`);
        }
        catch (error) {
            // Requirement 6.3, 6.4, 6.5, 6.6: Error handling
            console.error('[MessageHandler] ❌ Error processing message:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            // Handle specific error types
            if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
                // Requirement 6.5: Rate limit error
                console.warn(`[MessageHandler] ⚠️ Rate limit error`);
                await this.sendErrorMessage(message.chat.id, platform, '⚠️ Rate limit exceeded. Please wait before sending more messages.');
            }
            else if (errorMsg.toLowerCase().includes('api key') || errorMsg.toLowerCase().includes('authentication')) {
                // API key error
                console.error(`[MessageHandler] ❌ Authentication error`);
                await this.sendErrorMessage(message.chat.id, platform, '❌ Bot authentication failed. Please check your API key configuration.');
            }
            else {
                // Requirement 6.4: Generic agent runner failure
                console.error(`[MessageHandler] ❌ Generic error: ${errorMsg}`);
                await this.sendErrorMessage(message.chat.id, platform, '❌ Failed to process your message. Please try again.');
            }
        }
    }
    /**
     * Send HITL (Human-in-the-Loop) approval request to user
     */
    async sendHitlRequest(request, sessionId, chatId, platform) {
        console.log(`[MessageHandler] 📋 Sending HITL request for session ${sessionId}`);
        const botPlatform = this.config.botManager.getPlatform(platform);
        if (!botPlatform) {
            throw new Error('Bot platform not available');
        }
        // Format the HITL request as a message
        const questions = request.questions || [];
        let hitlMessage = '⚠️ **Approval Required**\n\n';
        questions.forEach((q, index) => {
            hitlMessage += `**${q.question}**\n\n`;
            q.options.forEach((opt, optIndex) => {
                const emoji = optIndex === 0 ? '✅' : '❌';
                hitlMessage += `${emoji} ${opt.label}\n`;
            });
            if (index < questions.length - 1) {
                hitlMessage += '\n';
            }
        });
        hitlMessage += '\n*Please reply with your choice (e.g., "approve" or "reject")*';
        // Send HITL request message
        await this.rateLimiter.waitForMessageSlot();
        await botPlatform.sendMessage(hitlMessage, {
            chatId,
            parseMode: 'markdown'
        });
        // Mark this session as waiting for HITL response
        this.pendingHitlRequests.set(sessionId, {
            resolve: () => { }, // Not used in this implementation
            reject: () => { },
            sessionId
        });
        console.log(`[MessageHandler] ✅ HITL request sent, waiting for user response`);
    }
    /**
     * Process HITL response from user
     */
    async processHitlResponse(sessionId, response, chatId, platform) {
        console.log(`[MessageHandler] 📥 Processing HITL response for session ${sessionId}: ${response}`);
        // Remove pending HITL request
        this.pendingHitlRequests.delete(sessionId);
        // Determine if approved or rejected
        const lowerResponse = response.toLowerCase();
        const approved = lowerResponse.includes('approve') ||
            lowerResponse.includes('yes') ||
            lowerResponse.includes('✅') ||
            lowerResponse.includes('proceed') ||
            lowerResponse.includes('continue');
        const formattedResponse = approved ? '[HITL_APPROVED]' : '[HITL_REJECTED]';
        console.log(`[MessageHandler] 🔔 HITL response interpreted as: ${approved ? 'APPROVED' : 'REJECTED'}`);
        // Get the runner for this session
        const runner = this.activeRunners.get(sessionId);
        if (!runner) {
            console.error(`[MessageHandler] ❌ No active runner found for session ${sessionId}`);
            return;
        }
        // Get platform config
        const platformConfig = this.config.integrationConfig[platform];
        if (!platformConfig) {
            console.error(`[MessageHandler] ❌ Unknown platform: ${platform}`);
            return;
        }
        const botPlatform = this.config.botManager.getPlatform(platform);
        if (!botPlatform) {
            console.error(`[MessageHandler] ❌ Bot platform not available`);
            return;
        }
        try {
            // Send typing indicator
            await botPlatform.sendTyping(chatId);
            // Send acknowledgment message
            await this.rateLimiter.waitForMessageSlot();
            const ackMessageId = await botPlatform.sendMessage(approved ? '✅ *Approved! Continuing...*' : '❌ *Rejected. Stopping...*', { chatId, parseMode: 'markdown' });
            // Store the message ID for editing
            this.activeMessages.set(sessionId, {
                messageId: ackMessageId,
                chatId,
                platform
            });
            // Continue the agent with the HITL response
            const stream = runner.runStream(formattedResponse, [], platformConfig.model, sessionId);
            let finalResponse = '';
            let lastToolName = '';
            for await (const event of stream) {
                if (event.type === 'chunk') {
                    finalResponse += event.content;
                }
                else if (event.type === 'tool_call') {
                    const toolName = event.toolCall.toolName;
                    if (toolName !== lastToolName && toolName !== 'ask_user_question') {
                        lastToolName = toolName;
                        const emoji = this.getToolEmoji(toolName);
                        await this.updateMessage(sessionId, `${emoji} Using tool: **${toolName}**...`);
                    }
                }
                else if (event.type === 'hitl_request') {
                    // Another HITL request - handle it
                    console.log(`[MessageHandler] 🔔 Another HITL request received`);
                    await this.sendHitlRequest(event.request, sessionId, chatId, platform);
                    return; // Exit and wait for next response
                }
                else if (event.type === 'done') {
                    break;
                }
            }
            console.log(`[MessageHandler] ✅ Agent runner completed after HITL response`);
            // Send final response
            if (finalResponse.trim()) {
                await this.updateMessage(sessionId, finalResponse);
            }
            // Clean up
            this.activeMessages.delete(sessionId);
        }
        catch (error) {
            console.error('[MessageHandler] ❌ Error processing HITL response:', error);
            await this.sendErrorMessage(chatId, platform, '❌ Failed to process your response. Please try again.');
        }
    }
    /**
     * Update message with new content (edit existing message)
     */
    async updateMessage(sessionId, content) {
        const messageInfo = this.activeMessages.get(sessionId);
        if (!messageInfo)
            return;
        const botPlatform = this.config.botManager.getPlatform(messageInfo.platform);
        if (!botPlatform)
            return;
        try {
            await this.rateLimiter.waitForEditSlot();
            // Check if platform supports message editing
            if (typeof botPlatform.editMessage === 'function') {
                await botPlatform.editMessage(messageInfo.chatId, messageInfo.messageId, this.truncateForPlatform(content, 2000));
            }
        }
        catch (error) {
            console.error('[MessageHandler] Failed to edit message:', error);
        }
    }
    /**
     * Get emoji for tool name
     */
    getToolEmoji(toolName) {
        const emojiMap = {
            'web_search': '🔍',
            'read_file': '📄',
            'write_file': '✍️',
            'list_directory': '📁',
            'execute_command': '⚙️',
            'ask_user': '❓',
            'create_artifact': '🎨',
            'visualize': '📊',
            'memory_search': '🧠',
            'memory_save': '💾',
        };
        return emojiMap[toolName] || '🔧';
    }
    /**
     * Truncate text for platform limits
     */
    truncateForPlatform(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }
    /**
     * Send response to platform with message splitting
     * Requirements: 5.3, 5.4
     */
    async sendResponse(platform, chatId, response) {
        // Requirement 5.4: Check if response exceeds platform limits
        const maxLength = 2000; // Discord limit
        if (response.length <= maxLength) {
            // Send directly if within limit
            await this.rateLimiter.waitForMessageSlot();
            await platform.sendMessage(response, { chatId });
        }
        else {
            // Requirement 5.4: Split into chunks
            const chunks = this.splitMessage(response, maxLength);
            console.log(`[MessageHandler] Splitting response into ${chunks.length} chunks`);
            for (const chunk of chunks) {
                await this.rateLimiter.waitForMessageSlot();
                await platform.sendMessage(chunk, { chatId });
            }
        }
    }
    /**
     * Split message into chunks at natural boundaries
     * Requirement 5.4: Message splitting logic
     */
    splitMessage(text, maxLength) {
        const chunks = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxLength) {
                chunks.push(remaining);
                break;
            }
            // Try to split at a natural boundary (newline, period, space)
            let splitIndex = maxLength;
            const lastNewline = remaining.lastIndexOf('\n', maxLength);
            const lastPeriod = remaining.lastIndexOf('. ', maxLength);
            const lastSpace = remaining.lastIndexOf(' ', maxLength);
            // Prefer boundaries in the last 30% of the chunk
            const threshold = maxLength * 0.7;
            if (lastNewline > threshold) {
                splitIndex = lastNewline + 1;
            }
            else if (lastPeriod > threshold) {
                splitIndex = lastPeriod + 2;
            }
            else if (lastSpace > threshold) {
                splitIndex = lastSpace + 1;
            }
            chunks.push(remaining.substring(0, splitIndex));
            remaining = remaining.substring(splitIndex);
        }
        return chunks;
    }
    /**
     * Send error message to user
     * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
     */
    async sendErrorMessage(chatId, platform, errorMessage) {
        const botPlatform = this.config.botManager.getPlatform(platform);
        if (botPlatform) {
            try {
                await this.rateLimiter.waitForMessageSlot();
                await botPlatform.sendMessage(errorMessage, { chatId });
                console.log(`[MessageHandler] Sent error message to ${platform}/${chatId}: ${errorMessage}`);
            }
            catch (error) {
                console.error(`[MessageHandler] Failed to send error message to ${platform}/${chatId}:`, error);
            }
        }
    }
    /**
     * Get API key for provider from file system
     * Requirement 4.4: API key retrieval
     */
    async getApiKeyForProvider(provider) {
        try {
            const configDir = path.join(os.homedir(), '.everfern');
            const keysDir = path.join(configDir, 'keys');
            const keyPath = path.join(keysDir, `${provider}.key`);
            if (fs.existsSync(keyPath)) {
                const apiKey = fs.readFileSync(keyPath, 'utf-8').trim();
                console.log(`[MessageHandler] Loaded API key for provider: ${provider}`);
                return apiKey;
            }
            console.warn(`[MessageHandler] No API key found for provider: ${provider}`);
            return '';
        }
        catch (error) {
            console.error(`[MessageHandler] Error loading API key for provider ${provider}:`, error);
            return '';
        }
    }
    /**
     * Shutdown message handler and clean up resources
     * Requirement 4.1: Cleanup on shutdown
     */
    async shutdown() {
        console.log('[MessageHandler] Shutting down...');
        // Clean up active runners
        for (const [sessionId, runner] of this.activeRunners.entries()) {
            try {
                // Abort any ongoing operations
                if (runner.isAborted && !runner.isAborted()) {
                    runner.abort();
                }
                console.log(`[MessageHandler] Cleaned up session: ${sessionId}`);
            }
            catch (error) {
                console.error(`[MessageHandler] Error cleaning up session ${sessionId}:`, error);
            }
        }
        this.activeRunners.clear();
        this.activeMessages.clear();
        this.processedMessages.clear();
        console.log('[MessageHandler] Shutdown complete');
    }
}
exports.MessageHandler = MessageHandler;
