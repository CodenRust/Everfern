"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memorySearchTool = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
function getMemoryPath() {
    return path_1.default.join(os_1.default.homedir(), '.everfern', 'memory.md');
}
function parseEntries(text) {
    const blocks = text.split(/\n---\s*\n/);
    const entries = [];
    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed || trimmed === '# EverFern Memory Bank')
            continue;
        const dateMatch = trimmed.match(/^## (.+)$/m);
        const contentMatch = trimmed.match(/\*\*Content:\*\*\s*(.+)/);
        const tagsMatch = trimmed.match(/\*\*Tags:\*\*\s*(.+)/);
        const prefMatch = trimmed.match(/\*\*Preference:\*\*\s*(.+)/);
        if (contentMatch) {
            entries.push({
                date: dateMatch ? dateMatch[1].trim() : '',
                content: contentMatch[1].trim(),
                tags: tagsMatch ? tagsMatch[1].trim() : '',
                preference: prefMatch ? prefMatch[1].trim() : '',
                raw: trimmed,
            });
        }
    }
    return entries;
}
function scoreEntry(entry, queryWords, query) {
    let score = 0;
    const lowerContent = entry.content.toLowerCase();
    const lowerTags = entry.tags.toLowerCase();
    const lowerQuery = query.toLowerCase();
    // Exact phrase match scores highest
    if (lowerContent.includes(lowerQuery))
        score += 10;
    if (lowerTags.includes(lowerQuery))
        score += 8;
    // Individual word matches
    for (const word of queryWords) {
        if (lowerContent.includes(word))
            score += 3;
        if (lowerTags.includes(word))
            score += 2;
        if (entry.preference.toLowerCase().includes(word))
            score += 1;
    }
    // Prefer more recent entries (weight by position since entries are newest-last)
    // We'll apply a small recency bonus based on array position later
    return score;
}
exports.memorySearchTool = {
    name: 'memory_search',
    description: 'Search local markdown memory file using keyword matching. Use this to recall past context, user facts, or prior files.',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query or keywords to find.' },
            limit: { type: 'number', description: 'Maximum number of results to return (default 5)' }
        },
        required: ['query']
    },
    async execute(args) {
        try {
            const query = (args.query || '').trim();
            const limit = args.limit || 5;
            if (!query)
                return { success: true, output: 'No query provided.' };
            const filePath = getMemoryPath();
            if (!fs_1.default.existsSync(filePath)) {
                return { success: true, output: 'No memories found. The memory file does not exist yet.' };
            }
            const text = fs_1.default.readFileSync(filePath, 'utf-8');
            const entries = parseEntries(text);
            if (entries.length === 0) {
                return { success: true, output: 'No memories found in the memory file.' };
            }
            const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            // Score and rank entries (reverse so newest entries get a bonus)
            const scored = entries.map((e, i) => ({
                entry: e,
                score: scoreEntry(e, queryWords, query) + (i / entries.length) * 0.5,
            }));
            const ranked = scored
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            if (ranked.length === 0) {
                return { success: true, output: 'No relevant memories found.' };
            }
            const output = ranked.map((r, i) => `[Result ${i + 1}] (Relevance: ${r.score.toFixed(2)})\nDate: ${r.entry.date}\n${r.entry.content}${r.entry.tags ? `\nTags: ${r.entry.tags}` : ''}${r.entry.preference ? `\nPreference: ${r.entry.preference}` : ''}`).join('\n\n');
            // Check if any result has a preference tag
            let hasPreference = false;
            let preferenceText = '';
            let preferenceType = '';
            for (const r of ranked) {
                if (r.entry.preference) {
                    hasPreference = true;
                    preferenceText = r.entry.content;
                    preferenceType = r.entry.preference;
                    break;
                }
            }
            return {
                success: true,
                output,
                data: { hasPreference, preferenceText, preferenceType, resultCount: ranked.length },
            };
        }
        catch (err) {
            return { success: false, output: `Failed to search memory: ${err.message}` };
        }
    }
};
