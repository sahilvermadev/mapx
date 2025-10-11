"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
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
        const token = jsonwebtoken_1.default.sign({
            id: mockUser.id,
            email: mockUser.email,
            displayName: mockUser.display_name,
            profilePictureUrl: mockUser.profile_picture_url,
            username: mockUser.username,
        }, jwtSecret, { expiresIn: '24h' });
        // Set secure HTTP-only cookie and redirect
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/'
        });
        res.redirect(`${frontendUrl}/`);
    }
    catch (error) {
        console.error('Dev login error:', error);
        res.status(500).json({ message: 'Development login failed' });
    }
});
// GET /auth/google
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
// GET /auth/google/callback
router.get('/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/auth/failure' }), (req, res) => {
    // user was set by passport strategy
    const user = req.user;
    if (!user?.id)
        return res.redirect('/auth/failure');
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profilePictureUrl: user.profile_picture_url,
        username: user.username,
    }, jwtSecret, { expiresIn: '1h' });
    // Set secure HTTP-only cookie and redirect
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/'
    });
    res.redirect(`${frontendUrl}/`);
});
// GET /auth/logout
router.get('/logout', (req, res, next) => {
    // Clear the auth token cookie
    res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    // Passport 0.6 requires callback
    req.logout((err) => {
        if (err)
            return next(err);
        req.session?.destroy(() => {
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Logged out' });
        });
    });
});
// GET /auth/me - Get current user from cookie
router.get('/me', (req, res) => {
    const token = req.cookies.authToken;
    if (!token) {
        return res.status(401).json({ message: 'No authentication token' });
    }
    try {
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        res.json({
            success: true,
            user: {
                id: decoded.id,
                email: decoded.email,
                displayName: decoded.displayName,
                profilePictureUrl: decoded.profilePictureUrl,
                username: decoded.username
            }
        });
    }
    catch (error) {
        res.clearCookie('authToken');
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});
// GET /auth/failure
router.get('/failure', (_req, res) => {
    res.status(401).json({ message: 'Authentication failed' });
});
exports.default = router;
