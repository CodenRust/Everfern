import { IntentType, IntentClassification } from './state';
import type { AIClient } from '../../lib/ai-client';

// Intent classification will be handled by AI agent - no hardcoded signals needed

import { normalizeMessages } from './services/message-utils';

// ── Intent Classification Cache ──────────────────────────────────────

interface CachedIntentEntry {
  classification: IntentClassification;
  timestamp: number;
  inputHash: string;
}

class IntentCache {
  private cache = new Map<string, CachedIntentEntry>();
  private maxSize = 1000;
  private maxAge = 300000; // 5 minutes

  private hashInput(input: string, historyLength: number | undefined): string {
    const safeHistoryLength = historyLength || 0;
    // Create a simple hash of input + history context
    const context = `${input}:${safeHistoryLength}`;
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
      const char = context.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  get(input: string, historyLength: number | undefined): IntentClassification | null {
    const key = this.hashInput(input, historyLength);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if entry is still valid
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.classification;
  }

  set(input: string, historyLength: number | undefined, classification: IntentClassification): void {
    const key = this.hashInput(input, historyLength);

    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      classification,
      timestamp: Date.now(),
      inputHash: key
    });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

const intentCache = new IntentCache();

// Cleanup cache every 2 minutes
setInterval(() => intentCache.cleanup(), 120000);

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
 * Check if a message has any substantive content (not just a greeting)
 */
function hasSubstantiveContent(message: any): boolean {
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

  // Consider it substantive if it's longer than a typical greeting
  return content.trim().length > 20;
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

  // Check for file attachments first - strong signal for intent
  if (hasFileAttachment(previousUserMsg)) {
    let content = '';
    if (Array.isArray(previousUserMsg.content)) {
      // Extract text content from mixed content
      content = previousUserMsg.content
        .filter((item: any) => item.type === 'text' || typeof item === 'string')
        .map((item: any) => typeof item === 'string' ? item : item.text || '')
        .join(' ');

      // Check file types for intent hints
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

    // Default for file uploads
    return 'analyze';
  }

  // Check if previous message has substantive content
  if (hasSubstantiveContent(previousUserMsg)) {
    // Let AI handle the classification - don't use keywords
    // Return null to indicate we should use AI classification
    return null;
  }

  return null;
}

// ── AI Client Pool for Connection Optimization ──────────────────────────────

interface PooledClient {
  client: AIClient;
  lastUsed: number;
  inUse: boolean;
}

class AIClientPool {
  private pool: PooledClient[] = [];
  private maxPoolSize = 3;
  private maxIdleTime = 60000; // 1 minute
  private connectionReuseCount = 0;
  private totalConnectionCount = 0;

  getClient(baseClient: AIClient): AIClient {
    // In test environment, just return the original client to preserve mocks
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return baseClient;
    }

    // Clean up idle clients
    this.cleanup();

    // Find available client
    const available = this.pool.find(p => !p.inUse);
    if (available) {
      this.connectionReuseCount++;
      this.totalConnectionCount++;
      available.inUse = true;
      available.lastUsed = Date.now();
      return available.client;
    }

    // Create new client if pool not full
    if (this.pool.length < this.maxPoolSize) {
      this.totalConnectionCount++;
      const pooledClient: PooledClient = {
        client: baseClient, // Reuse the same client instance for now
        lastUsed: Date.now(),
        inUse: true
      };
      this.pool.push(pooledClient);
      return pooledClient.client;
    }

    // Pool full, return base client
    this.totalConnectionCount++;
    return baseClient;
  }

  releaseClient(client: AIClient): void {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return;
    }

    const pooled = this.pool.find(p => p.client === client);
    if (pooled) {
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
    }
  }

  getConnectionReuseRate(): number {
    if (this.totalConnectionCount === 0) return 0;
    return this.connectionReuseCount / this.totalConnectionCount;
  }

  private cleanup(): void {
    const now = Date.now();
    this.pool = this.pool.filter(p => !p.inUse && (now - p.lastUsed) < this.maxIdleTime);
  }
}

const clientPool = new AIClientPool();

