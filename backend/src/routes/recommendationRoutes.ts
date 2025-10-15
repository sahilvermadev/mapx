import express from 'express';
import { upsertPlace, getPlaceByGoogleId, getPlacesWithReviews } from '../db/places';
import { 
  insertRecommendation, 
  getRecommendationsByUserId, 
  getRecommendationsByPlaceId, 
  getNetworkAverageRatingForPlace,
  getRecommendationById,
  getRecommendationWithSocialData,
  updateRecommendation, 
  deleteRecommendation, 
  searchRecommendationsBySimilarity,
  regenerateAllRecommendationEmbeddings
} from '../db/recommendations';
import { generatePlaceEmbedding, generateSearchEmbedding } from '../utils/embeddings';
import { generateAISummary, type SearchContext } from '../utils/aiSummaries';
import { embeddingQueue } from '../services/embeddingQueue';
import pool from '../db'; // Import pool directly from db.ts
import type { RecommendationSearchResult } from '../db/recommendations';
import { extractMentionUserIds, savePostMentions } from '../db/mentions';
import { getUserIdFromRequest } from '../middleware/auth';

import { upsertService } from '../services/serviceDeduplication';
import { extractServiceType } from '../utils/nameSimilarity';

const router = express.Router();


// Helpers
function normalizeContactInfo(raw: any, description?: string): { phone?: string; email?: string } {
  // Accept string or { phone, email }
  let phone: string | undefined;
  let email: string | undefined;

    if (raw && typeof raw === 'object') {
    if (raw.phone && typeof raw.phone === 'string') {
      const digits = raw.phone.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 15) phone = digits;
    }
    if (raw.email && typeof raw.email === 'string' && /@/.test(raw.email)) {
      email = raw.email.toLowerCase().trim();
    }
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) phone = digits;
    if (!phone && /@/.test(trimmed)) email = trimmed.toLowerCase();
  }

  // Fallback: try description for a phone-like number
  if (!phone && typeof description === 'string') {
    const m = description.replace(/\s+/g, '').match(/\+?\d{10,15}/);
    if (m) phone = m[0].replace(/\D/g, '');
  }

  return { phone, email };
}


// Interface for the recommendation request
interface SaveRecommendationRequest {
  // Content classification
  content_type?: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  
  // Place data (optional, only for place-type recommendations)
  google_place_id?: string;
  place_name?: string;
  place_address?: string;
  place_lat?: number;
  place_lng?: number;
  place_metadata?: Record<string, any>;
  place_category?: string;
  
  // Service data (optional, only for service-type recommendations)
  service_name?: string;
  service_phone?: string;
  service_email?: string;
  service_type?: string;
  service_business_name?: string;
  service_address?: string;
  service_website?: string;
  service_metadata?: Record<string, any>;
  
  // Recommendation data
  title?: string;
  description?: string;
  content_data?: Record<string, any>; // Type-specific data
  labels?: string[];
  metadata?: Record<string, any>;
  rating?: number;
  visibility?: 'friends' | 'public';
  
  // User data (from JWT authentication)
  user_id: string;
}

