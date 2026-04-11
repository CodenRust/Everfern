"use strict";
/**
 * EverFern Desktop — Session Compaction
 *
 * Automatic context compaction for long-running sessions.
 * Implements OpenClaw-style token-based chunking with LLM summarization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCompactor = void 0;
exports.getSessionCompactor = getSessionCompactor;
const context_window_guard_1 = require("../runner/context-window-guard");
const agent_events_1 = require("../infra/agent-events");
class SessionCompactor {
    config;
    guard;
    constructor(model, config) {
        this.guard = (0, context_window_guard_1.getContextWindowGuard)(model);
        this.config = {
            targetTokens: config?.targetTokens ?? 4000,
            preserveLastMessages: config?.preserveLastMessages ?? 10,
            preserveSystemMessages: config?.preserveSystemMessages ?? true,
            identifierPolicy: config?.identifierPolicy ?? 'preserve'
        };
    }
    estimateTokens(text) {
        return this.guard.estimateTokens(text);
    }
    estimateMessages(messages) {
        return this.guard.estimateMessageTokens(messages);
    }
    shouldCompact(messages) {
        const tokens = this.estimateMessages(messages);
        const status = this.guard.getStatus(tokens);
        return status.level !== 'ok';
    }
    getCompactionCandidate(messages) {
        const toPreserve = [];
        const toCompact = [];
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
    async compact(sessionKey, messages, summarizer) {
        const originalTokens = this.estimateMessages(messages);
        console.log(`[Compactor] Starting compaction for ${sessionKey}: ${originalTokens} tokens`);
        (0, agent_events_1.emitCompaction)(sessionKey, 'compaction_start', {
            originalTokens
        });
        const candidate = this.getCompactionCandidate(messages);
        let summaryContent;
        if (candidate.toCompact.length === 0) {
            summaryContent = '[Previous conversation context - no earlier messages]';
        }
        else if (summarizer) {
            // Generate summary using LLM
            const textToSummarize = candidate.toCompact
                .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
                .join('\n\n');
            summaryContent = await summarizer(textToSummarize);
        }
        else {
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
        const compacted = [];
        // Add summary as first message
        compacted.push({
            role: 'system',
            content: `[COMPACTED SUMMARY]\n${summaryContent}\n[/COMPACTED SUMMARY]`
        });
        // Add preserved messages
        compacted.push(...candidate.toPreserve);
        const compactedTokens = this.estimateMessages(compacted);
        const result = {
            originalTokens,
            compactedTokens,
            summaryTokens,
            messagesRemoved: candidate.toCompact.length
        };
        (0, agent_events_1.emitCompaction)(sessionKey, 'compaction_end', {
            originalTokens,
            compactedTokens,
            summaryTokens,
            messagesRemoved: result.messagesRemoved
        });
        console.log(`[Compactor] Compaction complete for ${sessionKey}: ${originalTokens} → ${compactedTokens} tokens (${result.messagesRemoved} messages removed)`);
        return { compacted, result };
    }
    getStatus(messages) {
        const tokens = this.estimateMessages(messages);
        const status = this.guard.getStatus(tokens);
        return {
            ...status,
            shouldCompact: status.level !== 'ok'
        };
    }
}
exports.SessionCompactor = SessionCompactor;
// Singleton factory per model
const compactors = new Map();
function getSessionCompactor(model, config) {
    if (!compactors.has(model)) {
        compactors.set(model, new SessionCompactor(model, config));
    }
    return compactors.get(model);
}
