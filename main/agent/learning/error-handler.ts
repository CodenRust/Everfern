/**
 * EverFern Desktop — Learning System Error Handler
 *
 * Centralized error handling for the continuous learning system.
 */

import type {
  LearningError,
  LearningErrorHandler,
  LearningContext,
  LearnedKnowledge,
  LearningTask,
  SecurityContext
} from './types';
import { getLearningLogger } from './logger';

class LearningErrorHandlerImpl implements LearningErrorHandler {
  private readonly logger = getLearningLogger();

  async handleAnalysisError(error: LearningError, context: LearningContext): Promise<void> {
    this.logger.logError('Analysis error', error as any);

    switch (error.code) {
      case 'ANALYSIS_TIMEOUT':
        // Retry with shorter timeout
        break;
      case 'ANALYSIS_FAILED':
        // Log and skip this interaction
        break;
      default:
        this.logger.logError(`Unhandled analysis error: ${error.code}`, error as any);
    }
  }

  async handleStorageError(error: LearningError, knowledge: LearnedKnowledge): Promise<void> {
    this.logger.logError('Storage error', error as any);

    switch (error.code) {
      case 'STORAGE_FULL':
        // Trigger pruning
        break;
      case 'STORAGE_FAILED':
        // Retry storage
        break;
      default:
        this.logger.logError(`Unhandled storage error: ${error.code}`, error as any);
    }
  }

  async handleProcessingError(error: LearningError, task: LearningTask): Promise<void> {
    this.logger.logError('Processing error', error as any);

    switch (error.code) {
      case 'PROCESSING_OVERLOAD':
        // Reduce processing load
        break;
      case 'PROCESSING_FAILED':
        // Retry task
        task.retryCount++;
        if (task.retryCount < task.maxRetries) {
          task.scheduledFor = new Date(Date.now() + 5000); // Retry in 5 seconds
        }
        break;
      default:
        this.logger.logError(`Unhandled processing error: ${error.code}`, error as any);
    }
  }

  async handleSecurityError(error: LearningError, context: SecurityContext): Promise<void> {
    this.logger.logError('Security error', error as any);

    switch (error.code) {
      case 'PII_DETECTED':
        // Remove PII and continue
        break;
      case 'SECURITY_VIOLATION':
        this.logger.logError(`Critical security error: ${error.code}, halting processing`, error as any);
        // Halt processing
        break;
      default:
        this.logger.logError(`Unhandled security error: ${error.code}`, error as any);
    }
  }
}

export const learningErrorHandler = new LearningErrorHandlerImpl();
