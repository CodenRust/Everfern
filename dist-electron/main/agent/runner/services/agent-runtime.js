"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgentStep = runAgentStep;
const ai_client_1 = require("../../../lib/ai-client");
const text_to_tool_1 = require("../../parsers/text-to-tool");
const message_utils_1 = require("./message-utils");
/**
 * Reusable agent execution logic for calling the model and processing its response.
 */
async function runAgentStep(state, options) {
    const { runner, toolDefs, eventQueue, maxVerifyRetries = 3, systemPromptOverride, nodeName } = options;
    runner.telemetry.transition(nodeName);
    const iterations = state.iterations || 0;
    runner.telemetry.metrics(iterations);
    let client = runner.client;
    let verifyIntentRetries = 0; // In a real state machine, this might be in state
    // Optima: Normalization
    const normalizedMessages = (0, message_utils_1.normalizeMessages)(state.messages);
    // Inject system prompt override if provided
    if (systemPromptOverride && normalizedMessages.length > 0 && normalizedMessages[0].role === 'system') {
        normalizedMessages[0].content = systemPromptOverride;
    }
    // Vision Grounding check (simplified for now)
    const lastMsgContent = state.messages[state.messages.length - 1]?.content || '';
    const vlm = runner.config.vlm;
    if (iterations === 0 && vlm?.model && runner.shouldCaptureScreenshot(lastMsgContent)) {
        client = new ai_client_1.AIClient({ ...vlm, provider: vlm.provider });
    }
    let thoughtBuffer = '';
    let isThinking = false;
    let streamedText = '';
    const prunedMessages = normalizedMessages.map((m, idx) => {
        // Basic context pruning for images
        if (m.role === "user" && Array.isArray(m.content)) {
            const hasImage = m.content.some((c) => c.type === 'image_url');
            if (hasImage) {
                const futureImages = normalizedMessages.slice(idx + 1).filter((fm) => Array.isArray(fm.content) && fm.content.some((fc) => fc.type === 'image_url')).length;
                if (futureImages >= 2) {
                    return {
                        ...m,
                        content: m.content.map((c) => c.type === 'image_url' ? { type: 'text', text: '[Screenshot Omitted]' } : c)
                    };
                }
            }
        }
        return m;
    });
    const request = {
        messages: prunedMessages,
        tools: toolDefs,
        onStreamChunk: (chunk) => {
            thoughtBuffer += chunk;
            const hasStart = thoughtBuffer.includes('<think>') || thoughtBuffer.includes('<thought>');
            const hasEnd = thoughtBuffer.includes('</think>') || thoughtBuffer.includes('</thought>');
            if (!isThinking && hasStart) {
                isThinking = true;
                const tag = thoughtBuffer.includes('<think>') ? '<think>' : '<thought>';
                const parts = thoughtBuffer.split(tag);
                if (parts[0]) {
                    eventQueue?.push({ type: 'chunk', content: parts[0] });
                    streamedText += parts[0];
                }
                if (parts[1])
                    eventQueue?.push({ type: 'thought', content: parts[1] });
                thoughtBuffer = '';
            }
            else if (isThinking && hasEnd) {
                isThinking = false;
                const tag = thoughtBuffer.includes('</think>') ? '</think>' : '</thought>';
                const parts = thoughtBuffer.split(tag);
                if (parts[0])
                    eventQueue?.push({ type: 'thought', content: parts[0] });
                if (parts[1]) {
                    eventQueue?.push({ type: 'chunk', content: parts[1] });
                    streamedText += parts[1];
                }
                thoughtBuffer = '';
            }
            else if (isThinking) {
                eventQueue?.push({ type: 'thought', content: chunk });
                thoughtBuffer = '';
            }
            else {
                const trimmed = thoughtBuffer.trim();
                if (!trimmed.startsWith('{') && !trimmed.startsWith('<')) {
                    eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
                    streamedText += thoughtBuffer;
                    thoughtBuffer = '';
                }
                else if (thoughtBuffer.length > 20) {
                    eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
                    streamedText += thoughtBuffer;
                    thoughtBuffer = '';
                }
            }
        },
    };
    const response = await client.chat(request);
    if (response.usage) {
        eventQueue?.push({ type: 'usage', ...response.usage });
    }
    // Tool Call Parsing & Nudging
    let textContent = typeof response.content === 'string' ? response.content : '';
    if (Array.isArray(response.content)) {
        textContent = response.content.map((c) => 'text' in c ? c.text : '').join('\n');
    }
    const scrubbed = textContent.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/ig, '').trim();
    // If model didn't provide tool calls but intent requires them, parse or nudge
    if (!response.toolCalls || response.toolCalls.length === 0) {
        const parserResult = (0, text_to_tool_1.parseTextToToolCalls)(textContent, runner.tools);
        if (parserResult.toolCalls.length > 0) {
            response.toolCalls = parserResult.toolCalls;
        }
    }
    const assistantMsg = {
        role: 'assistant',
        content: scrubbed,
        tool_calls: response.toolCalls,
    };
    if (response.finishReason !== 'tool_calls' && scrubbed && !streamedText) {
        eventQueue?.push({ type: 'chunk', content: scrubbed });
    }
    return {
        messages: [assistantMsg],
        pendingToolCalls: response.toolCalls ?? [],
        iterations: iterations + 1,
        finalResponse: response.finishReason !== 'tool_calls' ? scrubbed : '',
    };
}
