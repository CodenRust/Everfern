"use strict";
/**
 * EverFern Desktop — Web Fetch Tool
 *
 * Retrieves the full text content of a given URL.
 * Converts HTML to clean, readable text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webFetchTool = void 0;
exports.webFetchTool = {
    name: 'web_fetch',
    description: 'Retrieve the text content from a specific URL. Use this after finding a relevant URL via web_search to read the full details.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL to fetch (e.g. "https://docs.github.com/en/rest")'
            },
            maxLength: {
                type: 'number',
                description: 'Maximum number of characters to return (default: 10000)'
            }
        },
        required: ['url']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        const url = String(args['url'] ?? '').trim();
        const maxLength = Number(args['maxLength'] ?? 10000);
        if (!url) {
            return { success: false, output: 'No URL provided', error: 'url is required' };
        }
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'EverFern Desktop/1.0' },
                signal: AbortSignal.timeout(10000) // 10s timeout
            });
            if (!response.ok) {
                return { success: false, output: `Failed to fetch URL: ${response.status} ${response.statusText}`, error: `HTTP ${response.status}` };
            }
            const html = await response.text();
            // Basic text extraction: remove scripts, styles, and tags
            let text = html
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (text.length > maxLength) {
                text = text.substring(0, maxLength) + '\n\n... (content truncated)';
            }
            return {
                success: true,
                output: `📄 Content from ${url}:\n\n${text}`,
                data: { url, length: text.length }
            };
        }
        catch (err) {
            return {
                success: false,
                output: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
                error: String(err)
            };
        }
    }
};
