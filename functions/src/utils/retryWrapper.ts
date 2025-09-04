/**
 * Retry wrapper utility with exponential backoff and jitter
 * Provides resilient external API calls with configurable retry strategies
 */

import * as logger from "firebase-functions/logger";

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  retries: number;
  /** Base delay in milliseconds before first retry */
  baseDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs?: number;
  /** Add random jitter to delay to avoid thundering herd */
  jitter?: boolean;
  /** Total timeout for all attempts in milliseconds */
  timeoutMs?: number;
  /** Custom function to determine if error should trigger retry */
  retryOn?: (err: any) => boolean;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDuration: number;
}

/**
 * Generic retry wrapper with exponential backoff
 * @param fn Function to retry
 * @param opts Retry configuration options
 * @return Promise resolving to the function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const {
    retries,
    baseDelayMs,
    maxDelayMs = 8000,
    jitter = true,
    timeoutMs,
    retryOn = defaultRetryableCheck,
  } = opts;

  let attempt = 0;
  const startTime = Date.now();
  let lastError: any;

  while (attempt <= retries) {
    try {
      // Check global timeout
      if (timeoutMs && (Date.now() - startTime) > timeoutMs) {
        throw new Error(`Retry timeout exceeded (${timeoutMs}ms) after ${attempt} attempts`);
      }

      const result = await fn();

      if (attempt > 0) {
        logger.info(`Retry succeeded on attempt ${attempt + 1}/${retries + 1}`, {
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
        });
      }

      return result;
    } catch (err) {
      lastError = err;
      attempt++;

      // If we've exhausted retries or error is not retryable, throw
      if (attempt > retries || !retryOn(err)) {
        logger.error("Retry failed permanently", {
          attempts: attempt,
          totalDuration: Date.now() - startTime,
          lastError: err instanceof Error ? err.message : String(err),
          retryable: retryOn(err),
        });
        throw err;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

      // Add jitter to prevent thundering herd
      if (jitter) {
        const jitterMultiplier = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
        delay = Math.round(delay * jitterMultiplier);
      }

      logger.warn(`Retry attempt ${attempt}/${retries} after ${delay}ms delay`, {
        attempt,
        delay,
        error: err instanceof Error ? err.message : String(err),
        retryable: retryOn(err),
      });

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached due to the loop logic, but TypeScript needs it
  throw lastError;
}

/**
 * Default logic to determine if an error should trigger a retry
 * @param err The error to check
 * @return true if the error is retryable
 */
export function defaultRetryableCheck(err: any): boolean {
  if (!err) return false;

  // Check HTTP status codes
  const statusCode = err.code || err.statusCode || err.status;
  if (statusCode) {
    // Retry on server errors and rate limiting
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    if (retryableStatusCodes.includes(statusCode)) {
      return true;
    }
  }

  // Check error messages for network issues
  const message = err.message || String(err);
  const retryablePatterns = [
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /EAI_AGAIN/i,
    /ENOTFOUND/i,
    /socket hang up/i,
    /timeout/i,
    /network/i,
  ];

  return retryablePatterns.some((pattern) => pattern.test(message));
}

/**
 * Convenience function for retrying Document AI calls
 * @param fn Document AI function to retry
 * @return Promise with retry logic applied
 */
export async function retryDocumentAI<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, {
    retries: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
    jitter: true,
    timeoutMs: 30000, // 30 second total timeout
    retryOn: (err) => {
      // Document AI specific retry logic
      const statusCode = err.code || err.statusCode;

      // Always retry on these codes
      if ([429, 500, 502, 503, 504].includes(statusCode)) {
        return true;
      }

      // Don't retry on client errors (400-499 except 429)
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        return false;
      }

      // Use default network error detection
      return defaultRetryableCheck(err);
    },
  });
}

/**
 * Convenience function for retrying SendGrid calls
 * @param fn SendGrid function to retry
 * @return Promise with retry logic applied
 */
export async function retrySendGrid<T>(fn: () => Promise<T>): Promise<T> {
  return retry(fn, {
    retries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
    jitter: true,
    timeoutMs: 20000, // 20 second total timeout
    retryOn: (err) => {
      const statusCode = err.code || err.statusCode;

      // SendGrid specific retry logic
      if ([429, 500, 502, 503, 504].includes(statusCode)) {
        return true;
      }

      // Don't retry on authentication or validation errors
      if ([401, 403, 400].includes(statusCode)) {
        return false;
      }

      return defaultRetryableCheck(err);
    },
  });
}

/**
 * Create a retry function with preset options
 * @param options Default retry options
 * @return Function that applies retry logic with these options
 */
export function createRetryFunction(options: RetryOptions) {
  return <T>(fn: () => Promise<T>) => retry(fn, options);
}
