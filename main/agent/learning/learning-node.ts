/**
 * EverFern Desktop — Learning Node
 *
 * Main orchestrator for the continuous learning system.
 */

import type {
  LearningContext,
  LearnedKnowledge,
  LearningNode as ILearningNode
} from './types';
import type { ILearningAgent } from './interfaces';
import { InteractionAnalyzer } from './interaction-analyzer';
import { backgroundProcessor } from './background-processor';
import { getLearningConfig } from './config';

export class LearningNode implements ILearningNode, ILearningAgent {
  private readonly analyzer = new InteractionAnalyzer();
  private readonly config = getLearningConfig();

  async analyzeInteraction(context: LearningContext): Promise<void> {
    if (!this.config.getConfig().enabled) {
      return;
    }

    // Queue analysis task for background processing
    await backgroundProcessor.queueLearningTask({
      id: `analyze_${context.interactionId}`,
      type: 'analyze',
      priority: 5,
      data: context,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date()
    });
  }

  async processLearningQueue(): Promise<void> {
    await backgroundProcessor.processQueue();
  }

  async retrieveRelevantKnowledge(query: string, limit?: number): Promise<LearnedKnowledge[]> {
    // Placeholder implementation
    // In a real implementation, this would query the memory system
    return [];
  }

  async explainDecisionInfluence(decisionId: string): Promise<string> {
    // Placeholder implementation
    return `No learning influence found for decision ${decisionId}`;
  }

  async getStatus(): Promise<any> {
    const queueStatus = backgroundProcessor.getQueueStatus();
    const resourceUsage = backgroundProcessor.getResourceUsage();

    return {
      enabled: this.config.getConfig().enabled,
      queueDepth: queueStatus.pendingTasks,
      resourceUsage,
      knowledgeCount: 0, // Would query memory system
      lastProcessingTime: new Date(),
      errorCount: 0,
      successRate: 1.0
    };
  }

  async updateConfig(config: any): Promise<void> {
    this.config.updateConfig(config);
  }
}

export const learningNode = new LearningNode();
