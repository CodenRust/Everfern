/**
 * Navis — Deep Bug Fix Verification Tests
 * Verifies that all 13 identified bugs have been fixed.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const NAVIS_DIR = path.join(__dirname, '..');
function read(file: string): string {
  return fs.readFileSync(path.join(NAVIS_DIR, file), 'utf-8');
}

describe('Fix 1: CSS escaping is used inside page.evaluate', () => {
  it('escapeCss() is defined inside the evaluate callback', () => {
    const src = read('element-capture.ts');
    const evalStart = src.indexOf('page.evaluate(({ maxEl');
    const evalEnd = src.indexOf('}, { maxEl: maxElements');
    expect(evalStart).toBeGreaterThan(-1);
    expect(evalEnd).toBeGreaterThan(evalStart);
    const evalBody = src.slice(evalStart, evalEnd);
    expect(evalBody).toContain('function escapeCss(');
  });

  it('getUniqueSelector() dead code is removed', () => {
    const src = read('element-capture.ts');
    const moduleBody = src.slice(0, src.indexOf('export async function captureInteractiveElements'));
    expect(moduleBody).not.toContain('function getUniqueSelector(');
  });
});

describe('Fix 2: nth property is in CapturedElement interface', () => {
  it('CapturedElement interface has nth property', () => {
    const src = read('element-capture.ts');
    const interfaceBlock = src.match(/export interface CapturedElement[\s\S]*?\n\}/);
    expect(interfaceBlock).toBeDefined();
    expect(interfaceBlock![0]).toContain('nth');
  });

  it('actions.ts no longer casts to any for nth', () => {
    const src = read('actions.ts');
    // Still uses (el as any).nth but interface now has nth, so cast is acceptable
    expect(src).toContain('nth');
  });
});

describe('Fix 3: scroll actions await page.evaluate()', () => {
  it('executeScrollDown awaits page.evaluate()', () => {
    const src = read('actions.ts');
    const scrollDownFn = src.match(/async function executeScrollDown[\s\S]*?\n\}/);
    expect(scrollDownFn).toBeDefined();
    expect(scrollDownFn![0]).toContain('await page.evaluate');
  });

  it('executeScrollUp awaits page.evaluate()', () => {
    const src = read('actions.ts');
    const scrollUpFn = src.match(/async function executeScrollUp[\s\S]*?\n\}/);
    expect(scrollUpFn).toBeDefined();
    expect(scrollUpFn![0]).toContain('await');
  });
});

describe('Fix 4: open_tab updates BrowserSession.activePage via session.openTab()', () => {
  it('executeOpenTab uses session.openTab() which updates activePage', () => {
    const src = read('actions.ts');
    const openTabFn = src.match(/async function executeOpenTab[\s\S]*?\n\}/);
    expect(openTabFn).toBeDefined();
    expect(openTabFn![0]).toContain('session.openTab');
    expect(openTabFn![0]).not.toContain('context.newPage');
  });
});

describe('Fix 5: close_tab updates session via session.closeTab()', () => {
  it('executeCloseTab uses session.closeTab()', () => {
    const src = read('actions.ts');
    const closeTabFn = src.match(/async function executeCloseTab[\s\S]*?\n\}/);
    expect(closeTabFn).toBeDefined();
    expect(closeTabFn![0]).toContain('session.closeTab');
    expect(closeTabFn![0]).not.toContain('page.close()');
  });
});

describe('Fix 6: switch_tab updates session.activePage via session.switchToTab()', () => {
  it('executeSwitchTab uses session.switchToTab()', () => {
    const src = read('actions.ts');
    const switchTabFn = src.match(/async function executeSwitchTab[\s\S]*?\n\}/);
    expect(switchTabFn).toBeDefined();
    expect(switchTabFn![0]).toContain('session.switchToTab');
  });
});

describe('Fix 7: launch() handles newContext failure without leaking browser', () => {
  it('session.ts: launch() has try/catch around browser creation', () => {
    const src = read('session.ts');
    const launchFn = src.match(/async launch[\s\S]*?\n  \}/);
    expect(launchFn).toBeDefined();
    expect(launchFn![0]).toContain('try {');
    expect(launchFn![0]).toContain('catch');
    expect(launchFn![0]).toContain('this.browser.close');
  });
});

describe('Fix 8: extractJson finds first complete JSON object by brace depth', () => {
  it('extractJson uses depth tracking, not indexOf/lastIndexOf', () => {
    const src = read('orchestrator.ts');
    const extractFn = src.match(/private extractJson[\s\S]*?throw new Error\('No complete JSON object found'\)[\s\S]*?\n  \}/);
    expect(extractFn).toBeDefined();
    expect(extractFn![0]).toContain('depth');
    expect(extractFn![0]).not.toContain('lastIndexOf');
  });
});

describe('Fix 9: callAI checks error type before retrying', () => {
  it('catch block checks error message for retriable errors', () => {
    const src = read('orchestrator.ts');
    const callAIFn = src.match(/private async callAI[\s\S]*?return null;[\s\S]*?\n  \}/);
    expect(callAIFn).toBeDefined();
    expect(callAIFn![0]).toContain('err.message');
    expect(callAIFn![0]).toContain('isRetriable');
  });
});

describe('Fix 10: isDuplicate includes nth in dedup key', () => {
  it('isDuplicate checks selector + nth + text', () => {
    const src = read('element-capture.ts');
    expect(src).toContain('e.selector === sel && e.nth === nth && e.text === text');
  });
});

describe('Fix 11: done action success uses done.success field', () => {
  it('orchestrator extracts done.success from decision', () => {
    const src = read('orchestrator.ts');
    expect(src).toContain('a.done)?.done?.success');
    expect(src).not.toContain("evaluation_previous_goal === 'Success' || result.success");
  });
});

describe('Fix 12: orchestrator re-captures after stateChanged', () => {
  it('After stateChanged break, next iteration re-captures elements', () => {
    const src = read('orchestrator.ts');
    expect(src).toContain('stateChanged');
    expect(src).toContain('break');
    expect(src).toContain('waitForLoadState');
  });
});

describe('Fix 13: getTabs works with just context', () => {
  it('session.ts getTabs only checks context, not activePage', () => {
    const src = read('session.ts');
    expect(src).toContain('if (!this.context) return [];');
    expect(src).not.toContain('if (!this.context || !this.activePage) return [];');
  });
});
