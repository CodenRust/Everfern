import { IntentType, IntentClassification } from './state';
import { analyzeTask } from './task-decomposer';
import type { AIClient } from '../../lib/ai-client';

// Intent classification will be handled by AI agent - no hardcoded signals needed

import { normalizeMessages } from './services/message-utils';

/**
 * Helper Functions for Context Awareness
 */

/**
 * Check if a message is a short affirmative response
 */
function isShortAffirmative(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const affirmatives = ['yes', 'ok', 'okay', 'proceed', 'continue', 'sure', 'go ahead', 'yep', 'yeah'];
  
  // Direct match with known affirmatives
  if (affirmatives.includes(normalized)) {
    return true;
  }
  
  // Handle multi-word affirmatives like "ok proceed", "go ahead", etc.
  if (normalized.length < 15) {
    // Check for combinations of affirmative words
    const words = normalized.split(/\s+/);
    if (words.length <= 3) { // Max 3 words for short affirmatives
      const affirmativeWords = ['yes', 'ok', 'okay', 'sure', 'yep', 'yeah', 'proceed', 'continue', 'go', 'ahead'];
      const matchingWords = words.filter(word => affirmativeWords.includes(word));
      if (matchingWords.length >= 1 && matchingWords.length === words.length) {
        return true;
      }
    }
  }
  
  // Short messages that contain affirmative patterns
  if (normalized.length < 10) {
    return /^(yes|ok|okay|sure|yep|yeah|go|proceed|continue)/.test(normalized);
  }
  
  return false;
}

/**
 * Check if a message has file attachments
 */
function hasFileAttachment(message: any): boolean {
  if (!message || !message.content) return false;
  
  // Handle array content (mixed text and file)
  if (Array.isArray(message.content)) {
    return message.content.some((item: any) => 
      item.type === 'file' || 
      (typeof item === 'object' && (item.name || item.path || item.file))
    );
  }
  
  // Handle object content with file properties
  if (typeof message.content === 'object') {
    return !!(message.content.file || message.content.name || message.content.path);
  }
  
  return false;
}

/**
 * Check if a message has explicit intent keywords
 */
function hasExplicitIntentKeywords(message: any): boolean {
  if (!message || !message.content) return false;
  
  let content = '';
  if (Array.isArray(message.content)) {
    content = message.content
      .filter((item: any) => item.type === 'text' || typeof item === 'string')
      .map((item: any) => typeof item === 'string' ? item : item.text || '')
      .join(' ');
  } else if (typeof message.content === 'string') {
    content = message.content;
  } else if (typeof message.content === 'object' && message.content.text) {
    content = message.content.text;
  }
  
  const normalized = content.toLowerCase();
  
  // Check for strong intent signals
  const intentKeywords = [
    // Analyze intent
    'analyze', 'analyse', 'analysis', 'visualize', 'chart', 'graph', 'dashboard', 'insights',
    // Fix intent
    'fix', 'debug', 'repair', 'resolve', 'troubleshoot', 'error', 'bug', 'broken',
    // Coding intent
    'write code', 'create function', 'implement', 'refactor', 'programming',
    // Build intent
    'create app', 'build project', 'scaffold', 'generate',
    // Research intent
    'search', 'research', 'investigate', 'find information'
  ];
  
  return intentKeywords.some(keyword => normalized.includes(keyword));
}

/**
 * Extract the previous intent from conversation history
 */
