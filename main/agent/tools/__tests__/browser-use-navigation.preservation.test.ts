/**
 * Preservation Property Tests — Browser Use DOM Interaction & Research Loop
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 *
 * Property 2: Preservation — Non-Buggy Browser Actions Unchanged
 *
 * These tests document the BASELINE behavior of non-buggy actions.
 * They MUST PASS on unfixed code — they confirm what must be preserved after the fix.
 *
 * Preserved behaviors:
 *   - navigate: page.goto called with correct URL and options (Req 3.1)
 *   - type: page.keyboard.type then page.keyboard.press('Enter') (Req 3.2)
 *   - scroll: page.mouse.wheel with correct pixel values (Req 3.3)
 *   - back: page.goBack() called (Req 3.4)
 *   - forward: page.goForward() called (Req 3.4)
 *   - wait: page.waitForTimeout with correct ms (Req 3.5)
 *   - empty queue: AI-decided action executes without modification (Req 3.7)
 *   - queue override for navigate/goto_link: queued URL is used (Req 3.8 / intended behavior)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks required for browser-use.ts to load ───────────────────────

vi.mock('../../lib/extension-server', () => ({
  bridgeServer: {
    setSession: vi.fn(),
    broadcastCommand: vi.fn(),
  },
}));

vi.mock('../../store/tool-settings', () => ({
  toolSettingsStore: {
    get: vi.fn().mockReturnValue({}),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock Playwright page object.
 * Same pattern as browser-use-navigation.bug.test.ts for consistency.
 */
