"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const embeddings_1 = require("../utils/embeddings");
const places_1 = require("../db/places");
const annotations_1 = require("../db/annotations");
const places_2 = require("../db/places");
const db_1 = __importDefault(require("../db"));
const router = express_1.default.Router();
// Temporary auth middleware (replace with your actual auth)
const requireAuth = (req, res, next) => {
    const currentUserId = req.body.currentUserId || req.query.currentUserId;
    if (!currentUserId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = { id: currentUserId };
    next();
};
// Get place information by Google Place ID
router.get('/place/google/:googlePlaceId', async (req, res) => {
    try {
        const { googlePlaceId } = req.params;
        const result = await db_1.default.query('SELECT * FROM places WHERE google_place_id = $1', [googlePlaceId]);
        if (result.rows.length === 0) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching place by Google ID:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch place' });
    }
});
// Save a new recommendation
router.post('/save', requireAuth, async (req, res) => {
    try {
        const { google_place_id, place_name, place_address, place_lat, place_lng, place_metadata, place_category, title, went_with, labels, notes, metadata, visit_date, rating, visibility = 'public' } = req.body;
        const userId = req.user.id;
        // First, upsert the place
        const placeId = await (0, places_1.upsertPlace)({
            google_place_id,
            name: place_name,
            address: place_address,
            lat: place_lat,
            lng: place_lng,
            category_name: place_category,
            metadata: place_metadata
        });
        // Then create the annotation
        const annotationId = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id: userId,
            went_with,
            labels,
            notes,
            metadata,
            visit_date,
            rating,
            visibility,
            auto_generate_embedding: true
        });
        res.json({
            success: true,
            data: {
                place_id: placeId,
                annotation_id: annotationId,
                message: 'Recommendation saved successfully!'
            }
        });
    }
    catch (error) {
        console.error('Error saving recommendation:', error);
        res.status(500).json({ success: false, error: 'Failed to save recommendation' });
    }
});
// Get recommendations for a specific user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const recommendations = await (0, annotations_1.getAnnotationsByUserId)(userId, parseInt(limit));
        res.json({ success: true, data: recommendations });
    }
    catch (error) {
        console.error('Error fetching user recommendations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
    }
});
// Get recommendations for a specific place
router.get('/place/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;
        const { visibility = 'all', limit = 50 } = req.query;
        const recommendations = await (0, annotations_1.getAnnotationsByPlaceId)(parseInt(placeId), visibility, parseInt(limit));
        res.json({ success: true, data: recommendations });
    }
    catch (error) {
        console.error('Error fetching place recommendations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
    }
});
// Update an existing recommendation
router.put('/:annotationId', requireAuth, async (req, res) => {
    try {
        const { annotationId } = req.params;
        const updates = req.body;
        const userId = req.user.id;
        const success = await (0, annotations_1.updateAnnotation)(parseInt(annotationId), updates);
        res.json({ success, message: success ? 'Recommendation updated successfully' : 'Failed to update recommendation' });
    }
    catch (error) {
        console.error('Error updating recommendation:', error);
        res.status(500).json({ success: false, error: 'Failed to update recommendation' });
    }
});
// Delete a recommendation
router.delete('/:annotationId', requireAuth, async (req, res) => {
    try {
        const { annotationId } = req.params;
        const userId = req.user.id;
        const success = await (0, annotations_1.deleteAnnotation)(parseInt(annotationId), userId);
        res.json({ success, message: success ? 'Recommendation deleted successfully' : 'Failed to delete recommendation' });
    }
    catch (error) {
        console.error('Error deleting recommendation:', error);
        res.status(500).json({ success: false, error: 'Failed to delete recommendation' });
    }
});
// Get all places that have reviews/annotations
router.get('/places/reviewed', async (req, res) => {
    try {
        const { visibility = 'all', limit = 100, offset = 0 } = req.query;
        const places = await (0, places_2.getPlacesWithReviews)(visibility, parseInt(limit), parseInt(offset));
        res.json({ success: true, data: places });
    }
    catch (error) {
        console.error('Error fetching reviewed places:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch places' });
    }
});
// Semantic search for places and recommendations
router.post('/search', async (req, res) => {
    try {
        const { query, limit = 10, threshold = 0.7 } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query is required and must be a string'
            });
        }
        // Generate embedding for the search query
        const queryEmbedding = await (0, embeddings_1.generateEmbedding)(query);
        // Search for similar annotations using vector similarity
        const searchQuery = `
      WITH similar_annotations AS (
        SELECT 
          a.id as annotation_id,
          a.place_id,
          a.notes,
          a.rating,
          a.visit_date,
          a.labels,
          a.went_with,
          a.metadata,
          a.created_at,
          u.display_name as user_name,
          1 - (a.embedding <=> $1::vector) as similarity
        FROM annotations a
        JOIN users u ON a.user_id = u.id
        WHERE a.visibility = 'public'
          AND a.embedding IS NOT NULL
          AND 1 - (a.embedding <=> $1::vector) > $2
        ORDER BY similarity DESC
        LIMIT $3
      ),
      place_aggregates AS (
        SELECT 
          p.id as place_id,
          p.name as place_name,
          p.address as place_address,
          p.lat as place_lat,
          p.lng as place_lng,
          p.google_place_id,
          array_agg(
            json_build_object(
              'annotation_id', sa.annotation_id,
              'user_name', sa.user_name,
              'notes', sa.notes,
              'rating', sa.rating,
              'visit_date', sa.visit_date,
              'labels', sa.labels,
              'went_with', sa.went_with,
              'metadata', sa.metadata,
              'similarity', sa.similarity,
              'created_at', sa.created_at
            ) ORDER BY sa.similarity DESC
          ) as recommendations,
          AVG(sa.similarity) as average_similarity,
          COUNT(*) as total_recommendations
        FROM similar_annotations sa
        JOIN places p ON sa.place_id = p.id
        GROUP BY p.id, p.name, p.address, p.lat, p.lng, p.google_place_id
        ORDER BY average_similarity DESC
      )
      SELECT 
        place_id,
        place_name,
        place_address,
        place_lat,
        place_lng,
        google_place_id,
        recommendations,
        average_similarity,
        total_recommendations
      FROM place_aggregates
      ORDER BY average_similarity DESC
      LIMIT $3;
    `;
        const result = await db_1.default.query(searchQuery, [queryEmbedding, threshold, limit]);
        // Generate a summary of the search results
        const totalPlaces = result.rows.length;
        const totalRecommendations = result.rows.reduce((sum, row) => sum + row.total_recommendations, 0);
        const summary = totalPlaces > 0
            ? `Found ${totalPlaces} places with ${totalRecommendations} relevant recommendations`
            : 'No relevant recommendations found';
        const response = {
            query,
            summary,
            results: result.rows,
            total_places: totalPlaces,
            total_recommendations: totalRecommendations,
            search_metadata: {
                threshold,
                limit,
                query_processed: true
            }
        };
        res.json({ success: true, data: response });
    }
    catch (error) {
        console.error('Error performing semantic search:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform semantic search'
        });
    }
});
exports.default = router;
