/**
 * EverFern Desktop — Vector Context Engine
 * 
 * Context engine that uses sqlite-vec embeddings for semantic retrieval.
 * Provides both sliding window AND vector-based retrieval for better context.
 */

import type { ChatMessage } from '../lib/ai-client';
import type { ContextEngine, ContextEngineInfo, AssembleResult, CompactResult, IngestResult } from './types';
import {
  embedAndStoreMessage,
  searchChatVectors,
  getChatVectors,
  refreshEmbeddingConfig,
  getVectorStats,
} from '../store/chat-vectors';
import { estimateTokens, estimateMessageTokens } from '../agent/helpers/char-estimator';

export class VectorContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    id: 'vector',
    name: 'EverFern Vector Context Engine',
    version: '1.0.0',
  };

  private sessionTokens: Map<string, number> = new Map();
  private lastAssemble: Map<string, AssembleResult> = new Map();

  async ingest(params: {
    sessionId: string;
    message: ChatMessage;
  }): Promise<IngestResult> {
    const { sessionId, message } = params;
    
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);
    
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      await embedAndStoreMessage(
        msgId,
        sessionId,
        message.role,
        content,
        Date.now()
      );
      
      const tokens = estimateMessageTokens(message);
      const current = this.sessionTokens.get(sessionId) || 0;
      this.sessionTokens.set(sessionId, current + tokens);
      
      return {
        ingested: true,
        tokensIngested: tokens,
        totalTokens: this.sessionTokens.get(sessionId) || 0,
      };
    } catch (err) {
      console.warn('[VectorContext] Failed to ingest message', err);
      return { ingested: false };
    }
  }

  async assemble(params: {
    sessionId: string;
    messages: ChatMessage[];
    tokenBudget?: number;
    model?: string;
    prompt?: string;
  }): Promise<AssembleResult> {
    const budget = params.tokenBudget ?? 100_000;
    const msgs = params.messages;
    const prompt = params.prompt || '';

    if (msgs.length === 0) {
      return { messages: [], estimatedTokens: 0 };
    }

    const systemMsgs = msgs.filter((m) => m.role === 'system');
    const conversationMsgs = msgs.filter((m) => m.role !== 'system');

    const systemTokens = estimateTokens(systemMsgs);
    let remaining = budget - systemTokens;

    const kept: ChatMessage[] = [];
    for (let i = conversationMsgs.length - 1; i >= 0; i--) {
      const msg = conversationMsgs[i];
      const tokens = estimateMessageTokens(msg);
      if (remaining - tokens < 0 && kept.length > 0) {
        break;
      }
      kept.unshift(msg);
      remaining -= tokens;
    }

    let vectorContext: ChatMessage[] = [];
    if (prompt && prompt.length > 10) {
      try {
        const results = await searchChatVectors(prompt, 5, params.sessionId);
        
        for (const result of results) {
          if (result.similarity < 0.85) continue;
          
          const ctxMsg: ChatMessage = {
            role: result.role as any,
            content: result.content,
          };
          const ctxTokens = estimateMessageTokens(ctxMsg);
          
          if (remaining - ctxTokens > 0) {
            vectorContext.push(ctxMsg);
            remaining -= ctxTokens;
          }
        }
        
        if (vectorContext.length > 0) {
          console.log(`[VectorContext] Retrieved ${vectorContext.length} relevant past messages`);
        }
      } catch (err) {
        console.warn('[VectorContext] Vector search failed', err);
      }
    }

    const assembled = [...systemMsgs, ...vectorContext, ...kept];
    const estimatedTokens = estimateTokens(assembled);

    const result: AssembleResult = {
      messages: assembled,
      estimatedTokens,
    };
    
    this.lastAssemble.set(params.sessionId, result);
    return result;
  }

  async compact(params: {
    sessionId: string;
    tokenBudget?: number;
  }): Promise<CompactResult> {
    const stats = await getVectorStats();
    
    return {
      ok: true,
      compacted: true,
      reason: `Vector store holds ${stats.messageCount} messages (${Math.round(stats.storageSize / 1024)}KB)`,
      freedTokens: 0,
    };
  }

  async dispose(): Promise<void> {
    this.sessionTokens.clear();
    this.lastAssemble.clear();
  }
}

export class HybridContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    id: 'hybrid',
    name: 'EverFern Hybrid Context Engine',
    version: '1.0.0',
  };

  private vectorEngine = new VectorContextEngine();
  private compactThreshold = 0.85;

  async ingest(params: { sessionId: string; message: ChatMessage }): Promise<IngestResult> {
    return this.vectorEngine.ingest(params);
  }

  async assemble(params: {
    sessionId: string;
    messages: ChatMessage[];
    tokenBudget?: number;
    model?: string;
    prompt?: string;
  }): Promise<AssembleResult> {
    const budget = params.tokenBudget ?? 100_000;
    const result = await this.vectorEngine.assemble(params);
    
    const usagePercent = result.estimatedTokens / budget;
    
    if (usagePercent >= this.compactThreshold) {
      console.log(`[HybridContext] Context at ${Math.round(usagePercent * 100)}% — consider compacting`);
    }
    
    return result;
  }

  async compact(params: { sessionId: string; tokenBudget?: number }): Promise<CompactResult> {
    return this.vectorEngine.compact(params);
  }

  async dispose(): Promise<void> {
    await this.vectorEngine.dispose();
  }
}

export async function getContextEngineStats(): Promise<{
  messageCount: number;
  storageBytes: number;
  dimensions: number | null;
  engineType: string;
}> {
  const stats = await getVectorStats();
  return {
    messageCount: stats.messageCount,
    storageBytes: stats.storageSize,
    dimensions: stats.dimensionCount,
    engineType: 'vector',
  };
}
