"use strict";
/**
 * Navis — Action Executor
 *
 * Executes browser actions from AI decisions.
 * Implements all actions defined in NAVIS.md.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAction = executeAction;
async function executeAction(actionName, args, page, session, logger, step, maxSteps) {
    try {
        switch (actionName) {
            case 'go_to_url':
                return await executeGoToUrl(args, page, logger, step, maxSteps);
            case 'click_element':
                return await executeClickElement(args, page, session, logger, step, maxSteps);
            case 'input_text':
                return await executeInputText(args, page, session, logger, step, maxSteps);
            case 'scroll_down':
                return await executeScrollDown(page, logger, step, maxSteps);
            case 'scroll_up':
                return await executeScrollUp(page, logger, step, maxSteps);
            case 'wait':
                return await executeWait(args, logger, step, maxSteps);
            case 'extract_content':
                return await executeExtractContent(args, page, logger, step, maxSteps);
            case 'open_tab':
                return await executeOpenTab(args, session, logger, step, maxSteps);
            case 'switch_tab':
                return await executeSwitchTab(args, session, logger, step, maxSteps);
            case 'close_tab':
                return await executeCloseTab(page, session, logger, step, maxSteps);
            case 'done':
                return executeDone(args);
            default:
                return { success: false, message: `Unknown action: ${actionName}`, stateChanged: false };
        }
    }
    catch (err) {
        return { success: false, message: `Action ${actionName} failed: ${err.message}`, stateChanged: false };
    }
}
async function executeGoToUrl(args, page, logger, step, maxSteps) {
    if (!args.url)
        return { success: false, message: 'Missing url parameter', stateChanged: false };
    logger?.pageNavigate(step, maxSteps, args.url);
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { success: true, message: `Navigated to ${args.url}`, stateChanged: true };
}
async function executeClickElement(args, page, session, logger, step, maxSteps) {
    if (!args.ref)
        return { success: false, message: 'Missing ref parameter', stateChanged: false };
    const locator = page.locator(`aria-ref=${args.ref}`);
    const name = await locator.getAttribute('aria-label').catch(() => '') || await locator.textContent().catch(() => '') || args.ref;
    const box = await locator.boundingBox().catch(() => null);
    if (box)
        await session.highlightElement(box);
    await locator.click({ timeout: 5000 });
    logger?.elementClick(step, maxSteps, truncate(String(name), 40), `aria-ref=${args.ref}`);
    await session.setOverlayStatus(`Clicked "${truncate(String(name), 20)}"`);
    return { success: true, message: `Clicked: ${name}`, stateChanged: true };
}
async function executeInputText(args, page, session, logger, step, maxSteps) {
    if (!args.ref)
        return { success: false, message: 'Missing ref parameter', stateChanged: false };
    if (!args.text)
        return { success: false, message: 'Missing text parameter', stateChanged: false };
    const locator = page.locator(`aria-ref=${args.ref}`);
    const name = await locator.getAttribute('aria-label').catch(() => '') || await locator.getAttribute('placeholder').catch(() => '') || args.ref;
    const box = await locator.boundingBox().catch(() => null);
    if (box)
        await session.highlightElement(box);
    await locator.clear({ timeout: 5000 });
    await locator.pressSequentially(args.text, { delay: 2 });
    logger?.elementInput(step, maxSteps, truncate(String(name), 30), args.text);
    await session.setOverlayStatus(`Typing "${truncate(args.text, 20)}"`);
    return { success: true, message: `Entered text: ${name}`, stateChanged: false };
}
async function executeScrollDown(page, logger, step, maxSteps) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    logger?.scroll(step, maxSteps, 'down');
    return { success: true, message: 'Scrolled down one page', stateChanged: false };
}
async function executeScrollUp(page, logger, step, maxSteps) {
    await page.evaluate(() => window.scrollBy(0, -window.innerHeight));
    logger?.scroll(step, maxSteps, 'up');
    return { success: true, message: 'Scrolled up one page', stateChanged: false };
}
async function executeWait(args, logger, step, maxSteps) {
    const ms = args.ms ?? 500;
    await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 10000)));
    logger?.wait(step, maxSteps, `${ms}ms`);
    return { success: true, message: `Waited ${ms}ms`, stateChanged: false };
}
async function executeExtractContent(args, page, logger, step, maxSteps) {
    const content = await page.locator('body').innerText().catch(() => '');
    const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n...(truncated)' : content;
    logger?.extract(step, maxSteps, `${truncated.length} chars${args.goal ? ` for: ${args.goal}` : ''}`);
    return { success: true, message: `Extracted ${truncated.length} chars`, stateChanged: false, data: truncated };
}
async function executeOpenTab(args, session, logger, step, maxSteps) {
    const newPage = await session.openTab(args.url);
    await newPage.bringToFront();
    logger?.tabChange(step, maxSteps, args.url ? `opened: ${args.url}` : 'new tab');
    return { success: true, message: `Opened new tab${args.url ? ': ' + args.url : ''}`, stateChanged: true };
}
async function executeSwitchTab(args, session, logger, step, maxSteps) {
    if (args.target) {
        await session.switchToTab(args.target);
        logger?.tabChange(step, maxSteps, `switched to tab matching "${args.target}"`);
        return { success: true, message: `Switched to tab matching "${args.target}"`, stateChanged: true };
    }
    if (args.index !== undefined) {
        await session.switchToTab(args.index);
        logger?.tabChange(step, maxSteps, `switched to tab ${args.index}`);
        return { success: true, message: `Switched to tab ${args.index}`, stateChanged: true };
    }
    return { success: false, message: 'switch_tab requires index or target parameter', stateChanged: false };
}
async function executeCloseTab(page, session, logger, step, maxSteps) {
    if (session.allPages.length <= 1) {
        return { success: false, message: 'Cannot close the last tab', stateChanged: false };
    }
    await session.closeTab(page);
    logger?.tabChange(step, maxSteps, 'tab closed');
    return { success: true, message: 'Tab closed', stateChanged: true };
}
function executeDone(args) {
    return { success: args.success, message: args.text, stateChanged: false };
}
function truncate(s, max) {
    return s.length > max ? s.slice(0, max) + '…' : s;
}
