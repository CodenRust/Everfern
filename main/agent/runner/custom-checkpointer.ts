/**
 * Custom Lightweight Checkpointer for LangGraph
 *
 * This replaces MemorySaver which was causing 90-minute compilation hangs.
 * Provides session persistence without the overhead and validation issues.
 */

import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple } from '@langchain/langgraph';

interface CheckpointData {
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  parentId?: string;
}

export class LightweightCheckpointer extends BaseCheckpointSaver {
  private storage: Map<string, Map<string, CheckpointData>> = new Map();

  constructor() {
    super();
    console.log('[Checkpointer] ✅ Initialized LightweightCheckpointer');
  }

  async getTuple(config: { configurable?: { thread_id?: string; checkpoint_id?: string } }): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;

    if (!threadId) {
      return undefined;
    }

    const threadData = this.storage.get(threadId);
    if (!threadData) {
      return undefined;
    }

    // If specific checkpoint requested, return that
    if (checkpointId) {
      const data = threadData.get(checkpointId);
      if (!data) {
        return undefined;
      }

      return {
        config,
        checkpoint: data.checkpoint,
        metadata: data.metadata,
        parentConfig: data.parentId ? { configurable: { thread_id: threadId, checkpoint_id: data.parentId } } : undefined,
      };
    }

    // Otherwise return the latest checkpoint
    const checkpoints = Array.from(threadData.entries());
    if (checkpoints.length === 0) {
      return undefined;
    }

    // Get the most recent checkpoint (last one added)
    const [latestId, latestData] = checkpoints[checkpoints.length - 1];

    return {
      config: { configurable: { thread_id: threadId, checkpoint_id: latestId } },
      checkpoint: latestData.checkpoint,
      metadata: latestData.metadata,
      parentConfig: latestData.parentId ? { configurable: { thread_id: threadId, checkpoint_id: latestData.parentId } } : undefined,
    };
  }

  async *list(config: { configurable?: { thread_id?: string } }, options?: { limit?: number }): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id;
    const limit = options?.limit;

    if (!threadId) {
      return;
    }

    const threadData = this.storage.get(threadId);
    if (!threadData) {
      return;
    }

    const checkpoints = Array.from(threadData.entries());
    const limitedCheckpoints = limit ? checkpoints.slice(-limit) : checkpoints;

    for (const [checkpointId, data] of limitedCheckpoints.reverse()) {
      yield {
        config: { configurable: { thread_id: threadId, checkpoint_id: checkpointId } },
        checkpoint: data.checkpoint,
        metadata: data.metadata,
        parentConfig: data.parentId ? { configurable: { thread_id: threadId, checkpoint_id: data.parentId } } : undefined,
      };
    }
  }

  async put(config: { configurable?: { thread_id?: string; checkpoint_id?: string } }, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<{ configurable: { thread_id: string; checkpoint_id: string } }> {
    const threadId = config.configurable?.thread_id || `thread_${Date.now()}`;
    const checkpointId = checkpoint.id || `checkpoint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    if (!this.storage.has(threadId)) {
      this.storage.set(threadId, new Map());
    }

    const threadData = this.storage.get(threadId)!;

    // Store the checkpoint
    threadData.set(checkpointId, {
      checkpoint: { ...checkpoint, id: checkpointId },
      metadata,
      parentId: config.configurable?.checkpoint_id,
    });

    // Limit storage to last 100 checkpoints per thread to prevent memory bloat
    if (threadData.size > 100) {
      const oldestKey = threadData.keys().next().value;
      if (oldestKey) {
        threadData.delete(oldestKey);
      }
    }

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpointId,
      },
    };
  }

  async putWrites(config: { configurable?: { thread_id?: string; checkpoint_id?: string } }, writes: any[], taskId: string): Promise<void> {
    // Store intermediate writes during task execution — required for interrupt() to work
    const threadId = config.configurable?.thread_id;
    const checkpointId = config.configurable?.checkpoint_id;
    console.log(`[Checkpointer] putWrites called for thread ${threadId}, task ${taskId}`);

    if (!threadId || !checkpointId) return;

    const threadData = this.storage.get(threadId);
    if (!threadData) return;

    const existing = threadData.get(checkpointId);
    if (!existing) return;

    // Merge writes into the checkpoint's pending_sends so interrupt() state is preserved
    const pendingSends = (existing.checkpoint as any).pending_sends || [];
    for (const write of writes) {
      pendingSends.push(write);
    }
    (existing.checkpoint as any).pending_sends = pendingSends;
  }

  async deleteThread(threadId: string): Promise<void> {
    this.storage.delete(threadId);
    console.log(`[Checkpointer] 🗑️  Deleted thread: ${threadId}`);
  }

  /**
   * Clear all checkpoints for a thread (alias for deleteThread)
   */
  clearThread(threadId: string): void {
    this.storage.delete(threadId);
    console.log(`[Checkpointer] 🗑️  Cleared checkpoints for thread: ${threadId}`);
  }

  /**
   * Get storage statistics
   */
  getStats(): { threads: number; totalCheckpoints: number } {
    let totalCheckpoints = 0;
    // Convert iterator to array to avoid TypeScript iteration issue
    const values = Array.from(this.storage.values());
    for (const threadData of values) {
      totalCheckpoints += threadData.size;
    }

    return {
      threads: this.storage.size,
      totalCheckpoints,
    };
  }
}

// Create a singleton instance
export const lightweightCheckpointer = new LightweightCheckpointer();
