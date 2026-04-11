"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyIntentAI = classifyIntentAI;
exports.classifyIntentHeuristic = classifyIntentHeuristic;
exports.classifyIntent = classifyIntent;
exports.isReadOnlyTask = isReadOnlyTask;
// Intent classification signals
const INTENT_SIGNALS = {
    unknown: [],
    coding: [
        'write code', 'create function', 'fix bug', 'refactor', 'debug',
        'implement', 'create class', 'add method', 'write script', 'programming',
        'api', 'endpoint', 'database', 'query', 'schema'
    ],
    research: [
        'search', 'find information', 'lookup', 'what is', 'how does',
        'explain', 'research', 'investigate', 'analyze', 'compare'
    ],
    task: [
        'run command', 'create file', 'delete', 'download', 'generate report',
        'process', 'execute', 'automate', 'batch', 'install', 'configure'
    ],
    question: [
        'what', 'how', 'why', 'when', 'where', 'who', 'which',
        'explain', 'tell me', 'show me', 'give me', 'can you'
    ],
    conversation: [
        'hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'sorry'
    ],
    build: [
        'create', 'build', 'make', 'generate', 'scaffold', 'setup', 'initialize',
        'new project', 'new app', 'create app', 'build app', 'create website',
        'create component', 'generate report', 'generate dashboard'
    ],
    fix: [
        'fix', 'debug', 'repair', 'resolve', 'troubleshoot', 'error', 'bug',
        'broken', 'not working', 'failing', 'crash', 'issue', 'problem', 'wrong'
    ],
    analyze: [
        'analyze', 'analyse', 'analysis', 'insights', 'visualize', 'chart',
        'graph', 'statistics', 'metrics', 'dashboard', 'report', 'data',
        'csv', 'excel', 'dataset', 'trends', 'patterns', 'summarize'
    ],
    automate: [
        'automate', 'schedule', 'batch', 'pipeline', 'workflow', 'script',
        'recurring', 'every day', 'every week', 'cron', 'whenever', 'monitor',
        'watch', 'trigger', 'on change', 'background'
    ]
};
/**
 * Classify user intent using AI (Primary AGI Method)
 */
async function classifyIntentAI(client, userInput, history = []) {
    const lastMessages = history.slice(-3).map(m => `[${m.role.toUpperCase()}]: ${typeof m.content === 'string' ? m.content : 'Complex Content'}`).join('\n');
    const prompt = `You are the EverFern Triage Agent. Your job is to classify the user's input into the most appropriate category.

CATEGORIES:
- coding: Writing, refactoring, or debugging code/scripts.
- research: Web searching, looking up information, gathering data.
- task: General operations like running commands, managing files, or creating final reports.
- question: Direct informational questions (e.g., "What is React?").
- conversation: Greetings, small talk, or polite closures.
- build: Scaffolding new projects or entire applications.
- fix: Fixing specific errors, crashes, or broken features.
- analyze: Processing datasets, CSVs, or creating visualizations/dashboard.
- automate: Setting up schedules, pipelines, or recurring workflows.

CONTEXT (Recent turns):
${lastMessages || 'None'}

RESPONSE FORMAT (Strict JSON):
{
  "intent": "coding" | "research" | "task" | "question" | "conversation" | "build" | "fix" | "analyze" | "automate" | "unknown",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this category was chosen."
}

User Input: "${userInput}"`;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Triage AI call timed out')), 30000));
    try {
        const aiPromise = client.chat({
            messages: [{ role: 'system', content: prompt }],
            responseFormat: 'json',
            temperature: 0.1
        });
        const response = await Promise.race([aiPromise, timeoutPromise]);
        const data = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
        return {
            intent: (data.intent || 'unknown'),
            confidence: data.confidence || 0.5,
            reasoning: data.reasoning || 'AI Classified'
        };
    }
    catch (err) {
        console.error(`[TriageAgent] AI Classification failed or timed out: ${err}. Falling back to heuristics.`);
        return classifyIntentHeuristic(userInput);
    }
}
/**
 * Classify user intent based on message content (Heuristic Fallback)
 */
