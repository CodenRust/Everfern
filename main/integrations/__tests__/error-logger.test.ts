/**
 * Unit tests for Error Logger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ErrorLogger,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  getErrorLogger,
  createErrorLogger
} from '../error-logger';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock dependencies
vi.mock('../security-monitor', () => ({
  getSecurityMonitor: () => ({
    logSecurityEvent: vi.fn()
  })
}));

vi.mock('../admin-notification', () => ({
  adminNotificationManager: {
    sendNotification: vi.fn()
  },
  NotificationPriority: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  }
}));

describe('ErrorLogger', () => {
  let errorLogger: ErrorLogger;
  let testLogDir: string;

  beforeEach(() => {
    errorLogger = createErrorLogger();
    testLogDir = path.join(os.homedir(), '.everfern', 'error-logs');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('logError', () => {
    it('should log an error with full context', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'test-component',
        operation: 'test-operation',
        platform: 'telegram',
        userId: 'user123'
      };

      const entry = await errorLogger.logError(
        error,
        ErrorSeverity.MEDIUM,
        ErrorCategory.MESSAGE_DELIVERY,
        context
      );

      expect(entry).toBeDefined();
      expect(entry.id).toMatch(/^err_/);
      expect(entry.severity).toBe(ErrorSeverity.MEDIUM);
      expect(entry.category).toBe(ErrorCategory.MESSAGE_DELIVERY);
      expect(entry.message).toBe('Test error');
      expect(entry.context.component).toBe('test-component');
      expect(entry.context.platform).toBe('telegram');
      expect(entry.context.userId).toBe('user123');
      expect(entry.context.environment).toBeDefined();
    });

    it('should include stack trace in error log', async () => {
      const error = new Error('Test error with stack');
      const context: ErrorContext = {
        component: 'test',
        operation: 'test'
      };

      const entry = await errorLogger.logError(
        error,
        ErrorSeverity.LOW,
        ErrorCategory.UNKNOWN,
        context
      );

      expect(entry.error.stack).toBeDefined();
      expect(entry.error.stack).toContain('Error: Test error with stack');
    });

    it('should capture environment information', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'test',
        operation: 'test'
      };

      const entry = await errorLogger.logError(
        error,
        ErrorSeverity.LOW,
        ErrorCategory.UNKNOWN,
        context
      );

      expect(entry.context.environment).toBeDefined();
      expect(entry.context.environment?.nodeVersion).toBeDefined();
      expect(entry.context.environment?.platform).toBeDefined();
      expect(entry.context.environment?.memory).toBeDefined();
    });

    it('should include retry information when provided', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'test',
        operation: 'test'
      };
      const retry = {
        attempt: 2,
        maxAttempts: 3,
        nextRetryAt: new Date(Date.now() + 5000)
      };

      const entry = await errorLogger.logError(
        error,
        ErrorSeverity.MEDIUM,
        ErrorCategory.MESSAGE_DELIVERY,
        context,
        retry
      );

      expect(entry.retry).toBeDefined();
      expect(entry.retry?.attempt).toBe(2);
      expect(entry.retry?.maxAttempts).toBe(3);
      expect(entry.retry?.nextRetryAt).toBeDefined();
    });

    it('should emit error-logged event', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'test',
        operation: 'test'
      };

      const eventPromise = new Promise(resolve => {
        errorLogger.once('error-logged', resolve);
      });

      await errorLogger.logError(
        error,
        ErrorSeverity.LOW,
        ErrorCategory.UNKNOWN,
        context
      );

      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });

  describe('logPlatformError', () => {
    it('should log platform connection error', async () => {
      const error = new Error('Connection failed');
      const entry = await errorLogger.logPlatformError(
        'telegram',
        error,
        'connect',
        { timeout: 5000 }
      );

      expect(entry.category).toBe(ErrorCategory.PLATFORM_CONNECTION);
      expect(entry.context.platform).toBe('telegram');
      expect(entry.context.component).toBe('telegram-platform');
      expect(entry.context.operation).toBe('connect');
      expect(entry.context.metadata?.timeout).toBe(5000);
    });
  });

  describe('logMessageError', () => {
    it('should log message delivery error', async () => {
      const error = new Error('Message send failed');
      const entry = await errorLogger.logMessageError(
        'discord',
        'user456',
        error,
        'msg123',
        'conv789'
      );

      expect(entry.category).toBe(ErrorCategory.MESSAGE_DELIVERY);
      expect(entry.severity).toBe(ErrorSeverity.MEDIUM);
      expect(entry.context.platform).toBe('discord');
      expect(entry.context.userId).toBe('user456');
      expect(entry.context.messageId).toBe('msg123');
      expect(entry.context.conversationId).toBe('conv789');
    });

    it('should include retry information for message errors', async () => {
      const error = new Error('Message send failed');
      const retry = {
        attempt: 1,
        maxAttempts: 3
      };

      const entry = await errorLogger.logMessageError(
        'telegram',
        'user123',
        error,
        'msg456',
        undefined,
        retry
      );

      expect(entry.retry).toBeDefined();
      expect(entry.retry?.attempt).toBe(1);
    });
  });

  describe('logFileTransferError', () => {
    it('should log file upload error', async () => {
      const error = new Error('Upload failed');
      const entry = await errorLogger.logFileTransferError(
        'telegram',
        'user123',
        error,
        'document.pdf',
        'upload'
      );

      expect(entry.category).toBe(ErrorCategory.FILE_TRANSFER);
      expect(entry.context.operation).toBe('upload');
      expect(entry.context.metadata?.filename).toBe('document.pdf');
    });

    it('should log file download error', async () => {
      const error = new Error('Download failed');
      const entry = await errorLogger.logFileTransferError(
        'discord',
        'user456',
        error,
        'image.png',
        'download'
      );

      expect(entry.category).toBe(ErrorCategory.FILE_TRANSFER);
      expect(entry.context.operation).toBe('download');
      expect(entry.context.metadata?.filename).toBe('image.png');
    });
  });

  describe('logDatabaseError', () => {
    it('should log database error with high severity', async () => {
      const error = new Error('Database connection lost');
      const entry = await errorLogger.logDatabaseError(
        error,
        'query',
        { table: 'users' }
      );

      expect(entry.category).toBe(ErrorCategory.DATABASE);
      expect(entry.severity).toBe(ErrorSeverity.HIGH);
      expect(entry.context.component).toBe('database');
      expect(entry.context.operation).toBe('query');
    });
  });

  describe('logSecurityError', () => {
    it('should log security error with critical severity', async () => {
      const error = new Error('Unauthorized access attempt');
      const context: ErrorContext = {
        component: 'auth',
        operation: 'verify',
        userId: 'user123'
      };

      const entry = await errorLogger.logSecurityError(
        error,
        ErrorCategory.SECURITY_VIOLATION,
        context
      );

      expect(entry.severity).toBe(ErrorSeverity.CRITICAL);
      expect(entry.category).toBe(ErrorCategory.SECURITY_VIOLATION);
    });
  });

  describe('getErrors', () => {
    beforeEach(async () => {
      // Log some test errors
      await errorLogger.logError(
        new Error('Error 1'),
        ErrorSeverity.LOW,
        ErrorCategory.MESSAGE_DELIVERY,
        { component: 'test', operation: 'test', platform: 'telegram' }
      );

      await errorLogger.logError(
        new Error('Error 2'),
        ErrorSeverity.HIGH,
        ErrorCategory.DATABASE,
        { component: 'test', operation: 'test' }
      );

      await errorLogger.logError(
        new Error('Error 3'),
        ErrorSeverity.MEDIUM,
        ErrorCategory.FILE_TRANSFER,
        { component: 'test', operation: 'test', platform: 'discord' }
      );
    });

    it('should return all errors without filters', () => {
      const errors = errorLogger.getErrors();
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by severity', () => {
      const errors = errorLogger.getErrors({
        severity: [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]
      });

      expect(errors.every(e =>
        e.severity === ErrorSeverity.HIGH || e.severity === ErrorSeverity.CRITICAL
      )).toBe(true);
    });

    it('should filter by category', () => {
      const errors = errorLogger.getErrors({
        category: [ErrorCategory.DATABASE]
      });

      expect(errors.every(e => e.category === ErrorCategory.DATABASE)).toBe(true);
    });

    it('should filter by platform', () => {
      const errors = errorLogger.getErrors({
        platform: ['telegram']
      });

      expect(errors.every(e => e.context.platform === 'telegram')).toBe(true);
    });

    it('should filter by component', () => {
      const errors = errorLogger.getErrors({
        component: ['test']
      });

      expect(errors.every(e => e.context.component === 'test')).toBe(true);
    });

    it('should apply limit', () => {
      const errors = errorLogger.getErrors({ limit: 2 });
      expect(errors.length).toBeLessThanOrEqual(2);
    });

    it('should sort by timestamp (newest first)', () => {
      const errors = errorLogger.getErrors();

      for (let i = 1; i < errors.length; i++) {
        expect(errors[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          errors[i].timestamp.getTime()
        );
      }
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      // Log various errors for statistics
      await errorLogger.logError(
        new Error('Error 1'),
        ErrorSeverity.LOW,
        ErrorCategory.MESSAGE_DELIVERY,
        { component: 'bot', operation: 'send', platform: 'telegram' }
      );

      await errorLogger.logError(
        new Error('Error 2'),
        ErrorSeverity.HIGH,
        ErrorCategory.DATABASE,
        { component: 'db', operation: 'query' }
      );

      await errorLogger.logError(
        new Error('Error 1'),
        ErrorSeverity.MEDIUM,
        ErrorCategory.MESSAGE_DELIVERY,
        { component: 'bot', operation: 'send', platform: 'discord' }
      );
    });

    it('should calculate total errors', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.totalErrors).toBeGreaterThanOrEqual(3);
    });

    it('should count errors by severity', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.bySeverity).toBeDefined();
      expect(typeof stats.bySeverity[ErrorSeverity.LOW]).toBe('number');
      expect(typeof stats.bySeverity[ErrorSeverity.HIGH]).toBe('number');
    });

    it('should count errors by category', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.byCategory).toBeDefined();
      expect(typeof stats.byCategory[ErrorCategory.MESSAGE_DELIVERY]).toBe('number');
      expect(typeof stats.byCategory[ErrorCategory.DATABASE]).toBe('number');
    });

    it('should count errors by platform', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.byPlatform).toBeDefined();
    });

    it('should count errors by component', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.byComponent).toBeDefined();
    });

    it('should calculate error rate', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should identify top errors', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.topErrors).toBeDefined();
      expect(Array.isArray(stats.topErrors)).toBe(true);

      if (stats.topErrors.length > 0) {
        expect(stats.topErrors[0]).toHaveProperty('message');
        expect(stats.topErrors[0]).toHaveProperty('count');
        expect(stats.topErrors[0]).toHaveProperty('category');
      }
    });

    it('should include time period', async () => {
      const stats = await errorLogger.getStatistics();
      expect(stats.timePeriod).toBeDefined();
      expect(stats.timePeriod.start).toBeInstanceOf(Date);
      expect(stats.timePeriod.end).toBeInstanceOf(Date);
    });
  });

  describe('resolveError', () => {
    it('should resolve an error', async () => {
      const error = new Error('Test error');
      const entry = await errorLogger.logError(
        error,
        ErrorSeverity.MEDIUM,
        ErrorCategory.MESSAGE_DELIVERY,
        { component: 'test', operation: 'test' }
      );

      const resolved = await errorLogger.resolveError(
        entry.id,
        'admin',
        'Fixed by restarting service'
      );

      expect(resolved).toBe(true);

      const errors = errorLogger.getErrors({ resolved: true });
      const resolvedError = errors.find(e => e.id === entry.id);

      expect(resolvedError?.resolution?.resolved).toBe(true);
      expect(resolvedError?.resolution?.resolvedBy).toBe('admin');
      expect(resolvedError?.resolution?.notes).toBe('Fixed by restarting service');
      expect(resolvedError?.resolution?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should return false for non-existent error', async () => {
      const resolved = await errorLogger.resolveError(
        'non-existent-id',
        'admin',
        'Test'
      );

      expect(resolved).toBe(false);
    });

    it('should emit error-resolved event', async () => {
      const error = new Error('Test error');
      const entry = await errorLogger.logError(
        error,
        ErrorSeverity.MEDIUM,
        ErrorCategory.MESSAGE_DELIVERY,
        { component: 'test', operation: 'test' }
      );

      const eventPromise = new Promise(resolve => {
        errorLogger.once('error-resolved', resolve);
      });

      await errorLogger.resolveError(entry.id, 'admin', 'Fixed');

      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });

  describe('getAnalytics', () => {
    beforeEach(async () => {
      // Log various errors for analytics
      await errorLogger.logError(
        new Error('Error 1'),
        ErrorSeverity.CRITICAL,
        ErrorCategory.SECURITY_VIOLATION,
        { component: 'auth', operation: 'verify' }
      );

      await errorLogger.logError(
        new Error('Error 2'),
        ErrorSeverity.MEDIUM,
        ErrorCategory.MESSAGE_DELIVERY,
        { component: 'bot', operation: 'send' }
      );
    });

    it('should return comprehensive analytics', async () => {
      const analytics = await errorLogger.getAnalytics();

      expect(analytics.statistics).toBeDefined();
      expect(analytics.recentErrors).toBeDefined();
      expect(analytics.criticalErrors).toBeDefined();
      expect(analytics.unresolvedErrors).toBeDefined();
      expect(analytics.errorTrends).toBeDefined();
    });

    it('should include recent errors', async () => {
      const analytics = await errorLogger.getAnalytics();
      expect(Array.isArray(analytics.recentErrors)).toBe(true);
    });

    it('should include critical errors', async () => {
      const analytics = await errorLogger.getAnalytics();
      expect(Array.isArray(analytics.criticalErrors)).toBe(true);

      if (analytics.criticalErrors.length > 0) {
        expect([ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]).toContain(
          analytics.criticalErrors[0].severity
        );
      }
    });

    it('should include unresolved errors', async () => {
      const analytics = await errorLogger.getAnalytics();
      expect(Array.isArray(analytics.unresolvedErrors)).toBe(true);

      if (analytics.unresolvedErrors.length > 0) {
        expect(analytics.unresolvedErrors[0].resolution?.resolved).toBeFalsy();
      }
    });

    it('should include error trends', async () => {
      const analytics = await errorLogger.getAnalytics();
      expect(analytics.errorTrends).toBeDefined();
      expect(typeof analytics.errorTrends).toBe('object');
    });
  });

  describe('Error categorization', () => {
    it('should categorize platform errors correctly', async () => {
      const error = new Error('Connection failed');
      const entry = await errorLogger.logPlatformError('telegram', error, 'connect');
      expect(entry.category).toBe(ErrorCategory.PLATFORM_CONNECTION);
    });

    it('should categorize message errors correctly', async () => {
      const error = new Error('Send failed');
      const entry = await errorLogger.logMessageError('discord', 'user123', error);
      expect(entry.category).toBe(ErrorCategory.MESSAGE_DELIVERY);
    });

    it('should categorize file errors correctly', async () => {
      const error = new Error('Upload failed');
      const entry = await errorLogger.logFileTransferError(
        'telegram',
        'user123',
        error,
        'file.pdf',
        'upload'
      );
      expect(entry.category).toBe(ErrorCategory.FILE_TRANSFER);
    });

    it('should categorize database errors correctly', async () => {
      const error = new Error('Query failed');
      const entry = await errorLogger.logDatabaseError(error, 'query');
      expect(entry.category).toBe(ErrorCategory.DATABASE);
    });

    it('should categorize security errors correctly', async () => {
      const error = new Error('Unauthorized');
      const entry = await errorLogger.logSecurityError(
        error,
        ErrorCategory.SECURITY_VIOLATION,
        { component: 'auth', operation: 'verify' }
      );
      expect(entry.category).toBe(ErrorCategory.SECURITY_VIOLATION);
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance from getErrorLogger', () => {
      const logger1 = getErrorLogger();
      const logger2 = getErrorLogger();
      expect(logger1).toBe(logger2);
    });

    it('should create new instance from createErrorLogger', () => {
      const logger1 = createErrorLogger();
      const logger2 = createErrorLogger();
      expect(logger1).not.toBe(logger2);
    });
  });
});
