"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exaSearch = exaSearch;
async function exaSearch(query, apiKey) {
    if (!apiKey || !apiKey.trim()) {
        throw new Error('Exa API key is required');
    }
    const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
        },
        body: JSON.stringify({
            query,
            numResults: 5,
            useAutoprompt: true,
        }),
    });
    if (!response.ok) {
        throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json());
    return (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.text ?? '',
    }));
}
