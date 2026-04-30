/**
 * Navis — Browser Session Manager
 * 
 * Handles Playwright browser lifecycle: launch, context, page/tab management, cleanup.
 * No chrome extension — pure Playwright automation.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { OVERLAY_SCRIPT } from './overlay';
import { NavisLogger } from './logger';

export interface SessionConfig {
  headless?: boolean;
  startUrl?: string;
  logger?: NavisLogger;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  isActive: boolean;
}

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private logger: NavisLogger | null = null;

  /** Public accessor for BrowserContext — used by action executor */
  getContext(): BrowserContext {
    if (!this.context) throw new Error('Browser not initialized. Call launch() first.');
    return this.context;
  }

  get page(): Page {
    if (!this.activePage) throw new Error('No active page. Call openTab() first.');
    return this.activePage;
  }

  get allPages(): Page[] {
    if (!this.context) throw new Error('Browser not initialized.');
    return this.context.pages();
  }

  async launch(config: SessionConfig = {}): Promise<void> {
    const { headless = false, startUrl, logger } = config;
    this.logger = logger || null;

    try {
      this.browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
    } catch (err) {
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      throw err;
    }

    await this.openTab(startUrl || 'about:blank');
    this.logger?.browserLaunch(`headless=${headless}, 1280x720`);
  }

  async openTab(url?: string): Promise<Page> {
    if (!this.context) throw new Error('Browser not initialized.');
    
    const newPage = await this.context.newPage();
    
    await newPage.addInitScript(OVERLAY_SCRIPT, { runOnReload: true }).catch(() => {});
    
    if (url && url !== 'about:blank') {
      await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    
    this.activePage = newPage;
    return newPage;
  }

  async closeTab(page: Page): Promise<void> {
    if (!this.context) return;
    
    await page.close().catch(() => {});
    
    const remaining = this.context.pages();
    if (remaining.length > 0) {
      this.activePage = remaining[remaining.length - 1];
    }
  }

  async getTabs(): Promise<TabInfo[]> {
    if (!this.context) return [];
    
    const pages = this.context.pages();
    const tabs: TabInfo[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      let title = '';
      try {
        title = await p.title();
      } catch {
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

  async switchToTab(index: number): Promise<void> {
    const pages = this.allPages;
    if (index < 0 || index >= pages.length) {
      throw new Error(`Tab index ${index} out of range. Available tabs: 0-${pages.length - 1}`);
    }
    
    this.activePage = pages[index];
    await this.activePage.bringToFront();
  }

  async close(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
    } catch {
      // Best-effort cleanup
    }
    
    this.activePage = null;
  }

  async setOverlayStatus(text: string): Promise<void> {
    if (!this.activePage) return;
    await this.activePage.evaluate((t) => {
      const el = (window as any).__navis_set_status;
      if (el) el(t);
    }, text).catch(() => {});
  }

  async highlightElement(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
    if (!this.activePage) return;
    await this.activePage.evaluate((r) => {
      const el = (window as any).__navis_highlight;
      if (el) el(r);
    }, rect).catch(() => {});
  }
}