"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TEMPORAL_DECAY_CONFIG = void 0;
exports.toDecayLambda = toDecayLambda;
exports.calculateDecayMultiplier = calculateDecayMultiplier;
exports.applyDecayToScore = applyDecayToScore;
exports.applyDecayToResults = applyDecayToResults;
const DAY_MS = 24 * 60 * 60 * 1000;
exports.DEFAULT_TEMPORAL_DECAY_CONFIG = {
    enabled: true,
    halfLifeDays: 30,
};
// ── Core Math ────────────────────────────────────────────────────────
/**
 * Returns the exponential decay lambda for a given half-life.
 */
function toDecayLambda(halfLifeDays) {
    if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0)
        return 0;
    return Math.LN2 / halfLifeDays;
}
/**
 * Calculates the decay multiplier (0..1) for a given memory age.
 */
function calculateDecayMultiplier(params) {
    const lambda = toDecayLambda(params.halfLifeDays);
    const clamped = Math.max(0, params.ageInDays);
    if (lambda <= 0 || !Number.isFinite(clamped))
        return 1;
    return Math.exp(-lambda * clamped);
}
/**
 * Applies temporal decay to a single relevance score.
 */
function applyDecayToScore(params) {
    return params.score * calculateDecayMultiplier(params);
}
/**
 * Apply temporal decay to a ranked list of memory search results.
 * Results without a timestamp are treated as evergreen and not decayed.
 */
function applyDecayToResults(results, config = {}, nowMs = Date.now()) {
    const cfg = { ...exports.DEFAULT_TEMPORAL_DECAY_CONFIG, ...config };
    if (!cfg.enabled)
        return [...results];
    return results.map((entry) => {
        if (!entry.timestamp) {
            // Evergreen memory — no decay
            return entry;
        }
        const ts = new Date(entry.timestamp).getTime();
        if (!Number.isFinite(ts))
            return entry;
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
