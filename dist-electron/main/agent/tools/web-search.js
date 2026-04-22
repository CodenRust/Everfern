"use strict";
/**
 * EverFern Desktop — Web Search Tool
 *
 * Multi-engine search using search-engine-nodejs (Google/Bing/Yahoo scraping)
 * with automatic fallback to DuckDuckGo Instant Answer API.
 *
 * Engine priority:
 *   1. search-engine-nodejs (Google scraping — richest results)
 *   2. DuckDuckGo Instant Answers API (fast, no API key needed)
 *   3. DuckDuckGo Lite HTML scrape (last resort)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSearchTool = void 0;
function searchViaEngine(engine, query) {
    return new Promise((resolve) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const SearchEngine = require('search-engine-nodejs').default;
            const method = SearchEngine[engine];
            if (typeof method !== 'function') {
                resolve([]);
                return;
            }
            const timer = setTimeout(() => resolve([]), 8000); // 8s timeout
            method.call(SearchEngine, query, (err, results) => {
                clearTimeout(timer);
                if (err || !Array.isArray(results)) {
                    resolve([]);
                    return;
                }
                resolve(results.slice(0, 8).map((r) => ({
                    title: String(r.title || r.heading || '').trim(),
                    url: String(r.link || r.url || r.href || '').trim(),
                    snippet: String(r.description || r.snippet || r.text || '').trim(),
                })).filter(r => r.url && r.title));
            });
        }
        catch {
            resolve([]);
        }
    });
}
// ── DuckDuckGo fallback ──────────────────────────────────────────────
async function searchDDG(query) {
    const encoded = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'EverFern Desktop/1.0' },
        signal: AbortSignal.timeout(6000),
    });
    if (!res.ok)
        return [];
    const data = await res.json();
    const results = [];
    if (data.Abstract && data.AbstractURL) {
        results.push({
            title: data.Heading || query,
            url: data.AbstractURL,
            snippet: data.Abstract,
        });
    }
    if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
            if (topic.Text && topic.FirstURL && results.length < 7) {
                results.push({
                    title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 80),
                    url: topic.FirstURL,
                    snippet: topic.Text,
                });
            }
        }
    }
    // DDG Lite HTML fallback
    if (results.length === 0) {
        try {
            const liteRes = await fetch(`https://lite.duckduckgo.com/lite/?q=${encoded}`, {
                headers: { 'User-Agent': 'EverFern Desktop/1.0' },
                signal: AbortSignal.timeout(6000),
            });
            const html = await liteRes.text();
            const linkMatches = [...html.matchAll(/href="(https?:\/\/[^"]+)"[^>]*>([^<]+)</g)];
            const snippetMatches = [...html.matchAll(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g)];
            for (let i = 0; i < Math.min(linkMatches.length, 6); i++) {
                results.push({
                    title: (linkMatches[i][2] || '').trim(),
                    url: linkMatches[i][1],
                    snippet: (snippetMatches[i]?.[1] || '').replace(/<[^>]+>/g, '').trim(),
                });
            }
        }
        catch {
            // Silent fail
        }
    }
    return results;
}
// ── Main search with fallback chain ─────────────────────────────────
async function search(query) {
    // Try Google scraper first (richest results)
    try {
        const googleResults = await searchViaEngine('Google', query);
        if (googleResults.length > 0) {
            console.log(`[WebSearch] Got ${googleResults.length} results from Google scraper`);
            return googleResults;
        }
    }
    catch {
        // Fall through
    }
    // Try Yahoo scraper as secondary
    try {
        const yahooResults = await searchViaEngine('Yahoo', query);
        if (yahooResults.length > 0) {
            console.log(`[WebSearch] Got ${yahooResults.length} results from Yahoo scraper`);
            return yahooResults;
        }
    }
    catch {
        // Fall through
    }
    // DuckDuckGo as final fallback (always works)
    console.log(`[WebSearch] Falling back to DuckDuckGo for: "${query}"`);
    return searchDDG(query);
}
// ── Tool Definition ──────────────────────────────────────────────────
exports.webSearchTool = {
    name: 'web_search',
    description: 'Search the internet for real-time information using multiple search engines (Google, Yahoo, DuckDuckGo). ' +
        'Returns top results with titles, URLs, and snippets. ' +
        'Use for: current events, documentation lookups, factual questions, ' +
        "finding websites, research, and anything the AI doesn't know from training.",
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query (e.g. "best discord bots 2024", "React useEffect docs")',
            },
        },
        required: ['query'],
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        const query = String(args['query'] ?? '').trim();
        if (!query) {
            return { success: false, output: 'No search query provided', error: 'query is required' };
        }
        try {
            const results = await search(query);
            if (results.length === 0) {
                return {
                    success: true,
                    output: `🔍 No results found for "${query}". Try rephrasing or use computer_use to open a browser.`,
                    data: { query, results: [] },
                };
            }
            const formatted = results
                .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
                .join('\n\n');
            return {
                success: true,
                output: `🔍 Search results for "${query}":\n\n${formatted}`,
                data: { query, results },
            };
        }
        catch (err) {
            return {
                success: false,
                output: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
                error: String(err),
            };
        }
    },
};
