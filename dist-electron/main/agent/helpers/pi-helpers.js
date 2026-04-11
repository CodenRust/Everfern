"use strict";
/**
 * EverFern Desktop — Pi Helpers
 *
 * OpenClaw-style helpers for agent execution:
 * - Error classification
 * - Failover handling
 * - Message deduplication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeThinkLevel = normalizeThinkLevel;
exports.extractSupportedThinkLevels = extractSupportedThinkLevels;
exports.pickFallbackThinkLevel = pickFallbackThinkLevel;
exports.classifyFailoverReason = classifyFailoverReason;
exports.shouldRetry = shouldRetry;
exports.getRetryDelay = getRetryDelay;
exports.createMessageDeduplicator = createMessageDeduplicator;
exports.categorizeToolResult = categorizeToolResult;
function normalizeThinkLevel(level) {
    const normalized = level.toLowerCase().trim();
    if (normalized === 'off' || normalized === '0')
        return 'off';
    if (normalized === 'low' || normalized === '1')
        return 'low';
    if (normalized === 'medium' || normalized === '2')
        return 'medium';
    if (normalized === 'high' || normalized === '3')
        return 'high';
    return undefined;
}
function extractSupportedThinkLevels(raw) {
    const match = raw.match(/supported values are:\s*([^\n.]+)/i) ??
        raw.match(/supported values:\s*([^\n.]+)/i);
    if (!match?.[1])
        return [];
    const fragment = match[1];
    const quoted = Array.from(fragment.matchAll(/['"]([^'"]+)['"]/g))
        .map(entry => entry[1]?.trim())
        .filter(Boolean);
    if (quoted.length > 0)
        return quoted.filter((e) => Boolean(e));
    return fragment
        .split(/,|\band\b/gi)
        .map(entry => entry.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim())
        .filter(Boolean);
}
function pickFallbackThinkLevel(params) {
    const raw = params.message?.trim();
    if (!raw)
        return undefined;
    const supported = extractSupportedThinkLevels(raw);
    if (supported.length === 0) {
        if (/not supported/i.test(raw) && !params.attempted.has('off')) {
            return 'off';
        }
        return undefined;
    }
    for (const entry of supported) {
        const normalized = normalizeThinkLevel(entry);
        if (!normalized)
            continue;
        if (params.attempted.has(normalized))
            continue;
        return normalized;
    }
    return undefined;
}
function classifyFailoverReason(error) {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    if (/rate.limit|429|too many requests/i.test(lower))
        return 'rate_limit';
    if (/timeout|timed.out|etimedout/i.test(lower))
        return 'timeout';
    if (/context|token.limit|max.*tokens|content.*too long/i.test(lower))
        return 'context_overflow';
    if (/auth|api.key|unauthorized|401|403/i.test(lower))
        return 'auth_error';
    if (/not found|404|model.*not.*found/i.test(lower))
        return 'model_not_found';
    if (/billing|payment|quota|credit/i.test(lower))
        return 'billing_error';
    return 'unknown';
}
function shouldRetry(reason) {
    return ['rate_limit', 'timeout', 'context_overflow'].includes(reason);
}
function getRetryDelay(reason, attempt) {
    const baseDelays = {
        rate_limit: 1000,
        timeout: 2000,
        context_overflow: 500,
        auth_error: 0,
        model_not_found: 0,
        billing_error: 0,
        unknown: 3000
    };
    const base = baseDelays[reason];
    const jitter = Math.random() * 0.2 * base;
    return Math.min(base * Math.pow(2, attempt) + jitter, 30000);
}
// Message deduplication
function createMessageDeduplicator() {
    const seen = new Set();
    return {
        isDuplicate(msg) {
            const key = msg.id || String(msg.content);
            if (seen.has(key))
                return true;
            seen.add(key);
            return false;
        },
        clear() {
            seen.clear();
        }
    };
}
function categorizeToolResult(result) {
    if (!result || result.trim().length === 0)
        return 'empty';
    if (result.includes('[truncated') || result.includes('[compacted'))
        return 'truncated';
    if (/error|failed|exception|cannot|unable/i.test(result))
        return 'error';
    return 'success';
}
