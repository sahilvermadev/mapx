// backend/src/utils/redis.ts
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectionState: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff retry for Redis connection
 */
async function connectWithRetry(client: ReturnType<typeof createClient>, attempt = 0): Promise<void> {
  try {
    await client.connect();
    redisConnectionState = 'connected';
    connectionAttempts = 0;
    console.log('✅ Redis connected successfully');
  } catch (error) {
    connectionAttempts = attempt + 1;
    
    if (attempt < MAX_CONNECTION_ATTEMPTS) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
      console.warn(`Redis connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      return connectWithRetry(client, attempt + 1);
    } else {
      redisConnectionState = 'error';
      console.error(`Failed to connect to Redis after ${MAX_CONNECTION_ATTEMPTS} attempts:`, error);
      // In development, continue without Redis
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Redis connection failed after ${MAX_CONNECTION_ATTEMPTS} attempts`);
      } else {
        console.warn('⚠️  Continuing without Redis (development mode)');
        redisClient = null;
      }
    }
  }
}

export async function getRedisClient() {
  if (!redisClient && redisConnectionState !== 'connecting') {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisConnectionState = 'connecting';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis: Max reconnection attempts reached');
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisConnectionState = 'error';
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready');
      redisConnectionState = 'connected';
    });

    redisClient.on('end', () => {
      console.log('❌ Redis connection ended');
      redisConnectionState = 'disconnected';
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
      redisConnectionState = 'connecting';
    });

    try {
      await connectWithRetry(redisClient);
    } catch (error) {
      // Error already handled in connectWithRetry
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }
  
  return redisClient;
}

/**
 * Check Redis health status
 */
export async function checkRedisHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return { healthy: false, error: 'Redis client not initialized' };
    }

    // Simple ping test
    await client.ping();
    return { healthy: true };
  } catch (error: any) {
    return { 
      healthy: false, 
      error: error?.message || 'Redis health check failed' 
    };
  }
}

/**
 * Get Redis connection status
 */
export function getRedisConnectionState(): 'connected' | 'disconnected' | 'connecting' | 'error' {
  return redisConnectionState;
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    
    const result = await client.get(`blacklist:${token}`);
    return result === 'true';
  } catch (error) {
    console.error('Error checking token blacklist:', error);
    return false; // Fail open - allow request if Redis is down
  }
}

export async function blacklistToken(token: string, ttlSeconds: number = 86400): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    
    await client.setEx(`blacklist:${token}`, ttlSeconds, 'true');
  } catch (error) {
    console.error('Error blacklisting token:', error);
    // Don't throw - logging is sufficient
  }
}

export async function storeRefreshToken(userId: string, refreshToken: string, ttlSeconds: number = 604800): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    
    await client.setEx(`refresh:${userId}:${refreshToken}`, ttlSeconds, 'true');
  } catch (error) {
    console.error('Error storing refresh token:', error);
  }
}

export async function validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;
    
    const result = await client.get(`refresh:${userId}:${refreshToken}`);
    return result === 'true';
  } catch (error) {
    console.error('Error validating refresh token:', error);
    return false;
  }
}

export async function revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    
    await client.del(`refresh:${userId}:${refreshToken}`);
  } catch (error) {
    console.error('Error revoking refresh token:', error);
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;
    
    const pattern = `refresh:${userId}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error('Error revoking all user tokens:', error);
  }
}
