import pool from '../db';
import { performance } from 'perf_hooks';

// Types for social network features
export interface UserFollow {
  follower_id: string;
  following_id: string;
  created_at: Date;
}

export interface PrivacySettings {
  user_id: string;
  profile_visibility: 'public' | 'private';
  allow_follow_requests: boolean;
  show_location_in_feed: boolean;
  allow_messages: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AnnotationComment {
  id: number;
  recommendation_id: number;
  user_id: string;
  parent_comment_id?: number;
  comment: string;
  created_at: Date;
  updated_at: Date;
  user_name?: string;
  user_picture?: string;
  likes_count?: number;
  is_liked_by_current_user?: boolean;
  replies?: AnnotationComment[];
}

export interface AnnotationLike {
  id: number;
  recommendation_id: number;
  user_id: string;
  created_at: Date;
}

export interface CommentLike {
  id: number;
  comment_id: number;
  user_id: string;
  created_at: Date;
}

export interface SavedPlace {
  id: number;
  user_id: string;
  place_id: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  place_name?: string;
  place_address?: string;
  place_lat?: number;
  place_lng?: number;
  google_place_id?: string;
}

export interface UserBlock {
  blocker_id: string;
  blocked_id: string;
  created_at: Date;
}

export interface UserWithStats {
  id: string;
  display_name: string;
  email: string;
  profile_picture_url?: string;
  created_at: Date;
  last_login_at: Date;
  followers_count: number;
  following_count: number;
  recommendations_count: number;
  is_following?: boolean;
  is_followed_by?: boolean;
  is_blocked?: boolean;
}

// Follow relationship functions
export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [followerId, followingId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
}

export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
}

export async function getFollowers(userId: string, limit: number = 50, offset: number = 0): Promise<UserWithStats[]> {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.display_name, u.email, u.profile_picture_url, u.created_at, u.last_login_at,
        COUNT(DISTINCT f2.follower_id) as followers_count,
        COUNT(DISTINCT f3.following_id) as following_count,
        COUNT(DISTINCT a.id) as recommendations_count,
        true as is_followed_by,
        f1.created_at as follow_created_at
      FROM users u
      JOIN user_follows f1 ON u.id = f1.follower_id
      LEFT JOIN user_follows f2 ON u.id = f2.following_id
      LEFT JOIN user_follows f3 ON u.id = f3.follower_id
      LEFT JOIN recommendations a ON u.id = a.user_id
      WHERE f1.following_id = $1
      GROUP BY u.id, u.display_name, u.email, u.profile_picture_url, u.created_at, u.last_login_at, f1.created_at
      ORDER BY f1.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting followers:', error);
    throw error;
  }
}

export async function getFollowing(userId: string, limit: number = 50, offset: number = 0): Promise<UserWithStats[]> {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.display_name, u.email, u.profile_picture_url, u.created_at, u.last_login_at,
        COUNT(DISTINCT f2.follower_id) as followers_count,
        COUNT(DISTINCT f3.following_id) as following_count,
        COUNT(DISTINCT a.id) as recommendations_count,
        true as is_following,
        f1.created_at as follow_created_at
      FROM users u
      JOIN user_follows f1 ON u.id = f1.following_id
      LEFT JOIN user_follows f2 ON u.id = f2.following_id
      LEFT JOIN user_follows f3 ON u.id = f3.follower_id
      LEFT JOIN recommendations a ON u.id = a.user_id
      WHERE f1.follower_id = $1
      GROUP BY u.id, u.display_name, u.email, u.profile_picture_url, u.created_at, u.last_login_at, f1.created_at
      ORDER BY f1.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting following:', error);
    throw error;
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error checking follow relationship:', error);
    throw error;
  }
}

// Privacy settings functions
export async function getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
  try {
    const result = await pool.query(
      'SELECT * FROM user_privacy_settings WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    throw error;
  }
}

