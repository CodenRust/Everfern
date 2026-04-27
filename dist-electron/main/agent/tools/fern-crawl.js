"use strict";
/**
 * EverFern Desktop — FernCrawl Engine
 *
 * EverFern's own AI-native web crawler. No external services required.
 *
 * Pipeline:
 *   🌐 URL
 *   → 🖥️  Playwright (full JS rendering — handles React/Vue/SPA)
 *   → 🧹  HTML cleaner (strips ads, navbars, cookie banners, overlays)
 *   → 📝  Markdown converter (structured, readable output)
 *   → 🧠  LLM understanding layer (optional — extracts meaning, key facts, entities)
 *   → 🤖  AI-ready output
 *
 * The LLM layer is what makes FernCrawl different from a plain scraper:
 * instead of dumping raw text at the agent, it asks the model to read the
 * page and produce a structured summary — what the page is about, key facts,
 * entities, and relevance to the research query.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCrawl4AIAvailable = exports.crawl4aiDeepCrawl = exports.crawl4aiScrape = void 0;
exports.fernCrawlScrape = fernCrawlScrape;
exports.fernCrawlDeep = fernCrawlDeep;
exports.isFernCrawlAvailable = isFernCrawlAvailable;
function loadPlaywright() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('playwright');
}
// ── HTML → Markdown converter ─────────────────────────────────────────────
function htmlToMarkdown(html) {
    let md = html;
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${stripTags(t).trim()}\n`);
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${stripTags(t).trim()}\n`);
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${stripTags(t).trim()}\n`);
    md = md.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, (_, t) => `\n#### ${stripTags(t).trim()}\n`);
    md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_, _t, c) => `**${stripTags(c).trim()}**`);
    md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_, _t, c) => `_${stripTags(c).trim()}_`);
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c.trim()}\``);
    md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\`\`\`\n${stripTags(c).trim()}\n\`\`\`\n`);
    md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
        const t = stripTags(text).trim();
        return t ? `[${t}](${href})` : href;
    });
    md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*\/?>/gi, (_, alt) => alt ? `[Image: ${alt}]` : '');
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${stripTags(c).trim()}\n`);
    md = md.replace(/<\/(ul|ol)>/gi, '\n');
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => stripTags(c).trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n');
    md = md.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
        const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1]).trim());
        return `| ${cells.join(' | ')} |\n`;
    });
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<\/p>/gi, '\n\n');
    md = md.replace(/<p[^>]*>/gi, '');
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n');
    md = stripTags(md);
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    return md;
}
function stripTags(html) {
    return html.replace(/<[^>]+>/g, '');
}
// ── Noise-removal selectors ───────────────────────────────────────────────
const NOISE_SELECTORS = [
    'script', 'style', 'noscript', 'iframe',
    'nav', 'header', 'footer',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.cookie-banner', '.cookie-notice', '.gdpr', '.consent',
    '.ad', '.ads', '.advertisement', '.sponsored',
    '.sidebar', '.side-bar', '.widget',
    '.popup', '.modal', '.overlay',
    '.social-share', '.share-buttons',
    '[aria-hidden="true"]',
].join(', ');
// ── LLM understanding layer ───────────────────────────────────────────────
/**
 * Ask the LLM to read the crawled Markdown and produce structured understanding.
 * This is the "AI" in FernCrawl — it turns raw page content into meaning.
 */
async function understandPage(markdown, url, title, client, researchQuery) {
    const queryContext = researchQuery
        ? `\nThe user is researching: "${researchQuery}"\nFocus your analysis on what's relevant to this query.`
        : '';
    const prompt = `You are FernCrawl's AI understanding layer. You have just crawled a web page and extracted its content as Markdown. Your job is to read it and produce structured understanding so an AI agent can use it without reading the full text.
${queryContext}

PAGE URL: ${url}
PAGE TITLE: ${title ?? '(unknown)'}

PAGE CONTENT (Markdown):
---
${markdown.slice(0, 6000)}
---

Respond with JSON only — no markdown fences, no extra text:
{
  "summary": "One sentence: what is this page about?",
  "keyFacts": ["fact 1", "fact 2", "fact 3"],
  "entities": ["entity 1", "entity 2"],
  "relevanceScore": 7,
  "topExcerpt": "The single most important sentence or data point from this page"
}

Rules:
- summary: one sentence, factual, no fluff
- keyFacts: 3–6 concrete facts, data points, or claims from the page
- entities: named things — products, tools, people, companies, technologies
- relevanceScore: 0 = completely irrelevant, 10 = directly answers the query
- topExcerpt: verbatim quote of the most useful sentence (max 200 chars)`;
    try {
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0,
            maxTokens: 400,
        });
        let content = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(content);
        return {
            summary: String(parsed.summary ?? ''),
            keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts.map(String) : [],
            entities: Array.isArray(parsed.entities) ? parsed.entities.map(String) : [],
            relevanceScore: Number(parsed.relevanceScore ?? 5),
            topExcerpt: String(parsed.topExcerpt ?? ''),
        };
    }
    catch (err) {
        console.warn('[FernCrawl] LLM understanding failed:', err instanceof Error ? err.message : String(err));
        return {
            summary: `Content from ${url}`,
            keyFacts: [],
            entities: [],
            relevanceScore: 5,
            topExcerpt: markdown.slice(0, 200),
        };
    }
}
// ── Core single-page crawl ────────────────────────────────────────────────
/**
 * Crawl a single URL with FernCrawl:
 *   1. Playwright renders the full page (JS included)
 *   2. Noise elements are removed
 *   3. Main content is extracted and converted to Markdown
 *   4. (Optional) LLM reads the Markdown and produces structured understanding
 */