function makeMockPage(overrides: Record<string, any> = {}) {
  const locatorObj = {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    filter: vi.fn(),
    first: vi.fn(),
  };
  locatorObj.filter.mockReturnValue(locatorObj);
  locatorObj.first.mockReturnValue(locatorObj);

  return {
    goto: vi.fn().mockResolvedValue(undefined),
    goBack: vi.fn().mockResolvedValue(undefined),
    goForward: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue(locatorObj),
    keyboard: {
      type: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      wheel: vi.fn().mockResolvedValue(undefined),
    },
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake')),
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Example'),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeExtensionAPI() {
  return {
    setPage: vi.fn(),
    activate: vi.fn().mockResolvedValue({ success: true }),
    applyShimmer: vi.fn().mockResolvedValue({ success: true }),
    captureElements: vi.fn().mockResolvedValue([]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation — Non-Buggy Browser Actions Unchanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1 — navigate preservation (Req 3.1)
  //
  // executeAction with action='navigate' calls page.goto with the correct URL.
  // ───────────────────────────────────────────────────────────────────────────
  it('navigate preservation: page.goto is called with the correct URL', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'navigate', url: 'https://example.com/pricing' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    // page.goto must be called with the correct URL
    expect(page.goto).toHaveBeenCalled();
    const gotoArgs = (page.goto as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(gotoArgs[0]).toBe('https://example.com/pricing');
    // Options should include a timeout
    expect(gotoArgs[1]).toMatchObject({ timeout: expect.any(Number) });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2 — type preservation (Req 3.2)
  //
  // executeAction with action='type' calls page.keyboard.type then
  // page.keyboard.press('Enter').
  // ───────────────────────────────────────────────────────────────────────────
  it('type preservation: page.keyboard.type is called then page.keyboard.press(Enter)', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'type', text: 'hello world' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    expect(page.keyboard.type).toHaveBeenCalledWith('hello world', expect.any(Object));
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');

    // Verify order: type before press
    const typeOrder = (page.keyboard.type as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const pressOrder = (page.keyboard.press as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(typeOrder).toBeLessThan(pressOrder);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3 — scroll preservation (Req 3.3)
  //
  // executeAction with action='scroll' calls page.mouse.wheel with correct
  // pixel values (positive for down, negative for up).
  // ───────────────────────────────────────────────────────────────────────────
  it('scroll preservation: page.mouse.wheel is called with correct pixel values', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    // Scroll down
    await executeAction({
      page,
      action: { action: 'scroll', direction: 'down', pixels: 600 },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    expect(page.mouse.wheel).toHaveBeenCalledWith(0, expect.any(Number));
    const wheelArgs = (page.mouse.wheel as ReturnType<typeof vi.fn>).mock.calls[0];
    // Scrolling down should produce a positive Y delta
    expect(wheelArgs[1]).toBeGreaterThan(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4 — back preservation (Req 3.4)
  //
  // executeAction with action='back' calls page.goBack().
  // ───────────────────────────────────────────────────────────────────────────
  it('back preservation: page.goBack() is called', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'back' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    expect(page.goBack).toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5 — forward preservation (Req 3.4)
  //
  // executeAction with action='forward' calls page.goForward().
  // ───────────────────────────────────────────────────────────────────────────
  it('forward preservation: page.goForward() is called', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'forward' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    expect(page.goForward).toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6 — wait preservation (Req 3.5)
  //
  // executeAction with action='wait' calls page.waitForTimeout with the
  // correct ms value.
  // ───────────────────────────────────────────────────────────────────────────
  it('wait preservation: page.waitForTimeout is called with correct ms', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'wait', ms: 3000 },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    expect(page.waitForTimeout).toHaveBeenCalledWith(3000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7 — Empty queue preservation (Req 3.7)
  //
  // When the URL queue is empty, the AI-decided action executes without
  // modification (no queue override fires).
  // ───────────────────────────────────────────────────────────────────────────
  it('empty queue preservation: AI-decided action executes when queue is empty', async () => {
    const mockAIClient = {
      chat: vi.fn().mockImplementation(async (opts: any) => {
        const text = JSON.stringify(opts.messages);
        if (text.includes('research analyst')) {
          return {
            content: JSON.stringify({
              isUseful: false, shouldExtract: false, keyFacts: [],
              pricingFound: [], ratingsFound: [], nextUrls: [],
              summary: '', confidence: 0,
            }),
          };
        }
        // AI decides to go back
        return {
          content: JSON.stringify({ action: 'back', thought: 'going back' }),
        };
      }),
    };

    const page = makeMockPage({
      evaluate: vi.fn().mockResolvedValue({
        title: 'Test', url: 'https://example.com', metaDescription: '',
        headings: [], paragraphs: [], tables: [], links: [], rawText: '',
        domTree: '', prices: [], ratings: [], structuredData: '',
      }),
    });

    const mockCtx = {
      newPage: vi.fn().mockResolvedValue(page),
      serviceWorkers: vi.fn().mockReturnValue([]),
    };

    const mockBridgeServer = {
      setSession: vi.fn(),
      broadcastCommand: vi.fn(),
    };

    // Queue is always empty
    const sharedMemory = {
      addFact: vi.fn(),
      markVisited: vi.fn(),
      hasVisited: vi.fn().mockReturnValue(false),
      queueUrl: vi.fn(),
      dequeueUrl: vi.fn().mockReturnValue(undefined), // empty queue
      getSummary: vi.fn().mockReturnValue(''),
      getFactCount: vi.fn().mockReturnValue(0),
      getVisitedCount: vi.fn().mockReturnValue(0),
      getQueueSize: vi.fn().mockReturnValue(0),
    };

    const { performSmartResearch } = await import('../browser-use') as any;

    await performSmartResearch(
      mockCtx,
      { task: 'test empty queue' },
      'Tab1',
      mockAIClient,
      2,
      vi.fn(),
      'session-1',
      mockBridgeServer,
      sharedMemory
    ).catch(() => {});

    // AI decided 'back' — page.goBack should have been called (action executed)
    expect(page.goBack).toHaveBeenCalled();
    // No queued URL navigation should have fired (queue was empty)
    const gotoCalls = (page.goto as ReturnType<typeof vi.fn>).mock.calls;
    // Only the initial goto (to start_url or duckduckgo) should be present, not a queued URL
    const queuedNavFired = gotoCalls.some((args: any[]) => args[0] === undefined);
    expect(queuedNavFired).toBe(false);
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test 8 — Queue override for navigate/goto_link (Req 3.8 / intended behavior)
  //
  // When AI decides 'navigate' or 'goto_link' and the queue has a URL,
  // the queued URL is used (this is the INTENDED behavior to preserve).
  // ───────────────────────────────────────────────────────────────────────────
  it('queue override for navigate: queued URL is used when AI decides navigate', async () => {
    const QUEUED_URL = 'https://queued.example.com/pricing';

    const mockAIClient = {
      chat: vi.fn().mockImplementation(async (opts: any) => {
        const text = JSON.stringify(opts.messages);
        if (text.includes('research analyst')) {
          return {
            content: JSON.stringify({
              isUseful: false, shouldExtract: false, keyFacts: [],
              pricingFound: [], ratingsFound: [], nextUrls: [],
              summary: '', confidence: 0,
            }),
          };
        }
        // AI decides to navigate (to a different URL)
        return {
          content: JSON.stringify({ action: 'navigate', url: 'https://ai-decided.example.com', thought: 'navigating' }),
        };
      }),
    };

    const page = makeMockPage({
      evaluate: vi.fn().mockResolvedValue({
        title: 'Test', url: 'https://example.com', metaDescription: '',
        headings: [], paragraphs: [], tables: [], links: [], rawText: '',
        domTree: '', prices: [], ratings: [], structuredData: '',
      }),
    });

    const mockCtx = {
      newPage: vi.fn().mockResolvedValue(page),
      serviceWorkers: vi.fn().mockReturnValue([]),
    };

    const mockBridgeServer = {
      setSession: vi.fn(),
      broadcastCommand: vi.fn(),
    };

    let dequeueCount = 0;
    const sharedMemory = {
      addFact: vi.fn(),
      markVisited: vi.fn(),
      hasVisited: vi.fn().mockReturnValue(false),
      queueUrl: vi.fn(),
      dequeueUrl: vi.fn().mockImplementation(() => {
        if (dequeueCount === 0) { dequeueCount++; return QUEUED_URL; }
        return undefined;
      }),
      getSummary: vi.fn().mockReturnValue(''),
      getFactCount: vi.fn().mockReturnValue(0),
      getVisitedCount: vi.fn().mockReturnValue(0),
      getQueueSize: vi.fn().mockReturnValue(1),
    };

    const { performSmartResearch } = await import('../browser-use') as any;

    await performSmartResearch(
      mockCtx,
      { task: 'test queue override for navigate' },
      'Tab1',
      mockAIClient,
      2,
      vi.fn(),
      'session-1',
      mockBridgeServer,
      sharedMemory
    ).catch(() => {});

    // The queued URL should have been navigated to (intended override behavior)
    const gotoCalls = (page.goto as ReturnType<typeof vi.fn>).mock.calls;
    const queuedNavFired = gotoCalls.some((args: any[]) => args[0] === QUEUED_URL);
    expect(queuedNavFired).toBe(true);
  }, 15000);
});
