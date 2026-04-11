import * as crypto from 'crypto';
import { AIClient, ChatMessage, ChatRequest, ToolDefinition } from '../../../lib/ai-client';
import { GraphStateType, StreamEvent } from '../state';
import { parseTextToToolCalls } from '../../parsers/text-to-tool';
import { AgentRunner } from '../runner';

export const createCallModelNode = (
  runner: AgentRunner,
  toolDefs: ToolDefinition[],
  eventQueue?: StreamEvent[],
  maxIterations: number = 10,
  maxVerifyRetries: number = 3
) => {
  let verifyIntentRetries = 0;

  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    runner.telemetry.transition('call_model');
    runner.telemetry.metrics(state.iterations);

    const iterations = state.iterations;
    let client = (runner as any).client; 
    let modelUsed = client.model;

    // ── Vision Grounding ───────────────────────────────────────────────────
    const vlm = (runner as any).config.vlm;
    const needsVisionGrounding = iterations === 0 &&
      vlm?.model &&
      vlm?.provider &&
      (runner as any).shouldCaptureScreenshot(state.messages[state.messages.length - 1]?.content || '');

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

    // Optima: Context Pruning
    const prunedMessages = state.messages.map((m, idx) => {
      if (m.role === "user") return m;
      if (typeof m.content === 'string') return m;
      const hasImage = m.content.some((c: any) => c.type === 'image_url');
      if (!hasImage) return m;

      const futureImages = state.messages.slice(idx + 1).filter((fm: any) =>
        Array.isArray(fm.content) && fm.content.some((fc: any) => fc.type === 'image_url')
      ).length;

      if (futureImages >= 2) {
        return {
          ...m,
          content: m.content.map((c: any) => c.type === 'image_url' ? { type: 'text', text: '[Screenshot Omitted to Save Tokens]' } : c)
        } as ChatMessage;
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
          const content = thoughtBuffer.split(tag)[1];
          if (content) eventQueue?.push({ type: 'thought', content });
          thoughtBuffer = '';
        } else if (isThinking && hasEnd) {
          isThinking = false;
          const tag = thoughtBuffer.includes('</think>') ? '</think>' : '</thought>';
          const contentBeforeEnd = thoughtBuffer.split(tag)[0];
          if (contentBeforeEnd) eventQueue?.push({ type: 'thought', content: contentBeforeEnd });
          thoughtBuffer = '';
        } else if (isThinking) {
          eventQueue?.push({ type: 'thought', content: chunk });
          thoughtBuffer = '';
        } else {
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
          ? response.content.map((c: any) => 'text' in c ? c.text : '').join('\n')
          : '';

      const parserResult = parseTextToToolCalls(textContent, (runner as any).tools);
      if (parserResult.toolCalls.length > 0) {
        response.toolCalls = parserResult.toolCalls;
        response.content = parserResult.scrubbedContent;
        response.finishReason = 'tool_calls';
      } else {
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
        });
        response.toolCalls = [{
          id: 'call_nudge_' + crypto.randomUUID().substring(0, 8),
          name: 'system_verify_intent',
          arguments: {}
        }];
        response.finishReason = 'tool_calls';
      } else {
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

    const assistantMsg: ChatMessage = {
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
