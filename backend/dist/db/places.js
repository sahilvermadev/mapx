"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPlace = upsertPlace;
exports.getPlaceById = getPlaceById;
exports.getPlaceByGoogleId = getPlaceByGoogleId;
exports.searchPlacesNearby = searchPlacesNearby;
const db_1 = __importDefault(require("../db"));
/**
 * Upsert a place - creates if it doesn't exist, updates if it does
 * Uses google_place_id as the unique identifier for upserts
 */
async function upsertPlace(placeData) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        let placeId;
        if (placeData.google_place_id) {
            // Try to find existing place by google_place_id
            const existingResult = await client.query('SELECT id FROM places WHERE google_place_id = $1', [placeData.google_place_id]);
            if (existingResult.rows.length > 0) {
                // Update existing place
                placeId = existingResult.rows[0].id;
                const updateResult = await client.query(`UPDATE places 
           SET name = $1, address = $2, category_id = $3, lat = $4, lng = $5, 
               metadata = $6, updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING id`, [
                    placeData.name,
                    placeData.address,
                    placeData.category_id,
                    placeData.lat,
                    placeData.lng,
                    JSON.stringify(placeData.metadata || {}),
                    placeId
                ]);
                if (updateResult.rows.length === 0) {
                    throw new Error('Failed to update place');
                }
            }
            else {
                // Insert new place
                const insertResult = await client.query(`INSERT INTO places (google_place_id, name, address, category_id, lat, lng, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`, [
                    placeData.google_place_id,
                    placeData.name,
                    placeData.address,
                    placeData.category_id,
                    placeData.lat,
                    placeData.lng,
                    JSON.stringify(placeData.metadata || {})
                ]);
                placeId = insertResult.rows[0].id;
            }
        }
        else {
            // No google_place_id provided, always insert new place
            const insertResult = await client.query(`INSERT INTO places (name, address, category_id, lat, lng, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`, [
                placeData.name,
                placeData.address,
                placeData.category_id,
                placeData.lat,
                placeData.lng,
                JSON.stringify(placeData.metadata || {})
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
 * Get a place by ID
 */
async function getPlaceById(id) {
    const result = await db_1.default.query('SELECT * FROM places WHERE id = $1', [id]);
    return result.rows[0] || null;
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
