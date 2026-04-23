"use strict";
/**
 * EverFern Desktop — Learning System Error Handler
 *
 * Centralized error handling for the continuous learning system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningErrorHandler = void 0;
const logger_1 = require("./logger");
class LearningErrorHandlerImpl {
    logger = (0, logger_1.getLearningLogger)();
    async handleAnalysisError(error, context) {
        this.logger.logError('Analysis error', error);
        switch (error.code) {
            case 'ANALYSIS_TIMEOUT':
                // Retry with shorter timeout
                break;
            case 'ANALYSIS_FAILED':
                // Log and skip this interaction
                break;
            default:
                this.logger.logError(`Unhandled analysis error: ${error.code}`, error);
        }
    }
    async handleStorageError(error, knowledge) {
        this.logger.logError('Storage error', error);
        switch (error.code) {
            case 'STORAGE_FULL':
                // Trigger pruning
                break;
            case 'STORAGE_FAILED':
                // Retry storage
                break;
            default:
                this.logger.logError(`Unhandled storage error: ${error.code}`, error);
        }
    }
    async handleProcessingError(error, task) {
        this.logger.logError('Processing error', error);
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
                this.logger.logError(`Unhandled processing error: ${error.code}`, error);
        }
    }
    async handleSecurityError(error, context) {
        this.logger.logError('Security error', error);
        switch (error.code) {
            case 'PII_DETECTED':
                // Remove PII and continue
                break;
            case 'SECURITY_VIOLATION':
                this.logger.logError(`Critical security error: ${error.code}, halting processing`, error);
                // Halt processing
                break;
            default:
                this.logger.logError(`Unhandled security error: ${error.code}`, error);
        }
    }
}
exports.learningErrorHandler = new LearningErrorHandlerImpl();
