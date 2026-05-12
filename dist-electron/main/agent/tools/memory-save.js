"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memorySaveTool = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
function getMemoryPath() {
    const dir = path_1.default.join(os_1.default.homedir(), '.everfern');
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return path_1.default.join(dir, 'memory.md');
}
function detectPreference(content) {
    const lower = content.toLowerCase();
    const strongIndicators = [
        /\bprefer(s|red|ence)?\b/, /\bchoose(s|chose|choice)?\b/,
        /\bselect(s|ed|ion)?\b/, /\blike(s|d)?\s+(to|using|when)\b/,
        /\bwant(s|ed)?\s+(to|me to)\b/, /\balways\s+(use|do|want|prefer)/,
        /\busually\s+(use|do|want|prefer)/, /\btypically\s+(use|do|want|prefer)/,
        /\bdefault\s+(to|is|should be)/, /\bfavorite\b/, /\bgo-to\b/,
    ];
    const weakIndicators = [
        /\bshould\s+(always|use|do)\b/, /\bdon't\s+(like|want|use)\b/,
        /\bavoid\b/, /\bnever\s+(use|do|want)\b/,
    ];
    if (strongIndicators.some(p => p.test(lower)))
        return true;
    return weakIndicators.filter(p => p.test(lower)).length >= 2;
}
function classifyPreferenceType(content) {
    const lower = content.toLowerCase();
    if (/\b(format|style|layout|design|theme|color)\b/.test(lower))
        return 'formatting';
    if (/\b(report|output|display|show|view)\b/.test(lower))
        return 'output';
    if (/\b(workflow|process|approach|method|way)\b/.test(lower))
        return 'workflow';
    if (/\b(tool|library|framework|language|tech)\b/.test(lower))
        return 'technology';
    if (/\b(communication|notify|alert|message)\b/.test(lower))
        return 'communication';
    return 'general';
}
exports.memorySaveTool = {
    name: 'memory_save',
    description: 'Save important facts, user preferences, or context into a local markdown memory file.',
    parameters: {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'The core textual content or fact to memorize.' },
            tags: { type: 'string', description: 'Optional comma-separated tags for grouping.' }
        },
        required: ['content']
    },
    async execute(args) {
        try {
            const content = (args.content || '').trim();
            if (!content)
                return { success: false, output: 'No content provided.' };
            const tags = args.tags || '';
            const now = new Date();
            const dateStr = now.toDateString() + ' ' + now.toLocaleTimeString();
            const isPreference = detectPreference(content);
            const prefType = isPreference ? classifyPreferenceType(content) : '';
            const tagLine = tags ? `**Tags:** ${tags}` : '';
            const prefLine = isPreference ? `**Preference:** ${prefType}` : '';
            const entry = [
                '',
                `## ${dateStr}`,
                '',
                `**Content:** ${content}`,
                tagLine,
                prefLine,
                '---',
            ].filter(l => l).join('\n') + '\n';
            const filePath = getMemoryPath();
            if (!fs_1.default.existsSync(filePath)) {
                fs_1.default.writeFileSync(filePath, `# EverFern Memory Bank\n\n`);
            }
            fs_1.default.appendFileSync(filePath, entry, 'utf-8');
            const suffix = isPreference ? ` [Tagged as ${prefType} preference]` : '';
            return {
                success: true,
                output: `Saved memory chunk: "${content.substring(0, 50)}..."${suffix}`,
            };
        }
        catch (err) {
            return { success: false, output: `Failed to save memory: ${err.message}` };
        }
    }
};
