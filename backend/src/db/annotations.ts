import pool from '../db';
import { generateAnnotationEmbedding } from '../utils/embeddings';
import { getPlaceById, getUserById } from './places';

export interface AnnotationData {
  place_id: number;
  user_id: string; // UUID
  went_with?: string[];
  labels?: string[];
  notes?: string;
  metadata?: Record<string, any>;
  visit_date?: string; // ISO date string (YYYY-MM-DD)
  rating?: number; // 1-5
  visibility?: 'friends' | 'public';
  embedding?: number[]; // Vector embedding (1536 dimensions)
  auto_generate_embedding?: boolean; // New flag to auto-generate embedding
}

export interface Annotation {
  id: number;
  place_id: number;
  user_id: string;
  went_with?: string[];
  labels?: string[];
  notes?: string;
  metadata: Record<string, any>;
  visit_date?: string;
  rating?: number;
  visibility: 'friends' | 'public';
  embedding?: number[];
  created_at: Date;
  updated_at: Date;
}

// Interface for search results that includes similarity score
export interface AnnotationSearchResult extends Annotation {
  similarity: number;
}

/**
 * Insert a new annotation with optional vector embedding
 */
export async function insertAnnotation(annotationData: AnnotationData): Promise<number> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Validate rating if provided
    if (annotationData.rating && (annotationData.rating < 1 || annotationData.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    // Validate visibility if provided
    if (annotationData.visibility && !['friends', 'public'].includes(annotationData.visibility)) {
      throw new Error('Visibility must be either "friends" or "public"');
    }
    
    // Auto-generate embedding if requested and not provided
    let embedding = annotationData.embedding;
    if (annotationData.auto_generate_embedding && !embedding) {
      try {
        // Get place and user information for better embedding
        const [place, user] = await Promise.all([
          getPlaceById(annotationData.place_id),
          getUserById(annotationData.user_id)
        ]);
        
        // Create enhanced annotation data with place and user info
        const enhancedAnnotationData = {
          ...annotationData,
          place_name: place?.name,
          place_address: place?.address,
          user_name: user?.display_name
        };
        
        embedding = await generateAnnotationEmbedding(enhancedAnnotationData);
        console.log('Auto-generated embedding for annotation with place and user info');
      } catch (error) {
        console.warn('Failed to auto-generate embedding:', error);
        // Continue without embedding rather than failing the entire operation
      }
    }
    
    // Prepare the insert query
    const insertQuery = `
      INSERT INTO annotations (
        place_id, user_id, went_with, labels, notes, metadata, 
        visit_date, rating, visibility, embedding
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    
    const insertResult = await client.query(insertQuery, [
      annotationData.place_id,
      annotationData.user_id,
      annotationData.went_with || null,
      annotationData.labels || null,
      annotationData.notes || null,
      JSON.stringify(annotationData.metadata || {}),
      annotationData.visit_date || null,
      annotationData.rating || null,
      annotationData.visibility || 'friends',
      embedding ? `[${embedding.join(',')}]` : null
    ]);
    
    const annotationId = insertResult.rows[0].id;
    
    await client.query('COMMIT');
    return annotationId;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get annotation by ID
 */
export async function getAnnotationById(id: number): Promise<Annotation | null> {
  const result = await pool.query(
    'SELECT * FROM annotations WHERE id = $1',
    [id]
  );
  
  return result.rows[0] || null;
}

/**
 * Get annotations for a specific place
 */
export async function getAnnotationsByPlaceId(
  placeId: number, 
  visibility: 'friends' | 'public' | 'all' = 'all',
  limit: number = 50
): Promise<Annotation[]> {
  let query = 'SELECT * FROM annotations WHERE place_id = $1';
  const params: any[] = [placeId];
  
  if (visibility !== 'all') {
    query += ' AND visibility = $2';
    params.push(visibility);
  }
  
  const limitParam = params.length + 1;
  query += ` ORDER BY created_at DESC LIMIT $${limitParam}`;
  params.push(limit);
  
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get annotations by user ID
 */
export async function getAnnotationsByUserId(
  userId: string,
  limit: number = 50
): Promise<Annotation[]> {
  const result = await pool.query(
    'SELECT * FROM annotations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  
  return result.rows;
}

/**
 * Update annotation
 */
export async function updateAnnotation(
  id: number, 
  updates: Partial<AnnotationData>
): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    

    if (updates.went_with !== undefined) {
      updateFields.push(`went_with = $${paramCount++}`);
      values.push(updates.went_with);
    }
    if (updates.labels !== undefined) {
      updateFields.push(`labels = $${paramCount++}`);
      values.push(updates.labels);
    }
    if (updates.notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      values.push(updates.notes);
    }
    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.visit_date !== undefined) {
      updateFields.push(`visit_date = $${paramCount++}`);
      values.push(updates.visit_date);
    }
    if (updates.rating !== undefined) {
      updateFields.push(`rating = $${paramCount++}`);
      values.push(updates.rating);
    }
    if (updates.visibility !== undefined) {
      updateFields.push(`visibility = $${paramCount++}`);
      values.push(updates.visibility);
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
      UPDATE annotations 
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
 * Delete annotation
 */
export async function deleteAnnotation(id: number, userId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM annotations WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  
  return result.rows.length > 0;
}

/**
 * Search annotations by semantic similarity using vector embeddings
 */
export async function searchAnnotationsBySimilarity(
  embedding: number[],
  limit: number = 10,
  threshold: number = 0.7
): Promise<AnnotationSearchResult[]> {
  const result = await pool.query(
    `SELECT *, 1 - (embedding <=> $1) as similarity
     FROM annotations 
     WHERE embedding IS NOT NULL 
       AND 1 - (embedding <=> $1) > $2
     ORDER BY embedding <=> $1
     LIMIT $3`,
    [`[${embedding.join(',')}]`, threshold, limit]
  );
  
  return result.rows;
} 

/**
 * Regenerate embedding for an existing annotation with place and user information
 */
export async function regenerateAnnotationEmbedding(annotationId: number): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get the annotation
    const annotationResult = await client.query(
      'SELECT * FROM annotations WHERE id = $1',
      [annotationId]
    );
    
    if (annotationResult.rows.length === 0) {
      throw new Error('Annotation not found');
    }
    
    const annotation = annotationResult.rows[0];
    
    // Get place and user information
    const [place, user] = await Promise.all([
      getPlaceById(annotation.place_id),
      getUserById(annotation.user_id)
    ]);
    
    // Create enhanced annotation data with place and user info
    const enhancedAnnotationData = {
      ...annotation,
      place_name: place?.name,
      place_address: place?.address,
      user_name: user?.display_name
    };
    
    // Generate new embedding
    const newEmbedding = await generateAnnotationEmbedding(enhancedAnnotationData);
    
    // Update the annotation with the new embedding
    await client.query(
      'UPDATE annotations SET embedding = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [`[${newEmbedding.join(',')}]`, annotationId]
    );
    
    await client.query('COMMIT');
    console.log(`Regenerated embedding for annotation ${annotationId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to regenerate embedding for annotation ${annotationId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Regenerate embeddings for all annotations (useful for migration)
 */
export async function regenerateAllEmbeddings(): Promise<{ success: number; failed: number }> {
  const client = await pool.connect();
  
  try {
    // Get all annotation IDs
    const result = await client.query('SELECT id FROM annotations');
    const annotationIds = result.rows.map(row => row.id);
    
    let success = 0;
    let failed = 0;
    
    console.log(`Starting to regenerate embeddings for ${annotationIds.length} annotations...`);
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < annotationIds.length; i += batchSize) {
      const batch = annotationIds.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (id) => {
          try {
            await regenerateAnnotationEmbedding(id);
            success++;
          } catch (error) {
            console.error(`Failed to regenerate embedding for annotation ${id}:`, error);
            failed++;
          }
        })
      );
      
      // Log progress
      if ((i + batchSize) % 50 === 0 || i + batchSize >= annotationIds.length) {
        console.log(`Progress: ${Math.min(i + batchSize, annotationIds.length)}/${annotationIds.length} annotations processed`);
      }
    }
    
    console.log(`Embedding regeneration complete. Success: ${success}, Failed: ${failed}`);
    return { success, failed };
    
  } catch (error) {
    console.error('Error during bulk embedding regeneration:', error);
    throw error;
  } finally {
    client.release();
  }
} 