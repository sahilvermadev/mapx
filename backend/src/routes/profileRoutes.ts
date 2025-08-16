import express from 'express';
import { getAnnotationsByUserId, deleteAnnotation } from '../db/annotations';
import { getPlaceByGoogleId } from '../db/places';
import pool from '../db';

const router = express.Router();

// Temporarily disable authentication for testing
const requireAuth = (req: any, res: any, next: any) => {
  // Skip authentication for now
  next();
};

/**
 * GET /api/profile/:userId
 * Get user profile data
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT id, display_name, email, profile_picture_url, created_at, last_login_at
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = result.rows[0];
    
    res.json({
      success: true,
      data: {
        id: userData.id,
        displayName: userData.display_name,
        email: userData.email,
        profilePictureUrl: userData.profile_picture_url,
        created_at: userData.created_at,
        last_login_at: userData.last_login_at
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/stats
 * Get user statistics
 */
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get total recommendations
    const recommendationsResult = await pool.query(
      'SELECT COUNT(*) as count FROM annotations WHERE user_id = $1',
      [userId]
    );

    // Get total likes (for now, we'll use a placeholder since likes table might not exist)
    const likesResult = await pool.query(
      'SELECT COUNT(*) as count FROM likes WHERE user_id = $1',
      [userId]
    );

    // Get total saved (for now, we'll use a placeholder since saved_recommendations table might not exist)
    const savedResult = await pool.query(
      'SELECT COUNT(*) as count FROM saved_recommendations WHERE user_id = $1',
      [userId]
    );

    // Get average rating
    const avgRatingResult = await pool.query(
      'SELECT AVG(rating) as avg_rating FROM annotations WHERE user_id = $1 AND rating IS NOT NULL',
      [userId]
    );

    // Get total places visited
    const placesVisitedResult = await pool.query(
      'SELECT COUNT(DISTINCT place_id) as count FROM annotations WHERE user_id = $1',
      [userId]
    );

    // Get total reviews
    const reviewsResult = await pool.query(
      'SELECT COUNT(*) as count FROM annotations WHERE user_id = $1 AND notes IS NOT NULL AND notes != \'\'',
      [userId]
    );

    res.json({
      success: true,
      data: {
        total_recommendations: parseInt(recommendationsResult.rows[0].count),
        total_likes: parseInt(likesResult.rows[0].count),
        total_saved: parseInt(savedResult.rows[0].count),
        average_rating: parseFloat(avgRatingResult.rows[0].avg_rating) || 0,
        total_places_visited: parseInt(placesVisitedResult.rows[0].count),
        total_reviews: parseInt(reviewsResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/recommendations
 * Get user recommendations with filtering and pagination
 */
router.get('/:userId/recommendations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      rating, 
      visibility, 
      category, 
      search, 
      date_from, 
      date_to,
      sort_field = 'created_at',
      sort_direction = 'desc',
      limit = 20,
      offset = 0
    } = req.query;

    // Build the query with filters
    let query = `
      SELECT 
        a.id,
        a.notes,
        a.rating,
        a.visit_date,
        a.visibility,
        a.created_at,
        a.labels,
        a.metadata,
        p.name as place_name,
        p.address as place_address,
        p.lat as place_lat,
        p.lng as place_lng,
        p.google_place_id,
        u.display_name as user_name
      FROM annotations a
      JOIN places p ON a.place_id = p.id
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1
    `;
    
    const queryParams: any[] = [userId];
    let paramCount = 1;

    // Add filters
    if (rating) {
      paramCount++;
      query += ` AND a.rating >= $${paramCount}`;
      queryParams.push(rating);
    }

    if (visibility && visibility !== 'all') {
      paramCount++;
      query += ` AND a.visibility = $${paramCount}`;
      queryParams.push(visibility);
    }

    if (category) {
      paramCount++;
      query += ` AND p.metadata->>'category' = $${paramCount}`;
      queryParams.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR a.notes ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (date_from) {
      paramCount++;
      query += ` AND a.visit_date >= $${paramCount}`;
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND a.visit_date <= $${paramCount}`;
      queryParams.push(date_to);
    }

    // Add sorting
    const validSortFields = ['created_at', 'rating', 'place_name', 'visit_date', 'category'];
    const validSortDirections = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort_field as string) ? sort_field : 'created_at';
    const sortDirection = validSortDirections.includes(sort_direction as string) ? sort_direction : 'desc';
    
    query += ` ORDER BY ${sortField} ${(sortDirection as string).toUpperCase()}`;

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(parseInt(limit as string));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(parseInt(offset as string));

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM annotations a
      JOIN places p ON a.place_id = p.id
      WHERE a.user_id = $1
    `;
    
    const countParams: any[] = [userId];
    let countParamCount = 1;

    if (rating) {
      countParamCount++;
      countQuery += ` AND a.rating >= $${countParamCount}`;
      countParams.push(rating);
    }

    if (visibility && visibility !== 'all') {
      countParamCount++;
      countQuery += ` AND a.visibility = $${countParamCount}`;
      countParams.push(visibility);
    }

    if (category) {
      countParamCount++;
      countQuery += ` AND p.metadata->>'category' = $${countParamCount}`;
      countParams.push(category);
    }

    if (search) {
      countParamCount++;
      countQuery += ` AND (p.name ILIKE $${countParamCount} OR a.notes ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (date_from) {
      countParamCount++;
      countQuery += ` AND a.visit_date >= $${countParamCount}`;
      countParams.push(date_from);
    }

    if (date_to) {
      countParamCount++;
      countQuery += ` AND a.visit_date <= $${countParamCount}`;
      countParams.push(date_to);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    const recommendations = result.rows.map(row => ({
      id: row.id.toString(),
      place_name: row.place_name,
      place_address: row.place_address,
      category: row.metadata?.category || 'other',
      rating: row.rating,
      notes: row.notes,
      visit_date: row.visit_date,
      visibility: row.visibility,
      created_at: row.created_at,
      place_lat: row.place_lat,
      place_lng: row.place_lng,
      google_place_id: row.google_place_id,
      user_name: row.user_name,
      title: row.metadata?.title,
      labels: row.labels || [],
      metadata: row.metadata || {}
    }));

    res.json({
      success: true,
      data: recommendations,
      pagination: {
        total,
        page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error) {
    console.error('Error fetching user recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user recommendations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/likes
 * Get user likes (placeholder - needs likes table implementation)
 */
router.get('/:userId/likes', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      sort_field = 'created_at',
      sort_direction = 'desc',
      limit = 20,
      offset = 0
    } = req.query;

    // For now, return empty array since likes functionality needs to be implemented
    res.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: parseInt(limit as string),
        totalPages: 0
      }
    });

  } catch (error) {
    console.error('Error fetching user likes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user likes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/saved
 * Get user saved places (placeholder - needs saved_recommendations table implementation)
 */
router.get('/:userId/saved', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      sort_field = 'created_at',
      sort_direction = 'desc',
      limit = 20,
      offset = 0
    } = req.query;

    // For now, return empty array since saved functionality needs to be implemented
    res.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: parseInt(limit as string),
        totalPages: 0
      }
    });

  } catch (error) {
    console.error('Error fetching user saved places:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user saved places',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/profile/recommendations/:annotationId
 * Delete a recommendation
 */
router.delete('/recommendations/:annotationId', async (req, res) => {
  try {
    const { annotationId } = req.params;
    
    const success = await deleteAnnotation(parseInt(annotationId), 'test-user-id');
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Recommendation deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete recommendation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/profile/likes/:placeId
 * Unlike a place (placeholder)
 */
router.delete('/likes/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;
    
    // For now, return success since likes functionality needs to be implemented
    res.json({
      success: true,
      message: 'Place unliked successfully'
    });

  } catch (error) {
    console.error('Error unliking place:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike place',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/profile/saved/:placeId
 * Remove place from saved (placeholder)
 */
router.delete('/saved/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;
    
    // For now, return success since saved functionality needs to be implemented
    res.json({
      success: true,
      message: 'Place removed from saved successfully'
    });

  } catch (error) {
    console.error('Error removing place from saved:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove place from saved',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 