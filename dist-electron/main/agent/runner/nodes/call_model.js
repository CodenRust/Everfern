"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCallModelNode = void 0;
const crypto = __importStar(require("crypto"));
const ai_client_1 = require("../../../lib/ai-client");
const text_to_tool_1 = require("../../parsers/text-to-tool");
const createCallModelNode = (runner, toolDefs, eventQueue, maxIterations = 10, maxVerifyRetries = 3) => {
    let verifyIntentRetries = 0;
    return async (state) => {
        runner.telemetry.transition('call_model');
        runner.telemetry.metrics(state.iterations);
        const iterations = state.iterations;
        let client = runner.client;
        let modelUsed = client.model;
        // ── Vision Grounding ───────────────────────────────────────────────────
        const vlm = runner.config.vlm;
        const needsVisionGrounding = iterations === 0 &&
            vlm?.model &&
            vlm?.provider &&
            runner.shouldCaptureScreenshot(state.messages[state.messages.length - 1]?.content || '');
        if (needsVisionGrounding && vlm) {
            runner.telemetry.info(`🔭 Vision Grounding: Analyzing workspace footprint with ${vlm.model} (${vlm.provider})`);
            client = new ai_client_1.AIClient({
                provider: vlm.provider,
                apiKey: vlm.apiKey,
                model: vlm.model,
                baseUrl: vlm.baseUrl
            });
            modelUsed = vlm.model;
        }
        // Telemetry Update
        runner.telemetry.metrics(iterations);
        let thoughtBuffer = '';
        let isThinking = false;
        // Optima: Context Pruning
        const prunedMessages = state.messages.map((m, idx) => {
            if (m.role === "user")
                return m;
            if (typeof m.content === 'string')
                return m;
            const hasImage = m.content.some((c) => c.type === 'image_url');
            if (!hasImage)
                return m;
            const futureImages = state.messages.slice(idx + 1).filter((fm) => Array.isArray(fm.content) && fm.content.some((fc) => fc.type === 'image_url')).length;
            if (futureImages >= 2) {
                return {
                    ...m,
                    content: m.content.map((c) => c.type === 'image_url' ? { type: 'text', text: '[Screenshot Omitted to Save Tokens]' } : c)
                };
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
                    const content = thoughtBuffer.split(tag)[1];
                    if (content)
                        eventQueue?.push({ type: 'thought', content });
                    thoughtBuffer = '';
                }
                else if (isThinking && hasEnd) {
                    isThinking = false;
                    const tag = thoughtBuffer.includes('</think>') ? '</think>' : '</thought>';
                    const contentBeforeEnd = thoughtBuffer.split(tag)[0];
                    if (contentBeforeEnd)
                        eventQueue?.push({ type: 'thought', content: contentBeforeEnd });
                    thoughtBuffer = '';
                }
                else if (isThinking) {
                    eventQueue?.push({ type: 'thought', content: chunk });
                    thoughtBuffer = '';
                }
                else {
                    if (!thoughtBuffer.trim().startsWith('{') && !thoughtBuffer.trim().startsWith('```')) {
                        eventQueue?.push({ type: 'thought', content: chunk });
                    }
                }
            },
            userConfirmation: state.userConfirmation,
        };
        const response = await client.chat(request);
        if (response.usage) {
            const usage = response.usage;
            runner.telemetry.info(`Model resonance confirmed | Tokens: In=${usage.promptTokens}, Out=${usage.completionTokens}`);
            runner.telemetry.metrics(iterations, usage.totalTokens);
            eventQueue?.push({
                type: 'usage',
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
            });
        }
        if (!response.toolCalls || response.toolCalls.length === 0) {
            let textContent = typeof response.content === 'string'
                ? response.content
                : Array.isArray(response.content)
                    ? response.content.map((c) => 'text' in c ? c.text : '').join('\n')
                    : '';
            const parserResult = (0, text_to_tool_1.parseTextToToolCalls)(textContent, runner.tools);
            if (parserResult.toolCalls.length > 0) {
                response.toolCalls = parserResult.toolCalls;
                response.content = parserResult.scrubbedContent;
                response.finishReason = 'tool_calls';
            }
            else {
                const lowerScrubbed = textContent.toLowerCase();
                const currentIntent = state.currentIntent || 'unknown';
                const actionIntents = ['coding', 'task'];
                const isActionIntent = actionIntents.includes(currentIntent);
                const narratingAction = /i('ll| will| have| am)? (going to |about to |now )?(create|write|run|execute|build|make|generate|update|edit|fix|check|analyze|process)/i.test(textContent) ||
                    /proceeding (to|with)/i.test(textContent) ||
                    /let me (create|write|run|build|make|generate|update|edit|fix)/i.test(textContent) ||
                    /next,? (i|we)('ll| will)?/i.test(textContent) ||
                    /now (i|we)('ll| will)?/i.test(textContent) ||
                    textContent.includes('[ TASK:');
                const hasMeaningfulContent = textContent.length > 50 && !lowerScrubbed.includes('i will now');
                if (isActionIntent && narratingAction && !hasMeaningfulContent &&
                    !textContent.includes('SYSTEM REMINDER:') && verifyIntentRetries < maxVerifyRetries) {
                    verifyIntentRetries++;
                    const message = `SYSTEM REMINDER: You said you'd "${textContent.substring(0, 50).trim()}..." — DO IT NOW. Call the tool immediately: write, run_command, or edit.`;
                    state.messages.push({ role: 'system', content: message });
                    response.toolCalls = [{
                            id: 'call_nudge_' + crypto.randomUUID().substring(0, 8),
                            name: 'system_verify_intent',
                            arguments: { _context: { intent: currentIntent, phase: state.taskPhase } }
                        }];
                    response.finishReason = 'tool_calls';
                }
                else if (verifyIntentRetries >= maxVerifyRetries) {
                    verifyIntentRetries = 0;
                }
            }
        }
        let rawContent = response.content || '';
        let textContent = typeof rawContent === 'string'
            ? rawContent
            : rawContent.map((c) => 'text' in c ? c.text : '').join('\n');
        const scrubbed = textContent.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/ig, '').trim();
        if (scrubbed) {
            const preview = scrubbed.length > 80 ? scrubbed.substring(0, 80) + '...' : scrubbed;
            runner.telemetry.info(`Model output: "${preview}"`);
        }
        if (response.toolCalls && response.toolCalls.length > 0) {
            runner.telemetry.info(`Detected ${response.toolCalls.length} actionable tool definitions.`);
        }
        if (scrubbed.length === 0 && (!response.toolCalls || response.toolCalls.length === 0)) {
            if (verifyIntentRetries < maxVerifyRetries) {
                verifyIntentRetries++;
                state.messages.push({
                    role: 'system',
                    content: 'SYSTEM CONTINUE: You returned an empty response. You MUST proceed with the next step of your task. Call a tool (write, run_command, etc.) to continue.'
                });
                response.toolCalls = [{
                        id: 'call_nudge_' + crypto.randomUUID().substring(0, 8),
                        name: 'system_verify_intent',
                        arguments: {}
                    }];
                response.finishReason = 'tool_calls';
            }
            else {
                return {
                    messages: [{
                            role: 'assistant',
                            content: 'I apologize, but I encountered an issue processing your request. The model did not respond properly. Please try again.',
                            tool_calls: undefined
                        }],
                    pendingToolCalls: [],
                    iterations,
                    finalResponse: 'Error: Model returned empty response multiple times.'
                };
            }
        }
        const assistantMsg = {
            role: 'assistant',
            content: scrubbed,
            tool_calls: response.toolCalls,
        };
        if (response.finishReason !== 'tool_calls' && scrubbed) {
            eventQueue?.push({ type: 'chunk', content: scrubbed });
        }
        return {
            messages: [assistantMsg],
            pendingToolCalls: response.toolCalls ?? [],
            iterations,
            finalResponse: response.finishReason !== 'tool_calls' ? scrubbed : '',
        };
    };
};
exports.createCallModelNode = createCallModelNode;
