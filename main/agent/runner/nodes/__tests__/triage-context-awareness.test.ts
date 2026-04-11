import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent } from '../../triage';
import type { AIClient } from '../../../../lib/ai-client';

/**
 * Bug Condition Exploration Test - Triage Context Awareness
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * Property 1: Bug Condition - Short Affirmative Context Loss
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test verifies that when users respond with short affirmative messages
 * ("yes", "ok", "proceed") after uploading files or stating clear intents,
 * the system incorrectly loses context and classifies the affirmation as
 * "conversation" instead of inheriting the previous intent.
 * 
 * Expected behavior (after fix): Inherit previous intent (analyze, fix, coding)
 * Current behavior (unfixed): Classifies as "conversation", losing context
 */

describe('Bug Condition Exploration - Triage Context Awareness', () => {
  let mockClient: AIClient;

  beforeEach(() => {
    // Mock AI client that simulates current buggy behavior
    // In reality, the bug is in the fast-path logic that bypasses context analysis
    mockClient = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          intent: 'conversation',
          confidence: 0.8,
          reasoning: 'Short affirmative response'
        })
      })
    } as any;
  });

  /**
   * Test Case 1: CSV Upload + "yes" Affirmation
   * 
   * Scenario: User uploads sales_data.csv with "analyze this", then responds "yes"
   * Expected (after fix): Intent should be "analyze" (inherited from previous context)
   * Current (unfixed): Intent is "conversation" (context lost)
   */
  it('should inherit "analyze" intent when user responds "yes" after CSV upload request', async () => {
    // Simulate conversation history: user uploaded CSV and asked to analyze
    const conversationHistory = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'analyze this' },
          { type: 'file', name: 'sales_data.csv', path: '/path/to/sales_data.csv' }
        ]
      },
      {
        role: 'assistant',
        content: 'I can analyze this CSV file for you. Would you like me to proceed?'
      }
    ];

    // User responds with short affirmative
    const userInput = 'yes';

    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // After fix, this should inherit "analyze" intent from previous message
    expect(result.intent).toBe('analyze');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.reasoning).toContain('inherit');
  });

  /**
   * Test Case 2: Fix Request + "ok proceed" Affirmation
   * 
   * Scenario: User says "fix the auth bug", then responds "ok proceed"
   * Expected (after fix): Intent should be "fix" (inherited from previous context)
   * Current (unfixed): Intent is "conversation" (context lost)
   */
  it('should inherit "fix" intent when user responds "ok proceed" after fix request', async () => {
    // Simulate conversation history: user requested a bug fix
    const conversationHistory = [
      {
        role: 'user',
        content: 'fix the auth bug in auth.ts'
      },
      {
        role: 'assistant',
        content: 'I can help you fix the authentication bug. Should I proceed with analyzing the file?'
      }
    ];

    // User responds with short affirmative
    const userInput = 'ok proceed';

    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // After fix, this should inherit "fix" intent from previous message
    expect(result.intent).toBe('fix');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.reasoning).toContain('inherit');
  });

  /**
   * Test Case 3: Code File Upload + "continue" Affirmation
   * 
   * Scenario: User uploads code.ts with "review this", then responds "continue"
   * Expected (after fix): Intent should be "coding" (inherited from previous context)
   * Current (unfixed): Intent is "conversation" (context lost)
   */
  it('should inherit "coding" intent when user responds "continue" after code file upload', async () => {
    // Simulate conversation history: user uploaded code file for review
    const conversationHistory = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'review this code' },
          { type: 'file', name: 'component.ts', path: '/path/to/component.ts' }
        ]
      },
      {
        role: 'assistant',
        content: 'I can review this TypeScript component for you. Would you like me to continue?'
      }
    ];

    // User responds with short affirmative
    const userInput = 'continue';

    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // After fix, this should inherit "coding" intent from previous message
    expect(result.intent).toBe('coding');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.reasoning).toContain('inherit');
  });

  /**
   * Test Case 4: Data Analysis Request + "yes" Affirmation
   * 
   * Scenario: User says "analyze this dataset", then responds "yes"
   * Expected (after fix): Intent should be "analyze" (inherited from previous context)
   * Current (unfixed): Intent is "conversation" (context lost)
   */
  it('should inherit "analyze" intent when user responds "yes" after explicit analysis request', async () => {
    // Simulate conversation history: user requested data analysis
    const conversationHistory = [
      {
        role: 'user',
        content: 'analyze this dataset and create visualizations'
      },
      {
        role: 'assistant',
        content: 'I can analyze the dataset and create visualizations. Should I proceed?'
      }
    ];

    // User responds with short affirmative
    const userInput = 'yes';

    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // After fix, this should inherit "analyze" intent from previous message
    expect(result.intent).toBe('analyze');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.reasoning).toContain('inherit');
  });

  /**
   * Test Case 5: Multiple Affirmative Variations
   * 
   * Test various short affirmative phrases that should all trigger context inheritance
   */
  it('should inherit intent for various short affirmative phrases', async () => {
    const affirmatives = ['yes', 'ok', 'okay', 'proceed', 'continue', 'sure', 'go ahead', 'yep', 'yeah'];

    const conversationHistory = [
      {
        role: 'user',
        content: 'fix the authentication bug'
      },
      {
        role: 'assistant',
        content: 'I can help fix that. Should I proceed?'
      }
    ];

    for (const affirmative of affirmatives) {
      const result = await classifyIntent(affirmative, mockClient, conversationHistory);

      // After fix, all affirmatives should inherit "fix" intent
      expect(result.intent).toBe('fix');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.reasoning).toContain('inherit');
    }
  });

  /**
   * Edge Case: Standalone Affirmative Without Context
   * 
   * Scenario: User says "yes" at the start of conversation (no prior context)
   * Expected: Intent should be "conversation" (no context to inherit)
   * 
   * This test ensures the fix doesn't break legitimate "conversation" classification
   */
  it('should classify standalone "yes" as "conversation" when no prior context exists', async () => {
    // Empty conversation history - no context to inherit
    const conversationHistory: any[] = [];

    // User responds with affirmative but no context
    const userInput = 'yes';

    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // Should classify as "conversation" since there's no context to inherit
    expect(result.intent).toBe('conversation');
  });

  /**
   * Edge Case: Affirmative After Greeting
   * 
   * Scenario: User says "hello", then "yes"
   * Expected: Intent should be "conversation" (greeting context doesn't provide intent)
   * 
   * This test ensures affirmatives don't inherit from greetings
   */
  it('should classify "yes" as "conversation" when previous message was a greeting', async () => {
    // Conversation history with greeting
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

    // User responds with affirmative
    const userInput = 'yes';

    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // Should classify as "conversation" since greeting doesn't provide actionable intent
    expect(result.intent).toBe('conversation');
  });

  /**
   * Test Case 6: Fast-Path Bypass Demonstration
   * 
   * This test demonstrates the root cause: the fast-path in classifyIntent
   * immediately returns heuristic classification for short messages like "yes"
   * without checking conversation history for context signals.
   */
  it('should demonstrate bug: fast-path bypasses context analysis for short affirmatives', async () => {
    const conversationHistory = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'analyze this' },
          { type: 'file', name: 'data.csv', path: '/path/to/data.csv' }
        ]
      },
      {
        role: 'assistant',
        content: 'I can analyze this CSV. Proceed?'
      }
    ];

    const userInput = 'yes';

    // On unfixed code, this will classify as "conversation" due to fast-path
    const result = await classifyIntent(userInput, mockClient, conversationHistory);

    // This assertion will FAIL on unfixed code (demonstrates the bug)
    // After fix, it should PASS (confirms bug is fixed)
    expect(result.intent).not.toBe('conversation');
    expect(result.intent).toBe('analyze');
  });
});
