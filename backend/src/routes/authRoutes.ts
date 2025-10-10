import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const router = express.Router();

// Proxy endpoint for Google profile pictures
router.get('/profile-picture', async (req, res) => {
  const { url } = req.query;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Validate that it's a Google profile picture URL
    if (!url.includes('googleusercontent.com')) {
      return res.status(400).json({ error: 'Invalid profile picture URL' });
    }

    // Fetch the image from Google
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Set appropriate headers
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.set('Access-Control-Allow-Origin', '*');
    
    // Send the image data
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying profile picture:', error);
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
    const token = jwt.sign(
      {
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.display_name,
        profilePictureUrl: mockUser.profile_picture_url,
        username: mockUser.username,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Redirect back to frontend with token param
    res.redirect(`http://localhost:5173/auth/success?token=${token}`);
  } catch (error) {
    console.error('Dev login error:', error);
    res.status(500).json({ message: 'Development login failed' });
  }
});

// GET /auth/google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // user was set by passport strategy
    const user: any = (req as any).user;
    if (!user?.id) return res.redirect('/auth/failure');

    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profilePictureUrl: user.profile_picture_url,
        username: user.username,
      },
      jwtSecret,
      { expiresIn: '1h' }
    );

    res.redirect(`http://localhost:5173/auth/success?token=${token}`);
  }
);

// GET /auth/logout
router.get('/logout', (req, res, next) => {
  // Passport 0.6 requires callback
  (req as any).logout((err: any) => {
    if (err) return next(err);
    req.session?.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logged out' });
    });
  });
});

// GET /auth/failure
router.get('/failure', (_req, res) => {
  res.status(401).json({ message: 'Authentication failed' });
});

export default router;


