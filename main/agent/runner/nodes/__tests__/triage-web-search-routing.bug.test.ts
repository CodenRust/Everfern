/**
 * Bug Condition Exploration Test — Web Search Routing Misclassification
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition — Web Search Requests Misclassified by classifyIntentFallback
 *
 * CRITICAL: These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the code or the tests when they fail.
 *
 * Bug: The classifyIntentFallback function in triage.ts has no pattern matching for
 * search/research keywords, causing it to fall through to the generic `task` intent.
 * Inputs like "search for X", "find me X", "look up X", and "crawl this page" are
 * classified as `task` (or `automate` for crawl) instead of `research`.
 *
 * Root cause: Missing research keyword pattern detection in classifyIntentFallback
 * before the default `{ intent: 'task' }` return.
 *
 * Expected counterexamples (unfixed code):
 *   classifyIntentFallback("search for the best news Discord bot", [])
 *     → returns { intent: 'task', confidence: 0.5 } instead of { intent: 'research', ... }
 *   classifyIntentFallback("find me the top React libraries", [])
 *     → returns { intent: 'task', confidence: 0.5 } instead of { intent: 'research', ... }
 *   classifyIntentFallback("look up the latest news about AI", [])
 *     → returns { intent: 'task', confidence: 0.5 } instead of { intent: 'research', ... }
 *   classifyIntentFallback("crawl this page and extract the pricing table", [])
 *     → returns { intent: 'task', confidence: 0.5 } or { intent: 'automate', ... }
 *       instead of { intent: 'research', ... }
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyIntentFallback } from '../../triage';

// Keywords that indicate web search / research intent
const WEB_SEARCH_KEYWORDS = [
  'search for',
  'find me',
  'look up',
  'look for',
  'what is the best',
  'find the best',
  'research',
  'google',
  'browse for',
  'crawl',
  'scrape',
  'fetch url',
  'find information',
  'find news',
  'find articles',
  'find documentation',
];

function containsWebSearchLanguage(input: string): boolean {
  const lower = input.toLowerCase();
  return WEB_SEARCH_KEYWORDS.some(kw => lower.includes(kw));
}

describe('Bug Condition Exploration — Web Search Routing Misclassification', () => {
  /**
   * Test Case 1: Discord Bot Search
   *
   * Input: "search for the best news Discord bot"
   * Expected (after fix): { intent: 'research', confidence >= 0.7 }
   * On UNFIXED code: { intent: 'task', confidence: 0.5 }
   *
   * Counterexample: classifyIntentFallback returns intent !== 'research'
   */
  it('should classify "search for the best news Discord bot" as research', () => {
    const result = classifyIntentFallback('search for the best news Discord bot', []);
    expect(result.intent).toBe('research');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 2: React Libraries Search
   *
   * Input: "find me the top React libraries"
   * Expected (after fix): { intent: 'research', confidence >= 0.7 }
   * On UNFIXED code: { intent: 'task', confidence: 0.5 }
   *
   * Counterexample: classifyIntentFallback returns intent !== 'research'
   */
  it('should classify "find me the top React libraries" as research', () => {
    const result = classifyIntentFallback('find me the top React libraries', []);
    expect(result.intent).toBe('research');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 3: News Lookup
   *
   * Input: "look up the latest news about AI"
   * Expected (after fix): { intent: 'research', confidence >= 0.7 }
   * On UNFIXED code: { intent: 'task', confidence: 0.5 }
   *
   * Counterexample: classifyIntentFallback returns intent !== 'research'
   */
  it('should classify "look up the latest news about AI" as research', () => {
    const result = classifyIntentFallback('look up the latest news about AI', []);
    expect(result.intent).toBe('research');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Test Case 4: Web Crawl Request
   *
   * Input: "crawl this page and extract the pricing table"
   * Expected (after fix): { intent: 'research', confidence >= 0.7 }
   * On UNFIXED code: { intent: 'task' } or { intent: 'automate' } (misinterpreted as GUI action)
   *
   * Counterexample: classifyIntentFallback returns intent !== 'research'
   */
  it('should classify "crawl this page and extract the pricing table" as research', () => {
    const result = classifyIntentFallback('crawl this page and extract the pricing table', []);
    expect(result.intent).toBe('research');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  /**
   * Property-Based Test: All web search language inputs must return research
   *
   * For all inputs containing web search keywords, classifyIntentFallback must
   * return { intent: 'research', confidence >= 0.7 }.
   *
   * On UNFIXED code: this property fails because the fallback has no research pattern.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('property: all inputs with web search language must be classified as research', () => {
    // Representative inputs covering each keyword
    const webSearchInputs = [
      'search for the best news Discord bot',
      'search for top JavaScript frameworks',
      'find me the top React libraries',
      'find me a good markdown editor',
      'look up the latest news about AI',
      'look up pricing for AWS Lambda',
      'look for open source alternatives to Notion',
      'look for the best CI/CD tools',
      'what is the best JavaScript framework in 2024',
      'what is the best database for a startup',
      'find the best free email service',
      'find the best Python web framework',
      'research the latest trends in machine learning',
      'research competitors in the CRM space',
      'google the current Bitcoin price',
      'google best practices for REST APIs',
      'browse for open source projects on GitHub',
      'browse for news about TypeScript 5',
      'crawl this page and extract the pricing table',
      'crawl the documentation site',
      'scrape the product listings from this URL',
      'scrape competitor pricing data',
      'fetch url https://example.com and summarize',
      'fetch url and extract the main content',
      'find information about React Server Components',
      'find information on the latest Node release',
      'find news about the EU AI Act',
      'find news about OpenAI',
      'find articles about microservices architecture',
      'find articles on TypeScript best practices',
      'find documentation for the Stripe API',
      'find documentation on LangChain',
    ];

    for (const input of webSearchInputs) {
      const result = classifyIntentFallback(input, []);
      expect(result.intent, `Expected 'research' for input: "${input}" but got '${result.intent}'`).toBe('research');
      expect(result.confidence, `Expected confidence >= 0.7 for input: "${input}" but got ${result.confidence}`).toBeGreaterThanOrEqual(0.7);
    }
  });

  /**
   * Property-Based Test (fast-check): Arbitrary inputs with web search keywords
   *
   * Generates inputs by prepending a web search keyword to an arbitrary suffix.
   * All such inputs must be classified as research with confidence >= 0.7.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('property (fast-check): inputs prefixed with web search keywords must return research', () => {
    const keywords = [
      'search for',
      'find me',
      'look up',
      'look for',
      'browse for',
      'find information',
      'find news',
      'find articles',
      'find documentation',
    ];

    const topics = [
      'the best Discord bot',
      'top React libraries',
      'latest AI news',
      'open source tools',
      'pricing information',
      'documentation',
      'tutorials',
      'alternatives to Notion',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...keywords),
        fc.constantFrom(...topics),
        (keyword, topic) => {
          const input = `${keyword} ${topic}`;
          const result = classifyIntentFallback(input, []);
          return result.intent === 'research' && result.confidence >= 0.7;
        }
      ),
      { numRuns: 50 }
    );
  });
});
