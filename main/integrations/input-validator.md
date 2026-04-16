# Input Validator Documentation

## Overview

The Input Validator provides comprehensive security validation for all user inputs from external messaging platforms. It prevents injection attacks, filters content, validates files, and implements rate limiting to ensure system security.

## Features

### 1. Injection Attack Prevention
- **SQL Injection**: Detects SQL injection patterns like `'; DROP TABLE users; --`
- **XSS Prevention**: Blocks script tags, iframe elements, and javascript: protocols
- **Command Injection**: Prevents shell command execution attempts

### 2. Content Filtering
- **Profanity Detection**: Configurable profanity filtering with warning system
- **Spam Detection**: Identifies spam patterns like excessive caps, repeated characters
- **URL Validation**: Blocks malicious domains and suspicious URL patterns

### 3. File Validation
- **File Type Restrictions**: Only allows whitelisted MIME types
- **Size Limits**: Configurable maximum file size (default: 25MB)
- **Filename Sanitization**: Removes dangerous characters and patterns
- **Suspicious File Detection**: Warns about double extensions and executable files

### 4. Rate Limiting
- **Message Rate Limiting**: Configurable messages per minute per user
- **File Upload Limiting**: Separate limits for file uploads per hour
- **Burst Protection**: Allows temporary bursts within limits

### 5. Webhook Security
- **Signature Validation**: HMAC signature verification for webhook requests
- **Timestamp Validation**: Prevents replay attacks with request age limits
- **Secure Comparison**: Timing-safe signature comparison

## Usage

### Basic Setup

```typescript
import { InputValidator, createInputValidator } from './input-validator';

const validator = createInputValidator({
  enableProfanityFilter: true,
  enableSpamDetection: true,
  maxMessageLength: 4000,
  rateLimiting: {
    messagesPerMinute: 30,
    filesPerHour: 10,
    burstAllowance: 5
  }
}, {
  secretKey: 'your-webhook-secret',
  hashAlgorithm: 'sha256',
  maxRequestAge: 300
});
```

### Message Validation

```typescript
const result = await validator.validateMessage(incomingMessage);

if (!result.valid) {
  console.error('Validation failed:', result.errors);
  // Handle validation failure
  return;
}

if (result.warnings.length > 0) {
  console.warn('Validation warnings:', result.warnings);
  // Log warnings but continue processing
}

// Use sanitized message
const sanitizedMessage = result.sanitized;
```

### Webhook Validation

```typescript
const isValid = validator.validateWebhookSignature(
  payload,
  signature,
  timestamp
);

if (!isValid) {
  // Reject webhook request
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### Rate Limit Checking

```typescript
const status = validator.getRateLimitStatus('user123');
console.log(`User has sent ${status.messages} messages, ${status.files} files`);
console.log(`Rate limits reset at: ${new Date(status.resetTime)}`);
```

## Integration with Bot Manager

The Input Validator is automatically integrated with the Bot Integration Manager:

```typescript
const botManager = new BotIntegrationManager({
  validation: {
    enabled: true,
    contentFilter: {
      enableProfanityFilter: true,
      enableSpamDetection: true,
      maxMessageLength: 4000,
      rateLimiting: {
        messagesPerMinute: 30,
        filesPerHour: 10,
        burstAllowance: 5
      }
    },
    webhook: {
      secretKey: process.env.WEBHOOK_SECRET,
      hashAlgorithm: 'sha256',
      maxRequestAge: 300
    }
  }
});

// Listen for validation events
botManager.on('validationError', (message, result) => {
  console.error(`Validation failed for user ${message.user.id}:`, result.errors);
});

botManager.on('validationWarning', (message, result) => {
  console.warn(`Validation warnings for user ${message.user.id}:`, result.warnings);
});
```

## Configuration Options

### Content Filter Configuration

```typescript
interface ContentFilterConfig {
  enableProfanityFilter: boolean;     // Enable profanity detection
  enableSpamDetection: boolean;       // Enable spam pattern detection
  maxMessageLength: number;           // Maximum message length
  maxFileSize: number;                // Maximum file size in bytes
  allowedFileTypes: string[];         // Allowed MIME types
  blockedDomains: string[];           // Blocked domain list
  rateLimiting: {
    messagesPerMinute: number;        // Messages per minute per user
    filesPerHour: number;             // Files per hour per user
    burstAllowance: number;           // Burst allowance
  };
}
```

### Webhook Configuration

```typescript
interface WebhookConfig {
  secretKey: string;                  // HMAC secret key
  signatureHeader: string;            // Signature header name
  hashAlgorithm: string;              // Hash algorithm (sha256, sha1)
  maxRequestAge: number;              // Maximum request age in seconds
}
```

## Security Considerations

1. **Defense in Depth**: The validator provides multiple layers of security validation
2. **Rate Limiting**: Prevents abuse and DoS attacks through configurable rate limits
3. **Input Sanitization**: All text input is sanitized to remove dangerous characters
4. **File Security**: Comprehensive file validation prevents malicious uploads
5. **Webhook Security**: HMAC signature validation prevents unauthorized requests

## Error Handling

The validator provides detailed error information:

```typescript
interface ValidationResult {
  valid: boolean;                     // Whether input is valid
  sanitized?: any;                    // Sanitized input (if valid)
  errors: string[];                   // Validation errors
  warnings: string[];                 // Security warnings
  riskLevel: 'low' | 'medium' | 'high' | 'critical';  // Risk assessment
}
```

## Performance

- **Efficient Patterns**: Optimized regex patterns for fast validation
- **Memory Management**: Automatic cleanup of rate limit trackers
- **Minimal Overhead**: Lightweight validation with configurable features
- **Async Support**: Non-blocking validation for file operations

## Testing

The validator includes comprehensive tests covering:
- Injection attack detection
- Content filtering
- File validation
- Rate limiting
- Webhook signature validation
- Error handling
- Configuration updates

Run tests with:
```bash
npm test -- main/integrations/__tests__/input-validator.test.ts
```

## Future Enhancements

1. **Machine Learning**: Advanced spam and abuse detection
2. **Content Analysis**: Image and video content scanning
3. **Reputation System**: User-based trust scoring
4. **Advanced Filtering**: Context-aware content filtering
5. **Audit Logging**: Comprehensive security event logging
