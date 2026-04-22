"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memorySaveTool = void 0;
const db_1 = require("../../lib/db");
const embeddings_1 = require("../../lib/embeddings");
exports.memorySaveTool = {
    name: 'memory_save',
    description: 'Save important facts, user preferences, or context into long-term local database memory.',
    parameters: {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'The core textual content or fact to memorize.' },
            metadata: { type: 'string', description: 'Optional tags or relationships as a JSON string.' }
        },
        required: ['content']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        try {
            const content = args.content;
            const metadata = args.metadata;
            const config = (0, embeddings_1.getSystemEmbeddingConfig)();
            const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
            await (0, db_1.ensureVectorTable)(dimensions);
            // 1. Generate Embedding
            const vector = await embeddings.embedQuery(content);
            const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
            // 2. Auto-detect if this is a user preference/choice
            const isPreference = detectPreference(content);
            // 3. Merge metadata with preference tag
            let finalMetadata = metadata ? JSON.parse(metadata) : {};
            if (isPreference) {
                finalMetadata.isPreference = true;
                finalMetadata.preferenceType = classifyPreferenceType(content);
            }
            finalMetadata.timestamp = Date.now();
            const metadataStr = JSON.stringify(finalMetadata);
            // 4. Insert into memory_chunks
            const chunkId = `memory-${Date.now()}-${Math.floor(Math.random() * (10 ** 6))}`;
            await db_1.dbOps.run(`
        INSERT INTO memory_chunks (id, text_content, metadata)
        VALUES (?, ?, ?)
      `, [chunkId, content, metadataStr]);
            // 5. Insert exact vector array into vec0
            await db_1.dbOps.run(`
        INSERT INTO memory_chunks_vec (id, embedding)
        VALUES (?, ?)
      `, [chunkId, vectorBuffer]);
            return {
                success: true,
                output: `Successfully saved memory chunk: "${content.substring(0, 50)}..."${isPreference ? ' [Tagged as user preference]' : ''}`
            };
        }
        catch (err) {
            return { success: false, output: `Failed to save memory: ${err.message}` };
        }
    }
};
/**
 * Detect if content represents a user preference, choice, or behavioral pattern
 */
function detectPreference(content) {
    const lower = content.toLowerCase();
    // Strong preference indicators
    const strongIndicators = [
        /\bprefer(s|red|ence)?\b/,
        /\bchoose(s|chose|choice)?\b/,
        /\bselect(s|ed|ion)?\b/,
        /\blike(s|d)?\s+(to|using|when)\b/,
        /\bwant(s|ed)?\s+(to|me to)\b/,
        /\balways\s+(use|do|want|prefer)/,
        /\busually\s+(use|do|want|prefer)/,
        /\btypically\s+(use|do|want|prefer)/,
        /\bdefault\s+(to|is|should be)/,
        /\bfavorite\b/,
        /\bgo-to\b/,
    ];
    // Weak indicators (need multiple or context)
    const weakIndicators = [
        /\bshould\s+(always|use|do)\b/,
        /\bdon't\s+(like|want|use)\b/,
        /\bavoid\b/,
        /\bnever\s+(use|do|want)\b/,
    ];
    // Check strong indicators
    if (strongIndicators.some(pattern => pattern.test(lower))) {
        return true;
    }
    // Check weak indicators (need at least 2)
    const weakMatches = weakIndicators.filter(pattern => pattern.test(lower)).length;
    if (weakMatches >= 2) {
        return true;
    }
    return false;
}
/**
 * Classify the type of preference for better UX
 */
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
