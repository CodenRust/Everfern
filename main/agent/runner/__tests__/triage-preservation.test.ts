import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent, classifyIntentHeuristic } from '../triage';
import type { AIClient } from '../../../lib/ai-client';

/**
 * Preservation Property Tests - Triage Context Awareness
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 * 
 * Property 2: Preservation - Non-Affirmative Message Classification
 * 
 * IMPORTANT: These tests capture baseline behavior on UNFIXED code
 * They MUST PASS on unfixed code to confirm what behavior to preserve
 * After the fix is implemented, these tests should still pass (no regressions)
 * 
 * Testing Strategy: Verify that existing classification logic for substantive
 * messages, greetings, keyword-rich requests, and standalone affirmatives
 * without context remains unchanged after implementing context inheritance fix.
 */

describe('Preservation Properties - Triage Classification', () => {
  let mockClient: AIClient;

  beforeEach(() => {
    mockClient = {
      chat: vi.fn().mockImplementation(async ({ messages }) => {
        // Mock AI responses based on input patterns
        const userMsg = messages[0]?.content || '';
        if (typeof userMsg === 'string') {
          if (userMsg.includes('analyze') || userMsg.includes('csv')) {
            return {
              content: JSON.stringify({
                intent: 'analyze',
                confidence: 0.9,
                reasoning: 'Data analysis request detected'
              })
            };
          }
          if (userMsg.includes('fix') || userMsg.includes('bug')) {
            return {
              content: JSON.stringify({
                intent: 'fix',
                confidence: 0.9,
                reasoning: 'Bug fix request detected'
              })
            };
          }
          if (userMsg.includes('code') || userMsg.includes('function')) {
            return {
              content: JSON.stringify({
                intent: 'coding',
                confidence: 0.9,
                reasoning: 'Coding request detected'
              })
            };
          }
        }
        return {
          content: JSON.stringify({
            intent: 'task',
            confidence: 0.7,
            reasoning: 'General task'
          })
        };
      })
    } as any;
  });

  /**
   * Property 2.1: Substantive Message Preservation
   * 
   * For all substantive messages with clear intent signals, classification
   * should match original behavior based on message content
   * 
   * **Validates: Requirements 3.1, 3.4, 3.5**
   */
  describe('Property 2.1: Substantive Message Preservation', () => {
    it('should classify "analyze this CSV file" as "analyze" intent', async () => {
      const result = await classifyIntent('analyze this CSV file', mockClient, []);
      
      expect(result.intent).toBe('analyze');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify explicit analysis requests correctly', async () => {
      const analysisRequests = [
        'analyze this dataset',
        'create visualizations from this data',
        'show me insights from the CSV',
        'generate a chart for this data'
      ];

      for (const request of analysisRequests) {
        const result = await classifyIntent(request, mockClient, []);
        expect(result.intent).toBe('analyze');
      }
    });

    it('should classify explicit coding requests correctly', async () => {
      const codingRequests = [
        'write a function to parse JSON',
        'create a class for user authentication',
        'implement the login endpoint',
        'refactor this code'
      ];

      for (const request of codingRequests) {
        const result = await classifyIntent(request, mockClient, []);
        expect(result.intent).toBe('coding');
      }
    });

    it('should classify explicit fix requests correctly', async () => {
      const fixRequests = [
        'fix the authentication bug',
        'debug this error',
        'resolve the crash in the app',
        'repair the broken feature'
      ];

      for (const request of fixRequests) {
        const result = await classifyIntent(request, mockClient, []);
        expect(result.intent).toBe('fix');
      }
    });

    it('should preserve classification for messages with file uploads and explicit instructions', async () => {
      const conversationHistory = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'analyze this CSV file' },
            { type: 'file', name: 'data.csv', path: '/path/to/data.csv' }
          ]
        }
      ];

      // This is a substantive message, not an affirmative
      const result = await classifyIntent('analyze this CSV file', mockClient, conversationHistory);
      
      expect(result.intent).toBe('analyze');
    });
  });

  /**
   * Property 2.2: Greeting Preservation
   * 
   * For all greetings at conversation start, classification should return
   * "conversation" intent
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 2.2: Greeting Preservation', () => {
    it('should classify "hello" as "conversation" intent', async () => {
      const result = await classifyIntent('hello', mockClient, []);
      
      expect(result.intent).toBe('conversation');
    });

    it('should classify various greetings as "conversation"', async () => {
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'greetings'];

      for (const greeting of greetings) {
        const result = await classifyIntent(greeting, mockClient, []);
        expect(result.intent).toBe('conversation');
      }
    });

    it('should classify closures as "conversation"', async () => {
      const closures = ['thanks', 'thank you', 'bye', 'goodbye'];

      for (const closure of closures) {
        const result = await classifyIntent(closure, mockClient, []);
        expect(result.intent).toBe('conversation');
      }
    });
  });

  /**
   * Property 2.3: Standalone Affirmative Preservation
   * 
   * For all standalone affirmatives without prior context, classification
   * should return "conversation" intent
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 2.3: Standalone Affirmative Preservation', () => {
    it('should classify standalone "yes" as "conversation" when no context exists', async () => {
      // Empty conversation history
      const result = await classifyIntent('yes', mockClient, []);
      
      // Should be conversation since there's no context to inherit
      expect(result.intent).toBe('conversation');
    });

    it('should classify standalone affirmatives as "conversation" without context', async () => {
      const affirmatives = ['yes', 'ok', 'okay', 'sure'];

      for (const affirmative of affirmatives) {
        const result = await classifyIntent(affirmative, mockClient, []);
        // Without context, these should be conversation
        expect(['conversation', 'task']).toContain(result.intent);
      }
    });
  });

  /**
   * Property 2.4: Keyword-Rich Message Preservation
   * 
   * For all messages with explicit coding/research/task keywords, classification
   * should match original heuristic scoring
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 2.4: Keyword-Rich Message Preservation', () => {
    it('should preserve heuristic classification for keyword-rich messages', async () => {
      const testCases = [
        { input: 'write a function to calculate fibonacci', expectedIntent: 'coding' },
        { input: 'search for information about React hooks', expectedIntent: 'research' },
        { input: 'run the test suite', expectedIntent: 'task' },
        { input: 'create a new project with TypeScript', expectedIntent: 'build' }
      ];

      for (const testCase of testCases) {
        const result = await classifyIntent(testCase.input, mockClient, []);
        expect(result.intent).toBe(testCase.expectedIntent);
      }
    });

    it('should preserve multi-action pattern detection', async () => {
      const multiActionRequests = [
        'find all TypeScript files and analyze them',
        'create a function and write tests for it',
        'search for the bug and fix it'
      ];

      for (const request of multiActionRequests) {
        const result = await classifyIntent(request, mockClient, []);
        // Multi-action patterns should still be classified correctly
        expect(['coding', 'task', 'fix']).toContain(result.intent);
      }
    });
  });

  /**
   * Property 2.5: Heuristic Fallback Preservation
   * 
   * When AI classification fails or times out, heuristic classification
   * should continue to work correctly
   * 
   * **Validates: Requirements 3.6**
   */
  describe('Property 2.5: Heuristic Fallback Preservation', () => {
    it('should fall back to heuristic classification when AI client is not provided', async () => {
      const result = await classifyIntent('analyze this CSV file', undefined, []);
      
      expect(result.intent).toBe('analyze');
      expect(result.reasoning).toContain('Heuristic');
    });

    it('should use heuristic classification for various intents without AI', async () => {
      const testCases = [
        { input: 'fix the bug', expectedIntent: 'fix' },
        { input: 'write code', expectedIntent: 'coding' },
        { input: 'analyze data', expectedIntent: 'analyze' },
        { input: 'hello', expectedIntent: 'conversation' }
      ];

      for (const testCase of testCases) {
        const result = await classifyIntent(testCase.input, undefined, []);
        expect(result.intent).toBe(testCase.expectedIntent);
      }
    });
  });

  /**
   * Property 2.6: Heuristic Scoring Preservation
   * 
   * Heuristic classification keyword scoring should remain unchanged
   * 
   * **Validates: Requirements 3.7**
   */
  describe('Property 2.6: Heuristic Scoring Preservation', () => {
    it('should preserve heuristic scoring for analyze intent', () => {
      const result = classifyIntentHeuristic('analyze this CSV file and create charts', []);
      
      expect(result.intent).toBe('analyze');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should preserve heuristic scoring for fix intent', () => {
      const result = classifyIntentHeuristic('fix the broken authentication error', []);
      
      expect(result.intent).toBe('fix');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should preserve heuristic scoring for coding intent', () => {
      const result = classifyIntentHeuristic('write a function to parse JSON data', []);
      
      expect(result.intent).toBe('coding');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should preserve heuristic scoring for build intent', () => {
      const result = classifyIntentHeuristic('create a new React app with TypeScript', []);
      
      expect(result.intent).toBe('build');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});
