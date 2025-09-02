// functions/src/utils/retry.ts

/**
 * Checks if an error is likely a temporary, "transient" issue.
 * @param {any} error The error to check.
 * @returns {boolean} True if the error is retryable.
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  // Retry on network errors or specific HTTP status codes (e.g., Too Many Requests, Server Error)
  const retryableCodes = [429, 500, 502, 503, 504];
  return retryableCodes.includes(error.code) || /ECONNRESET|ETIMEDOUT/i.test(error.message);
}

/**
 * Retries an async function with exponential backoff.
 * @param {() => Promise<T>} fn The async function to execute.
 * @param {number} retries The maximum number of retries.
 * @param {number} delayMs The base delay in milliseconds.
 * @returns {Promise<T>} The result of the function if successful.
 */
export async function retry<T>(fn: () => Promise<T>, retries: number = 3, delayMs: number = 500): Promise<T> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) {
        // Don't retry on non-transient errors (e.g., permission denied)
        throw lastError;
      }
      // Exponential backoff with jitter
      const delay = delayMs * 2 ** i + Math.random() * delayMs;
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastError;
}
