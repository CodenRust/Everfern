"use strict";
/**
 * EverFern Desktop — Browser Use Tool  (Parallel Investigative Engine)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAction = executeAction;
exports.performSmartResearch = performSmartResearch;
exports.runBrowserResearch = runBrowserResearch;
exports.createBrowserUseTool = createBrowserUseTool;
exports.openDebugBrowser = openDebugBrowser;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ChromeExtensionAPI {
    page = null;
    extensionId = '';
    setPage(page, extensionId) {
        this.page = page;
        this.extensionId = extensionId;
    }
    async sendMessage(message) {
        if (!this.page || !this.extensionId)
            return { success: false };
        return this.page.evaluate(({ extId, msg }) => {
            return new Promise((resolve) => {
                const win = window;
                if (!win.chrome?.runtime?.sendMessage)
                    return resolve({ success: false });
                win.chrome.runtime.sendMessage(extId, msg, (response) => {
                    resolve(response || { success: true });
                });
            });
        }, { extId: this.extensionId, msg: message }).catch(() => ({ success: false }));
    }
    async activate(sessionId) {
        return this.sendMessage({
            type: 'activate-extension',
            payload: { sessionId, playwrightDetected: true, automationLevel: 'enhanced' }
        });
    }
    async applyShimmer() {
        return this.sendMessage({ type: 'apply-shimmer' });
    }
    async captureElements() {
        const res = await this.sendMessage({ type: 'capture-elements' });
        return res.elements || [];
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STEALTH_SCRIPT = `
(function() {
  // Session beacon for extension communication
  const beacon = document.createElement('div');
  beacon.id = 'everfern-session-beacon';
  beacon.style.display = 'none';
  beacon.setAttribute('data-session-active', 'true');
  document.documentElement.appendChild(beacon);
  // Mask webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  // Realistic plugin/language fingerprint
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
})();
`;
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];
function pickUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
async function humanPause(page, base = 300, jitter = 200) {
    await page.waitForTimeout(base + Math.floor(Math.random() * jitter));
}
function heuristicFastPath(url, title, rawText) {
    const u = url.toLowerCase();
    const t = title.toLowerCase();
    const text = rawText.slice(0, 500).toLowerCase();
    // Instant bail — these pages are never useful
    if (/\/(login|signin|signup|register|auth|oauth|sso|captcha|verify|confirm-email)/.test(u)) {
        return { skip: true, reason: 'auth wall' };
    }
    if (/404|not.found|page.not.found|doesn.t.exist/.test(t) || rawText.length < 100) {
        return { skip: true, reason: '404 or empty' };
    }
    if (/\/(privacy|terms|tos|legal|cookie|gdpr|ccpa)/.test(u) && !/review|compare|vs/.test(u)) {
        return { skip: true, reason: 'legal page' };
    }
    if (/\.(jpg|jpeg|png|gif|svg|pdf|zip|exe|dmg|mp4|mp3)$/.test(u)) {
        return { skip: true, reason: 'binary file' };
    }
    // Cookie consent wall — text is almost entirely cookie notice
    const cookieKeywords = ['accept cookies', 'we use cookies', 'cookie policy', 'cookie consent', 'gdpr consent'];
    const cookieHits = cookieKeywords.filter(k => text.includes(k)).length;
    if (cookieHits >= 2 && rawText.length < 800) {
        return { skip: true, reason: 'cookie wall' };
    }
    return { skip: false };
}
// ─────────────────────────────────────────────────────────────────────────────
// Cookie/modal auto-dismissal — runs before every extraction
// ─────────────────────────────────────────────────────────────────────────────
async function dismissOverlays(page) {
    // Common cookie/modal dismiss button text patterns
    const dismissTexts = [
        'Accept all', 'Accept All', 'Accept cookies', 'Accept Cookies',
        'I accept', 'I agree', 'Agree', 'Got it', 'OK', 'Close',
        'Dismiss', 'No thanks', 'Continue', 'Allow all',
    ];
    for (const text of dismissTexts) {
        const btn = page.locator(`button, [role="button"], a`)
            .filter({ hasText: new RegExp(`^${text}$`, 'i') })
            .first();
        const visible = await btn.isVisible({ timeout: 300 }).catch(() => false);
        if (visible) {
            await btn.click({ timeout: 1000 }).catch(() => { });
            await page.waitForTimeout(300);
            break; // one dismiss is enough
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Smart scroll — trigger lazy-loaded content before extracting
// ─────────────────────────────────────────────────────────────────────────────
async function smartScroll(page) {
    // Scroll down in 2 steps to trigger lazy loading, then back to top
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(() => { });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => { });
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => { });
}
// ─────────────────────────────────────────────────────────────────────────────
// Extraction & Decision
// ─────────────────────────────────────────────────────────────────────────────
async function extractPageContent(page) {
    return page.evaluate(() => {
        // Focus on interactive + heading elements only, max depth 5
        const buildDomTree = (root, depth = 0) => {
            if (depth > 5)
                return '';
            let tree = '';
            for (const el of Array.from(root.children)) {
                const tag = el.tagName.toLowerCase();
                const isInt = ['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
                    ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'combobox'].includes(el.getAttribute('role') || '');
                if (isInt || /^h[1-4]$/.test(tag)) {
                    const text = el.innerText?.trim().slice(0, 80) || '';
                    const href = el.href || '';
                    const hrefStr = href ? ` href="${href.slice(0, 100)}"` : '';
                    const role = el.getAttribute('role') ? ` role="${el.getAttribute('role')}"` : '';
                    tree += `${'  '.repeat(depth)}<${tag}${role}${hrefStr}> ${text}\n`;
                }
                if (['div', 'section', 'main', 'nav', 'header', 'article', 'aside', 'form', 'ul', 'ol'].includes(tag)) {
                    tree += buildDomTree(el, depth + 1);
                }
            }
            return tree;
        };
        // Extract structured data (JSON-LD)
        const jsonLd = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                jsonLd.push(s.textContent || '');
            }
            catch { }
        });
        // Extract pricing info
        const pricePatterns = /\$[\d,]+(\.\d{2})?|\d+\s*(USD|EUR|GBP|per month|\/mo|\/year|\/yr)/gi;
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, footer, nav').forEach(e => e.remove());
        const fullText = clone.innerText.replace(/\s+/g, ' ').trim();
        const priceMatches = fullText.match(pricePatterns) || [];
        // Extract ratings/reviews
        const ratingPatterns = /(\d+\.?\d*)\s*(out of|\/)\s*5|(\d+)%\s*(positive|satisfaction)|(\d[\d,]+)\s*(reviews?|ratings?)/gi;
        const ratingMatches = fullText.match(ratingPatterns) || [];
        // Prefer <main> or <article> content for rawText — more signal, less nav noise
        const mainEl = document.querySelector('main, article, [role="main"]');
        const bodyText = mainEl ? mainEl.innerText.replace(/\s+/g, ' ').trim() : fullText;
        return {
            title: document.title,
            url: location.href,
            metaDescription: document.querySelector('meta[name="description"]')?.content || '',
            headings: Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h => h.innerText.trim()).filter(Boolean),
            paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText.trim()).filter(t => t.length > 40).slice(0, 30),
            tables: Array.from(document.querySelectorAll('table')).map(t => Array.from(t.querySelectorAll('tr')).map(r => Array.from(r.querySelectorAll('td,th')).map(c => c.innerText.trim()).join(' | '))),
            links: Array.from(document.querySelectorAll('a[href]'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(l => l.text && l.href.startsWith('http') && l.text.length > 2 && l.text.length < 120)
                .slice(0, 40),
            rawText: bodyText.slice(0, 8000),
            domTree: buildDomTree(document.body).slice(0, 6000),
            prices: [...new Set(priceMatches)].slice(0, 10),
            ratings: [...new Set(ratingMatches)].slice(0, 5),
            structuredData: jsonLd.join('\n').slice(0, 1500),
        };
    }).catch(() => ({
        title: '', url: page.url(), metaDescription: '', headings: [], paragraphs: [], tables: [], links: [], rawText: '', domTree: '',
        prices: [], ratings: [], structuredData: ''
    }));
}
class SharedResearchMemory {
    facts = [];
    visitedUrls = new Set();
    queuedUrls = new Set(); // O(1) dedup
    urlQueue = [];
    addFact(fact) {
        this.facts.push(fact);
        this.visitedUrls.add(fact.url);
    }
    markVisited(url) {
        this.visitedUrls.add(url);
    }
    hasVisited(url) {
        try {
            const u = new URL(url);
            return this.visitedUrls.has(u.href) || this.visitedUrls.has(url);
        }
        catch {
            return this.visitedUrls.has(url);
        }
    }
    queueUrl(url, score = 50) {
        if (!this.hasVisited(url) && !this.queuedUrls.has(url)) {
            this.queuedUrls.add(url);
            this.urlQueue.push({ url, score });
            // Keep queue sorted by score descending — best URLs first
            this.urlQueue.sort((a, b) => b.score - a.score);
        }
    }
    dequeueUrl() {
        const item = this.urlQueue.shift();
        if (item)
            this.queuedUrls.delete(item.url);
        return item?.url;
    }
    peekNextUrl() {
        return this.urlQueue[0]?.url;
    }
    getSummary() {
        if (this.facts.length === 0)
            return '';
        if (this.facts.length === 1) {
            const f = this.facts[0];
            const parts = [f.summary];
            if (f.prices.length)
                parts.push(`Pricing: ${f.prices.join(', ')}`);
            if (f.ratings.length)
                parts.push(`Ratings: ${f.ratings.join(', ')}`);
            if (f.keyFacts.length)
                parts.push(f.keyFacts.join('. '));
            return `${parts.join('. ')} (Source: ${f.url})`;
        }
        // Multiple sources — raw data for the synthesizer to work with
        return this.facts.map(f => {
            const parts = [`[${f.title}] (${f.url})`, f.summary];
            if (f.prices.length)
                parts.push(`Pricing: ${f.prices.join(', ')}`);
            if (f.ratings.length)
                parts.push(`Ratings: ${f.ratings.join(', ')}`);
            if (f.keyFacts.length)
                parts.push(`Facts: ${f.keyFacts.join(' | ')}`);
            return parts.join(' — ');
        }).join('\n\n');
    }
    getFacts() { return [...this.facts]; }
    getFactCount() { return this.facts.length; }
    getVisitedCount() { return this.visitedUrls.size; }
    getQueueSize() { return this.urlQueue.length; }
}
// ─────────────────────────────────────────────────────────────────────────────
// Relevance Scoring — fast pre-filter before AI analysis
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Quick heuristic relevance check before spending an AI call on a page.
 * Returns a score 0-100. Below threshold → skip the page entirely.
 */
