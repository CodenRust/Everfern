"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockAIClient = createMockAIClient;
const vitest_1 = require("vitest");
/**
 * Creates a mock AI client for testing purposes
 */
function createMockAIClient() {
    return {
        provider: 'test',
        model: 'test-model',
        setModel: vitest_1.vi.fn(),
        chat: vitest_1.vi.fn().mockResolvedValue({
            content: 'Mock AI response',
            usage: { inputTokens: 10, outputTokens: 20 }
        }),
        streamChat: vitest_1.vi.fn(),
        getModels: vitest_1.vi.fn().mockResolvedValue([]),
        validateConnection: vitest_1.vi.fn().mockResolvedValue(true),
    };
}