function classifyIntentHeuristic(userInput) {
    const normalized = userInput.toLowerCase().trim();
    const scores = {
        unknown: 0, coding: 0, research: 0, task: 0, question: 0, conversation: 0,
        build: 0, fix: 0, analyze: 0, automate: 0
    };
    for (const [intent, signals] of Object.entries(INTENT_SIGNALS)) {
        if (intent === 'unknown')
            continue;
        for (const signal of signals) {
            if (normalized.includes(signal)) {
                scores[intent] += 1;
            }
        }
    }
    // Special patterns
    if (/\b(function|class|const|let|var|import|export|def|async|public|private|void|return|interface|type)\b/.test(normalized)) {
        scores.coding += 3;
    }
    if (/\b(run|execute|launch|start|install|setup|configure)\b/.test(normalized)) {
        scores.task += 2;
    }
    if (/^(what|how|why|when|where|who|which|can|could|is|are)\b/i.test(normalized)) {
        scores.question += 2;
    }
    if (/^(hi|hello|hey|thanks|thank you|bye)\b/i.test(normalized)) {
        scores.conversation += 3;
    }
    const multiActionPatterns = [
        /\b(find|search).*\b(and|then|also)\b.*(find|search|analyze)\b/i,
        /\b(create|write).*\b(and|then|also)\b.*(create|write|run)\b/i,
        /\bmultiple\b.*\bfiles?\b/i,
        /\bfiles?\b.*\band\b.*\bfiles?\b/i,
        /\ball\b.*\b(of\s+)?the\b/i,
        /\b(analyze?|compare?|evaluate?).*\b(analyze?|compare?|evaluate?)\b/i,
    ];
    for (const pattern of multiActionPatterns) {
        if (pattern.test(normalized)) {
            scores.task += 2;
            scores.coding += 1;
        }
    }
    if (/\b(benchmark|test against|compare.*with|vs\.?|versus)\b/i.test(normalized)) {
        scores.research += 2;
    }
    if (/\b(algorithm|database|api|endpoint|microservice|architecture|design pattern)\b/i.test(normalized)) {
        scores.coding += 2;
    }
    if (/\b(create|build|make|generate|scaffold|initialize|setup)\b.{0,40}\b(app|project|website|dashboard|report|component|script)\b/i.test(normalized)) {
        scores.build += 4;
    }
    if (/\b(error|exception|traceback|undefined|null|crash|fails?|broken|not work|wrong)\b/i.test(normalized)) {
        scores.fix += 3;
    }
    if (/\b(csv|xlsx|data|dataset|dataframe|df\.|pandas|numpy|matplotlib|analyze|chart|graph|plot|dashboard|insights)\b/i.test(normalized)) {
        scores.analyze += 3;
    }
    if (/\b(automate|schedule|cron|every (day|week|hour|morning)|batch|pipeline|workflow|recurring)\b/i.test(normalized)) {
        scores.automate += 4;
    }
    let maxScore = 0;
    let maxIntent = 'task';
    for (const [intent, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            maxIntent = intent;
        }
    }
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? Math.min(1, maxScore / Math.max(totalScore, 1)) : 0;
    return {
        intent: maxIntent,
        confidence,
        reasoning: `Intent: ${maxIntent} (${Math.round(confidence * 100)}% confidence) [Heuristic]`
    };
}
/**
 * Unified Classify Intent (Heuristic-First Fast-Path)
 */
async function classifyIntent(userInput, client, history = []) {
    const normalized = userInput.toLowerCase().trim();
    // Fast-Path: Greetings and simple closures
    if (/^(hi|hello|hey|thanks|thank you|bye|goodbye|ok|okay|yes|no)$/.test(normalized) || normalized.length < 5) {
        return classifyIntentHeuristic(userInput);
    }
    if (client) {
        return classifyIntentAI(client, userInput, history);
    }
    return classifyIntentHeuristic(userInput);
}
/**
 * Check if task is read-only (no mutations)
 */
function isReadOnlyTask(intent) {
    return ['question', 'conversation'].includes(intent);
}