// ── Retry Logic with Exponential Backoff ────────────────────────────────────

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeoutMs: number;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  const startTime = Date.now();

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      // Calculate remaining timeout budget
      const elapsedTime = Date.now() - startTime;
      const remainingTimeoutMs = options.timeoutMs - elapsedTime;

      // Fail fast if timeout is imminent (< 200ms remaining)
      if (remainingTimeoutMs < 200) {
        throw new Error('Timeout budget exhausted');
      }

      // Create timeout promise for this attempt with remaining budget
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Intent classification timed out')), remainingTimeoutMs)
      );

      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;

      // Don't retry on final attempt
      if (attempt === options.maxRetries) {
        break;
      }

      // Check if error is retryable (transient network issues only — NOT timeouts)
      const errorMsg = lastError.message.toLowerCase();
      const isRetryable = !errorMsg.includes('timed out') &&
                         !errorMsg.includes('timeout budget') &&
                         (errorMsg.includes('econnrefused') ||
                          errorMsg.includes('etimedout') ||
                          errorMsg.includes('enotfound') ||
                          errorMsg.includes('fetch failed') ||
                          errorMsg.includes('network error'));

      if (!isRetryable) {
        throw lastError;
      }

      // Calculate remaining timeout budget
      const elapsedTime = Date.now() - startTime;
      const remainingTimeoutMs = options.timeoutMs - elapsedTime;

      // Fail fast if timeout budget is too tight for another retry
      if (remainingTimeoutMs < 300) {
        console.warn(`[IntentAgent] Timeout budget exhausted after ${attempt + 1} attempts. Total elapsed: ${elapsedTime}ms`);
        break;
      }

      // Calculate delay with exponential backoff, respecting remaining timeout
      const maxDelayForThisAttempt = Math.min(
        options.baseDelay * Math.pow(2, attempt),
        options.maxDelay,
        remainingTimeoutMs - 100 // Leave 100ms buffer for the next attempt
      );

      const delay = Math.max(0, maxDelayForThisAttempt);

      console.warn(`[IntentAgent] Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${delay}ms... (${remainingTimeoutMs}ms remaining)`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Fast synchronous intent classification for obvious cases.
 * Returns null if the intent is ambiguous and needs AI.
 */
function classifyIntentFast(userInput: string, history: any[]): IntentClassification | null {
  const normalized = userInput.toLowerCase().trim();

  // Short affirmatives — inherit from history
  if (isShortAffirmative(normalized) && history.length > 0) {
    const prev = extractPreviousIntent(history);
    if (prev) {
      return { intent: prev, confidence: 0.95, reasoning: 'Context inheritance: short affirmative' };
    }
  }

  // Very short inputs — likely conversational
  if (normalized.length < 8) {
    return { intent: 'conversation', confidence: 0.8, reasoning: 'Fast: very short input' };
  }

  // Strong fix/debug signals
  if (/\b(fix|debug|error|bug|crash|broken|not working|doesn't work|failing)\b/.test(normalized)) {
    return { intent: 'fix', confidence: 0.85, reasoning: 'Fast: fix/debug keywords' };
  }

  // Strong coding signals
  if (/\b(write|implement|create|add|refactor|code|function|class|component|script)\b/.test(normalized) &&
      /\b(code|function|class|component|script|method|api|endpoint|module)\b/.test(normalized)) {
    return { intent: 'coding', confidence: 0.85, reasoning: 'Fast: coding keywords' };
  }

  // Strong build signals
  if (/\b(build|scaffold|generate|setup|initialize|bootstrap)\b.*\b(project|app|application|repo|template)\b/.test(normalized)) {
    return { intent: 'build', confidence: 0.85, reasoning: 'Fast: build keywords' };
  }

  // Strong question signals
  if (/^(what|how|why|when|where|which|who|can you explain|tell me about)\b/.test(normalized)) {
    return { intent: 'question', confidence: 0.8, reasoning: 'Fast: question pattern' };
  }

  // Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|thanks|thank you|bye)\b/.test(normalized)) {
    return { intent: 'conversation', confidence: 0.9, reasoning: 'Fast: greeting' };
  }

  // Ambiguous — needs AI
  return null;
}

/**
 * AI-powered intent classification with fast-path heuristics.
 * Tries synchronous classification first; only calls AI for ambiguous inputs.
 */
export async function classifyIntentAI(
  client: AIClient,
  userInput: string,
  history: any[] = []
): Promise<IntentClassification> {
  // Fast path: skip AI for obvious intents
  const fast = classifyIntentFast(userInput, history);
  if (fast) {
    console.log(`[IntentAgent] Fast classification: ${fast.intent} (${fast.reasoning})`);
    return fast;
  }

  const normalizedHistory = normalizeMessages(history);
  const lastMessages = normalizedHistory.slice(-5).map(m => {
    const role = m.role.toUpperCase();
    let content = '';
    if (typeof m.content === 'string') {
      content = m.content.slice(0, 200);
    } else if (Array.isArray(m.content)) {
      const textParts = m.content.filter((item: any) => item.type === 'text' || typeof item === 'string');
      content = textParts.map((item: any) => typeof item === 'string' ? item : item.text || '').join(' ').slice(0, 200);
      // Detect file attachments
      const hasFiles = m.content.some((item: any) => item.type === 'file' || item.type === 'image_url');
      if (hasFiles) {
        content += ' [FILE ATTACHED]';
      }
    }
    return `[${role}]: ${content}`;
  }).join('\n');

  const prompt = `Classify the user's intent into exactly one category. Reply with JSON only.

Categories: coding, research, task, question, conversation, build, fix, analyze, automate

Rules:
- Short affirmatives (yes/ok/proceed/sure) with history → inherit previous intent
- File attachments: data files → analyze, code files → coding
- Focus on what the user wants to accomplish

History (last 5):
${lastMessages || 'None'}

Input: "${userInput}"

JSON: {"intent":"<category>","confidence":<0-1>,"reasoning":"<brief>"}`;

  // Get pooled client for better connection reuse
  const pooledClient = clientPool.getClient(client);

  try {
    const result = await withRetry(
      async () => {
        const response = await pooledClient.chat({
          messages: [{ role: 'user', content: prompt }],
          responseFormat: 'json',
          temperature: 0.1,
          maxTokens: 80  // Intent JSON is tiny — {"intent":"...","confidence":0.9,"reasoning":"..."}
        });

        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        console.log(`[IntentAgent] Raw AI response: ${content.slice(0, 200)}`);
        // Remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const data = JSON.parse(content);

        return {
          intent: (data.intent || 'task') as IntentType,
          confidence: data.confidence || 0.7,
          reasoning: data.reasoning || 'AI Intent Classification'
        };
      },
      {
        maxRetries: 1,
        baseDelay: 200,
        maxDelay: 500,
        timeoutMs: 5000  // 5s total budget — enough for slow providers, fast enough for UX
      }
    );

    console.log(`[IntentAgent] Classification completed successfully: ${result.intent} (confidence: ${result.confidence})`);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[IntentAgent] AI Classification failed after retries: ${errorMsg}. Using enhanced fallback.`);

    // Enhanced fallback with better error context
    const fallbackResult = classifyIntentFallback(userInput, history);
    return {
      ...fallbackResult,
      reasoning: `Fallback used due to AI timeout/error: ${fallbackResult.reasoning}`
    };
  } finally {
    // Release client back to pool
    clientPool.releaseClient(pooledClient);

    // Log connection reuse metrics
    const reuseRate = clientPool.getConnectionReuseRate();
    if (reuseRate > 0) {
      console.log(`[IntentAgent] Connection reuse rate: ${(reuseRate * 100).toFixed(1)}%`);
    }
  }
}

/**
 * Enhanced fallback intent classification with improved graceful handling
 * Uses context-aware heuristics when AI is unavailable
 * Provides better confidence scoring and reasoning
 */
export function classifyIntentFallback(userInput: string, history: any[] = []): IntentClassification {
  const normalized = userInput.toLowerCase().trim();

  // Check for context inheritance first (for short affirmatives)
  if (isShortAffirmative(normalized) && history.length > 0) {
    const previousIntent = extractPreviousIntent(history);
    if (previousIntent) {
      return {
        intent: previousIntent,
        confidence: 0.85,
        reasoning: `Fallback: Short affirmative - inherited ${previousIntent} from previous context`
      };
    }
  }

  // Enhanced fallback logic with better pattern recognition
  const inputLength = normalized.length;

  // Very short inputs - likely greetings or acknowledgments
  if (inputLength < 10) {
    const greetingPatterns = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay'];
    if (greetingPatterns.some(pattern => normalized.includes(pattern))) {
      return {
        intent: 'conversation',
        confidence: 0.75,
        reasoning: 'Fallback: Short greeting or acknowledgment detected'
      };
    }
  }

  // Check for file attachments in current or recent messages
  const recentMessages = history.slice(-3);
  const hasRecentFiles = recentMessages.some(msg => hasFileAttachment(msg));
  if (hasRecentFiles) {
    return {
      intent: 'analyze',
      confidence: 0.7,
      reasoning: 'Fallback: File attachment detected in recent context'
    };
  }

  // Question patterns
  const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'];
  const startsWithQuestion = questionWords.some(word => normalized.startsWith(word));
  const hasQuestionMark = normalized.includes('?');

  if (startsWithQuestion || hasQuestionMark) {
    return {
      intent: 'question',
      confidence: 0.7,
      reasoning: 'Fallback: Question pattern detected'
    };
  }

  // Code-related patterns (basic detection)
  const codePatterns = ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'def ', 'public ', 'private '];
  const hasCodePattern = codePatterns.some(pattern => normalized.includes(pattern));

  if (hasCodePattern) {
    return {
      intent: 'coding',
      confidence: 0.65,
      reasoning: 'Fallback: Code-related keywords detected'
    };
  }

  // Build/create patterns
  const buildPatterns = ['create', 'build', 'make', 'generate', 'scaffold', 'setup', 'initialize'];
  const hasBuildPattern = buildPatterns.some(pattern => normalized.includes(pattern));

  if (hasBuildPattern) {
    return {
      intent: 'build',
      confidence: 0.65,
      reasoning: 'Fallback: Build/create pattern detected'
    };
  }

  // Fix/debug patterns
  const fixPatterns = ['fix', 'debug', 'error', 'bug', 'issue', 'problem', 'broken', 'not working'];
  const hasFixPattern = fixPatterns.some(pattern => normalized.includes(pattern));

  if (hasFixPattern) {
    return {
      intent: 'fix',
      confidence: 0.65,
      reasoning: 'Fallback: Fix/debug pattern detected'
    };
  }

  // Research patterns
  const researchPatterns = ['search', 'find', 'look up', 'research', 'investigate', 'explore'];
  const hasResearchPattern = researchPatterns.some(pattern => normalized.includes(pattern));

  if (hasResearchPattern) {
    return {
      intent: 'research',
      confidence: 0.65,
      reasoning: 'Fallback: Research pattern detected'
    };
  }

  // Default to task for substantial inputs, conversation for very short ones
  if (inputLength < 15) {
    return {
      intent: 'conversation',
      confidence: 0.5,
      reasoning: 'Fallback: Short input without clear pattern - likely conversational'
    };
  }

  // Default to task for longer inputs
  return {
    intent: 'task',
    confidence: 0.5,
    reasoning: 'Fallback: No clear pattern detected - defaulting to general task'
  };
}

/**
 * Main intent classification function - AI-first approach with caching
 * ALWAYS uses AI for classification when available
 */
export async function classifyIntent(userInput: string, client?: AIClient, history: any[] = []): Promise<IntentClassification> {
  const normalized = userInput.toLowerCase().trim();

  // Check cache first for performance
  const cached = intentCache.get(userInput, history?.length);
  if (cached) {
    console.log('[IntentClassifier] Cache hit - using cached classification');
    return cached;
  }

  // Quick context inheritance check for short affirmatives ONLY
  // This is the ONLY non-AI classification we allow
  if (isShortAffirmative(normalized) && history.length > 0) {
    const previousIntent = extractPreviousIntent(history);
    if (previousIntent) {
      const result = {
        intent: previousIntent,
        confidence: 0.95,
        reasoning: `Context inheritance: Short affirmative inheriting ${previousIntent} from previous message`
      };

      // Cache the result
      intentCache.set(userInput, history?.length, result);
      return result;
    }
  }

  // ALWAYS use AI agent for intent classification when available
  if (client) {
    try {
      const result = await classifyIntentAI(client, userInput, history);
      // Cache successful AI classifications
      if (result.confidence > 0.7) {
        intentCache.set(userInput, history?.length, result);
      }
      return result;
    } catch (err) {
      console.error(`[IntentClassifier] AI classification failed: ${err}. Using minimal fallback.`);
      // Only use fallback if AI completely fails
      return classifyIntentFallback(userInput, history);
    }
  }

  // Fallback when no AI client available (should be rare)
  console.warn('[IntentClassifier] No AI client available - using minimal fallback');
  const result = classifyIntentFallback(userInput, history);
  return result;
}

/**
 * Check if task is read-only (no mutations)
 */
export function isReadOnlyTask(intent: IntentType): boolean {
  return ['question', 'conversation'].includes(intent);
}
