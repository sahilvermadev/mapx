"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.followUser = followUser;
exports.unfollowUser = unfollowUser;
exports.getFollowers = getFollowers;
exports.getFollowing = getFollowing;
exports.isFollowing = isFollowing;
exports.getPrivacySettings = getPrivacySettings;
exports.createPrivacySettings = createPrivacySettings;
exports.addComment = addComment;
exports.getComments = getComments;
exports.updateComment = updateComment;
exports.deleteComment = deleteComment;
exports.likeAnnotation = likeAnnotation;
exports.unlikeAnnotation = unlikeAnnotation;
exports.isAnnotationLiked = isAnnotationLiked;
exports.getAnnotationLikesCount = getAnnotationLikesCount;
exports.getUserLikedPosts = getUserLikedPosts;
exports.likeComment = likeComment;
exports.unlikeComment = unlikeComment;
exports.isCommentLiked = isCommentLiked;
exports.savePlace = savePlace;
exports.unsavePlace = unsavePlace;
exports.isPlaceSaved = isPlaceSaved;
exports.getSavedPlaces = getSavedPlaces;
exports.getSavedPlacesCount = getSavedPlacesCount;
exports.blockUser = blockUser;
exports.unblockUser = unblockUser;
exports.isBlocked = isBlocked;
exports.searchUsers = searchUsers;
exports.getUserRecommendations = getUserRecommendations;
exports.getSuggestedUsers = getSuggestedUsers;
exports.getFeedPosts = getFeedPosts;
const db_1 = __importDefault(require("../db"));
// Follow relationship functions
async function followUser(followerId, followingId) {
    try {
        const result = await db_1.default.query('INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [followerId, followingId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error following user:', error);
        throw error;
    }
}
async function unfollowUser(followerId, followingId) {
    try {
        const result = await db_1.default.query('DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error unfollowing user:', error);
        throw error;
    }
}
async function getFollowers(userId, limit = 50, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting followers:', error);
        throw error;
    }
}
async function getFollowing(userId, limit = 50, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting following:', error);
        throw error;
    }
}
async function isFollowing(followerId, followingId) {
    try {
        const result = await db_1.default.query('SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error checking follow relationship:', error);
        throw error;
    }
}
// Privacy settings functions
async function getPrivacySettings(userId) {
    try {
        const result = await db_1.default.query('SELECT * FROM user_privacy_settings WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('Error getting privacy settings:', error);
        throw error;
    }
}
async function createPrivacySettings(userId, settings) {
    try {
        const result = await db_1.default.query(`INSERT INTO user_privacy_settings (
        user_id, profile_visibility, allow_follow_requests, 
        show_location_in_feed, allow_messages
      ) VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (user_id) DO UPDATE SET
        profile_visibility = EXCLUDED.profile_visibility,
        allow_follow_requests = EXCLUDED.allow_follow_requests,
        show_location_in_feed = EXCLUDED.show_location_in_feed,
        allow_messages = EXCLUDED.allow_messages,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`, [
            userId,
            settings.profile_visibility || 'public',
            settings.allow_follow_requests !== undefined ? settings.allow_follow_requests : true,
            settings.show_location_in_feed !== undefined ? settings.show_location_in_feed : true,
            settings.allow_messages !== undefined ? settings.allow_messages : false
        ]);
        return result.rows[0];
    }
    catch (error) {
        console.error('Error creating/updating privacy settings:', error);
        throw error;
    }
}
// Comment functions
async function addComment(annotationId, userId, comment, parentCommentId) {
    try {
        // Insert the comment
        const insertResult = await db_1.default.query('INSERT INTO annotation_comments (recommendation_id, user_id, parent_comment_id, comment) VALUES ($1, $2, $3, $4) RETURNING *', [annotationId, userId, parentCommentId || null, comment]);
        const newComment = insertResult.rows[0];
        // Get user information for the comment
        const userResult = await db_1.default.query('SELECT display_name as user_name, profile_picture_url as user_picture FROM users WHERE id = $1', [userId]);
        const userInfo = userResult.rows[0];
        // Return the comment with user information
        return {
            ...newComment,
            user_name: userInfo?.user_name,
            user_picture: userInfo?.user_picture
        };
    }
    catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
}
async function getComments(annotationId, currentUserId, limit = 50, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2 OFFSET $4`, [annotationId, limit, currentUserId, offset]);
        // Build comment tree structure
        const comments = result.rows;
        const commentMap = new Map();
        const rootComments = [];
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
            }
            else {
                rootComments.push(commentMap.get(comment.id));
            }
        });
        return rootComments;
    }
    catch (error) {
        console.error('Error getting comments:', error);
        throw error;
    }
}
async function updateComment(commentId, userId, comment) {
    try {
        const result = await db_1.default.query('UPDATE annotation_comments SET comment = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id', [comment, commentId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error updating comment:', error);
        throw error;
    }
}
async function deleteComment(commentId, userId) {
    try {
        const result = await db_1.default.query('DELETE FROM annotation_comments WHERE id = $1 AND user_id = $2', [commentId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error deleting comment:', error);
        throw error;
    }
}
// Like functions
async function likeAnnotation(annotationId, userId) {
    try {
        const result = await db_1.default.query('INSERT INTO annotation_likes (recommendation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [annotationId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error liking annotation:', error);
        throw error;
    }
}
async function unlikeAnnotation(annotationId, userId) {
    try {
        const result = await db_1.default.query('DELETE FROM annotation_likes WHERE recommendation_id = $1 AND user_id = $2', [annotationId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error unliking annotation:', error);
        throw error;
    }
}
async function isAnnotationLiked(annotationId, userId) {
    try {
        const result = await db_1.default.query('SELECT 1 FROM annotation_likes WHERE recommendation_id = $1 AND user_id = $2', [annotationId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error checking annotation like:', error);
        throw error;
    }
}
async function getAnnotationLikesCount(annotationId) {
    try {
        const result = await db_1.default.query('SELECT COUNT(*) as count FROM annotation_likes WHERE recommendation_id = $1', [annotationId]);
        return parseInt(result.rows[0].count);
    }
    catch (error) {
        console.error('Error getting annotation likes count:', error);
        throw error;
    }
}
async function getUserLikedPosts(userId, limit = 20, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting user liked posts:', error);
        throw error;
    }
}
// Comment like functions
async function likeComment(commentId, userId) {
    try {
        const result = await db_1.default.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [commentId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error liking comment:', error);
        throw error;
    }
}
async function unlikeComment(commentId, userId) {
    try {
        const result = await db_1.default.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error unliking comment:', error);
        throw error;
    }
}
async function isCommentLiked(commentId, userId) {
    try {
        const result = await db_1.default.query('SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error checking comment like:', error);
        throw error;
    }
}
// Saved places functions
async function savePlace(userId, placeId, notes) {
    try {
        const result = await db_1.default.query('INSERT INTO saved_places (user_id, place_id, notes) VALUES ($1, $2, $3) ON CONFLICT (user_id, place_id) DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP RETURNING id', [userId, placeId, notes]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error saving place:', error);
        throw error;
    }
}
async function unsavePlace(userId, placeId) {
    try {
        const result = await db_1.default.query('DELETE FROM saved_places WHERE user_id = $1 AND place_id = $2', [userId, placeId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error unsaving place:', error);
        throw error;
    }
}
async function isPlaceSaved(userId, placeId) {
    try {
        const result = await db_1.default.query('SELECT 1 FROM saved_places WHERE user_id = $1 AND place_id = $2', [userId, placeId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error checking saved place:', error);
        throw error;
    }
}
async function getSavedPlaces(userId, limit = 50, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting saved places:', error);
        throw error;
    }
}
async function getSavedPlacesCount(userId) {
    try {
        const result = await db_1.default.query('SELECT COUNT(*) as count FROM saved_places WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }
    catch (error) {
        console.error('Error getting saved places count:', error);
        throw error;
    }
}
// Block functions
async function blockUser(blockerId, blockedId) {
    try {
        // First, remove any existing follow relationships
        await db_1.default.query('DELETE FROM user_follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)', [blockerId, blockedId]);
        const result = await db_1.default.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [blockerId, blockedId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error blocking user:', error);
        throw error;
    }
}
async function unblockUser(blockerId, blockedId) {
    try {
        const result = await db_1.default.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [blockerId, blockedId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error unblocking user:', error);
        throw error;
    }
}
async function isBlocked(blockerId, blockedId) {
    try {
        const result = await db_1.default.query('SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [blockerId, blockedId]);
        return (result.rowCount || 0) > 0;
    }
    catch (error) {
        console.error('Error checking block relationship:', error);
        throw error;
    }
}
// User search and discovery functions
async function searchUsers(query, currentUserId, limit = 20, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $3 OFFSET $4`, [`%${query}%`, currentUserId, limit, offset]);
        return result.rows;
    }
    catch (error) {
        console.error('Error searching users:', error);
        throw error;
    }
}
async function getUserRecommendations(userId, limit = 20, offset = 0, contentType) {
    try {
        // Build dynamic WHERE clause for optional content type filter
        const whereParts = [
            'r.user_id = $1',
            "r.visibility IN ('public', 'friends')"
        ];
        const params = [userId];
        if (contentType) {
            whereParts.push('r.content_type = $4');
        }
        // Final params order: $1 userId, $2 limit, $3 offset, optional $4 contentType
        params.push(limit); // $2
        params.push(offset); // $3
        if (contentType) {
            params.push(contentType); // $4
        }
        const result = await db_1.default.query(`SELECT 
        r.id as recommendation_id,
        r.place_id,
        r.title,
        r.description, r.rating, r.visibility, r.created_at, r.labels, r.metadata, r.content_type, r.content_data,
        p.name as place_name, p.address as place_address, p.lat as place_lat, p.lng as place_lng, p.google_place_id,
        u.id as user_id, u.display_name as user_name, u.profile_picture_url as user_picture,
        COUNT(DISTINCT ac.id) as comments_count,
        COUNT(DISTINCT al.id) as likes_count,
        CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
      FROM recommendations r
      LEFT JOIN places p ON r.place_id = p.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN annotation_comments ac ON r.id = ac.recommendation_id
      LEFT JOIN annotation_likes al ON r.id = al.recommendation_id
      LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
      LEFT JOIN saved_places sp ON p.id = sp.place_id AND sp.user_id = $1
      WHERE ${whereParts.join(' AND ')}
      GROUP BY r.id, r.place_id, r.title, r.description, r.rating, r.visibility, r.created_at, r.labels, r.metadata, r.content_type, r.content_data,
               p.name, p.address, p.lat, p.lng, p.google_place_id,
               u.id, u.display_name, u.profile_picture_url, al2.id, sp.id
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3`, params);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting user recommendations:', error);
        throw error;
    }
}
async function getSuggestedUsers(currentUserId, limit = 10) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2`, [currentUserId, limit]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting suggested users:', error);
        throw error;
    }
}
// Feed generation functions
async function getFeedPosts(userId, limit = 20, offset = 0) {
    try {
        const result = await db_1.default.query(`SELECT 
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
      LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting feed posts:', error);
        throw error;
    }
}
