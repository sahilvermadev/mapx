"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const social_1 = require("../db/social");
const router = express_1.default.Router();
// Temporary authentication middleware (will be replaced with proper auth)
const requireAuth = (req, res, next) => {
    // For now, we'll use a mock user ID from query params
    // In production, this would come from JWT token
    const userId = req.query.currentUserId || req.body.currentUserId;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    req.user = { id: userId };
    next();
};
/**
 * GET /api/feed
 * Get social feed posts from followed users
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const feedPosts = await (0, social_1.getFeedPosts)(userId, limit, offset);
        res.json({
            success: true,
            data: feedPosts,
            pagination: {
                limit,
                offset,
                total: feedPosts.length // Note: This should be a separate count query in production
            }
        });
    }
    catch (error) {
        console.error('Error getting feed posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get feed posts',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/feed/friends
 * Get feed posts from friends only (same as main feed for now)
 */
router.get('/friends', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const feedPosts = await (0, social_1.getFeedPosts)(userId, limit, offset);
        res.json({
            success: true,
            data: feedPosts,
            pagination: {
                limit,
                offset,
                total: feedPosts.length
            }
        });
    }
    catch (error) {
        console.error('Error getting friends feed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get friends feed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/feed/category/:category
 * Get feed posts filtered by category
 */
router.get('/category/:category', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const category = req.params.category;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // For now, we'll get all feed posts and filter by category on the backend
        // In production, this should be done in the database query
        const feedPosts = await (0, social_1.getFeedPosts)(userId, limit * 2, offset); // Get more to filter
        const filteredPosts = feedPosts.filter(post => post.metadata?.category === category ||
            post.place_name?.toLowerCase().includes(category.toLowerCase())).slice(0, limit);
        res.json({
            success: true,
            data: filteredPosts,
            pagination: {
                limit,
                offset,
                total: filteredPosts.length
            }
        });
    }
    catch (error) {
        console.error('Error getting category feed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get category feed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
