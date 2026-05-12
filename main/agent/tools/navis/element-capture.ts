/**
 * Navis — Element Capture Engine
 * 
 * Uses Playwright's built-in ariaSnapshot() for AI-optimized accessibility tree.
 * Every interactive element gets a stable ref (e1, e2, ...) for precise interaction.
 * https://playwright.dev/docs/aria-snapshots
 */

import { Page } from 'playwright';

export interface AriaSnapshotResult {
  raw: string;
  refs: Map<string, { role: string; name: string }>;
}

// ── Fast Snapshot (Alternative Method) ─────────────────────────
export async function captureFastSnapshot(page: Page): Promise<AriaSnapshotResult | null> {
  try {
    const snapshot = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"]');
      let ref = 0;
      let result = '';
      elements.forEach((el: Element) => {
        ref++;
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const name = el.getAttribute('aria-label') || 
                      (el as HTMLElement).innerText?.slice(0, 30) || 
                      el.getAttribute('placeholder') || 
                      '';
        el.setAttribute('data-ref', `e${ref}`);
        result += `- ${role} "${name}" [ref=e${ref}]\n`;
      });
      return result;
    });
    
    if (!snapshot || snapshot.length === 0) return null;
    
    const refs = parseRefs(snapshot);
    return { raw: snapshot, refs };
  } catch {
    return null;
  }
}

export async function captureInteractiveElements(page: Page): Promise<AriaSnapshotResult> {
  // Try fast method first (in-browser DOM query, very fast)
  const fastResult = await captureFastSnapshot(page);
  if (fastResult) return fastResult;

  // Fallback to ariaSnapshot with generous timeout + error handling
  try {
    const raw = await page.ariaSnapshot({ mode: 'ai', timeout: 5000 });
    const refs = parseRefs(raw);
    return { raw, refs };
  } catch {
    console.warn('[Navis] ariaSnapshot fallback failed, returning empty snapshot');
    const raw = `- ${await page.title().catch(() => 'page')} "no interactive elements found" [ref=e1]`;
    return { raw, refs: new Map([['e1', { role: 'heading', name: 'no interactive elements found' }]]) };
  }
}

export function parseRefs(snapshot: string): Map<string, { role: string; name: string }> {
  const refs = new Map<string, { role: string; name: string }>();
  const refRegex = /\[ref=([^\]]+)\]/g;
  const lines = snapshot.split('\n');
  
  for (const line of lines) {
    const match = line.match(refRegex);
    if (!match) continue;
    
    for (const refMatch of match) {
      const ref = refMatch.slice(5, -1);
      const roleMatch = line.match(/^\s*-\s*(\w+)/);
      const nameMatch = line.match(/"([^"]*)"/);
      
      refs.set(ref, {
        role: roleMatch ? roleMatch[1] : 'unknown',
        name: nameMatch ? nameMatch[1] : '',
      });
    }
  }
  
  return refs;
}

export function formatElementsForPrompt(snapshot: string): string {
  return snapshot;
}
