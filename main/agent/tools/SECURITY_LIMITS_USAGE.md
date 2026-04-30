# Security and Resource Limits Usage Guide

This guide explains how to use the security and resource limit utilities in the Enhanced Browser Research System.

## Overview

The security-limits module provides:
- **Input Sanitization**: Removes dangerous characters from user queries
- **URL Validation**: Prevents navigation to dangerous URL schemes
- **Resource Limits**: Enforces limits on tabs, steps, and timeouts
- **Browser Sandboxing**: Isolates browser sessions with separate user data directories

## Quick Start

```typescript
import {
  sanitizeQuery,
  validateURL,
  ResourceLimiter,
  createSandboxConfig,
  validateBrowserOptions,
  withTimeout,
  SECURITY_LIMITS
} from './security-limits';
```

## Input Sanitization

### Basic Usage

```typescript
// Sanitize user input before using in search queries
const userQuery = 'search <script>alert("xss")</script>';
const result = sanitizeQuery(userQuery);

console.log(result.sanitized);    // "search"
console.log(result.wasModified);  // true
console.log(result.removedChars); // ["<script>", "</script>"]
```

### What Gets Removed

- HTML/script tags: `<script>`, `<iframe>`, etc.
- SQL injection patterns: `--`, `DROP TABLE`, `UNION SELECT`, etc.
- Command injection characters: `|`, `&`, `;`, `$`, `` ` ``
- Control characters (except newline, tab, carriage return)
- Excessive whitespace

### Integration Example

```typescript
async function performSearch(userQuery: string) {
  // Always sanitize user input first
  const { sanitized, wasModified } = sanitizeQuery(userQuery);

  if (wasModified) {
    console.warn('User query was sanitized for security');
  }

  // Use sanitized query for search
  return await searchEngine.search(sanitized);
}
```

## URL Validation

### Basic Usage

```typescript
// Validate URLs before navigation
const url = 'https://example.com/page';
const result = validateURL(url);

if (result.isValid) {
  console.log('Safe to navigate:', result.url);
} else {
  console.error('Blocked URL:', result.error);
  console.error('Reason:', result.blockedReason);
}
```

### Blocked URL Schemes

The following schemes are blocked:
- `file://` - Local file access
- `javascript:` - Code execution
- `data:` - Data URIs (can contain scripts)
- `vbscript:` - VBScript execution
- `about:` - Browser internal pages

### Integration Example

```typescript
async function navigateToURL(page: Page, url: string) {
  // Validate URL before navigation
  const validation = validateURL(url);

  if (!validation.isValid) {
    throw new Error(`Cannot navigate to URL: ${validation.error}`);
  }

  // Safe to navigate
  await page.goto(validation.url);
}
```

## Resource Limits

### Basic Usage

```typescript
// Create a resource limiter for a research session
const limiter = new ResourceLimiter();

// Check and register tabs
if (limiter.canOpenTab()) {
  limiter.registerTab();
  // Open browser tab
}

// Check and register steps
if (limiter.canExecuteStep()) {
  limiter.registerStep();
  // Execute research step
}

// Check timeout
if (limiter.hasExceededTimeout()) {
  console.error('Research operation timed out');
}
```

### Resource Limits

- **Max Browser Tabs**: 5 concurrent tabs
- **Max Research Steps**: 30 steps per task
- **Max Operation Timeout**: 30 seconds
- **Max Page Load Timeout**: 20 seconds
- **Max Click Timeout**: 5 seconds

### Integration Example

```typescript
async function executeResearch(plan: ResearchPlan) {
  const limiter = new ResourceLimiter();
  const tabs: Page[] = [];

  try {
    // Open parallel tabs with limit enforcement
    for (let i = 0; i < plan.parallelTasks; i++) {
      if (!limiter.canOpenTab()) {
        console.warn('Reached maximum tab limit');
        break;
      }

      limiter.registerTab();
      const page = await browser.newPage();
      tabs.push(page);
    }

    // Execute research steps with limit enforcement
    for (const step of plan.steps) {
      if (!limiter.canExecuteStep()) {
        console.warn('Reached maximum step limit');
        break;
      }

      if (limiter.hasExceededTimeout()) {
        throw new Error('Research timed out');
      }

      limiter.registerStep();
      await executeStep(step);
    }
  } finally {
    // Clean up tabs
    for (const page of tabs) {
      await page.close();
      limiter.unregisterTab();
    }
  }
}
```

## Browser Sandboxing

### Basic Usage

```typescript
// Create a sandboxed browser configuration
const sandbox = createSandboxConfig();

console.log(sandbox.sessionId);    // Unique session ID
console.log(sandbox.userDataDir);  // Isolated user data directory
console.log(sandbox.isolated);     // true

// Launch browser with sandbox
const browser = await chromium.launch({
  userDataDir: sandbox.userDataDir,
  args: ['--disable-dev-shm-usage']
});
```

### Validating Browser Options

```typescript
// Validate browser options before launch
const options = {
  userDataDir: sandbox.userDataDir,
  args: ['--disable-dev-shm-usage']
};

const validation = validateBrowserOptions(options);

if (!validation.valid) {
  console.error('Invalid browser options:', validation.errors);
  throw new Error('Cannot launch browser with unsafe options');
}

// Safe to launch
const browser = await chromium.launch(options);
```

### Dangerous Arguments

The following browser arguments are blocked:
- `--no-sandbox` - Disables browser sandboxing
- `--disable-setuid-sandbox` - Disables setuid sandbox
- `--disable-web-security` - Disables web security

### Integration Example

