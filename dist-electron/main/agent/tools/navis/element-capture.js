"use strict";
/**
 * Navis — Element Capture Engine
 *
 * Uses Playwright's built-in ariaSnapshot() for AI-optimized accessibility tree.
 * Every interactive element gets a stable ref (e1, e2, ...) for precise interaction.
 * https://playwright.dev/docs/aria-snapshots
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureFastSnapshot = captureFastSnapshot;
exports.captureInteractiveElements = captureInteractiveElements;
exports.parseRefs = parseRefs;
exports.formatElementsForPrompt = formatElementsForPrompt;
// ── Fast Snapshot (Alternative Method) ─────────────────────────
async function captureFastSnapshot(page) {
    try {
        const snapshot = await page.evaluate(() => {
            const elements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"]');
            let ref = 0;
            let result = '';
            elements.forEach((el) => {
                ref++;
                const role = el.getAttribute('role') || el.tagName.toLowerCase();
                const name = el.getAttribute('aria-label') ||
                    el.innerText?.slice(0, 30) ||
                    el.getAttribute('placeholder') ||
                    '';
                el.setAttribute('data-ref', `e${ref}`);
                result += `- ${role} "${name}" [ref=e${ref}]\n`;
            });
            return result;
        });
        if (!snapshot || snapshot.length === 0)
            return null;
        const refs = parseRefs(snapshot);
        return { raw: snapshot, refs };
    }
    catch {
        return null;
    }
}
async function captureInteractiveElements(page) {
    // Try fast method first
    const fastResult = await captureFastSnapshot(page);
    if (fastResult)
        return fastResult;
    // Fallback to ariaSnapshot
    const raw = await page.ariaSnapshot({ mode: 'ai', timeout: 1000 });
    const refs = parseRefs(raw);
    return { raw, refs };
}
function parseRefs(snapshot) {
    const refs = new Map();
    const refRegex = /\[ref=([^\]]+)\]/g;
    const lines = snapshot.split('\n');
    for (const line of lines) {
        const match = line.match(refRegex);
        if (!match)
            continue;
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
function formatElementsForPrompt(snapshot) {
    return snapshot;
}
