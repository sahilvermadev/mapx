// backend/src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { isTokenBlacklisted } from '../utils/redis';
import pool from '../db';

// JWT authentication middleware
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Access token required' 
    });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ 
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    const secret = process.env.JWT_SECRET || 'dev-secret-key';
    const decoded = jwt.verify(token, secret) as any;
    
    if (!decoded?.id) {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid token: missing user ID' 
      });
    }

    // Validate user status in database
    try {
      const userResult = await pool.query(
        'SELECT id, email, display_name, profile_picture_url, username, created_at, last_login_at FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ 
          success: false,
          error: 'User account not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = userResult.rows[0];
      
      // Attach fresh user info to request (not from token)
      req.user = {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profilePictureUrl: user.profile_picture_url,
        username: user.username
      };
    } catch (dbError) {
      console.error('Database error during user validation:', dbError);
      return res.status(500).json({ 
        success: false,
        error: 'User validation failed',
        code: 'USER_VALIDATION_ERROR'
      });
    }
    
    next();
  } catch (err) {
    // Handle different JWT error types
    if (err instanceof jwt.TokenExpiredError) {
      // Don't log expired tokens as warnings - this is normal behavior
      return res.status(401).json({ 
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (err instanceof jwt.JsonWebTokenError) {
      console.warn('Invalid JWT token:', err.message);
      return res.status(403).json({ 
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else {
      console.warn('JWT verification failed:', err);
      return res.status(403).json({ 
        success: false,
        error: 'Token verification failed',
        code: 'TOKEN_ERROR'
      });
    }
  }
};

// Helper function to extract user ID from request (for backward compatibility)
export const getUserIdFromRequest = (req: Request): string | null => {
  // First check if user is set by JWT middleware
  if (req.user && (req.user as any).id) {
    return (req.user as any).id as string;
  }

  // Fallback to manual JWT verification (for routes that don't use the middleware)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-key';
    const decoded = jwt.verify(token, secret) as any;
    return decoded?.id || null;
  } catch (err) {
    console.warn('JWT verification failed in getUserIdFromRequest:', err);
    return null;
  }
};
