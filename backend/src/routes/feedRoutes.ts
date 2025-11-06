import express from 'express';
import { getFeedPostsFromRecommendations, getFeedPostsFromGroups, getUnifiedFeedPosts } from '../db/recommendations';

const router = express.Router();


/**
 * GET /api/feed
 * Get social feed posts from followed users
 */
router.get('/', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== FEED ENDPOINT ===');
      console.log('feedRoutes - req.query:', req.query);
    }
    
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const cursorCreatedAt = (req.query.cursorCreatedAt as string) || undefined;
    const cursorId = req.query.cursorId ? parseInt(req.query.cursorId as string) : undefined;
    const groupIds = req.query.groupIds ? 
      (req.query.groupIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : 
      [];
    const category = (req.query.category as string) || undefined;
    const citySlug = (req.query.city_slug as string) || undefined;
    const countryCode = (req.query.country_code as string) || undefined;
    const includeQna = (req.query.includeQna as string) === 'true';
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('feedRoutes - userId:', userId);
      console.log('feedRoutes - limit:', limit);
      console.log('feedRoutes - cursorCreatedAt:', cursorCreatedAt);
      console.log('feedRoutes - cursorId:', cursorId);
      console.log('feedRoutes - groupIds:', groupIds);
      console.log('feedRoutes - category:', category);
    }

    let feedPosts;
    if (includeQna) {
      if (process.env.NODE_ENV !== 'production') console.log('feedRoutes - Calling getUnifiedFeedPosts');
      feedPosts = await getUnifiedFeedPosts(userId, limit, cursorCreatedAt, cursorId, true, citySlug, countryCode);
    } else if (groupIds.length > 0) {
      if (process.env.NODE_ENV !== 'production') console.log('feedRoutes - Calling getFeedPostsFromGroups');
      feedPosts = await getFeedPostsFromGroups(userId, groupIds, limit, cursorCreatedAt, cursorId, category);
    } else {
      if (process.env.NODE_ENV !== 'production') console.log('feedRoutes - Calling getFeedPostsFromRecommendations');
      feedPosts = await getFeedPostsFromRecommendations(userId, limit, cursorCreatedAt, cursorId, category, citySlug, countryCode);
    }
    
    if (process.env.NODE_ENV !== 'production') console.log('feedRoutes - feedPosts count (raw):', feedPosts.length);
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

  } catch (error) {
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
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const cursorCreatedAt = (req.query.cursorCreatedAt as string) || undefined;
    const cursorId = req.query.cursorId ? parseInt(req.query.cursorId as string) : undefined;

    const feedPosts = await getFeedPostsFromRecommendations(userId, limit, cursorCreatedAt, cursorId);
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

  } catch (error) {
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
    const userId = (req as any).user.id;
    const category = req.params.category;
    const limit = parseInt(req.query.limit as string) || 20;
    const cursorCreatedAt = (req.query.cursorCreatedAt as string) || undefined;
    const cursorId = req.query.cursorId ? parseInt(req.query.cursorId as string) : undefined;

    // For now, we'll get all feed posts and filter by category on the backend
    // In production, this should be done in the database query
    const feedPostsRaw = await getFeedPostsFromRecommendations(userId, limit + 1, cursorCreatedAt, cursorId, category);

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

  } catch (error) {
    console.error('Error getting category feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category feed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 