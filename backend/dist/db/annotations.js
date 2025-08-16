"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertAnnotation = insertAnnotation;
exports.getAnnotationById = getAnnotationById;
exports.getAnnotationsByPlaceId = getAnnotationsByPlaceId;
exports.getAnnotationsByUserId = getAnnotationsByUserId;
exports.updateAnnotation = updateAnnotation;
exports.deleteAnnotation = deleteAnnotation;
exports.searchAnnotationsBySimilarity = searchAnnotationsBySimilarity;
const db_1 = __importDefault(require("../db"));
const embeddings_1 = require("../utils/embeddings");
/**
 * Insert a new annotation with optional vector embedding
 */
async function insertAnnotation(annotationData) {
    const client = await db_1.default.connect();
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
                embedding = await (0, embeddings_1.generateAnnotationEmbedding)(annotationData);
                console.log('Auto-generated embedding for annotation');
            }
            catch (error) {
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
 * Get annotation by ID
 */
async function getAnnotationById(id) {
    const result = await db_1.default.query('SELECT * FROM annotations WHERE id = $1', [id]);
    return result.rows[0] || null;
}
/**
 * Get annotations for a specific place
 */
async function getAnnotationsByPlaceId(placeId, visibility = 'all', limit = 50) {
    let query = 'SELECT * FROM annotations WHERE place_id = $1';
    const params = [placeId];
    if (visibility !== 'all') {
        query += ' AND visibility = $2';
        params.push(visibility);
    }
    const limitParam = params.length + 1;
    query += ` ORDER BY created_at DESC LIMIT $${limitParam}`;
    params.push(limit);
    const result = await db_1.default.query(query, params);
    return result.rows;
}
/**
 * Get annotations by user ID
 */
async function getAnnotationsByUserId(userId, limit = 50) {
    const result = await db_1.default.query('SELECT * FROM annotations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
    return result.rows;
}
/**
 * Update annotation
 */
async function updateAnnotation(id, updates) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Build dynamic update query
        const updateFields = [];
        const values = [];
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
 * Delete annotation
 */
async function deleteAnnotation(id, userId) {
    const result = await db_1.default.query('DELETE FROM annotations WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    return result.rows.length > 0;
}
/**
 * Search annotations by semantic similarity using vector embeddings
 */
async function searchAnnotationsBySimilarity(embedding, limit = 10, threshold = 0.7) {
    const result = await db_1.default.query(`SELECT *, 1 - (embedding <=> $1) as similarity
     FROM annotations 
     WHERE embedding IS NOT NULL 
       AND 1 - (embedding <=> $1) > $2
     ORDER BY embedding <=> $1
     LIMIT $3`, [`[${embedding.join(',')}]`, threshold, limit]);
    return result.rows;
}
