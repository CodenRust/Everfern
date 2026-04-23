/**
 * Main entry point for the Continuous Learning Agent system
 */

export * from './types';
export * from './interaction-analyzer';
export * from './pattern-detector';
export * from './knowledge-synthesizer';
export * from './background-processor';
export { LearningNode as LearningNodeImpl } from './learning-node';
export * from './error-handler';

// Re-export learning memory extensions
export type {
  LearnedKnowledge,
  LearningMemoryExtension
} from '../../store/memory-manager';
export { learningMemoryManager } from '../../store/memory-manager';
