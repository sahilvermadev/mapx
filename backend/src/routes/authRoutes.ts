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
    return res.status(403).json({ message: 'Development login not available in production' });
  }

  try {
    // Create a mock user for development
    const mockUser = {
      id: 'dev-user-123',
      google_id: 'dev-google-123',
      email: 'dev@example.com',
      display_name: 'Development User',
      profile_picture_url: null,
    };

    const token = jwt.sign(
      {
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.display_name,
        profilePictureUrl: mockUser.profile_picture_url,
      },
      process.env.JWT_SECRET as string || 'dev-secret-key',
      { expiresIn: '24h' }
    );

    res.redirect(`http://localhost:5173/auth/success?token=${token}`);
  } catch (error) {
    console.error('Dev login error:', error);
    res.status(500).json({ message: 'Development login failed' });
  }
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    const user = req.user as any;
    if (!user?.id) return res.redirect('/auth/failure');

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profilePictureUrl: user.profile_picture_url,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.redirect(`http://localhost:5173/auth/success?token=${token}`);
  }
);

router.get('/success', (req, res) => {
  if (req.user) return res.status(200).json({ message: 'Login successful!', user: req.user });
  res.status(401).json({ message: 'Not authenticated.' });
});

router.get('/failure', (_req, res) => res.status(401).json({ message: 'Authentication failed!' }));

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((destroyErr) => {
      if (destroyErr) return res.status(500).json({ message: 'Logout failed.' });
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logged out successfully.' });
    });
  });
});

export default router;