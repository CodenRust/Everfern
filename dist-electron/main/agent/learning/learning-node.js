"use strict";
/**
 * EverFern Desktop — Learning Node
 *
 * Main orchestrator for the continuous learning system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningNode = exports.LearningNode = void 0;
const interaction_analyzer_1 = require("./interaction-analyzer");
const background_processor_1 = require("./background-processor");
const config_1 = require("./config");
class LearningNode {
    analyzer = new interaction_analyzer_1.InteractionAnalyzer();
    config = (0, config_1.getLearningConfig)();
    async analyzeInteraction(context) {
        if (!this.config.getConfig().enabled) {
            return;
        }
        // Queue analysis task for background processing
        await background_processor_1.backgroundProcessor.queueLearningTask({
            id: `analyze_${context.interactionId}`,
            type: 'analyze',
            priority: 5,
            data: context,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date()
        });
    }
    async processLearningQueue() {
        await background_processor_1.backgroundProcessor.processQueue();
    }
    async retrieveRelevantKnowledge(query, limit) {
        // Placeholder implementation
        // In a real implementation, this would query the memory system
        return [];
    }
    async explainDecisionInfluence(decisionId) {
        // Placeholder implementation
        return `No learning influence found for decision ${decisionId}`;
    }
    async getStatus() {
        const queueStatus = background_processor_1.backgroundProcessor.getQueueStatus();
        const resourceUsage = background_processor_1.backgroundProcessor.getResourceUsage();
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
    async updateConfig(config) {
        this.config.updateConfig(config);
    }
}
exports.LearningNode = LearningNode;
exports.learningNode = new LearningNode();
