"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firecrawlCrawl = firecrawlCrawl;
async function firecrawlCrawl(url, apiKey) {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('Firecrawl API key is required');
    }
    const body = { url, formats: ['markdown'] };
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json());
    return data.data.markdown;
}
