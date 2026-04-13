"use strict";
/**
 * EverFern Desktop — Tool Result Context Guard
 *
 * Guards against context window overflow by truncating tool results.
 * Inspired by OpenClaw's tool-result-context-guard.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREEMPTIVE_CONTEXT_OVERFLOW_MESSAGE = exports.PREEMPTIVE_TOOL_RESULT_COMPACTION_PLACEHOLDER = exports.CONTEXT_LIMIT_TRUNCATION_NOTICE = void 0;
exports.createContextGuard = createContextGuard;
const char_estimator_1 = require("./char-estimator");
const CONTEXT_INPUT_HEADROOM_RATIO = 0.75;
const SINGLE_TOOL_RESULT_CONTEXT_SHARE = 0.5;
const PREEMPTIVE_OVERFLOW_RATIO = 0.9;
exports.CONTEXT_LIMIT_TRUNCATION_NOTICE = '[truncated: output exceeded context limit]';
const CONTEXT_LIMIT_TRUNCATION_SUFFIX = `\n${exports.CONTEXT_LIMIT_TRUNCATION_NOTICE}`;
exports.PREEMPTIVE_TOOL_RESULT_COMPACTION_PLACEHOLDER = '[compacted: tool output removed to free context]';
exports.PREEMPTIVE_CONTEXT_OVERFLOW_MESSAGE = 'Preemptive context overflow: estimated context size exceeds safe threshold';
function createContextGuard(config) {
    const { contextWindowTokens, headroomRatio = CONTEXT_INPUT_HEADROOM_RATIO, singleResultShare = SINGLE_TOOL_RESULT_CONTEXT_SHARE, preemptiveOverflowRatio = PREEMPTIVE_OVERFLOW_RATIO } = config;
    const safeTokens = Math.max(1, Math.floor(contextWindowTokens));
    const contextBudgetChars = Math.max(1024, Math.floor(safeTokens * char_estimator_1.CHARS_PER_TOKEN_ESTIMATE * headroomRatio));
    const maxSingleToolResultChars = Math.max(1024, Math.floor(safeTokens * char_estimator_1.TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE * singleResultShare));
    const preemptiveOverflowChars = Math.max(contextBudgetChars, Math.floor(safeTokens * char_estimator_1.CHARS_PER_TOKEN_ESTIMATE * preemptiveOverflowRatio));
    function truncateTextToBudget(text, maxChars) {
        if (text.length <= maxChars)
            return text;
        if (maxChars <= 0)
            return exports.CONTEXT_LIMIT_TRUNCATION_NOTICE;
        const bodyBudget = Math.max(0, maxChars - CONTEXT_LIMIT_TRUNCATION_SUFFIX.length);
        if (bodyBudget <= 0)
            return exports.CONTEXT_LIMIT_TRUNCATION_NOTICE;
        let cutPoint = bodyBudget;
        const newline = text.lastIndexOf('\n', bodyBudget);
        if (newline > bodyBudget * 0.7) {
            cutPoint = newline;
        }
        return text.slice(0, cutPoint) + CONTEXT_LIMIT_TRUNCATION_SUFFIX;
    }
    function truncateToolResultToChars(msg, maxChars, cache) {
        if (!(0, char_estimator_1.isToolResultMessage)(msg))
            return msg;
        const estimatedChars = (0, char_estimator_1.estimateMessageCharsCached)(msg, cache);
        if (estimatedChars <= maxChars)
            return msg;
        const rawText = (0, char_estimator_1.getToolResultText)(msg);
        if (!rawText) {
            return { ...msg, content: exports.CONTEXT_LIMIT_TRUNCATION_NOTICE };
        }
        const truncatedText = truncateTextToBudget(rawText, maxChars);
        return { ...msg, content: truncatedText };
    }
    function applyMessageMutationInPlace(target, source, cache) {
        if (target === source)
            return;
        Object.assign(target, source);
        if (cache)
            (0, char_estimator_1.invalidateCacheEntry)(cache, target);
    }
    function enforceToolResultContextBudget(messages) {
        const cache = (0, char_estimator_1.createCharEstimateCache)();
        let truncated = 0;
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!(0, char_estimator_1.isToolResultMessage)(msg))
                continue;
            const before = (0, char_estimator_1.estimateMessageCharsCached)(msg, cache);
            if (before <= maxSingleToolResultChars)
                continue;
            const truncatedMsg = truncateToolResultToChars(msg, maxSingleToolResultChars, cache);
            applyMessageMutationInPlace(messages[i], truncatedMsg, cache);
            truncated++;
        }
        const currentChars = (0, char_estimator_1.estimateContextChars)(messages, cache);
        return { truncated, exceeded: currentChars > preemptiveOverflowChars };
    }
    function getContextStats(messages) {
        const cache = (0, char_estimator_1.createCharEstimateCache)();
        const totalChars = (0, char_estimator_1.estimateContextChars)(messages, cache);
        const toolResultCount = messages.filter(char_estimator_1.isToolResultMessage).length;
        const estimatedTokens = Math.ceil(totalChars / char_estimator_1.CHARS_PER_TOKEN_ESTIMATE);
        const headroomRatio = Math.max(0, 1 - (totalChars / contextBudgetChars));
        return { totalChars, toolResultCount, estimatedTokens, headroomRatio };
    }
    return {
        enforceToolResultContextBudget,
        getContextStats,
        contextBudgetChars,
        maxSingleToolResultChars,
        preemptiveOverflowChars,
        estimatedTokensLimit: safeTokens,
    };
}