function scorePageRelevance(taskDescription, content) {
    const taskWords = taskDescription.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3);
    const pageText = [
        content.title,
        content.metaDescription,
        content.headings.join(' '),
        content.rawText.slice(0, 2000),
    ].join(' ').toLowerCase();
    // Count how many task keywords appear in the page
    const matchCount = taskWords.filter(w => pageText.includes(w)).length;
    const matchRatio = taskWords.length > 0 ? matchCount / taskWords.length : 0;
    let score = matchRatio * 60; // Up to 60 points for keyword match
    // Bonus for high-value page types
    const url = content.url.toLowerCase();
    if (/\/pricing|\/price|\/plans/.test(url))
        score += 20;
    if (/\/features|\/product|\/overview/.test(url))
        score += 15;
    if (/\/docs|\/documentation|\/guide/.test(url))
        score += 10;
    if (/\/reviews|\/compare|\/vs/.test(url))
        score += 15;
    if (/\/about/.test(url))
        score += 5;
    // Penalty for clearly irrelevant pages
    if (/login|signin|signup|register|checkout|cart|cookie|privacy|terms|404|error/.test(url))
        score -= 30;
    if (content.title.toLowerCase().includes('404') || content.title.toLowerCase().includes('not found'))
        score -= 50;
    if (content.rawText.length < 200)
        score -= 20; // Thin content
    // Bonus if prices or ratings detected (high-signal pages)
    if (content.prices && content.prices.length > 0)
        score += 15;
    if (content.ratings && content.ratings.length > 0)
        score += 10;
    return Math.max(0, Math.min(100, score));
}
/**
 * Score a URL before visiting it — avoids wasting steps on irrelevant pages.
 */
