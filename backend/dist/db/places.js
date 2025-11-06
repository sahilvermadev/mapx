"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateCategory = getOrCreateCategory;
exports.upsertPlace = upsertPlace;
exports.getPlaceById = getPlaceById;
exports.getPlaceByGoogleId = getPlaceByGoogleId;
exports.searchPlacesNearby = searchPlacesNearby;
exports.getUserById = getUserById;
exports.getPlacesWithReviews = getPlacesWithReviews;
const db_1 = __importDefault(require("../db"));
/**
 * Get or create a category by name
 */
async function getOrCreateCategory(categoryName) {
    const client = await db_1.default.connect();
    try {
        // First try to find existing category
        const findResult = await client.query('SELECT id FROM categories WHERE name = $1', [categoryName]);
        if (findResult.rows.length > 0) {
            return findResult.rows[0].id;
        }
        // Create new category if not found
        const insertResult = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [categoryName]);
        return insertResult.rows[0].id;
    }
    finally {
        client.release();
    }
}
/**
 * Upsert a place - creates if it doesn't exist, updates if it does
 * Uses google_place_id as the unique identifier for upserts
 */
async function upsertPlace(placeData) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        let placeId;
        let categoryId = null;
        // Handle category if provided
        if (placeData.category_name) {
            categoryId = await getOrCreateCategory(placeData.category_name);
        }
        else if (placeData.category_id) {
            categoryId = placeData.category_id;
        }
        if (placeData.google_place_id) {
            // Try to find existing place by google_place_id
            const existingResult = await client.query('SELECT id FROM places WHERE google_place_id = $1', [placeData.google_place_id]);
            if (existingResult.rows.length > 0) {
                // Update existing place
                placeId = existingResult.rows[0].id;
                const updateResult = await client.query(`UPDATE places 
           SET name = $1, address = $2, category_id = $3, lat = $4, lng = $5, 
               metadata = $6,
               city_name = COALESCE($7, city_name),
               city_slug = COALESCE($8, city_slug),
               admin1_name = COALESCE($9, admin1_name),
               country_code = COALESCE($10, country_code),
               primary_type = COALESCE($11, primary_type),
               types = COALESCE($12, types),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $13
           RETURNING id`, [
                    placeData.name,
                    placeData.address,
                    categoryId,
                    placeData.lat,
                    placeData.lng,
                    JSON.stringify(placeData.metadata || {}),
                    placeData.city_name,
                    placeData.city_slug,
                    placeData.admin1_name,
                    placeData.country_code,
                    placeData.primary_type,
                    placeData.types,
                    placeId
                ]);
                if (updateResult.rows.length === 0) {
                    throw new Error('Failed to update place');
                }
            }
            else {
                // Insert new place
                const insertResult = await client.query(`INSERT INTO places (
             google_place_id, name, address, category_id, lat, lng, metadata,
             city_name, city_slug, admin1_name, country_code, primary_type, types
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`, [
                    placeData.google_place_id,
                    placeData.name,
                    placeData.address,
                    categoryId,
                    placeData.lat,
                    placeData.lng,
                    JSON.stringify(placeData.metadata || {}),
                    placeData.city_name,
                    placeData.city_slug,
                    placeData.admin1_name,
                    placeData.country_code,
                    placeData.primary_type,
                    placeData.types
                ]);
                placeId = insertResult.rows[0].id;
            }
        }
        else {
            // No google_place_id provided, always insert new place
            const insertResult = await client.query(`INSERT INTO places (
           name, address, category_id, lat, lng, metadata,
           city_name, city_slug, admin1_name, country_code, primary_type, types
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`, [
                placeData.name,
                placeData.address,
                categoryId,
                placeData.lat,
                placeData.lng,
                JSON.stringify(placeData.metadata || {}),
                placeData.city_name,
                placeData.city_slug,
                placeData.admin1_name,
                placeData.country_code,
                placeData.primary_type,
                placeData.types
            ]);
            placeId = insertResult.rows[0].id;
        }
        // Update geometry if coordinates are provided
        if (placeData.lat && placeData.lng) {
            await client.query(`UPDATE places 
         SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         WHERE id = $3`, [placeData.lng, placeData.lat, placeId]);
        }
        await client.query('COMMIT');
        return placeId;
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
 * Get place information by ID
 */
async function getPlaceById(placeId) {
    try {
        const result = await db_1.default.query('SELECT * FROM places WHERE id = $1', [placeId]);
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0];
    }
    catch (error) {
        console.error('Error getting place by ID:', error);
        throw error;
    }
}
/**
 * Get a place by Google Place ID
 */
async function getPlaceByGoogleId(googlePlaceId) {
    const result = await db_1.default.query('SELECT * FROM places WHERE google_place_id = $1', [googlePlaceId]);
    return result.rows[0] || null;
}
/**
 * Search places within a radius (in meters)
 */
async function searchPlacesNearby(lat, lng, radiusMeters = 5000, limit = 50) {
    const result = await db_1.default.query(`SELECT *, ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
     FROM places 
     WHERE geom IS NOT NULL 
       AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ORDER BY distance
     LIMIT $4`, [lng, lat, radiusMeters, limit]);
    return result.rows;
}
/**
 * Get user information by ID
 */
async function getUserById(userId) {
    try {
        const result = await db_1.default.query('SELECT display_name, email FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0];
    }
    catch (error) {
        console.error('Error getting user by ID:', error);
        throw error;
    }
}
/**
 * Get all places that have reviews/annotations
 */
async function getPlacesWithReviews(visibility = 'all', limit = 100, offset = 0, groupIds, currentUserId) {
    try {
        let query = `
      SELECT 
        p.*,
        c.name as category_name,
        COUNT(a.id) as review_count,
        AVG(a.rating) as average_rating,
        MAX(a.created_at) as latest_review_date
      FROM places p
      LEFT JOIN categories c ON p.category_id = c.id
      INNER JOIN recommendations a ON p.id = a.place_id
    `;
        const params = [];
        let paramCount = 0;
        const whereConditions = [];
        if (visibility !== 'all') {
            paramCount++;
            whereConditions.push(`a.visibility = $${paramCount}`);
            params.push(visibility);
        }
        // Add friends filtering - only show places reviewed by users the current user follows
        if (visibility === 'friends' && currentUserId) {
            paramCount++;
            whereConditions.push(`a.user_id IN (
        SELECT following_id FROM user_follows WHERE follower_id = $${paramCount}
      )`);
            params.push(currentUserId);
        }
        // Add group filtering if groupIds are provided
        if (groupIds && groupIds.length > 0) {
            paramCount++;
            whereConditions.push(`a.user_id IN (
        SELECT DISTINCT fgm.user_id 
        FROM friend_group_members fgm 
        WHERE fgm.group_id = ANY($${paramCount})
      )`);
            params.push(groupIds);
        }
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        query += `
      GROUP BY p.id, p.google_place_id, p.name, p.address, p.category_id, p.lat, p.lng, p.geom, p.metadata, p.created_at, p.updated_at, c.name
      HAVING COUNT(a.id) > 0
      ORDER BY latest_review_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
        params.push(limit, offset);
        const result = await db_1.default.query(query, params);
        return result.rows.map(row => ({
            ...row,
            average_rating: parseFloat(row.average_rating) || 0,
            review_count: parseInt(row.review_count),
            latest_review_date: row.latest_review_date,
            category_name: row.category_name
        }));
    }
    catch (error) {
        console.error('Error getting places with reviews:', error);
        throw error;
    }
}
