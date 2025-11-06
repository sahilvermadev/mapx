import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Middleware to add request ID tracking for correlation
 */
export function requestTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Generate or use existing request ID
  const requestId = req.get('X-Request-Id') || randomUUID();
  
  // Add request ID to request object
  (req as any).requestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-Id', requestId);
  
  // Add request ID to response locals for logging
  res.locals.requestId = requestId;
  
  next();
}

/**
 * Express middleware for logging requests
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  
  // Log request start
  const { log } = require('../utils/logger');
  log.info('Request started', {
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
  });

  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    log.info('Request completed', {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: (req as any).user?.id,
    });
  });

  next();
}

