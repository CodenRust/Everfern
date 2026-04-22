"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memorySearchTool = void 0;
const db_1 = require("../../lib/db");
const embeddings_1 = require("../../lib/embeddings");
const temporal_decay_1 = require("../../lib/temporal-decay");
exports.memorySearchTool = {
    name: 'memory_search',
    description: 'Search long-term local database memory using semantic vector similarity. Use this to recall past context, user facts, or prior files.',
    parameters: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'The search query or concept to find.' },
            limit: { type: 'number', description: 'Maximum number of chunks to return (default 5)' }
        },
        required: ['query']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        try {
            const query = args.query;
            const limit = args.limit || 5;
            const config = (0, embeddings_1.getSystemEmbeddingConfig)();
            const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
            await (0, db_1.ensureVectorTable)(dimensions);
            const queryVector = await embeddings.embedQuery(query);
            const vectorBuffer = Buffer.from(new Float32Array(queryVector).buffer);
            // Hybrid Query using sqlite-vec
            const rows = await db_1.dbOps.all(`
        SELECT
          m.id,
          m.text_content,
          m.metadata,
          vec_distance_cosine(v.embedding, ?) as distance
        FROM memory_chunks_vec v
        JOIN memory_chunks m ON v.id = m.id
        ORDER BY distance ASC
        LIMIT ?
      `, [vectorBuffer, limit * 2]);
            if (rows.length === 0) {
                return { success: true, output: 'No relevant memories found.' };
            }
            // Apply temporal decay — older memories score lower
            const decayable = rows.map((r) => {
                const meta = r.metadata ? JSON.parse(r.metadata) : {};
                return {
                    path: String(r.id),
                    score: 1 - r.distance, // Convert distance to similarity score (0..1)
                    timestamp: meta.timestamp || meta.createdAt || undefined,
                    text_content: r.text_content,
                    metadata: r.metadata,
                };
            });
            const decayed = (0, temporal_decay_1.applyDecayToResults)(decayable);
            // Re-sort by decayed score and take top `limit`
            const ranked = decayed
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            const output = ranked.map((r, i) => `[Result ${i + 1}] (Score: ${r.score.toFixed(3)})\n${r.text_content}\nMetadata: ${r.metadata || '{}'}`).join('\n\n');
            // Check if any results contain user preferences
            let hasPreference = false;
            let preferenceText = '';
            let preferenceType = '';
            for (const r of ranked) {
                try {
                    const meta = r.metadata ? JSON.parse(r.metadata) : {};
                    if (meta.isPreference === true) {
                        hasPreference = true;
                        preferenceText = r.text_content;
                        preferenceType = meta.preferenceType || 'general';
                        break; // Use the highest-ranked preference
                    }
                }
                catch (e) {
                    // Skip malformed metadata
                }
            }
            return {
                success: true,
                output,
                data: {
                    hasPreference,
                    preferenceText,
                    preferenceType,
                    resultCount: ranked.length
                }
            };
        }
        catch (err) {
            return { success: false, output: `Failed to search memory: ${err.message}` };
        }
    }
};
