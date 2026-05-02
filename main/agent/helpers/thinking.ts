/**
 * EverFern Desktop — Thinking/Reasoning Support
 * 
 * Handles thinking/reasoning parameters for models that support it:
 * - NVIDIA NIM (nemotron, etc.)
 * - OpenAI o1/o3 models
 * - DeepSeek reasoner
 */

export type ThinkLevel = 'off' | 'low' | 'medium' | 'high';

export interface ChatRequestWithExtras {
    messages: unknown[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    tools?: unknown[];
    extraBody?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ThinkingConfig {
    enabled: boolean;
    level?: ThinkLevel;
    budget?: number; // tokens
}

export interface ModelThinkingCapabilities {
    supportsThinking: boolean;
    defaultLevel: ThinkLevel;
    supportedLevels: ThinkLevel[];
    maxBudget: number;
    usesExtraBody: boolean; // vs native thinking parameter
}

// Models that support thinking via extra_body (NVIDIA NIM style)
const EXTRA_BODY_THINKING_MODELS = [
    'nvidia/nemotron',
    'qwen',
    'deepseek-v4-pro',
    'gemma',
];

// Models with native thinking support
const NATIVE_THINKING_MODELS = [
    'o1',
    'o3',
    'o4',
    'claude',
];

export function getModelThinkingCapabilities(modelId: string): ModelThinkingCapabilities {
    const lower = modelId.toLowerCase();
    
    // NVIDIA NIM models with thinking
    if (EXTRA_BODY_THINKING_MODELS.some(m => lower.includes(m))) {
        return {
            supportsThinking: true,
            defaultLevel: 'medium',
            supportedLevels: ['off', 'low', 'medium', 'high'],
            maxBudget: 16384,
            usesExtraBody: true
        };
    }
    
    // Native thinking (Anthropic, OpenAI o1/o3)
    if (NATIVE_THINKING_MODELS.some(m => lower.includes(m))) {
        return {
            supportsThinking: true,
            defaultLevel: 'medium',
            supportedLevels: ['off', 'low', 'medium', 'high'],
            maxBudget: 200000,
            usesExtraBody: false
        };
    }
    
    return {
        supportsThinking: false,
        defaultLevel: 'off',
        supportedLevels: ['off'],
        maxBudget: 0,
        usesExtraBody: false
    };
}

export function buildThinkingParams(
    modelId: string,
    config: ThinkingConfig
): Record<string, unknown> | null {
    if (!config.enabled || !config.budget) return null;
    
    const caps = getModelThinkingCapabilities(modelId);
    if (!caps.supportsThinking) return null;
    
    const level = config.level || caps.defaultLevel;
    const budget = Math.min(config.budget, caps.maxBudget);
    
    if (caps.usesExtraBody) {
        // NVIDIA NIM style
        const levelToBudget: Record<ThinkLevel, number> = {
            off: 0,
            low: 1024,
            medium: 4096,
            high: budget
        };
        
        return {
            chat_template_kwargs: {
                enable_thinking: level !== 'off'
            },
            reasoning_budget: levelToBudget[level] || 0
        };
    }
    
    // Native thinking parameter (could be extended for other providers)
    return null;
}

export function applyThinkingToRequest(
    request: ChatRequestWithExtras,
    modelId: string,
    config: ThinkingConfig
): ChatRequestWithExtras {
    const extraBodyParams = buildThinkingParams(modelId, config);
    
    if (!extraBodyParams) {
        return request;
    }
    
    return {
        ...request,
        extraBody: {
            ...(request.extraBody as Record<string, unknown> || {}),
            ...extraBodyParams
        }
    };
}

export function estimateThinkingTokens(response: string): number {
    // Rough estimate based on thinking tag content
    const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
        const thinkContent = thinkMatch[1];
        // ~4 chars per token
        return Math.ceil(thinkContent.length / 4);
    }
    return 0;
}

export function shouldShowThinking(thinkLevel: ThinkLevel): boolean {
    return thinkLevel !== 'off';
}

export function getThinkLevelFromString(level: string): ThinkLevel {
    const lower = level.toLowerCase().trim();
    if (lower === 'off' || lower === '0') return 'off';
    if (lower === 'low' || lower === '1') return 'low';
    if (lower === 'medium' || lower === '2') return 'medium';
    if (lower === 'high' || lower === '3') return 'high';
    return 'medium'; // default
}
