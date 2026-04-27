/**
 * Bug Condition Exploration Test — Browser Use DOM Interaction & Research Loop Bugs
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**
 *
 * Property 1: Bug Condition — Browser Use DOM Interaction & Research Loop Bugs
 *
 * CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT attempt to fix the code or the tests when it fails.
 *
 * Expected counterexamples (unfixed code):
 *   - page.evaluate called for click instead of page.locator (Bug 1.1)
 *   - waitForLoadState never called after navigate (Bug 1.2)
 *   - page.evaluate called with .value = assignment for fill (Bug 1.3)
 *   - analyzePageContent and decideNextAction called concurrently via Promise.all (Bug 1.4)
 *   - queued URL navigation fires instead of AI-decided click action (Bug 1.5)
 *   - scroll_to produces no side effects (Bug 1.6)
 *   - select produces no side effects (Bug 1.7)
 *   - ARIA-role element missed by narrow click selector (Bug 1.8)
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
 * All methods are vi.fn() so we can assert on calls.
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
  // Make filter/first chainable back to the same locator object
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

/**
 * Build a minimal ChromeExtensionAPI-like stub (no extension elements).
 */
function makeExtensionAPI() {
  return {
    setPage: vi.fn(),
    activate: vi.fn().mockResolvedValue({ success: true }),
    applyShimmer: vi.fn().mockResolvedValue({ success: true }),
    captureElements: vi.fn().mockResolvedValue([]),
  };
}

