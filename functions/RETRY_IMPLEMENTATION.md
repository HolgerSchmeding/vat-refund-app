# Retry Logic Implementation Guide

This document describes the two retry utilities available in the VAT Refund Application for handling transient failures in external API calls.

## Available Retry Utilities

### 1. Simple Retry Utility (`utils/retry.ts`)
**Purpose**: Lightweight, easy-to-use retry function with exponential backoff.

**Usage**:
```typescript
import { retry } from './utils/retry';

// Simple usage with defaults (3 retries, 500ms base delay)
const result = await retry(() => externalApiCall());

// Custom configuration
const result = await retry(() => externalApiCall(), 5, 1000); // 5 retries, 1000ms base
```

**Features**:
- ✅ Exponential backoff with jitter
- ✅ Retryable error detection (429, 5xx, network errors)
- ✅ Non-retryable error fast-fail (4xx except 429)
- ✅ Simple 3-parameter interface

### 2. Advanced Retry Wrapper (`utils/retryWrapper.ts`)
**Purpose**: Full-featured retry system with extensive configuration options.

**Usage**:
```typescript
import { retry, retryDocumentAI, retrySendGrid } from './utils/retryWrapper';

// Predefined configurations for specific services
const result = await retryDocumentAI(() => docAiClient.processDocument(...));
const emailResult = await retrySendGrid(() => sgMail.send(...));

// Custom configuration
const result = await retry(() => apiCall(), {
  retries: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
  jitter: true,
  timeoutMs: 30000,
  retryOn: (err) => customErrorCheck(err)
});
```

**Features**:
- ✅ Configurable retry strategies per service
- ✅ Global timeout limits
- ✅ Custom retry condition functions
- ✅ Detailed logging and metrics
- ✅ Service-specific presets (Document AI, SendGrid)

## Current Integration

### Document AI (onInvoiceUpload)
Currently using the **advanced retry wrapper** with Document AI-specific configuration:

```typescript
// In onInvoiceUpload function
const result = await retryDocumentAI(() => 
  client.processDocument({
    name: name,
    rawDocument: {
      content: fileBuffer,
      mimeType: contentType,
    },
  })
) as any[];
```

**Configuration**:
- 3 retries maximum
- 500ms base delay, up to 4000ms max
- 30-second total timeout
- Document AI specific error handling

## Error Classification

### Retryable Errors
- **HTTP 429**: Too Many Requests
- **HTTP 5xx**: Server errors (500, 502, 503, 504)
- **Network errors**: ECONNRESET, ETIMEDOUT, EAI_AGAIN
- **Timeout errors**: Socket hang up, timeout patterns

### Non-Retryable Errors
- **HTTP 4xx** (except 429): Client errors
- **Authentication errors**: 401, 403
- **Validation errors**: 400, 422
- **Document AI specific**: Invalid document format

## Testing

### Unit Tests
Run the retry logic tests:
```bash
cd functions
node test-retry.js
```

Expected results:
- ✅ Success on first attempt
- ✅ Success after 1-2 retries  
- ✅ Success on final retry attempt
- ✅ Failure after exhausting all retries
- ✅ Fast-fail on non-retryable errors
- ✅ Correct exponential backoff timing

### Integration Tests
Run validation tests to ensure retry integration:
```bash
cd functions
node test-validation.js
```

## Performance Impact

### Timing Analysis
- **First attempt success**: ~0-5ms overhead
- **With 1 retry**: ~100-200ms additional delay
- **With 2 retries**: ~400-500ms additional delay
- **Full failure (3 retries)**: ~800-1600ms total

### Recommendations
- Use **simple retry** for basic use cases
- Use **advanced retry** for production critical paths
- Monitor retry rates in logs for tuning
- Consider circuit breaker pattern for high-volume APIs

## Error Monitoring

### Structured Logging
Both retry utilities log attempts with:
```json
{
  "attempt": 2,
  "delay": 750,
  "error": "Service temporarily unavailable",
  "retryable": true,
  "totalDuration": 1250
}
```

### Metrics to Track
- `retry_attempts_total`: Total retry attempts
- `retry_success_rate`: Percentage of eventual successes
- `retry_duration_ms`: Time spent in retry loops
- `non_retryable_errors`: Fast-fail error count

## Migration Path

To switch from advanced to simple retry:

```typescript
// Before (advanced)
import { retryDocumentAI } from './utils/retryWrapper';
const result = await retryDocumentAI(() => apiCall());

// After (simple)
import { retry } from './utils/retry';
const result = await retry(() => apiCall(), 3, 500);
```

## Future Enhancements

### Planned Features
- Circuit breaker pattern integration
- Retry budget (max retries per time window)  
- Dead letter queue for persistent failures
- Custom backoff strategies (linear, polynomial)
- Retry metrics export to monitoring systems
