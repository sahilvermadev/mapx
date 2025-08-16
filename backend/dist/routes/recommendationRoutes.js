"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const places_1 = require("../db/places");
const annotations_1 = require("../db/annotations");
const db_1 = __importDefault(require("../db")); // Import pool directly from db.ts
const router = express_1.default.Router();
/**
 * GET /api/recommendations/place/google/:googlePlaceId
 * Get place information by Google Place ID
 */
router.get('/place/google/:googlePlaceId', async (req, res) => {
    try {
        const { googlePlaceId } = req.params;
        if (!googlePlaceId) {
            return res.status(400).json({
                success: false,
                message: 'Google Place ID is required'
            });
        }
        const place = await (0, places_1.getPlaceByGoogleId)(googlePlaceId);
        if (!place) {
            return res.status(404).json({
                success: false,
                message: 'Place not found'
            });
        }
        res.json({
            success: true,
            data: {
                id: place.id,
                google_place_id: place.google_place_id,
                name: place.name,
                address: place.address,
                lat: place.lat,
                lng: place.lng,
                metadata: place.metadata
            },
            message: 'Place found successfully'
        });
    }
    catch (error) {
        console.error('Error fetching place by Google ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch place',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/recommendations/save
 * Save a recommendation by upserting place, generating embedding, and inserting annotation
 */
router.post('/save', async (req, res) => {
    try {
        const { google_place_id, place_name, place_address, place_lat, place_lng, place_metadata, went_with, labels, notes, metadata, visit_date, rating, visibility, user_id } = req.body;
        // Validate required fields
        if (!place_name) {
            return res.status(400).json({
                success: false,
                message: 'Place name is required'
            });
        }
        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        // Validate rating if provided
        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }
        // Validate visibility if provided
        if (visibility && !['friends', 'public'].includes(visibility)) {
            return res.status(400).json({
                success: false,
                message: 'Visibility must be either "friends" or "public"'
            });
        }
        // Step 1: Upsert the place
        console.log('Upserting place:', place_name);
        const placeId = await (0, places_1.upsertPlace)({
            google_place_id,
            name: place_name,
            address: place_address,
            lat: place_lat,
            lng: place_lng,
            metadata: place_metadata
        });
        // Step 2: Generate place embedding if we have place data
        // TEMPORARILY DISABLED due to network connectivity issues
        /*
        let placeEmbedding: number[] | undefined;
        if (place_name || place_address || place_metadata) {
          try {
            placeEmbedding = await generatePlaceEmbedding({
              name: place_name,
              address: place_address,
              metadata: place_metadata
            });
            console.log('Generated place embedding');
          } catch (error) {
            console.warn('Failed to generate place embedding:', error);
            // Continue without place embedding
          }
        }
        */
        // Step 3: Insert the annotation with auto-generated embedding
        console.log('Inserting annotation for place:', placeId);
        const annotationId = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id,
            went_with,
            labels,
            notes,
            metadata,
            visit_date,
            rating,
            visibility: visibility || 'friends',
            auto_generate_embedding: false // TEMPORARILY DISABLED due to network connectivity issues
        });
        const response = {
            success: true,
            place_id: placeId,
            annotation_id: annotationId,
            message: 'Recommendation saved successfully'
        };
        console.log('Recommendation saved successfully:', {
            place_id: placeId,
            annotation_id: annotationId,
            place_name,
            user_id
        });
        // Return response in the format expected by the frontend API client
        res.status(201).json({
            success: true,
            data: response,
            message: 'Recommendation saved successfully'
        });
    }
    catch (error) {
        console.error('Error saving recommendation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save recommendation',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/recommendations/user/:userId
 * Get all recommendations for a specific user
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        // Validate user ID format (should be UUID)
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Valid user ID is required'
            });
        }
        // Get user's annotations with pagination
        const annotations = await (0, annotations_1.getAnnotationsByUserId)(userId, limit + offset);
        // Apply offset manually since the function doesn't support it
        const paginatedAnnotations = annotations.slice(offset, offset + limit);
        // Transform annotations to include place information
        const recommendations = await Promise.all(paginatedAnnotations.map(async (annotation) => {
            // Get place information (you might want to add a join query for better performance)
            const placeQuery = await db_1.default.query('SELECT name, address, lat, lng FROM places WHERE id = $1', [annotation.place_id]);
            const place = placeQuery.rows[0] || {};
            return {
                id: annotation.id,
                place_name: place.name || 'Unknown Place',
                place_address: place.address,
                place_lat: place.lat,
                place_lng: place.lng,
                notes: annotation.notes,
                rating: annotation.rating,
                visit_date: annotation.visit_date,
                visibility: annotation.visibility,
                labels: annotation.labels,
                went_with: annotation.went_with,
                metadata: annotation.metadata,
                created_at: annotation.created_at,
                updated_at: annotation.updated_at
            };
        }));
        res.json({
            success: true,
            data: recommendations,
            pagination: {
                limit,
                offset,
                total: annotations.length,
                hasMore: annotations.length > offset + limit
            },
            message: 'User recommendations retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error fetching user recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recommendations',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/recommendations/place/:placeId
 * Get all recommendations for a specific place
 */
router.get('/place/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;
        const visibility = req.query.visibility || 'all';
        const limit = parseInt(req.query.limit) || 50;
        // Validate place ID
        const placeIdNum = parseInt(placeId);
        if (isNaN(placeIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'Valid place ID is required'
            });
        }
        // Validate visibility parameter
        if (!['friends', 'public', 'all'].includes(visibility)) {
            return res.status(400).json({
                success: false,
                message: 'Visibility must be "friends", "public", or "all"'
            });
        }
        // Get place recommendations
        const annotations = await (0, annotations_1.getAnnotationsByPlaceId)(placeIdNum, visibility, limit);
        // Transform annotations to include user information
        const recommendations = await Promise.all(annotations.map(async (annotation) => {
            // Get user information (you might want to add a join query for better performance)
            const userQuery = await db_1.default.query('SELECT display_name, email FROM users WHERE id = $1', [annotation.user_id]);
            const user = userQuery.rows[0] || {};
            return {
                id: annotation.id,
                user_id: annotation.user_id,
                user_name: user.display_name || 'Anonymous',
                user_email: user.email,
                notes: annotation.notes,
                rating: annotation.rating,
                visit_date: annotation.visit_date,
                visibility: annotation.visibility,
                labels: annotation.labels,
                went_with: annotation.went_with,
                metadata: annotation.metadata,
                created_at: annotation.created_at,
                updated_at: annotation.updated_at
            };
        }));
        res.json({
            success: true,
            data: recommendations,
            place_id: placeIdNum,
            visibility,
            total: recommendations.length,
            message: 'Place recommendations retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error fetching place recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recommendations',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/recommendations/:annotationId
 * Get a specific recommendation by ID
 */
router.get('/:annotationId', async (req, res) => {
    try {
        const { annotationId } = req.params;
        const annotationIdNum = parseInt(annotationId);
        if (isNaN(annotationIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'Valid annotation ID is required'
            });
        }
        const annotation = await (0, annotations_1.getAnnotationById)(annotationIdNum);
        if (!annotation) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found'
            });
        }
        // Get place and user information
        const [placeQuery, userQuery] = await Promise.all([
            db_1.default.query('SELECT name, address, lat, lng FROM places WHERE id = $1', [annotation.place_id]),
            db_1.default.query('SELECT display_name, email FROM users WHERE id = $1', [annotation.user_id])
        ]);
        const place = placeQuery.rows[0] || {};
        const user = userQuery.rows[0] || {};
        const recommendation = {
            ...annotation,
            place_name: place.name,
            place_address: place.address,
            place_lat: place.lat,
            place_lng: place.lng,
            user_name: user.display_name,
            user_email: user.email
        };
        res.json({
            success: true,
            data: recommendation,
            message: 'Recommendation retrieved successfully'
        });
    }
    catch (error) {
        console.error('Error fetching recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recommendation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PUT /api/recommendations/:annotationId
 * Update a specific recommendation
 */
router.put('/:annotationId', async (req, res) => {
    try {
        const { annotationId } = req.params;
        const annotationIdNum = parseInt(annotationId);
        const updates = req.body;
        if (isNaN(annotationIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'Valid annotation ID is required'
            });
        }
        // Validate rating if provided
        if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }
        // Validate visibility if provided
        if (updates.visibility && !['friends', 'public'].includes(updates.visibility)) {
            return res.status(400).json({
                success: false,
                message: 'Visibility must be either "friends" or "public"'
            });
        }
        const success = await (0, annotations_1.updateAnnotation)(annotationIdNum, updates);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found or no changes made'
            });
        }
        res.json({
            success: true,
            message: 'Recommendation updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update recommendation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /api/recommendations/:annotationId
 * Delete a specific recommendation
 */
router.delete('/:annotationId', async (req, res) => {
    try {
        const { annotationId } = req.params;
        const annotationIdNum = parseInt(annotationId);
        const { user_id } = req.body; // User ID should be provided in request body for authorization
        if (isNaN(annotationIdNum)) {
            return res.status(400).json({
                success: false,
                message: 'Valid annotation ID is required'
            });
        }
        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required for authorization'
            });
        }
        const success = await (0, annotations_1.deleteAnnotation)(annotationIdNum, user_id);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Recommendation not found or unauthorized'
            });
        }
        res.json({
            success: true,
            message: 'Recommendation deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete recommendation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
