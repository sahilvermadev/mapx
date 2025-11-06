/**
 * Standardized error handling utilities for the backend
 */

import logger from './logger';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  context?: string;
  statusCode?: number;
}

export interface ErrorHandlerOptions {
  logError?: boolean;
  includeStack?: boolean;
  context?: string;
  statusCode?: number;
}

/**
 * Standard error codes used throughout the application
 */
export const ERROR_CODES = {
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Business logic errors
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  
  // System errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

/**
 * HTTP status codes mapping
 */
export const ERROR_STATUS_CODES = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.INVALID_TOKEN]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.DUPLICATE_ENTRY]: 409,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 500,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
  [ERROR_CODES.AI_SERVICE_ERROR]: 502,
  [ERROR_CODES.EMAIL_SERVICE_ERROR]: 502,
  [ERROR_CODES.UNKNOWN_ERROR]: 500,
} as const;

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.DATABASE_ERROR]: 'Database operation failed',
  [ERROR_CODES.CONSTRAINT_VIOLATION]: 'Data constraint violation',
  [ERROR_CODES.DUPLICATE_ENTRY]: 'Resource already exists',
  [ERROR_CODES.VALIDATION_ERROR]: 'Invalid input data',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
  [ERROR_CODES.FORBIDDEN]: 'Access denied',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Authentication token expired',
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid authentication token',
  [ERROR_CODES.NOT_FOUND]: 'Resource not found',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests',
  [ERROR_CODES.CONFLICT]: 'Resource conflict',
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service unavailable',
  [ERROR_CODES.AI_SERVICE_ERROR]: 'AI service error',
  [ERROR_CODES.EMAIL_SERVICE_ERROR]: 'Email service error',
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred',
  [ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error',
} as const;

/**
 * Parse different types of errors into standardized AppError format
 */
export function parseError(error: any, context?: string): AppError {
  const timestamp = new Date().toISOString();
  
  // PostgreSQL errors
  if (error?.code) {
    let code: keyof typeof ERROR_CODES = ERROR_CODES.DATABASE_ERROR;
    let statusCode = 500;
    
    switch (error.code) {
      case '23505': // unique_violation
        code = ERROR_CODES.DUPLICATE_ENTRY;
        statusCode = 409;
        break;
      case '23503': // foreign_key_violation
        code = ERROR_CODES.CONSTRAINT_VIOLATION;
        statusCode = 400;
        break;
      case '23502': // not_null_violation
        code = ERROR_CODES.MISSING_REQUIRED_FIELD;
        statusCode = 400;
        break;
      case '23514': // check_violation
        code = ERROR_CODES.VALIDATION_ERROR;
        statusCode = 400;
        break;
    }
    
    return {
      code,
      message: error.message || ERROR_MESSAGES[code],
      details: {
        constraint: error.constraint,
        table: error.table,
        column: error.column,
      },
      timestamp,
      context,
      statusCode,
    };
  }
  
  // Validation errors (from libraries like joi, yup, etc.)
  if (error?.isJoi || error?.name === 'ValidationError') {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: error.message || ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
      details: error.details || error.errors,
      timestamp,
      context,
      statusCode: 400,
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
      statusCode: 500,
    };
  }
  
  // String errors
  if (typeof error === 'string') {
    return {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: error,
      timestamp,
      context,
      statusCode: 500,
    };
  }
  
  // Unknown error type
  return {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR],
    details: error,
    timestamp,
    context,
    statusCode: 500,
  };
}

/**
 * Handle errors with consistent logging and response formatting
 */
export function handleError(
  error: any,
  options: ErrorHandlerOptions = {}
): AppError {
  const {
    logError = true,
    includeStack = false,
    context,
    statusCode,
  } = options;
  
  const appError = parseError(error, context);
  
  // Override status code if provided
  if (statusCode) {
    appError.statusCode = statusCode;
  }
  
  // Log error if requested
  if (logError) {
    const logData: any = {
      code: appError.code,
      message: appError.message,
      context: appError.context,
      timestamp: appError.timestamp,
    };
    
    if (includeStack && appError.details?.stack) {
      logData.stack = appError.details.stack;
    }
    
    if (appError.details) {
      logData.details = appError.details;
    }
    
    logger.error(`[${appError.context || 'Backend'}] Error`, logData);
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
      const appError = handleError(error, { ...options, context });
      throw appError;
    }
  };
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(error: AppError) {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
    },
  };
}

/**
 * Express error handler middleware
 */
export function createErrorHandlerMiddleware() {
  return (error: any, req: any, res: any, next: any) => {
    const appError = handleError(error, { 
      context: `${req.method} ${req.path}`,
      includeStack: process.env.NODE_ENV === 'development'
    });
    
    res.status(appError.statusCode || 500).json(createErrorResponse(appError));
  };
}
