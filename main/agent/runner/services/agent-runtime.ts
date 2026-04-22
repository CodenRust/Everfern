import * as crypto from 'crypto';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import { AIClient, ChatMessage, ChatRequest, ToolDefinition } from '../../../lib/ai-client';
import { GraphStateType, StreamEvent } from '../state';
import { parseTextToToolCalls } from '../../parsers/text-to-tool';
import { AgentRunner } from '../runner';
import { normalizeMessages } from './message-utils';
import { captureScreen } from '../../tools/computer-use';

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

  // Emit transition as thought for frontend visibility
  const icon = nodeName === 'data_analyst' ? '📊' : 
               nodeName === 'coding_specialist' ? '💻' : 
               nodeName === 'web_explorer' ? '🌐' : '🧭';
  eventQueue?.push({ type: 'thought', content: `\n${icon} ${nodeName.replace(/_/g, ' ').toUpperCase()}: Initializing step...` });

  let client = runner.client;
  let clientToRelease: AIClient | null = null;
  let clientConfig: any = null;
  let verifyIntentRetries = 0;

  try {
    // 1. Initial message normalization for all subsequent steps
    let normalizedMessages = normalizeMessages(state.messages);

    // 2. Vision Grounding check - use pooled client for VLM
    const lastMsgContent = state.messages[state.messages.length - 1]?.content || '';
    const vlm = (runner as any).config.vlm;
    let updatedMessages: ChatMessage[] | null = null;
    
    // Only use separate VLM if main model isn't vision-native
    const mainProvider = runner.client.provider;
    const isVisionNative = ['openai', 'anthropic', 'gemini', 'nvidia', 'google'].includes(mainProvider);

    if (iterations === 0 && vlm?.model && runner.shouldCaptureScreenshot(lastMsgContent)) {
      // If native vision exists, keep main client but capture screenshot
      // If not, switch to VLM client
      if (!isVisionNative) {
        clientConfig = {
          provider: vlm.provider,
          model: vlm.model,
          apiKey: vlm.apiKey,
          baseUrl: vlm.baseUrl
        };
        client = runner.getClient(clientConfig);
        clientToRelease = client;
        runner.telemetry.info(`Using VLM: ${vlm.model} (${vlm.provider})`);
      } else {
        runner.telemetry.info(`Using Native Vision: ${runner.client.model} (${mainProvider})`);
      }

      try {
        runner.telemetry.info('📸 Capturing desktop state for vision grounding...');
        const screenshotData = await captureScreen();
        if (screenshotData && screenshotData.b64) {
          const lastMsgIdx = normalizedMessages.length - 1;
          const lastMsg = normalizedMessages[lastMsgIdx];
          
          if (lastMsg && lastMsg.role === 'user') {
            const originalContent = typeof lastMsg.content === 'string' 
              ? [{ type: 'text' as const, text: lastMsg.content }] 
              : lastMsg.content;
              
            const newContent: ChatMessage['content'] = [
              ...originalContent,
              {
                type: 'image_url' as const,
                image_url: { url: `data:image/jpeg;base64,${screenshotData.b64}` }
              }
            ];
            
            // Create a copy of the normalized messages and update the last one
            updatedMessages = [...normalizedMessages];
            updatedMessages[lastMsgIdx] = { ...lastMsg, content: newContent };
            normalizedMessages = updatedMessages;
            runner.telemetry.info('✅ Screenshot attached to user message.');
          }
        }
      } catch (err) {
        runner.telemetry.warn(`Failed to capture screenshot for vision grounding: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. Inject system prompt override or ensure one exists
    if (systemPromptOverride) {
      if (normalizedMessages.length > 0 && normalizedMessages[0].role === 'system') {
        normalizedMessages[0].content = systemPromptOverride;
      } else {
        // Insert new system message at the beginning
        normalizedMessages.unshift({
          role: 'system',
          content: systemPromptOverride
        });
      }
    }

    let thoughtBuffer = '';
    let isThinking = false;
    let streamedText = '';

    // 4. Enhanced context pruning for better performance
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

    let response = await client.chat(request);

    // 5. Tool Call Nudge (Specialized Agents)
    // If a specialized agent (like computer_use) fails to call a tool, nudge it once.
    const isSpecializedAgent = ['computer_use_agent', 'coding_specialist', 'data_analyst', 'web_explorer'].includes(nodeName);
    if (isSpecializedAgent && (!response.toolCalls || response.toolCalls.length === 0) && verifyIntentRetries === 0) {
        verifyIntentRetries++;
        runner.telemetry.warn(`[AgentRuntime] ${nodeName} failed to call a tool. Nudging...`);
        
        const nudgeMsg: ChatMessage = {
          role: 'system',
          content: `SYSTEM REMINDER: You are the ${nodeName}. You are specifically designed to use your specialized tools. YOU HAVE ALL NECESSARY PERMISSIONS. Do not explain why you cannot do something. Do not talk about the task. Use the 'computer_use' tool (or your other relevant tools) NOW to execute the next step of the plan. Output a tool call immediately.`
        };
        
        const nudgeMessages = [...limitedMessages, nudgeMsg];
        response = await client.chat({ ...request, messages: nudgeMessages });
    }

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
