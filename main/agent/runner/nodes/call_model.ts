import * as crypto from 'crypto';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { AIClient, ChatMessage, ChatRequest, ToolDefinition } from '../../../lib/ai-client';
import { GraphStateType, StreamEvent } from '../state';
import { parseTextToToolCalls } from '../../parsers/text-to-tool';
import { AgentRunner } from '../runner';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';

import { normalizeMessages } from '../services/message-utils';

export const createCallModelNode = (
  runner: AgentRunner,
  toolDefs: ToolDefinition[],
  eventQueue?: StreamEvent[],
  maxIterations: number = 10,
  maxVerifyRetries: number = 3,
  missionTracker?: MissionTracker
) => {
  let verifyIntentRetries = 0;
  const integrator = createMissionIntegrator(missionTracker);

  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    integrator.startNode('call_model', 'Calling AI model');
    try {
      runner.telemetry.transition('call_model');
    runner.telemetry.metrics(state.iterations);

    const iterations = state.iterations;
    let client = (runner as any).client; 
    let modelUsed = client.model;

    // ── Vision Grounding ───────────────────────────────────────────────────
    const vlm = (runner as any).config.vlm;
    const lastMsgContent = state.messages[state.messages.length - 1]?.content || '';
    const needsVisionGrounding = iterations === 0 &&
      vlm?.model &&
      vlm?.provider &&
      (runner as any).shouldCaptureScreenshot(lastMsgContent);

    if (needsVisionGrounding && vlm) {
      runner.telemetry.info(`🔭 Vision Grounding: Analyzing workspace footprint with ${vlm.model} (${vlm.provider})`);
      client = new AIClient({
        provider: vlm.provider as any,
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
    let streamedText = '';

    // Optima: Context Pruning & Normalization
    const normalizedMessages = normalizeMessages(state.messages);
    
    // Dynamic System Prompt Slimming for Conversations
    const currentIntent = state.currentIntent || 'unknown';
    const isReadOnly = ['conversation', 'question'].includes(currentIntent);
    
    if (isReadOnly && normalizedMessages.length > 0 && normalizedMessages[0].role === 'system') {
      const originalPrompt = normalizedMessages[0].content as string;
      if (originalPrompt.includes('EverFern System Prompt')) {
        normalizedMessages[0].content = `You are EverFern, a helpful and concise AI assistant. 
Keep your responses friendly and direct. 
The user is engaging in a simple conversation or asking a direct question. 
You do not need to use complex execution plans or tools for this interaction.`;
        runner.telemetry.info('Optima: Using slimmed system prompt for read-only intent.');
      }
    }

    const prunedMessages = normalizedMessages.map((m, idx) => {
      if (m.role === "user") {
        if (typeof m.content === 'string') return m;
        const hasImage = Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url');
        if (!hasImage) return m;

        const futureImages = normalizedMessages.slice(idx + 1).filter((fm: any) =>
          Array.isArray(fm.content) && fm.content.some((fc: any) => fc.type === 'image_url')
        ).length;

        if (futureImages >= 2) {
          return {
            ...m,
            content: m.content.map((c: any) => c.type === 'image_url' ? { type: 'text', text: '[Screenshot Omitted to Save Tokens]' } : c)
          } as ChatMessage;
        }
      }
      return m;
    });

    const request: ChatRequest = {
      messages: prunedMessages,
      tools: toolDefs,
      onStreamChunk: (chunk: string) => {
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
          if (parts[1]) eventQueue?.push({ type: 'thought', content: parts[1] });
          thoughtBuffer = '';
        } else if (isThinking && hasEnd) {
          isThinking = false;
          const tag = thoughtBuffer.includes('</think>') ? '</think>' : '</thought>';
          const parts = thoughtBuffer.split(tag);
          if (parts[0]) eventQueue?.push({ type: 'thought', content: parts[0] });
          if (parts[1]) {
            eventQueue?.push({ type: 'chunk', content: parts[1] });
            streamedText += parts[1];
          }
          thoughtBuffer = '';
        } else if (isThinking) {
          eventQueue?.push({ type: 'thought', content: chunk });
          thoughtBuffer = '';
        } else {
          const trimmed = thoughtBuffer.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('<')) {
            if (thoughtBuffer.length > 20) {
               eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
               streamedText += thoughtBuffer;
               thoughtBuffer = '';
            }
          } else {
            eventQueue?.push({ type: 'chunk', content: thoughtBuffer });
            streamedText += thoughtBuffer;
            thoughtBuffer = '';
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
          ? response.content.map((c: any) => 'text' in c ? c.text : '').join('\n')
          : '';

      const parserResult = parseTextToToolCalls(textContent, (runner as any).tools);
      if (parserResult.toolCalls.length > 0) {
        response.toolCalls = parserResult.toolCalls;
        response.content = parserResult.scrubbedContent;
        response.finishReason = 'tool_calls';
      } else {
        const lowerScrubbed = textContent.toLowerCase();
        const actionIntents = ['coding', 'task', 'build', 'fix', 'automate'];
        const isActionIntent = actionIntents.includes(currentIntent);

        const narratingAction = /i('ll| will| have| am)? (going to |about to |now )?(create|write|run|execute|build|make|generate|update|edit|fix|check|analyze|process)/i.test(textContent) ||
          /proceeding (to|with)/i.test(textContent) ||
          /let me (create|write|run|build|make|generate|update|edit|fix)/i.test(textContent) ||
          /next,? (i|we)('ll| will)?/i.test(textContent) ||
          /now (i|we)('ll| will)?/i.test(textContent) ||
          textContent.includes('[ TASK:');

        const shouldNudge = parserResult.parseError || (isActionIntent && narratingAction && !textContent.includes('SYSTEM REMINDER:'));

        if (shouldNudge && verifyIntentRetries < maxVerifyRetries) {
          verifyIntentRetries++;
          let message = `SYSTEM REMINDER: You did not format your tool call correctly or failed to call a tool. If you are completing a task, you MUST use a tool (write, run_command, edit, etc).`;
          if (parserResult.parseError) {
              message = `SYSTEM REMINDER: Your tool call failed to parse. ${parserResult.parseError}. Please output valid JSON.`;
          } else if (narratingAction) {
              message = `SYSTEM REMINDER: You said you'd "${textContent.substring(0, 50).trim()}..." — DO IT NOW. Ensure your tool call is valid JSON or correctly formatted.`;
          }
          state.messages.push({ role: 'system', content: message } as any);
          response.toolCalls = [{
            id: 'call_nudge_' + crypto.randomUUID().substring(0, 8),
            name: 'system_verify_intent',
            arguments: { _context: { intent: currentIntent, phase: state.taskPhase, error: parserResult.parseError } }
          }];
          response.finishReason = 'tool_calls';
        } else if (verifyIntentRetries >= maxVerifyRetries) {
          verifyIntentRetries = 0;
        }
      }
    }

    let rawContent = response.content || '';
    let textContent = typeof rawContent === 'string'
      ? rawContent
      : rawContent.map((c: any) => 'text' in c ? c.text : '').join('\n');

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
        } as any);
        response.toolCalls = [{
          id: 'call_nudge_' + crypto.randomUUID().substring(0, 8),
          name: 'system_verify_intent',
          arguments: {}
        }];
        response.finishReason = 'tool_calls';
      } else {
        return {
          messages: [new AIMessage({
            content: 'I apologize, but I encountered an issue processing your request. The model did not respond properly. Please try again.',
          })],
          pendingToolCalls: [],
          iterations,
          finalResponse: 'Error: Model returned empty response multiple times.'
        };
      }
    }

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: scrubbed,
      tool_calls: response.toolCalls,
    };

    // ONLY push scrubbed content if nothing was streamed (prevents duplicates)
    if (response.finishReason !== 'tool_calls' && scrubbed && !streamedText) {
      eventQueue?.push({ type: 'chunk', content: scrubbed });
    }

    const result = {
      messages: [assistantMsg as any],
      pendingToolCalls: response.toolCalls ?? [],
      iterations,
      finalResponse: response.finishReason !== 'tool_calls' ? scrubbed : '',
    };
    integrator.completeNode('call_model', 'Model call completed');
    return result;
    } catch (error) {
      integrator.failNode('call_model', error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
};
