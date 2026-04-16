# Comprehensive Error Logging System

## Overview

The comprehensive error logging system provides detailed error tracking, categorization, severity levels, and administrator notifications for the multi-platform integration system. This system fulfills Requirements 9.6 and 9.7 from the multi-platform integration specification.

## Features

### 1. Detailed Error Logging with Context
- **Full Error Context**: Captures error message, stack trace, error code, and custom metadata
- **Environment Information**: Automatically captures Node.js version, platform, architecture, and memory usage
- **Operation Context**: Records component, operation, platform, user ID, conversation ID, and message ID
- **Timestamp Tracking**: Precise timestamp for each error occurrence

### 2. Error Categorization
Errors are categorized into the following types:
- **Platform Errors**: Connection, API, authentication, rate limiting
- **Integration Errors**: Message delivery, processing, file transfer, conversation sync
- **System Errors**: Database, file system, configuration, encryption
- **Security Errors**: Authentication, authorization, input validation, security violations
- **Application Errors**: Agent execution, tool execution, state management

### 3. Severity Levels
Four severity levels for error prioritization:
- **LOW**: Minor issues that don't affect functionality
- **MEDIUM**: Issues that may affect some functionality
- **HIGH**: Serious issues requiring attention
- **CRITICAL**: Severe issues requiring immediate action

### 4. Administrator Notification System
- **Automatic Notifications**: Configurable thresholds for admin alerts
- **Rate Limiting**: Prevents notification spam with configurable limits
- **Critical Category Alerts**: Always notify for critical error categories
- **Integration with Admin Notification Manager**: Seamless integration with existing notification system

### 5. Error Analytics and Reporting
- **Statistics Dashboard**: Total errors, errors by severity, category, platform, and component
- **Error Rate Calculation**: Errors per hour tracking
- **Top Errors Identification**: Most common errors with counts
- **Error Trends**: Hourly error trends over 24-hour periods
- **Unresolved Error Tracking**: Monitor errors awaiting resolution

### 6. Retry Tracking
- **Retry Information**: Track retry attempts, max attempts, and next retry time
- **Exponential Backoff Support**: Built-in support for retry strategies

### 7. Error Resolution Management
- **Resolution Tracking**: Mark errors as resolved with notes
- **Resolution Metadata**: Track who resolved the error and when
- **Resolution Events**: Event emission for monitoring

## Usage

### Basic Error Logging

```typescript
import { getErrorLogger, ErrorSeverity, ErrorCategory } from './error-logger';

const errorLogger = getErrorLogger();

// Log a basic error
try {
  // Some operation
} catch (error) {
  await errorLogger.logError(
    error as Error,
    ErrorSeverity.MEDIUM,
    ErrorCategory.MESSAGE_DELIVERY,
    {
      component: 'bot-manager',
      operation: 'send_message',
      platform: 'telegram',
      userId: 'user123'
    }
  );
}
```

### Platform-Specific Error Logging

```typescript
// Log platform connection error
await errorLogger.logPlatformError(
  'telegram',
  error,
  'connect',
  { timeout: 5000 }
);

// Log message delivery error with retry info
await errorLogger.logMessageError(
  'discord',
  'user456',
  error,
  'msg123',
  'conv789',
  {
    attempt: 2,
    maxAttempts: 3,
    nextRetryAt: new Date(Date.now() + 5000)
  }
);

// Log file transfer error
await errorLogger.logFileTransferError(
  'telegram',
  'user123',
  error,
  'document.pdf',
  'upload'
);
```

### Database and Security Error Logging

```typescript
// Log database error
await errorLogger.logDatabaseError(
  error,
  'query',
  { table: 'users', operation: 'SELECT' }
);

// Log security error
await errorLogger.logSecurityError(
  error,
  ErrorCategory.SECURITY_VIOLATION,
  {
    component: 'auth',
    operation: 'verify',
    userId: 'user123'
  }
);
```

### Retrieving and Filtering Errors

