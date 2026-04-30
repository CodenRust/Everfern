/**
 * Navis — Action Executor
 * 
 * Executes browser actions from AI decisions.
 * Implements all actions defined in NAVIS.md.
 */

import { Page } from 'playwright';
import { BrowserSession } from './session';
import { NavisLogger } from './logger';

export type ActionName =
  | 'go_to_url'
  | 'click_element'
  | 'input_text'
  | 'scroll_down'
  | 'scroll_up'
  | 'wait'
  | 'extract_content'
  | 'open_tab'
  | 'switch_tab'
  | 'close_tab'
  | 'solve_captcha'
  | 'done';

export interface ActionResult {
  success: boolean;
  message: string;
  stateChanged: boolean;
  data?: unknown;
}

export async function executeAction(
  actionName: ActionName,
  args: Record<string, unknown>,
  page: Page,
  session: BrowserSession,
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  try {
    switch (actionName) {
      case 'go_to_url':
        return await executeGoToUrl(args as { url: string }, page, logger, step, maxSteps);

      case 'click_element':
        return await executeClickElement(args as { ref: string }, page, session, logger, step, maxSteps);

      case 'input_text':
        return await executeInputText(args as { ref: string; text: string }, page, session, logger, step, maxSteps);

      case 'scroll_down':
        return await executeScrollDown(page, logger, step, maxSteps);

      case 'scroll_up':
        return await executeScrollUp(page, logger, step, maxSteps);

      case 'wait':
        return await executeWait(args as { ms?: number }, logger, step, maxSteps);

      case 'extract_content':
        return await executeExtractContent(args as { goal?: string }, page, logger, step, maxSteps);

      case 'open_tab':
        return await executeOpenTab(args as { url?: string }, session, logger, step, maxSteps);

      case 'switch_tab':
        return await executeSwitchTab(args as { index?: number; target?: string }, session, logger, step, maxSteps);

      case 'close_tab':
        return await executeCloseTab(page, session, logger, step, maxSteps);

      case 'solve_captcha':
        return await executeSolveCaptcha(page, session, logger, step, maxSteps);

      case 'done':
        return executeDone(args as { success: boolean; text: string });

      default:
        return { success: false, message: `Unknown action: ${actionName}`, stateChanged: false };
    }
  } catch (err: any) {
    return { success: false, message: `Action ${actionName} failed: ${err.message}`, stateChanged: false };
  }
}

async function executeGoToUrl(args: { url: string }, page: Page, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  if (!args.url) return { success: false, message: 'Missing url parameter', stateChanged: false };
  
  logger?.pageNavigate(step, maxSteps, args.url);
  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  return { success: true, message: `Navigated to ${args.url}`, stateChanged: true };
}

async function executeClickElement(
  args: { ref: string },
  page: Page,
  session: BrowserSession,
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  if (!args.ref) return { success: false, message: 'Missing ref parameter', stateChanged: false };

  const locator = page.locator(`aria-ref=${args.ref}`);
  const name = await locator.getAttribute('aria-label').catch(() => '') || await locator.textContent().catch(() => '') || args.ref;
  const box = await locator.boundingBox().catch(() => null);
  if (box) await session.highlightElement(box);
  await locator.click({ timeout: 5000 });
  logger?.elementClick(step, maxSteps, truncate(String(name), 40), `aria-ref=${args.ref}`);
  await session.setOverlayStatus(`Clicked "${truncate(String(name), 20)}"`);
  return { success: true, message: `Clicked: ${name}`, stateChanged: true };
}

async function executeInputText(
  args: { ref: string; text: string },
  page: Page,
  session: BrowserSession,
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  if (!args.ref) return { success: false, message: 'Missing ref parameter', stateChanged: false };
  if (!args.text) return { success: false, message: 'Missing text parameter', stateChanged: false };

  const locator = page.locator(`aria-ref=${args.ref}`);
  const name = await locator.getAttribute('aria-label').catch(() => '') || await locator.getAttribute('placeholder').catch(() => '') || args.ref;
  const box = await locator.boundingBox().catch(() => null);
  if (box) await session.highlightElement(box);
  await locator.clear({ timeout: 5000 });
  await locator.pressSequentially(args.text, { delay: 2 });
  logger?.elementInput(step, maxSteps, truncate(String(name), 30), args.text);
  await session.setOverlayStatus(`Typing "${truncate(args.text, 20)}"`);
  return { success: true, message: `Entered text: ${name}`, stateChanged: false };
}

