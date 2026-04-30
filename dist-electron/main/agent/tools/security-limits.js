"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityUtils = exports.TimeoutController = exports.ResourceLimiter = exports.SECURITY_LIMITS = void 0;
exports.sanitizeQuery = sanitizeQuery;
exports.validateURL = validateURL;
exports.createSandboxConfig = createSandboxConfig;
exports.validateBrowserOptions = validateBrowserOptions;
exports.withTimeout = withTimeout;
exports.createResourceLimiter = createResourceLimiter;
const url_1 = require("url");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
/**
 * Security configuration constants
 */
exports.SECURITY_LIMITS = {
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
};
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
function sanitizeQuery(query) {
    const original = query;
    const removedChars = [];
    // Truncate to max length
    let sanitized = query.slice(0, exports.SECURITY_LIMITS.MAX_QUERY_LENGTH);
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
        /--/g, // SQL comments
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
function validateURL(urlString) {
    // Check length
    if (urlString.length > exports.SECURITY_LIMITS.MAX_URL_LENGTH) {
        return {
            isValid: false,
            error: `URL exceeds maximum length of ${exports.SECURITY_LIMITS.MAX_URL_LENGTH} characters`
        };
    }
    // Check for blocked patterns before parsing
    for (const pattern of exports.SECURITY_LIMITS.BLOCKED_PATTERNS) {
        if (pattern.test(urlString)) {
            return {
                isValid: false,
                error: 'URL contains blocked pattern',
                blockedReason: `Pattern: ${pattern.source}`
            };
        }
    }
    // Parse URL
    let parsedUrl;
    try {
        parsedUrl = new url_1.URL(urlString);
    }
    catch (error) {
        return {
            isValid: false,
            error: 'Invalid URL format'
        };
    }
    // Check scheme
    const scheme = parsedUrl.protocol.replace(':', '').toLowerCase();
    if (exports.SECURITY_LIMITS.BLOCKED_SCHEMES.includes(scheme)) {
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
class ResourceLimiter {
    usage;
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
    canOpenTab() {
        return this.usage.activeTabs < exports.SECURITY_LIMITS.MAX_BROWSER_TABS;
    }
    /**
     * Registers a new tab being opened
     */
    registerTab() {
        if (!this.canOpenTab()) {
            throw new Error(`Cannot open more than ${exports.SECURITY_LIMITS.MAX_BROWSER_TABS} tabs`);
        }
        this.usage.activeTabs++;
    }
    /**
     * Registers a tab being closed
     */
    unregisterTab() {
        if (this.usage.activeTabs > 0) {
            this.usage.activeTabs--;
        }
    }
    /**
     * Checks if another research step can be executed
     * Validates: Requirement 10.4
     */
    canExecuteStep() {
        return this.usage.stepsExecuted < exports.SECURITY_LIMITS.MAX_RESEARCH_STEPS;
    }
    /**
     * Registers a research step being executed
     */
    registerStep() {
        if (!this.canExecuteStep()) {
            throw new Error(`Cannot execute more than ${exports.SECURITY_LIMITS.MAX_RESEARCH_STEPS} steps`);
        }
        this.usage.stepsExecuted++;
    }
    /**
     * Checks if the operation has exceeded the timeout
     * Validates: Requirement 10.5
     */
    hasExceededTimeout() {
        const elapsed = Date.now() - this.usage.startTime;
        return elapsed > exports.SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS;
    }
    /**
     * Gets the remaining time before timeout
     */
    getRemainingTime() {
        const elapsed = Date.now() - this.usage.startTime;
        return Math.max(0, exports.SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS - elapsed);
    }
    /**
     * Gets current resource usage
     */
    getUsage() {
        return { ...this.usage };
    }
    /**
     * Resets the resource limiter
     */
    reset() {
        this.usage = {
            activeTabs: 0,
            stepsExecuted: 0,
            startTime: Date.now()
        };
    }
}
exports.ResourceLimiter = ResourceLimiter;
/**
 * Creates a sandboxed browser configuration
 * Validates: Requirement 10.6
 *
 * Creates a separate user data directory for each browser session
 * to ensure isolation between research tasks.
 */
function createSandboxConfig() {
    // Generate unique session ID
    const sessionId = (0, crypto_1.randomBytes)(16).toString('hex');
    // Create isolated user data directory
    const baseDir = path_1.default.join(os_1.default.tmpdir(), 'kiro-browser-sandbox');
    const userDataDir = path_1.default.join(baseDir, sessionId);
    return {
        userDataDir,
        sessionId,
        isolated: true
    };
}
/**
 * Validates browser launch options for security
 */
function validateBrowserOptions(options) {
    const errors = [];
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
async function withTimeout(promise, timeoutMs, operationName = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs))
    ]);
}
/**
 * Creates a timeout controller for operations
 */
class TimeoutController {
    timeoutMs;
    operationName;
    timeoutId;
    aborted = false;
    constructor(timeoutMs, operationName) {
        this.timeoutMs = timeoutMs;
        this.operationName = operationName;
    }
    /**
     * Starts the timeout
     */
    start() {
        this.timeoutId = setTimeout(() => {
            this.aborted = true;
        }, this.timeoutMs);
    }
    /**
     * Clears the timeout
     */
    clear() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }
    /**
     * Checks if the operation was aborted
     */
    isAborted() {
        return this.aborted;
    }
    /**
     * Throws an error if aborted
     */
    checkAborted() {
        if (this.aborted) {
            throw new Error(`${this.operationName} timed out after ${this.timeoutMs}ms`);
        }
    }
}
exports.TimeoutController = TimeoutController;
/**
 * Security utilities export
 */
exports.SecurityUtils = {
    sanitizeQuery,
    validateURL,
    createSandboxConfig,
    validateBrowserOptions,
    withTimeout,
    LIMITS: exports.SECURITY_LIMITS
};
/**
 * Factory function to create a ResourceLimiter
 */
function createResourceLimiter() {
    return new ResourceLimiter();
}
