/**
 * EverFern Desktop — Session Compaction
 * 
 * Automatic context compaction for long-running sessions.
 * Implements OpenClaw-style token-based chunking with LLM summarization.
 */

import { getContextWindowGuard, type ContextUsage } from '../runner/context-window-guard';
import { getAgentEvents, emitCompaction } from '../infra/agent-events';

export interface CompactionConfig {
    targetTokens: number;
    preserveLastMessages: number;
    preserveSystemMessages: boolean;
    identifierPolicy: 'preserve' | 'hash' | 'remove';
}

export interface CompactionResult {
    originalTokens: number;
    compactedTokens: number;
    summaryTokens: number;
    messagesRemoved: number;
}

export interface CompactionCandidate {
    messages: Array<{ role: string; content: string }>;
    toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>;
}

export class SessionCompactor {
    private config: CompactionConfig;
    private guard: ReturnType<typeof getContextWindowGuard>;

    constructor(model: string, config?: Partial<CompactionConfig>) {
        this.guard = getContextWindowGuard(model);
        
        this.config = {
            targetTokens: config?.targetTokens ?? 4000,
            preserveLastMessages: config?.preserveLastMessages ?? 10,
            preserveSystemMessages: config?.preserveSystemMessages ?? true,
            identifierPolicy: config?.identifierPolicy ?? 'preserve'
        };
    }

    estimateTokens(text: string): number {
        return this.guard.estimateTokens(text);
    }

    estimateMessages(messages: Array<{ role: string; content: string | unknown[] }>): number {
        return this.guard.estimateMessageTokens(messages);
    }

    shouldCompact(messages: Array<{ role: string; content: string }>): boolean {
        const tokens = this.estimateMessages(messages);
        const status = this.guard.getStatus(tokens);
        return status.level !== 'ok';
    }

    getCompactionCandidate(messages: Array<{ role: string; content: string }>): {
        toCompact: Array<{ role: string; content: string }>;
        toPreserve: Array<{ role: string; content: string }>;
        estimatedTokens: number;
    } {
        const toPreserve: typeof messages = [];
        const toCompact: typeof messages = [];

        // Always preserve system messages
        if (this.config.preserveSystemMessages) {
            for (const msg of messages) {
                if (msg.role === 'system') {
                    toPreserve.push(msg);
                }
            }
        }

        // Preserve last N messages
        const nonSystem = messages.filter(m => m.role !== 'system');
        const lastMessages = nonSystem.slice(-this.config.preserveLastMessages);
        const olderMessages = nonSystem.slice(0, -this.config.preserveLastMessages);

        toPreserve.push(...lastMessages);
        toCompact.push(...olderMessages);

        const estimatedTokens = this.estimateMessages([...toPreserve, ...toCompact]);

        return {
            toCompact,
            toPreserve,
            estimatedTokens
        };
    }

    async compact(
        sessionKey: string,
        messages: Array<{ role: string; content: string }>,
        summarizer?: (text: string) => Promise<string>
    ): Promise<{
        compacted: Array<{ role: string; content: string }>;
        result: CompactionResult;
    }> {
        const originalTokens = this.estimateMessages(messages);
        
        console.log(`[Compactor] Starting compaction for ${sessionKey}: ${originalTokens} tokens`);

        emitCompaction(sessionKey, 'compaction_start', {
            originalTokens
        });

        const candidate = this.getCompactionCandidate(messages);
        
        let summaryContent: string;
        
        if (candidate.toCompact.length === 0) {
            summaryContent = '[Previous conversation context - no earlier messages]';
        } else if (summarizer) {
            // Generate summary using LLM
            const textToSummarize = candidate.toCompact
                .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
                .join('\n\n');
            
            summaryContent = await summarizer(textToSummarize);
        } else {
            // Simple truncation as fallback
            const combinedText = candidate.toCompact
                .map(m => `${m.role}: ${m.content}`)
                .join('\n');
            
            // Take first 2000 chars as summary
            summaryContent = `[Previous context (${candidate.toCompact.length} messages, ~${this.estimateTokens(combinedText)} tokens)]:\n` +
                combinedText.substring(0, 2000) + (combinedText.length > 2000 ? '...' : '');
        }

        const summaryTokens = this.estimateTokens(summaryContent);
        
        // Create compacted messages
        const compacted: typeof messages = [];

        // Add summary as first message
        compacted.push({
            role: 'system',
            content: `[COMPACTED SUMMARY]\n${summaryContent}\n[/COMPACTED SUMMARY]`
        });

        // Add preserved messages
        compacted.push(...candidate.toPreserve);

        const compactedTokens = this.estimateMessages(compacted);

        const result: CompactionResult = {
            originalTokens,
            compactedTokens,
            summaryTokens,
            messagesRemoved: candidate.toCompact.length
        };

        emitCompaction(sessionKey, 'compaction_end', {
            originalTokens,
            compactedTokens,
            summaryTokens,
            messagesRemoved: result.messagesRemoved
        });

        console.log(`[Compactor] Compaction complete for ${sessionKey}: ${originalTokens} → ${compactedTokens} tokens (${result.messagesRemoved} messages removed)`);

        return { compacted, result };
    }

    getStatus(messages: Array<{ role: string; content: string }>): {
        level: 'ok' | 'warning' | 'critical';
        usage: ContextUsage;
        shouldCompact: boolean;
        message: string;
    } {
        const tokens = this.estimateMessages(messages);
        const status = this.guard.getStatus(tokens);

        return {
            ...status,
            shouldCompact: status.level !== 'ok'
        };
    }
}

// Singleton factory per model
const compactors = new Map<string, SessionCompactor>();

export function getSessionCompactor(model: string, config?: Partial<CompactionConfig>): SessionCompactor {
    if (!compactors.has(model)) {
        compactors.set(model, new SessionCompactor(model, config));
    }
    return compactors.get(model)!;
}
