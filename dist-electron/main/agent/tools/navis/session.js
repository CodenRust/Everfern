"use strict";
/**
 * Navis — Browser Session Manager
 *
 * Handles Playwright browser lifecycle: launch, context, page/tab management, cleanup.
 * No chrome extension — pure Playwright automation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserSession = void 0;
const playwright_1 = require("playwright");
const playwright_extra_1 = require("playwright-extra");
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const overlay_1 = require("./overlay");
const chromium = (0, playwright_extra_1.addExtra)(playwright_1.chromium);
chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
class BrowserSession {
    browser = null;
    context = null;
    activePage = null;
    logger = null;
    getContext() {
        if (!this.context)
            throw new Error('Browser not initialized. Call launch() first.');
        return this.context;
    }
    get page() {
        if (!this.activePage)
            throw new Error('No active page. Call openTab() first.');
        return this.activePage;
    }
    get allPages() {
        if (!this.context)
            throw new Error('Browser not initialized.');
        return this.context.pages();
    }
    async launch(config = {}) {
        const { headless = false, startUrl, logger } = config;
        this.logger = logger || null;
        const realUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
        try {
            this.browser = await chromium.launch({
                headless,
                args: [
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-infobars',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-default-apps',
                    '--no-first-run',
                    '--disable-translate',
                    '--disable-features=ChromeWhatsNewUI',
                    '--disable-background-networking',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--disable-component-update',
                    '--safebrowsing-disable-auto-update',
                    '--disable-hang-monitor',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-domain-reliability',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--lang=en-US',
                ],
                env: {
                    ...process.env,
                },
            });
            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: realUA,
                locale: 'en-US',
                timezoneId: 'America/New_York',
                permissions: ['geolocation'],
                geolocation: { longitude: -73.935242, latitude: 40.730610 },
                colorScheme: 'light',
                hasTouch: false,
                isMobile: false,
                deviceScaleFactor: 1,
                javaScriptEnabled: true,
            });
            await this.context.addInitScript(() => {
                delete window.navigator.webdriver;
            });
        }
        catch (err) {
            if (this.browser) {
                await this.browser.close().catch(() => { });
                this.browser = null;
            }
            throw err;
        }
        await this.openTab(startUrl || 'about:blank');
        this.logger?.browserLaunch(`headless=${headless}, 1920x1080, real Chrome`);
    }
    async openTab(url) {
        if (!this.context)
            throw new Error('Browser not initialized.');
        const newPage = await this.context.newPage();
        await newPage.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        }).catch(() => { });
        await newPage.addInitScript(overlay_1.OVERLAY_SCRIPT, { runOnReload: true }).catch(() => { });
        if (url && url !== 'about:blank') {
            await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
        }
        this.activePage = newPage;
        return newPage;
    }
    async closeTab(page) {
        if (!this.context)
            return;
        await page.close().catch(() => { });
        const remaining = this.context.pages();
        if (remaining.length > 0) {
            this.activePage = remaining[remaining.length - 1];
        }
    }
    async getTabs() {
        if (!this.context)
            return [];
        const pages = this.context.pages();
        const tabs = [];
        for (let i = 0; i < pages.length; i++) {
            const p = pages[i];
            let title = '';
            try {
                title = await p.title();
            }
            catch {
                title = 'Loading...';
            }
            tabs.push({
                id: `tab-${i + 1}`,
                url: p.url(),
                title,
                isActive: p === this.activePage,
            });
        }
        return tabs;
    }
    async switchToTab(indexOrTitle) {
        const pages = this.allPages;
        if (typeof indexOrTitle === 'number') {
            if (indexOrTitle < 0 || indexOrTitle >= pages.length) {
                throw new Error(`Tab index ${indexOrTitle} out of range. Available tabs: 0-${pages.length - 1}`);
            }
            this.activePage = pages[indexOrTitle];
        }
        else {
            const page = pages.find(p => {
                try {
                    return p.title().then(t => t.toLowerCase().includes(indexOrTitle.toLowerCase()));
                }
                catch {
                    return false;
                }
            });
            if (!page) {
                throw new Error(`No tab found matching "${indexOrTitle}". Available: ${pages.map((p, i) => `#${i}: ${p.url()}`).join(', ')}`);
            }
            this.activePage = page;
        }
        await this.activePage.bringToFront();
    }
    async close() {
        try {
            if (this.context) {
                await this.context.close().catch(() => { });
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close().catch(() => { });
                this.browser = null;
            }
        }
        catch {
        }
        this.activePage = null;
    }
    async setOverlayStatus(text) {
        if (!this.activePage)
            return;
        await this.activePage.evaluate((t) => {
            const el = window.__navis_set_status;
            if (el)
                el(t);
        }, text).catch(() => { });
    }
    async highlightElement(rect) {
        if (!this.activePage)
            return;
        await this.activePage.evaluate((r) => {
            const el = window.__navis_highlight;
            if (el)
                el(r);
        }, rect).catch(() => { });
    }
}
exports.BrowserSession = BrowserSession;
