/**
 * EverFern Desktop — Context Engine Types
 *
 * Adapted from openclaw/src/context-engine/types.ts
 * Dependency on @mariozechner/pi-agent-core replaced with EverFern's ChatMessage.
 */

import type { ChatMessage } from '../lib/ai-client';

// ── Result Types ─────────────────────────────────────────────────────

export type AssembleResult = {
  /** Ordered messages to use as model context */
  messages: ChatMessage[];
  /** Estimated total tokens in assembled context */
  estimatedTokens: number;
  /** Optional instructions to prepend to the system prompt */
  systemPromptAddition?: string;
};

export type CompactResult = {
  ok: boolean;
  compacted: boolean;
  reason?: string;
  freedTokens?: number;
  result?: {
    summary?: string;
    tokensBefore: number;
    tokensAfter?: number;
  };
};

export type IngestResult = {
  /** Whether the message was ingested (false if duplicate or no-op) */
  ingested: boolean;
  /** Optional: number of tokens ingested */
  tokensIngested?: number;
  /** Optional: total tokens in the store */
  totalTokens?: number;
};

export type ContextEngineInfo = {
  id: string;
  name: string;
  version?: string;
  /** True when the engine manages its own compaction lifecycle */
  ownsCompaction?: boolean;
};

// ── Core Interface ───────────────────────────────────────────────────

/**
 * ContextEngine — pluggable contract for context management.
 *
 * Required: `ingest()` and `assemble()`.
 * Optional: `bootstrap()`, `compact()`, `afterTurn()`, `dispose()`.
 */
export interface ContextEngine {
  readonly info: ContextEngineInfo;

  /**
   * Initialize engine state for a session, optionally importing
   * historical context from disk.
   */
  bootstrap?(params: {
    sessionId: string;
  }): Promise<{ bootstrapped: boolean; reason?: string }>;

  /**
   * Ingest a single message into the engine's store.
   */
  ingest(params: {
    sessionId: string;
    message: ChatMessage;
  }): Promise<IngestResult>;

  /**
   * Ingest a completed turn batch as a single atomic unit.
   */
  ingestBatch?(params: {
    sessionId: string;
    messages: ChatMessage[];
  }): Promise<{ ingestedCount: number }>;

  /**
   * Assemble model context under a token budget.
   * Returns an ordered set of messages ready for the model.
   */
  assemble(params: {
    sessionId: string;
    messages: ChatMessage[];
    tokenBudget?: number;
    model?: string;
    prompt?: string;
  }): Promise<AssembleResult>;

  /**
   * Compact context to reduce token usage.
   * May create summaries, prune old turns, etc.
   */
  compact?(params: {
    sessionId: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
  }): Promise<CompactResult>;

  /**
   * Execute optional post-turn lifecycle work.
   */
  afterTurn?(params: {
    sessionId: string;
    messages: ChatMessage[];
    prePromptMessageCount: number;
    tokenBudget?: number;
  }): Promise<void>;

  /**
   * Dispose of any resources held by the engine.
   */
  dispose?(): Promise<void>;
}