function scoreUrlRelevance(url, taskDescription, linkText = '') {
    const task = taskDescription.toLowerCase();
    const u = url.toLowerCase();
    const lt = linkText.toLowerCase();
    let score = 30; // Base — must earn its way up
    // High-value path bonuses
    if (/\/pricing|\/price|\/plans/.test(u))
        score += 35;
    if (/\/features|\/product|\/overview/.test(u))
        score += 28;
    if (/\/docs|\/documentation/.test(u))
        score += 22;
    if (/\/reviews|\/compare|\/vs/.test(u))
        score += 28;
    if (/\/about/.test(u))
        score += 10;
    if (/\/blog|\/news|\/article/.test(u))
        score += 8;
    // Link text signals — "View details", "See pricing", "Learn more" etc.
    if (/view detail|see detail|more detail|full detail/.test(lt))
        score += 30;
    if (/pricing|see price|view price|how much|cost/.test(lt))
        score += 30;
    if (/features|capabilities|what.s included/.test(lt))
        score += 25;
    if (/learn more|read more|find out more|discover/.test(lt))
        score += 15;
    if (/review|rating|testimonial|what.s people say/.test(lt))
        score += 20;
    if (/get started|try|demo|free trial/.test(lt))
        score += 12;
    if (/documentation|docs|guide|how to/.test(lt))
        score += 18;
    if (/compare|vs\b|versus|alternative/.test(lt))
        score += 22;
    if (/about|overview|introduction/.test(lt))
        score += 8;
    // Penalty for noise
    if (/login|signin|signup|register|checkout|cart|cookie|privacy|terms|tos|legal/.test(u))
        score -= 60;
    if (/cdn\.|static\.|assets\.|img\.|images\./.test(u))
        score -= 70;
    if (/\.(jpg|jpeg|png|gif|svg|pdf|zip|exe|dmg)$/.test(u))
        score -= 90;
    if (/\?.*utm_/.test(u))
        score -= 15;
    if (/#/.test(u))
        score -= 5;
    // Task keyword match in URL or link text — strong signal
    const taskWords = task.split(/\s+/).filter(w => w.length > 3);
    const urlMatches = taskWords.filter(w => u.includes(w)).length;
    const textMatches = taskWords.filter(w => lt.includes(w)).length;
    score += urlMatches * 12;
    score += textMatches * 8;
    return Math.max(0, Math.min(100, score));
}
const HIGH_VALUE_PATHS = [
    '/pricing', '/price', '/plans', '/features', '/about',
    '/docs', '/documentation', '/overview', '/product',
    '/compare', '/comparison', '/reviews', '/testimonials',
    '/faq', '/help', '/getting-started', '/integrations',
];
function discoverHighValueUrls(baseUrl, links, taskDescription) {
    const discovered = [];
    try {
        const base = new URL(baseUrl);
        const baseDomain = base.hostname;
        for (const link of links) {
            try {
                const u = new URL(link.href);
                const isSameDomain = u.hostname === baseDomain;
                // Pass link text so "View details" / "See pricing" links get boosted
                const urlScore = scoreUrlRelevance(link.href, taskDescription, link.text);
                // Same-domain: include if score >= 38
                // Cross-domain: only include if score >= 58 (must be clearly relevant)
                const threshold = isSameDomain ? 38 : 58;
                if (urlScore >= threshold) {
                    discovered.push({ url: link.href, score: urlScore });
                }
            }
            catch { }
        }
    }
    catch { }
    // Sort by score, deduplicate, take top 12
    const seen = new Set();
    return discovered
        .sort((a, b) => b.score - a.score)
        .filter(d => { if (seen.has(d.url))
        return false; seen.add(d.url); return true; })
        .slice(0, 12);
}
function buildDirectUrls(baseUrl, taskDescription) {
    try {
        const u = new URL(baseUrl);
        const base = `${u.protocol}//${u.hostname}`;
        return HIGH_VALUE_PATHS.slice(0, 6).map(p => ({
            url: base + p,
            score: scoreUrlRelevance(base + p, taskDescription)
        })).filter(d => d.score >= 40);
    }
    catch {
        return [];
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Upfront research planner — runs once to decompose the task before browsing
// ─────────────────────────────────────────────────────────────────────────────
async function planResearch(client, taskDescription) {
    const prompt = `You are a research strategist. Given a research task, create a focused plan.

TASK: "${taskDescription}"

Respond with JSON:
{
  "goal": "refined 1-sentence description of exactly what we need to find",
  "targetSites": ["site1.com", "site2.com"],
  "searchQueries": ["specific query 1", "specific query 2"],
  "mustFind": ["specific fact 1 we need", "specific fact 2"],
  "avoidPatterns": ["pattern to avoid like /tag/, /category/, /list/"]
}

targetSites: specific authoritative sites for this topic. Examples:
- Discord bots → top.gg, discord.bots.gg, discordbotlist.com, bots.ondiscord.xyz
- npm packages → npmjs.com, bundlephobia.com, github.com
- SaaS tools → the product's own site, g2.com, capterra.com, producthunt.com
- News/events → reuters.com, bbc.com, specific news sites

mustFind: the specific pieces of information that would make this research complete.
avoidPatterns: URL path patterns that indicate list/category pages we should drill THROUGH not extract from.

Be specific and practical. Max 5 targetSites, 3 searchQueries, 5 mustFind items.`;
    try {
        const res = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 400,
        });
        const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
        return JSON.parse(raw.replace(/```json\s*|```/g, ''));
    }
    catch {
        return {
            goal: taskDescription,
            targetSites: [],
            searchQueries: [taskDescription],
            mustFind: [],
            avoidPatterns: ['/tag/', '/category/', '/list/', '/search/'],
        };
    }
}
async function analyzePageContent(client, taskDescription, content, sharedMemory, plan) {
    const result = await analyzeAndDecide(client, taskDescription, content, null, 1, 20, sharedMemory, plan);
    return result.analysis;
}
async function analyzeAndDecide(client, taskDescription, content, screenshot, step, maxSteps, sharedMemory, plan, extensionElements = []) {
    const memCount = sharedMemory.getFactCount();
    const stepsLeft = maxSteps - step;
    // Heuristic fast-path — no AI needed for obvious cases
    const fastPath = heuristicFastPath(content.url, content.title, content.rawText);
    if (fastPath.skip) {
        const nextQueued = sharedMemory.peekNextUrl();
        return {
            analysis: { isUseful: false, shouldExtract: false, facts: [], nextUrls: [], summary: fastPath.reason || 'skipped', confidence: 0, pricingFound: [], ratingsFound: [], keyFacts: [], pageType: 'skip', itemUrls: [] },
            action: nextQueued ? { action: 'navigate', url: nextQueued, thought: `Skipping ${fastPath.reason}` } : { action: 'back', thought: `Skipping ${fastPath.reason}` }
        };
    }
    // Avoid-pattern fast-path
    if (plan?.avoidPatterns?.length) {
        const urlLower = content.url.toLowerCase();
        if (plan.avoidPatterns.some(p => urlLower.includes(p.toLowerCase()))) {
            return {
                analysis: { isUseful: true, shouldExtract: false, facts: [], nextUrls: [], summary: 'List/category page', confidence: 0.3, pricingFound: [], ratingsFound: [], keyFacts: [], pageType: 'list', itemUrls: [] },
                action: { action: 'extract', thought: 'List page — queuing items' }
            };
        }
    }
    const relevanceScore = scorePageRelevance(taskDescription, content);
    const mustFindSection = plan?.mustFind?.length ? `Still need to find: ${plan.mustFind.join(', ')}` : '';
    // Build context for the AI — give it everything it needs to make a smart decision
    const pageContext = [
        `Title: ${content.title}`,
        `URL: ${content.url}`,
        content.metaDescription ? `Description: ${content.metaDescription}` : '',
        content.headings.length ? `Headings: ${content.headings.slice(0, 10).join(' | ')}` : '',
        content.prices?.length ? `Prices detected: ${content.prices.join(', ')}` : '',
        content.ratings?.length ? `Ratings detected: ${content.ratings.join(', ')}` : '',
        content.structuredData ? `Structured data: ${content.structuredData.slice(0, 400)}` : '',
        content.tables.length ? `Tables:\n${content.tables.slice(0, 2).map(t => t.slice(0, 5).join(' | ')).join('\n')}` : '',
        `\nPage text:\n${content.rawText.slice(0, 1600)}`,
        `\nLinks on page:\n${content.links.slice(0, 25).map(l => `"${l.text}" → ${l.href.slice(0, 100)}`).join('\n')}`,
        extensionElements.length ? `\nInteractive elements:\n${extensionElements.slice(0, 10).map(e => `<${e.tagName}> "${e.textContent.slice(0, 60)}" [${e.selector}]`).join('\n')}` : '',
    ].filter(Boolean).join('\n');
    const systemPrompt = `You are an autonomous web research agent. Your job is to research: "${taskDescription}"

${mustFindSection ? mustFindSection + '\n' : ''}You have collected ${memCount} sources so far. Step ${step} of ${maxSteps}.

You have these tools available:
- navigate(url) — go to a URL directly
- click(target) — click a button or link by its visible text
- fill(label, text) — type into a form field, then press Enter
- scroll(direction) — scroll "down" or "up" to reveal more content
- extract(facts, urls, summary) — save this page's information to memory. facts=array of specific facts found, urls=array of URLs to visit next, summary=what you found
- done(summary) — finish research and return final answer

Rules:
- Use extract() when you find useful information — include specific facts (numbers, names, prices) and any URLs worth visiting next
- Use navigate() to go to specific URLs — pricing pages, product pages, documentation, etc.
- Use click() to interact with the page — "View details", "See pricing", "Read more" buttons
- Use fill() to search — type a query and submit
- Use scroll() if you think there's more content below
- Use done() when you have enough information (at least ${Math.max(3, memCount)} good sources)
- If a page is useless (login wall, 404, unrelated) — navigate away immediately
- Prioritize: product pages > article pages > list pages (drill into list items)
- Look for "View details", "Pricing", "Features", "About", "Documentation" links — these have the best info`;
    const userMessage = `Current page:\n${pageContext}

What do you want to do? Call one tool. Respond with JSON: {"tool": "...", "args": {...}, "reasoning": "why you're doing this"}`;
    const callAI = async (useVision) => {
        const userContent = [{ type: 'text', text: userMessage }];
        if (useVision && screenshot) {
            userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot}` } });
        }
        return client.chat({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            responseFormat: 'json',
            temperature: 0.2,
            maxTokens: 600
        });
    };
    const parseToolCall = (raw) => {
        const d = JSON.parse(raw.replace(/```json\s*|```/g, ''));
        // Handle both formats: { tool: "...", args: {...} } and { action: "...", ... }
        const tool = (d.tool || d.action)?.toLowerCase() || 'navigate';
        const args = d.args || {};
        // Build BrowserAction from tool call
        let action;
        switch (tool) {
            case 'navigate':
                action = { action: 'navigate', url: args.url || '', thought: d.reasoning };
                break;
            case 'click':
                action = { action: 'click', target: args.target || args.text || '', thought: d.reasoning };
                break;
            case 'fill':
                action = { action: 'fill', label: args.label || 'search', text: args.text || args.query || '', thought: d.reasoning };
                break;
            case 'scroll':
                action = { action: 'scroll', direction: args.direction === 'up' ? 'up' : 'down', thought: d.reasoning };
                break;
            case 'extract':
                action = { action: 'extract', thought: d.reasoning };
                break;
            case 'done':
                action = { action: 'done', summary: args.summary || d.reasoning, thought: d.reasoning };
                break;
            case 'back':
                action = { action: 'back', thought: d.reasoning || d.thought };
                break;
            case 'forward':
                action = { action: 'forward', thought: d.reasoning || d.thought };
                break;
            case 'wait':
                action = { action: 'wait', ms: args.ms || 2000, thought: d.reasoning || d.thought };
                break;
            case 'type':
                action = { action: 'type', text: args.text || '', thought: d.reasoning || d.thought };
                break;
            case 'scroll_to':
                action = { action: 'scroll_to', target: args.target || '', thought: d.reasoning || d.thought };
                break;
            case 'select':
                action = { action: 'select', target: args.target || '', text: args.text || '', thought: d.reasoning || d.thought };
                break;
            case 'goto_link':
                action = { action: 'goto_link', url: args.url || '', thought: d.reasoning };
                break;
            default:
                // AI returned something unexpected — navigate to next queued URL
                action = { action: 'navigate', url: sharedMemory.peekNextUrl() || '', thought: d.reasoning };
        }
        // Build analysis from extract args (if the AI called extract, it told us what it found)
        const isExtract = tool === 'extract';
        const extractedFacts = isExtract ? (args.facts || d.facts || []) : [];
        const extractedUrls = isExtract ? (args.urls || d.urls || []) : [];
        const extractedSummary = isExtract ? (args.summary || d.reasoning || '') : '';
        return {
            analysis: {
                isUseful: isExtract || tool === 'click',
                shouldExtract: isExtract,
                facts: extractedFacts,
                nextUrls: extractedUrls.filter(u => u.startsWith('http')),
                summary: extractedSummary,
                confidence: isExtract ? 0.8 : 0.3,
                pricingFound: [],
                ratingsFound: [],
                keyFacts: extractedFacts,
                pageType: isExtract ? 'content' : 'navigation',
                itemUrls: extractedUrls.filter(u => u.startsWith('http'))
            },
            action
        };
    };
    try {
        const useVision = !!screenshot && relevanceScore < 50;
        const res = await callAI(useVision);
        const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
        return parseToolCall(raw);
    }
    catch {
        try {
            const res = await callAI(false);
            const raw = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
            return parseToolCall(raw);
        }
        catch {
            return {
                analysis: { isUseful: false, shouldExtract: false, facts: [], nextUrls: [], summary: '', confidence: 0, pricingFound: [], ratingsFound: [], keyFacts: [], pageType: 'error', itemUrls: [] },
                action: { action: 'back', thought: 'AI call failed' }
            };
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Execution Engine
// ─────────────────────────────────────────────────────────────────────────────
async function executeAction(ctx) {
    const { page, action, onProgress, extensionElements, extensionAPI, taskId } = ctx;
    switch (action.action) {
        case 'navigate':
        case 'goto_link':
            const url = action.url || '';
            onProgress(`🌍 [${taskId}] Navigating to ${url.slice(0, 50)}...`);
            // Use 'load' not 'networkidle' — networkidle hangs forever on pages with websockets/polling
            await page.goto(url, { waitUntil: 'load', timeout: 20000 }).catch(() => { });
            await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => { });
            break;
        case 'back':
            onProgress(`🔙 [${taskId}] Going back...`);
            await page.goBack().catch(() => { });
            break;
        case 'forward':
            onProgress(`🔜 [${taskId}] Going forward...`);
            await page.goForward().catch(() => { });
            break;
        case 'click':
            const target = action.target || '';
            onProgress(`🖱️ [${taskId}] Clicking "${target}"...`);
            let clicked = false;
            if (extensionElements.length > 0) {
                const el = extensionElements.find(e => e.textContent.toLowerCase().includes(target.toLowerCase()));
                if (el) {
                    await page.locator(el.selector).click().catch(() => { });
                    clicked = true;
                }
            }
            if (!clicked) {
                await page.locator('a, button, input, span, [role="button"], [role="link"], [role="menuitem"], [role="tab"]')
                    .filter({ hasText: target })
                    .first()
                    .click({ timeout: 5000 })
                    .catch(() => { });
            }
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { });
            break;
        case 'fill': {
            const fillLabel = (action.label || '').toLowerCase();
            onProgress(`📝 [${taskId}] Filling "${action.label}"...`);
            const fillLocator = page.locator('input, textarea').filter({
                has: page.locator(`[placeholder*="${fillLabel}" i], [id*="${fillLabel}" i], [name*="${fillLabel}" i]`)
            }).first();
            try {
                await fillLocator.fill(action.text || '', { timeout: 5000 });
            }
            catch {
                await fillLocator.type(action.text || '', { delay: 30 }).catch(() => { });
            }
            break;
        }
        case 'type':
            onProgress(`⌨️ [${taskId}] Typing text...`);
            await page.keyboard.type(action.text || '', { delay: 50 });
            await page.keyboard.press('Enter');
            break;
        case 'scroll':
            const px = action.direction === 'up' ? -600 : 600;
            await page.mouse.wheel(0, px);
            break;
        case 'scroll_to':
            onProgress(`📜 [${taskId}] Scrolling to "${action.target}"...`);
            await page.locator(action.target || 'body').scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => { });
            break;
        case 'hover':
            onProgress(`🖱️ [${taskId}] Hovering over "${action.target}"...`);
            await page.locator('a, button, [role="button"], [role="menuitem"], nav *')
                .filter({ hasText: action.target || '' })
                .first()
                .hover({ timeout: 3000 })
                .catch(() => { });
            await page.waitForTimeout(400); // let dropdown render
            break;
        case 'select':
            onProgress(`🔽 [${taskId}] Selecting "${action.text}" in "${action.target}"...`);
            await page.locator(action.target || 'select').selectOption(action.text || '', { timeout: 5000 }).catch(() => { });
            break;
        case 'wait':
            await page.waitForTimeout(action.ms || 2000);
            break;
    }
    await extensionAPI.applyShimmer().catch(() => { });
    // Vary pause by action type — navigation needs more settle time, scrolling less
    const pauseMs = ['navigate', 'goto_link', 'click'].includes(action.action) ? 500 : 200;
    await humanPause(page, pauseMs, 150);
}
// ─────────────────────────────────────────────────────────────────────────────
// Final synthesis — turns raw extracted facts into a real answer
// ─────────────────────────────────────────────────────────────────────────────
async function synthesizeResearch(client, task, facts, plan) {
    if (facts.length === 0)
        return 'No useful sources found.';
    const factsText = facts.map(f => {
        const parts = [`SOURCE: ${f.title} (${f.url})`, `Summary: ${f.summary}`];
        if (f.prices.length)
            parts.push(`Pricing: ${f.prices.join(', ')}`);
        if (f.ratings.length)
            parts.push(`Ratings: ${f.ratings.join(', ')}`);
        if (f.keyFacts.length)
            parts.push(`Facts: ${f.keyFacts.join(' | ')}`);
        return parts.join('\n');
    }).join('\n\n---\n\n');
    const mustFindText = plan.mustFind.length
        ? `\nThe user specifically needed: ${plan.mustFind.join(', ')}`
        : '';
    const prompt = `You researched: "${task}"${mustFindText}

Here's what you found across ${facts.length} sources:

${factsText}

Write a direct, useful answer. Rules:
- Lead with the actual answer/recommendation, not "Based on my research..."
- Use specific numbers, names, prices from the sources — no vague claims
- If comparing options, say which is best and why in concrete terms
- Cite sources inline as (source: URL) not as footnotes
- No markdown headers, no bullet point walls — write like a knowledgeable person explaining to a friend
- If the data is thin or contradictory, say so directly
- Max 4 paragraphs`;
    try {
        const res = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            maxTokens: 600,
        });
        return typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    }
    catch {
        // Fallback: just return the raw facts in a readable format
        return facts.map(f => `${f.title}: ${f.summary}${f.prices.length ? ` Pricing: ${f.prices.join(', ')}.` : ''}`).join('\n\n');
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Smart Research Loop — URL-first, directory-aware, shared memory
// ─────────────────────────────────────────────────────────────────────────────
async function performSmartResearch(ctx, task, taskId, aiClient, maxSteps, onProgress, sessionId, bridgeServer, sharedMemory) {
    const page = await ctx.newPage();
    const extensionAPI = new ChromeExtensionAPI();
    const workers = ctx.serviceWorkers?.() || [];
    const extId = workers.find((w) => w.url().startsWith('chrome-extension://'))?.url()?.split('/')[2] || '';
    if (extId)
        extensionAPI.setPage(page, extId);
    let steps = 0;
    let finalSummary = '';
    let consecutiveUselessPages = 0; // stuck detector
    onProgress(`🚀 [${taskId}] Starting: ${task.task.slice(0, 60)}...`);
    // Step 0: Build a research plan before touching the browser
    const plan = await planResearch(aiClient, task.task);
    onProgress(`🗺️ [${taskId}] Plan: ${plan.goal}`);
    if (plan.targetSites.length > 0) {
        onProgress(`🎯 [${taskId}] Target sites: ${plan.targetSites.join(', ')}`);
        // Seed the queue with target sites (scored by URL relevance)
        plan.targetSites.forEach(site => {
            const url = site.startsWith('http') ? site : `https://${site}`;
            sharedMemory.queueUrl(url, 90); // high priority — these are hand-picked
        });
    }
    // URL-first strategy: if we have a start_url, probe high-value paths immediately
    if (task.start_url) {
        onProgress(`🎯 [${taskId}] Direct URL strategy — probing high-value paths...`);
        const directUrls = buildDirectUrls(task.start_url, task.task);
        directUrls.forEach(d => sharedMemory.queueUrl(d.url, d.score));
        await page.goto(task.start_url, { waitUntil: 'load', timeout: 20000 }).catch(() => { });
    }
    else if (plan.targetSites.length > 0) {
        // Go directly to the highest-priority target site — skip the DuckDuckGo detour
        const firstTarget = plan.targetSites[0].startsWith('http') ? plan.targetSites[0] : `https://${plan.targetSites[0]}`;
        onProgress(`🎯 [${taskId}] Going directly to: ${firstTarget}`);
        await page.goto(firstTarget, { waitUntil: 'load', timeout: 20000 }).catch(() => {
            return page.goto('https://duckduckgo.com', { waitUntil: 'load' }).catch(() => { });
        });
    }
    else {
        await page.goto('https://duckduckgo.com', { waitUntil: 'load' }).catch(() => { });
    }
    while (steps < maxSteps) {
        steps++;
        const currentUrl = page.url();
        sharedMemory.markVisited(currentUrl);
        // Dismiss cookie banners/modals before reading the page
        await dismissOverlays(page);
        // Scroll to trigger lazy-loaded content, then extract
        await smartScroll(page);
        const content = await extractPageContent(page);
        const extElements = extId ? await extensionAPI.captureElements().catch(() => []) : [];
        // Take screenshot only when relevance is uncertain
        const relevanceScore = scorePageRelevance(task.task, content);
        const screenshot = relevanceScore < 50
            ? await page.screenshot({ type: 'jpeg', quality: 35 }).then((b) => b.toString('base64')).catch(() => null)
            : null;
        // ONE AI call: analyze + decide simultaneously
        const { analysis, action } = await analyzeAndDecide(aiClient, task.task, content, screenshot, steps, maxSteps, sharedMemory, plan, extElements);
        // Log thought — strip filler
        if (action.thought) {
            const thought = action.thought.replace(/^(I (will|should|need to|am going to)|Let me|Now I'll|Based on|Looking at)\s+/i, '');
            onProgress(`💭 [${taskId}] ${thought}`);
        }
        // Extract if useful
        if (analysis.isUseful && analysis.shouldExtract) {
            consecutiveUselessPages = 0;
            const fact = {
                url: currentUrl,
                title: content.title,
                summary: analysis.summary,
                prices: analysis.pricingFound,
                ratings: analysis.ratingsFound,
                keyFacts: analysis.keyFacts,
                timestamp: Date.now(),
            };
            sharedMemory.addFact(fact);
            onProgress(`📄 [${taskId}] Extracted: "${content.title.slice(0, 50)}" — ${analysis.keyFacts.slice(0, 2).join('; ')}`);
            // Also queue high-value same-domain links from this page
            const highValueUrls = discoverHighValueUrls(currentUrl, content.links, task.task);
            highValueUrls.forEach(d => {
                if (!sharedMemory.hasVisited(d.url))
                    sharedMemory.queueUrl(d.url, d.score);
            });
        }
        else if (analysis.pageType === 'list' && analysis.itemUrls?.length > 0) {
            onProgress(`📋 [${taskId}] List page — queuing ${analysis.itemUrls.length} items`);
        }
        else if (!analysis.isUseful) {
            consecutiveUselessPages++;
            onProgress(`⏭️ [${taskId}] Skipping: "${content.title.slice(0, 40)}" (${content.url.slice(0, 45)})`);
            if (consecutiveUselessPages >= 4 && sharedMemory.getQueueSize() === 0) {
                onProgress(`� [${taskId}] Stuck — pivoting to search`);
                await page.goto('https://duckduckgo.com', { waitUntil: 'load' }).catch(() => { });
                consecutiveUselessPages = 0;
            }
        }
        else {
            consecutiveUselessPages = 0;
        }
        // Handle done
        if (action.action === 'done' || (maxSteps - steps <= 1 && sharedMemory.getFactCount() >= 2)) {
            const facts = sharedMemory.getFacts();
            if (facts.length > 0) {
                onProgress(`🧠 [${taskId}] Synthesizing ${facts.length} sources...`);
                finalSummary = await synthesizeResearch(aiClient, task.task, facts, plan);
            }
            else {
                finalSummary = 'Research complete.';
            }
            onProgress(`✅ [${taskId}] Done. ${facts.length} sources from ${sharedMemory.getVisitedCount()} pages.`);
            break;
        }
        // Early exit if all mustFind satisfied
        if (plan.mustFind.length > 0 && sharedMemory.getFactCount() >= 3) {
            const allFacts = sharedMemory.getFacts().map(f => f.keyFacts.join(' ') + ' ' + f.summary).join(' ').toLowerCase();
            const satisfied = plan.mustFind.filter(item => item.toLowerCase().split(/\s+/).filter(w => w.length > 3).some(w => allFacts.includes(w)));
            if (satisfied.length >= plan.mustFind.length * 0.8) {
                onProgress(`✅ [${taskId}] All key questions answered — wrapping up`);
                break;
            }
        }
        // CRAWLER NAVIGATION — always drive from the queue, never let AI wander
        // Queue all URLs the AI found on this page
        analysis.itemUrls.forEach((u, i) => {
            if (!sharedMemory.hasVisited(u))
                sharedMemory.queueUrl(u, 85 - i * 2);
        });
        analysis.nextUrls.forEach(u => {
            if (!sharedMemory.hasVisited(u)) {
                const score = scoreUrlRelevance(u, task.task);
                if (score >= 35)
                    sharedMemory.queueUrl(u, score);
            }
        });
        // Handle action execution — queue override only applies to navigate/goto_link/extract
        const shouldOverrideWithQueue = (action.action === 'navigate' || action.action === 'goto_link' || action.action === 'extract') &&
            sharedMemory.peekNextUrl();
        if (shouldOverrideWithQueue) {
            // Queue override: navigate to queued URL instead of AI-decided action
            const nextUrl = sharedMemory.dequeueUrl();
            if (nextUrl) {
                onProgress(`🔗 [${taskId}] → ${nextUrl.slice(0, 70)}`);
                const navOk = await page.goto(nextUrl, { waitUntil: 'load', timeout: 20000 }).then(() => true).catch(() => false);
                if (!navOk) {
                    onProgress(`⚠️ [${taskId}] Failed: ${nextUrl.slice(0, 50)} — skipping`);
                }
            }
        }
        else if (action.action === 'fill' || action.action === 'click' || action.action === 'scroll' ||
            action.action === 'back' || action.action === 'forward' || action.action === 'wait' ||
            action.action === 'type' || action.action === 'scroll_to' || action.action === 'select') {
            // Execute non-navigation actions directly
            await executeAction({ page, action, onProgress, extensionElements: extElements, extensionAPI, taskId });
            // For fill/search, re-read the results page next iteration
            if (action.action === 'fill' && action.label === 'search' && action.text) {
                await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => { });
            }
        }
        else if (action.action === 'navigate' || action.action === 'goto_link') {
            // AI-decided navigation (no queue override)
            const url = action.url || '';
            onProgress(`🌍 [${taskId}] Navigating to ${url.slice(0, 50)}...`);
            await page.goto(url, { waitUntil: 'load', timeout: 20000 }).catch(() => { });
            await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => { });
        }
        else if (action.action === 'extract') {
            // Extract action — no navigation needed, just continue to next iteration
            // (extraction already happened above if analysis.shouldExtract was true)
        }
        else {
            // Fallback: navigate to next queued URL or search
            const nextUrl = sharedMemory.dequeueUrl();
            if (nextUrl) {
                onProgress(`🔗 [${taskId}] → ${nextUrl.slice(0, 70)}`);
                const navOk = await page.goto(nextUrl, { waitUntil: 'load', timeout: 20000 }).then(() => true).catch(() => false);
                if (!navOk) {
                    onProgress(`⚠️ [${taskId}] Failed: ${nextUrl.slice(0, 50)} — skipping`);
                }
            }
            else if (consecutiveUselessPages >= 3 || sharedMemory.getFactCount() === 0) {
                // Queue empty and stuck — search for more sources
                const searchQuery = plan.searchQueries?.[0] || task.task;
                onProgress(`🔍 [${taskId}] Queue empty — searching: "${searchQuery.slice(0, 50)}"`);
                await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`, { waitUntil: 'load', timeout: 15000 }).catch(() => { });
                consecutiveUselessPages = 0;
            }
            else {
                // Nothing left to do — wrap up
                onProgress(`✅ [${taskId}] Queue exhausted after ${sharedMemory.getVisitedCount()} pages`);
                break;
            }
        }
        bridgeServer.setSession(sessionId, page.url(), await page.title().catch(() => 'Researching...'));
        bridgeServer.broadcastCommand('apply-shimmer');
    }
    // If no explicit done, synthesize from memory
    if (!finalSummary) {
        const facts = sharedMemory.getFacts();
        if (facts.length > 0) {
            onProgress(`🧠 [${taskId}] Synthesizing findings from ${facts.length} sources...`);
            finalSummary = await synthesizeResearch(aiClient, task.task, facts, plan);
        }
        else {
            finalSummary = 'No useful sources found during research.';
        }
    }
    await page.close().catch(() => { });
    return { task: task.task, summary: finalSummary, sourcesVisited: sharedMemory.getFactCount() };
}
async function performSingleTaskResearch(ctx, task, taskId, aiClient, maxSteps, onProgress, sessionId, bridgeServer) {
    // Each task gets its own shared memory (tabs within a task share memory)
    const sharedMemory = new SharedResearchMemory();
    return performSmartResearch(ctx, task, taskId, aiClient, maxSteps, onProgress, sessionId, bridgeServer, sharedMemory);
}
async function runBrowserResearch(options) {
    const { tasks, aiClient, onProgress = () => { }, groundingEngine } = options;
    const maxSteps = options.maxSteps || 24;
    try {
        const pw = require('playwright');
        const userDataDir = path.join(os.tmpdir(), `everfern-pw-${Date.now()}`);
        const extensionPath = path.join(process.cwd(), 'public/chrome-extension');
        const context = await pw.chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
            userAgent: pickUA()
        });
        await context.addInitScript({ content: STEALTH_SCRIPT });
        const { bridgeServer } = await Promise.resolve().then(() => __importStar(require('../../lib/extension-server')));
        const sessionId = `session-${Date.now()}`;
        bridgeServer.setSession(sessionId, 'about:blank', 'Parallel Research');
        onProgress(`🌐 Browser initialized. Launching ${tasks.length} parallel research tabs with shared memory...`);
        // Each task gets its own shared memory — tabs within a task share knowledge
        // Multiple tasks run in parallel (like Perplexity's multi-source approach)
        const results = await Promise.all(tasks.map((task, i) => {
            const sharedMemory = new SharedResearchMemory();
            return performSmartResearch(context, task, `Tab ${i + 1}`, aiClient, maxSteps, onProgress, sessionId, bridgeServer, sharedMemory);
        }));
        await context.close().catch(() => { });
        return {
            success: true,
            results,
            steps: results.reduce((acc, r) => acc + r.sourcesVisited, 0)
        };
    }
    catch (err) {
        return { success: false, error: String(err?.message || err), results: [], steps: 0 };
    }
}
function createBrowserUseTool(aiClient, groundingEngine) {
    return {
        name: 'browser_use',
        description: 'Autonomous deep web research tool with parallel task support.',
        parameters: {
            type: 'object',
            properties: {
                tasks: {
                    type: 'array',
                    description: 'List of independent research tasks to perform in parallel',
                    items: {
                        type: 'object',
                        properties: {
                            task: { type: 'string', description: 'Detailed research task' },
                            start_url: { type: 'string', description: 'Optional initial URL' }
                        },
                        required: ['task']
                    }
                },
                maxSteps: { type: 'number', description: 'Maximum interaction steps per task' }
            },
            required: ['tasks']
        },
        async execute(args, onUpdate) {
            const res = await runBrowserResearch({ tasks: args.tasks, aiClient, groundingEngine, onProgress: onUpdate });
            const summary = res.results.map(r => `### Task: ${r.task}\n${r.summary}`).join('\n\n');
            return { success: res.success, output: summary || 'Research complete.', data: res };
        }
    };
}
async function openDebugBrowser() {
    const pw = require('playwright');
    const extensionPath = path.join(process.cwd(), 'public/chrome-extension');
    await pw.chromium.launchPersistentContext('', {
        headless: false,
        args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    });
}
