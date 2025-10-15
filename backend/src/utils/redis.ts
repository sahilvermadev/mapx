// backend/src/utils/redis.ts
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('disconnect', () => {
      console.log('❌ Redis disconnected');
    });

    try {
      await redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // In development, continue without Redis
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }
  
  return redisClient;
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
