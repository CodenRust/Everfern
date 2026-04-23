/**
 * EverFern Desktop — Knowledge Synthesis System
 *
 * Converts raw patterns into structured, actionable knowledge.
 */

import type {
  InteractionAnalysis,
  LearnedKnowledge,
  ValidationInfo
} from './types';
import type { IKnowledgeSynthesizer } from './interfaces';

export class KnowledgeSynthesizer implements IKnowledgeSynthesizer {
  async synthesizeKnowledge(analysis: InteractionAnalysis): Promise<LearnedKnowledge[]> {
    const knowledge: LearnedKnowledge[] = [];

    // Synthesize user preferences
    for (const preference of analysis.extractedPatterns.userPreferences) {
      const knowledgeEntry = await this.createStructuredEntry(preference, 'preference');
      knowledge.push(knowledgeEntry);
    }

    // Synthesize tool usage patterns
    for (const pattern of analysis.extractedPatterns.toolUsagePatterns) {
      const knowledgeEntry = await this.createStructuredEntry(pattern, 'tool_combination');
      knowledge.push(knowledgeEntry);
    }

    // Synthesize problem-solving patterns
    for (const pattern of analysis.extractedPatterns.problemSolvingApproaches) {
      const knowledgeEntry = await this.createStructuredEntry(pattern, 'pattern');
      knowledge.push(knowledgeEntry);
    }

    // Synthesize workflow optimizations
    for (const pattern of analysis.extractedPatterns.workflowOptimizations) {
      const knowledgeEntry = await this.createStructuredEntry(pattern, 'workflow');
      knowledge.push(knowledgeEntry);
    }

    return knowledge;
  }

  async validateKnowledge(knowledge: LearnedKnowledge): Promise<ValidationInfo> {
    const accuracyScore = this.calculateAccuracyScore(knowledge);
    const relevanceScore = this.calculateRelevanceScore(knowledge);
    const qualityScore = this.calculateQualityScore(knowledge);

    return {
      accuracyScore,
      relevanceScore,
      qualityScore,
      lastValidated: new Date(),
      validationMethod: 'automated'
    };
  }

  async resolveConflicts(conflicting: LearnedKnowledge[]): Promise<LearnedKnowledge> {
    // Use the most recent and highest confidence knowledge
    return conflicting.reduce((best, current) => {
      if (current.confidence > best.confidence) {
        return current;
      }
      if (current.confidence === best.confidence && current.created > best.created) {
        return current;
      }
      return best;
    });
  }

  async assignConfidenceScore(knowledge: LearnedKnowledge): Promise<number> {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on frequency
    confidence += Math.min(knowledge.frequency * 0.1, 0.3);

    // Increase confidence based on provenance quality
    confidence += knowledge.provenance.validationScore * 0.2;

    // Decrease confidence based on age
    const ageInDays = (Date.now() - knowledge.created.getTime()) / (1000 * 60 * 60 * 24);
    confidence -= Math.min(ageInDays * 0.01, 0.2);

    return Math.max(0, Math.min(1, confidence));
  }

  async createStructuredEntry(pattern: any, type: string): Promise<LearnedKnowledge> {
    const id = this.generateId();
    const now = new Date();

    return {
      id,
      type: type as any,
      title: this.generateTitle(pattern, type),
      content: this.generateContent(pattern),
      context: this.generateContext(pattern),
      applicabilityConditions: this.generateApplicabilityConditions(pattern),
      confidence: 0.7, // Default confidence
      frequency: 1,
      lastUsed: now,
      created: now,
      tags: this.generateTags(pattern),
      provenance: {
        sourceInteractions: [],
        extractionMethod: 'pattern-detection',
        validationScore: 0.8
      },
      metadata: {
        domain: this.inferDomain(pattern),
        toolsInvolved: this.extractToolsInvolved(pattern),
        userPreference: type === 'preference',
        encrypted: false
      }
    };
  }

  async updateKnowledgeWithEvidence(knowledge: LearnedKnowledge, evidence: any): Promise<LearnedKnowledge> {
    // Update frequency
    knowledge.frequency += 1;

    // Update confidence based on new evidence
    const newConfidence = await this.assignConfidenceScore(knowledge);
    knowledge.confidence = (knowledge.confidence + newConfidence) / 2;

    // Update last used timestamp
    knowledge.lastUsed = new Date();

    return knowledge;
  }

  private calculateAccuracyScore(knowledge: LearnedKnowledge): number {
    // Placeholder calculation based on confidence and frequency
    return Math.min(knowledge.confidence * knowledge.frequency * 0.1, 1.0);
  }

  private calculateRelevanceScore(knowledge: LearnedKnowledge): number {
    // Placeholder calculation based on recency and usage
    const ageInDays = (Date.now() - knowledge.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - (ageInDays * 0.01));
  }

  private calculateQualityScore(knowledge: LearnedKnowledge): number {
    // Placeholder calculation based on content length and structure
    const contentQuality = Math.min(knowledge.content.length / 100, 1.0);
    const metadataQuality = Object.keys(knowledge.metadata).length / 10;
    return (contentQuality + metadataQuality) / 2;
  }

  private generateId(): string {
    return `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTitle(pattern: any, type: string): string {
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Pattern`;
  }

  private generateContent(pattern: any): string {
    return JSON.stringify(pattern, null, 2);
  }

  private generateContext(pattern: any): string {
    return pattern.context || 'General usage';
  }

  private generateApplicabilityConditions(pattern: any): string[] {
    return pattern.applicableContexts || ['general'];
  }

  private generateTags(pattern: any): string[] {
    const tags: string[] = [];

    if (pattern.toolCombination) {
      tags.push(...pattern.toolCombination);
    }
    if (pattern.category) {
      tags.push(pattern.category);
    }
    if (pattern.workflowType) {
      tags.push(pattern.workflowType);
    }

    return tags;
  }

  private inferDomain(pattern: any): string {
    // Simple domain inference based on pattern properties
    if (pattern.toolCombination?.some((tool: string) => tool.includes('file'))) {
      return 'file-management';
    }
    if (pattern.toolCombination?.some((tool: string) => tool.includes('terminal'))) {
      return 'terminal';
    }
    if (pattern.category === 'coding') {
      return 'coding';
    }

    return 'general';
  }

  private extractToolsInvolved(pattern: any): string[] {
    return pattern.toolCombination || [];
  }
}

export const knowledgeSynthesizer = new KnowledgeSynthesizer();