```typescript
async function launchSecureBrowser() {
  // Create sandbox configuration
  const sandbox = createSandboxConfig();

  // Prepare browser options
  const options = {
    userDataDir: sandbox.userDataDir,
    args: [
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  // Validate options
  const validation = validateBrowserOptions(options);
  if (!validation.valid) {
    throw new Error(`Invalid browser options: ${validation.errors.join(', ')}`);
  }

  // Launch browser
  const browser = await chromium.launch(options);

  return { browser, sandbox };
}
```

## Timeout Utilities

### Using withTimeout

```typescript
// Wrap async operations with timeout
const result = await withTimeout(
  fetchData(),
  5000,
  'Data fetch'
);
```

### Using TimeoutController

```typescript
// Create a timeout controller
const controller = new TimeoutController(10000, 'Research operation');

try {
  controller.start();

  // Perform operations
  for (const step of steps) {
    controller.checkAborted(); // Throws if timed out
    await executeStep(step);
  }
} finally {
  controller.clear();
}
```

### Integration Example

```typescript
async function performResearchWithTimeout(query: string) {
  const controller = new TimeoutController(
    SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS,
    'Research'
  );

  try {
    controller.start();

    // Plan research
    controller.checkAborted();
    const plan = await planResearch(query);

    // Execute research
    controller.checkAborted();
    const result = await executeResearch(plan);

    return result;
  } finally {
    controller.clear();
  }
}
```

## Complete Integration Example

Here's a complete example integrating all security features:

```typescript
import {
  sanitizeQuery,
  validateURL,
  ResourceLimiter,
  createSandboxConfig,
  validateBrowserOptions,
  TimeoutController,
  SECURITY_LIMITS
} from './security-limits';

async function secureResearch(userQuery: string, targetUrls: string[]) {
  // 1. Sanitize user input
  const { sanitized, wasModified } = sanitizeQuery(userQuery);
  if (wasModified) {
    console.warn('Query was sanitized for security');
  }

  // 2. Validate all URLs
  const validUrls: string[] = [];
  for (const url of targetUrls) {
    const validation = validateURL(url);
    if (validation.isValid) {
      validUrls.push(validation.url!);
    } else {
      console.warn(`Skipping invalid URL: ${url} - ${validation.error}`);
    }
  }

  if (validUrls.length === 0) {
    throw new Error('No valid URLs to research');
  }

  // 3. Create sandbox configuration
  const sandbox = createSandboxConfig();

  // 4. Validate browser options
  const browserOptions = {
    userDataDir: sandbox.userDataDir,
    args: ['--disable-dev-shm-usage']
  };

  const optionsValidation = validateBrowserOptions(browserOptions);
  if (!optionsValidation.valid) {
    throw new Error(`Invalid browser options: ${optionsValidation.errors.join(', ')}`);
  }

  // 5. Create resource limiter
  const limiter = new ResourceLimiter();

  // 6. Create timeout controller
  const timeout = new TimeoutController(
    SECURITY_LIMITS.MAX_OPERATION_TIMEOUT_MS,
    'Research'
  );

  try {
    timeout.start();

    // Launch browser
    const browser = await chromium.launch(browserOptions);
    const tabs: Page[] = [];

    try {
      // Open tabs with limit enforcement
      for (let i = 0; i < Math.min(validUrls.length, SECURITY_LIMITS.MAX_BROWSER_TABS); i++) {
        timeout.checkAborted();

        if (!limiter.canOpenTab()) {
          break;
        }

        limiter.registerTab();
        const page = await browser.newPage();
        tabs.push(page);

        // Navigate to URL
        const url = validUrls[i];
        await page.goto(url, {
          timeout: SECURITY_LIMITS.MAX_PAGE_LOAD_TIMEOUT_MS
        });
      }

      // Execute research steps
      const results: any[] = [];
      for (const page of tabs) {
        timeout.checkAborted();

        if (!limiter.canExecuteStep()) {
          console.warn('Reached step limit');
          break;
        }

        limiter.registerStep();
        const content = await extractPageContent(page);
        results.push(content);
      }

      return results;
    } finally {
      // Clean up tabs
      for (const page of tabs) {
        await page.close();
        limiter.unregisterTab();
      }

      await browser.close();
    }
  } finally {
    timeout.clear();
  }
}
```

## Best Practices

1. **Always sanitize user input** before using it in queries or commands
2. **Always validate URLs** before navigation
3. **Use ResourceLimiter** to enforce tab and step limits
4. **Use sandboxed browser sessions** with separate user data directories
5. **Validate browser options** before launching browsers
6. **Use timeout controllers** for all long-running operations
7. **Clean up resources** in finally blocks
8. **Log security warnings** when input is modified or URLs are blocked

## Security Checklist

- [ ] User input is sanitized with `sanitizeQuery()`
- [ ] URLs are validated with `validateURL()`
- [ ] Resource limits are enforced with `ResourceLimiter`
- [ ] Browser is launched with sandboxed configuration
- [ ] Browser options are validated with `validateBrowserOptions()`
- [ ] Timeouts are enforced with `TimeoutController` or `withTimeout()`
- [ ] Resources are cleaned up in finally blocks
- [ ] Security events are logged for monitoring

## Constants Reference

```typescript
SECURITY_LIMITS = {
  MAX_BROWSER_TABS: 5,
  MAX_RESEARCH_STEPS: 30,
  MAX_OPERATION_TIMEOUT_MS: 30000,
  MAX_PAGE_LOAD_TIMEOUT_MS: 20000,
  MAX_CLICK_TIMEOUT_MS: 5000,
  MAX_QUERY_LENGTH: 1000,
  MAX_URL_LENGTH: 2048,
  BLOCKED_SCHEMES: ['file', 'javascript', 'data', 'vbscript', 'about'],
  BLOCKED_PATTERNS: [/javascript:/i, /data:/i, /file:/i, ...]
}
```
