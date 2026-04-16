"use strict";
/**
 * Tests for provider-related preload bridge functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Preload Provider Types', () => {
    (0, vitest_1.it)('should have correct ProviderMeta interface structure', () => {
        const mockProvider = {
            type: 'anthropic',
            name: 'Anthropic',
            description: 'Claude models',
            requiresApiKey: true,
            isLocal: false,
            defaultModel: 'claude-sonnet-4-20250514',
            engine: 'online',
            baseUrl: 'https://api.anthropic.com'
        };
        (0, vitest_1.expect)(mockProvider.type).toBe('anthropic');
        (0, vitest_1.expect)(mockProvider.name).toBe('Anthropic');
        (0, vitest_1.expect)(mockProvider.requiresApiKey).toBe(true);
        (0, vitest_1.expect)(mockProvider.isLocal).toBe(false);
        (0, vitest_1.expect)(mockProvider.engine).toBe('online');
    });
    (0, vitest_1.it)('should have correct FlatModelEntry interface structure', () => {
        const mockModel = {
            id: 'claude-sonnet-4-20250514',
            name: 'Claude Sonnet 4',
            provider: 'Anthropic',
            providerType: 'anthropic'
        };
        (0, vitest_1.expect)(mockModel.id).toBe('claude-sonnet-4-20250514');
        (0, vitest_1.expect)(mockModel.name).toBe('Claude Sonnet 4');
        (0, vitest_1.expect)(mockModel.provider).toBe('Anthropic');
        (0, vitest_1.expect)(mockModel.providerType).toBe('anthropic');
    });
    (0, vitest_1.it)('should support all provider types', () => {
        const providerTypes = [
            'openai',
            'anthropic',
            'deepseek',
            'ollama',
            'ollama-cloud',
            'lmstudio',
            'everfern',
            'gemini',
            'nvidia',
            'openrouter'
        ];
        providerTypes.forEach(type => {
            const provider = {
                type,
                name: 'Test Provider',
                description: 'Test',
                requiresApiKey: false,
                isLocal: false,
                defaultModel: 'test-model',
                engine: 'online'
            };
            (0, vitest_1.expect)(provider.type).toBe(type);
        });
    });
});
