import express from 'express';
import pool from '../db';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Helper to extract user id from Bearer JWT
function getUserIdFromRequest(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    // Use the same fallback secret used when issuing dev tokens
    const secret = (process.env.JWT_SECRET as string) || 'dev-secret-key';
    const decoded = jwt.verify(token, secret) as any;
    if (!decoded?.id) {
      console.warn('UsernameRoutes: JWT verified but missing id claim');
    }
    return decoded.id || null;
  } catch (err: any) {
    const errName = err?.name;
    const errMsg = err?.message;
    console.warn('UsernameRoutes: JWT verification failed', { name: errName, message: errMsg });
    return null;
  }
}

// Check if username is available
router.get('/check/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Validate username format
    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        available: false, 
        error: 'Username must be 3-20 characters long' 
      });
    }
    
    // Check for invalid characters
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validUsernameRegex.test(username)) {
      return res.status(400).json({ 
        available: false, 
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Check if username is taken
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    
    res.json({ 
      available: result.rows.length === 0,
      username: username.toLowerCase()
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ error: 'Failed to check username availability' });
  }
});

// Set username for user
router.post('/set', async (req, res) => {
  try {
    const { username } = req.body;
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        error: 'Username must be 3-20 characters long' 
      });
    }
    
    // Check for invalid characters
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validUsernameRegex.test(username)) {
      return res.status(400).json({ 
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Check if user already has a username
    const existingUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (existingUser.rows[0]?.username) {
      return res.status(400).json({ 
        error: 'Username already set for this user' 
      });
    }
    
    // Check if username is available
    const availabilityCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (availabilityCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Username is already taken' 
      });
    }
    
    // Set the username
    const result = await pool.query(
      'UPDATE users SET username = $1, username_set_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING username',
      [username.toLowerCase(), userId]
    );
    
    res.json({ 
      success: true, 
      username: result.rows[0].username 
    });
  } catch (error) {
    console.error('Set username error:', error);
    res.status(500).json({ error: 'Failed to set username' });
  }
});

// Get current user's username status
router.get('/status', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const result = await pool.query(
      'SELECT username, username_set_at FROM users WHERE id = $1',
      [userId]
    );
    
    const user = result.rows[0];
    res.json({
      hasUsername: !!user.username,
      username: user.username,
      usernameSetAt: user.username_set_at
    });
  } catch (error) {
    console.error('Username status error:', error);
    res.status(500).json({ error: 'Failed to get username status' });
  }
});

export default router;
