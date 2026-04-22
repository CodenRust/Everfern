"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIntentFallback = classifyIntentFallback;
exports.classifyIntent = classifyIntent;
exports.isReadOnlyTask = isReadOnlyTask;
const message_utils_1 = require("./services/message-utils");
class IntentCache {
    cache = new Map();
    maxSize = 500;
    maxAge = 300000; // 5 minutes
    key(input, historyLength) {
        const ctx = `${input}:${historyLength}`;
        let hash = 0;
        for (let i = 0; i < ctx.length; i++) {
            hash = ((hash << 5) - hash) + ctx.charCodeAt(i);
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    get(input, historyLength) {
        const entry = this.cache.get(this.key(input, historyLength));
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(this.key(input, historyLength));
            return null;
        }
        return entry.classification;
    }
    set(input, historyLength, classification) {
        if (this.cache.size >= this.maxSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest)
                this.cache.delete(oldest);
        }
        this.cache.set(this.key(input, historyLength), { classification, timestamp: Date.now() });
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.maxAge)
                this.cache.delete(key);
        }
    }
}
const intentCache = new IntentCache();
setInterval(() => intentCache.cleanup(), 120000);
// ── Triage AI Prompt ─────────────────────────────────────────────────
const TRIAGE_SYSTEM_PROMPT = `You are a precise intent classifier for an AI assistant. Your only job is to classify the user's request into exactly one intent category.

INTENT CATEGORIES:
- coding     → Write, edit, refactor, debug, or review code; implement features; create scripts
- fix        → Fix a bug, error, crash, or broken behavior in existing code or systems
- build      → Scaffold a new project, app, repo, or template from scratch
- analyze    → Analyze data, files, documents, images, or CSV/Excel; generate reports, charts, visualizations
- research   → Search the web, look up information, investigate a topic, find documentation
- automate   → Control the GUI, click buttons, open/close apps, interact with the desktop or screen
- question   → Answer a factual question, explain a concept, provide information
- conversation → Greetings, small talk, acknowledgments, follow-ups with no clear task
- task       → General task that doesn't fit the above categories

CLASSIFICATION RULES:
1. Base your decision on the FULL meaning of the request, not individual words
2. "visual report", "chart", "graph", "dashboard" from data → analyze
3. "open app", "click", "type in", "drag", "GUI" → automate
4. File attachments: .csv/.xlsx/.json/data files → analyze; .ts/.js/.py/code files → coding
5. Short affirmatives (yes/ok/proceed/sure/go ahead) → inherit the previous intent from history
6. When in doubt, prefer task over automate — automate is ONLY for actual GUI/screen interaction

Respond with JSON only. No explanation outside the JSON.`;
const TRIAGE_USER_TEMPLATE = (userInput, historySnippet) => `
CONVERSATION HISTORY (last 5 messages):
${historySnippet || 'None'}

CURRENT USER REQUEST:
"${userInput}"

Classify the intent. JSON format:
{"intent":"<category>","confidence":<0.0-1.0>,"reasoning":"<one sentence>"}`;
// ── Fallback (no AI available) ────────────────────────────────────────
function classifyIntentFallback(userInput, history = []) {
    const normalized = userInput.toLowerCase().trim();
    // Short affirmatives — inherit from history
    const affirmatives = ['yes', 'ok', 'okay', 'proceed', 'continue', 'sure', 'go ahead', 'yep', 'yeah'];
    if (normalized.length < 20 && affirmatives.some(a => normalized === a || normalized.startsWith(a + ' '))) {
        // Try to find previous intent from history
        const userMsgs = (history || []).filter((m) => m.role === 'user' || m.type === 'human');
        if (userMsgs.length > 1) {
            return { intent: 'task', confidence: 0.7, reasoning: 'Fallback: short affirmative, defaulting to task' };
        }
    }
    // File attachment context
    const hasDataFile = /\.(csv|xlsx|xls|json|parquet|tsv)\b/i.test(normalized);
    const hasCodeFile = /\.(ts|js|tsx|jsx|py|java|cpp|c|php|rb|go|rs)\b/i.test(normalized);
    if (hasDataFile)
        return { intent: 'analyze', confidence: 0.75, reasoning: 'Fallback: data file detected' };
    if (hasCodeFile)
        return { intent: 'coding', confidence: 0.75, reasoning: 'Fallback: code file detected' };
    // Question patterns
    if (/^(what|how|why|when|where|which|who|can you explain|tell me about)\b/.test(normalized)) {
        return { intent: 'question', confidence: 0.75, reasoning: 'Fallback: question pattern' };
    }
    // Greetings
    if (/^(hi|hello|hey|good morning|good afternoon|thanks|thank you|bye)\b/.test(normalized) && normalized.length < 30) {
        return { intent: 'conversation', confidence: 0.85, reasoning: 'Fallback: greeting' };
    }
    // Default
    return { intent: 'task', confidence: 0.5, reasoning: 'Fallback: no clear pattern' };
}
// ── Main AI Classification ────────────────────────────────────────────
async function classifyIntent(userInput, client, history = []) {
    const historyLength = history?.length ?? 0;
    // Cache check
    const cached = intentCache.get(userInput, historyLength);
    if (cached) {
        console.log('[IntentAgent] Cache hit');
        return cached;
    }
    if (!client) {
        console.warn('[IntentAgent] No AI client — using fallback');
        return classifyIntentFallback(userInput, history);
    }
    // Build history snippet (last 5 messages, text only)
    const normalized = (0, message_utils_1.normalizeMessages)(history);
    const historySnippet = normalized.slice(-5).map(m => {
        const role = (m.role || 'user').toUpperCase();
        let content = '';
        if (typeof m.content === 'string') {
            content = m.content.slice(0, 200);
        }
        else if (Array.isArray(m.content)) {
            const textParts = m.content.filter((item) => item.type === 'text' || typeof item === 'string');
            content = textParts.map((item) => typeof item === 'string' ? item : item.text || '').join(' ').slice(0, 200);
            const hasFiles = m.content.some((item) => item.type === 'file' || item.type === 'image_url');
            if (hasFiles)
                content += ' [FILE ATTACHED]';
        }
        return `[${role}]: ${content}`;
    }).join('\n');
    try {
        const timeoutMs = 8000;
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Intent classification timed out')), timeoutMs));
        const response = await Promise.race([
            client.chat({
                messages: [
                    { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
                    { role: 'user', content: TRIAGE_USER_TEMPLATE(userInput, historySnippet) },
                ],
                responseFormat: 'json',
                temperature: 0.0,
                maxTokens: 100,
            }),
            timeoutPromise,
        ]);
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        console.log(`[IntentAgent] Raw AI response: ${content.slice(0, 300)}`);
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const data = JSON.parse(content);
        const result = {
            intent: (data.intent || 'task'),
            confidence: typeof data.confidence === 'number' ? data.confidence : 0.7,
            reasoning: data.reasoning || 'AI classification',
        };
        if (result.confidence > 0.6) {
            intentCache.set(userInput, historyLength, result);
        }
        return result;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[IntentAgent] AI classification failed: ${msg}. Using fallback.`);
        const fallback = classifyIntentFallback(userInput, history);
        return { ...fallback, reasoning: `Fallback (AI error: ${msg})` };
    }
}
/**
 * Check if task is read-only (no mutations)
 */
function isReadOnlyTask(intent) {
    return ['question', 'conversation'].includes(intent);
}