export async function createPrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
  try {
    const result = await pool.query(
      `INSERT INTO user_privacy_settings (
        user_id, profile_visibility, allow_follow_requests, 
        show_location_in_feed, allow_messages
      ) VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (user_id) DO UPDATE SET
        profile_visibility = EXCLUDED.profile_visibility,
        allow_follow_requests = EXCLUDED.allow_follow_requests,
        show_location_in_feed = EXCLUDED.show_location_in_feed,
        allow_messages = EXCLUDED.allow_messages,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId,
        settings.profile_visibility || 'public',
        settings.allow_follow_requests !== undefined ? settings.allow_follow_requests : true,
        settings.show_location_in_feed !== undefined ? settings.show_location_in_feed : true,
        settings.allow_messages !== undefined ? settings.allow_messages : false
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating/updating privacy settings:', error);
    throw error;
  }
}

// Comment functions
export async function addComment(annotationId: number, userId: string, comment: string, parentCommentId?: number): Promise<AnnotationComment> {
  try {
    // Insert the comment
    const insertResult = await pool.query(
      'INSERT INTO annotation_comments (recommendation_id, user_id, parent_comment_id, comment) VALUES ($1, $2, $3, $4) RETURNING *',
      [annotationId, userId, parentCommentId || null, comment]
    );
    
    const newComment = insertResult.rows[0];
    
    // Get user information for the comment
    const userResult = await pool.query(
      'SELECT display_name as user_name, profile_picture_url as user_picture FROM users WHERE id = $1',
      [userId]
    );
    
    const userInfo = userResult.rows[0];
    
    // Return the comment with user information
    return {
      ...newComment,
      user_name: userInfo?.user_name,
      user_picture: userInfo?.user_picture
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
}

export async function getComments(annotationId: number, currentUserId?: string, limit: number = 50, offset: number = 0): Promise<AnnotationComment[]> {
  try {
    const result = await pool.query(
      `SELECT 
        ac.*, 
        u.display_name as user_name, 
        u.profile_picture_url as user_picture,
        COUNT(cl.id) as likes_count,
        CASE WHEN cl2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user
      FROM annotation_comments ac
      JOIN users u ON ac.user_id = u.id
      LEFT JOIN comment_likes cl ON ac.id = cl.comment_id
      LEFT JOIN comment_likes cl2 ON ac.id = cl2.comment_id AND cl2.user_id = $3
      WHERE ac.recommendation_id = $1
      GROUP BY ac.id, ac.recommendation_id, ac.user_id, ac.parent_comment_id, ac.comment, ac.created_at, ac.updated_at, u.display_name, u.profile_picture_url, cl2.id
      ORDER BY ac.created_at ASC
      LIMIT $2 OFFSET $4`,
      [annotationId, limit, currentUserId, offset]
    );
    
    // Build comment tree structure
    const comments = result.rows;
    const commentMap = new Map();
    const rootComments: AnnotationComment[] = [];
    
    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    
    // Second pass: build tree structure
    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });
    
    return rootComments;
  } catch (error) {
    console.error('Error getting comments:', error);
    throw error;
  }
}

export async function updateComment(commentId: number, userId: string, comment: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'UPDATE annotation_comments SET comment = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id',
      [comment, commentId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
}

export async function deleteComment(commentId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'DELETE FROM annotation_comments WHERE id = $1 AND user_id = $2',
      [commentId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

// Like functions
export async function likeAnnotation(annotationId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'INSERT INTO annotation_likes (recommendation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [annotationId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error liking annotation:', error);
    throw error;
  }
}

export async function unlikeAnnotation(annotationId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'DELETE FROM annotation_likes WHERE recommendation_id = $1 AND user_id = $2',
      [annotationId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error unliking annotation:', error);
    throw error;
  }
}

export async function isAnnotationLiked(annotationId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM annotation_likes WHERE recommendation_id = $1 AND user_id = $2',
      [annotationId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error checking annotation like:', error);
    throw error;
  }
}

export async function getAnnotationLikesCount(annotationId: number): Promise<number> {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM annotation_likes WHERE recommendation_id = $1',
      [annotationId]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting annotation likes count:', error);
    throw error;
  }
}

export async function getUserLikedPosts(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT 
        r.id as recommendation_id,
        r.place_id,
        r.description, r.rating, r.visibility, r.created_at, r.labels, r.metadata, r.content_type, r.content_data,
        p.name as place_name, p.address as place_address, p.lat as place_lat, p.lng as place_lng, p.google_place_id,
        u.id as user_id, u.display_name as user_name, u.profile_picture_url as user_picture,
        COUNT(DISTINCT ac.id) as comments_count,
        COUNT(DISTINCT al.id) as likes_count,
        CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved,
        al.created_at as liked_at
      FROM annotation_likes al
      JOIN recommendations r ON al.recommendation_id = r.id
      JOIN places p ON r.place_id = p.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN annotation_comments ac ON r.id = ac.recommendation_id
      LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
      LEFT JOIN saved_places sp ON p.id = sp.place_id AND sp.user_id = $1
      WHERE al.user_id = $1
      AND r.visibility IN ('public', 'friends')
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
        OR (blocker_id = r.user_id AND blocked_id = $1)
      )
      GROUP BY r.id, r.place_id, r.description, r.rating, r.visibility, r.created_at, r.labels, r.metadata, r.content_type, r.content_data,
               p.name, p.address, p.lat, p.lng, p.google_place_id,
               u.id, u.display_name, u.profile_picture_url, al2.id, sp.id, al.created_at
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting user liked posts:', error);
    throw error;
  }
}

// Comment like functions
export async function likeComment(commentId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [commentId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error liking comment:', error);
    throw error;
  }
}

export async function unlikeComment(commentId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error unliking comment:', error);
    throw error;
  }
}

export async function isCommentLiked(commentId: number, userId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error checking comment like:', error);
    throw error;
  }
}

// Saved places functions
export async function savePlace(userId: string, placeId: number, notes?: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'INSERT INTO saved_places (user_id, place_id, notes) VALUES ($1, $2, $3) ON CONFLICT (user_id, place_id) DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP RETURNING id',
      [userId, placeId, notes]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error saving place:', error);
    throw error;
  }
}

export async function unsavePlace(userId: string, placeId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      'DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2',
      [userId, placeId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error unsaving place:', error);
    throw error;
  }
}

export async function isPlaceSaved(userId: string, placeId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM saved_places WHERE user_id = $1 AND place_id = $2',
      [userId, placeId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error checking saved place:', error);
    throw error;
  }
}

export async function getSavedPlaces(userId: string, limit: number = 50, offset: number = 0): Promise<SavedPlace[]> {
  try {
    const result = await pool.query(
      `SELECT 
        sp.*,
        p.name as place_name,
        p.address as place_address,
        p.lat as place_lat,
        p.lng as place_lng,
        p.google_place_id
      FROM saved_places sp
      JOIN places p ON sp.place_id = p.id
      WHERE sp.user_id = $1
      ORDER BY sp.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting saved places:', error);
    throw error;
  }
}

