import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 10,
  keyGenerator?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    
    const entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (entry.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }
    
    entry.count++;
    next();
  };
}

// AI-specific rate limiter (more restrictive)
export const aiRateLimiter = createRateLimiter(
  60000, // 1 minute window
  10, // 10 requests per minute
  (req) => {
    // Use user ID if available, otherwise IP
    const userId = (req as any).user?.id;
    return userId || req.ip || 'unknown';
  }
);

// General API rate limiter
export const apiRateLimiter = createRateLimiter(
  60000, // 1 minute window
  30, // 30 requests per minute
  (req) => req.ip || 'unknown'
);
