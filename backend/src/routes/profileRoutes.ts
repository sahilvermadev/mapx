import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { performance } from 'perf_hooks';
import { deleteRecommendation } from '../db/recommendations';
import { getSavedPlacesCount, getSavedPlaces } from '../db/social';
import pool from '../db';
import { getUserIdFromRequest, authenticateJWT } from '../middleware/auth';
import logger from '../utils/logger';
import { UPLOAD_CONFIG, validateFileExtension } from '../config/uploadConfig';

const router = express.Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../uploads/banners');
// Ensure uploads directory exists
try {
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
    logger.info('Created uploads directory', { path: uploadsDir });
  }
} catch (error: any) {
  logger.error('Failed to create uploads directory', { error: error.message, path: uploadsDir });
  throw error; // Fail fast if we can't create the directory
}

// Cache for ensurePrefsTable calls - only call once per process
let prefsTableEnsured = false;

/**
 * Ensure the preferences table exists (only creates if it doesn't exist)
 */
async function ensurePrefsTable(): Promise<void> {
  if (prefsTableEnsured) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profile_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    prefsTableEnsured = true;
  } catch (error: any) {
    logger.error('Failed to ensure preferences table', { error: error.message });
    throw error;
  }
}

/**
 * Extract filename from banner URL path
 */
