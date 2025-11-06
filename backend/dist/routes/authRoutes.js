"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("../utils/redis");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const router = express_1.default.Router();
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
        const response = await axios_1.default.get(url, {
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
    }
    catch (error) {
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
            profile_picture_url: null,
            username: null,
        };
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
        // Generate access token (15 minutes)
        const accessToken = jsonwebtoken_1.default.sign({
            id: mockUser.id,
            email: mockUser.email,
            displayName: mockUser.display_name,
            profilePictureUrl: mockUser.profile_picture_url,
            username: mockUser.username,
            type: 'access'
        }, jwtSecret, { expiresIn: '15m' });
        // Generate refresh token (7 days)
        const refreshToken = jsonwebtoken_1.default.sign({
            id: mockUser.id,
            type: 'refresh'
        }, jwtSecret, { expiresIn: '7d' });
        // Store refresh token in Redis
        await (0, redis_1.storeRefreshToken)(mockUser.id, refreshToken, 604800); // 7 days
        // Redirect back to frontend with tokens
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const nextParam = typeof req.query.next === 'string' ? req.query.next : '';
        const nextPart = nextParam ? `&next=${encodeURIComponent(nextParam)}` : '';
        res.redirect(`${frontendUrl}/?accessToken=${accessToken}&refreshToken=${refreshToken}${nextPart}`);
    }
    catch (error) {
        console.error('Dev login error:', error);
        res.status(500).json({ message: 'Development login failed' });
    }
});
// GET /auth/google
router.get('/google', (req, _res, next) => {
    req._mxNext = typeof req.query.next === 'string' ? req.query.next : '';
    next();
}, (req, res, next) => passport_1.default.authenticate('google', {
    scope: ['profile', 'email'],
    state: encodeURIComponent(req._mxNext || ''),
})(req, res, next));
// GET /auth/google/callback
router.get('/google/callback', passport_1.default.authenticate('google', {
    session: false, // Stateless OAuth - no session needed
    failureRedirect: '/auth/failure'
}), async (req, res) => {
    try {
        // user was set by passport strategy (stateless)
        const user = req.user;
        if (!user?.id)
            return res.redirect('/auth/failure');
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
        // Generate access token (15 minutes)
        const accessToken = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            profilePictureUrl: user.profile_picture_url,
            username: user.username,
            type: 'access'
        }, jwtSecret, { expiresIn: '15m' });
        // Generate refresh token (7 days)
        const refreshToken = jsonwebtoken_1.default.sign({
            id: user.id,
            type: 'refresh'
        }, jwtSecret, { expiresIn: '7d' });
        // Store refresh token in Redis
        await (0, redis_1.storeRefreshToken)(user.id, refreshToken, 604800); // 7 days
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const rawState = typeof req.query.state === 'string' ? req.query.state : '';
        const nextParam = rawState ? decodeURIComponent(rawState) : '';
        const nextPart = nextParam ? `&next=${encodeURIComponent(nextParam)}` : '';
        res.redirect(`${frontendUrl}/?accessToken=${accessToken}&refreshToken=${refreshToken}${nextPart}`);
    }
    catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/auth/failure');
    }
});
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
        const decoded = jsonwebtoken_1.default.verify(refreshToken, secret);
        if (!decoded?.id || decoded.type !== 'refresh') {
            return res.status(403).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }
        // Validate refresh token in Redis
        const isValidRefresh = await (0, redis_1.validateRefreshToken)(decoded.id, refreshToken);
        if (!isValidRefresh) {
            return res.status(403).json({
                success: false,
                error: 'Refresh token has been revoked'
            });
        }
        // Get fresh user data from database
        const userResult = await db_1.default.query('SELECT id, email, display_name, profile_picture_url, username FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }
        const user = userResult.rows[0];
        // Generate new access token (15 minutes)
        const newAccessToken = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            profilePictureUrl: user.profile_picture_url,
            username: user.username,
            type: 'access'
        }, secret, { expiresIn: '15m' });
        res.json({
            success: true,
            accessToken: newAccessToken,
            expiresIn: 900 // 15 minutes in seconds
        });
    }
    catch (error) {
        console.error('Token refresh error:', error);
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
            await (0, redis_1.blacklistToken)(token, 900); // 15 minutes (same as token expiry)
        }
        // If refresh token is provided, revoke it
        const { refreshToken } = req.body;
        if (refreshToken) {
            const secret = process.env.JWT_SECRET || 'dev-secret-key';
            try {
                const decoded = jsonwebtoken_1.default.verify(refreshToken, secret);
                if (decoded?.id) {
                    await (0, redis_1.revokeRefreshToken)(decoded.id, refreshToken);
                }
            }
            catch (err) {
                // Ignore invalid refresh tokens
            }
        }
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});
// POST /auth/logout-all - Logout from all devices
router.post('/logout-all', async (req, res) => {
    try {
        const userId = (0, auth_1.getUserIdFromRequest)(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        // Revoke all refresh tokens for this user
        await (0, redis_1.revokeAllUserTokens)(userId);
        res.json({
            success: true,
            message: 'Logged out from all devices successfully'
        });
    }
    catch (error) {
        console.error('Logout all error:', error);
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
exports.default = router;
