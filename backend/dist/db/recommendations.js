"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertRecommendation = insertRecommendation;
exports.getRecommendationById = getRecommendationById;
exports.getRecommendationWithSocialData = getRecommendationWithSocialData;
exports.getRecommendationsByPlaceId = getRecommendationsByPlaceId;
exports.getNetworkAverageRatingForPlace = getNetworkAverageRatingForPlace;
exports.getRecommendationsByUserId = getRecommendationsByUserId;
exports.getRecommendationsByContentType = getRecommendationsByContentType;
exports.updateRecommendation = updateRecommendation;
exports.deleteRecommendation = deleteRecommendation;
exports.searchRecommendationsBySimilarity = searchRecommendationsBySimilarity;
exports.getFeedPostsFromRecommendations = getFeedPostsFromRecommendations;
exports.getFeedPostsFromGroups = getFeedPostsFromGroups;
exports.getUnifiedFeedPosts = getUnifiedFeedPosts;
exports.regenerateAllRecommendationEmbeddings = regenerateAllRecommendationEmbeddings;
const db_1 = __importDefault(require("../db"));
const embeddingQueue_1 = require("../services/embeddingQueue");
const questionCounters_1 = require("./questionCounters");
const notifications_1 = require("./notifications");
const sqlFragments_1 = require("./sqlFragments");
const errorHandling_1 = require("../utils/errorHandling");
/**
 * Insert a new recommendation with optional vector embedding
 */
