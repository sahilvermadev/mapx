import pool from '../db';
import { embeddingQueue } from '../services/embeddingQueue';
import { onRecommendationCreated } from './questionCounters';
import { createQuestionAnswerNotification } from './notifications';
import { COMMON_FEED_COLUMNS, COMMON_FEED_JOINS, USER_FOLLOWS_WHERE_CLAUSE, VISIBILITY_WHERE_CLAUSE, BLOCK_FILTER_WHERE_CLAUSE, ORDER_BY_CLAUSE } from './sqlFragments';
import type { FeedPostRow } from '../types/feed';
import { handleError, createErrorHandler } from '../utils/errorHandling';

export interface RecommendationData {
  user_id: string; // UUID
  content_type: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  place_id?: number; // Optional, only for place-type recommendations
  service_id?: number; // Optional, only for service-type recommendations
  title?: string;
  description: string;
  content_data?: Record<string, any>; // JSONB for type-specific data
  rating?: number; // 1-5
  visibility?: 'friends' | 'public';
  labels?: string[];
  metadata?: Record<string, any>;
  embedding?: number[]; // Vector embedding (1536 dimensions)
  auto_generate_embedding?: boolean; // Flag to auto-generate embedding
  question_id?: number; // Optional, links to questions table for answers
}

export interface Recommendation {
  id: number;
  user_id: string;
  content_type: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  place_id?: number;
  title?: string;
  description: string;
  content_data: Record<string, any>;
  rating?: number;
  visibility: 'friends' | 'public';
  labels?: string[];
  metadata: Record<string, any>;
  embedding?: number[];
  created_at: Date;
  updated_at: Date;
}

// Interface for search results that includes similarity score
export interface RecommendationSearchResult extends Recommendation {
  similarity: number;
}

/**
 * Insert a new recommendation with optional vector embedding
 */
export async function insertRecommendation(recommendationData: RecommendationData): Promise<number> {
  const client = await pool.connect();
  
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
        await onRecommendationCreated(recommendationId, recommendationData.question_id);
        
        // Create notification for question author
        await createQuestionAnswerNotification(
          recommendationData.question_id,
          recommendationData.user_id,
          recommendationId
        );
      } catch (error) {
        console.warn(`Failed to update question counters or create notification for question ${recommendationData.question_id}:`, error);
        // Don't fail the operation if these fail
      }
    }
    
    // Queue embedding generation if needed (after successful commit)
    if (shouldQueueEmbedding) {
      try {
        await embeddingQueue.enqueue('recommendation', recommendationId, recommendationData, 'normal');
        console.log(`Queued embedding generation for recommendation ${recommendationId}`);
      } catch (error) {
        console.warn(`Failed to queue embedding generation for recommendation ${recommendationId}:`, error);
        // Don't fail the operation if queuing fails
      }
    }
    
    return recommendationId;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get recommendation by ID
 */
export async function getRecommendationById(id: number): Promise<Recommendation | null> {
  const result = await pool.query(
    'SELECT * FROM recommendations WHERE id = $1',
    [id]
  );
  
  return result.rows[0] || null;
}

/**
 * Get a single recommendation with all social data (likes, comments, user info)
 * Similar to feed post format but for a single recommendation
 */
