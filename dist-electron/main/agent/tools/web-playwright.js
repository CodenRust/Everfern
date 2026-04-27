"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playwrightWebSearch = playwrightWebSearch;
exports.playwrightWebCrawl = playwrightWebCrawl;
function loadPlaywright() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('playwright');
}
/**
 * Launches Chromium, searches multiple engines (Brave, DuckDuckGo Lite) and returns results.
 * Implements randomized user agents and delays to avoid bot detection/captchas.
 */
async function playwrightWebSearch(query, headless) {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch({ headless }).catch((err) => {
        throw new Error(`Playwright failed to launch Chromium for web search: ${err.message}`);
    });
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
    ];
    try {
        const ctx = await browser.newContext({
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            locale: 'en-US',
        });
        const page = await ctx.newPage();
        // 1. TRY BRAVE SEARCH FIRST
        try {
            console.log(`[PlaywrightSearch] Trying Brave Search for: ${query}`);
            const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
            await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
            await new Promise(resolve => setTimeout(resolve, 1500));
            const results = await page.evaluate(() => {
                const items = [];
                // Brave Search organic web results
                for (const el of Array.from(document.querySelectorAll('[data-pos]'))) {
                    const a = el.querySelector('a[href]');
                    const titleEl = el.querySelector('.title, h2, h3, .snippet-title');
                    const snippetEl = el.querySelector('.snippet-description, .description, p');
                    const title = (titleEl ?? a)?.textContent?.trim() ?? '';
                    const href = a?.getAttribute('href') ?? '';
                    const snippet = snippetEl?.textContent?.trim() ?? '';
                    if (title && href.startsWith('http') && !href.includes('brave.com')) {
                        items.push({ title, url: href, snippet });
                    }
                    if (items.length >= 7)
                        break;
                }
                return items;
            });
            if (results.length > 0)
                return results;
            console.log(`[PlaywrightSearch] Brave Search returned 0 results (possible captcha), falling back...`);
        }
        catch (err) {
            console.log(`[PlaywrightSearch] Brave Search failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        // 2. FALLBACK TO DUCKDUCKGO LITE (very bot-friendly, no JS needed)
        try {
            console.log(`[PlaywrightSearch] Trying DuckDuckGo Lite for: ${query}`);
            const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
            await page.goto(ddgUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const results = await page.evaluate(() => {
                const items = [];
                // DDG Lite uses table rows for results
                const rows = Array.from(document.querySelectorAll('tr'));
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const link = row.querySelector('a.result-link');
                    if (link) {
                        const title = link.textContent?.trim() ?? '';
                        const url = link.href ?? '';
                        // Snippet is usually in the next row's td.result-snippet
                        const nextRow = rows[i + 1];
                        const snippet = nextRow?.querySelector('.result-snippet')?.textContent?.trim() ?? '';
                        if (title && url.startsWith('http')) {
                            items.push({ title, url, snippet });
                            i++; // skip next row since we consumed it for snippet
                        }
                    }
                    if (items.length >= 7)
                        break;
                }
                return items;
            });
            if (results.length > 0)
                return results;
        }
        catch (err) {
            console.log(`[PlaywrightSearch] DuckDuckGo Lite failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return [];
    }
    catch (err) {
        throw new Error(`Playwright web search failed for query "${query}": ${err.message}`);
    }
    finally {
        await browser.close();
    }
}
/**
 * Launches Chromium, navigates to the target URL, extracts visible text, and returns it.
 * Closes the browser in a finally block.
 */
async function playwrightWebCrawl(url, headless) {
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch({ headless }).catch((err) => {
        throw new Error(`Playwright failed to launch Chromium for web crawl: ${err.message}`);
    });
    try {
        const ctx = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'en-US',
        });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        // Extra wait to ensure dynamic content is rendered
        await new Promise(resolve => setTimeout(resolve, 2000));
        const text = await page.evaluate(() => document.body?.innerText ?? '');
        return text;
    }
    catch (err) {
        throw new Error(`Playwright web crawl failed for URL "${url}": ${err.message}`);
    }
    finally {
        await browser.close();
    }
}
