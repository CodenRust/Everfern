/**
 * Security and Resource Limits
 *
 * Implements security controls and resource limits for the Enhanced Browser Research System:
 * - Input sanitization for search queries
 * - URL validation to prevent dangerous schemes
 * - Resource limits (max tabs, max steps, timeouts)
 * - Browser sandboxing with separate user data directories
 *
 * Validates Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { URL } from 'url';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';

/**
 * Security configuration constants
 */
export const SECURITY_LIMITS = {
  // Resource limits
  MAX_BROWSER_TABS: 5,
  MAX_RESEARCH_STEPS: 30,
  MAX_OPERATION_TIMEOUT_MS: 30000,
  MAX_PAGE_LOAD_TIMEOUT_MS: 20000,
  MAX_CLICK_TIMEOUT_MS: 5000,

  // Input limits
  MAX_QUERY_LENGTH: 1000,
  MAX_URL_LENGTH: 2048,

  // Dangerous URL schemes
  BLOCKED_SCHEMES: ['file', 'javascript', 'data', 'vbscript', 'about'],

  // Dangerous patterns in URLs
  BLOCKED_PATTERNS: [
    /javascript:/i,
    /data:/i,
    /file:/i,
    /vbscript:/i,
    /<script/i,
    /on\w+=/i, // Event handlers like onclick=
  ]
} as const;

/**
 * Result of input sanitization
 */
export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  removedChars: string[];
}

/**
 * Result of URL validation
 */
export interface URLValidationResult {
  isValid: boolean;
  url?: string;
  error?: string;
  blockedReason?: string;
}

/**
 * Resource usage tracker
 */
export interface ResourceUsage {
  activeTabs: number;
  stepsExecuted: number;
  startTime: number;
}

/**
 * Sanitizes user input in search queries
 * Validates: Requirement 10.1
 *
 * Removes special characters that could be used for injection attacks:
 * - Script tags and HTML
 * - SQL injection characters
 * - Command injection characters
 * - Control characters
 */
export function sanitizeQuery(query: string): SanitizationResult {
  const original = query;
  const removedChars: string[] = [];

  // Truncate to max length
  let sanitized = query.slice(0, SECURITY_LIMITS.MAX_QUERY_LENGTH);

  // Remove control characters (except newline, tab, carriage return)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (char) => {
    removedChars.push(`control-char-${char.charCodeAt(0)}`);
    return '';
  });

  // Remove HTML/script tags
  const htmlPattern = /<[^>]*>/g;
  sanitized = sanitized.replace(htmlPattern, (match) => {
    removedChars.push(match);
    return '';
  });

  // Remove SQL injection patterns
  const sqlPatterns = [
    /--/g,        // SQL comments
    /;[\s]*drop/gi,
    /;[\s]*delete/gi,
    /;[\s]*insert/gi,
    /;[\s]*update/gi,
    /union[\s]+select/gi,
  ];

  for (const pattern of sqlPatterns) {
    sanitized = sanitized.replace(pattern, (match) => {
      removedChars.push(match);
      return '';
    });
  }

  // Remove command injection characters
  const cmdChars = ['|', '&', ';', '$', '`', '\n', '\r'];
  for (const char of cmdChars) {
    if (sanitized.includes(char)) {
      removedChars.push(char);
      sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), '');
    }
  }

  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return {
    sanitized,
    wasModified: sanitized !== original,
    removedChars: [...new Set(removedChars)] // Deduplicate
  };
}

/**
 * Validates URLs before navigation
 * Validates: Requirement 10.2
 *
 * Rejects dangerous URL schemes:
 * - file:// (local file access)
 * - javascript: (code execution)
 * - data: (data URIs that can contain scripts)
 * - vbscript: (VBScript execution)
 * - about: (browser internal pages)
 */
export function validateURL(urlString: string): URLValidationResult {
  // Check length
  if (urlString.length > SECURITY_LIMITS.MAX_URL_LENGTH) {
    return {
      isValid: false,
      error: `URL exceeds maximum length of ${SECURITY_LIMITS.MAX_URL_LENGTH} characters`
    };
  }

  // Check for blocked patterns before parsing
  for (const pattern of SECURITY_LIMITS.BLOCKED_PATTERNS) {
    if (pattern.test(urlString)) {
      return {
        isValid: false,
        error: 'URL contains blocked pattern',
        blockedReason: `Pattern: ${pattern.source}`
      };
    }
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid URL format'
    };
  }

  // Check scheme
  const scheme = parsedUrl.protocol.replace(':', '').toLowerCase();
  if ((SECURITY_LIMITS.BLOCKED_SCHEMES as readonly string[]).includes(scheme)) {
    return {
      isValid: false,
      error: 'Blocked URL scheme',
      blockedReason: `Scheme '${scheme}' is not allowed`
    };
  }

  // Only allow http and https
  if (scheme !== 'http' && scheme !== 'https') {
    return {
      isValid: false,
      error: 'Only HTTP and HTTPS schemes are allowed',
      blockedReason: `Scheme '${scheme}' is not supported`
    };
  }

  // Check for localhost/private IPs (optional security measure)
  const hostname = parsedUrl.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^::1$/,
    /^fe80:/i
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      // Log warning but allow (some legitimate use cases)
      console.warn(`Warning: Navigating to private/local address: ${hostname}`);
    }
  }

  return {
    isValid: true,
    url: parsedUrl.href
  };
}

