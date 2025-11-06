"use strict";
/**
 * Standardized error handling utilities for the backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_MESSAGES = exports.ERROR_STATUS_CODES = exports.ERROR_CODES = void 0;
exports.parseError = parseError;
exports.handleError = handleError;
exports.createErrorHandler = createErrorHandler;
exports.withErrorHandling = withErrorHandling;
exports.createErrorResponse = createErrorResponse;
exports.createErrorHandlerMiddleware = createErrorHandlerMiddleware;
/**
 * Standard error codes used throughout the application
 */
exports.ERROR_CODES = {
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
};
/**
 * HTTP status codes mapping
 */
exports.ERROR_STATUS_CODES = {
    [exports.ERROR_CODES.VALIDATION_ERROR]: 400,
    [exports.ERROR_CODES.INVALID_INPUT]: 400,
    [exports.ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
    [exports.ERROR_CODES.UNAUTHORIZED]: 401,
    [exports.ERROR_CODES.TOKEN_EXPIRED]: 401,
    [exports.ERROR_CODES.INVALID_TOKEN]: 401,
    [exports.ERROR_CODES.FORBIDDEN]: 403,
    [exports.ERROR_CODES.NOT_FOUND]: 404,
    [exports.ERROR_CODES.CONFLICT]: 409,
    [exports.ERROR_CODES.DUPLICATE_ENTRY]: 409,
    [exports.ERROR_CODES.RATE_LIMITED]: 429,
    [exports.ERROR_CODES.INTERNAL_SERVER_ERROR]: 500,
    [exports.ERROR_CODES.DATABASE_ERROR]: 500,
    [exports.ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
    [exports.ERROR_CODES.AI_SERVICE_ERROR]: 502,
    [exports.ERROR_CODES.EMAIL_SERVICE_ERROR]: 502,
    [exports.ERROR_CODES.UNKNOWN_ERROR]: 500,
};
/**
 * User-friendly error messages
 */
exports.ERROR_MESSAGES = {
    [exports.ERROR_CODES.DATABASE_ERROR]: 'Database operation failed',
    [exports.ERROR_CODES.CONSTRAINT_VIOLATION]: 'Data constraint violation',
    [exports.ERROR_CODES.DUPLICATE_ENTRY]: 'Resource already exists',
    [exports.ERROR_CODES.VALIDATION_ERROR]: 'Invalid input data',
    [exports.ERROR_CODES.INVALID_INPUT]: 'Invalid input provided',
    [exports.ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required field is missing',
    [exports.ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
    [exports.ERROR_CODES.FORBIDDEN]: 'Access denied',
    [exports.ERROR_CODES.TOKEN_EXPIRED]: 'Authentication token expired',
    [exports.ERROR_CODES.INVALID_TOKEN]: 'Invalid authentication token',
    [exports.ERROR_CODES.NOT_FOUND]: 'Resource not found',
    [exports.ERROR_CODES.RATE_LIMITED]: 'Too many requests',
    [exports.ERROR_CODES.CONFLICT]: 'Resource conflict',
    [exports.ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 'External service unavailable',
    [exports.ERROR_CODES.AI_SERVICE_ERROR]: 'AI service error',
    [exports.ERROR_CODES.EMAIL_SERVICE_ERROR]: 'Email service error',
    [exports.ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred',
    [exports.ERROR_CODES.INTERNAL_SERVER_ERROR]: 'Internal server error',
};
/**
 * Parse different types of errors into standardized AppError format
 */
function parseError(error, context) {
    const timestamp = new Date().toISOString();
    // PostgreSQL errors
    if (error?.code) {
        let code = exports.ERROR_CODES.DATABASE_ERROR;
        let statusCode = 500;
        switch (error.code) {
            case '23505': // unique_violation
                code = exports.ERROR_CODES.DUPLICATE_ENTRY;
                statusCode = 409;
                break;
            case '23503': // foreign_key_violation
                code = exports.ERROR_CODES.CONSTRAINT_VIOLATION;
                statusCode = 400;
                break;
            case '23502': // not_null_violation
                code = exports.ERROR_CODES.MISSING_REQUIRED_FIELD;
                statusCode = 400;
                break;
            case '23514': // check_violation
                code = exports.ERROR_CODES.VALIDATION_ERROR;
                statusCode = 400;
                break;
        }
        return {
            code,
            message: error.message || exports.ERROR_MESSAGES[code],
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
            code: exports.ERROR_CODES.VALIDATION_ERROR,
            message: error.message || exports.ERROR_MESSAGES[exports.ERROR_CODES.VALIDATION_ERROR],
            details: error.details || error.errors,
            timestamp,
            context,
            statusCode: 400,
        };
    }
    // Standard Error objects
    if (error instanceof Error) {
        return {
            code: exports.ERROR_CODES.UNKNOWN_ERROR,
            message: error.message || exports.ERROR_MESSAGES[exports.ERROR_CODES.UNKNOWN_ERROR],
            details: { stack: error.stack },
            timestamp,
            context,
            statusCode: 500,
        };
    }
    // String errors
    if (typeof error === 'string') {
        return {
            code: exports.ERROR_CODES.UNKNOWN_ERROR,
            message: error,
            timestamp,
            context,
            statusCode: 500,
        };
    }
    // Unknown error type
    return {
        code: exports.ERROR_CODES.UNKNOWN_ERROR,
        message: exports.ERROR_MESSAGES[exports.ERROR_CODES.UNKNOWN_ERROR],
        details: error,
        timestamp,
        context,
        statusCode: 500,
    };
}
/**
 * Handle errors with consistent logging and response formatting
 */
function handleError(error, options = {}) {
    const { logError = true, includeStack = false, context, statusCode, } = options;
    const appError = parseError(error, context);
    // Override status code if provided
    if (statusCode) {
        appError.statusCode = statusCode;
    }
    // Log error if requested
    if (logError) {
        const logData = {
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
        console.error(`[${appError.context || 'Backend'}] Error:`, logData);
    }
    return appError;
}
/**
 * Create a standardized error handler for async functions
 */
function createErrorHandler(context, options = {}) {
    return (error) => {
        return handleError(error, { ...options, context });
    };
}
/**
 * Wrap async functions with standardized error handling
 */
function withErrorHandling(fn, context, options = {}) {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            const appError = handleError(error, { ...options, context });
            throw appError;
        }
    };
}
/**
 * Create a standardized API error response
 */
function createErrorResponse(error) {
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
function createErrorHandlerMiddleware() {
    return (error, req, res, next) => {
        const appError = handleError(error, {
            context: `${req.method} ${req.path}`,
            includeStack: process.env.NODE_ENV === 'development'
        });
        res.status(appError.statusCode || 500).json(createErrorResponse(appError));
    };
}
