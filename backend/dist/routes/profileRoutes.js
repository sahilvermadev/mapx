"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recommendations_1 = require("../db/recommendations");
const social_1 = require("../db/social");
const db_1 = __importDefault(require("../db"));
const router = express_1.default.Router();
// Note: Authentication is now handled by the JWT middleware in index.ts
/**
 * GET /api/profile/:userId
 * Get user profile data
 */
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db_1.default.query(`SELECT id, display_name, email, profile_picture_url, username, created_at, last_login_at
       FROM users 
       WHERE id = $1`, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        const userData = result.rows[0];
        res.json({
            success: true,
            data: {
                id: userData.id,
                displayName: userData.display_name,
                email: userData.email,
                username: userData.username,
                profilePictureUrl: userData.profile_picture_url,
                created_at: userData.created_at,
                last_login_at: userData.last_login_at
            }
        });
    }
    catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/profile/:userId/stats
 * Get user statistics
 */
router.get('/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        // Get total recommendations
        const recommendationsResult = await db_1.default.query('SELECT COUNT(*) as count FROM recommendations WHERE user_id = $1', [userId]);
        // Get total likes (placeholder - likes functionality not implemented yet)
        const likesResult = { rows: [{ count: '0' }] };
        // Get total saved places
        const savedCount = await (0, social_1.getSavedPlacesCount)(userId);
        // Get average rating
        const avgRatingResult = await db_1.default.query('SELECT AVG(rating) as avg_rating FROM recommendations WHERE user_id = $1 AND rating IS NOT NULL', [userId]);
        // Get total places visited
        const placesVisitedResult = await db_1.default.query('SELECT COUNT(DISTINCT place_id) as count FROM recommendations WHERE user_id = $1', [userId]);
        // Get total reviews
        const reviewsResult = await db_1.default.query('SELECT COUNT(*) as count FROM recommendations WHERE user_id = $1 AND description IS NOT NULL AND description != \'\'', [userId]);
        res.json({
            success: true,
            data: {
                total_recommendations: parseInt(recommendationsResult.rows[0].count),
                total_likes: parseInt(likesResult.rows[0].count),
                total_saved: savedCount,
                average_rating: parseFloat(avgRatingResult.rows[0].avg_rating) || 0,
                total_places_visited: parseInt(placesVisitedResult.rows[0].count),
                total_reviews: parseInt(reviewsResult.rows[0].count)
            }
        });
    }
    catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user stats',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/profile/:userId/recommendations
 * Get user recommendations in feed post format
 */
router.get('/:userId/recommendations', async (req, res) => {
    try {
        const { userId } = req.params;
        const { sort_field = 'created_at', sort_direction = 'desc', limit = 20, offset = 0, content_type } = req.query;
        const { getUserRecommendations } = await Promise.resolve().then(() => __importStar(require('../db/social')));
        const recommendations = await getUserRecommendations(userId, parseInt(limit), parseInt(offset), content_type);
        res.json({
            success: true,
            data: recommendations,
            pagination: {
                total: recommendations.length,
                page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
                limit: parseInt(limit),
                totalPages: Math.ceil(recommendations.length / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching user recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user recommendations',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/profile/:userId/likes
 * Get user liked posts
 */
router.get('/:userId/likes', async (req, res) => {
    try {
        const { userId } = req.params;
        const { sort_field = 'created_at', sort_direction = 'desc', limit = 20, offset = 0 } = req.query;
        const { getUserLikedPosts } = await Promise.resolve().then(() => __importStar(require('../db/social')));
        const likedPosts = await getUserLikedPosts(userId, parseInt(limit), parseInt(offset));
        res.json({
            success: true,
            data: likedPosts,
            pagination: {
                total: likedPosts.length,
                page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
                limit: parseInt(limit),
                totalPages: Math.ceil(likedPosts.length / parseInt(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching user likes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user likes',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/profile/:userId/saved
 * Get user saved places
 */
router.get('/:userId/saved', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, offset = 0 } = req.query;
        const limitNum = parseInt(limit);
        const offsetNum = parseInt(offset);
        const savedPlaces = await (0, social_1.getSavedPlaces)(userId, limitNum, offsetNum);
        const totalCount = await (0, social_1.getSavedPlacesCount)(userId);
        res.json({
            success: true,
            data: savedPlaces,
            pagination: {
                total: totalCount,
                page: Math.floor(offsetNum / limitNum) + 1,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Error fetching user saved places:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user saved places',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /api/profile/recommendations/:annotationId
 * Delete a recommendation
 */
router.delete('/recommendations/:annotationId', async (req, res) => {
    try {
        const { annotationId } = req.params;
        const success = await (0, recommendations_1.deleteRecommendation)(parseInt(annotationId), 'test-user-id');
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found or access denied'
            });
        }
        res.json({
            success: true,
            message: 'Recommendation deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete recommendation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /api/profile/likes/:placeId
 * Unlike a place (placeholder)
 */
router.delete('/likes/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;
        // For now, return success since likes functionality needs to be implemented
        res.json({
            success: true,
            message: 'Place unliked successfully'
        });
    }
    catch (error) {
        console.error('Error unliking place:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unlike place',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /api/profile/saved/:placeId
 * Remove place from saved (placeholder)
 */
router.delete('/saved/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;
        // For now, return success since saved functionality needs to be implemented
        res.json({
            success: true,
            message: 'Place removed from saved successfully'
        });
    }
    catch (error) {
        console.error('Error removing place from saved:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove place from saved',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
