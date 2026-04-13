"use strict";
/**
 * EverFern Desktop — Tool Result Char Estimator
 *
 * Estimates character counts for messages and tool results.
 * Used for context window management and truncation decisions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE = exports.CHARS_PER_TOKEN_ESTIMATE = void 0;
exports.isToolResultMessage = isToolResultMessage;
exports.getToolResultContent = getToolResultContent;
exports.getToolResultText = getToolResultText;
exports.estimateMessageChars = estimateMessageChars;
exports.createCharEstimateCache = createCharEstimateCache;
exports.estimateMessageCharsCached = estimateMessageCharsCached;
exports.estimateContextChars = estimateContextChars;
exports.invalidateCacheEntry = invalidateCacheEntry;
exports.estimateMessageTokens = estimateMessageTokens;
exports.estimateTokens = estimateTokens;
exports.CHARS_PER_TOKEN_ESTIMATE = 4;
exports.TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE = 2;
const IMAGE_CHAR_ESTIMATE = 8000;
function isTextBlock(block) {
    return !!block && typeof block === 'object' && block.type === 'text';
}
function isImageBlock(block) {
    return !!block && typeof block === 'object' && block.type === 'image';
}
function isToolCallBlock(block) {
    return !!block && typeof block === 'object' && block.type === 'toolCall';
}
function estimateUnknownChars(value) {
    if (typeof value === 'string')
        return value.length;
    if (value === undefined)
        return 0;
    try {
        const serialized = JSON.stringify(value);
        return typeof serialized === 'string' ? serialized.length : 0;
    }
    catch {
        return 256;
    }
}
function isToolResultMessage(msg) {
    return msg.role === 'tool' || msg.role === 'toolResult' || msg.role === 'function';
}
function getToolResultContent(msg) {
    if (!isToolResultMessage(msg))
        return [];
    const content = msg.content;
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    if (Array.isArray(content)) {
        return content;
    }
    return [];
}
function getToolResultText(msg) {
    const content = getToolResultContent(msg);
    const chunks = [];
    for (const block of content) {
        if (isTextBlock(block) && block.text) {
            chunks.push(block.text);
        }
    }
    return chunks.join('\n');
}
function estimateContentBlockChars(content) {
    let chars = 0;
    for (const block of content) {
        if (isTextBlock(block) && block.text) {
            chars += block.text.length;
        }
        else if (isImageBlock(block)) {
            chars += IMAGE_CHAR_ESTIMATE;
        }
        else if (isToolCallBlock(block)) {
            try {
                const args = block.arguments;
                chars += JSON.stringify(args ?? {}).length;
            }
            catch {
                chars += 128;
            }
        }
        else {
            chars += estimateUnknownChars(block);
        }
    }
    return chars;
}
function estimateMessageChars(msg) {
    if (!msg || typeof msg !== 'object')
        return 0;
    if (msg.role === 'user') {
        const content = msg.content;
        if (typeof content === 'string')
            return content.length;
        if (Array.isArray(content))
            return estimateContentBlockChars(content);
        return 0;
    }
    if (msg.role === 'assistant') {
        let chars = 0;
        const content = msg.content;
        if (Array.isArray(content)) {
            for (const block of content) {
                if (!block || typeof block !== 'object')
                    continue;
                const typed = block;
                if (typed.type === 'text' && typeof typed.text === 'string') {
                    chars += typed.text.length;
                }
                else if (typed.type === 'thinking' && typeof typed.thinking === 'string') {
                    chars += typed.thinking.length;
                }
                else if (typed.type === 'toolCall' && typed.arguments && typeof typed.arguments === 'object') {
                    try {
                        chars += JSON.stringify(typed.arguments).length;
                    }
                    catch {
                        chars += 128;
                    }
                }
                else {
                    chars += estimateUnknownChars(block);
                }
            }
        }
        return chars;
    }
    if (isToolResultMessage(msg)) {
        const content = getToolResultContent(msg);
        let chars = estimateContentBlockChars(content);
        if (msg.details) {
            chars += estimateUnknownChars(msg.details);
        }
        const weightedChars = Math.ceil(chars * (exports.CHARS_PER_TOKEN_ESTIMATE / exports.TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE));
        return Math.max(chars, weightedChars);
    }
    return 256;
}
function createCharEstimateCache() {
    return new WeakMap();
}
function estimateMessageCharsCached(msg, cache) {
    const hit = cache.get(msg);
    if (hit !== undefined)
        return hit;
    const estimated = estimateMessageChars(msg);
    cache.set(msg, estimated);
    return estimated;
}
function estimateContextChars(messages, cache) {
    return messages.reduce((sum, msg) => sum + estimateMessageCharsCached(msg, cache), 0);
}
function invalidateCacheEntry(cache, msg) {
    cache.delete(msg);
}
function estimateMessageTokens(msg) {
    const chars = estimateMessageChars(msg);
    return Math.ceil(chars / exports.CHARS_PER_TOKEN_ESTIMATE);
}
function estimateTokens(messages) {
    let total = 0;
    for (const msg of messages) {
        total += estimateMessageTokens(msg);
    }
    return total;
}