function extractFilenameFromBannerUrl(bannerUrl: string): string | null {
  const match = bannerUrl.match(/\/api\/profile\/banner\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Delete a banner file from the filesystem
 */
async function deleteBannerFile(filename: string): Promise<void> {
  try {
    const filePath = path.join(uploadsDir, filename);
    await fs.unlink(filePath);
    logger.info('Deleted banner file', { filename });
  } catch (error: any) {
    // Ignore if file doesn't exist (ENOENT)
    if (error.code !== 'ENOENT') {
      logger.warn('Error deleting banner file', { filename, error: error.message });
      throw error;
    }
  }
}

/**
 * Get user preferences (helper function)
 */
async function getUserPreferences(userId: string): Promise<Record<string, any>> {
  await ensurePrefsTable();
  const result = await pool.query(
    'SELECT prefs FROM user_profile_preferences WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.prefs || {};
}

/**
 * Update user preferences (helper function)
 */
async function updateUserPreferences(userId: string, prefs: Record<string, any>): Promise<void> {
  await ensurePrefsTable();
  await pool.query(
    `INSERT INTO user_profile_preferences (user_id, prefs, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = NOW()`,
    [userId, JSON.stringify(prefs)]
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Note: userId will be available in req.params after route matching
    // For now, use a timestamp-based name - we'll verify userId in the route handler
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const filename = `banner-${timestamp}-${random}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: UPLOAD_CONFIG.BANNER.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    // Validate MIME type
    if (!UPLOAD_CONFIG.BANNER.ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
    
    // Validate file extension matches MIME type (security measure)
    if (!validateFileExtension(file.originalname, file.mimetype)) {
      return cb(new Error('File extension does not match file type.'));
    }
    
    cb(null, true);
  },
});

// Error handling middleware for multer errors
const handleMulterError = (
  err: Error | multer.MulterError,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (err) {
    logger.error('Multer error caught', { 
      error: err.message, 
      code: 'code' in err ? err.code : undefined,
      name: err.name,
      stack: err.stack,
    });
    
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSizeMB = UPLOAD_CONFIG.BANNER.MAX_FILE_SIZE / (1024 * 1024);
        return res.status(400).json({ 
          success: false, 
          error: `File too large. Maximum size is ${maxSizeMB}MB.` 
        });
      }
      logger.error('Multer error', { error: err.message, code: err.code });
      return res.status(400).json({ success: false, error: err.message || 'File upload error' });
    }
    // Handle fileFilter errors
    if (err.message && err.message.includes('Invalid file type')) {
      logger.warn('Invalid file type attempted', { error: err.message });
      return res.status(400).json({ success: false, error: err.message });
    }
    logger.error('Upload error', { error: err.message, stack: err.stack });
    return res.status(400).json({ success: false, error: err.message || 'File upload error' });
  }
  next();
};


/**
 * GET /api/profile/:userId
 * Get user profile data
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user data and follower/following counts in parallel
    const [userResult, followerCountResult, followingCountResult] = await Promise.all([
      pool.query(
        `SELECT id, display_name, email, profile_picture_url, username, bio, city, created_at, last_login_at
         FROM users 
         WHERE id = $1`,
        [userId]
      ),
      // Count followers (people who follow this user)
      pool.query(
        `SELECT COUNT(*) as count 
         FROM user_follows 
         WHERE following_id = $1`,
        [userId]
      ),
      // Count following (people this user follows)
      pool.query(
        `SELECT COUNT(*) as count 
         FROM user_follows 
         WHERE follower_id = $1`,
        [userId]
      )
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userResult.rows[0];
    const followersCount = parseInt(followerCountResult.rows[0].count) || 0;
    const followingCount = parseInt(followingCountResult.rows[0].count) || 0;
    
    res.json({
      success: true,
      data: {
        id: userData.id,
        displayName: userData.display_name,
        email: userData.email,
        username: userData.username,
        profilePictureUrl: userData.profile_picture_url,
        bio: userData.bio || null,
        city: userData.city || null,
        created_at: userData.created_at,
        last_login_at: userData.last_login_at,
        followers_count: followersCount,
        following_count: followingCount
      }
    });

  } catch (error: any) {
    logger.error('Error fetching user profile', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/profile/:userId
 * Update user profile data (bio, city)
 */
router.put('/:userId', authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = getUserIdFromRequest(req as any);
    
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not allowed to update this profile'
      });
    }

    const { bio, city } = req.body;
    
    // Validate bio length (max 500 characters)
    if (bio !== undefined && bio !== null && bio.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bio must be 500 characters or less'
      });
    }

    // Validate city length (max 255 characters)
    if (city !== undefined && city !== null && city.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'City must be 255 characters or less'
      });
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex}`);
      values.push(bio || null);
      paramIndex++;
    }

    if (city !== undefined) {
      updates.push(`city = $${paramIndex}`);
      values.push(city || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Add updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, display_name, email, profile_picture_url, username, bio, city, created_at, last_login_at
    `;

    const result = await pool.query(query, values);

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
        username: userData.username,
        profilePictureUrl: userData.profile_picture_url,
        bio: userData.bio || null,
        city: userData.city || null,
        created_at: userData.created_at,
        last_login_at: userData.last_login_at
      }
    });

  } catch (error: any) {
    logger.error('Error updating user profile', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Minimal profile preferences (bannerUrl, accent, font, background, nameEmoji)
 * Note: ensurePrefsTable is now defined above with caching
 */

// GET /api/profile/banner/:filename - Serve banner image (MUST be before /:userId route)
router.get('/banner/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    // Security check: ensure filename doesn't contain path traversal
    if (filename.includes('..') || path.isAbsolute(filename)) {
      return res.status(404).json({ success: false, error: 'Banner not found' });
    }
    
    const filePath = path.join(uploadsDir, filename);
    
    // Verify file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ success: false, error: 'Banner not found' });
    }

    // Set appropriate headers based on extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const contentType = contentTypeMap[ext] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    return res.sendFile(filePath);
  } catch (error: any) {
    logger.error('Error serving banner image', { 
      error: error.message, 
      filename: req.params.filename 
    });
    return res.status(500).json({ success: false, error: 'Failed to serve banner image' });
  }
});

// POST /api/profile/:userId/banner - Upload banner image  
router.post('/:userId/banner', authenticateJWT, (req: Request, res: Response, next: NextFunction) => {
  upload.single(UPLOAD_CONFIG.BANNER.FIELD_NAME)(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requesterId = getUserIdFromRequest(req as any);
    
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }

    // Log request details for debugging
    logger.info('Banner upload request', {
      userId,
      hasFile: !!req.file,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    });

    if (!req.file) {
      logger.warn('No file in request', {
        userId,
        contentType: req.headers['content-type'],
      });
      return res.status(400).json({ 
        success: false, 
        error: `No file uploaded. Please ensure the file field is named "${UPLOAD_CONFIG.BANNER.FIELD_NAME}".` 
      });
    }

    // Get existing preferences and delete old banner if exists
    const currentPrefs = await getUserPreferences(userId);
    
    if (currentPrefs.bannerUrl) {
      const oldFilename = extractFilenameFromBannerUrl(currentPrefs.bannerUrl);
      if (oldFilename) {
        try {
          await deleteBannerFile(oldFilename);
        } catch (error: any) {
          logger.warn('Error deleting old banner', { error: error.message, userId });
          // Continue anyway - don't fail the upload if old file deletion fails
        }
      }
    }

    // Store the banner URL in preferences
    const bannerUrl = `/api/profile/banner/${req.file.filename}`;
    const updatedPrefs = { ...currentPrefs, bannerUrl };
    await updateUserPreferences(userId, updatedPrefs);

    logger.info('Banner uploaded successfully', { userId, bannerUrl });
    return res.json({ 
      success: true, 
      data: { bannerUrl } 
    });
  } catch (error: any) {
    logger.error('Error uploading banner image', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to upload banner image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/profile/:userId/banner - Delete banner image
router.delete('/:userId/banner', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requesterId = getUserIdFromRequest(req as any);
    
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }

    const currentPrefs = await getUserPreferences(userId);
    
    if (currentPrefs.bannerUrl) {
      const filename = extractFilenameFromBannerUrl(currentPrefs.bannerUrl);
      if (filename) {
        await deleteBannerFile(filename);
      }
      
      // Remove bannerUrl from preferences
      const { bannerUrl: _, ...updatedPrefs } = currentPrefs;
      await updateUserPreferences(userId, updatedPrefs);
      
      logger.info('Banner deleted successfully', { userId });
    }

    return res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting banner image', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
    return res.status(500).json({ success: false, error: 'Failed to delete banner image' });
  }
});

// GET /api/profile/:userId/preferences
router.get('/:userId/preferences', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const prefs = await getUserPreferences(userId);
    return res.json({ success: true, data: prefs });
  } catch (error: any) {
    logger.error('Error fetching profile preferences', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
    return res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

// PUT /api/profile/:userId/preferences
router.put('/:userId/preferences', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requesterId = getUserIdFromRequest(req as any);
    if (!requesterId || requesterId !== userId) {
      return res.status(403).json({ success: false, error: 'Not allowed' });
    }
    const prefs = req.body || {};
    await updateUserPreferences(userId, prefs);
    return res.json({ success: true, data: prefs });
  } catch (error: any) {
    logger.error('Error saving profile preferences', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
    return res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
});

/**
 * GET /api/profile/:userId/stats
 * Get user statistics
 * OPTIMIZED: Combined queries and parallel execution for better performance
 */
router.get('/:userId/stats', async (req, res) => {
  const startTime = performance.now();
  try {
    const { userId } = req.params;

    // Execute all independent queries in parallel for better performance
    const [
      recommendationsResult,
      likesResult,
      questionsResult,
      savedCountPromise,
      avgRatingResult,
      citiesVisitedResult,
      reviewsResult
    ] = await Promise.all([
      // Get total recommendations (matching getUserRecommendations filters)
      // Only count public/friends recommendations (question answers are included)
      pool.query(
        `SELECT COUNT(*) as count 
         FROM recommendations r
         WHERE r.user_id = $1
         AND r.visibility IN ('public', 'friends')`,
        [userId]
      ),
      // Get total likes (count of visible annotations liked by this user)
      // This matches the same filters as getUserLikedPosts
      pool.query(
        `SELECT COUNT(DISTINCT al.recommendation_id) as count
         FROM annotation_likes al
         JOIN recommendations r ON al.recommendation_id = r.id
         JOIN places p ON r.place_id = p.id
         JOIN users u ON r.user_id = u.id
         WHERE al.user_id = $1
         AND r.visibility IN ('public', 'friends')
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks 
           WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
           OR (blocker_id = r.user_id AND blocked_id = $1)
         )`,
        [userId]
      ),
      // Get total questions
      pool.query(
        'SELECT COUNT(*) as count FROM questions WHERE user_id = $1',
        [userId]
      ),
      // Get total saved places
      getSavedPlacesCount(userId),
      // Get average rating
      pool.query(
        'SELECT AVG(rating) as avg_rating FROM recommendations WHERE user_id = $1 AND rating IS NOT NULL',
        [userId]
      ),
      // Get total cities visited (distinct cities from recommendations)
      pool.query(
        `SELECT COUNT(DISTINCT p.city_slug) as count 
         FROM recommendations r
         JOIN places p ON r.place_id = p.id
         WHERE r.user_id = $1 AND p.city_slug IS NOT NULL`,
        [userId]
      ),
      // Get total reviews
      pool.query(
        'SELECT COUNT(*) as count FROM recommendations WHERE user_id = $1 AND description IS NOT NULL AND description != \'\'',
        [userId]
      )
    ]);

    const savedCount = savedCountPromise; // Already resolved from Promise.all

    const duration = performance.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[PERF] Stats endpoint completed in ${duration.toFixed(2)}ms`, { userId });
    }

    res.json({
      success: true,
      data: {
        total_recommendations: parseInt(recommendationsResult.rows[0].count),
        total_likes: parseInt(likesResult.rows[0].count),
        total_questions: parseInt(questionsResult.rows[0].count),
        total_saved: savedCount,
        average_rating: parseFloat(avgRatingResult.rows[0].avg_rating) || 0,
        total_cities_visited: parseInt(citiesVisitedResult.rows[0].count),
        total_reviews: parseInt(reviewsResult.rows[0].count)
      }
    });

  } catch (error: any) {
    const duration = performance.now() - startTime;
    logger.error('Error fetching user stats', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId,
      duration: `${duration.toFixed(2)}ms`
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/recommendations
 * Get user recommendations in feed post format
 * OPTIMIZED: Added performance logging
 */
router.get('/:userId/recommendations', async (req, res) => {
  const startTime = performance.now();
  try {
    const { userId } = req.params;
    const { 
      limit = 20,
      offset = 0,
      content_type,
      search,
      city_slug,
      categories
    } = req.query;

    const { getUserRecommendations } = await import('../db/social');
    
    // Validate and sanitize query parameters
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);
    const searchQuery = search ? String(search).trim() : undefined;
    // Handle categories parameter - can be array from query or single value
    let categoryKeys: string[] | undefined = undefined;
    if (categories) {
      if (Array.isArray(categories)) {
        categoryKeys = categories.map(c => String(c).toLowerCase());
      } else if (typeof categories === 'string') {
        // Check if it's a comma-separated string
        categoryKeys = categories.split(',').map(c => c.trim().toLowerCase()).filter(c => c.length > 0);
      } else {
        categoryKeys = [String(categories).toLowerCase()];
      }
    }
    
    const recommendations = await getUserRecommendations(
      userId, 
      limitNum, 
      offsetNum,
      (content_type as 'place' | 'service' | undefined),
      searchQuery,
      (city_slug as string | undefined),
      categoryKeys
    );

    // Note: We're returning page size here as a placeholder for total
    // For accurate total count, we'd need a separate COUNT query, which would impact performance
    // This is acceptable for profile pages where exact total isn't critical
    const pageSize = recommendations.length;
    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const hasMore = pageSize === limitNum; // If we got a full page, there might be more

    const duration = performance.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[PERF] Recommendations endpoint completed in ${duration.toFixed(2)}ms`, { 
        userId, 
        limit: limitNum, 
        offset: offsetNum,
        resultCount: recommendations.length 
      });
    }

    res.json({
      success: true,
      data: recommendations,
      pagination: {
        total: pageSize,
        page: currentPage,
        limit: limitNum,
        totalPages: Math.ceil(pageSize / limitNum),
        hasMore
      }
    });

  } catch (error: any) {
    const duration = performance.now() - startTime;
    logger.error('Error fetching user recommendations', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId,
      duration: `${duration.toFixed(2)}ms`
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user recommendations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/likes
 * Get user liked posts
 */
router.get('/:userId/likes', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      limit = 20,
      offset = 0
    } = req.query;

    const { getUserLikedPosts, getUserLikedPostsCount } = await import('../db/social');
    const [likedPosts, totalCount] = await Promise.all([
      getUserLikedPosts(
        userId, 
        parseInt(limit as string), 
        parseInt(offset as string)
      ),
      getUserLikedPostsCount(userId)
    ]);

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    res.json({
      success: true,
      data: likedPosts,
      pagination: {
        total: totalCount,
        page: Math.floor(offsetNum / limitNum) + 1,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error: any) {
    logger.error('Error fetching user likes', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user likes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/saved
 * Get user saved places
 */
router.get('/:userId/saved', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      limit = 20,
      offset = 0
    } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const savedPlaces = await getSavedPlaces(userId, limitNum, offsetNum);
    const totalCount = await getSavedPlacesCount(userId);

    res.json({
      success: true,
      data: savedPlaces,
      pagination: {
        total: totalCount,
        page: Math.floor(offsetNum / limitNum) + 1,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });

  } catch (error: any) {
    logger.error('Error fetching user saved places', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
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
 * Uses authenticated user ID from JWT token for security
 */
router.delete('/recommendations/:annotationId', authenticateJWT, async (req, res) => {
  try {
    const { annotationId } = req.params;
    
    // Get user ID from authenticated JWT token
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const success = await deleteRecommendation(parseInt(annotationId), userId);
    
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

  } catch (error: any) {
    logger.error('Error deleting recommendation', { 
      error: error.message, 
      stack: error.stack,
      annotationId: req.params.annotationId 
    });
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

  } catch (error: any) {
    logger.error('Error unliking place', { 
      error: error.message, 
      stack: error.stack,
      placeId: req.params.placeId 
    });
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

  } catch (error: any) {
    logger.error('Error removing place from saved', { 
      error: error.message, 
      stack: error.stack,
      placeId: req.params.placeId 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to remove place from saved',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/profile/:userId/questions
 * Get user's questions
 */
router.get('/:userId/questions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT q.id, q.user_id, q.text, q.visibility, q.labels, q.metadata, q.created_at, q.updated_at,
              q.answers_count, q.last_answer_at, q.last_answer_user_id,
              u.display_name as user_name, u.profile_picture_url as user_picture
       FROM questions q
       JOIN users u ON u.id = q.user_id
       WHERE q.user_id = $1
       ORDER BY q.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Error fetching user questions', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    });
    return res.status(500).json({ success: false, error: 'Failed to fetch user questions' });
  }
});


export default router; 