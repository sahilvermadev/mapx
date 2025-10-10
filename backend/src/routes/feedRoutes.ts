import express from 'express';
import { getFeedPostsFromRecommendations, getFeedPostsFromGroups } from '../db/recommendations';

const router = express.Router();

// Temporary authentication middleware (will be replaced with proper auth)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // For now, we'll use a mock user ID from query params
  // In production, this would come from JWT token
  const userId = req.query.currentUserId as string || req.body.currentUserId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  (req as any).user = { id: userId };
  next();
};

/**
 * GET /api/feed
 * Get social feed posts from followed users
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    console.log('=== FEED ENDPOINT ===');
    console.log('feedRoutes - req.query:', req.query);
    
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const groupIds = req.query.groupIds ? 
      (req.query.groupIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : 
      [];
    
    console.log('feedRoutes - userId:', userId);
    console.log('feedRoutes - limit:', limit);
    console.log('feedRoutes - offset:', offset);
    console.log('feedRoutes - groupIds:', groupIds);

    let feedPosts;
    if (groupIds.length > 0) {
      console.log('feedRoutes - Calling getFeedPostsFromGroups');
      feedPosts = await getFeedPostsFromGroups(userId, groupIds, limit, offset);
    } else {
      console.log('feedRoutes - Calling getFeedPostsFromRecommendations');
      feedPosts = await getFeedPostsFromRecommendations(userId, limit, offset);
    }
    
    console.log('feedRoutes - feedPosts count:', feedPosts.length);
    
    res.json({
      success: true,
      data: feedPosts,
      pagination: {
        limit,
        offset,
        total: feedPosts.length // Note: This should be a separate count query in production
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
router.get('/friends', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const feedPosts = await getFeedPostsFromRecommendations(userId, limit, offset);
    
    res.json({
      success: true,
      data: feedPosts,
      pagination: {
        limit,
        offset,
        total: feedPosts.length
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
router.get('/category/:category', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const category = req.params.category;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // For now, we'll get all feed posts and filter by category on the backend
    // In production, this should be done in the database query
    const feedPosts = await getFeedPostsFromRecommendations(userId, limit * 2, offset); // Get more to filter
    
    const filteredPosts = feedPosts.filter(post => 
      post.content_data?.category === category || 
      post.place_name?.toLowerCase().includes(category.toLowerCase()) ||
      post.content_type === category.toLowerCase()
    ).slice(0, limit);
    
    res.json({
      success: true,
      data: filteredPosts,
      pagination: {
        limit,
        offset,
        total: filteredPosts.length
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