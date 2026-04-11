/**
 * EverFern Desktop — Temporal Memory Decay
 *
 * Adapted from openclaw/src/memory/temporal-decay.ts
 *
 * Applies biological-style exponential decay to memory search scores.
 * Older memories score progressively lower, preventing stale facts
 * from polluting the agent's reasoning.
 *
 * Formula: score * exp(-lambda * ageInDays)
 * where lambda = ln(2) / halfLifeDays
 *
 * With a 30-day half-life, a memory from 30 days ago scores 50%
 * of its original relevance. After 60 days, 25%. Etc.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type TemporalDecayConfig = {
  enabled: boolean;
  /** e.g. 30 means a memory from 30 days ago scores at 50% of original */
  halfLifeDays: number;
};

export const DEFAULT_TEMPORAL_DECAY_CONFIG: TemporalDecayConfig = {
  enabled: true,
  halfLifeDays: 30,
};

// ── Core Math ────────────────────────────────────────────────────────

/**
 * Returns the exponential decay lambda for a given half-life.
 */
export function toDecayLambda(halfLifeDays: number): number {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 0;
  return Math.LN2 / halfLifeDays;
}

/**
 * Calculates the decay multiplier (0..1) for a given memory age.
 */
export function calculateDecayMultiplier(params: {
  ageInDays: number;
  halfLifeDays: number;
}): number {
  const lambda = toDecayLambda(params.halfLifeDays);
  const clamped = Math.max(0, params.ageInDays);
  if (lambda <= 0 || !Number.isFinite(clamped)) return 1;
  return Math.exp(-lambda * clamped);
}

/**
 * Applies temporal decay to a single relevance score.
 */
export function applyDecayToScore(params: {
  score: number;
  ageInDays: number;
  halfLifeDays: number;
}): number {
  return params.score * calculateDecayMultiplier(params);
}

// ── Result Ranking ───────────────────────────────────────────────────

export type DecayableResult = {
  /** File path or unique key for this memory entry */
  path: string;
  /** Relevance score (0..1) before decay */
  score: number;
  /** ISO timestamp string when memory was created/modified */
  timestamp?: string;
};

/**
 * Apply temporal decay to a ranked list of memory search results.
 * Results without a timestamp are treated as evergreen and not decayed.
 */
export function applyDecayToResults<T extends DecayableResult>(
  results: T[],
  config: Partial<TemporalDecayConfig> = {},
  nowMs: number = Date.now(),
): T[] {
  const cfg = { ...DEFAULT_TEMPORAL_DECAY_CONFIG, ...config };
  if (!cfg.enabled) return [...results];

  return results.map((entry) => {
    if (!entry.timestamp) {
      // Evergreen memory — no decay
      return entry;
    }

    const ts = new Date(entry.timestamp).getTime();
    if (!Number.isFinite(ts)) return entry;

    const ageMs = Math.max(0, nowMs - ts);
    const ageInDays = ageMs / DAY_MS;

    return {
      ...entry,
      score: applyDecayToScore({
        score: entry.score,
        ageInDays,
        halfLifeDays: cfg.halfLifeDays,
      }),
    };
  });
}
