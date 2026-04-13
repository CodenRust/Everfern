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
    async execute(args) {
        try {
            const content = args.content;
            const metadata = args.metadata;
            const config = (0, embeddings_1.getSystemEmbeddingConfig)();
            const { embeddings, dimensions } = (0, embeddings_1.getEmbeddingModel)(config);
            await (0, db_1.ensureVectorTable)(dimensions);
            // 1. Generate Embedding
            const vector = await embeddings.embedQuery(content);
            const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
            // 2. Insert into memory_chunks
            const chunkId = `memory-${Date.now()}-${Math.floor(Math.random() * (10 ** 6))}`;
            await db_1.dbOps.run(`
        INSERT INTO memory_chunks (id, text_content, metadata) 
        VALUES (?, ?, ?)
      `, [chunkId, content, metadata || null]);
            // 3. Insert exact vector array into vec0
            await db_1.dbOps.run(`
        INSERT INTO memory_chunks_vec (id, embedding)
        VALUES (?, ?)
      `, [chunkId, vectorBuffer]);
            return {
                success: true,
                output: `Successfully saved memory chunk: "${content.substring(0, 50)}..."`
            };
        }
        catch (err) {
            return { success: false, output: `Failed to save memory: ${err.message}` };
        }
    }
};
