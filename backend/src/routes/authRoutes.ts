import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { blacklistToken, storeRefreshToken, validateRefreshToken, revokeRefreshToken, revokeAllUserTokens } from '../utils/redis';
import { getUserIdFromRequest } from '../middleware/auth';
import { createProfilePictureCorsMiddleware } from '../middleware/cors';
import logger from '../utils/logger';
import pool from '../db';

const router = express.Router();

// CORS middleware for profile picture endpoint
const profilePictureCors = createProfilePictureCorsMiddleware();

// Proxy endpoint for Google profile pictures
router.get('/profile-picture', profilePictureCors, async (req, res) => {
  const { url } = req.query;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Validate that it's a Google profile picture URL
    if (!url.includes('googleusercontent.com')) {
      logger.warn('Invalid profile picture URL attempted', { url: url.substring(0, 100) });
      return res.status(400).json({ error: 'Invalid profile picture URL' });
    }

    // CRITICAL: Disable Express's automatic 304 handling by removing ETag support
    // This ensures CORS headers are always sent, even for cached responses
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');
    
    // Disable Express's fresh check to force a full response with CORS headers
    (req as any).headers['if-none-match'] = undefined;
    (req as any).headers['if-modified-since'] = undefined;

    // Fetch the image from Google with timeout
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Set ALL headers BEFORE sending response - order matters
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:5173'];
    
    // Set CORS headers FIRST
    if (origin && (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Set content and caching headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Vary', 'Origin'); // Vary by origin for proper caching
    
    // Send the image data - ensure headers are sent before data
    res.send(response.data);
  } catch (error: any) {
    logger.error('Error proxying profile picture', { 
      error: error.message, 
      url: url.substring(0, 100) // Log partial URL for debugging
    });
    res.status(500).json({ error: 'Failed to load profile picture' });
  }
});

// Development-only login endpoint (bypasses OAuth)
router.get('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res
      .status(403)
      .json({ message: 'Development login not available in production' });
  }

  try {
    const mockUser = {
      id: 'dev-user-123',
      google_id: 'dev-google-123',
      email: 'dev@example.com',
      display_name: 'Development User',
      profile_picture_url: null as string | null,
      username: null as string | null,
    };

    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    
    // Generate access token (15 minutes)
    const accessToken = jwt.sign(
      {
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.display_name,
        profilePictureUrl: mockUser.profile_picture_url,
        username: mockUser.username,
        type: 'access'
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    // Generate refresh token (7 days)
    const refreshToken = jwt.sign(
      {
        id: mockUser.id,
        type: 'refresh'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token in Redis
    await storeRefreshToken(mockUser.id, refreshToken, 604800); // 7 days

    // Redirect back to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const nextParam = typeof req.query.next === 'string' ? req.query.next : '';
    const nextPart = nextParam ? `&next=${encodeURIComponent(nextParam)}` : '';
    res.redirect(`${frontendUrl}/?accessToken=${accessToken}&refreshToken=${refreshToken}${nextPart}`);
  } catch (error: any) {
    logger.error('Dev login error', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Development login failed' });
  }
});

// GET /auth/google
router.get(
  '/google',
  (req, _res, next) => {
    (req as any)._mxNext = typeof req.query.next === 'string' ? req.query.next : '';
    next();
  },
  (req, res, next) =>
    (passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: encodeURIComponent((req as any)._mxNext || ''),
    }) as any)(req, res, next)
);

// GET /auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,  // Stateless OAuth - no session needed
    failureRedirect: '/auth/failure' 
  }),
  async (req, res) => {
    try {
      // user was set by passport strategy (stateless)
      const user: any = (req as any).user;
      if (!user?.id) return res.redirect('/auth/failure');

      const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
      
      // Generate access token (15 minutes)
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          profilePictureUrl: user.profile_picture_url,
          username: user.username,
          type: 'access'
        },
        jwtSecret,
        { expiresIn: '15m' }
      );

      // Generate refresh token (7 days)
      const refreshToken = jwt.sign(
        {
          id: user.id,
          type: 'refresh'
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      // Store refresh token in Redis
      await storeRefreshToken(user.id, refreshToken, 604800); // 7 days

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const rawState = typeof req.query.state === 'string' ? req.query.state : '';
      const nextParam = rawState ? decodeURIComponent(rawState) : '';
      const nextPart = nextParam ? `&next=${encodeURIComponent(nextParam)}` : '';
      res.redirect(`${frontendUrl}/?accessToken=${accessToken}&refreshToken=${refreshToken}${nextPart}`);
    } catch (error: any) {
      logger.error('OAuth callback error', { error: error.message, stack: error.stack });
      res.redirect('/auth/failure');
    }
  }
);

// POST /auth/refresh - Refresh access token using refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Refresh token required' 
      });
    }

    // Verify refresh token
    const secret = process.env.JWT_SECRET || 'dev-secret-key';
    const decoded = jwt.verify(refreshToken, secret) as any;
    
    if (!decoded?.id || decoded.type !== 'refresh') {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid refresh token' 
      });
    }

    // Validate refresh token in Redis
    const isValidRefresh = await validateRefreshToken(decoded.id, refreshToken);
    if (!isValidRefresh) {
      return res.status(403).json({ 
        success: false,
        error: 'Refresh token has been revoked' 
      });
    }

    // Get fresh user data from database
    const userResult = await pool.query(
      'SELECT id, email, display_name, profile_picture_url, username FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    // Generate new access token (15 minutes)
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profilePictureUrl: user.profile_picture_url,
        username: user.username,
        type: 'access'
      },
      secret,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (error: any) {
    logger.error('Token refresh error', { error: error.message, stack: error.stack });
    res.status(401).json({ 
      success: false,
      error: 'Invalid refresh token' 
    });
  }
});

// POST /auth/logout - Proper logout with token blacklisting
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // Blacklist the access token
      await blacklistToken(token, 900); // 15 minutes (same as token expiry)
    }

    // If refresh token is provided, revoke it
    const { refreshToken } = req.body;
    if (refreshToken) {
      const secret = process.env.JWT_SECRET || 'dev-secret-key';
      try {
        const decoded = jwt.verify(refreshToken, secret) as any;
        if (decoded?.id) {
          await revokeRefreshToken(decoded.id, refreshToken);
        }
      } catch (err) {
        // Ignore invalid refresh tokens
      }
    }

    res.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (error: any) {
    logger.error('Logout error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false,
      error: 'Logout failed' 
    });
  }
});

// POST /auth/logout-all - Logout from all devices
router.post('/logout-all', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    // Revoke all refresh tokens for this user
    await revokeAllUserTokens(userId);

    res.json({ 
      success: true,
      message: 'Logged out from all devices successfully' 
    });
  } catch (error: any) {
    logger.error('Logout all error', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false,
      error: 'Logout all failed' 
    });
  }
});

// GET /auth/failure
router.get('/failure', (_req, res) => {
  res.status(401).json({ message: 'Authentication failed' });
});

export default router;