function extractPreviousIntent(history: any[]): IntentType | null {
  if (!history || history.length === 0) return null;
  
  // Find the last user message (excluding the current one)
  const userMessages = history.filter((msg: any) => 
    msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human'
  );
  
  if (userMessages.length < 1) return null;
  
  // Get the previous user message (second to last)
  const previousUserMsg = userMessages[userMessages.length - 1];
  if (!previousUserMsg) return null;
  
  // Check for file attachments first
  if (hasFileAttachment(previousUserMsg)) {
    let content = '';
    if (Array.isArray(previousUserMsg.content)) {
      // Extract text content from mixed content
      content = previousUserMsg.content
        .filter((item: any) => item.type === 'text' || typeof item === 'string')
        .map((item: any) => typeof item === 'string' ? item : item.text || '')
        .join(' ');
      
      // Check file types
      const files = previousUserMsg.content.filter((item: any) => item.type === 'file');
      for (const file of files) {
        const fileName = file.name || file.path || '';
        if (/\.(csv|xlsx|xls|json|data)$/i.test(fileName)) {
          return 'analyze';
        }
        if (/\.(ts|js|tsx|jsx|py|java|cpp|c|php|rb|go|rs)$/i.test(fileName)) {
          return 'coding';
        }
      }
    }
    
    // If we have file attachment but no specific type detected, check text content
    if (content) {
      const normalized = content.toLowerCase();
      if (normalized.includes('analyze') || normalized.includes('review') || normalized.includes('check')) {
        return 'analyze';
      }
    }
    
    // Default for file uploads
    return 'analyze';
  }
  
  // Check for explicit intent keywords in previous message
  if (hasExplicitIntentKeywords(previousUserMsg)) {
    let content = '';
    if (Array.isArray(previousUserMsg.content)) {
      content = previousUserMsg.content
        .filter((item: any) => item.type === 'text' || typeof item === 'string')
        .map((item: any) => typeof item === 'string' ? item : item.text || '')
        .join(' ');
    } else if (typeof previousUserMsg.content === 'string') {
      content = previousUserMsg.content;
    }
    
    const normalized = content.toLowerCase();
    
    // Analyze intent
    if (/\b(analyze|analyse|analysis|visualize|chart|graph|dashboard|insights|csv|data|dataset)\b/i.test(normalized)) {
      return 'analyze';
    }
    
    // Fix intent
    if (/\b(fix|debug|repair|resolve|troubleshoot|error|bug|broken|crash|issue|problem)\b/i.test(normalized)) {
      return 'fix';
    }
    
    // Coding intent
    if (/\b(write code|create function|implement|refactor|programming|code|function|class)\b/i.test(normalized)) {
      return 'coding';
    }
    
    // Build intent
    if (/\b(create app|build project|scaffold|generate|build|create|make)\b/i.test(normalized)) {
      return 'build';
    }
    
    // Research intent
    if (/\b(search|research|investigate|find information|lookup)\b/i.test(normalized)) {
      return 'research';
    }
  }
  
  return null;
}

/**
 * AI-powered intent classification agent
 */
export async function classifyIntentAI(
  client: AIClient, 
  userInput: string, 
  history: any[] = []
): Promise<IntentClassification> {
  const normalizedHistory = normalizeMessages(history);
  const lastMessages = normalizedHistory.slice(-3).map(m => `[${m.role.toUpperCase()}]: ${typeof m.content === 'string' ? m.content : 'Complex Content'}`).join('\n');
  
  const prompt = `You are an intelligent Intent Classification Agent. Analyze the user's input and classify it into the most appropriate category based on context and content.

AVAILABLE INTENTS:
- coding: Writing, refactoring, debugging code/scripts, implementing features
- research: Web searching, information gathering, investigating topics
- task: General operations (file management, commands, system tasks)
- question: Direct informational questions requiring factual answers
- conversation: Greetings, social interaction, polite exchanges
- build: Creating new projects, scaffolding applications, generating structures
- fix: Fixing bugs, resolving errors, troubleshooting issues
- analyze: Data analysis, visualization, processing datasets/files
- automate: Setting up workflows, schedules, recurring processes

CRITICAL - Context Inheritance Rules:
1. If the user input is a short affirmative (yes, ok, proceed, continue, sure, go ahead, etc.)
2. AND there's a recent file upload or clear intent in conversation history
3. THEN inherit the previous intent rather than classifying as 'conversation'

Context Inheritance Examples:
- Previous: User uploads CSV file + "analyze this data"
  Current: "yes" → Classification: "analyze" (inherit from file context)
- Previous: "fix the authentication bug" 
  Current: "ok proceed" → Classification: "fix" (inherit from request)
- Previous: User uploads code.ts + "review this"
  Current: "continue" → Classification: "coding" (inherit from code context)

CONVERSATION HISTORY:
${lastMessages || 'None'}

Analyze the user input considering:
1. File attachments in recent messages (CSV/data files → analyze, code files → coding)
2. Explicit requests in previous messages
3. Short affirmatives should inherit context when available
4. Standalone messages should be classified independently

RESPONSE FORMAT (JSON only):
{
  "intent": "coding|research|task|question|conversation|build|fix|analyze|automate",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation including context inheritance if applicable"
}

USER INPUT: "${userInput}"`;

  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Intent classification timed out')), 30000)
  );

  try {
    const aiPromise = client.chat({
      messages: [{ role: 'system', content: prompt }],
      responseFormat: 'json',
      temperature: 0.1
    });

    const response = await Promise.race([aiPromise, timeoutPromise]) as any;
    const data = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
    
    return {
      intent: (data.intent || 'task') as IntentType,
      confidence: data.confidence || 0.7,
      reasoning: data.reasoning || 'AI Intent Classification'
    };
  } catch (err) {
    console.error(`[IntentAgent] AI Classification failed: ${err}. Using fallback.`);
    return classifyIntentFallback(userInput, history);
  }
}

