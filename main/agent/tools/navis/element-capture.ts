/**
 * Navis — Element Capture Engine
 * 
 * Captures interactive DOM elements and generates NAVIS.md-formatted snapshot:
 *   [index]<type>text</type>
 * Non-interactive elements: []<type>text</type>
 */

import { Page } from 'playwright';

export interface CapturedElement {
  index: number;
  tag: string;
  role: string;
  text: string;
  selector: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  isInteractive: boolean;
  nth: number;
}

const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="button"]',
  '[role="link"]',
  '[role="textbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="searchbox"]',
  '[role="listbox"]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
];

const NON_INTERACTIVE_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'div', 'li', 'td', 'th',
  'label', 'figcaption',
];

export async function captureInteractiveElements(page: Page, maxElements = 50): Promise<CapturedElement[]> {
  return page.evaluate(({ maxEl, interactiveSels, nonInteractiveSels }) => {
    const elements: any[] = [];
    let index = 0;
    const viewportH = window.innerHeight;

    function escapeCss(str: string): string {
      return str.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }

    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0
        && style.opacity !== '0'
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    }

    function getAccessibleText(el: Element): string {
      return (el as HTMLElement).innerText?.trim()
        || (el as HTMLInputElement).placeholder
        || (el as HTMLInputElement).value
        || el.getAttribute('aria-label')
        || el.getAttribute('title')
        || '';
    }

    function isDuplicate(sel: string, nth: number, text: string): boolean {
      return elements.some((e: any) => e.selector === sel && e.nth === nth && e.text === text);
    }

    const selectorCounts = new Map<string, number>();

    function getSelectorAndCount(el: Element): { selector: string; count: number } {
      const tag = el.tagName.toLowerCase();
      
      if (el.id) {
        const sel = `${tag}#${escapeCss(el.id)}`;
        const count = selectorCounts.get(sel) || 0;
        selectorCounts.set(sel, count + 1);
        return { selector: sel, count };
      }
      
      const classStr = typeof el.className === 'string' ? el.className : '';
      const classes = classStr.split(/\s+/).filter(Boolean).map(escapeCss).join('.');
      const baseSel = classes ? `${tag}.${classes}` : tag;
      
      const count = selectorCounts.get(baseSel) || 0;
      selectorCounts.set(baseSel, count + 1);
      
      let selector: string;
      if (classes) {
        if (count > 0) {
          selector = `${tag}.${classes}:nth-of-type(${count + 1})`;
        } else {
          selector = `${tag}.${classes}`;
        }
      } else {
        const siblings = el.parentElement?.querySelectorAll(tag) || [];
        const siblingIdx = Array.from(siblings).indexOf(el);
        selector = `${tag}:nth-of-type(${siblingIdx + 1})`;
      }
      
      return { selector, count };
    }

    function inViewport(el: Element): boolean {
      const rect = el.getBoundingClientRect();
      return rect.bottom > -200 && rect.top < viewportH + 200;
    }

    // Capture interactive elements — viewport-first for speed
    for (const selector of interactiveSels) {
      document.querySelectorAll(selector).forEach((el: Element) => {
        if (index >= maxEl) return;
        if (!isVisible(el)) return;
        if (!inViewport(el)) return;
        
        const { selector: sel, count } = getSelectorAndCount(el);
        const text = getAccessibleText(el);
        if (isDuplicate(sel, count, text)) return;
        if (!text && el.tagName.toLowerCase() !== 'input') return;

        const rect = el.getBoundingClientRect();
        elements.push({
          index,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          text: text.slice(0, 80),
          selector: sel,
          visible: true,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          isInteractive: true,
          nth: count,
        });
        index++;
      });
    }

    // Capture non-interactive context elements — viewport-first
    for (const selector of nonInteractiveSels) {
      document.querySelectorAll(selector).forEach((el: Element) => {
        if (index >= maxEl) return;
        if (!isVisible(el)) return;
        if (!inViewport(el)) return;

        const { selector: sel } = getSelectorAndCount(el);
        const rect = el.getBoundingClientRect();
        const text = getAccessibleText(el);
        if (!text) return;

        elements.push({
          index,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || '',
          text: text.slice(0, 80),
          selector: sel,
          visible: true,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          isInteractive: false,
          nth: 0,
        });
        index++;
      });
    }

    return elements.slice(0, maxEl);
  }, { maxEl: maxElements, interactiveSels: INTERACTIVE_SELECTORS, nonInteractiveSels: NON_INTERACTIVE_SELECTORS });
}

export function formatElementsForPrompt(elements: CapturedElement[]): string {
  return elements.map((el) => {
    if (el.isInteractive) {
      return `[${el.index}]<${el.tag}>${el.text}</${el.tag}>`;
    }
    return `[]<${el.tag}>${el.text}</${el.tag}>`;
  }).join('\n');
}