/**
 * EverFern Desktop — Default Context Engine
 *
 * This is the baseline implementation of the ContextEngine interface.
 *
 * Behaviour:
 *   - ingest: no-op (messages are held by AgentRunner state)
 *   - assemble: sliding-window trim (keeps last N messages + system prompt)
 *   - compact: returns not-compacted (upgrade to summarisation in v2)
 *
 * The sliding-window strategy ensures the context never explodes
 * beyond a safe token budget, preventing API errors on long sessions.
 */

import type { ChatMessage } from '../lib/ai-client';
import type { ContextEngine, ContextEngineInfo, AssembleResult, CompactResult, IngestResult } from './types';

// ── Token Estimation ─────────────────────────────────────────────────
// Very rough: 1 token ≈ 4 chars (English text). Good enough for budgeting.
function estimateTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    total += Math.ceil(content.length / 4);
  }
  return total;
}

// ── DefaultContextEngine ──────────────────────────────────────────────

export class DefaultContextEngine implements ContextEngine {
  readonly info: ContextEngineInfo = {
    id: 'default',
    name: 'EverFern Default Context Engine',
    version: '1.0.0',
  };

  /**
   * No-op: AgentRunner holds messages in LangGraph state.
   */
  async ingest(_params: {
    sessionId: string;
    message: ChatMessage;
  }): Promise<IngestResult> {
    return { ingested: false };
  }

  /**
   * Assemble context using a sliding-window strategy.
   *
   * Algorithm:
   *   1. Always keep the system message(s) at the front.
   *   2. Keep the most recent N messages that fit within tokenBudget.
   *   3. Always keep the last user message (the current turn's prompt).
   */
  async assemble(params: {
    sessionId: string;
    messages: ChatMessage[];
    tokenBudget?: number;
    model?: string;
    prompt?: string;
  }): Promise<AssembleResult> {
    const budget = params.tokenBudget ?? 100_000; // ~100k token default
    const msgs = params.messages;

    if (msgs.length === 0) {
      return { messages: [], estimatedTokens: 0 };
    }

    // Separate system messages from conversation
    const systemMsgs = msgs.filter((m) => m.role === 'system');
    const conversationMsgs = msgs.filter((m) => m.role !== 'system');

    const systemTokens = estimateTokens(systemMsgs);
    let remaining = budget - systemTokens;

    // Walk backwards through conversation, keeping what fits
    const kept: ChatMessage[] = [];
    for (let i = conversationMsgs.length - 1; i >= 0; i--) {
      const msg = conversationMsgs[i];
      const tokens = estimateTokens([msg]);
      if (remaining - tokens < 0 && kept.length > 0) {
        // Budget exceeded — stop (but always keep at least the last message)
        break;
      }
      kept.unshift(msg);
      remaining -= tokens;
    }

    const assembled = [...systemMsgs, ...kept];
    const estimatedTokens = estimateTokens(assembled);

    if (msgs.length !== assembled.length) {
      console.log(
        `[ContextEngine] Trimmed context: ${msgs.length} → ${assembled.length} messages ` +
        `(~${estimatedTokens} tokens, budget: ${budget})`,
      );
    }

    return { messages: assembled, estimatedTokens };
  }

  /**
   * Pass-through compaction — no summarisation yet.
   */
  async compact(_params: {
    sessionId: string;
    tokenBudget?: number;
  }): Promise<CompactResult> {
    return {
      ok: true,
      compacted: false,
      reason: 'DefaultContextEngine does not perform compaction. Upgrade to a compaction-capable engine.',
    };
  }

  async dispose(): Promise<void> {
    // Nothing to clean up
  }
}
