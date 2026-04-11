import { AgentTool, ToolResult } from '../runner/types';
import { dbOps, ensureVectorTable } from '../../lib/db';
import { getEmbeddingModel, EmbeddingConfig, getSystemEmbeddingConfig } from '../../lib/embeddings';

export const memorySaveTool: AgentTool = {
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
  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const content = args.content as string;
      const metadata = args.metadata as string | undefined;

      const config = getSystemEmbeddingConfig(); 
      const { embeddings, dimensions } = getEmbeddingModel(config);

      await ensureVectorTable(dimensions);

      // 1. Generate Embedding
      const vector = await embeddings.embedQuery(content);
      const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

      // 2. Insert into memory_chunks
      const chunkId = `memory-${Date.now()}-${Math.floor(Math.random()*(10**6))}`;
      
      await dbOps.run(`
        INSERT INTO memory_chunks (id, text_content, metadata) 
        VALUES (?, ?, ?)
      `, [chunkId, content, metadata || null]);

      // 3. Insert exact vector array into vec0
      await dbOps.run(`
        INSERT INTO memory_chunks_vec (id, embedding)
        VALUES (?, ?)
      `, [chunkId, vectorBuffer]);

      return {
        success: true,
        output: `Successfully saved memory chunk: "${content.substring(0, 50)}..."`
      };
    } catch (err: any) {
      return { success: false, output: `Failed to save memory: ${err.message}` };
    }
  }
};
