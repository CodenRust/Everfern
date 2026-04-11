/**
 * EverFern Desktop — Tool Result Context Guard
 * 
 * Guards against context window overflow by truncating tool results.
 * Inspired by OpenClaw's tool-result-context-guard.ts
 */

import {
    CHARS_PER_TOKEN_ESTIMATE,
    TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE,
    type Message,
    type CharEstimateCache,
    createCharEstimateCache,
    estimateContextChars,
    estimateMessageCharsCached,
    getToolResultText,
    isToolResultMessage,
    invalidateCacheEntry,
} from './char-estimator';

const CONTEXT_INPUT_HEADROOM_RATIO = 0.75;
const SINGLE_TOOL_RESULT_CONTEXT_SHARE = 0.5;
const PREEMPTIVE_OVERFLOW_RATIO = 0.9;

export const CONTEXT_LIMIT_TRUNCATION_NOTICE = '[truncated: output exceeded context limit]';
const CONTEXT_LIMIT_TRUNCATION_SUFFIX = `\n${CONTEXT_LIMIT_TRUNCATION_NOTICE}`;

export const PREEMPTIVE_TOOL_RESULT_COMPACTION_PLACEHOLDER = '[compacted: tool output removed to free context]';

export const PREEMPTIVE_CONTEXT_OVERFLOW_MESSAGE = 'Preemptive context overflow: estimated context size exceeds safe threshold';

interface ContextGuardConfig {
    contextWindowTokens: number;
    headroomRatio?: number;
    singleResultShare?: number;
    preemptiveOverflowRatio?: number;
}

export function createContextGuard(config: ContextGuardConfig) {
    const {
        contextWindowTokens,
        headroomRatio = CONTEXT_INPUT_HEADROOM_RATIO,
        singleResultShare = SINGLE_TOOL_RESULT_CONTEXT_SHARE,
        preemptiveOverflowRatio = PREEMPTIVE_OVERFLOW_RATIO
    } = config;

    const safeTokens = Math.max(1, Math.floor(contextWindowTokens));
    
    const contextBudgetChars = Math.max(
        1024,
        Math.floor(safeTokens * CHARS_PER_TOKEN_ESTIMATE * headroomRatio)
    );
    
    const maxSingleToolResultChars = Math.max(
        1024,
        Math.floor(safeTokens * TOOL_RESULT_CHARS_PER_TOKEN_ESTIMATE * singleResultShare)
    );
    
    const preemptiveOverflowChars = Math.max(
        contextBudgetChars,
        Math.floor(safeTokens * CHARS_PER_TOKEN_ESTIMATE * preemptiveOverflowRatio)
    );

    function truncateTextToBudget(text: string, maxChars: number): string {
        if (text.length <= maxChars) return text;
        if (maxChars <= 0) return CONTEXT_LIMIT_TRUNCATION_NOTICE;

        const bodyBudget = Math.max(0, maxChars - CONTEXT_LIMIT_TRUNCATION_SUFFIX.length);
        if (bodyBudget <= 0) return CONTEXT_LIMIT_TRUNCATION_NOTICE;

        let cutPoint = bodyBudget;
        const newline = text.lastIndexOf('\n', bodyBudget);
        if (newline > bodyBudget * 0.7) {
            cutPoint = newline;
        }

        return text.slice(0, cutPoint) + CONTEXT_LIMIT_TRUNCATION_SUFFIX;
    }

    function truncateToolResultToChars(msg: Message, maxChars: number, cache: CharEstimateCache): Message {
        if (!isToolResultMessage(msg)) return msg;

        const estimatedChars = estimateMessageCharsCached(msg, cache);
        if (estimatedChars <= maxChars) return msg;

        const rawText = getToolResultText(msg);
        if (!rawText) {
            return { ...msg, content: CONTEXT_LIMIT_TRUNCATION_NOTICE };
        }

        const truncatedText = truncateTextToBudget(rawText, maxChars);
        return { ...msg, content: truncatedText };
    }

    function applyMessageMutationInPlace(target: Message, source: Message, cache?: CharEstimateCache): void {
        if (target === source) return;
        
        Object.assign(target, source);
        if (cache) invalidateCacheEntry(cache, target);
    }

    function enforceToolResultContextBudget(messages: Message[]): { truncated: number; exceeded: boolean } {
        const cache = createCharEstimateCache();
        let truncated = 0;

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (!isToolResultMessage(msg)) continue;

            const before = estimateMessageCharsCached(msg, cache);
            if (before <= maxSingleToolResultChars) continue;

            const truncatedMsg = truncateToolResultToChars(msg, maxSingleToolResultChars, cache);
            applyMessageMutationInPlace(messages[i], truncatedMsg, cache);
            truncated++;
        }

        const currentChars = estimateContextChars(messages, cache);
        return { truncated, exceeded: currentChars > preemptiveOverflowChars };
    }

    function getContextStats(messages: Message[]): {
        totalChars: number;
        toolResultCount: number;
        estimatedTokens: number;
        headroomRatio: number;
    } {
        const cache = createCharEstimateCache();
        const totalChars = estimateContextChars(messages, cache);
        const toolResultCount = messages.filter(isToolResultMessage).length;
        const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN_ESTIMATE);
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

export type ContextGuard = ReturnType<typeof createContextGuard>;
