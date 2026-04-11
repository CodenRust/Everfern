import { dbOps, ensureVectorTable } from './db';
import { getEmbeddingModel, EmbeddingConfig, getSystemEmbeddingConfig } from './embeddings';
import { ChatResponse } from './ai-client';
import crypto from 'crypto';

const SIMILARITY_THRESHOLD = 0.96;

let isCacheDisabled = false;

export async function lookupCache(prompt: string): Promise<ChatResponse | null> {
  if (isCacheDisabled) return null;

  try {
    const config = getSystemEmbeddingConfig();
    const { embeddings, dimensions } = getEmbeddingModel(config);

    await ensureVectorTable(dimensions);

    const promptVector = await embeddings.embedQuery(prompt);
    const vectorBuffer = Buffer.from(new Float32Array(promptVector).buffer);

    const row = await dbOps.get('SELECT c.response_json, vec_distance_cosine(v.embedding, ?) as distance FROM semantic_cache_vec v JOIN semantic_cache c ON v.id = c.id WHERE distance < ? ORDER BY distance ASC LIMIT 1', [vectorBuffer, 1 - SIMILARITY_THRESHOLD]);

    if (row) {
      const score = (1 - row.distance).toFixed(4);
      console.log('[Optima] Semantic Cache Hit! (Score: ' + score + ')');
      return JSON.parse(row.response_json) as ChatResponse;
    }
  } catch (err) {
    const isConnectionError = err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'));
    if (isConnectionError) {
      console.warn('[Optima] Semantic cache disabled for this session because the embedding server is unreachable.');
      isCacheDisabled = true;
    } else {
      console.warn('[Optima] Cache lookup failed', err);
    }
  }
  return null;
}

export async function saveCache(prompt: string, response: ChatResponse) {
  if (isCacheDisabled) return;

  try {
    const config = getSystemEmbeddingConfig();
    const { embeddings, dimensions } = getEmbeddingModel(config);

    await ensureVectorTable(dimensions);

    const id = crypto.createHash('sha256').update(prompt).digest('hex');
    const promptVector = await embeddings.embedQuery(prompt);
    const vectorBuffer = Buffer.from(new Float32Array(promptVector).buffer);

    await dbOps.run('BEGIN TRANSACTION');
    try {
      await dbOps.run('INSERT OR REPLACE INTO semantic_cache (id, prompt_text, response_json, provider, model) VALUES (?, ?, ?, ?, ?)', [id, prompt, JSON.stringify(response), config.provider, response.model]);
      await dbOps.run('INSERT OR REPLACE INTO semantic_cache_vec (id, embedding) VALUES (?, ?)', [id, vectorBuffer]);
      await dbOps.run('COMMIT');
    } catch (e) {
      await dbOps.run('ROLLBACK');
      throw e;
    }

    console.log('[Optima] Saved to Semantic Cache');
  } catch (err) {
    const isConnectionError = err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'));
    if (isConnectionError) {
      isCacheDisabled = true;
    } else {
      console.warn('[Optima] Cache save failed', err);
    }
  }
}