/**
 * Fallback intent classification (when AI fails)
 */
export function classifyIntentFallback(userInput: string, history: any[] = []): IntentClassification {
  const normalized = userInput.toLowerCase().trim();

  // Check for context inheritance first
  if (isShortAffirmative(normalized) && history.length > 0) {
    const previousIntent = extractPreviousIntent(history);
    if (previousIntent) {
      return {
        intent: previousIntent,
        confidence: 0.90,
        reasoning: `Fallback: Short affirmative - inherited ${previousIntent} from previous message`
      };
    }
  }

  // Basic pattern matching for common cases
  if (/^(hi|hello|hey|thanks|thank you|bye|goodbye)\b/i.test(normalized)) {
    return { intent: 'conversation', confidence: 0.9, reasoning: 'Fallback: Greeting detected' };
  }
  
  if (/\b(analyze|analysis|chart|graph|csv|data|dataset|visualize)\b/i.test(normalized)) {
    return { intent: 'analyze', confidence: 0.8, reasoning: 'Fallback: Analysis keywords detected' };
  }
  
  if (/\b(fix|debug|error|bug|broken|crash|issue|problem)\b/i.test(normalized)) {
    return { intent: 'fix', confidence: 0.8, reasoning: 'Fallback: Fix keywords detected' };
  }
  
  if (/\b(code|function|class|implement|programming|script)\b/i.test(normalized)) {
    return { intent: 'coding', confidence: 0.8, reasoning: 'Fallback: Coding keywords detected' };
  }
  
  if (/\b(create|build|generate|scaffold|new project|new app)\b/i.test(normalized)) {
    return { intent: 'build', confidence: 0.8, reasoning: 'Fallback: Build keywords detected' };
  }
  
  if (/^(what|how|why|when|where|who|which)\b/i.test(normalized)) {
    return { intent: 'question', confidence: 0.8, reasoning: 'Fallback: Question pattern detected' };
  }
  
  if (/\b(search|research|find|lookup|investigate)\b/i.test(normalized)) {
    return { intent: 'research', confidence: 0.8, reasoning: 'Fallback: Research keywords detected' };
  }
  
  if (/\b(automate|schedule|workflow|pipeline|recurring)\b/i.test(normalized)) {
    return { intent: 'automate', confidence: 0.8, reasoning: 'Fallback: Automation keywords detected' };
  }

  // Default to task for general operations
  return { 
    intent: 'task', 
    confidence: 0.6, 
    reasoning: 'Fallback: Default classification for general operations' 
  };
}

/**
 * Main intent classification function - AI-first approach
 */
export async function classifyIntent(userInput: string, client?: AIClient, history: any[] = []): Promise<IntentClassification> {
  const normalized = userInput.toLowerCase().trim();
  
  // Quick context inheritance check for short affirmatives
  if (isShortAffirmative(normalized) && history.length > 0) {
    const previousIntent = extractPreviousIntent(history);
    if (previousIntent) {
      return {
        intent: previousIntent,
        confidence: 0.95,
        reasoning: `Context inheritance: Short affirmative inheriting ${previousIntent} from previous message`
      };
    }
  }
  
  // Use AI agent for intent classification when available
  if (client) {
    return classifyIntentAI(client, userInput, history);
  }
  
  // Fallback when no AI client available
  return classifyIntentFallback(userInput, history);
}

/**
 * Check if task is read-only (no mutations)
 */
export function isReadOnlyTask(intent: IntentType): boolean {
  return ['question', 'conversation'].includes(intent);
}
