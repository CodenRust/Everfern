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

export async function captureInteractiveElements(page: Page): Promise<AriaSnapshotResult> {
  const raw = await page.ariaSnapshot({ mode: 'ai', timeout: 5000 });
  const refs = parseRefs(raw);
  return { raw, refs };
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
