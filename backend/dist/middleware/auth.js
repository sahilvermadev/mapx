"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserIdFromRequest = exports.authenticateJWT = void 0;
// backend/src/middleware/auth.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// JWT authentication middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token required'
        });
    }
    try {
        const secret = process.env.JWT_SECRET || 'dev-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (!decoded?.id) {
            return res.status(403).json({
                success: false,
                error: 'Invalid token: missing user ID'
            });
        }
        // Attach user info to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            displayName: decoded.displayName,
            profilePictureUrl: decoded.profilePictureUrl,
            username: decoded.username
        };
        next();
    }
    catch (err) {
        console.warn('JWT verification failed:', err);
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
};
exports.authenticateJWT = authenticateJWT;
// Helper function to extract user ID from request (for backward compatibility)
const getUserIdFromRequest = (req) => {
    // First check if user is set by JWT middleware
    if (req.user && req.user.id) {
        return req.user.id;
    }
    // Fallback to manual JWT verification (for routes that don't use the middleware)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const secret = process.env.JWT_SECRET || 'dev-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        return decoded?.id || null;
    }
    catch (err) {
        console.warn('JWT verification failed in getUserIdFromRequest:', err);
        return null;
    }
};
exports.getUserIdFromRequest = getUserIdFromRequest;
