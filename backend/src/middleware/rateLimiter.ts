import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/redis';
import logger from '../utils/logger';

// Fallback in-memory rate limiter (used when Redis is unavailable)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const fallbackRateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackRateLimitStore.entries()) {
    if (entry.resetTime < now) {
      fallbackRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Redis-based rate limiter with fallback to in-memory
 */
async function checkRateLimitRedis(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    const client = await getRedisClient();
    if (!client) {
      throw new Error('Redis client not available');
    }

    const windowSeconds = Math.ceil(windowMs / 1000);
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();
    const resetTime = now + windowMs;

    // Use Redis INCR with EXPIRE
    const count = await client.incr(redisKey);
    
    // Set expiry on first increment
    if (count === 1) {
      await client.expire(redisKey, windowSeconds);
    }

    const remaining = Math.max(0, maxRequests - count);
    const allowed = count <= maxRequests;

    return {
      allowed,
      remaining,
      resetTime,
    };
  } catch (error) {
    // Fall back to in-memory if Redis fails
    logger.warn('Redis rate limiting unavailable, falling back to in-memory', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * In-memory rate limiter (fallback)
 */
function checkRateLimitMemory(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = fallbackRateLimitStore.get(key);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    fallbackRateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }
  
  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const allowed = entry.count <= maxRequests;
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 10,
  keyGenerator?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    
    try {
      // Try Redis first
      const result = await checkRateLimitRedis(key, windowMs, maxRequests);
      
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter,
          remaining: result.remaining,
        });
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      return next();
    } catch (error) {
      // Fallback to in-memory rate limiting
      const result = checkRateLimitMemory(key, windowMs, maxRequests);
      
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.',
          retryAfter,
          remaining: result.remaining,
        });
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      return next();
    }
  };
}

// AI-specific rate limiter (more restrictive)
export const aiRateLimiter = createRateLimiter(
  60000, // 1 minute window
  10, // 10 requests per minute
  (req) => {
    // Use user ID if available, otherwise IP
    const userId = (req as any).user?.id;
    return userId ? `ai:user:${userId}` : `ai:ip:${req.ip || 'unknown'}`;
  }
);

// General API rate limiter
export const apiRateLimiter = createRateLimiter(
  60000, // 1 minute window
  30, // 30 requests per minute
  (req) => `api:ip:${req.ip || 'unknown'}`
);




