"use strict";
/**
 * EverFern Desktop — Website Crawl Tool
 *
 * Exposes FernCrawl as an agent tool.
 * FernCrawl pipeline: Playwright render → HTML clean → Markdown → LLM understanding
 * Falls back to Playwright/Firecrawl/HTTP when Playwright is unavailable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.websiteCrawlTool = void 0;
const tool_settings_1 = require("../../store/tool-settings");
const fern_crawl_1 = require("./fern-crawl");
const web_playwright_1 = require("./web-playwright");
const firecrawl_client_1 = require("./firecrawl-client");
exports.websiteCrawlTool = {
    name: 'website_crawl',
    description: 'Deep-crawl a website using FernCrawl (EverFern\'s AI-native crawler). ' +
        'Renders JavaScript, removes noise, converts to clean Markdown, and uses an LLM to understand the page content. ' +
        'Unlike browser_use (single page, raw text), this tool produces structured AI-ready output. ' +
        'Set deep=true to follow internal links and crawl multiple pages.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL to crawl (e.g. "https://docs.example.com")',
            },
            query: {
                type: 'string',
                description: 'The research question or topic — helps the LLM focus its understanding of the page',
            },
            deep: {
                type: 'boolean',
                description: 'Follow internal links for a multi-page crawl (default: false)',
            },
            maxPages: {
                type: 'number',
                description: 'Maximum pages to crawl when deep=true (default: 5, max: 20)',
            },
            maxLength: {
                type: 'number',
                description: 'Maximum characters to return per page (default: 8000)',
            },
        },
        required: ['url'],
    },
    async execute(args, onUpdate, _emitEvent, _toolCallId, runner) {
        const url = String(args['url'] ?? '').trim();
        const query = args['query'] ? String(args['query']) : undefined;
        const deep = Boolean(args['deep'] ?? false);
        const maxPages = Math.min(Number(args['maxPages'] ?? 5), 20);
        const maxLen = Number(args['maxLength'] ?? 8000);
        if (!url) {
            return { success: false, output: 'No URL provided', error: 'url is required' };
        }
        onUpdate?.(`🌿 FernCrawl: ${deep ? `Deep-crawling (up to ${maxPages} pages)` : 'Crawling'} ${url}...`);
        const fernAvailable = await (0, fern_crawl_1.isFernCrawlAvailable)();
        if (fernAvailable) {
            // Pass the AI client so the LLM understanding layer activates
            const aiClient = runner?.client ?? undefined;
            const crawlConfig = { maxLengthChars: maxLen, aiClient, researchQuery: query };
            if (deep) {
                const result = await (0, fern_crawl_1.fernCrawlDeep)(url, maxPages, crawlConfig);
                if (result.success && result.pages.length > 0) {
                    const sections = result.pages
                        .filter(p => p.success && p.markdown.trim().length > 0)
                        .map(p => {
                        const content = p.markdown.length > maxLen
                            ? p.markdown.slice(0, maxLen) + '\n\n...(truncated)'
                            : p.markdown;
                        // Include LLM understanding if available
                        const understanding = p.understanding
                            ? `\n**🧠 FernCrawl Understanding:**\n` +
                                `- **Summary:** ${p.understanding.summary}\n` +
                                `- **Key Facts:** ${p.understanding.keyFacts.join('; ')}\n` +
                                `- **Entities:** ${p.understanding.entities.join(', ')}\n` +
                                `- **Relevance:** ${p.understanding.relevanceScore}/10\n` +
                                `- **Top Excerpt:** "${p.understanding.topExcerpt}"\n`
                            : '';
                        return `## ${p.title ?? p.url}\n**Source:** ${p.url}${understanding}\n\n${content}`;
                    });
                    return {
                        success: true,
                        output: `🌿 FernCrawl deep-crawled ${url} — ${result.totalPages} page(s):\n\n${sections.join('\n\n---\n\n')}`,
                        data: { url, pages: result.totalPages, engine: 'fern-crawl' },
                    };
                }
            }
            else {
                const result = await (0, fern_crawl_1.fernCrawlScrape)(url, crawlConfig);
                if (result.success && result.markdown.trim().length > 0) {
                    const content = result.markdown.length > maxLen
                        ? result.markdown.slice(0, maxLen) + '\n\n...(truncated)'
                        : result.markdown;
                    const understanding = result.understanding
                        ? `\n**🧠 FernCrawl Understanding:**\n` +
                            `- **Summary:** ${result.understanding.summary}\n` +
                            `- **Key Facts:** ${result.understanding.keyFacts.join('; ')}\n` +
                            `- **Entities:** ${result.understanding.entities.join(', ')}\n` +
                            `- **Relevance:** ${result.understanding.relevanceScore}/10\n` +
                            `- **Top Excerpt:** "${result.understanding.topExcerpt}"\n`
                        : '';
                    return {
                        success: true,
                        output: `🌿 ${result.title ?? url}\n**Source:** ${url}${understanding}\n\n${content}`,
                        data: { url, engine: 'fern-crawl', title: result.title },
                    };
                }
            }
        }
        // Fallback: existing pipeline
        onUpdate?.('FernCrawl unavailable — falling back to browser_use pipeline...');
        const config = tool_settings_1.toolSettingsStore.get().webCrawl;
        if (config.mode === 'local') {
            try {
                const text = await (0, web_playwright_1.playwrightWebCrawl)(url, config.headless);
                const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n\n...(truncated)' : text;
                return { success: true, output: `📄 ${url}:\n\n${truncated}`, data: { url, engine: 'playwright' } };
            }
            catch { /* fall through */ }
        }
        else if (config.mode === 'api') {
            try {
                const text = await (0, firecrawl_client_1.firecrawlCrawl)(url, config.apiKey);
                const truncated = text.length > maxLen ? text.slice(0, maxLen) + '\n\n...(truncated)' : text;
                return { success: true, output: `📄 ${url}:\n\n${truncated}`, data: { url, engine: 'firecrawl' } };
            }
            catch { /* fall through */ }
        }
        // Last resort: plain HTTP
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'EverFern Desktop/1.0' },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            let text = html
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gmi, '')
                .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gmi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (text.length > maxLen)
                text = text.slice(0, maxLen) + '\n\n...(truncated)';
            return { success: true, output: `📄 ${url}:\n\n${text}`, data: { url, engine: 'http' } };
        }
        catch (err) {
            return {
                success: false,
                output: `Failed to crawl ${url}: ${err instanceof Error ? err.message : String(err)}`,
                error: String(err),
            };
        }
    },
};
