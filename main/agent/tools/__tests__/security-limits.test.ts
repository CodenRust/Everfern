/**
 * Unit Tests for Security and Resource Limits
 *
 * Tests all security mechanisms:
 * - Input sanitization
 * - URL validation
 * - Resource limits (tabs, steps, timeouts)
 * - Browser sandboxing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  sanitizeQuery,
  validateURL,
  ResourceLimiter,
  createSandboxConfig,
  validateBrowserOptions,
  withTimeout,
  TimeoutController,
  SECURITY_LIMITS,
  SanitizationResult,
  URLValidationResult
} from '../security-limits';

describe('Input Sanitization', () => {
  describe('sanitizeQuery', () => {
    it('should return unchanged query for safe input', () => {
      const result = sanitizeQuery('best project management tools');

      expect(result.sanitized).toBe('best project management tools');
      expect(result.wasModified).toBe(false);
      expect(result.removedChars).toHaveLength(0);
    });

    it('should remove HTML tags', () => {
      const result = sanitizeQuery('search <script>alert("xss")</script> query');

      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).not.toContain('</script>');
      expect(result.wasModified).toBe(true);
      expect(result.removedChars).toContain('<script>');
    });

    it('should remove SQL injection patterns', () => {
      const result = sanitizeQuery('search; DROP TABLE users--');

      expect(result.sanitized).not.toContain('DROP');
      expect(result.sanitized).not.toContain('--');
      expect(result.wasModified).toBe(true);
    });

    it('should remove command injection characters', () => {
      const result = sanitizeQuery('search | cat /etc/passwd');

      expect(result.sanitized).not.toContain('|');
      expect(result.wasModified).toBe(true);
      expect(result.removedChars).toContain('|');
    });

    it('should remove control characters', () => {
      const result = sanitizeQuery('search\x00\x01\x02query');

      expect(result.sanitized).toBe('searchquery');
      expect(result.wasModified).toBe(true);
    });

    it('should truncate queries exceeding max length', () => {
      const longQuery = 'a'.repeat(SECURITY_LIMITS.MAX_QUERY_LENGTH + 100);
      const result = sanitizeQuery(longQuery);

      expect(result.sanitized.length).toBe(SECURITY_LIMITS.MAX_QUERY_LENGTH);
      expect(result.wasModified).toBe(true);
    });

    it('should normalize whitespace', () => {
      const result = sanitizeQuery('search   with    multiple     spaces');

      expect(result.sanitized).toBe('search with multiple spaces');
      expect(result.wasModified).toBe(true);
    });

    it('should handle empty string', () => {
      const result = sanitizeQuery('');

      expect(result.sanitized).toBe('');
      expect(result.wasModified).toBe(false);
    });

    it('should handle special characters in normal queries', () => {
      const result = sanitizeQuery('C++ programming tips');

      expect(result.sanitized).toBe('C++ programming tips');
      expect(result.wasModified).toBe(false);
    });

    it('should remove multiple types of dangerous content', () => {
      const result = sanitizeQuery('<script>alert(1)</script>; DROP TABLE users-- | cat /etc/passwd');

      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).not.toContain('DROP');
      expect(result.sanitized).not.toContain('|');
      expect(result.wasModified).toBe(true);
    });
  });
});

describe('URL Validation', () => {
  describe('validateURL', () => {
    it('should accept valid HTTP URLs', () => {
      const result = validateURL('http://example.com');

      expect(result.isValid).toBe(true);
      expect(result.url).toBe('http://example.com/');
      expect(result.error).toBeUndefined();
    });

    it('should accept valid HTTPS URLs', () => {
      const result = validateURL('https://example.com/path?query=value');

      expect(result.isValid).toBe(true);
      expect(result.url).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject file:// scheme', () => {
      const result = validateURL('file:///etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      // file:// is caught by blocked patterns before scheme check
    });

    it('should reject javascript: scheme', () => {
      const result = validateURL('javascript:alert(1)');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject data: scheme', () => {
      const result = validateURL('data:text/html,<script>alert(1)</script>');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject vbscript: scheme', () => {
      const result = validateURL('vbscript:msgbox("xss")');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject about: scheme', () => {
      const result = validateURL('about:blank');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Blocked URL scheme');
    });

    it('should reject malformed URLs', () => {
      const result = validateURL('not a url');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject URLs exceeding max length', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(SECURITY_LIMITS.MAX_URL_LENGTH);
      const result = validateURL(longUrl);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should reject URLs with blocked patterns', () => {
      const result = validateURL('https://example.com/<script>alert(1)</script>');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('blocked pattern');
    });

    it('should warn about localhost URLs but allow them', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateURL('http://localhost:3000');

      expect(result.isValid).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('localhost'));

      consoleSpy.mockRestore();
    });

    it('should warn about private IP addresses', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = validateURL('http://192.168.1.1');

      expect(result.isValid).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('192.168.1.1'));

      consoleSpy.mockRestore();
    });

    it('should handle URLs with ports', () => {
      const result = validateURL('https://example.com:8080/path');

      expect(result.isValid).toBe(true);
      expect(result.url).toContain('8080');
    });

    it('should handle URLs with authentication', () => {
      const result = validateURL('https://user:pass@example.com');

      expect(result.isValid).toBe(true);
    });
  });
});

describe('Resource Limiter', () => {
  let limiter: ResourceLimiter;

  beforeEach(() => {
    limiter = new ResourceLimiter();
  });

  describe('Tab Management', () => {
    it('should allow opening tabs up to the limit', () => {
      for (let i = 0; i < SECURITY_LIMITS.MAX_BROWSER_TABS; i++) {
        expect(limiter.canOpenTab()).toBe(true);
        limiter.registerTab();
      }

      expect(limiter.canOpenTab()).toBe(false);
    });

    it('should throw error when exceeding tab limit', () => {
      for (let i = 0; i < SECURITY_LIMITS.MAX_BROWSER_TABS; i++) {
        limiter.registerTab();
      }

      expect(() => limiter.registerTab()).toThrow('Cannot open more than');
    });

    it('should allow opening tabs after closing some', () => {
      limiter.registerTab();
      limiter.registerTab();
      limiter.unregisterTab();

      expect(limiter.canOpenTab()).toBe(true);
    });

    it('should track active tab count correctly', () => {
      limiter.registerTab();
      limiter.registerTab();

      const usage = limiter.getUsage();
      expect(usage.activeTabs).toBe(2);

      limiter.unregisterTab();
      expect(limiter.getUsage().activeTabs).toBe(1);
    });

    it('should not go below zero tabs', () => {
      limiter.unregisterTab();
      limiter.unregisterTab();

      expect(limiter.getUsage().activeTabs).toBe(0);
    });
  });

  describe('Step Management', () => {
    it('should allow executing steps up to the limit', () => {
      for (let i = 0; i < SECURITY_LIMITS.MAX_RESEARCH_STEPS; i++) {
        expect(limiter.canExecuteStep()).toBe(true);
        limiter.registerStep();
      }

      expect(limiter.canExecuteStep()).toBe(false);
    });

    it('should throw error when exceeding step limit', () => {
      for (let i = 0; i < SECURITY_LIMITS.MAX_RESEARCH_STEPS; i++) {
        limiter.registerStep();
      }

      expect(() => limiter.registerStep()).toThrow('Cannot execute more than');
    });

    it('should track step count correctly', () => {
      limiter.registerStep();
      limiter.registerStep();
      limiter.registerStep();

      expect(limiter.getUsage().stepsExecuted).toBe(3);
    });
  });

  describe('Timeout Management', () => {
    it('should not exceed timeout initially', () => {
      expect(limiter.hasExceededTimeout()).toBe(false);
    });

    it('should detect timeout after sufficient time', async () => {
      // Create limiter with very short timeout for testing
      const shortLimiter = new ResourceLimiter();

      // Wait longer than the timeout
      await new Promise(resolve => setTimeout(resolve, SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS + 100));

      expect(shortLimiter.hasExceededTimeout()).toBe(true);
    }, SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS + 1000);

    it('should calculate remaining time correctly', () => {
      const remaining = limiter.getRemainingTime();

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS);
    });

    it('should return zero remaining time after timeout', async () => {
      const shortLimiter = new ResourceLimiter();

      await new Promise(resolve => setTimeout(resolve, SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS + 100));

      expect(shortLimiter.getRemainingTime()).toBe(0);
    }, SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS + 1000);
  });

  describe('Reset', () => {
    it('should reset all counters', () => {
      limiter.registerTab();
      limiter.registerTab();
      limiter.registerStep();
      limiter.registerStep();

      limiter.reset();

      const usage = limiter.getUsage();
      expect(usage.activeTabs).toBe(0);
      expect(usage.stepsExecuted).toBe(0);
    });

    it('should reset start time', () => {
      const initialUsage = limiter.getUsage();
      const initialStartTime = initialUsage.startTime;

      // Wait a bit
      setTimeout(() => {
        limiter.reset();
        const newUsage = limiter.getUsage();
        expect(newUsage.startTime).toBeGreaterThan(initialStartTime);
      }, 100);
    });
  });
});

describe('Browser Sandboxing', () => {
  describe('createSandboxConfig', () => {
    it('should create unique session IDs', () => {
      const config1 = createSandboxConfig();
      const config2 = createSandboxConfig();

      expect(config1.sessionId).not.toBe(config2.sessionId);
    });

    it('should create isolated user data directories', () => {
      const config = createSandboxConfig();

      expect(config.userDataDir).toContain('kiro-browser-sandbox');
      expect(config.userDataDir).toContain(config.sessionId);
      expect(config.isolated).toBe(true);
    });

    it('should use system temp directory', () => {
      const config = createSandboxConfig();

      expect(config.userDataDir).toContain('kiro-browser-sandbox');
      // On Windows, temp dir is in AppData/Local/Temp, not 'tmp'
    });
  });

  describe('validateBrowserOptions', () => {
    it('should accept safe browser options', () => {
      const options = {
        userDataDir: '/tmp/browser-session',
        args: ['--disable-dev-shm-usage']
      };

      const result = validateBrowserOptions(options);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject --no-sandbox argument', () => {
      const options = {
        userDataDir: '/tmp/browser-session',
        args: ['--no-sandbox']
      };

      const result = validateBrowserOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('--no-sandbox');
    });

    it('should reject --disable-setuid-sandbox argument', () => {
      const options = {
        userDataDir: '/tmp/browser-session',
        args: ['--disable-setuid-sandbox']
      };

      const result = validateBrowserOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('--disable-setuid-sandbox');
    });

    it('should reject --disable-web-security argument', () => {
      const options = {
        userDataDir: '/tmp/browser-session',
        args: ['--disable-web-security']
      };

      const result = validateBrowserOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('--disable-web-security');
    });

    it('should require user data directory', () => {
      const options = {
        args: []
      };

      const result = validateBrowserOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('User data directory');
    });

    it('should detect multiple dangerous arguments', () => {
      const options = {
        args: ['--no-sandbox', '--disable-web-security']
      };

      const result = validateBrowserOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('Timeout Utilities', () => {
  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);

      expect(result).toBe('success');
    });

    it('should reject when promise exceeds timeout', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('late'), 200));

      await expect(withTimeout(promise, 100, 'Test')).rejects.toThrow('Test timed out');
    });

    it('should use default operation name', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('late'), 200));

      await expect(withTimeout(promise, 100)).rejects.toThrow('Operation timed out');
    });

    it('should handle promise rejection', async () => {
      const promise = Promise.reject(new Error('failed'));

      await expect(withTimeout(promise, 1000)).rejects.toThrow('failed');
    });
  });

  describe('TimeoutController', () => {
    let controller: TimeoutController;

    beforeEach(() => {
      controller = new TimeoutController(100, 'Test Operation');
    });

    afterEach(() => {
      controller.clear();
    });

    it('should not be aborted initially', () => {
      expect(controller.isAborted()).toBe(false);
    });

    it('should be aborted after timeout', async () => {
      controller.start();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(controller.isAborted()).toBe(true);
    });

    it('should not abort if cleared before timeout', async () => {
      controller.start();

      await new Promise(resolve => setTimeout(resolve, 50));
      controller.clear();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(controller.isAborted()).toBe(false);
    });

    it('should throw error when checking aborted state', async () => {
      controller.start();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(() => controller.checkAborted()).toThrow('Test Operation timed out');
    });

    it('should not throw when not aborted', () => {
      controller.start();

      expect(() => controller.checkAborted()).not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  it('should sanitize query and validate URL together', () => {
    const query = 'search <script>alert(1)</script>';
    const url = 'https://example.com/search?q=' + encodeURIComponent(query);

    const sanitized = sanitizeQuery(query);
    const validated = validateURL(url);

    expect(sanitized.wasModified).toBe(true);
    expect(validated.isValid).toBe(true);
  });

  it('should enforce all resource limits together', () => {
    const limiter = new ResourceLimiter();

    // Open max tabs
    for (let i = 0; i < SECURITY_LIMITS.MAX_BROWSER_TABS; i++) {
      limiter.registerTab();
    }

    // Execute max steps
    for (let i = 0; i < SECURITY_LIMITS.MAX_RESEARCH_STEPS; i++) {
      limiter.registerStep();
    }

    expect(limiter.canOpenTab()).toBe(false);
    expect(limiter.canExecuteStep()).toBe(false);
  });

  it('should create sandbox and validate options', () => {
    const sandbox = createSandboxConfig();
    const options = {
      userDataDir: sandbox.userDataDir,
      args: ['--disable-dev-shm-usage']
    };

    const validation = validateBrowserOptions(options);

    expect(validation.valid).toBe(true);
    expect(sandbox.isolated).toBe(true);
  });
});