```typescript
// Get all errors
const allErrors = errorLogger.getErrors();

// Get errors by severity
const criticalErrors = errorLogger.getErrors({
  severity: [ErrorSeverity.CRITICAL, ErrorSeverity.HIGH]
});

// Get errors by category
const platformErrors = errorLogger.getErrors({
  category: [ErrorCategory.PLATFORM_CONNECTION, ErrorCategory.PLATFORM_API]
});

// Get errors by platform
const telegramErrors = errorLogger.getErrors({
  platform: ['telegram']
});

// Get unresolved errors
const unresolvedErrors = errorLogger.getErrors({
  resolved: false,
  limit: 50
});

// Get errors in date range
const recentErrors = errorLogger.getErrors({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  endDate: new Date(),
  limit: 100
});
```

### Error Statistics and Analytics

```typescript
// Get statistics for last 24 hours
const stats = await errorLogger.getStatistics();

console.log(`Total errors: ${stats.totalErrors}`);
console.log(`Error rate: ${stats.errorRate.toFixed(2)} errors/hour`);
console.log(`Critical errors: ${stats.bySeverity.critical}`);
console.log(`Top error: ${stats.topErrors[0]?.message}`);

// Get comprehensive analytics
const analytics = await errorLogger.getAnalytics();

console.log('Recent errors:', analytics.recentErrors.length);
console.log('Critical errors:', analytics.criticalErrors.length);
console.log('Unresolved errors:', analytics.unresolvedErrors.length);
```

### Resolving Errors

```typescript
// Resolve an error
const resolved = await errorLogger.resolveError(
  'err_1234567890_abcd',
  'admin@example.com',
  'Fixed by restarting the Telegram bot service'
);

if (resolved) {
  console.log('Error resolved successfully');
}
```

### Event Listeners

```typescript
// Listen for new errors
errorLogger.on('error-logged', (entry) => {
  console.log(`New error: ${entry.severity} - ${entry.message}`);
});

// Listen for resolved errors
errorLogger.on('error-resolved', (entry) => {
  console.log(`Error resolved: ${entry.id}`);
});

// Listen for logging errors
errorLogger.on('logging-error', (error) => {
  console.error('Failed to log error:', error);
});

// Listen for notification errors
errorLogger.on('notification-error', (error) => {
  console.error('Failed to send notification:', error);
});
```

### Custom Configuration

```typescript
import { createErrorLogger, ErrorSeverity, ErrorCategory } from './error-logger';

// Create error logger with custom configuration
const errorLogger = createErrorLogger({
  enabled: true,
  minSeverity: ErrorSeverity.HIGH, // Only notify for high and critical
  criticalCategories: [
    ErrorCategory.SECURITY_VIOLATION,
    ErrorCategory.DATABASE,
    ErrorCategory.ENCRYPTION
  ],
  rateLimit: {
    maxPerHour: 10,
    cooldownMinutes: 5
  }
});
```

## Integration with Existing Systems

### Security Monitor Integration
The error logger automatically integrates with the security monitor for security-related errors:
- Authentication errors
- Authorization errors
- Input validation errors
- Security violations
- Encryption errors

### Admin Notification Integration
The error logger integrates with the admin notification manager to send alerts:
- Critical errors trigger immediate notifications
- Configurable severity thresholds
- Rate limiting to prevent notification spam
- Multiple notification channels (desktop, log, webhook, email)

## File Storage

### Log Files
Error logs are stored in `~/.everfern/error-logs/` directory:
- Daily log files: `errors-YYYY-MM-DD.log`
- JSON Lines format (one JSON object per line)
- Automatic cleanup of old logs (7 days retention in memory)

