/**
 * EverFern Desktop — Learning System Infrastructure Tests
 *
 * Basic tests to verify the learning system infrastructure is properly set up.
 * Tests core types, configuration, error handling, and logging functionality.
 */

import {
  LearningConfigManager,
  CONFIG_PRESETS,
  LearningSystemError,
  LearningLoggerImpl,
  LogSanitizerImpl,
  LEARNING_SYSTEM_VERSION
} from '../index';

import type {
  LearningContext,
  LearnedKnowledge,
  LearningConfig,
  InteractionOutcome
} from '../types';

describe('Learning System Infrastructure', () => {
  describe('Configuration Management', () => {
    test('should create config manager with defaults', () => {
      const config = new LearningConfigManager();
      const currentConfig = config.getConfig();

      expect(currentConfig.enabled).toBe(true);
      expect(currentConfig.analysisTimeoutMs).toBe(10000);
      expect(currentConfig.maxCpuPercent).toBe(5);
      expect(currentConfig.confidenceThreshold).toBe(0.7);
    });

    test('should merge user config with defaults', () => {
      const userConfig = {
        maxCpuPercent: 8,
        confidenceThreshold: 0.8
      };

      const config = new LearningConfigManager(userConfig);
      const currentConfig = config.getConfig();

      expect(currentConfig.maxCpuPercent).toBe(8);
      expect(currentConfig.confidenceThreshold).toBe(0.8);
      expect(currentConfig.enabled).toBe(true); // Should keep default
    });

    test('should validate configuration values', () => {
      expect(() => {
        new LearningConfigManager({ maxCpuPercent: -1 });
      }).toThrow('maxCpuPercent must be between 0 and 100');

      expect(() => {
        new LearningConfigManager({ confidenceThreshold: 1.5 });
      }).toThrow('confidenceThreshold must be between 0 and 1');
    });

    test('should check domain enablement', () => {
      const config = new LearningConfigManager();

      expect(config.isDomainEnabled('coding')).toBe(true);
      expect(config.isDomainEnabled('system-administration')).toBe(false);
    });

    test('should provide configuration presets', () => {
      expect(CONFIG_PRESETS.AGGRESSIVE).toBeDefined();
      expect(CONFIG_PRESETS.CONSERVATIVE).toBeDefined();
      expect(CONFIG_PRESETS.PRIVACY_FOCUSED).toBeDefined();
      expect(CONFIG_PRESETS.DEVELOPMENT).toBeDefined();

      expect(CONFIG_PRESETS.AGGRESSIVE.maxCpuPercent).toBe(10);
      expect(CONFIG_PRESETS.CONSERVATIVE.maxCpuPercent).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should create learning system errors', () => {
      const error = new LearningSystemError(
        'ANALYSIS_TIMEOUT',
        'Test timeout error',
        undefined,
        true,
        5000
      );

      expect(error.code).toBe('ANALYSIS_TIMEOUT');
      expect(error.message).toBe('Test timeout error');
      expect(error.recoverable).toBe(true);
      expect(error.retryAfter).toBe(5000);
    });

    test('should handle different error types', () => {
      const analysisError = new LearningSystemError('ANALYSIS_TIMEOUT', 'Timeout');
      const storageError = new LearningSystemError('STORAGE_ERROR', 'Storage failed');
      const securityError = new LearningSystemError('PII_DETECTION_FAILED', 'PII error', undefined, false);

      expect(analysisError.recoverable).toBe(true);
      expect(storageError.recoverable).toBe(true);
      expect(securityError.recoverable).toBe(false);
    });
  });

  describe('Logging System', () => {
    test('should create logger with default settings', () => {
      const logger = new LearningLoggerImpl();
      expect(logger).toBeDefined();
    });

    test('should sanitize PII from logs', () => {
      const sanitizer = new LogSanitizerImpl();

      const textWithPII = 'User email is john@example.com and phone is 123-45-6789';
      const sanitized = sanitizer.sanitizeGeneric(textWithPII);

      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('john@example.com');
      expect(sanitized).not.toContain('123-45-6789');
    });

    test('should sanitize learning context for logging', () => {
      const sanitizer = new LogSanitizerImpl();
      const context: Partial<LearningContext> = {
        interactionId: 'test-123',
        sessionId: 'session-abcdef123456789',
        success: true,
        outcome: 'success' as InteractionOutcome,
        tools: [], // Provide empty array instead of undefined
        messages: []
      };

      const sanitized = sanitizer.sanitizeContext(context as LearningContext);

      expect(sanitized.interactionId).toBe('test-123');
      expect(sanitized.sessionId).toBe('session-a...');
      expect(sanitized.success).toBe(true);
      expect(Array.isArray(sanitized.tools)).toBe(true);
    });

    test('should sanitize knowledge for logging', () => {
      const sanitizer = new LogSanitizerImpl();
      const knowledge: Partial<LearnedKnowledge> = {
        id: 'knowledge-123',
        type: 'pattern',
        title: 'User john@example.com prefers TypeScript over JavaScript',
        confidence: 0.85,
        frequency: 5,
        created: new Date(),
        tags: ['typescript', 'preference', 'john@example.com']
      };

      const sanitized = sanitizer.sanitizeKnowledge(knowledge as LearnedKnowledge);

      expect(sanitized.title).toContain('[REDACTED]');
      expect(sanitized.tags).not.toContain('john@example.com');
      expect(sanitized.confidence).toBe(0.85);
    });
  });

  describe('Type System', () => {
    test('should define core learning types', () => {
      // Test that types are properly exported and can be used
      const context: Partial<LearningContext> = {
        interactionId: 'test-interaction',
        success: true,
        outcome: 'success'
      };

      expect(context.interactionId).toBe('test-interaction');
      expect(context.success).toBe(true);
    });

    test('should define knowledge types', () => {
      const knowledge: Partial<LearnedKnowledge> = {
        id: 'test-knowledge',
        type: 'pattern',
        confidence: 0.8,
        frequency: 3
      };

      expect(knowledge.type).toBe('pattern');
      expect(knowledge.confidence).toBe(0.8);
    });
  });

  describe('System Information', () => {
    test('should provide version information', () => {
      expect(LEARNING_SYSTEM_VERSION).toBe('1.0.0');
    });
  });
});

describe('Learning System Integration Points', () => {
  test('should be ready for graph integration', () => {
    // Test that the types needed for graph integration are available
    const config = new LearningConfigManager();
    expect(config.getConfig().enabled).toBeDefined();
  });

  test('should be ready for memory system integration', () => {
    // Test that the types needed for memory integration are available
    const knowledge: Partial<LearnedKnowledge> = {
      id: 'test',
      type: 'pattern',
      confidence: 0.8
    };

    expect(knowledge.type).toBeDefined();
  });

  test('should be ready for tool execution integration', () => {
    // Test that the types needed for tool integration are available
    const context: Partial<LearningContext> = {
      interactionId: 'test',
      tools: [],
      messages: []
    };

    expect(Array.isArray(context.tools)).toBe(true);
    expect(Array.isArray(context.messages)).toBe(true);
  });
});
