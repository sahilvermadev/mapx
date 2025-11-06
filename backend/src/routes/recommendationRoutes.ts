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
import { generateAISummary, type SearchContext, type SummaryMode } from '../utils/aiSummaries';
import { embeddingQueue } from '../services/embeddingQueue';
import { SEARCH_CONFIG } from '../config/searchConfig';
import pool from '../db'; // Import pool directly from db.ts
import type { RecommendationSearchResult } from '../db/recommendations';
import { recommendationService } from '../services/recommendationService';
import { getPlaceDetails, deriveAdmin, slugifyCity } from '../services/placesClient';
import { handleError } from '../utils/errorHandling';
import { extractMentionUserIds, savePostMentions } from '../db/mentions';
import { getUserIdFromRequest } from '../middleware/auth';

import { upsertService } from '../services/serviceDeduplication';
import { extractServiceType } from '../utils/nameSimilarity';

const router = express.Router();

// Lightweight in-memory caches (process-local)
// Embedding cache: 60s TTL, keyed by trimmed query
// Summary cache: 10m TTL, keyed by query + ordered result ids
// @ts-ignore
const _g: any = global as any;
if (!_g._mxEmbeddingCache) _g._mxEmbeddingCache = new Map<string, { vec: number[]; ts: number }>();
if (!_g._mxSummaryCache) _g._mxSummaryCache = new Map<string, { text: string; ts: number }>();
const EMBED_TTL_MS = 60_000;
const SUMMARY_TTL_MS = 10 * 60_000;

/**
 * Filter search results to only include semantically relevant recommendations
 * Uses keyword-based filtering and AI validation to ensure relevance
 */
async function filterRelevantResults(
  recommendations: any[], 
  query: string
): Promise<any[]> {
  if (recommendations.length === 0) {
    return [];
  }

  
  // First pass: keyword-based filtering
  const queryLower = query.toLowerCase();
  const relevantKeywords = extractRelevantKeywords(queryLower);
  
  const keywordFiltered = recommendations.filter(rec => {
    const description = (rec.description || '').toLowerCase();
    const title = (rec.title || '').toLowerCase();
    const contentData = rec.content_data || {};
    const serviceType = (contentData.service_type || '').toLowerCase();
    const placeName = (contentData.place_name || '').toLowerCase();
    const serviceName = (contentData.service_name || '').toLowerCase();
    
    // Also check the raw content_data for any relevant fields
    const allContentText = Object.values(contentData).join(' ').toLowerCase();
    
    // Check if any relevant keyword appears in the recommendation
    const hasRelevantKeyword = relevantKeywords.some(keyword => 
      description.includes(keyword) || 
      title.includes(keyword) || 
      serviceType.includes(keyword) ||
      placeName.includes(keyword) ||
      serviceName.includes(keyword) ||
      allContentText.includes(keyword)
    );
    
    return hasRelevantKeyword;
  });
  
  
  // If we have very few results after keyword filtering, be more lenient
  if (keywordFiltered.length === 0 && recommendations.length > 0) {
    // Return only high-similarity results (above 0.85) as a fallback
    const highSimilarityResults = recommendations.filter(rec => rec.similarity > 0.85);
    
    // If still no results, return top 3 as fallback
    if (highSimilarityResults.length === 0) {
      return recommendations.slice(0, 3);
    }
    
    return highSimilarityResults;
  }
  
  return keywordFiltered;
}

/**
 * Extract relevant keywords from a search query
 */
