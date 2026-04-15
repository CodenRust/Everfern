import * as crypto from 'crypto';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import { AIClient, ChatMessage, ChatRequest, ToolDefinition } from '../../../lib/ai-client';
import { GraphStateType, StreamEvent } from '../state';
import { parseTextToToolCalls } from '../../parsers/text-to-tool';
import { AgentRunner } from '../runner';
import { normalizeMessages } from './message-utils';

export interface AgentStepOptions {
  runner: AgentRunner;
  toolDefs: ToolDefinition[];
  eventQueue?: StreamEvent[];
  maxVerifyRetries?: number;
  systemPromptOverride?: string;
  nodeName: string;
}

/**
 * Reusable agent execution logic for calling the model and processing its response.
 * Uses pooled AI clients for better performance and connection reuse.
 */
export async function runAgentStep(
  state: GraphStateType,
  options: AgentStepOptions
): Promise<Partial<GraphStateType>> {
  const { runner, toolDefs, eventQueue, maxVerifyRetries = 3, systemPromptOverride, nodeName } = options;

  runner.telemetry.transition(nodeName);
  const iterations = state.iterations || 0;
  runner.telemetry.metrics(iterations);

  let client = runner.client;
  let clientToRelease: AIClient | null = null;
  let clientConfig: any = null;
  let verifyIntentRetries = 0;

  try {
    // Vision Grounding check - use pooled client for VLM
    const lastMsgContent = state.messages[state.messages.length - 1]?.content || '';
    const vlm = (runner as any).config.vlm;
    if (iterations === 0 && vlm?.model && runner.shouldCaptureScreenshot(lastMsgContent)) {
      clientConfig = {
        provider: vlm.provider,
        model: vlm.model,
        apiKey: vlm.apiKey,
        baseUrl: vlm.baseUrl
      };
      client = runner.getClient(clientConfig);
      clientToRelease = client;
      runner.telemetry.info(`Using VLM: ${vlm.model} (${vlm.provider})`);
    }

    // Optima: Normalization
    const normalizedMessages = normalizeMessages(state.messages);

    // Inject system prompt override if provided
    if (systemPromptOverride && normalizedMessages.length > 0 && normalizedMessages[0].role === 'system') {
      normalizedMessages[0].content = systemPromptOverride;
    }

    let thoughtBuffer = '';
    let isThinking = false;
    let streamedText = '';

    // Enhanced context pruning for better performance
    const prunedMessages = normalizedMessages.map((m, idx) => {
      if (m.role === "user" && Array.isArray(m.content)) {
        const hasImage = m.content.some((c: any) => c.type === 'image_url');
        if (hasImage) {
          const futureImages = normalizedMessages.slice(idx + 1).filter((fm: any) =>
            Array.isArray(fm.content) && fm.content.some((fc: any) => fc.type === 'image_url')
          ).length;
          // Keep only the most recent 2 images
          if (futureImages >= 1 || idx < normalizedMessages.length - 3) {
            return {
              ...m,
              content: m.content.map((c: any) => c.type === 'image_url' ? { type: 'text', text: '[Screenshot Omitted]' } : c)
            } as ChatMessage;
          }
        }
      }
      return m;
    });

    // Limit message history for performance (keep last 20 messages)
    const maxMessages = 20;
    const limitedMessages = prunedMessages.length > maxMessages
      ? [prunedMessages[0], ...prunedMessages.slice(-maxMessages + 1)]
      : prunedMessages;

    const request: ChatRequest = {
      messages: limitedMessages,
      tools: toolDefs,
      onStreamChunk: (chunk: string) => {
        console.log(`[Stream] Received chunk: "${chunk}" (buffer: ${thoughtBuffer.length} chars)`);
        thoughtBuffer += chunk;
        const hasStart = thoughtBuffer.includes('<think>') || thoughtBuffer.includes('<thought>');
        const hasEnd = thoughtBuffer.includes('</think>') || thoughtBuffer.includes('</thought>');

        if (!isThinking && hasStart) {
          isThinking = true;
          const tag = thoughtBuffer.includes('<think>') ? '<think>' : '<thought>';
          const parts = thoughtBuffer.split(tag);
          if (parts[0]) {
            console.log(`[Stream] Sending chunk before <think>: "${parts[0]}"`);
            eventQueue?.push({ type: 'chunk', content: parts[0] });
            streamedText += parts[0];
          }
          if (parts[1]) {
            console.log(`[Stream] Sending thought: "${parts[1].slice(0, 50)}..."`);
            eventQueue?.push({ type: 'thought', content: parts[1] });
          }
          thoughtBuffer = '';
        } else if (isThinking && hasEnd) {
          isThinking = false;
          const tag = thoughtBuffer.includes('</think>') ? '</think>' : '</thought>';
          const parts = thoughtBuffer.split(tag);
          if (parts[0]) {
            console.log(`[Stream] Sending thought end: "${parts[0].slice(0, 50)}..."`);
            eventQueue?.push({ type: 'thought', content: parts[0] });
          }
          if (parts[1]) {
            console.log(`[Stream] Sending chunk after </think>: "${parts[1]}"`);
            eventQueue?.push({ type: 'chunk', content: parts[1] });
            streamedText += parts[1];
          }
          thoughtBuffer = '';
        } else if (isThinking) {
          console.log(`[Stream] In thinking mode, sending as thought`);
          eventQueue?.push({ type: 'thought', content: chunk });
          thoughtBuffer = '';
        } else {
          const trimmed = thoughtBuffer.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('<')) {
            console.log(`[Stream] Sending regular chunk: "${thoughtBuffer}"`);
            eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
            streamedText += thoughtBuffer;
            thoughtBuffer = '';
          } else if (thoughtBuffer.length > 20) {
            console.log(`[Stream] Buffer > 20 chars, sending: "${thoughtBuffer.slice(0, 50)}..."`);
            eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
            streamedText += thoughtBuffer;
            thoughtBuffer = '';
          } else {
            console.log(`[Stream] Buffering (starts with { or <, length: ${thoughtBuffer.length})`);
          }
        }
      },
    };

    const response = await client.chat(request);

    // Flush any remaining content in thoughtBuffer after streaming completes
    if (thoughtBuffer.trim()) {
      console.log(`[Stream] Flushing remaining buffer: "${thoughtBuffer}"`);
      eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
      streamedText += thoughtBuffer;
      thoughtBuffer = '';
    }

    console.log(`[Stream] Total streamed text length: ${streamedText.length} chars`);

    if (response.usage) {
      const usage = response.usage;
      runner.telemetry.info(`Tokens: In=${usage.promptTokens}, Out=${usage.completionTokens}`);
      eventQueue?.push({ type: 'usage', ...response.usage });
    }

    // Tool Call Parsing & Nudging
    let textContent = typeof response.content === 'string' ? response.content : '';
    if (Array.isArray(response.content)) {
      textContent = response.content.map((c: any) => 'text' in c ? c.text : '').join('\n');
    }

    const scrubbed = textContent.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/ig, '').trim();

    // If model didn't provide tool calls but intent requires them, parse or nudge
    if (!response.toolCalls || response.toolCalls.length === 0) {
      const parserResult = parseTextToToolCalls(textContent, (runner as any).tools);
      if (parserResult.toolCalls.length > 0) {
        response.toolCalls = parserResult.toolCalls;
        response.finishReason = 'tool_calls';
      }
    }

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: scrubbed,
      tool_calls: response.toolCalls,
    };

    // Always send the final response to frontend if it's not a tool call
    // This ensures the AI's message is displayed even if streaming already happened
    if (response.finishReason !== 'tool_calls' && scrubbed) {
      // Send the scrubbed content if we haven't streamed anything yet,
      // or if the scrubbed content is different from what was streamed
      const needsFinalChunk = !streamedText || streamedText.trim() !== scrubbed.trim();
      if (needsFinalChunk) {
        eventQueue?.push({ type: 'chunk', content: scrubbed });
      }
    }

    return {
      messages: [assistantMsg as any],
      pendingToolCalls: response.toolCalls ?? [],
      iterations: iterations + 1,
      finalResponse: response.finishReason !== 'tool_calls' ? scrubbed : '',
    };
  } finally {
    // Release pooled client if we used one
    if (clientToRelease && clientConfig) {
      runner.releaseClient(clientToRelease, clientConfig);
    }
  }
}
