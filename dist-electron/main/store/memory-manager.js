"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningMemoryManager = exports.LearningMemoryManager = void 0;
exports.reflectAndRemember = reflectAndRemember;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const MEMORY_FILE_PATH = path.join(os.homedir(), '.everfern', 'MEMORY.md');
const LEARNING_DB_PATH = path.join(os.homedir(), '.everfern', 'learning.json');
// Signals that indicate the agent failed or didn't actually do anything useful
const FAILURE_SIGNALS = [
    'cannot_proceed',
    'cannot proceed',
    'task failed',
    'error occurred',
    'i was unable',
    'i could not',
    'i cannot',
    'i don\'t have',
    'i do not have',
    'token limit',
    'response was cut off',
    'technical failure',
    'timed out',
    'no_new_memory',
    '[error:',
    '❌',
    '🛑 stopped by user',
];
// Signals that indicate the agent actually completed something meaningful
const SUCCESS_SIGNALS = [
    'created',
    'generated',
    'written',
    'saved',
    'completed',
    'analyzed',
    'processed',
    'built',
    'fixed',
    'updated',
    'installed',
    'deployed',
    'executed',
    'found',
    'downloaded',
];
function isSuccessfulInteraction(userInput, response) {
    const combined = (userInput + ' ' + response).toLowerCase();
    // Skip if response is empty or very short (nothing happened)
    if (!response || response.trim().length < 50)
        return false;
    // Skip if response contains failure signals
    for (const signal of FAILURE_SIGNALS) {
        if (combined.includes(signal.toLowerCase()))
            return false;
    }
    // Only store if response contains success signals
    return SUCCESS_SIGNALS.some(signal => combined.includes(signal));
}
/**
 * Learning Memory Manager - Extends existing memory system with learning capabilities
 */
