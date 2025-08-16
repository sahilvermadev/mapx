import pool from '../db';

export interface PlaceData {
  google_place_id?: string;
  name: string;
  address?: string;
  category_id?: number;
  lat?: number;
  lng?: number;
  metadata?: Record<string, any>;
}

export interface Place {
  id: number;
  google_place_id?: string;
  name: string;
  address?: string;
  category_id?: number;
  lat?: number;
  lng?: number;
  geom?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Upsert a place - creates if it doesn't exist, updates if it does
 * Uses google_place_id as the unique identifier for upserts
 */
export async function upsertPlace(placeData: PlaceData): Promise<number> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let placeId: number;
    
    if (placeData.google_place_id) {
      // Try to find existing place by google_place_id
      const existingResult = await client.query(
        'SELECT id FROM places WHERE google_place_id = $1',
        [placeData.google_place_id]
      );
      
      if (existingResult.rows.length > 0) {
        // Update existing place
        placeId = existingResult.rows[0].id;
        
        const updateResult = await client.query(
          `UPDATE places 
           SET name = $1, address = $2, category_id = $3, lat = $4, lng = $5, 
               metadata = $6, updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING id`,
          [
            placeData.name,
            placeData.address,
            placeData.category_id,
            placeData.lat,
            placeData.lng,
            JSON.stringify(placeData.metadata || {}),
            placeId
          ]
        );
        
        if (updateResult.rows.length === 0) {
          throw new Error('Failed to update place');
        }
      } else {
        // Insert new place
        const insertResult = await client.query(
          `INSERT INTO places (google_place_id, name, address, category_id, lat, lng, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            placeData.google_place_id,
            placeData.name,
            placeData.address,
            placeData.category_id,
            placeData.lat,
            placeData.lng,
            JSON.stringify(placeData.metadata || {})
          ]
        );
        
        placeId = insertResult.rows[0].id;
      }
    } else {
      // No google_place_id provided, always insert new place
      const insertResult = await client.query(
        `INSERT INTO places (name, address, category_id, lat, lng, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          placeData.name,
          placeData.address,
          placeData.category_id,
          placeData.lat,
          placeData.lng,
          JSON.stringify(placeData.metadata || {})
        ]
      );
      
      placeId = insertResult.rows[0].id;
    }
    
    // Update geometry if coordinates are provided
    if (placeData.lat && placeData.lng) {
      await client.query(
        `UPDATE places 
         SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         WHERE id = $3`,
        [placeData.lng, placeData.lat, placeId]
      );
    }
    
    await client.query('COMMIT');
    return placeId;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get place information by ID
 */
export async function getPlaceById(placeId: number): Promise<Place | null> {
  try {
    const result = await pool.query(
      'SELECT * FROM places WHERE id = $1',
      [placeId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as Place;
  } catch (error) {
    console.error('Error getting place by ID:', error);
    throw error;
  }
}

/**
 * Get a place by Google Place ID
 */
export async function getPlaceByGoogleId(googlePlaceId: string): Promise<Place | null> {
  const result = await pool.query(
    'SELECT * FROM places WHERE google_place_id = $1',
    [googlePlaceId]
  );
  
  return result.rows[0] || null;
}

/**
 * Search places within a radius (in meters)
 */
export async function searchPlacesNearby(
  lat: number, 
  lng: number, 
  radiusMeters: number = 5000,
  limit: number = 50
): Promise<Place[]> {
  const result = await pool.query(
    `SELECT *, ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance
     FROM places 
     WHERE geom IS NOT NULL 
       AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
     ORDER BY distance
     LIMIT $4`,
    [lng, lat, radiusMeters, limit]
  );
  
  return result.rows;
} 

/**
 * Get user information by ID
 */
export async function getUserById(userId: string): Promise<{ display_name?: string; email?: string } | null> {
  try {
    const result = await pool.query(
      'SELECT display_name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
} 