async function insertRecommendation(recommendationData) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Validate rating if provided
        if (recommendationData.rating && (recommendationData.rating < 1 || recommendationData.rating > 5)) {
            throw new Error('Rating must be between 1 and 5');
        }
        // Validate visibility if provided
        if (recommendationData.visibility && !['friends', 'public'].includes(recommendationData.visibility)) {
            throw new Error('Visibility must be either "friends" or "public"');
        }
        // Validate content type
        if (!['place', 'service', 'tip', 'contact', 'unclear'].includes(recommendationData.content_type)) {
            throw new Error('Content type must be one of: place, service, tip, contact, unclear');
        }
        // Auto-generate embedding if requested and not provided
        let embedding = recommendationData.embedding;
        let shouldQueueEmbedding = false;
        if (recommendationData.auto_generate_embedding && !embedding) {
            // Queue embedding generation for async processing
            shouldQueueEmbedding = true;
            console.log('Queued embedding generation for async processing');
        }
        // Prepare the insert query
        const insertQuery = `
      INSERT INTO recommendations (
        user_id, content_type, place_id, service_id, title, description, content_data,
        rating, visibility, labels, metadata, embedding, question_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;
        // Format labels as PostgreSQL array
        const labelsArray = recommendationData.labels && Array.isArray(recommendationData.labels)
            ? recommendationData.labels
            : null;
        const insertResult = await client.query(insertQuery, [
            recommendationData.user_id,
            recommendationData.content_type,
            recommendationData.place_id || null,
            recommendationData.service_id || null,
            recommendationData.title || null,
            recommendationData.description,
            JSON.stringify(recommendationData.content_data || {}),
            recommendationData.rating || null,
            recommendationData.visibility || 'friends',
            labelsArray,
            JSON.stringify(recommendationData.metadata || {}),
            embedding ? `[${embedding.join(',')}]` : null,
            recommendationData.question_id || null
        ]);
        const recommendationId = insertResult.rows[0].id;
        await client.query('COMMIT');
        // Update question counters if this is an answer to a question
        if (recommendationData.question_id) {
            try {
                await (0, questionCounters_1.onRecommendationCreated)(recommendationId, recommendationData.question_id);
                // Create notification for question author
                await (0, notifications_1.createQuestionAnswerNotification)(recommendationData.question_id, recommendationData.user_id, recommendationId);
            }
            catch (error) {
                console.warn(`Failed to update question counters or create notification for question ${recommendationData.question_id}:`, error);
                // Don't fail the operation if these fail
            }
        }
        // Queue embedding generation if needed (after successful commit)
        if (shouldQueueEmbedding) {
            try {
                await embeddingQueue_1.embeddingQueue.enqueue('recommendation', recommendationId, recommendationData, 'normal');
                console.log(`Queued embedding generation for recommendation ${recommendationId}`);
            }
            catch (error) {
                console.warn(`Failed to queue embedding generation for recommendation ${recommendationId}:`, error);
                // Don't fail the operation if queuing fails
            }
        }
        return recommendationId;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Get recommendation by ID
 */
async function getRecommendationById(id) {
    const result = await db_1.default.query('SELECT * FROM recommendations WHERE id = $1', [id]);
    return result.rows[0] || null;
}
/**
 * Get a single recommendation with all social data (likes, comments, user info)
 * Similar to feed post format but for a single recommendation
 */
async function getRecommendationWithSocialData(recommendationId, currentUserId) {
    try {
        const result = await db_1.default.query(`SELECT 
        r.id as recommendation_id,
        r.user_id,
        r.content_type,
        r.title,
        r.description,
        r.content_data,
        r.rating,
        r.visibility,
        r.labels,
        r.metadata,
        r.created_at,
        r.updated_at,
        p.id as place_id,
        p.name as place_name, 
        p.address as place_address, 
        p.lat as place_lat, 
        p.lng as place_lng, 
        p.google_place_id,
        u.display_name as user_name, 
        u.profile_picture_url as user_picture,
        COUNT(DISTINCT ac.id) as comments_count,
        COUNT(DISTINCT al.id) as likes_count,
        CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
      FROM recommendations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN places p ON r.place_id = p.id
      LEFT JOIN annotation_comments ac ON r.id = ac.recommendation_id
      LEFT JOIN annotation_likes al ON r.id = al.recommendation_id
      LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $2
      LEFT JOIN saved_places sp ON r.id = sp.recommendation_id AND sp.user_id = $2
      WHERE r.id = $1
      GROUP BY r.id, r.user_id, r.content_type, r.title, r.description, r.content_data,
               r.rating, r.visibility, r.labels, r.metadata, r.created_at, r.updated_at,
               p.id, p.name, p.address, p.lat, p.lng, p.google_place_id,
               u.display_name, u.profile_picture_url, al2.id, sp.id`, [recommendationId, currentUserId]);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('Error getting recommendation with social data:', error);
        throw error;
    }
}
/**
 * Get recommendations for a specific place
 */
async function getRecommendationsByPlaceId(placeId, visibility = 'all', limit = 50, currentUserId) {
    let query = 'SELECT * FROM recommendations WHERE place_id = $1';
    const params = [placeId];
    let paramCount = 1;
    // Add friends filtering - only show recommendations from users the current user follows
    if (visibility === 'friends' && currentUserId) {
        paramCount++;
        query += ` AND (
      (
        user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $${paramCount})
        AND visibility = 'friends'  -- Recommendations from friends must be 'friends' visibility
      )
      OR user_id = $${paramCount}  -- User's own recommendations can be any visibility
    )`;
        params.push(currentUserId);
    }
    else if (visibility !== 'all') {
        paramCount++;
        query += ` AND visibility = $${paramCount}`;
        params.push(visibility);
    }
    const limitParam = paramCount + 1;
    query += ` ORDER BY created_at DESC LIMIT $${limitParam}`;
    params.push(limit);
    const result = await db_1.default.query(query, params);
    return result.rows;
}
/**
 * Get consolidated rating for a place computed only from the current user's network
 * Network is defined as: the current user themself plus users they follow
 */
async function getNetworkAverageRatingForPlace(placeId, userId) {
    const query = `
    SELECT AVG(r.rating)::float AS average_rating, COUNT(r.rating) AS rating_count
    FROM recommendations r
    WHERE r.place_id = $1
      AND r.rating IS NOT NULL
      AND r.visibility IN ('public','friends')
      AND r.user_id IN (
        SELECT following_id FROM user_follows WHERE follower_id = $2
        UNION SELECT $2
      )
  `;
    const result = await db_1.default.query(query, [placeId, userId]);
    const row = result.rows[0] || { average_rating: null, rating_count: 0 };
    return { average_rating: row.average_rating, rating_count: Number(row.rating_count || 0) };
}
/**
 * Get recommendations by user ID
 */
async function getRecommendationsByUserId(userId, limit = 50, offset = 0) {
    const result = await db_1.default.query('SELECT * FROM recommendations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [userId, limit, offset]);
    return result.rows;
}
/**
 * Get recommendations by content type
 */
async function getRecommendationsByContentType(contentType, visibility = 'all', limit = 50, offset = 0) {
    let query = 'SELECT * FROM recommendations WHERE content_type = $1';
    const params = [contentType];
    if (visibility !== 'all') {
        query += ' AND visibility = $2';
        params.push(visibility);
        query += ' ORDER BY created_at DESC LIMIT $3 OFFSET $4';
        params.push(limit, offset);
    }
    else {
        query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
        params.push(limit, offset);
    }
    const result = await db_1.default.query(query, params);
    return result.rows;
}
/**
 * Update recommendation
 */
async function updateRecommendation(id, updates) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Build dynamic update query
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        if (updates.content_type !== undefined) {
            updateFields.push(`content_type = $${paramCount++}`);
            values.push(updates.content_type);
        }
        if (updates.place_id !== undefined) {
            updateFields.push(`place_id = $${paramCount++}`);
            values.push(updates.place_id);
        }
        if (updates.title !== undefined) {
            updateFields.push(`title = $${paramCount++}`);
            values.push(updates.title);
        }
        if (updates.description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            values.push(updates.description);
        }
        if (updates.content_data !== undefined) {
            updateFields.push(`content_data = $${paramCount++}`);
            values.push(JSON.stringify(updates.content_data));
        }
        if (updates.rating !== undefined) {
            updateFields.push(`rating = $${paramCount++}`);
            values.push(updates.rating);
        }
        if (updates.visibility !== undefined) {
            updateFields.push(`visibility = $${paramCount++}`);
            values.push(updates.visibility);
        }
        if (updates.labels !== undefined) {
            updateFields.push(`labels = $${paramCount++}`);
            values.push(updates.labels);
        }
        if (updates.metadata !== undefined) {
            updateFields.push(`metadata = $${paramCount++}`);
            values.push(JSON.stringify(updates.metadata));
        }
        if (updates.embedding !== undefined) {
            updateFields.push(`embedding = $${paramCount++}`);
            values.push(updates.embedding ? `[${updates.embedding.join(',')}]` : null);
        }
        // Always update the updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        if (updateFields.length === 0) {
            return false; // No updates to make
        }
        values.push(id);
        const updateQuery = `
      UPDATE recommendations 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id
    `;
        const result = await client.query(updateQuery, values);
        await client.query('COMMIT');
        return result.rows.length > 0;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Delete recommendation
 */
async function deleteRecommendation(id, userId) {
    const result = await db_1.default.query('DELETE FROM recommendations WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    return result.rows.length > 0;
}
/**
 * Search recommendations by semantic similarity using vector embeddings
 */
async function searchRecommendationsBySimilarity(embedding, limit = 10, threshold = 0.7, groupIds, currentUserId, content_type) {
    console.log('🔍 [DB] Starting similarity search with params:', {
        embeddingLength: embedding.length,
        limit,
        threshold,
        groupIds,
        currentUserId,
        content_type
    });
    let query = `
    SELECT *, 1 - (embedding <=> $1) as similarity
    FROM recommendations 
    WHERE embedding IS NOT NULL 
      AND 1 - (embedding <=> $1) > $2
  `;
    const params = [`[${embedding.join(',')}]`, threshold];
    let paramCount = 2;
    // Add content type filtering if specified
    if (content_type) {
        paramCount++;
        query += ` AND content_type = $${paramCount}`;
        params.push(content_type);
    }
    // Add follow filtering if currentUserId is provided
    if (currentUserId) {
        paramCount++;
        query += ` AND user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = $${paramCount}
    )`;
        params.push(currentUserId);
    }
    // Add group filtering if groupIds are provided
    if (groupIds && groupIds.length > 0) {
        paramCount++;
        query += ` AND user_id IN (
      SELECT DISTINCT fgm.user_id 
      FROM friend_group_members fgm 
      WHERE fgm.group_id = ANY($${paramCount})
    )`;
        params.push(groupIds);
    }
    query += `
    ORDER BY embedding <=> $1
    LIMIT $${paramCount + 1}
  `;
    params.push(limit);
    console.log('🔍 [DB] Final query:', query);
    console.log('🔍 [DB] Query params:', params);
    const result = await db_1.default.query(query, params);
    console.log(`📊 [DB] Query returned ${result.rows.length} rows`);
    if (result.rows.length > 0) {
        console.log('📊 [DB] Sample result:', {
            id: result.rows[0].id,
            similarity: result.rows[0].similarity,
            match_percentage: Math.round(result.rows[0].similarity * 100),
            content_type: result.rows[0].content_type,
            title: result.rows[0].title?.substring(0, 50) + '...'
        });
    }
    return result.rows;
}
/**
 * Get feed posts from followed users using recommendations table
 */
async function getFeedPostsFromRecommendations(userId, limit = 20, cursorCreatedAt, cursorId, categoryFilter, citySlug, countryCode) {
    try {
        const params = [userId];
        let paramIdx = 1;
        let cursorClause = '';
        if (cursorCreatedAt && cursorId) {
            paramIdx += 2;
            params.push(cursorCreatedAt, cursorId);
            cursorClause = ` AND (r.created_at, r.id) < ($${paramIdx - 1}::timestamptz, $${paramIdx}::int)`;
        }
        let categoryClause = '';
        if (categoryFilter) {
            paramIdx += 1;
            params.push(categoryFilter);
            const catIdx = paramIdx;
            paramIdx += 1;
            params.push(`%${categoryFilter.toLowerCase()}%`);
            const likeIdx = paramIdx;
            categoryClause = ` AND ( (r.content_data->>'category') = $${catIdx} OR LOWER(COALESCE(p.name,'')) LIKE $${likeIdx} OR r.content_type = LOWER($${catIdx}) )`;
        }
        let cityClause = '';
        if (citySlug) {
            paramIdx += 1;
            params.push(citySlug);
            cityClause += ` AND p.city_slug = $${paramIdx}`;
        }
        if (countryCode) {
            paramIdx += 1;
            params.push(countryCode);
            cityClause += ` AND p.country_code = $${paramIdx}`;
        }
        // fetch limit + 1 to determine hasNext in route layer
        params.push(limit + 1);
        const query = `SELECT 
        ${sqlFragments_1.COMMON_FEED_COLUMNS}
      ${sqlFragments_1.COMMON_FEED_JOINS}
      ${sqlFragments_1.USER_FOLLOWS_WHERE_CLAUSE}
      ${sqlFragments_1.VISIBILITY_WHERE_CLAUSE}
      ${sqlFragments_1.BLOCK_FILTER_WHERE_CLAUSE}${cursorClause}${categoryClause}${cityClause}
      ${sqlFragments_1.ORDER_BY_CLAUSE}
      LIMIT $${paramIdx + 1}`;
        const result = await db_1.default.query(query, params);
        return result.rows;
    }
    catch (error) {
        const appError = (0, errorHandling_1.handleError)(error, {
            context: 'getFeedPostsFromRecommendations',
            logError: true,
            includeStack: true
        });
        throw appError;
    }
}
/**
 * Get feed posts filtered by friend groups
 */
async function getFeedPostsFromGroups(userId, groupIds, limit = 20, cursorCreatedAt, cursorId, categoryFilter) {
    if (groupIds.length === 0) {
        return getFeedPostsFromRecommendations(userId, limit, cursorCreatedAt, cursorId, categoryFilter);
    }
    try {
        const params = [userId, groupIds];
        let paramIdx = 2;
        let cursorClause = '';
        if (cursorCreatedAt && cursorId) {
            paramIdx += 2;
            params.push(cursorCreatedAt, cursorId);
            cursorClause = ` AND (r.created_at, r.id) < ($${paramIdx - 1}::timestamptz, $${paramIdx}::int)`;
        }
        let categoryClause = '';
        if (categoryFilter) {
            paramIdx += 1;
            params.push(categoryFilter);
            const catIdx = paramIdx;
            paramIdx += 1;
            params.push(`%${categoryFilter.toLowerCase()}%`);
            const likeIdx = paramIdx;
            categoryClause = ` AND ( (r.content_data->>'category') = $${catIdx} OR LOWER(COALESCE(p.name,'')) LIKE $${likeIdx} OR r.content_type = LOWER($${catIdx}) )`;
        }
        // fetch limit + 1 to determine hasNext in route layer
        params.push(limit + 1);
        const groupWhereClause = `
      WHERE r.user_id IN (
        SELECT DISTINCT fgm.user_id 
        FROM friend_group_members fgm 
        WHERE fgm.group_id = ANY($2)
        AND fgm.user_id IN (
          SELECT following_id FROM user_follows WHERE follower_id = $1
          UNION
          SELECT $1  -- Include user's own recommendations
        )
      )
    `;
        const result = await db_1.default.query(`SELECT 
        ${sqlFragments_1.COMMON_FEED_COLUMNS}
      ${sqlFragments_1.COMMON_FEED_JOINS}
      ${groupWhereClause}
      ${sqlFragments_1.VISIBILITY_WHERE_CLAUSE}
      ${sqlFragments_1.BLOCK_FILTER_WHERE_CLAUSE}${cursorClause}${categoryClause}
      ${sqlFragments_1.ORDER_BY_CLAUSE}
      LIMIT $${paramIdx + 1}`, params);
        return result.rows;
    }
    catch (error) {
        const appError = (0, errorHandling_1.handleError)(error, {
            context: 'getFeedPostsFromGroups',
            logError: true,
            includeStack: true
        });
        throw appError;
    }
}
/**
 * Unified feed: recommendations + questions + answers (optional via flag)
 */
async function getUnifiedFeedPosts(userId, limit = 20, cursorCreatedAt, cursorId, includeQna = false) {
    const params = [userId];
    let cursorClause = '';
    if (cursorCreatedAt && cursorId) {
        params.push(cursorCreatedAt, cursorId);
        cursorClause = ` AND (created_at, id) < ($2::timestamptz, $3::int)`;
    }
    params.push(limit + 1);
    // Base recommendations subquery (keeps existing fields for compatibility)
    const recSubquery = `
    SELECT 
      r.id as id,
      'recommendation' as type,
      r.created_at,
      r.id as recommendation_id,
      r.user_id,
      r.content_type,
      r.title,
      r.description,
      r.content_data,
      r.rating,
      r.visibility,
      r.labels,
      r.metadata,
      p.id as place_id,
      p.name as place_name,
      p.address as place_address,
      p.lat as place_lat,
      p.lng as place_lng,
      p.google_place_id,
      p.primary_type as place_primary_type,
      p.city_slug as place_city_slug,
      p.country_code as place_country_code,
      u.display_name as user_name,
      u.profile_picture_url as user_picture,
      NULL::int as answers_count,
      COALESCE(acagg.comments_count, 0) as comments_count,
      COALESCE(alagg.likes_count, 0) as likes_count,
      CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
      CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
    FROM recommendations r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN places p ON r.place_id = p.id
    LEFT JOIN (
      SELECT recommendation_id, COUNT(*) AS comments_count
      FROM annotation_comments
      GROUP BY recommendation_id
    ) acagg ON acagg.recommendation_id = r.id
    LEFT JOIN (
      SELECT recommendation_id, COUNT(*) AS likes_count
      FROM annotation_likes
      GROUP BY recommendation_id
    ) alagg ON alagg.recommendation_id = r.id
    LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
    LEFT JOIN saved_places sp ON r.id = sp.recommendation_id AND sp.user_id = $1
    WHERE r.user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = $1
      UNION
      SELECT $1  -- Include user's own recommendations
    )
    AND r.visibility IN ('public','friends')
    AND r.question_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks 
      WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
         OR (blocker_id = r.user_id AND blocked_id = $1)
    )
  `;
    const questionsSubquery = `
    SELECT 
      q.id as id,
      'question' as type,
      q.created_at,
      NULL::int as recommendation_id,
      q.user_id,
      NULL::text as content_type,
      NULL::text as title,
      q.text as description,
      NULL::jsonb as content_data,
      NULL::smallint as rating,
      q.visibility,
      q.labels,
      q.metadata,
      NULL::int as place_id,
      NULL::text as place_name,
      NULL::text as place_address,
      NULL::double precision as place_lat,
      NULL::double precision as place_lng,
      NULL::text as google_place_id,
      NULL::text as place_primary_type,
      NULL::text as place_city_slug,
      NULL::text as place_country_code,
      u.display_name as user_name,
      u.profile_picture_url as user_picture,
      q.answers_count,
      0 as comments_count,
      0 as likes_count,
      false as is_liked_by_current_user,
      false as is_saved
    FROM questions q
    JOIN users u ON u.id = q.user_id
    WHERE q.user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = $1
      UNION
      SELECT $1  -- Include user's own questions
    )
    AND q.visibility IN ('public','friends')
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks 
      WHERE (blocker_id = $1 AND blocked_id = q.user_id) 
         OR (blocker_id = q.user_id AND blocked_id = $1)
    )
  `;
    const answersSubquery = `
    SELECT 
      r.id as id,
      'answer' as type,
      r.created_at,
      r.id as recommendation_id,
      r.user_id,
      r.content_type,
      r.title,
      r.description,
      r.content_data,
      r.rating,
      r.visibility,
      r.labels,
      r.metadata,
      p.id as place_id,
      p.name as place_name,
      p.address as place_address,
      p.lat as place_lat,
      p.lng as place_lng,
      p.google_place_id,
      p.primary_type as place_primary_type,
      p.city_slug as place_city_slug,
      p.country_code as place_country_code,
      u.display_name as user_name,
      u.profile_picture_url as user_picture,
      NULL::int as answers_count,
      COALESCE(acagg.comments_count, 0) as comments_count,
      COALESCE(alagg.likes_count, 0) as likes_count,
      CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
      CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
    FROM recommendations r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN places p ON r.place_id = p.id
    LEFT JOIN (
      SELECT recommendation_id, COUNT(*) AS comments_count
      FROM annotation_comments
      GROUP BY recommendation_id
    ) acagg ON acagg.recommendation_id = r.id
    LEFT JOIN (
      SELECT recommendation_id, COUNT(*) AS likes_count
      FROM annotation_likes
      GROUP BY recommendation_id
    ) alagg ON alagg.recommendation_id = r.id
    LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
    LEFT JOIN saved_places sp ON r.id = sp.recommendation_id AND sp.user_id = $1
    WHERE r.user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = $1
    )
    AND r.question_id IS NOT NULL
    AND r.visibility IN ('public','friends')
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks 
      WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
         OR (blocker_id = r.user_id AND blocked_id = $1)
    )
  `;
    // Ensure all subqueries have identical column order and types for UNION
    const unionSql = includeQna
        ? `(${recSubquery})
       UNION ALL
       (${questionsSubquery})
       UNION ALL
       (${answersSubquery})`
        : `(${recSubquery})`;
    const sql = `
    SELECT * FROM (
      ${unionSql}
    ) unified
    WHERE 1=1
    ${cursorClause}
    ORDER BY created_at DESC
    LIMIT $${params.length}
  `;
    const result = await db_1.default.query(sql, params);
    return result.rows;
}
/**
 * Regenerate embeddings for all recommendations (useful for migration)
 * Now uses async queue for better performance
 */
async function regenerateAllRecommendationEmbeddings() {
    const client = await db_1.default.connect();
    try {
        // Get all recommendation IDs
        const result = await client.query('SELECT id FROM recommendations');
        const recommendationIds = result.rows.map(row => row.id);
        console.log(`Queuing embedding regeneration for ${recommendationIds.length} recommendations...`);
        // Queue all recommendations for async processing
        const queuePromises = recommendationIds.map(async (id) => {
            try {
                // Queue with minimal data - the embedding queue will fetch full data
                await embeddingQueue_1.embeddingQueue.enqueue('recommendation', id, { id }, 'low');
                return { success: true, id };
            }
            catch (error) {
                console.error(`Failed to queue embedding regeneration for recommendation ${id}:`, error);
                return { success: false, id, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });
        const results = await Promise.allSettled(queuePromises);
        const success = results.filter(result => result.status === 'fulfilled' && result.value.success).length;
        const failed = results.length - success;
        console.log(`Embedding regeneration queued. Success: ${success}, Failed: ${failed}`);
        return { success, failed };
    }
    catch (error) {
        console.error('Error during bulk embedding regeneration:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