export async function getSavedPlacesCount(userId: string): Promise<number> {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM saved_places WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting saved places count:', error);
    throw error;
  }
}

// Block functions
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    // First, remove any existing follow relationships
    await pool.query(
      'DELETE FROM user_follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
      [blockerId, blockedId]
    );
    
    const result = await pool.query(
      'INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [blockerId, blockedId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error checking block relationship:', error);
    throw error;
  }
}

// User search and discovery functions
export async function searchUsers(query: string, currentUserId: string, limit: number = 20, offset: number = 0): Promise<UserWithStats[]> {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.display_name, u.username, u.email, u.profile_picture_url, u.created_at, u.last_login_at,
        COUNT(DISTINCT f2.follower_id) as followers_count,
        COUNT(DISTINCT f3.following_id) as following_count,
        COUNT(DISTINCT a.id) as recommendations_count,
        CASE WHEN f1.follower_id IS NOT NULL THEN true ELSE false END as is_following,
        CASE WHEN f4.following_id IS NOT NULL THEN true ELSE false END as is_followed_by,
        CASE WHEN b.blocker_id IS NOT NULL THEN true ELSE false END as is_blocked
      FROM users u
      LEFT JOIN user_follows f1 ON u.id = f1.following_id AND f1.follower_id = $2
      LEFT JOIN user_follows f2 ON u.id = f2.following_id
      LEFT JOIN user_follows f3 ON u.id = f3.follower_id
      LEFT JOIN user_follows f4 ON u.id = f4.follower_id AND f4.following_id = $2
      LEFT JOIN user_blocks b ON (b.blocker_id = $2 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $2)
      LEFT JOIN recommendations a ON u.id = a.user_id
      WHERE u.id != $2 
        AND (u.display_name ILIKE $1 OR u.email ILIKE $1 OR u.username ILIKE $1)
        AND b.blocker_id IS NULL
      GROUP BY u.id, u.display_name, u.username, u.email, u.profile_picture_url, u.created_at, u.last_login_at, f1.follower_id, f4.following_id, b.blocker_id
      ORDER BY 
        CASE WHEN u.display_name ILIKE $1 THEN 1 ELSE 2 END,
        followers_count DESC,
        u.created_at DESC
      LIMIT $3 OFFSET $4`,
      [`%${query}%`, currentUserId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

export async function getUserRecommendations(
  userId: string,
  limit: number = 20,
  offset: number = 0,
  contentType?: 'place' | 'service',
  searchQuery?: string,
  citySlug?: string,
  categoryKeys?: string[]
): Promise<any[]> {
  const startTime = performance.now();
  try {
    // Sanitize and validate search query
    const sanitizedSearch = searchQuery?.trim();
    const hasSearchQuery = sanitizedSearch && sanitizedSearch.length > 0;

    // Build dynamic WHERE clause for optional filters
    const whereParts: string[] = [
      'r.user_id = $1',
      "r.visibility IN ('public', 'friends')"
    ];
    const params: (string | number)[] = [userId];
    let paramCount = 1;

    // Add content type filter if provided
    if (contentType) {
      paramCount++;
      whereParts.push(`r.content_type = $${paramCount}`);
      params.push(contentType);
    }

    // Add search query filter if provided (search in description, title, or place name)
    if (hasSearchQuery) {
      paramCount++;
      const searchPattern = `%${sanitizedSearch}%`;
      whereParts.push(
        `(r.description ILIKE $${paramCount} OR r.title ILIKE $${paramCount} OR p.name ILIKE $${paramCount})`
      );
      params.push(searchPattern);
    }

    // Add city filter if provided
    if (citySlug) {
      paramCount++;
      whereParts.push(`p.city_slug = $${paramCount}`);
      params.push(citySlug);
    }

    // Add category filter if provided
    if (categoryKeys && categoryKeys.length > 0) {
      const categoryConditions: string[] = [];
      categoryKeys.forEach(catKey => {
        paramCount++;
        const paramIndex = paramCount;
        categoryConditions.push(`(
          LOWER(COALESCE(p.primary_type, '')) = LOWER($${paramIndex})
          OR r.content_type = LOWER($${paramIndex})
          OR EXISTS (
            SELECT 1 FROM unnest(r.labels) AS label 
            WHERE LOWER(label::text) LIKE '%' || LOWER($${paramIndex}) || '%'
          )
        )`);
        params.push(catKey);
      });
      if (categoryConditions.length > 0) {
        whereParts.push(`(${categoryConditions.join(' OR ')})`);
      }
    }

    // Add limit and offset at the end
    paramCount++;
    const limitParamIndex = paramCount;
    params.push(limit);
    paramCount++;
    const offsetParamIndex = paramCount;
    params.push(offset);

    // OPTIMIZED: Use subqueries for counts instead of GROUP BY to improve performance
    // This avoids the overhead of grouping all columns when we only need counts
    const result = await pool.query(
      `SELECT 
        r.id as recommendation_id,
        r.place_id,
        r.title,
        r.description, r.rating, r.visibility, r.created_at, r.labels, r.metadata, r.content_type, r.content_data,
        p.name as place_name, p.address as place_address, p.lat as place_lat, p.lng as place_lng, p.google_place_id,
        p.city_name as place_city_name, p.city_slug as place_city_slug, p.country_code as place_country_code, p.admin1_name as place_admin1_name,
        p.primary_type as place_primary_type,
        u.id as user_id, u.display_name as user_name, u.profile_picture_url as user_picture,
        COALESCE(comment_counts.comments_count, 0) as comments_count,
        COALESCE(like_counts.likes_count, 0) as likes_count,
        false as is_liked_by_current_user,
        false as is_saved
      FROM recommendations r
      LEFT JOIN places p ON r.place_id = p.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN (
        SELECT recommendation_id, COUNT(*)::int as comments_count
        FROM annotation_comments
        GROUP BY recommendation_id
      ) comment_counts ON r.id = comment_counts.recommendation_id
      LEFT JOIN (
        SELECT recommendation_id, COUNT(*)::int as likes_count
        FROM annotation_likes
        GROUP BY recommendation_id
      ) like_counts ON r.id = like_counts.recommendation_id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY r.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      params
    );
    
    const duration = performance.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PERF] getUserRecommendations completed in ${duration.toFixed(2)}ms (${result.rows.length} rows, userId: ${userId})`);
    }
    
    return result.rows;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[PERF] Error getting user recommendations after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

export async function getSuggestedUsers(currentUserId: string, limit: number = 10): Promise<UserWithStats[]> {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.display_name, u.username, u.email, u.profile_picture_url, u.created_at, u.last_login_at,
        COUNT(DISTINCT f2.follower_id) as followers_count,
        COUNT(DISTINCT f3.following_id) as following_count,
        COUNT(DISTINCT a.id) as recommendations_count,
        CASE WHEN f1.follower_id IS NOT NULL THEN true ELSE false END as is_following,
        CASE WHEN f4.following_id IS NOT NULL THEN true ELSE false END as is_followed_by,
        CASE WHEN b.blocker_id IS NOT NULL THEN true ELSE false END as is_blocked,
        COUNT(DISTINCT mutual.follower_id) as mutual_followers
      FROM users u
      LEFT JOIN user_follows f1 ON u.id = f1.following_id AND f1.follower_id = $1
      LEFT JOIN user_follows f2 ON u.id = f2.following_id
      LEFT JOIN user_follows f3 ON u.id = f3.follower_id
      LEFT JOIN user_follows f4 ON u.id = f4.follower_id AND f4.following_id = $1
      LEFT JOIN user_blocks b ON (b.blocker_id = $1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = $1)
      LEFT JOIN recommendations a ON u.id = a.user_id
      LEFT JOIN user_follows mutual ON mutual.following_id = u.id AND mutual.follower_id IN (
        SELECT following_id FROM user_follows WHERE follower_id = $1
      )
      WHERE u.id != $1 
        AND f1.follower_id IS NULL
        AND b.blocker_id IS NULL
      GROUP BY u.id, u.display_name, u.username, u.email, u.profile_picture_url, u.created_at, u.last_login_at, f1.follower_id, f4.following_id, b.blocker_id
      ORDER BY mutual_followers DESC, followers_count DESC, u.created_at DESC
      LIMIT $2`,
      [currentUserId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting suggested users:', error);
    throw error;
  }
}

