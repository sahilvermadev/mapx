import express from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  isFollowing,
  getPrivacySettings,
  createPrivacySettings,
  addComment,
  getComments,
  updateComment,
  deleteComment,
  likeAnnotation,
  unlikeAnnotation,
  isAnnotationLiked,
  getAnnotationLikesCount,
  likeComment,
  unlikeComment,
  isCommentLiked,
  savePlace,
  unsavePlace,
  isPlaceSaved,
  getSavedPlaces,
  getSavedPlacesCount,
  blockUser,
  unblockUser,
  isBlocked,
  searchUsers,
  getSuggestedUsers,
  type UserWithStats,
  type PrivacySettings,
  type AnnotationComment,
  type SavedPlace
} from '../db/social';
import { getFeedPostsFromRecommendations } from '../db/recommendations';
import { extractMentionUserIds, saveCommentMentions } from '../db/mentions';

const router = express.Router();


/**
 * POST /api/social/follow/:userId
 * Follow a user
 */
router.post('/follow/:userId', async (req, res) => {
  try {
    const followerId = (req as any).user.id;
    const followingId = req.params.userId;

    if (followerId === followingId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    const success = await followUser(followerId, followingId);
    
    res.json({
      success: true,
      data: { following: success },
      message: success ? 'Successfully followed user' : 'Already following user'
    });

  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to follow user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/unfollow/:userId
 * Unfollow a user
 */
router.delete('/unfollow/:userId', async (req, res) => {
  try {
    const followerId = (req as any).user.id;
    const followingId = req.params.userId;

    const success = await unfollowUser(followerId, followingId);
    
    res.json({
      success: true,
      data: { unfollowing: success },
      message: success ? 'Successfully unfollowed user' : 'Not following user'
    });

  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/followers/:userId
 * Get user's followers
 */
router.get('/followers/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const followers = await getFollowers(userId, limit, offset);
    
    res.json({
      success: true,
      data: followers,
      pagination: {
        limit,
        offset,
        total: followers.length // Note: This should be a separate count query in production
      }
    });

  } catch (error) {
    console.error('Error getting followers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get followers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/following/:userId
 * Get users that the user is following
 */
router.get('/following/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const following = await getFollowing(userId, limit, offset);
    
    res.json({
      success: true,
      data: following,
      pagination: {
        limit,
        offset,
        total: following.length // Note: This should be a separate count query in production
      }
    });

  } catch (error) {
    console.error('Error getting following:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get following',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/users/search
 * Search for users
 */
router.get('/users/search', async (req, res) => {
  try {
    const currentUserId = (req as any).user.id;
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const users = await searchUsers(query.trim(), currentUserId, limit, offset);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        limit,
        offset,
        total: users.length // Note: This should be a separate count query in production
      }
    });

  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/users/suggestions
 * Get suggested users to follow
 */
router.get('/users/suggestions', async (req, res) => {
  try {
    const currentUserId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const suggestions = await getSuggestedUsers(currentUserId, limit);
    
    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Error getting user suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user suggestions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/privacy-settings
 * Get user's privacy settings
 */
router.get('/privacy-settings', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const settings = await getPrivacySettings(userId);
    
    res.json({
      success: true,
      data: settings || {
        user_id: userId,
        profile_visibility: 'public',
        allow_follow_requests: true,
        show_location_in_feed: true,
        allow_messages: false
      }
    });

  } catch (error) {
    console.error('Error getting privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get privacy settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/social/privacy-settings
 * Update user's privacy settings
 */
router.put('/privacy-settings', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const settings = req.body;

    const updatedSettings = await createPrivacySettings(userId, settings);
    
    res.json({
      success: true,
      data: updatedSettings,
      message: 'Privacy settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/block/:userId
 * Block a user
 */
router.post('/block/:userId', async (req, res) => {
  try {
    const blockerId = (req as any).user.id;
    const blockedId = req.params.userId;

    if (blockerId === blockedId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself'
      });
    }

    const success = await blockUser(blockerId, blockedId);
    
    res.json({
      success: true,
      data: { blocked: success },
      message: success ? 'Successfully blocked user' : 'User already blocked'
    });

  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/unblock/:userId
 * Unblock a user
 */
router.delete('/unblock/:userId', async (req, res) => {
  try {
    const blockerId = (req as any).user.id;
    const blockedId = req.params.userId;

    const success = await unblockUser(blockerId, blockedId);
    
    res.json({
      success: true,
      data: { unblocked: success },
      message: success ? 'Successfully unblocked user' : 'User not blocked'
    });

  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/comments/:recommendationId
 * Add a comment to a recommendation
 */
router.post('/comments/:recommendationId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const recommendationId = parseInt(req.params.recommendationId);
    const { comment, parent_comment_id } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    const newComment = await addComment(recommendationId, userId, comment.trim(), parent_comment_id);
    // Save mentions in the comment, if any
    try {
      const mentioned = extractMentionUserIds(comment);
      if (mentioned.length > 0) {
        await saveCommentMentions(newComment.id, mentioned, userId, comment.trim());
      }
    } catch (e) {
      console.error('Failed to process/save comment mentions', e);
    }
    
    res.status(201).json({
      success: true,
      data: newComment,
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/comments/:recommendationId
 * Get comments for a recommendation
 */
router.get('/comments/:recommendationId', async (req, res) => {
  try {
    const currentUserId = (req as any).user.id;
    const recommendationId = parseInt(req.params.recommendationId);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const comments = await getComments(recommendationId, currentUserId, limit, offset);
    
    res.json({
      success: true,
      data: comments,
      pagination: {
        limit,
        offset,
        total: comments.length // Note: This should be a separate count query in production
      }
    });

  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comments',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/social/comments/:commentId
 * Update a comment
 */
router.put('/comments/:commentId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const commentId = parseInt(req.params.commentId);
    const { comment } = req.body;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    const success = await updateComment(commentId, userId, comment.trim());
    
    res.json({
      success: true,
      data: { updated: success },
      message: success ? 'Comment updated successfully' : 'Comment not found or not authorized'
    });

  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/comments/:commentId
 * Delete a comment
 */
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const commentId = parseInt(req.params.commentId);

    const success = await deleteComment(commentId, userId);
    
    res.json({
      success: true,
      data: { deleted: success },
      message: success ? 'Comment deleted successfully' : 'Comment not found or not authorized'
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/likes/recommendation/:recommendationId
 * Like a recommendation
 */
router.post('/likes/recommendation/:recommendationId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const recommendationId = parseInt(req.params.recommendationId);

    const success = await likeAnnotation(recommendationId, userId);
    
    res.json({
      success: true,
      data: { liked: success },
      message: success ? 'Annotation liked successfully' : 'Already liked'
    });

  } catch (error) {
    console.error('Error liking annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like annotation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/likes/recommendation/:recommendationId
 * Unlike a recommendation
 */
router.delete('/likes/recommendation/:recommendationId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const recommendationId = parseInt(req.params.recommendationId);

    const success = await unlikeAnnotation(recommendationId, userId);
    
    res.json({
      success: true,
      data: { unliked: success },
      message: success ? 'Annotation unliked successfully' : 'Not liked'
    });

  } catch (error) {
    console.error('Error unliking annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike annotation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/likes/recommendation/:recommendationId
 * Get recommendation likes count and check if current user liked it
 */
router.get('/likes/recommendation/:recommendationId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const recommendationId = parseInt(req.params.recommendationId);

    const [likesCount, isLiked] = await Promise.all([
      getAnnotationLikesCount(recommendationId),
      isAnnotationLiked(recommendationId, userId)
    ]);
    
    res.json({
      success: true,
      data: {
        likes_count: likesCount,
        is_liked: isLiked
      }
    });

  } catch (error) {
    console.error('Error getting annotation likes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get annotation likes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/likes/comment/:commentId
 * Like a comment
 */
router.post('/likes/comment/:commentId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const commentId = parseInt(req.params.commentId);

    const success = await likeComment(commentId, userId);
    
    res.json({
      success: true,
      data: { liked: success },
      message: success ? 'Comment liked successfully' : 'Already liked'
    });

  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/likes/comment/:commentId
 * Unlike a comment
 */
router.delete('/likes/comment/:commentId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const commentId = parseInt(req.params.commentId);

    const success = await unlikeComment(commentId, userId);
    
    res.json({
      success: true,
      data: { unliked: success },
      message: success ? 'Comment unliked successfully' : 'Not liked'
    });

  } catch (error) {
    console.error('Error unliking comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike comment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/saved/:placeId
 * Save a place
 */
router.post('/saved/:placeId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const placeId = parseInt(req.params.placeId);
    const { notes } = req.body;

    const success = await savePlace(userId, placeId, notes);
    
    res.json({
      success: true,
      data: { saved: success },
      message: success ? 'Place saved successfully' : 'Place already saved'
    });

  } catch (error) {
    console.error('Error saving place:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save place',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/saved/:placeId
 * Remove place from saved
 */
router.delete('/saved/:placeId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const placeId = parseInt(req.params.placeId);

    const success = await unsavePlace(userId, placeId);
    
    res.json({
      success: true,
      data: { unsaved: success },
      message: success ? 'Place removed from saved successfully' : 'Place not saved'
    });

  } catch (error) {
    console.error('Error unsaving place:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsave place',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/saved/:placeId
 * Check if place is saved by current user
 */
router.get('/saved/:placeId', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const placeId = parseInt(req.params.placeId);

    const isSaved = await isPlaceSaved(userId, placeId);
    
    res.json({
      success: true,
      data: {
        is_saved: isSaved
      }
    });

  } catch (error) {
    console.error('Error checking saved place:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check saved place',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 