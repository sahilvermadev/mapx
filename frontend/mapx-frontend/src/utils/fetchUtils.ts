/**
 * Fetch utility functions with timeout and retry logic
 */

interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Network error type that may include HTTP status information
 */
interface NetworkError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/**
 * Type guard to check if an error is a NetworkError
 */
function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof Error;
}

/**
 * Fetches a resource with timeout and retry logic
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout, retries, and retryDelay
 * @returns A Promise that resolves to a Response
 * @throws {Error} If the request fails after all retries
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 10000, // Default 10 seconds
    retries = 0,
    retryDelay = 500,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        return response;
      } catch (error: unknown) {
        // If aborted due to timeout, throw timeout error
        if (isNetworkError(error) && error.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        
        throw error;
      } finally {
        // Always cleanup timeout to prevent memory leaks
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt < retries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // If this was the last attempt, throw the error
      throw lastError;
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Fetch failed');
}

/**
 * Gets a user-friendly error message from a network error
 * @param error - The error object (can be Error, unknown, or any error-like object)
 * @returns A user-friendly error message string
 */
export function getNetworkErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  // Handle Error instances
  if (error instanceof Error) {
    const errorMessage = error.message || '';
    const errorName = error.name || '';

    // Handle timeout errors
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    }

    // Handle abort errors
    if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
      return 'Request was cancelled.';
    }

    // Handle network errors
    if (
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('ERR_TIMED_OUT') ||
      errorMessage.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
      errorMessage.includes('ERR_PROXY_CONNECTION_FAILED')
    ) {
      return 'Network error. Please check your connection and try again.';
    }

    // Return the error message if available
    return errorMessage || 'An error occurred. Please try again.';
  }

  // Handle error-like objects with status/statusCode
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    const status = (errorObj.status as number) || (errorObj.statusCode as number);

    if (typeof status === 'number') {
      if (status >= 500) {
        return 'Server error. Please try again later.';
      }
      if (status === 404) {
        return 'Resource not found.';
      }
      if (status === 403) {
        return 'Access denied.';
      }
      if (status === 401) {
        return 'Authentication required.';
      }
    }

    // Try to extract message from error object
    const message = errorObj.message || errorObj.error || errorObj.msg;
    if (typeof message === 'string') {
      return message;
    }
  }

  // Fallback for unknown error types
  return 'An error occurred. Please try again.';
}