async function executeScrollDown(page: Page, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  logger?.scroll(step, maxSteps, 'down');
  return { success: true, message: 'Scrolled down one page', stateChanged: false };
}

async function executeScrollUp(page: Page, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  await page.evaluate(() => window.scrollBy(0, -window.innerHeight));
  logger?.scroll(step, maxSteps, 'up');
  return { success: true, message: 'Scrolled up one page', stateChanged: false };
}

async function executeWait(args: { ms?: number }, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  const ms = args.ms ?? 500;
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 10000)));
  logger?.wait(step, maxSteps, `${ms}ms`);
  return { success: true, message: `Waited ${ms}ms`, stateChanged: false };
}

async function executeExtractContent(args: { goal?: string }, page: Page, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  const content = await page.locator('body').innerText().catch(() => '');
  const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n...(truncated)' : content;
  logger?.extract(step, maxSteps, `${truncated.length} chars${args.goal ? ` for: ${args.goal}` : ''}`);
  return { success: true, message: `Extracted ${truncated.length} chars`, stateChanged: false, data: truncated };
}

async function executeOpenTab(
  args: { url?: string },
  session: BrowserSession,
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  const newPage = await session.openTab(args.url);
  await newPage.bringToFront();
  logger?.tabChange(step, maxSteps, args.url ? `opened: ${args.url}` : 'new tab');
  return { success: true, message: `Opened new tab${args.url ? ': ' + args.url : ''}`, stateChanged: true };
}

async function executeSwitchTab(args: { index?: number; target?: string }, session: BrowserSession, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
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

async function executeCloseTab(page: Page, session: BrowserSession, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  if (session.allPages.length <= 1) {
    return { success: false, message: 'Cannot close the last tab', stateChanged: false };
  }
  await session.closeTab(page);
  logger?.tabChange(step, maxSteps, 'tab closed');
  return { success: true, message: 'Tab closed', stateChanged: true };
}

async function executeSolveCaptcha(page: Page, session: BrowserSession, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  logger?.tabChange(step, maxSteps, 'solving captcha...');
  await session.setOverlayStatus('Solving captcha...');

  const solved = await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const bodyText = document.body?.innerText?.toLowerCase() || '';

    if (title.includes('hcaptcha') || bodyText.includes('hcaptcha')) {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (checkbox) {
        checkbox.click();
        return true;
      }
      const label = document.querySelector('label[for]');
      if (label) {
        (label as HTMLElement).click();
        return true;
      }
    }

    if (title.includes('cloudflare') || bodyText.includes('cloudflare') || bodyText.includes('verifying')) {
      const checkbox = document.querySelector('#challenge-stage input[type="checkbox"]') as HTMLInputElement | null;
      if (checkbox) {
        checkbox.click();
        return true;
      }
      const cfBtn = document.querySelector('.cf-solve input, .cf-button, .turnstile-input') as HTMLElement | null;
      if (cfBtn) {
        cfBtn.click();
        return true;
      }
    }

    if (bodyText.includes('confirm you') || bodyText.includes('verify you') || bodyText.includes('security check')) {
      const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
      for (const btn of Array.from(buttons)) {
        const el = btn as HTMLElement;
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('confirm') || text.includes('verify') || text.includes('continue') || text.includes('proceed')) {
          el.click();
          return true;
        }
      }
      const links = document.querySelectorAll('a');
      for (const link of Array.from(links)) {
        const el = link as HTMLElement;
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('confirm') || text.includes('verify') || text.includes('continue')) {
          el.click();
          return true;
        }
      }
    }

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of Array.from(checkboxes)) {
      const el = cb as HTMLInputElement;
      if (!el.checked) {
        el.click();
        return true;
      }
    }

    return false;
  });

  if (solved) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger?.tabChange(step, maxSteps, 'captcha solved, waiting for redirect...');
    return { success: true, message: 'Captcha solved, waiting for page to proceed', stateChanged: true };
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  const stillCaptcha = await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const body = document.body?.innerText?.toLowerCase() || '';
    return title.includes('captcha') || body.includes('captcha') || body.includes('verify') || body.includes('human');
  });

  if (stillCaptcha) {
    return { success: false, message: 'Captcha still present, attempting alternate approach', stateChanged: false };
  }

  return { success: true, message: 'Page no longer shows captcha challenge', stateChanged: true };
}

function executeDone(args: { success: boolean; text: string }): ActionResult {
  return { success: args.success, message: args.text, stateChanged: false };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}