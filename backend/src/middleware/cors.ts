import express from 'express';
import logger from '../utils/logger';

/**
 * CORS configuration helper for profile picture endpoint
 * Handles CORS headers specifically for image responses
 */
export function createProfilePictureCorsMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:5173'];
    
    // Remove any restrictive headers that Helmet might have set
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    
    // Determine if origin is allowed
    const isAllowed = origin && (
      allowedOrigins.includes(origin) || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1')
    );
    
    // Set CORS headers
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin!);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
      // Log blocked origins for security monitoring
      logger.warn('CORS blocked origin for profile picture', { origin });
      res.header('Access-Control-Allow-Origin', '*'); // Fallback for images
    } else {
      // No origin header - allow for direct image loads
      res.header('Access-Control-Allow-Origin', '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  };
}

/**
 * Extract allowed origins from environment
 */
export function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173'];
}

