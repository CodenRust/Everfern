/**
 * EverFern Desktop — Tool Loop Detection
 *
 * Adapted from openclaw/src/agents/tool-loop-detection.ts
 *
 * Detects when the agent is stuck in a repetitive tool call loop and
 * intervenes before wasting quota or hanging indefinitely.
 *
 * Three detectors:
 *   generic_repeat       — same tool + args called N times
 *   known_poll_no_progress — polling tool returns same result repeatedly
 *   ping_pong            — agent alternates between two identical patterns
 *
 * Plus a global circuit breaker that hard-stops at 15 no-progress calls.
 *
 * Thresholds (tuned for EverFern's maxIterations=20):
 *   warning  = 5  calls
 *   critical = 10 calls
 *   breaker  = 15 calls
 */

import { createHash } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────

export type LoopDetectorKind =
  | 'generic_repeat'
  | 'known_poll_no_progress'
  | 'global_circuit_breaker'
  | 'ping_pong';

export type LoopDetectionResult =
  | { stuck: false }
  | {
      stuck: true;
      level: 'warning' | 'critical';
      detector: LoopDetectorKind;
      count: number;
      message: string;
      pairedToolName?: string;
    };

export type ToolCallHistoryEntry = {
  toolName: string;
  argsHash: string;
  resultHash?: string;
  timestamp: number;
};

export type LoopDetectionConfig = {
  enabled: boolean;
  historySize: number;
  warningThreshold: number;
  criticalThreshold: number;
  globalCircuitBreakerThreshold: number;
};

const DEFAULT_CONFIG: LoopDetectionConfig = {
  enabled: true,
  historySize: 30,
  warningThreshold: 3,     // Warn after 3 identical calls
  criticalThreshold: 5,    // Stop and pivot after 5 identical calls
  globalCircuitBreakerThreshold: 8, // Hard stop after 8 identical failures
};

// ── Hashing ──────────────────────────────────────────────────────────

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function digest(value: unknown): string {
  try {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
  } catch {
    return createHash('sha256').update(String(value)).digest('hex');
  }
}

export function hashToolCall(toolName: string, params: unknown): string {
  return `${toolName}:${digest(params)}`;
}

function getFuzzyString(value: unknown): string {
  const str = typeof value === 'string' ? value : stableStringify(value);
  return str
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<TIMESTAMP>') 
    .replace(/\b\d{1,2}:\d{2}:\d{2}(?: [AP]M)?\b/gi, '<TIME>') 
    .replace(/(pid|PID)[:=]\s*\d+/gi, 'PID=<PID>') 
    .replace(/\b(?:0x)?[0-9a-fA-F]{8,}\b/g, '<HEX>') 
    .replace(/\b\d+(?:\.\d+)?(ms|s|m|h|d)\b/gi, '<DURATION>') 
    .replace(/in \d+(?:\.\d+)?\s?(ms|s)/gi, 'in <DURATION>')
    .replace(/\b\d{10,13}\b/g, '<UNIX_TIME>');
}

function hashToolOutcome(result: unknown, error: unknown): string {
  if (error !== undefined) return `error:${digest(getFuzzyString(String(error)))}`;
  return digest(getFuzzyString(result));
}

// ── Helpers ──────────────────────────────────────────────────────────

function getNoProgressStreak(
  history: ToolCallHistoryEntry[],
  toolName: string,
  argsHash: string,
): number {
  let streak = 0;
  let latestResultHash: string | undefined;

  for (let i = history.length - 1; i >= 0; i--) {
    const record = history[i];
    if (!record || record.toolName !== toolName || record.argsHash !== argsHash) continue;
    if (!record.resultHash) continue;
    if (!latestResultHash) {
      latestResultHash = record.resultHash;
      streak = 1;
      continue;
    }
    if (record.resultHash !== latestResultHash) break;
    streak++;
  }
  return streak;
}

