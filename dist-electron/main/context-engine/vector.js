"use strict";
/**
 * EverFern Desktop — Vector Context Engine
 *
 * Context engine that uses sqlite-vec embeddings for semantic retrieval.
 * Provides both sliding window AND vector-based retrieval for better context.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridContextEngine = exports.VectorContextEngine = void 0;
exports.getContextEngineStats = getContextEngineStats;
const chat_vectors_1 = require("../store/chat-vectors");
const char_estimator_1 = require("../agent/helpers/char-estimator");
class VectorContextEngine {
    info = {
        id: 'vector',
        name: 'EverFern Vector Context Engine',
        version: '1.0.0',
    };
    sessionTokens = new Map();
    lastAssemble = new Map();
    async ingest(params) {
        const { sessionId, message } = params;
        const content = typeof message.content === 'string'
            ? message.content
            : JSON.stringify(message.content);
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        try {
            await (0, chat_vectors_1.embedAndStoreMessage)(msgId, sessionId, message.role, content, Date.now());
            const tokens = (0, char_estimator_1.estimateMessageTokens)(message);
            const current = this.sessionTokens.get(sessionId) || 0;
            this.sessionTokens.set(sessionId, current + tokens);
            return {
                ingested: true,
                tokensIngested: tokens,
                totalTokens: this.sessionTokens.get(sessionId) || 0,
            };
        }
        catch (err) {
            console.warn('[VectorContext] Failed to ingest message', err);
            return { ingested: false };
        }
    }
    async assemble(params) {
        const budget = params.tokenBudget ?? 100_000;
        const msgs = params.messages;
        const prompt = params.prompt || '';
        if (msgs.length === 0) {
            return { messages: [], estimatedTokens: 0 };
        }
        const systemMsgs = msgs.filter((m) => m.role === 'system');
        const conversationMsgs = msgs.filter((m) => m.role !== 'system');
        const systemTokens = (0, char_estimator_1.estimateTokens)(systemMsgs);
        let remaining = budget - systemTokens;
        const kept = [];
        for (let i = conversationMsgs.length - 1; i >= 0; i--) {
            const msg = conversationMsgs[i];
            const tokens = (0, char_estimator_1.estimateMessageTokens)(msg);
            if (remaining - tokens < 0 && kept.length > 0) {
                break;
            }
            kept.unshift(msg);
            remaining -= tokens;
        }
        let vectorContext = [];
        if (prompt && prompt.length > 10) {
            try {
                const results = await (0, chat_vectors_1.searchChatVectors)(prompt, 5, params.sessionId);
                for (const result of results) {
                    if (result.similarity < 0.85)
                        continue;
                    const ctxMsg = {
                        role: result.role,
                        content: result.content,
                    };
                    const ctxTokens = (0, char_estimator_1.estimateMessageTokens)(ctxMsg);
                    if (remaining - ctxTokens > 0) {
                        vectorContext.push(ctxMsg);
                        remaining -= ctxTokens;
                    }
                }
                if (vectorContext.length > 0) {
                    console.log(`[VectorContext] Retrieved ${vectorContext.length} relevant past messages`);
                }
            }
            catch (err) {
                console.warn('[VectorContext] Vector search failed', err);
            }
        }
        const assembled = [...systemMsgs, ...vectorContext, ...kept];
        const estimatedTokens = (0, char_estimator_1.estimateTokens)(assembled);
        const result = {
            messages: assembled,
            estimatedTokens,
        };
        this.lastAssemble.set(params.sessionId, result);
        return result;
    }
    async compact(params) {
        const stats = await (0, chat_vectors_1.getVectorStats)();
        return {
            ok: true,
            compacted: true,
            reason: `Vector store holds ${stats.messageCount} messages (${Math.round(stats.storageSize / 1024)}KB)`,
            freedTokens: 0,
        };
    }
    async dispose() {
        this.sessionTokens.clear();
        this.lastAssemble.clear();
    }
}
exports.VectorContextEngine = VectorContextEngine;
class HybridContextEngine {
    info = {
        id: 'hybrid',
        name: 'EverFern Hybrid Context Engine',
        version: '1.0.0',
    };
    vectorEngine = new VectorContextEngine();
    compactThreshold = 0.85;
    async ingest(params) {
        return this.vectorEngine.ingest(params);
    }
    async assemble(params) {
        const budget = params.tokenBudget ?? 100_000;
        const result = await this.vectorEngine.assemble(params);
        const usagePercent = result.estimatedTokens / budget;
        if (usagePercent >= this.compactThreshold) {
            console.log(`[HybridContext] Context at ${Math.round(usagePercent * 100)}% — consider compacting`);
        }
        return result;
    }
    async compact(params) {
        return this.vectorEngine.compact(params);
    }
    async dispose() {
        await this.vectorEngine.dispose();
    }
}
exports.HybridContextEngine = HybridContextEngine;
async function getContextEngineStats() {
    const stats = await (0, chat_vectors_1.getVectorStats)();
    return {
        messageCount: stats.messageCount,
        storageBytes: stats.storageSize,
        dimensions: stats.dimensionCount,
        engineType: 'vector',
    };
}