export async function getRecommendationWithSocialData(
  recommendationId: number,
  currentUserId: string
): Promise<any | null> {
  try {
    const result = await pool.query(
      `SELECT 
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
               u.display_name, u.profile_picture_url, al2.id, sp.id`,
      [recommendationId, currentUserId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting recommendation with social data:', error);
    throw error;
  }
}

/**
 * Get recommendations for a specific place
 */
export async function getRecommendationsByPlaceId(
  placeId: number, 
  visibility: 'friends' | 'public' | 'all' = 'all',
  limit: number = 50,
  currentUserId?: string
): Promise<Recommendation[]> {
  
  
  let query = 'SELECT * FROM recommendations WHERE place_id = $1';
  const params: any[] = [placeId];
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
  } else if (visibility !== 'all') {
    paramCount++;
    query += ` AND visibility = $${paramCount}`;
    params.push(visibility);
  }
  
  const limitParam = paramCount + 1;
  query += ` ORDER BY created_at DESC LIMIT $${limitParam}`;
  params.push(limit);
  
  const result = await pool.query(query, params);
  
  return result.rows;
}

/**
 * Get consolidated rating for a place computed only from the current user's network
 * Network is defined as: the current user themself plus users they follow
 */
export async function getNetworkAverageRatingForPlace(
  placeId: number,
  userId: string
): Promise<{ average_rating: number | null; rating_count: number }>
{
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
  const result = await pool.query(query, [placeId, userId]);
  const row = result.rows[0] || { average_rating: null, rating_count: 0 };
  return { average_rating: row.average_rating, rating_count: Number(row.rating_count || 0) };
}

/**
 * Get recommendations by user ID
 */
export async function getRecommendationsByUserId(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Recommendation[]> {
  const result = await pool.query(
    'SELECT * FROM recommendations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );
  
  return result.rows;
}

/**
 * Get recommendations by content type
 */
export async function getRecommendationsByContentType(
  contentType: 'place' | 'service' | 'tip' | 'contact' | 'unclear',
  visibility: 'friends' | 'public' | 'all' = 'all',
  limit: number = 50,
  offset: number = 0
): Promise<Recommendation[]> {
  let query = 'SELECT * FROM recommendations WHERE content_type = $1';
  const params: any[] = [contentType];
  
  if (visibility !== 'all') {
    query += ' AND visibility = $2';
    params.push(visibility);
    query += ' ORDER BY created_at DESC LIMIT $3 OFFSET $4';
    params.push(limit, offset);
  } else {
    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);
  }
  
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Update recommendation
 */
export async function updateRecommendation(
  id: number, 
  updates: Partial<RecommendationData>
): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
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
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete recommendation
 */
export async function deleteRecommendation(id: number, userId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM recommendations WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  
  return result.rows.length > 0;
}

/**
 * Search recommendations by semantic similarity using vector embeddings
 */
export async function searchRecommendationsBySimilarity(
  embedding: number[],
  limit: number = 10,
  threshold: number = 0.7,
  groupIds?: number[],
  currentUserId?: string,
  content_type?: string
): Promise<RecommendationSearchResult[]> {
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
  
  const params: any[] = [`[${embedding.join(',')}]`, threshold];
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
  
  const result = await pool.query(query, params);
  
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
export async function getFeedPostsFromRecommendations(
  userId: string,
  limit: number = 20,
  cursorCreatedAt?: string,
  cursorId?: number,
  categoryFilter?: string,
  citySlug?: string,
  countryCode?: string
): Promise<FeedPostRow[]> {
  try {
    const params: any[] = [userId];
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
      categoryClause = ` AND ( (r.content_data->>'category') = $${catIdx}
        OR LOWER(COALESCE(p.name,'')) LIKE $${likeIdx}
        OR r.content_type = LOWER($${catIdx})
        OR LOWER(COALESCE(p.primary_type, '')) = LOWER($${catIdx})
      )`;
    }

    let cityClause = '';
    if (citySlug) {
      paramIdx += 1;
      params.push(citySlug);
      cityClause += ` AND (p.city_slug = $${paramIdx} OR s.city_slug = $${paramIdx})`;
    }
    if (countryCode) {
      paramIdx += 1;
      params.push(countryCode);
      cityClause += ` AND (p.country_code = $${paramIdx} OR s.country_code = $${paramIdx})`;
    }

    // fetch limit + 1 to determine hasNext in route layer
    params.push(limit + 1);

    const query = `SELECT 
        ${COMMON_FEED_COLUMNS}
      ${COMMON_FEED_JOINS}
      ${USER_FOLLOWS_WHERE_CLAUSE}
      ${VISIBILITY_WHERE_CLAUSE}
      ${BLOCK_FILTER_WHERE_CLAUSE}${cursorClause}${categoryClause}${cityClause}
      ${ORDER_BY_CLAUSE}
      LIMIT $${paramIdx + 1}`;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    const appError = handleError(error, {
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
export async function getFeedPostsFromGroups(
  userId: string,
  groupIds: number[],
  limit: number = 20,
  cursorCreatedAt?: string,
  cursorId?: number,
  categoryFilter?: string
): Promise<FeedPostRow[]> {
  if (groupIds.length === 0) {
    return getFeedPostsFromRecommendations(userId, limit, cursorCreatedAt, cursorId, categoryFilter);
  }

  try {
    const params: any[] = [userId, groupIds];
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

    const result = await pool.query(
      `SELECT 
        ${COMMON_FEED_COLUMNS}
      ${COMMON_FEED_JOINS}
      ${groupWhereClause}
      ${VISIBILITY_WHERE_CLAUSE}
      ${BLOCK_FILTER_WHERE_CLAUSE}${cursorClause}${categoryClause}
      ${ORDER_BY_CLAUSE}
      LIMIT $${paramIdx + 1}`,
      params
    );
    return result.rows;
  } catch (error) {
    const appError = handleError(error, {
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
export async function getUnifiedFeedPosts(
  userId: string,
  limit: number = 20,
  cursorCreatedAt?: string,
  cursorId?: number,
  includeQna: boolean = false,
  citySlug?: string,
  countryCode?: string
): Promise<any[]> {
  if (process.env.DEBUG_FEED === '1') {
    console.log('[unifiedFeed] args:', { userId, limit, cursorCreatedAt, cursorId, includeQna, citySlug, countryCode });
  }
  const params: any[] = [userId];
  let cursorClause = '';
  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    cursorClause = ` AND (created_at, id) < ($2::timestamptz, $3::int)`;
  }
  // city filters will be applied at outer layer using projected columns

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
      s.city_slug as service_city_slug,
      s.country_code as service_country_code,
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
    LEFT JOIN services s ON r.service_id = s.id
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
      NULL::text as service_city_slug,
      NULL::text as service_country_code,
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
      s.city_slug as service_city_slug,
      s.country_code as service_country_code,
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
    LEFT JOIN services s ON r.service_id = s.id
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

  // Outer city filters on projected columns
  let cityWhere = '';
  if (citySlug) {
    params.push(citySlug);
    cityWhere += ` AND (place_city_slug = $${params.length} OR service_city_slug = $${params.length})`;
  }
  if (countryCode) {
    params.push(countryCode);
    cityWhere += ` AND (place_country_code = $${params.length} OR service_country_code = $${params.length})`;
  }

  // limit param must be last
  params.push(limit + 1);

  const sql = `
    SELECT * FROM (
      ${unionSql}
    ) unified
    WHERE 1=1
    ${cursorClause}
    ${cityWhere}
    ORDER BY created_at DESC
    LIMIT $${params.length}
  `;

  if (process.env.DEBUG_FEED === '1') {
    console.log('[unifiedFeed] SQL (trimmed):', sql.replace(/\s+/g, ' ').slice(0, 400) + '...');
    console.log('[unifiedFeed] params:', params);
  }
  const result = await pool.query(sql, params);
  if (process.env.DEBUG_FEED === '1') {
    const rows = result.rows || [];
    const counts = {
      total: rows.length,
      placeInCity: rows.filter(r => r.place_city_slug && r.place_city_slug === citySlug).length,
      serviceInCity: rows.filter(r => r.service_city_slug && r.service_city_slug === citySlug).length,
      serviceOutOfCity: rows.filter(r => r.service_city_slug && citySlug && r.service_city_slug !== citySlug).length,
    };
    console.log('[unifiedFeed] result counts:', counts);
  }
  return result.rows;
}


/**
 * Regenerate embeddings for all recommendations (useful for migration)
 * Now uses async queue for better performance
 */
export async function regenerateAllRecommendationEmbeddings(): Promise<{ success: number; failed: number }> {
  const client = await pool.connect();
  
  try {
    // Get all recommendation IDs
    const result = await client.query('SELECT id FROM recommendations');
    const recommendationIds = result.rows.map(row => row.id);
    
    console.log(`Queuing embedding regeneration for ${recommendationIds.length} recommendations...`);
    
    // Queue all recommendations for async processing
    const queuePromises = recommendationIds.map(async (id) => {
      try {
        // Queue with minimal data - the embedding queue will fetch full data
        await embeddingQueue.enqueue('recommendation', id, { id }, 'low');
        return { success: true, id };
      } catch (error) {
        console.error(`Failed to queue embedding regeneration for recommendation ${id}:`, error);
        return { success: false, id, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
    
    const results = await Promise.allSettled(queuePromises);
    
    const success = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failed = results.length - success;
    
    console.log(`Embedding regeneration queued. Success: ${success}, Failed: ${failed}`);
    return { success, failed };
    
  } catch (error) {
    console.error('Error during bulk embedding regeneration:', error);
    throw error;
  } finally {
    client.release();
  }
}

