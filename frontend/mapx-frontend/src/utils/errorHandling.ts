/**
 * Standardized error handling utilities for the frontend
 */

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  context?: string;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  fallbackMessage?: string;
  context?: string;
}

/**
 * Standard error codes used throughout the application
 */
export const ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Business logic errors
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // System errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection.',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ERROR_CODES.CONNECTION_ERROR]: 'Unable to connect to the server. Please try again later.',
  [ERROR_CODES.UNAUTHORIZED]: 'You need to log in to perform this action.',
  [ERROR_CODES.FORBIDDEN]: 'You don\'t have permission to perform this action.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided.',
  [ERROR_CODES.NOT_FOUND]: 'The requested resource was not found.',
  [ERROR_CODES.DUPLICATE_ENTRY]: 'This item already exists.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
  [ERROR_CODES.SERVER_ERROR]: 'Server error occurred. Please try again later.',
} as const;

/**
 * Parse different types of errors into standardized AppError format
 */
export function parseError(error: any, context?: string): AppError {
  const timestamp = new Date().toISOString();
  
  // Axios errors
  if (error?.isAxiosError) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    let code: keyof typeof ERROR_CODES = ERROR_CODES.UNKNOWN_ERROR;
    if (status === 401) code = ERROR_CODES.UNAUTHORIZED;
    else if (status === 403) code = ERROR_CODES.FORBIDDEN;
    else if (status === 404) code = ERROR_CODES.NOT_FOUND;
    else if (status === 422) code = ERROR_CODES.VALIDATION_ERROR;
    else if (status === 429) code = ERROR_CODES.RATE_LIMITED;
    else if (status >= 500) code = ERROR_CODES.SERVER_ERROR;
    else if (error.code === 'ECONNABORTED') code = ERROR_CODES.TIMEOUT_ERROR;
    else if (error.code === 'ERR_NETWORK') code = ERROR_CODES.NETWORK_ERROR;
    
    return {
      code,
      message: message || ERROR_MESSAGES[code],
      details: error.response?.data,
      timestamp,
      context,
    };
  }
  
  // Standard Error objects
  if (error instanceof Error) {
    return {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: error.message || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR],
      details: { stack: error.stack },
      timestamp,
      context,
    };
  }
  
  // String errors
  if (typeof error === 'string') {
    return {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: error,
      timestamp,
      context,
    };
  }
  
  // Unknown error type
  return {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR],
    details: error,
    timestamp,
    context,
  };
}

/**
 * Handle errors with consistent logging and user feedback
 */
export function handleError(
  error: any,
  options: ErrorHandlerOptions = {}
): AppError {
  const {
    showToast = true,
    logError = true,
    fallbackMessage,
    context,
  } = options;
  
  const appError = parseError(error, context);
  
  // Log error if requested
  if (logError) {
    console.error(`[${appError.context || 'App'}] Error:`, {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      timestamp: appError.timestamp,
    });

    // Report error to error tracking service (e.g., Sentry)
    // This is a placeholder for error tracking integration
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(
          new CustomEvent('app:error', {
            detail: {
              error: appError,
              timestamp: appError.timestamp,
            },
          })
        );
      } catch (e) {
        // Ignore if event dispatch fails
      }
    }
  }
  
  // Show toast notification if requested
  if (showToast) {
    import('sonner').then(({ toast }) => {
      toast.error(fallbackMessage || appError.message);
    });
  }
  
  return appError;
}

/**
 * Create a standardized error handler for async functions
 */
export function createErrorHandler(context: string, options: ErrorHandlerOptions = {}) {
  return (error: any) => {
    return handleError(error, { ...options, context });
  };
}

/**
 * Wrap async functions with standardized error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  options: ErrorHandlerOptions = {}
) {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, { ...options, context });
      return null;
    }
  };
}

/**
 * Safe async function execution with error handling
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string,
  options: ErrorHandlerOptions = {}
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, { ...options, context });
    return null;
  }
}