// Interface for the response
interface SaveRecommendationResponse {
  success: boolean;
  place_id?: number;
  service_id?: number;
  recommendation_id: number;
  message: string;
  service_deduplication?: {
    action: 'created' | 'updated' | 'merged';
    confidence: number;
    reasoning: string;
  };
}

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

    const place = await getPlaceByGoogleId(googlePlaceId);
    
    if (!place) {
      // Graceful not-found: return 200 with null data to avoid 404 noise in console
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Place not found in database'
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

  } catch (error) {
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
 * Save a recommendation using the new unified recommendations table
 */
router.post('/save', async (req, res) => {
  try {
    console.log('[recommendations/save] incoming payload keys:', Object.keys(req.body || {}));
    const {
      content_type,
      google_place_id,
      place_name,
      place_address,
      place_lat,
      place_lng,
      place_metadata,
      place_category,
      service_name,
      service_phone,
      service_email,
      service_type,
      service_business_name,
      service_address,
      service_website,
      service_metadata,
      title,
      description,
      content_data,
      labels,
      metadata,
      rating,
      visibility,
      user_id
    }: SaveRecommendationRequest = req.body;

    // Validate required fields
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
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

    // Determine content type using client hint or inferred from provided fields
    let finalContentType: 'place' | 'service' | 'tip' | 'contact' | 'unclear' = content_type || 'unclear';
    if (finalContentType === 'unclear' || !finalContentType) {
      // Infer from payload: if service identifiers exist, treat as service
      if (service_name || service_phone || service_email || service_type || service_business_name) {
        finalContentType = 'service';
      } else if (google_place_id || place_name || (typeof place_lat === 'number' && typeof place_lng === 'number')) {
        finalContentType = 'place';
      } else {
        finalContentType = 'place'; // default
      }
    }
    console.log('[recommendations/save] inferred content_type:', finalContentType);
    
    let placeId: number | undefined;
    let serviceId: number | undefined;
    let serviceDeduplication: any = undefined;
    
    // Step 1: Handle place data (only for place-type recommendations)
    if (finalContentType === 'place' && (place_name || google_place_id)) {
      console.log('Upserting place:', place_name || 'Unnamed Place');
      placeId = await upsertPlace({
        google_place_id,
        name: place_name || 'Unnamed Place',
        address: place_address,
        category_name: place_category,
        lat: place_lat,
        lng: place_lng,
        metadata: place_metadata
      });
    }
    
    // Step 1.5: Handle service data (only for service-type recommendations)
    if (finalContentType === 'service') {
      const cd = content_data || {};
      const derivedServiceName = service_name || title || cd.service_name || cd.place_name || 'Unnamed Service';
      const { phone: normPhone, email: normEmail } = normalizeContactInfo(cd.contact_info, description);
      const derivedPhone = service_phone || cd.service_phone || normPhone;
      const derivedEmail = service_email || cd.service_email || normEmail;
      const derivedBusinessName = service_business_name || cd.business_name;
      const derivedAddress = service_address || place_address || cd.service_address || cd.address;
      const derivedWebsite = service_website || cd.service_website || cd.website;
      const derivedServiceType = service_type || cd.service_type || cd.category;
      const combinedMetadata = { ...(service_metadata || {}), ...cd } as Record<string, any>;
      console.log('[recommendations/save] service derived fields:', {
        derivedServiceName,
        derivedPhone,
        derivedEmail,
        derivedBusinessName,
        derivedAddress,
        derivedWebsite,
        derivedServiceType
      });
      // Services table requires at least one identifier (phone or email)
      if (derivedPhone || derivedEmail) {
        console.log('Upserting service:', derivedServiceName);

        // Helper: attempt type from specialities/description text if name/business didn't yield one
        const inferTypeFromFreeText = (...texts: Array<string | string[] | undefined>) => {
          const flattened = texts
            .flatMap(t => Array.isArray(t) ? t : [t])
            .filter(Boolean)
            .map(t => String(t));
          if (flattened.length === 0) return null;
          const joined = flattened.join(' ');
          return extractServiceType(joined, '');
        };

        let extractedServiceType = derivedServiceType || extractServiceType(derivedServiceName || '', derivedBusinessName);
        if (!extractedServiceType) {
          extractedServiceType = inferTypeFromFreeText(cd?.specialities, cd?.category, description, derivedServiceName);
        }

        console.log('[recommendations/save] service type resolution:', {
          inputName: derivedServiceName,
          inputBusinessName: derivedBusinessName,
          payloadServiceType: derivedServiceType,
          extractedServiceType,
          inferredFrom: (!derivedServiceType && !extractServiceType(derivedServiceName || '', derivedBusinessName)) ? 'free_text' : 'name_business'
        });

        const serviceData = {
          name: derivedServiceName || 'Unnamed Service',
          phone_number: derivedPhone,
          email: derivedEmail,
          service_type: extractedServiceType || undefined,
          business_name: derivedBusinessName,
          address: derivedAddress,
          website: derivedWebsite,
          metadata: combinedMetadata
        };
        console.log('[recommendations/save] final serviceData to upsert:', serviceData);

        let upsertResult;
        try {
          upsertResult = await upsertService(serviceData);
        } catch (e) {
          console.error('[recommendations/save] upsertService threw error:', e);
          throw e;
        }
        serviceId = upsertResult.serviceId;
        serviceDeduplication = {
          action: upsertResult.action,
          confidence: upsertResult.confidence,
          reasoning: upsertResult.reasoning
        };

        console.log('Service deduplication result:', upsertResult);
      } else {
        console.log('[recommendations/save] Skipping service upsert: no phone/email identifier present. Raw input:', {
          service_name,
          service_phone,
          service_email,
          content_data_contact: cd?.contact_info,
          content_data_phone: cd?.service_phone,
          content_data_email: cd?.service_email
        });
      }
    }

    // Step 2: Prepare content data based on type
    let finalContentData = content_data || {};

    // Normalize price info coming from clients (frontend uses priceLevel: 1..3)
    // We persist both numeric and human-friendly variants for easier querying and embedding
    const normalizePrice = (raw: any) => {
      const level = typeof raw === 'number' ? raw : (raw && typeof raw.level === 'number' ? raw.level : finalContentData.priceLevel);
      const priceLevel = Number(level) >= 1 && Number(level) <= 4 ? Number(level) : undefined;
      // Support 1..4 for future expansion; current UI uses 1..3
      const labels: Record<number, string> = { 1: 'budget', 2: 'moderate', 3: 'higher-end', 4: 'luxury' };
      const symbols: Record<number, string> = { 1: '₹', 2: '₹₹', 3: '₹₹₹', 4: '₹₹₹₹' };
      if (!priceLevel) return undefined as
        | undefined;
      return {
        price_level: priceLevel,
        price_label: labels[priceLevel] || 'unknown',
        price_text: symbols[priceLevel] || ''
      };
    };

    const priceInfo = normalizePrice((content_data as any)?.priceLevel);
    
    if (finalContentType === 'place' && placeId) {
      // For place recommendations, store place-specific data
      finalContentData = {
        ...finalContentData,
        place_name: place_name || 'Unnamed Place',
        address: place_address,
        coordinates: place_lat && place_lng ? { lat: place_lat, lng: place_lng } : undefined,
        category: place_category,
        ...place_metadata,
        ...(priceInfo ? priceInfo : {})
      };
      // Canonical display address for UI
      if (place_address) {
        (finalContentData as any).display_address = place_address;
      }
    } else if (finalContentType === 'service' && serviceId) {
      // For service recommendations, store service-specific data
      finalContentData = {
        ...finalContentData,
        service_name: service_name || 'Unnamed Service',
        service_phone: service_phone,
        service_email: service_email,
        service_type: service_type,
        service_business_name: service_business_name,
        service_address: service_address,
        service_website: service_website,
        ...service_metadata,
        ...(priceInfo ? priceInfo : {})
      };
      // Canonical display address for UI
      const canonicalServiceAddress = service_address || (finalContentData as any).address || (finalContentData as any).service_address;
      if (canonicalServiceAddress) {
        (finalContentData as any).display_address = canonicalServiceAddress;
      }
    }

    // Step 3: Insert the recommendation with auto-generated embedding
    console.log('Inserting recommendation:', {
      content_type: finalContentType,
      place_id: placeId,
      service_id: serviceId,
      user_id
    });
    
    console.log('[recommendations/save] inserting recommendation with:', {
      user_id,
      content_type: finalContentType,
      place_id: placeId,
      service_id: serviceId,
      title: title || place_name || service_name
    });
    const recommendationId = await insertRecommendation({
      user_id,
      content_type: finalContentType,
      place_id: placeId,
      service_id: serviceId,
      title: title || place_name || service_name,
      description,
      content_data: finalContentData,
      rating,
      visibility: visibility || 'friends',
      labels,
      metadata,
      auto_generate_embedding: true // Enable embedding generation for semantic search
    });

    // Step 4: Save mentions referenced in the description, if any
    try {
      const mentionedUserIds = extractMentionUserIds(description);
      if (mentionedUserIds.length > 0) {
        await savePostMentions(recommendationId, mentionedUserIds, user_id, description);
      }
    } catch (e) {
      console.error('Failed to process/save post mentions', e);
      // Do not fail the request if mentions saving fails
    }

    const response: SaveRecommendationResponse = {
      success: true,
      place_id: placeId,
      service_id: serviceId,
      recommendation_id: recommendationId,
      message: 'Recommendation saved successfully',
      service_deduplication: serviceDeduplication
    };

    console.log('Recommendation saved successfully:', {
      recommendation_id: recommendationId,
      place_id: placeId,
      service_id: serviceId,
      content_type: finalContentType,
      user_id,
      service_deduplication: serviceDeduplication
    });

    // Return response in the format expected by the frontend API client
    res.status(201).json({
      success: true,
      data: response,
      message: 'Recommendation saved successfully'
    });

  } catch (error) {
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
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate user ID format (should be UUID)
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required'
      });
    }

    // Get user's recommendations with pagination
    const recommendations = await getRecommendationsByUserId(userId, limit, offset);

    // Transform recommendations to include place information where applicable
    const transformedRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => {
        let placeInfo = {};
        
        // Get place information if this is a place-type recommendation
        if (recommendation.place_id) {
          const placeQuery = await pool.query(
            'SELECT name, address, lat, lng FROM places WHERE id = $1',
            [recommendation.place_id]
          );
          const place = placeQuery.rows[0] || {};
          placeInfo = {
            place_name: place.name || 'Unknown Place',
            place_address: place.address,
            place_lat: place.lat,
            place_lng: place.lng
          };
        }

        return {
          id: recommendation.id,
          content_type: recommendation.content_type,
          title: recommendation.title,
          description: recommendation.description,
          content_data: recommendation.content_data,
          rating: recommendation.rating,
          visibility: recommendation.visibility,
          labels: recommendation.labels,
          metadata: recommendation.metadata,
          created_at: recommendation.created_at,
          updated_at: recommendation.updated_at,
          ...placeInfo
        };
      })
    );

    res.json({
      success: true,
      data: transformedRecommendations,
      pagination: {
        limit,
        offset,
        total: transformedRecommendations.length,
        hasMore: transformedRecommendations.length === limit
      },
      message: 'User recommendations retrieved successfully'
    });

  } catch (error) {
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
    const currentUserId = (req as any).user.id;
    const { placeId } = req.params;
    const visibility = req.query.visibility as 'friends' | 'public' | 'all' || 'all';
    const limit = parseInt(req.query.limit as string) || 50;

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
    const recommendations = await getRecommendationsByPlaceId(placeIdNum, visibility, limit, currentUserId);

    // Transform recommendations to include user information
    const transformedRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => {
        // Get user information (you might want to add a join query for better performance)
        const userQuery = await pool.query(
          'SELECT display_name, email, profile_picture_url FROM users WHERE id = $1',
          [recommendation.user_id]
        );
        const user = userQuery.rows[0] || {};

        return {
          id: recommendation.id,
          content_type: recommendation.content_type,
          title: recommendation.title,
          description: recommendation.description,
          content_data: recommendation.content_data,
          user_id: recommendation.user_id,
          user_name: user.display_name || 'Anonymous',
          user_email: user.email,
          user_picture: user.profile_picture_url || null,
          rating: recommendation.rating,
          visibility: recommendation.visibility,
          labels: recommendation.labels,
          metadata: recommendation.metadata,
          created_at: recommendation.created_at,
          updated_at: recommendation.updated_at
        };
      })
    );

    res.json({
      success: true,
      data: transformedRecommendations,
      place_id: placeIdNum,
      visibility,
      total: transformedRecommendations.length,
      message: 'Place recommendations retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching place recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/recommendations/place/:placeId/network-rating
 * Returns consolidated rating using only ratings from the current user's network
 */
router.get('/place/:placeId/network-rating', async (req, res) => {
  try {
    const { placeId } = req.params;
    const placeIdNum = parseInt(placeId);
    if (isNaN(placeIdNum)) {
      return res.status(400).json({ success: false, message: 'Valid place ID is required' });
    }

    // Get current user from JWT
    const userId = getUserIdFromRequest(req);
    // If unauthenticated, return empty rating rather than 401 to avoid disrupting UX
    if (!userId) {
      return res.json({ success: true, data: { average_rating: null, rating_count: 0 } });
    }

    const stats = await getNetworkAverageRatingForPlace(placeIdNum, userId);
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching network rating:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch network rating' });
  }
});

/**
 * GET /api/recommendations/:recommendationId
 * Get a specific recommendation by ID with all social data
 */
router.get('/:recommendationId', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const recommendationIdNum = parseInt(recommendationId);

    if (isNaN(recommendationIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Valid recommendation ID is required'
      });
    }

    // Get current user ID for social data (likes, saves, etc.)
    const currentUserId = getUserIdFromRequest(req);
    
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Fetch recommendation with all social data
    const recommendation = await getRecommendationWithSocialData(recommendationIdNum, currentUserId);
    
    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    res.json({
      success: true,
      data: recommendation,
      message: 'Recommendation retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching recommendation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/recommendations/:recommendationId
 * Update a specific recommendation
 */
router.put('/:recommendationId', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const recommendationIdNum = parseInt(recommendationId);
    const updates = req.body;

    if (isNaN(recommendationIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Valid recommendation ID is required'
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

    // Validate content type if provided
    if (updates.content_type && !['place', 'service', 'tip', 'contact', 'unclear'].includes(updates.content_type)) {
      return res.status(400).json({
        success: false,
        message: 'Content type must be one of: place, service, tip, contact, unclear'
      });
    }

    const success = await updateRecommendation(recommendationIdNum, updates);

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

  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update recommendation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/recommendations/:recommendationId
 * Delete a specific recommendation
 */
router.delete('/:recommendationId', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const recommendationIdNum = parseInt(recommendationId);
    const { user_id } = req.body; // User ID should be provided in request body for authorization

    if (isNaN(recommendationIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Valid recommendation ID is required'
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required for authorization'
      });
    }

    const success = await deleteRecommendation(recommendationIdNum, user_id);

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
 * POST /api/recommendations/regenerate-embeddings
 * Regenerate embeddings for all existing recommendations with enhanced data
 */
router.post('/regenerate-embeddings', async (req, res) => {
  try {
    console.log('Starting embedding regeneration...');
    
    const result = await regenerateAllRecommendationEmbeddings();
    
    res.json({
      success: true,
      data: result,
      message: `Embedding regeneration complete. Success: ${result.success}, Failed: ${result.failed}`
    });
    
  } catch (error) {
    console.error('Error regenerating embeddings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate embeddings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/recommendations/search
 * Semantic search for places and recommendations using embeddings
 */
router.post('/search', async (req, res) => {
  try {
    // Get current user ID for follow filtering
    const currentUserId = getUserIdFromRequest(req);
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { query, limit = 10, threshold = 0.7, groupIds, content_type } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    console.log('Semantic search query:', query);

    // Generate embedding for the search query
    let searchEmbedding: number[];
    try {
      searchEmbedding = await generateSearchEmbedding(query.trim());
      console.log('Generated search embedding');
    } catch (error) {
      console.error('Failed to generate search embedding:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process search query',
        error: 'Embedding generation failed'
      });
    }

    // Search for similar recommendations
    const similarRecommendations = await searchRecommendationsBySimilarity(
      searchEmbedding,
      limit,
      threshold,
      groupIds,
      currentUserId,
      content_type
    );

    console.log(`Found ${similarRecommendations.length} similar recommendations`);

    // Get detailed information for each recommendation
    const searchResults = await Promise.all(
      similarRecommendations.map(async (recommendation) => {
        // Get place information (if applicable)
        let placeInfo = {};
        if (recommendation.place_id) {
          const placeQuery = await pool.query(
            'SELECT name, address, lat, lng, google_place_id FROM places WHERE id = $1',
            [recommendation.place_id]
          );
          const place = placeQuery.rows[0] || {};
          placeInfo = {
            place_id: recommendation.place_id,
            place_name: place.name || 'Unknown Place',
            place_address: place.address,
            place_lat: place.lat,
            place_lng: place.lng,
            google_place_id: place.google_place_id
          };
        }

        // Get service information (if applicable)
        let serviceInfo = {} as any;
        if ((recommendation as any).service_id) {
          const serviceQuery = await pool.query(
            'SELECT id, name, service_type, business_name, address FROM services WHERE id = $1',
            [(recommendation as any).service_id]
          );
          const service = serviceQuery.rows[0] || {};
          serviceInfo = {
            service_id: service.id,
            service_name: service.name || 'Unknown Service',
            service_type: service.service_type || null,
            service_business_name: service.business_name || null,
            service_address: service.address || null
          };
        }

        // Get user information
        const userQuery = await pool.query(
          'SELECT display_name FROM users WHERE id = $1',
          [recommendation.user_id]
        );
        const user = userQuery.rows[0] || {};

        return {
          recommendation_id: recommendation.id,
          content_type: recommendation.content_type,
          title: recommendation.title,
          description: recommendation.description,
          content_data: recommendation.content_data,
          user_name: user.display_name || 'Anonymous',
          rating: recommendation.rating,
          labels: recommendation.labels,
          metadata: recommendation.metadata,
          similarity: recommendation.similarity,
          created_at: recommendation.created_at,
          ...placeInfo,
          ...serviceInfo
        } as any;
      })
    );

    // Group results by place (for place-type recommendations) or by content type
    const groupedResults = new Map();
    searchResults.forEach(result => {
      let groupKey: string;
      let groupInfo: any;
      
      const r: any = result as any;
      if (result.content_type === 'place' && r.place_id) {
        // Group place recommendations by place
        groupKey = `place_${r.place_id}`;
        groupInfo = {
          type: 'place',
          place_id: r.place_id,
          place_name: r.place_name,
          place_address: r.place_address,
          place_lat: r.place_lat,
          place_lng: r.place_lng,
          google_place_id: r.google_place_id,
          recommendations: [],
          average_similarity: 0,
          total_recommendations: 0
        };
      } else if (result.content_type === 'service' && r.service_id) {
        // Group service recommendations by service
        groupKey = `service_${r.service_id}`;
        groupInfo = {
          type: 'service',
          service_id: r.service_id,
          service_name: r.service_name,
          service_type: r.service_type,
          service_business_name: r.service_business_name,
          service_address: r.service_address,
          recommendations: [],
          average_similarity: 0,
          total_recommendations: 0
        };
      } else {
        // Fallback grouping by content type
        groupKey = `type_${result.content_type}`;
        groupInfo = {
          type: 'content_type',
          content_type: result.content_type,
          recommendations: [],
          average_similarity: 0,
          total_recommendations: 0
        };
      }
      
      if (!groupedResults.has(groupKey)) {
        groupedResults.set(groupKey, groupInfo);
      }
      
      const group = groupedResults.get(groupKey);
      group.recommendations.push({
        recommendation_id: result.recommendation_id,
        content_type: result.content_type,
        title: result.title,
        description: result.description,
        content_data: result.content_data,
        user_name: result.user_name,
        rating: result.rating,
        labels: result.labels,
        metadata: result.metadata,
        similarity: result.similarity,
        created_at: result.created_at
      });
      
      group.total_recommendations += 1;
      group.average_similarity = (
        (group.average_similarity * (group.total_recommendations - 1) + result.similarity) / 
        group.total_recommendations
      );
    });

    // Convert to array and sort by average similarity
    const finalResults = Array.from(groupedResults.values())
      .sort((a, b) => b.average_similarity - a.average_similarity)
      .slice(0, limit);

    // Generate AI-powered summary based on the search results
    let summary = '';
    try {
      const searchContext: SearchContext = {
        query: query.trim(),
        results: finalResults,
        total_places: finalResults.filter(r => r.type === 'place').length,
        total_recommendations: searchResults.length
      };
      
      summary = await generateAISummary(searchContext);
      console.log('🤖 AI Summary generated successfully');
    } catch (error) {
      console.error('❌ Failed to generate AI summary, using fallback:', error);
      
      // Fallback to simple summary
      if (finalResults.length === 0) {
        summary = `No relevant recommendations found for your search query. Try using different keywords or being more specific about what you're looking for.`;
      } else {
        const topResult = finalResults[0];
        const topRecommendation = topResult.recommendations[0];
        
        if (topResult.average_similarity > 0.8) {
          const locationInfo = topResult.type === 'place' ? `"${topResult.place_name}"` : `this ${topResult.content_type}`;
          summary = `Based on ${topResult.total_recommendations} recommendation(s), ${locationInfo} seems to match your search. ${topRecommendation.description ? `Users say: "${topRecommendation.description.substring(0, 100)}..."` : ''}`;
        } else if (topResult.average_similarity > 0.6) {
          const locationInfo = topResult.type === 'place' ? `"${topResult.place_name}"` : `this ${topResult.content_type}`;
          summary = `I found some potentially relevant recommendations. ${locationInfo} has ${topResult.total_recommendations} recommendation(s) that might be related to your search.`;
        } else {
          summary = `I found some recommendations that might be related to your search, though the match isn't very strong. Consider refining your query for better results.`;
        }
      }
    }

    res.json({
      success: true,
      data: {
        query: query.trim(),
        summary,
        results: finalResults,
        total_groups: finalResults.length,
        total_recommendations: searchResults.length,
        search_metadata: {
          threshold,
          limit,
          query_processed: true
        }
      },
      message: 'Search completed successfully'
    });

  } catch (error) {
    console.error('Error performing semantic search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform search',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/recommendations/places/reviewed
 * Get all places that have reviews/annotations
 */
router.get('/places/reviewed', async (req, res) => {
  try {
    const currentUserId = (req as any).user.id;
    const visibility = req.query.visibility as 'friends' | 'public' | 'all' || 'all';
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const groupIds = req.query.groupIds ? 
      (req.query.groupIds as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : 
      undefined;

    // Validate visibility parameter
    if (!['friends', 'public', 'all'].includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: 'Visibility must be "friends", "public", or "all"'
      });
    }

    // Get places with reviews
    const placesWithReviews = await getPlacesWithReviews(visibility, limit, offset, groupIds, currentUserId);

    // Transform the data to include review statistics
    const transformedPlaces = placesWithReviews.map(place => ({
      id: place.id,
      google_place_id: place.google_place_id,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      metadata: place.metadata,
      category_name: place.category_name,
      review_count: place.review_count,
      average_rating: place.average_rating,
      latest_review_date: place.latest_review_date,
      created_at: place.created_at,
      updated_at: place.updated_at
    }));

    res.json({
      success: true,
      data: transformedPlaces,
      total: transformedPlaces.length,
      visibility,
      message: 'Reviewed places retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching reviewed places:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviewed places',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get embedding queue status
router.get('/embedding-queue/status', async (req, res) => {
  try {
    const status = embeddingQueue.getStatus();
    
    res.json({
      success: true,
      data: {
        queueLength: status.queueLength,
        processing: status.processing,
        isProcessing: status.isProcessing
      }
    });
  } catch (error) {
    console.error('Error getting embedding queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get embedding queue status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 