async function fernCrawlScrape(url, config = {}) {
    const headless = config.headless ?? true;
    const timeout = config.timeoutMs ?? 20_000;
    const maxLen = config.maxLengthChars ?? 12_000;
    let browser = null;
    try {
        const pw = loadPlaywright();
        browser = await pw.chromium.launch({ headless });
        const ctx = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale: 'en-US',
        });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        // Let JS frameworks hydrate
        await page.waitForTimeout(800);
        const extracted = await page.evaluate((noiseSelectors) => {
            document.querySelectorAll(noiseSelectors).forEach(el => el.remove());
            const mainEl = document.querySelector('main') ??
                document.querySelector('article') ??
                document.querySelector('[role="main"]') ??
                document.querySelector('.content, .main-content, .post-content, .entry-content, .article-body') ??
                document.body;
            const rawHtml = mainEl?.innerHTML ?? '';
            const origin = location.origin;
            const links = [];
            document.querySelectorAll('a[href]').forEach(a => {
                const href = a.href;
                if (href.startsWith(origin) && !href.includes('#') && href !== location.href) {
                    links.push(href);
                }
            });
            return {
                html: rawHtml,
                title: document.title ?? '',
                links: [...new Set(links)].slice(0, 30),
            };
        }, NOISE_SELECTORS);
        await ctx.close();
        const markdown = htmlToMarkdown(extracted.html);
        const truncated = markdown.length > maxLen
            ? markdown.slice(0, maxLen) + '\n\n...(content truncated)'
            : markdown;
        // LLM understanding layer — only runs when an AI client is provided
        let understanding;
        if (config.aiClient && truncated.trim().length > 100) {
            understanding = await understandPage(truncated, url, extracted.title || undefined, config.aiClient, config.researchQuery);
        }
        return {
            url,
            markdown: truncated,
            understanding,
            title: extracted.title || undefined,
            links: extracted.links,
            success: truncated.trim().length > 0,
        };
    }
    catch (err) {
        return {
            url,
            markdown: '',
            success: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        await browser?.close().catch(() => { });
    }
}
// ── BFS deep crawl ────────────────────────────────────────────────────────
/**
 * Deep-crawl a site using BFS link following.
 * Stays on the same origin, respects maxPages, runs pages in parallel batches of 3.
 * Each page optionally goes through the LLM understanding layer.
 */
async function fernCrawlDeep(rootUrl, maxPages = 5, config = {}) {
    const origin = (() => {
        try {
            return new URL(rootUrl).origin;
        }
        catch {
            return '';
        }
    })();
    const visited = new Set([rootUrl]);
    const queue = [rootUrl];
    const pages = [];
    while (queue.length > 0 && pages.length < maxPages) {
        const batch = queue.splice(0, Math.min(3, maxPages - pages.length));
        const results = await Promise.all(batch.map(u => fernCrawlScrape(u, config)));
        for (const result of results) {
            pages.push(result);
            if (result.links) {
                for (const link of result.links) {
                    if (!visited.has(link) && link.startsWith(origin)) {
                        visited.add(link);
                        queue.push(link);
                    }
                }
            }
        }
    }
    return {
        rootUrl,
        pages,
        totalPages: pages.length,
        success: pages.some(p => p.success),
    };
}
/**
 * Check if FernCrawl is available (Playwright installed).
 */
async function isFernCrawlAvailable() {
    try {
        loadPlaywright();
        return true;
    }
    catch {
        return false;
    }
}
// ── Backward-compat aliases (used by website-crawl.ts and deep-research-agent.ts) ──
exports.crawl4aiScrape = fernCrawlScrape;
exports.crawl4aiDeepCrawl = fernCrawlDeep;
exports.isCrawl4AIAvailable = isFernCrawlAvailable;
