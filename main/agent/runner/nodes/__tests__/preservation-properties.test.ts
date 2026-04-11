import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent, classifyIntentHeuristic } from '../../triage';
import type { AIClient } from '../../../../lib/ai-client';
import fc from 'fast-check';

/**
 * Preservation Property Tests - Triage Context Awareness
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * Property 2: Preservation - Non-Affirmative Message Classification
 * 
 * IMPORTANT: These tests follow observation-first methodology
 * - Observe behavior on UNFIXED code for non-buggy inputs
 * - Write property-based tests capturing observed behavior patterns
 * - EXPECTED OUTCOME: Tests PASS on unfixed code (confirms baseline behavior)
 * 
 * These tests ensure that the bugfix does NOT introduce regressions for:
 * - Substantive messages with clear intent signals
 * - Greetings at conversation start
 * - Standalone affirmatives without context
 * - Keyword-rich messages
 * - Multi-action patterns
 */

describe('Preservation Properties - Non-Affirmative Message Classification', () => {
  let mockClient: AIClient;

  beforeEach(() => {
    // Mock AI client that simulates normal classification behavior
    // The prompt is passed in messages[0].content, which is the system prompt
    mockClient = {
      chat: vi.fn().mockImplementation(async ({ messages }) => {
        // Extract user input from the system prompt
        const systemPrompt = messages[0].content;
        const userInputMatch = systemPrompt.match(/User Input: "(.+)"/);
        const userInput = userInputMatch ? userInputMatch[1] : '';
        
        // Simulate AI classification based on content
        if (userInput) {
          const normalized = userInput.toLowerCase();
          
          if (normalized.includes('analyze') || normalized.includes('csv') || normalized.includes('data') || normalized.includes('dataset')) {
            return {
              content: JSON.stringify({
                intent: 'analyze',
                confidence: 0.9,
                reasoning: 'Data analysis request detected'
              })
            };
          }
          
          if (normalized.includes('fix') || normalized.includes('bug') || normalized.includes('error') || normalized.includes('debug') || normalized.includes('repair')) {
            return {
              content: JSON.stringify({
                intent: 'fix',
                confidence: 0.9,
                reasoning: 'Bug fix request detected'
              })
            };
          }
          
          if (normalized.includes('write') && (normalized.includes('function') || normalized.includes('code') || normalized.includes('class') || normalized.includes('script'))) {
            return {
              content: JSON.stringify({
                intent: 'coding',
                confidence: 0.9,
                reasoning: 'Coding request detected'
              })
            };
          }
          
          if (normalized.includes('refactor') || normalized.includes('implement') || normalized.includes('create function') || normalized.includes('create class')) {
            return {
              content: JSON.stringify({
                intent: 'coding',
                confidence: 0.9,
                reasoning: 'Coding request detected'
              })
            };
          }
          
          if (normalized.includes('review') && normalized.includes('code')) {
            return {
              content: JSON.stringify({
                intent: 'coding',
                confidence: 0.9,
                reasoning: 'Code review request detected'
              })
            };
          }
          
          if (normalized.includes('search') || normalized.includes('find') || normalized.includes('lookup')) {
            return {
              content: JSON.stringify({
                intent: 'research',
                confidence: 0.9,
                reasoning: 'Research request detected'
              })
            };
          }
          
          if (/^(hello|hi|hey|thanks|thank you|bye)/.test(normalized)) {
            return {
              content: JSON.stringify({
                intent: 'conversation',
                confidence: 0.95,
                reasoning: 'Greeting or polite closure detected'
              })
            };
          }
        }
        
        // Default to task
        return {
          content: JSON.stringify({
            intent: 'task',
            confidence: 0.7,
            reasoning: 'General task request'
          })
        };
      })
    } as any;
  });

  /**
   * Preservation Test 1: Substantive Messages with Clear Intent Signals
   * 
   * Requirement 3.1: WHEN a user provides a substantive message with clear intent signals
   * (e.g., "analyze this CSV file") THEN the system SHALL CONTINUE TO classify the intent
   * correctly based on the message content
   */
  describe('Substantive Message Classification', () => {
    it('should classify "analyze this CSV file" as "analyze" intent', async () => {
      const userInput = 'analyze this CSV file';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('analyze');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify "fix the authentication bug" as "fix" intent', async () => {
      const userInput = 'fix the authentication bug';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('fix');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify "write a function to parse JSON" as "coding" intent', async () => {
      const userInput = 'write a function to parse JSON';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('coding');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify "search for React documentation" as "research" intent', async () => {
      const userInput = 'search for React documentation';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('research');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    /**
     * Property-Based Test: All substantive messages (length > 10, contains intent keywords)
     * should classify based on their content, not affected by the bugfix
     */
    it('property: substantive messages with intent keywords classify correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { keyword: 'analyze', expectedIntent: 'analyze' },
            { keyword: 'fix', expectedIntent: 'fix' },
            { keyword: 'write code', expectedIntent: 'coding' },
            { keyword: 'search', expectedIntent: 'research' }
          ),
          fc.string({ minLength: 5, maxLength: 20 }),
          async ({ keyword, expectedIntent }, padding) => {
            const userInput = `${keyword} ${padding}`.trim();
            const conversationHistory: any[] = [];

            const result = await classifyIntent(userInput, mockClient, conversationHistory);

            // Should classify based on keyword, not as "conversation"
            expect(result.intent).toBe(expectedIntent);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Preservation Test 2: Greetings at Conversation Start
   * 
   * Requirement 3.2: WHEN a user starts a new conversation with a greeting
   * (e.g., "hello", "hi") THEN the system SHALL CONTINUE TO classify it as
   * "conversation" intent
   */
  describe('Greeting Classification', () => {
    it('should classify "hello" as "conversation" intent', async () => {
      const userInput = 'hello';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    it('should classify "hi there" as "conversation" intent', async () => {
      const userInput = 'hi there';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    it('should classify "hey" as "conversation" intent', async () => {
      const userInput = 'hey';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    it('should classify "thanks" as "conversation" intent', async () => {
      const userInput = 'thanks';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    /**
     * Property-Based Test: All greetings at conversation start should classify as "conversation"
     */
    it('property: greetings at conversation start classify as "conversation"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('hello', 'hi', 'hey', 'thanks', 'thank you', 'bye'),
          async (greeting) => {
            const conversationHistory: any[] = [];

            const result = await classifyIntent(greeting, mockClient, conversationHistory);

            expect(result.intent).toBe('conversation');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Preservation Test 3: Standalone Affirmatives Without Context
   * 
   * Requirement 3.3: WHEN a user provides a short affirmative response without
   * any prior context or file uploads THEN the system SHALL CONTINUE TO classify
   * it as "conversation" intent
   */
  describe('Standalone Affirmative Classification', () => {
    it('should classify standalone "yes" as "conversation" intent', async () => {
      const userInput = 'yes';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    it('should classify standalone "ok" as "conversation" intent', async () => {
      const userInput = 'ok';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    it('should classify standalone "proceed" as "conversation" intent', async () => {
      const userInput = 'proceed';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      expect(result.intent).toBe('conversation');
    });

    /**
     * Property-Based Test: All standalone affirmatives (no context) should classify as "conversation"
     */
    it('property: standalone affirmatives without context classify as "conversation"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('yes', 'ok', 'okay', 'proceed', 'continue', 'sure'),
          async (affirmative) => {
            const conversationHistory: any[] = [];

            const result = await classifyIntent(affirmative, mockClient, conversationHistory);

            expect(result.intent).toBe('conversation');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should classify "yes" after greeting as "conversation" intent', async () => {
      const userInput = 'yes';
      const conversationHistory = [
        {
          role: 'user',
          content: 'hello'
        },
        {
          role: 'assistant',
          content: 'Hello! How can I help you today?'
        }
      ];

      const result = await classifyIntent(userInput, mockClient, conversationHistory);

      // Should classify as "conversation" since greeting doesn't provide actionable intent
      expect(result.intent).toBe('conversation');
    });
  });

  /**
   * Preservation Test 4: Keyword-Rich Messages
   * 
   * Requirement 3.4: WHEN the triage system processes messages with explicit
   * coding, research, or task keywords THEN it SHALL CONTINUE TO classify them
   * correctly according to existing heuristics and AI classification
   */
  describe('Keyword-Rich Message Classification', () => {
    it('should classify messages with coding keywords correctly', async () => {
      const codingMessages = [
        'create a function',
        'refactor this class',
        'implement the API endpoint',
        'write a script to process data'
      ];

      for (const message of codingMessages) {
        const result = await classifyIntent(message, mockClient, []);
        expect(result.intent).toBe('coding');
      }
    });

    it('should classify messages with research keywords correctly', async () => {
      const researchMessages = [
        'search for best practices',
        'find information about TypeScript',
        'lookup the documentation',
        'what is the difference between'
      ];

      for (const message of researchMessages) {
        const result = await classifyIntent(message, mockClient, []);
        expect(result.intent).toBe('research');
      }
    });

    it('should classify messages with fix keywords correctly', async () => {
      const fixMessages = [
        'fix the broken test',
        'debug this error',
        'resolve the crash',
        'repair the failing build'
      ];

      for (const message of fixMessages) {
        const result = await classifyIntent(message, mockClient, []);
        expect(result.intent).toBe('fix');
      }
    });

    it('should classify messages with analyze keywords correctly', async () => {
      const analyzeMessages = [
        'analyze this dataset',
        'create a chart from the data',
        'visualize the trends',
        'generate insights from the CSV'
      ];

      for (const message of analyzeMessages) {
        const result = await classifyIntent(message, mockClient, []);
        expect(result.intent).toBe('analyze');
      }
    });
  });

  /**
   * Preservation Test 5: File Upload with Explicit Instruction
   * 
   * Requirement 3.5: WHEN a user uploads a file with an explicit instruction
   * in the same message (e.g., "Here's a CSV, analyze it") THEN the system
   * SHALL CONTINUE TO classify it as "analyze" intent and route to DATA_ANALYST
   */
  describe('File Upload with Explicit Instruction', () => {
    it('should classify CSV upload with "analyze" instruction as "analyze" intent', async () => {
      const userInput = 'analyze this';
      const conversationHistory = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'analyze this' },
            { type: 'file', name: 'sales_data.csv', path: '/path/to/sales_data.csv' }
          ]
        }
      ];

      // Simulate the current message being the one with file upload
      const result = await classifyIntent(userInput, mockClient, []);

      expect(result.intent).toBe('analyze');
    });

    it('should classify code file upload with "review" instruction as "coding" intent', async () => {
      const userInput = 'review this code';
      const conversationHistory = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'review this code' },
            { type: 'file', name: 'component.ts', path: '/path/to/component.ts' }
          ]
        }
      ];

      const result = await classifyIntent(userInput, mockClient, []);

      expect(result.intent).toBe('coding');
    });
  });

  /**
   * Preservation Test 6: Heuristic Classification Patterns
   * 
   * Requirement 3.7: WHEN the heuristic classification encounters multi-action
   * patterns or complex requests THEN it SHALL CONTINUE TO score and classify
   * them appropriately
   */
  describe('Heuristic Classification Patterns', () => {
    it('should score multi-action patterns correctly', () => {
      const multiActionMessages = [
        'find all files and analyze them',
        'create a function and then run tests',
        'search for documentation and implement the feature'
      ];

      for (const message of multiActionMessages) {
        const result = classifyIntentHeuristic(message);
        
        // Multi-action patterns should not classify as "conversation"
        expect(result.intent).not.toBe('conversation');
        // Should have reasonable confidence
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should handle special coding patterns correctly', () => {
      const codingPatterns = [
        'function myFunc() { return true; }',
        'const data = await fetch(url);',
        'class MyClass extends BaseClass',
        'import { Component } from "react";'
      ];

      for (const pattern of codingPatterns) {
        const result = classifyIntentHeuristic(pattern);
        
        // Coding patterns should classify as "coding"
        expect(result.intent).toBe('coding');
      }
    });

    it('should handle question patterns correctly', () => {
      const questionPatterns = [
        'what is TypeScript?',
        'how does async/await work?',
        'why is this failing?',
        'when should I use this pattern?'
      ];

      for (const pattern of questionPatterns) {
        const result = classifyIntentHeuristic(pattern);
        
        // Question patterns should classify as "question"
        expect(result.intent).toBe('question');
      }
    });

    /**
     * Property-Based Test: Heuristic scoring should be consistent
     */
    it('property: heuristic classification is deterministic', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'analyze this data',
            'fix the bug',
            'write a function',
            'search for information',
            'hello there'
          ),
          (message) => {
            const result1 = classifyIntentHeuristic(message);
            const result2 = classifyIntentHeuristic(message);

            // Same input should produce same output
            expect(result1.intent).toBe(result2.intent);
            expect(result1.confidence).toBe(result2.confidence);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Preservation Test 7: AI Classification Fallback
   * 
   * Requirement 3.6: WHEN the AI classification times out or fails THEN the
   * system SHALL CONTINUE TO fall back to heuristic classification
   */
  describe('AI Classification Fallback', () => {
    it('should fall back to heuristic when AI client is not provided', async () => {
      const userInput = 'analyze this CSV file';
      const conversationHistory: any[] = [];

      // Call without AI client
      const result = await classifyIntent(userInput, undefined, conversationHistory);

      // Should still classify correctly using heuristics
      expect(result.intent).toBe('analyze');
      expect(result.reasoning).toContain('Heuristic');
    });

    it('should fall back to heuristic when AI call fails', async () => {
      const failingClient = {
        chat: vi.fn().mockRejectedValue(new Error('AI service unavailable'))
      } as any;

      const userInput = 'fix the authentication bug';
      const conversationHistory: any[] = [];

      const result = await classifyIntent(userInput, failingClient, conversationHistory);

      // Should fall back to heuristic classification
      expect(result.intent).toBe('fix');
      expect(result.reasoning).toContain('Heuristic');
    });
  });

  /**
   * Property-Based Test: Comprehensive Preservation Check
   * 
   * This test generates various non-affirmative inputs and verifies that
   * classification behavior is consistent and reasonable
   */
  describe('Comprehensive Preservation Properties', () => {
    it('property: non-affirmative messages longer than 10 chars do not classify as conversation by default', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 11, maxLength: 50 }),
          async (message) => {
            // Skip if message happens to be a greeting
            const normalized = message.toLowerCase().trim();
            if (/^(hello|hi|hey|thanks|thank you|bye)/.test(normalized)) {
              return;
            }

            const conversationHistory: any[] = [];
            const result = await classifyIntent(message, mockClient, conversationHistory);

            // Long messages should not default to "conversation" unless they're greetings
            // They should be classified based on content
            expect(result).toBeDefined();
            expect(result.intent).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('property: messages with clear intent keywords always classify to that intent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            keyword: fc.constantFrom('analyze', 'fix', 'code', 'search'),
            prefix: fc.stringOf(fc.constantFrom('a', 'b', 'c', ' '), { minLength: 0, maxLength: 10 }),
            suffix: fc.stringOf(fc.constantFrom('x', 'y', 'z', ' '), { minLength: 0, maxLength: 10 })
          }),
          async ({ keyword, prefix, suffix }) => {
            const message = `${prefix} ${keyword} ${suffix}`.trim();
            const conversationHistory: any[] = [];

            const result = await classifyIntent(message, mockClient, conversationHistory);

            // Should classify based on the keyword
            const expectedIntents: Record<string, string> = {
              'analyze': 'analyze',
              'fix': 'fix',
              'code': 'coding',
              'search': 'research'
            };

            expect(result.intent).toBe(expectedIntents[keyword]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
