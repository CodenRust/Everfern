/**
 * EverFern Desktop — Learning System Logger
 *
 * Specialized logging infrastructure for the continuous learning system.
 * Provides structured logging with privacy protection and performance monitoring.
 */

import type { LearningContext, LearnedKnowledge, LearningTask, InteractionAnalysis } from './types';

export interface LearningLogger {
  logAnalysisStart(context: LearningContext): void;
  logAnalysisComplete(context: LearningContext, analysis: InteractionAnalysis): void;
  logKnowledgeExtracted(knowledge: LearnedKnowledge): void;
  logKnowledgeStored(knowledge: LearnedKnowledge): void;
  logTaskQueued(task: LearningTask): void;
  logTaskProcessed(task: LearningTask, durationMs: number): void;
  logError(message: string, error?: Error, context?: any): void;
  logPerformance(operation: string, durationMs: number, metadata?: Record<string, unknown>): void;
  logSecurityEvent(event: string, context: any): void;
}

export class LearningLoggerImpl implements LearningLogger {
  private readonly enabled: boolean;
  private readonly logLevel: LogLevel;
  private readonly sanitizer: LogSanitizer;

  constructor(
    enabled: boolean = true,
    logLevel: LogLevel = 'info',
    sanitizer: LogSanitizer = new LogSanitizerImpl()
  ) {
    this.enabled = enabled;
    this.logLevel = logLevel;
    this.sanitizer = sanitizer;
  }

  logAnalysisStart(context: LearningContext): void {
    if (!this.enabled || !this.shouldLog('debug')) return;

    const sanitizedContext = this.sanitizer.sanitizeContext(context);
    console.log(`[Learning] 🔍 Starting analysis for interaction ${sanitizedContext.interactionId}`);
  }

  logAnalysisComplete(context: LearningContext, analysis: InteractionAnalysis): void {
    if (!this.enabled || !this.shouldLog('info')) return;

    const sanitizedContext = this.sanitizer.sanitizeContext(context);
    const opportunityCount = analysis.learningOpportunities.length;
    const patternCount = Object.values(analysis.extractedPatterns).reduce((sum, patterns) => sum + patterns.length, 0);

    console.log(`[Learning] ✅ Analysis complete for ${sanitizedContext.interactionId}: ${opportunityCount} opportunities, ${patternCount} patterns`);
  }

  logKnowledgeExtracted(knowledge: LearnedKnowledge): void {
    if (!this.enabled || !this.shouldLog('info')) return;

    const sanitizedKnowledge = this.sanitizer.sanitizeKnowledge(knowledge);
    console.log(`[Learning] 🧠 Knowledge extracted: ${sanitizedKnowledge.type} - ${sanitizedKnowledge.title} (confidence: ${knowledge.confidence.toFixed(2)})`);
  }

  logKnowledgeStored(knowledge: LearnedKnowledge): void {
    if (!this.enabled || !this.shouldLog('info')) return;

    const sanitizedKnowledge = this.sanitizer.sanitizeKnowledge(knowledge);
    console.log(`[Learning] 💾 Knowledge stored: ${sanitizedKnowledge.id} (${sanitizedKnowledge.type})`);
  }

  logTaskQueued(task: LearningTask): void {
    if (!this.enabled || !this.shouldLog('debug')) return;

    console.log(`[Learning] 📋 Task queued: ${task.type} (priority: ${task.priority})`);
  }

  logTaskProcessed(task: LearningTask, durationMs: number): void {
    if (!this.enabled || !this.shouldLog('debug')) return;

    console.log(`[Learning] ⚡ Task processed: ${task.type} in ${durationMs}ms`);
  }

  logError(message: string, error?: Error, context?: any): void {
    if (!this.enabled) return;

    const sanitizedContext = context ? this.sanitizer.sanitizeGeneric(context) : undefined;
    console.error(`[Learning] ❌ ${message}`, error, sanitizedContext);
  }

  logPerformance(operation: string, durationMs: number, metadata?: Record<string, unknown>): void {
    if (!this.enabled || !this.shouldLog('debug')) return;

    const sanitizedMetadata = metadata ? this.sanitizer.sanitizeGeneric(metadata) : undefined;
    console.log(`[Learning] ⏱️ ${operation}: ${durationMs}ms`, sanitizedMetadata);
  }