// Feed generation functions
export async function getFeedPosts(userId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT 
        a.id as recommendation_id,
        a.place_id,
        a.description, a.rating, a.visibility, a.created_at, a.labels, a.metadata, a.content_type, a.content_data,
        p.name as place_name, p.address as place_address, p.lat as place_lat, p.lng as place_lng, p.google_place_id,
        u.id as user_id, u.display_name as user_name, u.profile_picture_url as user_picture,
        COUNT(DISTINCT ac.id) as comments_count,
        COUNT(DISTINCT al.id) as likes_count,
        CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
      FROM recommendations a
      JOIN places p ON a.place_id = p.id
      JOIN users u ON a.user_id = u.id
      LEFT JOIN annotation_comments ac ON a.id = ac.recommendation_id
      LEFT JOIN annotation_likes al ON a.id = al.recommendation_id
      LEFT JOIN annotation_likes al2 ON a.id = al2.recommendation_id AND al2.user_id = $1
      LEFT JOIN saved_places sp ON p.id = sp.place_id AND sp.user_id = $1
      WHERE a.user_id IN (
        SELECT following_id FROM user_follows WHERE follower_id = $1
      )
      AND a.visibility IN ('public', 'friends')
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = $1 AND blocked_id = a.user_id) 
        OR (blocker_id = a.user_id AND blocked_id = $1)
      )
      GROUP BY a.id, a.place_id, a.notes, a.rating, a.visit_date, a.visibility, a.created_at, a.labels, a.metadata,
               p.name, p.address, p.lat, p.lng, p.google_place_id,
               u.id, u.display_name, u.profile_picture_url, al2.id, sp.id
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting feed posts:', error);
    throw error;
  }
} 