### Log Entry Format
```json
{
  "id": "err_1234567890_abcd",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "severity": "medium",
  "category": "message_delivery",
  "message": "Failed to send message",
  "error": {
    "name": "Error",
    "message": "Failed to send message",
    "stack": "Error: Failed to send message\n    at ...",
    "code": "ETIMEDOUT"
  },
  "context": {
    "platform": "telegram",
    "userId": "user123",
    "messageId": "msg456",
    "component": "bot-manager",
    "operation": "send_message",
    "environment": {
      "nodeVersion": "v18.0.0",
      "platform": "win32",
      "arch": "x64",
      "memory": {
        "used": 50000000,
        "total": 100000000
      }
    }
  },
  "adminNotified": true,
  "retry": {
    "attempt": 2,
    "maxAttempts": 3,
    "nextRetryAt": "2024-01-15T10:30:05.000Z"
  }
}
```

## Best Practices

### 1. Always Include Context
Provide as much context as possible when logging errors:
```typescript
await errorLogger.logError(error, severity, category, {
  component: 'specific-component',
  operation: 'specific-operation',
  platform: 'telegram',
  userId: 'user123',
  metadata: {
    // Additional relevant information
    messageLength: 150,
    retryCount: 2
  }
});
```

### 2. Use Appropriate Severity Levels
- **LOW**: Warnings, minor issues
- **MEDIUM**: Recoverable errors, retry scenarios
- **HIGH**: Service degradation, important failures
- **CRITICAL**: Security issues, data loss, system failures

### 3. Use Specific Categories
Choose the most specific category for better analytics and filtering.

### 4. Include Retry Information
When implementing retry logic, always include retry information:
```typescript
await errorLogger.logMessageError(
  platform,
  userId,
  error,
  messageId,
  conversationId,
  {
    attempt: currentAttempt,
    maxAttempts: maxRetries,
    nextRetryAt: new Date(Date.now() + backoffMs)
  }
);
```

### 5. Resolve Errors
Mark errors as resolved when fixed:
```typescript
await errorLogger.resolveError(
  errorId,
  'admin@example.com',
  'Fixed by updating bot token'
);
```

### 6. Monitor Analytics
Regularly check error analytics to identify patterns:
```typescript
const analytics = await errorLogger.getAnalytics();

// Check for error spikes
if (analytics.statistics.errorRate > 10) {
  console.warn('High error rate detected!');
}

// Check for unresolved critical errors
if (analytics.criticalErrors.length > 0) {
  console.error('Critical errors require attention!');
}
```

## Testing

The error logging system includes comprehensive unit tests covering:
- Error logging with full context
- Platform-specific error logging
- Message, file, database, and security error logging
- Error filtering and retrieval
- Statistics and analytics calculation
- Error resolution
- Event emission
- Singleton pattern

Run tests:
```bash
npm test -- main/integrations/__tests__/error-logger.test.ts
```

## Requirements Fulfilled

### Requirement 9.6: Detailed Error Logging
✅ Implemented detailed error logging with context information
✅ Captures error message, stack trace, error code
✅ Records component, operation, platform, user context
✅ Stores environment information (Node version, platform, memory)
✅ Includes retry tracking for failed operations
✅ Persists errors to daily log files

### Requirement 9.7: Error Categorization and Administrator Notification
✅ Comprehensive error categorization system (15 categories)
✅ Four severity levels (low, medium, high, critical)
✅ Administrator notification system with rate limiting
✅ Integration with admin notification manager
✅ Configurable notification thresholds
✅ Critical category automatic alerts
✅ Event-based notification system

## Future Enhancements

Potential future improvements:
1. **External Monitoring Integration**: Send errors to external services (Sentry, DataDog)
2. **Machine Learning**: Automatic error pattern detection and prediction
3. **Advanced Analytics**: More sophisticated error trend analysis
4. **Error Grouping**: Automatically group similar errors
5. **Performance Metrics**: Track error impact on system performance
6. **Custom Dashboards**: Web-based error monitoring dashboard
7. **Alert Escalation**: Multi-level alert escalation policies
8. **Error Recovery Suggestions**: AI-powered error resolution suggestions

## Support

For issues or questions about the error logging system:
1. Check this documentation
2. Review the integration examples in `error-logger-integration-example.ts`
3. Examine the unit tests in `__tests__/error-logger.test.ts`
4. Consult the design document in `.kiro/specs/multi-platform-integration/design.md`