function getPingPongStreak(
  history: ToolCallHistoryEntry[],
  currentHash: string,
): { count: number; pairedToolName?: string; noProgressEvidence: boolean } {
  const last = history.at(-1);
  if (!last) return { count: 0, noProgressEvidence: false };

  let otherHash: string | undefined;
  let otherToolName: string | undefined;
  for (let i = history.length - 2; i >= 0; i--) {
    const call = history[i];
    if (!call) continue;
    if (call.argsHash !== last.argsHash) {
      otherHash = call.argsHash;
      otherToolName = call.toolName;
      break;
    }
  }

  if (!otherHash || !otherToolName) return { count: 0, noProgressEvidence: false };

  let alternatingCount = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const call = history[i];
    if (!call) continue;
    const expected = alternatingCount % 2 === 0 ? last.argsHash : otherHash;
    if (call.argsHash !== expected) break;
    alternatingCount++;
  }

  if (alternatingCount < 2) return { count: 0, noProgressEvidence: false };
  if (currentHash !== otherHash) return { count: 0, noProgressEvidence: false };

  return {
    count: alternatingCount + 1,
    pairedToolName: last.toolName,
    noProgressEvidence: true,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Detect if the agent is stuck in a repetitive tool call loop.
 * Call this BEFORE executing each tool to get early warning.
 */
export function detectToolCallLoop(
  history: ToolCallHistoryEntry[],
  toolName: string,
  params: unknown,
  config: Partial<LoopDetectionConfig> = {},
): LoopDetectionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enabled) return { stuck: false };

  const currentHash = hashToolCall(toolName, params);
  const noProgressStreak = getNoProgressStreak(history, toolName, currentHash);
  const pingPong = getPingPongStreak(history, currentHash);

  // Global circuit breaker
  if (noProgressStreak >= cfg.globalCircuitBreakerThreshold) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'global_circuit_breaker',
      count: noProgressStreak,
      message: `🚨 CIRCUIT BREAKER: "${toolName}" repeated ${noProgressStreak} times with identical no-progress outcomes. Execution halted to prevent runaway loop. Report the task as failed.`,
    };
  }

  // Known poll no-progress (critical)
  if (noProgressStreak >= cfg.criticalThreshold) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'known_poll_no_progress',
      count: noProgressStreak,
      message: `🚨 CRITICAL LOOP: Called "${toolName}" ${noProgressStreak} times with no progress. Stop and pivot your strategy — try a completely different approach or report failure.`,
    };
  }

  // Ping-pong (critical)
  if (pingPong.count >= cfg.criticalThreshold && pingPong.noProgressEvidence) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'ping_pong',
      count: pingPong.count,
      pairedToolName: pingPong.pairedToolName,
      message: `🚨 PING-PONG LOOP: Alternating between the same two tool patterns ${pingPong.count} times with no progress. Stop immediately and try a different strategy.`,
    };
  }

  // Generic repeat (absolute fallback without checking result Hash)
  const recentCount = history.filter(
    (h) => h.toolName === toolName && h.argsHash === currentHash,
  ).length;

  if (recentCount >= cfg.globalCircuitBreakerThreshold) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'global_circuit_breaker',
      count: recentCount,
      message: `🚨 CIRCUIT BREAKER: "${toolName}" called ${recentCount} times with strictly IDENTICAL arguments. Execution halted to prevent runaway loop regardless of output.`,
    };
  }

  if (recentCount >= cfg.criticalThreshold) {
    return {
      stuck: true,
      level: 'critical',
      detector: 'generic_repeat',
      count: recentCount,
      message: `🚨 CRITICAL LOOP: Called "${toolName}" ${recentCount} times with strictly IDENTICAL arguments. Stop and pivot.`,
    };
  }

  if (recentCount >= cfg.warningThreshold) {
    return {
      stuck: true,
      level: 'warning',
      detector: 'generic_repeat',
      count: recentCount,
      message: `⚠️ LOOP WARNING: Called "${toolName}" ${recentCount} times with identical arguments. If this is not making progress, pivot strategy or report failure.`,
    };
  }

  // Ping-pong (warning)
  if (pingPong.count >= cfg.warningThreshold) {
    return {
      stuck: true,
      level: 'warning',
      detector: 'ping_pong',
      count: pingPong.count,
      pairedToolName: pingPong.pairedToolName,
      message: `⚠️ PING-PONG WARNING: Alternating between the same two patterns ${pingPong.count} times. Stop retrying if no progress is being made.`,
    };
  }

  return { stuck: false };
}

/**
 * Record a tool call in the history window (call before execution).
 */
export function recordToolCall(
  history: ToolCallHistoryEntry[],
  toolName: string,
  params: unknown,
  config: Partial<LoopDetectionConfig> = {},
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  history.push({
    toolName,
    argsHash: hashToolCall(toolName, params),
    timestamp: Date.now(),
  });
  if (history.length > cfg.historySize) {
    history.shift();
  }
}

/**
 * Record the outcome of a tool call (call after execution).
 * Updates the most recent matching entry with a result hash.
 */
export function recordToolOutcome(
  history: ToolCallHistoryEntry[],
  toolName: string,
  params: unknown,
  result: unknown,
  error?: unknown,
): void {
  const argsHash = hashToolCall(toolName, params);
  const resultHash = hashToolOutcome(result, error);

  for (let i = history.length - 1; i >= 0; i--) {
    const call = history[i];
    if (!call || call.toolName !== toolName || call.argsHash !== argsHash) continue;
    if (call.resultHash !== undefined) continue;
    call.resultHash = resultHash;
    break;
  }
}
