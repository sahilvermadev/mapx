import pool from '../db';
import { embeddingQueue } from '../services/embeddingQueue';

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
        rating, visibility, labels, metadata, embedding
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      embedding ? `[${embedding.join(',')}]` : null
    ]);
    
    const recommendationId = insertResult.rows[0].id;
    
    await client.query('COMMIT');
    
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
  
  if (visibility !== 'all') {
    paramCount++;
    query += ` AND visibility = $${paramCount}`;
    params.push(visibility);
  }
  
  // Add friends filtering - only show recommendations from users the current user follows
  if (visibility === 'friends' && currentUserId) {
    paramCount++;
    query += ` AND user_id IN (
      SELECT following_id FROM user_follows WHERE follower_id = $${paramCount}
    )`;
    params.push(currentUserId);
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
  
  const result = await pool.query(query, params);
  
  return result.rows;
}

/**
 * Get feed posts from followed users using recommendations table
 */
export async function getFeedPostsFromRecommendations(
  userId: string, 
  limit: number = 20, 
  offset: number = 0
): Promise<any[]> {
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
      LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
      LEFT JOIN saved_places sp ON r.id = sp.recommendation_id AND sp.user_id = $1
      WHERE r.user_id IN (
        SELECT following_id FROM user_follows WHERE follower_id = $1
      )
      AND r.visibility IN ('public', 'friends')
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
        OR (blocker_id = r.user_id AND blocked_id = $1)
      )
      GROUP BY r.id, r.user_id, r.content_type, r.title, r.description, r.content_data,
               r.rating, r.visibility, r.labels, r.metadata, r.created_at, r.updated_at,
               p.id, p.name, p.address, p.lat, p.lng, p.google_place_id,
               u.display_name, u.profile_picture_url, al2.id, sp.id
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting feed posts from recommendations:', error);
    throw error;
  }
}

/**
 * Get feed posts filtered by friend groups
 */
export async function getFeedPostsFromGroups(
  userId: string,
  groupIds: number[],
  limit: number = 20,
  offset: number = 0
): Promise<any[]> {
  if (groupIds.length === 0) {
    return getFeedPostsFromRecommendations(userId, limit, offset);
  }

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
      LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
      LEFT JOIN saved_places sp ON r.id = sp.recommendation_id AND sp.user_id = $1
      WHERE r.user_id IN (
        SELECT DISTINCT fgm.user_id 
        FROM friend_group_members fgm 
        WHERE fgm.group_id = ANY($2)
        AND fgm.user_id IN (
          SELECT following_id FROM user_follows WHERE follower_id = $1
        )
      )
      AND r.visibility IN ('public', 'friends')
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
        OR (blocker_id = r.user_id AND blocked_id = $1)
      )
      GROUP BY r.id, r.user_id, r.content_type, r.title, r.description, r.content_data,
               r.rating, r.visibility, r.labels, r.metadata, r.created_at, r.updated_at,
               p.id, p.name, p.address, p.lat, p.lng, p.google_place_id,
               u.display_name, u.profile_picture_url, al2.id, sp.id
      ORDER BY r.created_at DESC
      LIMIT $3 OFFSET $4`,
      [userId, groupIds, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting feed posts from groups:', error);
    throw error;
  }
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