/**
 * Resource usage tracker for enforcing limits
 * Validates: Requirements 10.3, 10.4, 10.5
 */
export class ResourceLimiter {
  private usage: ResourceUsage;

  constructor() {
    this.usage = {
      activeTabs: 0,
      stepsExecuted: 0,
      startTime: Date.now()
    };
  }

  /**
   * Checks if a new tab can be opened
   * Validates: Requirement 10.3
   */
  canOpenTab(): boolean {
    return this.usage.activeTabs < SECURITY_LIMITS.MAX_BROWSER_TABS;
  }

  /**
   * Registers a new tab being opened
   */
  registerTab(): void {
    if (!this.canOpenTab()) {
      throw new Error(`Cannot open more than ${SECURITY_LIMITS.MAX_BROWSER_TABS} tabs`);
    }
    this.usage.activeTabs++;
  }

  /**
   * Registers a tab being closed
   */
  unregisterTab(): void {
    if (this.usage.activeTabs > 0) {
      this.usage.activeTabs--;
    }
  }

  /**
   * Checks if another research step can be executed
   * Validates: Requirement 10.4
   */
  canExecuteStep(): boolean {
    return this.usage.stepsExecuted < SECURITY_LIMITS.MAX_RESEARCH_STEPS;
  }

  /**
   * Registers a research step being executed
   */
  registerStep(): void {
    if (!this.canExecuteStep()) {
      throw new Error(`Cannot execute more than ${SECURITY_LIMITS.MAX_RESEARCH_STEPS} steps`);
    }
    this.usage.stepsExecuted++;
  }

  /**
   * Checks if the operation has exceeded the timeout
   * Validates: Requirement 10.5
   */
  hasExceededTimeout(): boolean {
    const elapsed = Date.now() - this.usage.startTime;
    return elapsed > SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS;
  }

  /**
   * Gets the remaining time before timeout
   */
  getRemainingTime(): number {
    const elapsed = Date.now() - this.usage.startTime;
    return Math.max(0, SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS - elapsed);
  }

  /**
   * Gets current resource usage
   */
  getUsage(): Readonly<ResourceUsage> {
    return { ...this.usage };
  }

  /**
   * Resets the resource limiter
   */
  reset(): void {
    this.usage = {
      activeTabs: 0,
      stepsExecuted: 0,
      startTime: Date.now()
    };
  }
}

/**
 * Browser sandbox configuration
 * Validates: Requirement 10.6
 */
export interface SandboxConfig {
  userDataDir: string;
  sessionId: string;
  isolated: boolean;
}

/**
 * Creates a sandboxed browser configuration
 * Validates: Requirement 10.6
 *
 * Creates a separate user data directory for each browser session
 * to ensure isolation between research tasks.
 */
export function createSandboxConfig(): SandboxConfig {
  // Generate unique session ID
  const sessionId = randomBytes(16).toString('hex');

  // Create isolated user data directory
  const baseDir = path.join(os.tmpdir(), 'kiro-browser-sandbox');
  const userDataDir = path.join(baseDir, sessionId);

  return {
    userDataDir,
    sessionId,
    isolated: true
  };
}

/**
 * Validates browser launch options for security
 */
export function validateBrowserOptions(options: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Ensure sandbox is not disabled
  if (options.args && Array.isArray(options.args)) {
    const dangerousArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security'
    ];

    for (const arg of dangerousArgs) {
      if (options.args.includes(arg)) {
        errors.push(`Dangerous browser argument detected: ${arg}`);
      }
    }
  }

  // Ensure user data directory is set
  if (!options.userDataDir) {
    errors.push('User data directory must be specified for sandboxing');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Timeout wrapper for async operations
 * Validates: Requirement 10.5
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'Operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Creates a timeout controller for operations
 */
export class TimeoutController {
  private timeoutId?: NodeJS.Timeout;
  private aborted = false;

  constructor(private timeoutMs: number, private operationName: string) {}

  /**
   * Starts the timeout
   */
  start(): void {
    this.timeoutId = setTimeout(() => {
      this.aborted = true;
    }, this.timeoutMs);
  }

  /**
   * Clears the timeout
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  /**
   * Checks if the operation was aborted
   */
  isAborted(): boolean {
    return this.aborted;
  }

  /**
   * Throws an error if aborted
   */
  checkAborted(): void {
    if (this.aborted) {
      throw new Error(`${this.operationName} timed out after ${this.timeoutMs}ms`);
    }
  }
}

/**
 * Security utilities export
 */
export const SecurityUtils = {
  sanitizeQuery,
  validateURL,
  createSandboxConfig,
  validateBrowserOptions,
  withTimeout,
  LIMITS: SECURITY_LIMITS
};

/**
 * Factory function to create a ResourceLimiter
 */
export function createResourceLimiter(): ResourceLimiter {
  return new ResourceLimiter();
}
