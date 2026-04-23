"use strict";
/**
 * EverFern Desktop — Learning System Logger
 *
 * Specialized logging infrastructure for the continuous learning system.
 * Provides structured logging with privacy protection and performance monitoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = exports.LogSanitizerImpl = exports.LearningLoggerImpl = void 0;
exports.getLearningLogger = getLearningLogger;
exports.setLearningLogger = setLearningLogger;
class LearningLoggerImpl {
    enabled;
    logLevel;
    sanitizer;
    constructor(enabled = true, logLevel = 'info', sanitizer = new LogSanitizerImpl()) {
        this.enabled = enabled;
        this.logLevel = logLevel;
        this.sanitizer = sanitizer;
    }
    logAnalysisStart(context) {
        if (!this.enabled || !this.shouldLog('debug'))
            return;
        const sanitizedContext = this.sanitizer.sanitizeContext(context);
        console.log(`[Learning] 🔍 Starting analysis for interaction ${sanitizedContext.interactionId}`);
    }
    logAnalysisComplete(context, analysis) {
        if (!this.enabled || !this.shouldLog('info'))
            return;
        const sanitizedContext = this.sanitizer.sanitizeContext(context);
        const opportunityCount = analysis.learningOpportunities.length;
        const patternCount = Object.values(analysis.extractedPatterns).reduce((sum, patterns) => sum + patterns.length, 0);
        console.log(`[Learning] ✅ Analysis complete for ${sanitizedContext.interactionId}: ${opportunityCount} opportunities, ${patternCount} patterns`);
    }
    logKnowledgeExtracted(knowledge) {
        if (!this.enabled || !this.shouldLog('info'))
            return;
        const sanitizedKnowledge = this.sanitizer.sanitizeKnowledge(knowledge);
        console.log(`[Learning] 🧠 Knowledge extracted: ${sanitizedKnowledge.type} - ${sanitizedKnowledge.title} (confidence: ${knowledge.confidence.toFixed(2)})`);
    }
    logKnowledgeStored(knowledge) {
        if (!this.enabled || !this.shouldLog('info'))
            return;
        const sanitizedKnowledge = this.sanitizer.sanitizeKnowledge(knowledge);
        console.log(`[Learning] 💾 Knowledge stored: ${sanitizedKnowledge.id} (${sanitizedKnowledge.type})`);
    }
    logTaskQueued(task) {
        if (!this.enabled || !this.shouldLog('debug'))
            return;
        console.log(`[Learning] 📋 Task queued: ${task.type} (priority: ${task.priority})`);
    }
    logTaskProcessed(task, durationMs) {
        if (!this.enabled || !this.shouldLog('debug'))
            return;
        console.log(`[Learning] ⚡ Task processed: ${task.type} in ${durationMs}ms`);
    }
    logError(message, error, context) {
        if (!this.enabled)
            return;
        const sanitizedContext = context ? this.sanitizer.sanitizeGeneric(context) : undefined;
        console.error(`[Learning] ❌ ${message}`, error, sanitizedContext);
    }
    logPerformance(operation, durationMs, metadata) {
        if (!this.enabled || !this.shouldLog('debug'))
            return;
        const sanitizedMetadata = metadata ? this.sanitizer.sanitizeGeneric(metadata) : undefined;
        console.log(`[Learning] ⏱️ ${operation}: ${durationMs}ms`, sanitizedMetadata);
    }
    logSecurityEvent(event, context) {
        if (!this.enabled)
            return;
        // Security events are always logged, but context is heavily sanitized
        const sanitizedContext = this.sanitizer.sanitizeSecurityContext(context);
        console.warn(`[Learning] 🔒 Security event: ${event}`, sanitizedContext);
    }
    shouldLog(level) {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        return levels[level] <= levels[this.logLevel];
    }
}
exports.LearningLoggerImpl = LearningLoggerImpl;
class LogSanitizerImpl {
    piiPatterns = [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card pattern
        /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP addresses
        /[C-F]:\\[^\s]*/gi, // Windows file paths
        /\/[^\s]*/g, // Unix file paths (be careful with this one)
    ];
    sanitizeContext(context) {
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
            })) || [],
        };
    }
    sanitizeKnowledge(knowledge) {
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
    sanitizeGeneric(data) {
        if (typeof data === 'string') {
            return this.sanitizeText(data);
        }
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeGeneric(item));
        }
        if (data && typeof data === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                // Skip potentially sensitive keys
                if (this.isSensitiveKey(key)) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = this.sanitizeGeneric(value);
                }
            }
            return sanitized;
        }
        return data;
    }
    sanitizeSecurityContext(context) {
        // For security contexts, only log minimal information
        return {
            sessionId: context.sessionId ? this.sanitizeSessionId(context.sessionId) : undefined,
            dataClassification: context.dataClassification,
            piiDetected: context.piiDetected,
            encryptionRequired: context.encryptionRequired,
        };
    }
    sanitizeText(text) {
        let sanitized = text;
        // Remove PII patterns
        for (const pattern of this.piiPatterns) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        return sanitized;
    }
    sanitizeSessionId(sessionId) {
        // Keep first 8 characters for debugging, redact the rest
        return sessionId.length > 8 ? `${sessionId.substring(0, 8)}...` : sessionId;
    }
    containsPII(text) {
        return this.piiPatterns.some(pattern => pattern.test(text));
    }
    isSensitiveKey(key) {
        const sensitiveKeys = [
            'password', 'token', 'key', 'secret', 'auth', 'credential',
            'email', 'phone', 'address', 'ssn', 'credit', 'card',
            'userId', 'username', 'personalInfo'
        ];
        return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()));
    }
}
exports.LogSanitizerImpl = LogSanitizerImpl;
// Performance monitoring utilities
class PerformanceMonitor {
    logger;
    operations = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    startOperation(operationId) {
        this.operations.set(operationId, Date.now());
    }
    endOperation(operationId, metadata) {
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
    async measureAsync(operation, fn, metadata) {
        const operationId = `${operation}-${Date.now()}`;
        this.startOperation(operationId);
        try {
            const result = await fn();
            this.endOperation(operationId, metadata);
            return result;
        }
        catch (error) {
            this.endOperation(operationId, { ...metadata, error: true });
            throw error;
        }
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
// Singleton logger instance
let globalLogger = null;
function getLearningLogger() {
    if (!globalLogger) {
        globalLogger = new LearningLoggerImpl();
    }
    return globalLogger;
}
function setLearningLogger(logger) {
    globalLogger = logger;
}