function extractRelevantKeywords(query: string): string[] {
  const keywords = [];
  
  // Common service mappings with comprehensive keyword sets
  const serviceMappings: Record<string, string[]> = {
    'painter': ['painter', 'painting', 'paint', 'interior', 'exterior', 'wall', 'color', 'brush', 'coating', 'finish', 'mural', 'decorative'],
    'electrician': ['electrician', 'electrical', 'wiring', 'electric', 'power', 'outlet', 'circuit', 'switch', 'light', 'installation'],
    'plumber': ['plumber', 'plumbing', 'pipe', 'water', 'drain', 'toilet', 'faucet', 'leak', 'repair', 'installation'],
    'carpenter': ['carpenter', 'carpentry', 'wood', 'furniture', 'cabinet', 'shelf', 'door', 'window', 'frame'],
    'contractor': ['contractor', 'construction', 'renovation', 'remodel', 'building', 'repair', 'maintenance'],
    'cleaner': ['cleaner', 'cleaning', 'housekeeping', 'maid', 'janitor', 'sanitize', 'disinfect'],
    'gardener': ['gardener', 'gardening', 'landscape', 'lawn', 'plant', 'tree', 'flower', 'yard', 'garden'],
    'mechanic': ['mechanic', 'auto', 'car', 'vehicle', 'repair', 'engine', 'brake', 'tire', 'maintenance'],
    'chef': ['chef', 'cooking', 'catering', 'food', 'kitchen', 'restaurant', 'meal', 'recipe'],
    'photographer': ['photographer', 'photography', 'photo', 'camera', 'wedding', 'event', 'portrait', 'studio']
  };
  
  // Find matching service types
  for (const [service, terms] of Object.entries(serviceMappings)) {
    if (query.includes(service)) {
      keywords.push(...terms);
    }
  }
  
  // Add the original query words
  const words = query.split(/\s+/).filter(word => word.length > 2);
  keywords.push(...words);
  
  // Add common service-related terms that might appear in descriptions
  const commonServiceTerms = ['service', 'professional', 'expert', 'specialist', 'technician', 'worker', 'provider'];
  keywords.push(...commonServiceTerms);
  
  // Add variations of common words
  const queryWords = query.toLowerCase().split(/\s+/);
  queryWords.forEach(word => {
    if (word.length > 3) {
      // Add plural/singular variations
      if (word.endsWith('s')) {
        keywords.push(word.slice(0, -1)); // painter -> paint
      } else {
        keywords.push(word + 's'); // paint -> paints
      }
    }
  });
  
  return [...new Set(keywords)]; // Remove duplicates
}


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
    
    let placeId: number | undefined;
    let serviceId: number | undefined;
    let serviceDeduplication: any = undefined;
    
    // Step 1: Handle place data (only for place-type recommendations)
    if (finalContentType === 'place' && (place_name || google_place_id)) {
      let enrichedName = place_name || 'Unnamed Place';
      let enrichedAddress = place_address;
      let enrichedLat = place_lat;
      let enrichedLng = place_lng;
      let city_name: string | undefined;
      let city_slug: string | undefined;
      let admin1_name: string | undefined;
      let country_code: string | undefined;
      let primary_type: string | undefined;
      let types: string[] | undefined;
      let category_name = place_category;

      if (google_place_id) {
        try {
          const { getPlaceDetails, normalizeFromPlaceDetails } = await import('../services/placesClient');
          console.log('[routes/save] Fetching Place Details for', google_place_id, {
            usingKey: Boolean(process.env.PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)
          });
          const details = await getPlaceDetails(google_place_id);
          const normalized = normalizeFromPlaceDetails(details, {
            name: enrichedName,
            address: enrichedAddress,
            lat: enrichedLat,
            lng: enrichedLng,
            category_name,
          });
          if (normalized) {
            enrichedName = normalized.name || enrichedName;
            enrichedAddress = normalized.address || enrichedAddress;
            enrichedLat = normalized.lat ?? enrichedLat;
            enrichedLng = normalized.lng ?? enrichedLng;
            city_name = normalized.city_name;
            city_slug = normalized.city_slug;
            admin1_name = normalized.admin1_name;
            country_code = normalized.country_code;
            primary_type = normalized.primary_type;
            types = normalized.types;
            category_name = normalized.category_name;
            console.log('[routes/save] Derived', { city_name, city_slug, admin1_name, country_code, primary_type, category_name });
          } else {
            console.warn('[routes/save] Place Details returned null for', google_place_id);
          }
        } catch (e) {
          console.warn('[routes/save] Place Details enrichment failed:', (e as Error).message);
        }
      }

      const placePayload = {
        google_place_id,
        name: enrichedName,
        address: enrichedAddress,
        category_name,
        lat: enrichedLat,
        lng: enrichedLng,
        city_name,
        city_slug,
        admin1_name,
        country_code,
        primary_type,
        types,
        metadata: place_metadata
      } as const;
      console.log('[routes/save] upsertPlace payload', { ...placePayload, metadata: undefined });
      placeId = await upsertPlace({ ...placePayload });
    }
    
    // Step 1.5: Handle service data (only for service-type recommendations)
    if (finalContentType === 'service') {
      const cd = content_data || {};
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[recommendations/save] incoming content_data.location:', {
            city_name: cd?.location?.city_name || cd?.city_name,
            city_slug: cd?.location?.city_slug || cd?.city_slug,
            admin1_name: cd?.location?.admin1_name || cd?.admin1_name,
            country_code: cd?.location?.country_code || cd?.country_code,
          });
        }
      } catch {}
      const toSlug = (s?: string) => (typeof s === 'string' && s.trim().length > 0 ? s.trim().toLowerCase().replace(/\s+/g, '-') : undefined);
      let normalizedCityName: string | undefined = cd.city_name || cd?.location?.city_name || cd.location_name || cd?.place_city_name;
      let normalizedCitySlug: string | undefined = cd.city_slug || cd?.location?.city_slug || toSlug(normalizedCityName);
      let normalizedAdmin1: string | undefined = cd.admin1_name || cd?.location?.admin1_name || cd.location_admin1_name;
      let normalizedCountry: string | undefined = cd.country_code || cd?.location?.country_code || cd.location_country_code;

      // Fallback to Google Place Details (like we do for places) when we have a place_id
      try {
        const googlePlaceId = cd.google_place_id || cd.location_google_place_id || google_place_id;
        if (googlePlaceId && (!normalizedCityName || !normalizedCountry)) {
          const { getPlaceDetails, deriveAdmin, slugifyCity } = await import('../services/placesClient');
          if (process.env.NODE_ENV !== 'production') {
            console.log('[recommendations/save] (service) Fetching Place Details for', googlePlaceId, {
              usingKey: Boolean(process.env.PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)
            });
          }
          const details = await getPlaceDetails(googlePlaceId);
          if (details) {
            const admin = deriveAdmin(details.addressComponents);
            normalizedCityName = normalizedCityName || admin.city;
            normalizedCitySlug = normalizedCitySlug || slugifyCity(admin.city);
            normalizedAdmin1 = normalizedAdmin1 || admin.admin1;
            normalizedCountry = (normalizedCountry || admin.countryCode);
            if (process.env.NODE_ENV !== 'production') {
              console.log('[recommendations/save] (service) Derived from Place Details', {
                normalizedCityName, normalizedCitySlug, normalizedAdmin1, normalizedCountry
              });
            }
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[recommendations/save] (service) place-details fallback failed:', (e as Error).message);
        }
      }
      const derivedServiceName = service_name || title || cd.service_name || cd.place_name || 'Unnamed Service';
      const { phone: normPhone, email: normEmail } = normalizeContactInfo(cd.contact_info, description);
      const derivedPhone = service_phone || cd.service_phone || normPhone;
      const derivedEmail = service_email || cd.service_email || normEmail;
      const derivedBusinessName = service_business_name || cd.business_name;
      const derivedAddress = service_address || place_address || cd.service_address || cd.address;
      const derivedWebsite = service_website || cd.service_website || cd.website;
      const derivedServiceType = service_type || cd.service_type || cd.category;
      const combinedMetadata = { ...(service_metadata || {}), ...cd } as Record<string, any>;
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
        // normalized location fields for city filtering (prefer values from composer payload)
        city_name: normalizedCityName,
        city_slug: normalizedCitySlug,
        admin1_name: normalizedAdmin1,
        country_code: normalizedCountry,
        metadata: combinedMetadata
      };
      if (process.env.NODE_ENV !== 'production') {
        console.log('[recommendations/save] final serviceData to upsert:', serviceData);
      }

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

    const { query, limit = SEARCH_CONFIG.SEMANTIC_SEARCH.LIMIT, threshold = SEARCH_CONFIG.SEMANTIC_SEARCH.THRESHOLD, groupIds, content_type, noSummary } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    console.log('🔍 Semantic search query:', query);
    console.log('🔍 Search parameters:', { limit, threshold, groupIds, content_type });

    // Timings
    const t0 = Date.now();

    // Generate embedding for the search query
    let searchEmbedding: number[];
    try {
      const qKey = query.trim();
      const cached = (global as any)._mxEmbeddingCache.get(qKey) as { vec: number[]; ts: number } | undefined;
      const now = Date.now();
      if (cached && now - cached.ts < EMBED_TTL_MS) {
        console.log('⚡ Using cached search embedding');
        searchEmbedding = cached.vec;
      } else {
        console.log('🔍 Generating search embedding...');
        searchEmbedding = await generateSearchEmbedding(qKey);
        console.log('✅ Generated search embedding, length:', searchEmbedding.length);
        (global as any)._mxEmbeddingCache.set(qKey, { vec: searchEmbedding, ts: now });
        if ((global as any)._mxEmbeddingCache.size > 100) {
          const firstKey = (global as any)._mxEmbeddingCache.keys().next().value;
          (global as any)._mxEmbeddingCache.delete(firstKey);
        }
      }
    } catch (error) {
      console.error('❌ Failed to generate search embedding:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to process search query',
        error: 'Embedding generation failed'
      });
    }

    // Search for similar recommendations
    // Check if there are any recommendations in the database
    const totalRecsResult = await pool.query('SELECT COUNT(*) as count FROM recommendations WHERE embedding IS NOT NULL');
    
    // Check if user has any followed users
    const followedUsersResult = await pool.query('SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1', [currentUserId]);
    const similarRecommendations = await searchRecommendationsBySimilarity(
      searchEmbedding,
      limit,
      threshold,
      groupIds,
      currentUserId,
      content_type
    );
    

    // Use the similar recommendations for AI summary generation
    const relevantRecommendations = similarRecommendations;

    // Also fetch top matching questions and answers (pgvector ANN)
    const qnaLimit = Math.max(5, Math.min(20, Math.floor((limit as number) / 2)));
    const qna = await (async () => {
      const client = await pool.connect();
      try {
        const vec = `[${searchEmbedding.join(',')}]`;
        const followSql = `user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $1)`;

        const questionsSql = `
          SELECT id, 'question' AS type, 1 - (embedding <=> $2::vector) AS score, text, user_id, created_at
          FROM questions
          WHERE embedding IS NOT NULL
            AND ${followSql}
          ORDER BY embedding <-> $2::vector
          LIMIT $3`;
        const qRes = await client.query(questionsSql, [currentUserId, vec, qnaLimit]);

        const answersSql = `
          SELECT id, 'answer' AS type, 1 - (embedding <=> $2::vector) AS score, description AS text, user_id, question_id, id AS recommendation_id, created_at
          FROM recommendations
          WHERE embedding IS NOT NULL
            AND question_id IS NOT NULL
            AND ${followSql}
          ORDER BY embedding <-> $2::vector
          LIMIT $3`;
        const aRes = await client.query(answersSql, [currentUserId, vec, qnaLimit]);

        return { questions: qRes.rows, answers: aRes.rows };
      } finally {
        client.release();
      }
    })();

    // Get detailed information for each recommendation
    const searchResults = await Promise.all(
      relevantRecommendations.map(async (recommendation) => {
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
    
    searchResults.forEach((result, index) => {
      
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
      
      console.log(`🔍 Created group key: "${groupKey}" for result ${index + 1}`);
      
      if (!groupedResults.has(groupKey)) {
        groupedResults.set(groupKey, groupInfo);
        console.log(`🔍 Created new group: ${groupKey}`);
      } else {
        console.log(`🔍 Adding to existing group: ${groupKey}`);
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
      const oldAvg = group.average_similarity;
      group.average_similarity = (
        (group.average_similarity * (group.total_recommendations - 1) + result.similarity) / 
        group.total_recommendations
      );
      
      // 🔍 DEBUG: Log grouping calculation
      console.log(`🔍 [GROUPING DEBUG] Updated group ${groupKey}:`, {
        old_average: oldAvg,
        new_average: group.average_similarity,
        match_percentage: Math.round(group.average_similarity * 100),
        total_recommendations: group.total_recommendations,
        added_similarity: result.similarity,
        added_match_percentage: Math.round(result.similarity * 100)
      });
    });

    // Convert to array and sort by average similarity
    const finalResults = Array.from(groupedResults.values())
      .sort((a, b) => b.average_similarity - a.average_similarity)
      .slice(0, limit);

    const t4 = Date.now();
    

    // Generate AI-powered summary based on the search results (optional)
    let summary = '';
    if (!noSummary) {
      try {
        // Build cache key from query + ordered recommendation ids per group
        const resultKey = finalResults
          .map(r => (r.recommendations || []).map((rec: any) => rec.recommendation_id).join(','))
          .join('|');
        const sKey = `${query.trim()}::${resultKey}`;
        const cachedSummary = (global as any)._mxSummaryCache.get(sKey) as { text: string; ts: number } | undefined;
        const nowS = Date.now();
        if (cachedSummary && nowS - cachedSummary.ts < SUMMARY_TTL_MS) {
          console.log('⚡ Using cached AI summary');
          summary = cachedSummary.text;
        } else {
          const searchContext: SearchContext = {
            query: query.trim(),
            results: finalResults,
            total_places: finalResults.filter(r => r.type === 'place').length,
            total_recommendations: searchResults.length
          };
          const s0 = Date.now();
          summary = await generateAISummary(searchContext, 'detailed');
          const s1 = Date.now();
          console.log(`✅ AI Summary generated successfully in ${s1 - s0}ms, length:`, summary.length);
          console.log('✅ AI Summary preview:', summary.substring(0, 200) + '...');
          (global as any)._mxSummaryCache.set(sKey, { text: summary, ts: nowS });
          if ((global as any)._mxSummaryCache.size > 100) {
            const firstKey = (global as any)._mxSummaryCache.keys().next().value;
            (global as any)._mxSummaryCache.delete(firstKey);
          }
        }
      } catch (error) {
        console.error('❌ Failed to generate AI summary, using fallback:', error);
        // Fallback simple summary
        if (finalResults.length === 0) {
          summary = `I couldn't find any relevant recommendations for "${query.trim()}" in your network.`;
        }
      }
    }

    res.json({
      success: true,
      data: {
        query: query.trim(),
        summary,
        results: finalResults,
        qna,
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