// ─── Import the module under test ────────────────────────────────────────────
// We import after mocks are set up so vi.mock hoisting applies.
// We use dynamic import inside each test to get fresh module state where needed.

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration — Browser Use Navigation & Research Loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1 — Click bypass (Bug 1.1 / isBugCondition_ClickBypass)
  //
  // On UNFIXED code: page.evaluate is called with a raw .click() pattern.
  // On FIXED code:   page.locator().filter().first().click() is called instead.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 1 — Click bypass: executeAction click uses page.locator, NOT page.evaluate with raw .click()', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'click', target: 'Submit' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    // Bug condition: page.evaluate was called with a raw .click() pattern
    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    const rawClickCalls = evaluateCalls.filter((args: any[]) => {
      const fn = args[0];
      if (typeof fn === 'function') {
        const src = fn.toString();
        return src.includes('.click()');
      }
      return false;
    });

    // isBugCondition_ClickBypass = true when page.evaluate is called with .click()
    const isBugCondition_ClickBypass = rawClickCalls.length > 0;

    // FIXED behavior: page.locator should be called, NOT page.evaluate with .click()
    expect(isBugCondition_ClickBypass).toBe(false); // FAILS on unfixed code
    expect(page.locator).toHaveBeenCalled();         // FAILS on unfixed code
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2 — No nav wait (Bug 1.2 / isBugCondition_NoNavWait)
  //
  // On UNFIXED code: page.goto is called but waitForLoadState is NOT called.
  // On FIXED code:   waitForLoadState('domcontentloaded') is called after goto.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 2 — No nav wait: executeAction navigate calls waitForLoadState after page.goto', async () => {
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

    // Bug condition: waitForLoadState is NOT called after navigate
    const isBugCondition_NoNavWait = (page.waitForLoadState as ReturnType<typeof vi.fn>).mock.calls.length === 0;

    // FIXED behavior: waitForLoadState must be called
    expect(isBugCondition_NoNavWait).toBe(false); // FAILS on unfixed code
    expect(page.waitForLoadState).toHaveBeenCalledWith('domcontentloaded', expect.any(Object));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3 — Fill direct value (Bug 1.3 / isBugCondition_FillFramework)
  //
  // On UNFIXED code: page.evaluate is called with a .value = assignment.
  // On FIXED code:   page.locator().fill() is called instead.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 3 — Fill direct value: executeAction fill uses locator.fill(), NOT page.evaluate with .value =', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'fill', label: 'search', text: 'hello world' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    // Bug condition: page.evaluate was called with a .value = assignment
    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    const directValueCalls = evaluateCalls.filter((args: any[]) => {
      const fn = args[0];
      if (typeof fn === 'function') {
        const src = fn.toString();
        return src.includes('.value =') || src.includes('.value=');
      }
      return false;
    });

    const isBugCondition_FillFramework = directValueCalls.length > 0;

    // FIXED behavior: locator.fill() should be used, NOT page.evaluate with .value
    expect(isBugCondition_FillFramework).toBe(false); // FAILS on unfixed code
    expect(page.locator).toHaveBeenCalled();           // FAILS on unfixed code
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4 — Parallel race (Bug 1.4 / isBugCondition_ParallelRace)
  //
  // On UNFIXED code: analyzePageContent and decideNextAction are called
  //   concurrently via Promise.all — both start before either completes.
  // On FIXED code:   analyzePageContent is awaited first, then decideNextAction
  //   is called with the analysis result.
  //
  // Strategy: inspect the source code of performSmartResearch to detect
  // whether Promise.all is used (bug) or sequential awaits are used (fix).
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 4 — Parallel race: performSmartResearch uses sequential awaits, NOT Promise.all for analysis+decision', async () => {
    const mod = await import('../browser-use') as any;

    // Get the source of performSmartResearch to check for Promise.all pattern
    const fnSrc: string = mod.performSmartResearch.toString();

    // Bug condition: Promise.all([analyzePageContent, decideNextAction]) in source
    const isBugCondition_ParallelRace =
      fnSrc.includes('Promise.all') &&
      fnSrc.includes('analyzePageContent') &&
      fnSrc.includes('decideNextAction');

    // FIXED behavior: sequential awaits — no Promise.all wrapping both calls
    expect(isBugCondition_ParallelRace).toBe(false); // FAILS on unfixed code
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5 — Queue override (Bug 1.5 / isBugCondition_QueueOverride)
  //
  // On UNFIXED code: when a URL is queued and AI decides 'click', the queue
  //   URL navigation fires instead of the click.
  // On FIXED code:   click action is executed; queue only overrides navigate/
  //   goto_link/extract.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 5 — Queue override: AI-decided click is NOT overridden by a queued URL', async () => {
    const QUEUED_URL = 'https://queued.example.com/page';

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
        // AI decides to click
        return {
          content: JSON.stringify({ action: 'click', target: 'Pricing', thought: 'click pricing' }),
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

    // Queue has one URL; AI decides 'click'
    let dequeueCallCount = 0;
    const sharedMemory = {
      addFact: vi.fn(),
      markVisited: vi.fn(),
      hasVisited: vi.fn().mockReturnValue(false),
      queueUrl: vi.fn(),
      dequeueUrl: vi.fn().mockImplementation(() => {
        // Return the queued URL on first call, then undefined
        if (dequeueCallCount === 0) {
          dequeueCallCount++;
          return QUEUED_URL;
        }
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
      { task: 'test queue override' },
      'Tab1',
      mockAIClient,
      2,
      vi.fn(),
      'session-1',
      mockBridgeServer,
      sharedMemory
    ).catch(() => {});

    // Bug condition: page.goto was called with the queued URL (override happened)
    const gotoCalls = (page.goto as ReturnType<typeof vi.fn>).mock.calls;
    const queuedNavFired = gotoCalls.some((args: any[]) => args[0] === QUEUED_URL);

    const isBugCondition_QueueOverride = queuedNavFired;

    // FIXED behavior: click should execute, NOT the queued URL navigation
    expect(isBugCondition_QueueOverride).toBe(false); // FAILS on unfixed code
  }, 15000);

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6 — scroll_to no-op (Bug 1.6 / isBugCondition_UnimplementedAction)
  //
  // On UNFIXED code: no Playwright method is called for scroll_to.
  // On FIXED code:   page.locator(target).scrollIntoViewIfNeeded() is called.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 6 — scroll_to no-op: executeAction scroll_to calls scrollIntoViewIfNeeded', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'scroll_to', target: '#pricing-table' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    // Bug condition: no Playwright method was called (silent no-op)
    const locatorCalled = (page.locator as ReturnType<typeof vi.fn>).mock.calls.length > 0;
    const locatorInstance = page.locator('#pricing-table');
    const scrollCalled = (locatorInstance.scrollIntoViewIfNeeded as ReturnType<typeof vi.fn>).mock.calls.length > 0;

    const isBugCondition_UnimplementedAction_scrollTo = !locatorCalled && !scrollCalled;

    // FIXED behavior: scrollIntoViewIfNeeded must be called
    expect(isBugCondition_UnimplementedAction_scrollTo).toBe(false); // FAILS on unfixed code
    expect(page.locator).toHaveBeenCalled();                          // FAILS on unfixed code
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7 — select no-op (Bug 1.7 / isBugCondition_UnimplementedAction)
  //
  // On UNFIXED code: no Playwright method is called for select.
  // On FIXED code:   page.locator(target).selectOption() is called.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 7 — select no-op: executeAction select calls selectOption', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'select', target: '#country-select', text: 'United States' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    // Bug condition: no Playwright method was called (silent no-op)
    const locatorCalled = (page.locator as ReturnType<typeof vi.fn>).mock.calls.length > 0;
    const locatorInstance = page.locator('#country-select');
    const selectCalled = (locatorInstance.selectOption as ReturnType<typeof vi.fn>).mock.calls.length > 0;

    const isBugCondition_UnimplementedAction_select = !locatorCalled && !selectCalled;

    // FIXED behavior: selectOption must be called
    expect(isBugCondition_UnimplementedAction_select).toBe(false); // FAILS on unfixed code
    expect(page.locator).toHaveBeenCalled();                        // FAILS on unfixed code
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 8 — Narrow click search (Bug 1.8 / isBugCondition_NarrowClickSearch)
  //
  // On UNFIXED code: the click selector is 'a,button,input,span' — it misses
  //   elements with role="button" (e.g. <div role="button">Add to cart</div>).
  // On FIXED code:   the selector includes [role="button"], [role="link"], etc.
  // ───────────────────────────────────────────────────────────────────────────
  it('Test 8 — Narrow click search: executeAction click uses selector that includes ARIA role elements', async () => {
    const { executeAction } = await import('../browser-use') as any;

    const page = makeMockPage();
    const extensionAPI = makeExtensionAPI();

    await executeAction({
      page,
      action: { action: 'click', target: 'Add to cart' },
      onProgress: vi.fn(),
      extensionElements: [],
      extensionAPI,
      taskId: 'test',
    });

    // Bug condition: page.evaluate is called with a querySelector that only
    // searches 'a,button,input,span' — missing ARIA role elements.
    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    const narrowSelectorCalls = evaluateCalls.filter((args: any[]) => {
      const fn = args[0];
      if (typeof fn === 'function') {
        const src = fn.toString();
        // The buggy selector: 'a,button,input,span' without role attributes
        return src.includes("'a,button,input,span'") ||
               src.includes('"a,button,input,span"') ||
               (src.includes('querySelectorAll') && !src.includes('role'));
      }
      return false;
    });

    const isBugCondition_NarrowClickSearch = narrowSelectorCalls.length > 0;

    // FIXED behavior: locator should be used with ARIA role selectors
    expect(isBugCondition_NarrowClickSearch).toBe(false); // FAILS on unfixed code

    // Verify the locator call includes ARIA role selectors
    const locatorCalls = (page.locator as ReturnType<typeof vi.fn>).mock.calls;
    const hasAriaRoleSelector = locatorCalls.some((args: any[]) => {
      const selector = args[0] as string;
      return selector.includes('role=') || selector.includes('[role=');
    });
    expect(hasAriaRoleSelector).toBe(true); // FAILS on unfixed code
  });
});
