/**
 * EverFern Desktop — Tool Result Char Estimator
 * 
 * Estimates character counts for messages and tool results.
 * Used for context window management and truncation decisions.
 */

export const CHARS_PER_TOKEN_ESTIMATE = 4;
export const TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE = 2;
const IMAGE_CHAR_ESTIMATE = 8000;

export interface Message {
    role: string;
    content?: string | ContentBlock[];
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    details?: unknown;
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface ContentBlock {
    type: string;
    text?: string;
    thinking?: string;
    arguments?: Record<string, unknown>;
}

export type CharEstimateCache = WeakMap<object, number>;

function isTextBlock(block: unknown): block is { type: 'text'; text: string } {
    return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'text';
}

function isImageBlock(block: unknown): boolean {
    return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'image';
}

function isToolCallBlock(block: unknown): boolean {
    return !!block && typeof block === 'object' && (block as { type?: unknown }).type === 'toolCall';
}

function estimateUnknownChars(value: unknown): number {
    if (typeof value === 'string') return value.length;
    if (value === undefined) return 0;
    try {
        const serialized = JSON.stringify(value);
        return typeof serialized === 'string' ? serialized.length : 0;
    } catch {
        return 256;
    }
}

export function isToolResultMessage(msg: Message): boolean {
    return msg.role === 'tool' || msg.role === 'toolResult' || msg.role === 'function';
}

export function getToolResultContent(msg: Message): ContentBlock[] {
    if (!isToolResultMessage(msg)) return [];
    
    const content = msg.content;
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }
    if (Array.isArray(content)) {
        return content as ContentBlock[];
    }
    return [];
}

export function getToolResultText(msg: Message): string {
    const content = getToolResultContent(msg);
    const chunks: string[] = [];
    
    for (const block of content) {
        if (isTextBlock(block) && block.text) {
            chunks.push(block.text);
        }
    }
    
    return chunks.join('\n');
}

function estimateContentBlockChars(content: ContentBlock[]): number {
    let chars = 0;
    for (const block of content) {
        if (isTextBlock(block) && block.text) {
            chars += block.text.length;
        } else if (isImageBlock(block)) {
            chars += IMAGE_CHAR_ESTIMATE;
        } else if (isToolCallBlock(block)) {
            try {
                const args = (block as ContentBlock & { arguments?: Record<string, unknown> }).arguments;
                chars += JSON.stringify(args ?? {}).length;
            } catch {
                chars += 128;
            }
        } else {
            chars += estimateUnknownChars(block);
        }
    }
    return chars;
}

export function estimateMessageChars(msg: Message): number {
    if (!msg || typeof msg !== 'object') return 0;

    if (msg.role === 'user') {
        const content = msg.content;
        if (typeof content === 'string') return content.length;
        if (Array.isArray(content)) return estimateContentBlockChars(content);
        return 0;
    }

    if (msg.role === 'assistant') {
        let chars = 0;
        const content = msg.content;
        
        if (Array.isArray(content)) {
            for (const block of content) {
                if (!block || typeof block !== 'object') continue;
                
                const typed = block as {
                    type?: string;
                    text?: string;
                    thinking?: string;
                    arguments?: Record<string, unknown>;
                };
                
                if (typed.type === 'text' && typeof typed.text === 'string') {
                    chars += typed.text.length;
                } else if (typed.type === 'thinking' && typeof typed.thinking === 'string') {
                    chars += typed.thinking.length;
                } else if (typed.type === 'toolCall' && typed.arguments && typeof typed.arguments === 'object') {
                    try {
                        chars += JSON.stringify(typed.arguments).length;
                    } catch {
                        chars += 128;
                    }
                } else {
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
        
        const weightedChars = Math.ceil(
            chars * (CHARS_PER_TOKEN_ESTIMATE / TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE)
        );
        
        return Math.max(chars, weightedChars);
    }

    return 256;
}

export function createCharEstimateCache(): CharEstimateCache {
    return new WeakMap<object, number>();
}

export function estimateMessageCharsCached(msg: Message, cache: CharEstimateCache): number {
    const hit = cache.get(msg as object);
    if (hit !== undefined) return hit;
    
    const estimated = estimateMessageChars(msg);
    cache.set(msg as object, estimated);
    return estimated;
}

export function estimateContextChars(messages: Message[], cache: CharEstimateCache): number {
    return messages.reduce((sum, msg) => sum + estimateMessageCharsCached(msg, cache), 0);
}

export function invalidateCacheEntry(cache: CharEstimateCache, msg: Message): void {
    cache.delete(msg as object);
}

export function estimateMessageTokens(msg: Message): number {
    const chars = estimateMessageChars(msg);
    return Math.ceil(chars / CHARS_PER_TOKEN_ESTIMATE);
}

export function estimateTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
        total += estimateMessageTokens(msg);
    }
    return total;
}