class LearningMemoryManager {
    learningData = new Map();
    initialized = false;
    constructor() {
        this.initializeLearningStorage();
    }
    async initializeLearningStorage() {
        try {
            const dir = path.dirname(LEARNING_DB_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (fs.existsSync(LEARNING_DB_PATH)) {
                const data = fs.readFileSync(LEARNING_DB_PATH, 'utf8');
                const parsed = JSON.parse(data);
                for (const [id, knowledge] of Object.entries(parsed)) {
                    this.learningData.set(id, knowledge);
                }
            }
            this.initialized = true;
            console.log('[Learning Memory] 🧠 Learning storage initialized');
        }
        catch (error) {
            console.error('[Learning Memory] ❌ Failed to initialize learning storage:', error);
        }
    }
    async persistLearningData() {
        try {
            const data = Object.fromEntries(this.learningData);
            fs.writeFileSync(LEARNING_DB_PATH, JSON.stringify(data, null, 2));
        }
        catch (error) {
            console.error('[Learning Memory] ❌ Failed to persist learning data:', error);
        }
    }
    async storeLearning(knowledge) {
        if (!this.initialized) {
            await this.initializeLearningStorage();
        }
        this.learningData.set(knowledge.id, knowledge);
        await this.persistLearningData();
        console.log(`[Learning Memory] 📚 Stored learning: ${knowledge.type} - ${knowledge.content.substring(0, 50)}...`);
    }
    async retrieveLearning(query, limit = 10) {
        if (!this.initialized) {
            await this.initializeLearningStorage();
        }
        const queryLower = query.toLowerCase();
        const results = [];
        for (const knowledge of this.learningData.values()) {
            let score = 0;
            // Content matching
            if (knowledge.content.toLowerCase().includes(queryLower))
                score += 3;
            if (knowledge.context.toLowerCase().includes(queryLower))
                score += 2;
            // Applicability conditions matching
            for (const condition of knowledge.applicabilityConditions) {
                if (condition.toLowerCase().includes(queryLower))
                    score += 2;
            }
            // Metadata matching
            if (knowledge.metadata.domain?.toLowerCase().includes(queryLower))
                score += 1;
            if (knowledge.metadata.toolsInvolved?.some(tool => tool.toLowerCase().includes(queryLower)))
                score += 1;
            // Boost score by confidence and frequency
            score *= knowledge.confidence * Math.log(knowledge.frequency + 1);
            if (score > 0) {
                results.push({ knowledge, score });
            }
        }
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(r => r.knowledge);
    }
    async updateLearningConfidence(id, delta) {
        const knowledge = this.learningData.get(id);
        if (knowledge) {
            knowledge.confidence = Math.max(0, Math.min(1, knowledge.confidence + delta));
            knowledge.lastUsed = new Date();
            knowledge.frequency += 1;
            await this.persistLearningData();
        }
    }
    async pruneLowConfidenceKnowledge(threshold) {
        const toRemove = [];
        for (const [id, knowledge] of this.learningData) {
            if (knowledge.confidence < threshold) {
                toRemove.push(id);
            }
        }
        for (const id of toRemove) {
            this.learningData.delete(id);
        }
        if (toRemove.length > 0) {
            await this.persistLearningData();
            console.log(`[Learning Memory] 🧹 Pruned ${toRemove.length} low-confidence knowledge entries`);
        }
    }
    async queryUserPreferences(userId) {
        if (!this.initialized) {
            await this.initializeLearningStorage();
        }
        return Array.from(this.learningData.values())
            .filter(knowledge => knowledge.type === 'preference' ||
            knowledge.metadata.userPreference === true)
            .sort((a, b) => b.confidence - a.confidence);
    }
    // Get all learning data for debugging/transparency
    async getAllLearning() {
        if (!this.initialized) {
            await this.initializeLearningStorage();
        }
        return Array.from(this.learningData.values());
    }
    // Clear all learning data (for user control)
    async clearAllLearning() {
        this.learningData.clear();
        await this.persistLearningData();
        console.log('[Learning Memory] 🗑️ All learning data cleared');
    }
}
exports.LearningMemoryManager = LearningMemoryManager;
// Global instance for learning memory
exports.learningMemoryManager = new LearningMemoryManager();
/**
 * Non-blocking memory reflection.
 * Only stores memories when the agent actually accomplished something meaningful.
 * Skips errors, failures, and "cannot proceed" states to avoid polluting memory.
 */
function reflectAndRemember(history, userInput, response, client) {
    // Coerce userInput to string early — it may be ContentPart[] when attachments are present
    const safeInput = typeof userInput === 'string'
        ? userInput
        : Array.isArray(userInput)
            ? userInput.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join(' ')
            : String(userInput ?? '');
    // Skip reflection entirely if the interaction wasn't successful
    if (!isSuccessfulInteraction(safeInput, response)) {
        console.log('[Memory] ⏭️ Skipping reflection — no meaningful work was done or errors occurred');
        return;
    }
    // Fire and forget - do not await
    (async () => {
        try {
            const prompt = `Analyze this SUCCESSFUL interaction and extract ONLY durable user preferences or project facts for long-term memory.

STRICT RULES — ONLY store these categories:
✅ User preferences: coding style, preferred tools, languages, formatting choices, communication style
✅ User personal facts: name, role, timezone, recurring workflows

NEVER store any of these — they are session-specific and will cause confusion in future chats:
❌ What files were created, generated, or saved (e.g. "report.html was created at C:\\...")
❌ File paths, artifact locations, or directory structures
❌ What the agent built, analyzed, or delivered in this session
❌ Task results, data summaries, or report contents
❌ Project architecture details tied to a specific task
❌ Anything that implies a task was "already done" for future sessions

If nothing from the ✅ categories was learned, respond with "NO_NEW_MEMORY".

Interaction:
User: "${safeInput.substring(0, 500)}"
Assistant: "${response.substring(0, 800)}..."

Respond with ONLY new memory entries in Markdown bullet format, or "NO_NEW_MEMORY".`;
            const analysis = await client.chat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                maxTokens: 300,
            });
            const content = typeof analysis.content === 'string' ? analysis.content : '';
            if (!content || content.trim().toUpperCase().includes('NO_NEW_MEMORY'))
                return;
            // Strip any lines that snuck through containing file paths, artifact locations, or task results
            const PATH_PATTERNS = [
                /c:\\[^\s]*/gi, // Windows absolute paths
                /\.everfern[^\s]*/gi, // .everfern directory references
                /artifacts[^\s]*/gi, // artifact paths
                /\.html\b/gi, // HTML file references
                /\.py\b/gi, // Python file references
                /what worked:/gi, // "What Worked" sections
                /project architecture:/gi, // "Project Architecture" sections
                /successfully deliver/gi, // task result language
                /report.*generated/gi, // report generation results
                /file.*saved/gi, // file save results
            ];
            const filteredLines = content.split('\n').filter(line => {
                const lower = line.toLowerCase();
                return !PATH_PATTERNS.some(p => p.test(line)) &&
                    !lower.includes('c:\\') &&
                    !lower.includes('.everfern') &&
                    !lower.includes('artifact') &&
                    !lower.includes('was generated') &&
                    !lower.includes('was created') &&
                    !lower.includes('was saved') &&
                    !lower.includes('was built') &&
                    !lower.includes('report.html') &&
                    !lower.includes('file path');
            });
            const filteredContent = filteredLines.join('\n').trim();
            if (!filteredContent || filteredContent.toUpperCase().includes('NO_NEW_MEMORY'))
                return;
            const timestamp = new Date().toISOString().split('T')[0];
            const entry = `\n\n### ${timestamp}\n${content}`;
            const dir = path.dirname(MEMORY_FILE_PATH);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(MEMORY_FILE_PATH, entry);
            console.log('[Memory] 🧠 User preference/project fact logged to MEMORY.md');
        }
        catch (err) {
            console.error('[Memory] ❌ Reflection failed:', err);
        }
    })();
}
