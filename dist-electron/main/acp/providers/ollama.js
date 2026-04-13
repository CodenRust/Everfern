"use strict";
/**
 * EverFern Desktop — Ollama Provider
 *
 * Connects to a locally-running Ollama instance.
 * Default endpoint: http://localhost:11434
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
class OllamaProvider {
    baseUrl = 'http://localhost:11434';
    model = 'llama3';
    info = {
        type: 'ollama',
        name: 'Ollama',
        description: 'Run open-source models locally via Ollama',
        requiresApiKey: false,
        defaultModel: 'llama3',
        isLocal: true,
    };
    initialize(config) {
        if (config.baseUrl)
            this.baseUrl = config.baseUrl;
        if (config.model)
            this.model = config.model;
    }
    async chat(request) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.model || this.model,
                messages: request.messages,
                stream: false,
                options: {
                    temperature: request.temperature ?? 0.7,
                    num_predict: request.maxTokens ?? 2048,
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            id: `ollama-${Date.now()}`,
            content: data.message?.content || '',
            model: data.model || this.model,
            usage: data.eval_count ? {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            } : undefined,
            finishReason: 'stop',
        };
    }
    async *streamChat(request) {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.model || this.model,
                messages: request.messages,
                stream: true,
                options: {
                    temperature: request.temperature ?? 0.7,
                    num_predict: request.maxTokens ?? 2048,
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama stream error: ${response.status}`);
        }
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        const id = `ollama-${Date.now()}`;
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    yield {
                        id,
                        delta: data.message?.content || '',
                        done: data.done || false,
                        model: data.model,
                    };
                }
                catch {
                    // skip malformed JSON
                }
            }
        }
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (response.ok)
                return { ok: true };
            return { ok: false, error: `Status ${response.status}` };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
        }
    }
    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok)
                return [this.model];
            const data = await response.json();
            return (data.models || []).map((m) => m.name);
        }
        catch {
            return [this.model];
        }
    }
}
exports.OllamaProvider = OllamaProvider;
