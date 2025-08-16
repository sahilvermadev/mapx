"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
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
        const token = jsonwebtoken_1.default.sign({
            id: mockUser.id,
            email: mockUser.email,
            displayName: mockUser.display_name,
            profilePictureUrl: mockUser.profile_picture_url,
        }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '24h' });
        res.redirect(`http://localhost:5173/auth/success?token=${token}`);
    }
    catch (error) {
        console.error('Dev login error:', error);
        res.status(500).json({ message: 'Development login failed' });
    }
});
router.get('/google', passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/auth/failure' }), (req, res) => {
    const user = req.user;
    if (!user?.id)
        return res.redirect('/auth/failure');
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        profilePictureUrl: user.profile_picture_url,
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.redirect(`http://localhost:5173/auth/success?token=${token}`);
});
router.get('/success', (req, res) => {
    if (req.user)
        return res.status(200).json({ message: 'Login successful!', user: req.user });
    res.status(401).json({ message: 'Not authenticated.' });
});
router.get('/failure', (_req, res) => res.status(401).json({ message: 'Authentication failed!' }));
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err)
            return next(err);
        req.session.destroy((destroyErr) => {
            if (destroyErr)
                return res.status(500).json({ message: 'Logout failed.' });
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Logged out successfully.' });
        });
    });
});
exports.default = router;
