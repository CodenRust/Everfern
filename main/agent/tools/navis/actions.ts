/**
 * Navis — Action Executor
 * 
 * Executes browser actions from AI decisions.
 * Implements all actions defined in NAVIS.md.
 */

import { Page } from 'playwright';
import { CapturedElement } from './element-capture';
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
  elements: CapturedElement[],
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  try {
    switch (actionName) {
      case 'go_to_url':
        return await executeGoToUrl(args as { url: string }, page, logger, step, maxSteps);

      case 'click_element':
        return await executeClickElement(args as { index: number }, page, elements, session, logger, step, maxSteps);

      case 'input_text':
        return await executeInputText(args as { index: number; text: string }, page, elements, session, logger, step, maxSteps);

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
        return await executeSwitchTab(args as { index: number }, session, logger, step, maxSteps);

      case 'close_tab':
        return await executeCloseTab(page, session, logger, step, maxSteps);

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
  args: { index: number },
  page: Page,
  elements: CapturedElement[],
  session: BrowserSession,
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  const el = elements.find((e) => e.index === args.index);
  if (!el) return { success: false, message: `Element index ${args.index} not found`, stateChanged: false };
  if (!el.isInteractive) return { success: false, message: `Element ${args.index} is not interactive`, stateChanged: false };

  await session.highlightElement({ x: el.x, y: el.y, width: el.width, height: el.height });

  const locator = page.locator(el.selector);
  const nth = (el as any).nth || 0;
  await (nth > 0 ? locator.nth(nth) : locator.first()).click({ timeout: 5000 });
  logger?.elementClick(step, maxSteps, el.text, el.selector, { x: el.x, y: el.y });
  await session.setOverlayStatus(`Clicked "${truncate(el.text, 20)}"`);
  return { success: true, message: `Clicked: ${el.text}`, stateChanged: true };
}

async function executeInputText(
  args: { index: number; text: string },
  page: Page,
  elements: CapturedElement[],
  session: BrowserSession,
  logger?: NavisLogger,
  step?: number,
  maxSteps?: number,
): Promise<ActionResult> {
  const el = elements.find((e) => e.index === args.index);
  if (!el) return { success: false, message: `Element index ${args.index} not found`, stateChanged: false };

  await session.highlightElement({ x: el.x, y: el.y, width: el.width, height: el.height });

  const locator = page.locator(el.selector);
  const nth = (el as any).nth || 0;
  const target = nth > 0 ? locator.nth(nth) : locator.first();
  await target.clear({ timeout: 5000 });
  await target.pressSequentially(args.text, { delay: 10 });
  logger?.elementInput(step, maxSteps, el.text, args.text);
  await session.setOverlayStatus(`Typing "${truncate(args.text, 20)}"`);
  return { success: true, message: `Entered text: ${el.text}`, stateChanged: false };
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

async function executeSwitchTab(args: { index: number }, session: BrowserSession, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  const pages = session.allPages;
  if (args.index < 0 || args.index >= pages.length) {
    return { success: false, message: `Tab index ${args.index} out of range`, stateChanged: false };
  }
  await session.switchToTab(args.index);
  logger?.tabChange(step, maxSteps, `switched to tab ${args.index}`);
  return { success: true, message: `Switched to tab ${args.index}`, stateChanged: true };
}

async function executeCloseTab(page: Page, session: BrowserSession, logger?: NavisLogger, step?: number, maxSteps?: number): Promise<ActionResult> {
  if (session.allPages.length <= 1) {
    return { success: false, message: 'Cannot close the last tab', stateChanged: false };
  }
  await session.closeTab(page);
  logger?.tabChange(step, maxSteps, 'tab closed');
  return { success: true, message: 'Tab closed', stateChanged: true };
}

function executeDone(args: { success: boolean; text: string }): ActionResult {
  return { success: args.success, message: args.text, stateChanged: false };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}