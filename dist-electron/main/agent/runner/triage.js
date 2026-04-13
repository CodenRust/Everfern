"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIntentAI = classifyIntentAI;
exports.classifyIntentFallback = classifyIntentFallback;
exports.classifyIntent = classifyIntent;
exports.isReadOnlyTask = isReadOnlyTask;
// Intent classification will be handled by AI agent - no hardcoded signals needed
const message_utils_1 = require("./services/message-utils");
class IntentCache {
    cache = new Map();
    maxSize = 1000;
    maxAge = 300000; // 5 minutes
    hashInput(input, historyLength) {
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
    get(input, historyLength) {
        const key = this.hashInput(input, historyLength);
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        // Check if entry is still valid
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }
        return entry.classification;
    }
    set(input, historyLength, classification) {
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
    cleanup() {
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
function isShortAffirmative(message) {
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
function hasFileAttachment(message) {
    if (!message || !message.content)
        return false;
    // Handle array content (mixed text and file)
    if (Array.isArray(message.content)) {
        return message.content.some((item) => item.type === 'file' ||
            (typeof item === 'object' && (item.name || item.path || item.file)));
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
function hasSubstantiveContent(message) {
    if (!message || !message.content)
        return false;
    let content = '';
    if (Array.isArray(message.content)) {
        content = message.content
            .filter((item) => item.type === 'text' || typeof item === 'string')
            .map((item) => typeof item === 'string' ? item : item.text || '')
            .join(' ');
    }
    else if (typeof message.content === 'string') {
        content = message.content;
    }
    else if (typeof message.content === 'object' && message.content.text) {
        content = message.content.text;
    }
    // Consider it substantive if it's longer than a typical greeting
    return content.trim().length > 20;
}
/**
 * Extract the previous intent from conversation history
 */
function extractPreviousIntent(history) {
    if (!history || history.length === 0)
        return null;
    // Find the last user message (excluding the current one)
    const userMessages = history.filter((msg) => msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human');
    if (userMessages.length < 1)
        return null;
    // Get the previous user message (second to last)
    const previousUserMsg = userMessages[userMessages.length - 1];
    if (!previousUserMsg)
        return null;
    // Check for file attachments first - strong signal for intent
    if (hasFileAttachment(previousUserMsg)) {
        let content = '';
        if (Array.isArray(previousUserMsg.content)) {
            // Extract text content from mixed content
            content = previousUserMsg.content
                .filter((item) => item.type === 'text' || typeof item === 'string')
                .map((item) => typeof item === 'string' ? item : item.text || '')
                .join(' ');
            // Check file types for intent hints
            const files = previousUserMsg.content.filter((item) => item.type === 'file');
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
/**
 * AI-powered intent classification agent
 * This is a proper LangGraph-style agent that uses AI to classify user intent
 * without relying on hardcoded keyword matching
 */
async function classifyIntentAI(client, userInput, history = []) {
    const normalizedHistory = (0, message_utils_1.normalizeMessages)(history);
    const lastMessages = normalizedHistory.slice(-5).map(m => {
        const role = m.role.toUpperCase();
        let content = '';
        if (typeof m.content === 'string') {
            content = m.content.slice(0, 200); // Limit content length for context
        }
        else if (Array.isArray(m.content)) {
            const textParts = m.content.filter((item) => item.type === 'text' || typeof item === 'string');
            content = textParts.map((item) => typeof item === 'string' ? item : item.text || '').join(' ').slice(0, 200);
            // Detect file attachments
            const hasFiles = m.content.some((item) => item.type === 'file' || item.type === 'image_url');
            if (hasFiles) {
                content += ' [FILE ATTACHED]';
            }
        }
        return `[${role}]: ${content}`;
    }).join('\n');
    const prompt = `You are an intelligent Intent Classification Agent for an AI coding assistant. Your job is to analyze user input and classify it into the most appropriate category based on semantic meaning, context, and conversation history.

AVAILABLE INTENTS:
- coding: Writing, refactoring, debugging code/scripts, implementing features, code review
- research: Web searching, information gathering, investigating topics, looking up documentation
- task: General operations (file management, shell commands, system tasks, file operations)
- question: Direct informational questions requiring factual answers (what, how, why questions)
- conversation: Greetings, social interaction, polite exchanges, acknowledgments
- build: Creating new projects, scaffolding applications, generating project structures
- fix: Fixing bugs, resolving errors, troubleshooting issues, debugging problems
- analyze: Data analysis, visualization, processing datasets/files, reviewing data
- automate: Setting up workflows, schedules, recurring processes, automation scripts

CLASSIFICATION STRATEGY:
1. **Context Inheritance**: If the user input is a short affirmative response (yes, ok, proceed, continue, sure, go ahead, looks good, etc.) AND there's a clear previous intent in the conversation history, inherit that intent rather than classifying as 'conversation'.

2. **File Context**: If recent messages contain file attachments:
   - CSV/Excel/JSON/data files → likely 'analyze'
   - Code files (.ts, .js, .py, etc.) → likely 'coding'
   - Configuration files → likely 'task' or 'build'

3. **Semantic Analysis**: Focus on the semantic meaning and user's goal, not just keyword matching. Consider:
   - What is the user trying to accomplish?
   - What action or outcome do they want?
   - What domain does this fall into?

4. **Conversation Flow**: Consider the conversation flow and previous exchanges to understand context.

CONVERSATION HISTORY (last 5 messages):
${lastMessages || 'None'}

CURRENT USER INPUT: "${userInput}"

Analyze the input semantically and provide your classification in JSON format:
{
  "intent": "coding|research|task|question|conversation|build|fix|analyze|automate",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why you chose this intent, including context inheritance if applicable"
}

IMPORTANT:
- Use semantic understanding, not keyword matching
- Consider conversation context and file attachments
- For short affirmatives, check if you should inherit the previous intent
- Be confident in your classification (aim for 0.8+ confidence when clear)`;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Intent classification timed out')), 3000));
    try {
        const aiPromise = client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 500
        });
        const response = await Promise.race([aiPromise, timeoutPromise]);
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const data = JSON.parse(content);
        return {
            intent: (data.intent || 'task'),
            confidence: data.confidence || 0.7,
            reasoning: data.reasoning || 'AI Intent Classification'
        };
    }
    catch (err) {
        console.error(`[IntentAgent] AI Classification failed: ${err}. Using fallback.`);
        return classifyIntentFallback(userInput, history);
    }
}
/**
 * Fallback intent classification (when AI fails)
 * Uses minimal heuristics - should rarely be used
 * ALWAYS prefer AI classification over this fallback
 */
function classifyIntentFallback(userInput, history = []) {
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
    // Absolute minimal fallback - only for when AI is completely unavailable
    // Default to conversation for very short inputs (likely greetings)
    if (normalized.length < 15) {
        return {
            intent: 'conversation',
            confidence: 0.6,
            reasoning: 'Fallback: Short input without AI classification'
        };
    }
    // Default to task for anything else - AI should handle proper classification
    return {
        intent: 'task',
        confidence: 0.4,
        reasoning: 'Fallback: AI classification unavailable - defaulting to task'
    };
}
/**
 * Main intent classification function - AI-first approach with caching
 * ALWAYS uses AI for classification when available
 */
async function classifyIntent(userInput, client, history = []) {
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
        }
        catch (err) {
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
function isReadOnlyTask(intent) {
    return ['question', 'conversation'].includes(intent);
}
