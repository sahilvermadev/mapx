"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recommendations_1 = require("../db/recommendations");
const router = express_1.default.Router();
/**
 * GET /api/feed
 * Get social feed posts from followed users
 */
router.get('/', async (req, res) => {
    try {
        console.log('=== FEED ENDPOINT ===');
        console.log('feedRoutes - req.query:', req.query);
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const cursorCreatedAt = req.query.cursorCreatedAt || undefined;
        const cursorId = req.query.cursorId ? parseInt(req.query.cursorId) : undefined;
        const groupIds = req.query.groupIds ?
            req.query.groupIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) :
            [];
        const category = req.query.category || undefined;
        const citySlug = req.query.city_slug || undefined;
        const countryCode = req.query.country_code || undefined;
        const includeQna = req.query.includeQna === 'true';
        console.log('feedRoutes - userId:', userId);
        console.log('feedRoutes - limit:', limit);
        console.log('feedRoutes - cursorCreatedAt:', cursorCreatedAt);
        console.log('feedRoutes - cursorId:', cursorId);
        console.log('feedRoutes - groupIds:', groupIds);
        console.log('feedRoutes - category:', category);
        let feedPosts;
        if (includeQna) {
            console.log('feedRoutes - Calling getUnifiedFeedPosts');
            feedPosts = await (0, recommendations_1.getUnifiedFeedPosts)(userId, limit, cursorCreatedAt, cursorId, true);
        }
        else if (groupIds.length > 0) {
            console.log('feedRoutes - Calling getFeedPostsFromGroups');
            feedPosts = await (0, recommendations_1.getFeedPostsFromGroups)(userId, groupIds, limit, cursorCreatedAt, cursorId, category);
        }
        else {
            console.log('feedRoutes - Calling getFeedPostsFromRecommendations');
            feedPosts = await (0, recommendations_1.getFeedPostsFromRecommendations)(userId, limit, cursorCreatedAt, cursorId, category, citySlug, countryCode);
        }
        console.log('feedRoutes - feedPosts count (raw):', feedPosts.length);
        const hasNext = feedPosts.length > limit;
        const data = hasNext ? feedPosts.slice(0, limit) : feedPosts;
        const last = data[data.length - 1];
        const nextCursor = hasNext && last ? { createdAt: last.created_at, id: last.id || last.recommendation_id } : null;
        res.json({
            success: true,
            data,
            pagination: {
                limit,
                hasNext,
                nextCursor
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
router.get('/friends', async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const cursorCreatedAt = req.query.cursorCreatedAt || undefined;
        const cursorId = req.query.cursorId ? parseInt(req.query.cursorId) : undefined;
        const feedPosts = await (0, recommendations_1.getFeedPostsFromRecommendations)(userId, limit, cursorCreatedAt, cursorId);
        const hasNext = feedPosts.length > limit;
        const data = hasNext ? feedPosts.slice(0, limit) : feedPosts;
        const last = data[data.length - 1];
        const nextCursor = hasNext && last ? { createdAt: last.created_at, id: last.recommendation_id } : null;
        res.json({
            success: true,
            data,
            pagination: {
                limit,
                hasNext,
                nextCursor
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
router.get('/category/:category', async (req, res) => {
    try {
        const userId = req.user.id;
        const category = req.params.category;
        const limit = parseInt(req.query.limit) || 20;
        const cursorCreatedAt = req.query.cursorCreatedAt || undefined;
        const cursorId = req.query.cursorId ? parseInt(req.query.cursorId) : undefined;
        // For now, we'll get all feed posts and filter by category on the backend
        // In production, this should be done in the database query
        const feedPostsRaw = await (0, recommendations_1.getFeedPostsFromRecommendations)(userId, limit + 1, cursorCreatedAt, cursorId, category);
        const filteredPosts = feedPostsRaw; // already filtered in SQL now
        const hasNext = filteredPosts.length > limit;
        const data = hasNext ? filteredPosts.slice(0, limit) : filteredPosts;
        const last = data[data.length - 1];
        const nextCursor = hasNext && last ? { createdAt: last.created_at, id: last.recommendation_id } : null;
        res.json({
            success: true,
            data,
            pagination: {
                limit,
                hasNext,
                nextCursor
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
