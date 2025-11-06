"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.isTokenBlacklisted = isTokenBlacklisted;
exports.blacklistToken = blacklistToken;
exports.storeRefreshToken = storeRefreshToken;
exports.validateRefreshToken = validateRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.revokeAllUserTokens = revokeAllUserTokens;
// backend/src/utils/redis.ts
const redis_1 = require("redis");
let redisClient = null;
async function getRedisClient() {
    if (!redisClient) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisClient = (0, redis_1.createClient)({
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
        }
        catch (error) {
            console.error('Failed to connect to Redis:', error);
            // In development, continue without Redis
            if (process.env.NODE_ENV === 'production') {
                throw error;
            }
        }
    }
    return redisClient;
}
async function isTokenBlacklisted(token) {
    try {
        const client = await getRedisClient();
        if (!client)
            return false;
        const result = await client.get(`blacklist:${token}`);
        return result === 'true';
    }
    catch (error) {
        console.error('Error checking token blacklist:', error);
        return false; // Fail open - allow request if Redis is down
    }
}
async function blacklistToken(token, ttlSeconds = 86400) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.setEx(`blacklist:${token}`, ttlSeconds, 'true');
    }
    catch (error) {
        console.error('Error blacklisting token:', error);
        // Don't throw - logging is sufficient
    }
}
async function storeRefreshToken(userId, refreshToken, ttlSeconds = 604800) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.setEx(`refresh:${userId}:${refreshToken}`, ttlSeconds, 'true');
    }
    catch (error) {
        console.error('Error storing refresh token:', error);
    }
}
async function validateRefreshToken(userId, refreshToken) {
    try {
        const client = await getRedisClient();
        if (!client)
            return false;
        const result = await client.get(`refresh:${userId}:${refreshToken}`);
        return result === 'true';
    }
    catch (error) {
        console.error('Error validating refresh token:', error);
        return false;
    }
}
async function revokeRefreshToken(userId, refreshToken) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        await client.del(`refresh:${userId}:${refreshToken}`);
    }
    catch (error) {
        console.error('Error revoking refresh token:', error);
    }
}
async function revokeAllUserTokens(userId) {
    try {
        const client = await getRedisClient();
        if (!client)
            return;
        const pattern = `refresh:${userId}:*`;
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
        }
    }
    catch (error) {
        console.error('Error revoking all user tokens:', error);
    }
}