  logSecurityEvent(event: string, context: any): void {
    if (!this.enabled) return;

    // Security events are always logged, but context is heavily sanitized
    const sanitizedContext = this.sanitizer.sanitizeSecurityContext(context);
    console.warn(`[Learning] 🔒 Security event: ${event}`, sanitizedContext);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    return levels[level] <= levels[this.logLevel];
  }
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogSanitizer {
  sanitizeContext(context: LearningContext): Partial<LearningContext>;
  sanitizeKnowledge(knowledge: LearnedKnowledge): Partial<LearnedKnowledge>;
  sanitizeGeneric(data: any): any;
  sanitizeSecurityContext(context: any): any;
}

export class LogSanitizerImpl implements LogSanitizer {
  private readonly piiPatterns: RegExp[] = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card pattern
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP addresses
    /[C-F]:\\[^\s]*/gi, // Windows file paths
    /\/[^\s]*/g, // Unix file paths (be careful with this one)
  ];

  sanitizeContext(context: LearningContext): Partial<LearningContext> {
    return {
      interactionId: context.interactionId,
      sessionId: this.sanitizeSessionId(context.sessionId),
      success: context.success,
      outcome: context.outcome,
      // Remove messages and tools to prevent PII leakage in logs
      tools: context.tools?.map(tool => ({
        toolName: tool.toolName,
        timestamp: tool.timestamp,
        result: tool.result ? { success: tool.result.success } : undefined
      })) as any || [],
    };
  }

  sanitizeKnowledge(knowledge: LearnedKnowledge): Partial<LearnedKnowledge> {
    return {
      id: knowledge.id,
      type: knowledge.type,
      title: this.sanitizeText(knowledge.title),
      confidence: knowledge.confidence,
      frequency: knowledge.frequency,
      created: knowledge.created,
      tags: knowledge.tags.filter(tag => !this.containsPII(tag)),
    };
  }

  sanitizeGeneric(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeText(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeGeneric(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip potentially sensitive keys
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeGeneric(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  sanitizeSecurityContext(context: any): any {
    // For security contexts, only log minimal information
    return {
      sessionId: context.sessionId ? this.sanitizeSessionId(context.sessionId) : undefined,
      dataClassification: context.dataClassification,
      piiDetected: context.piiDetected,
      encryptionRequired: context.encryptionRequired,
    };
  }

  private sanitizeText(text: string): string {
    let sanitized = text;

    // Remove PII patterns
    for (const pattern of this.piiPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  private sanitizeSessionId(sessionId: string): string {
    // Keep first 8 characters for debugging, redact the rest
    return sessionId.length > 8 ? `${sessionId.substring(0, 8)}...` : sessionId;
  }

  private containsPII(text: string): boolean {
    return this.piiPatterns.some(pattern => pattern.test(text));
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth', 'credential',
      'email', 'phone', 'address', 'ssn', 'credit', 'card',
      'userId', 'username', 'personalInfo'
    ];

    return sensitiveKeys.some(sensitive =>
      key.toLowerCase().includes(sensitive.toLowerCase())
    );
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private readonly logger: LearningLogger;
  private readonly operations: Map<string, number> = new Map();

  constructor(logger: LearningLogger) {
    this.logger = logger;
  }

  startOperation(operationId: string): void {
    this.operations.set(operationId, Date.now());
  }

  endOperation(operationId: string, metadata?: Record<string, unknown>): number {
    const startTime = this.operations.get(operationId);
    if (!startTime) {
      this.logger.logError(`Performance monitor: operation ${operationId} not found`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.operations.delete(operationId);

    this.logger.logPerformance(operationId, duration, metadata);
    return duration;
  }

  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const operationId = `${operation}-${Date.now()}`;
    this.startOperation(operationId);

    try {
      const result = await fn();
      this.endOperation(operationId, metadata);
      return result;
    } catch (error) {
      this.endOperation(operationId, { ...metadata, error: true });
      throw error;
    }
  }
}

// Singleton logger instance
let globalLogger: LearningLogger | null = null;

export function getLearningLogger(): LearningLogger {
  if (!globalLogger) {
    globalLogger = new LearningLoggerImpl();
  }
  return globalLogger;
}

export function setLearningLogger(logger: LearningLogger): void {
  globalLogger = logger;
}
