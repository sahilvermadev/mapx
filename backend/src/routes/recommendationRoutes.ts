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
  regenerateAllRecommendationEmbeddings
} from '../db/recommendations';
import { generateAISummary, generateAISummaryStream, type SearchContext } from '../utils/aiSummaries';
import { embeddingQueue } from '../services/embeddingQueue';
import { SEARCH_CONFIG } from '../config/searchConfig';
import pool from '../db'; // Import pool directly from db.ts
import { recommendationService } from '../services/recommendationService';
import { getPlaceDetails, deriveAdmin, slugifyCity } from '../services/placesClient';
import { handleError } from '../utils/errorHandling';
import { extractMentionUserIds, savePostMentions } from '../db/mentions';
import { getUserIdFromRequest } from '../middleware/auth';
import Groq from 'groq-sdk';
import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { SEARCH_MY_NETWORK_TOOL, ASK_MY_NETWORK_TOOL, type AskMyNetworkArgs } from '../config/searchTools';
import { executeStructuredSearch, type StructuredSearchArgs, type StructuredSearchResult } from '../services/structuredSearch';

import { upsertService } from '../services/serviceDeduplication';
import { extractServiceType } from '../utils/nameSimilarity';
import { calculatePersonalOverlap } from '../utils/personalOverlap';
import { getPersonalTasteDNA } from '../services/personalDNA';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { LRUCache } from 'lru-cache';
import { executeSearchOrchestration } from '../services/searchOrchestrator';

const router = express.Router();

// LRU cache for AI summaries with TTL and size limits
// Prevents memory leaks by automatically evicting old entries
// @ts-ignore
const _g: any = global as any;
if (!_g._mxSummaryCache) {
  _g._mxSummaryCache = new LRUCache<string, { text: string; followUps: string[]; cardsAllowed: boolean; ts: number }>({
    max: 500, // Maximum 500 cached summaries
    ttl: 10 * 60 * 1000, // 10 minutes TTL
    updateAgeOnGet: false, // Don't reset TTL on access
    updateAgeOnHas: false, // Don't reset TTL on has() check
  });
}
const summaryCache = _g._mxSummaryCache;
const SUMMARY_TTL_MS = 10 * 60_000;

export type FormattedStructuredResult = {
  type: 'place' | 'service';
  place_id?: number;
  place_name?: string | null;
  place_address?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  google_place_id?: string | null;
  service_id?: number;
  service_name?: string | null;
  service_address?: string | null;
  distance_label?: string | null;
  recommendations: Array<{
    recommendation_id: number;
    content_type: 'place' | 'service' | 'unclear';
    title?: string;
    description: string;
    content_data: Record<string, any>;
    user_name: string;
    user_id: string;
    personal_overlap_percent: number;
    rating?: number;
    labels?: string[];
    created_at: Date;
    similarity?: number;
  }>;
  total_recommendations: number;
  average_similarity: number | null;
};

export function formatStructuredResultsForResponse(
  structured: StructuredSearchResult
): FormattedStructuredResult[] {
  const groups = new Map<string, FormattedStructuredResult>();
  
  // Count services vs places
  let serviceCount = 0;
  let placeCount = 0;

  for (const rec of structured.recommendations) {
    const isPlace = Boolean(rec.place_id);
    const isService = Boolean(rec.service_id);
    
    if (isPlace) placeCount++;
    if (isService) serviceCount++;
    
    const key = isPlace
      ? `place:${rec.place_id}`
      : rec.service_id
        ? `service:${rec.service_id}`
        : `service:unknown:${rec.recommendation_id}`;

    const existing = groups.get(key);
    
    // Log service formatting
    if (isService && !existing) {
      console.log(`   🔧 [SERVICE] Formatting service result:`, {
        serviceId: rec.service_id,
        serviceName: rec.service_name,
        recommendationId: rec.recommendation_id,
        contentType: rec.content_type
      });
    }

    const baseRecommendation = {
        recommendation_id: rec.recommendation_id,
        content_type: rec.content_type,
        title: rec.title || rec.place_name || rec.service_name || '',
        description: rec.description,
        content_data: rec.content_data,
        user_name: rec.user_name,
        user_id: rec.user_id,
        personal_overlap_percent: rec.personal_overlap_percent,
        rating: rec.rating,
        labels: rec.labels,
        created_at: rec.created_at,
        similarity: rec.similarity
    };

    if (existing) {
      existing.recommendations.push(baseRecommendation);
      existing.total_recommendations += 1;
      const sim = rec.similarity ?? structured.top_confidence ?? existing.average_similarity ?? 0;
      if (sim != null) {
        existing.average_similarity =
          ((existing.average_similarity || 0) * (existing.total_recommendations - 1) + sim) /
          existing.total_recommendations;
      }
    } else {
      const group: FormattedStructuredResult = {
        type: isPlace ? 'place' : 'service',
        ...(isPlace
          ? {
              place_id: rec.place_id,
              place_name: rec.place_name,
              place_address: rec.place_address,
              place_lat: rec.place_lat,
              place_lng: rec.place_lng,
              google_place_id: rec.place_google_place_id || null
            }
          : {
              service_id: rec.service_id,
              service_name: rec.service_name,
              service_address: rec.service_address
            }),
        recommendations: [baseRecommendation],
    total_recommendations: 1,
    average_similarity: rec.similarity ?? structured.top_confidence
      };
      groups.set(key, group);
    }
  }

  const formatted = Array.from(groups.values());
  const formattedServices = formatted.filter(r => r.type === 'service');
  const formattedPlaces = formatted.filter(r => r.type === 'place');
  
  console.log('   📦 [FORMAT] Formatting complete:', {
    totalRecommendations: structured.recommendations.length,
    services: serviceCount,
    places: placeCount,
    formattedGroups: formatted.length,
    formattedServices: formattedServices.length,
    formattedPlaces: formattedPlaces.length
  });
  
  if (serviceCount > 0 && formattedServices.length === 0) {
    console.log('   ⚠️  [SERVICE] WARNING: Services in recommendations but NO service groups in formatted results!');
    console.log('   ⚠️  [SERVICE] This suggests a formatting issue');
  }
  
  return formatted;
}

function computeDistanceLabelForResult(
  userLat?: number | null,
  userLng?: number | null,
  targetLat?: number | null,
  targetLng?: number | null
): string | null {
  if (
    typeof userLat !== 'number' ||
    typeof userLng !== 'number' ||
    typeof targetLat !== 'number' ||
    typeof targetLng !== 'number'
  ) {
    return null;
  }
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(targetLat - userLat);
  const dLng = toRad(targetLng - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLat)) *
      Math.cos(toRad(targetLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  if (!Number.isFinite(km)) return null;
  if (km < 0.5) return 'within walking distance (~5–10 min)';
  if (km < 2) return `${km.toFixed(1)} km away (short ride)`;
  if (km < 8) return `${km.toFixed(1)} km away`;
  if (km < 20) return `${km.toFixed(0)} km away (a bit farther)`;
  return `${km.toFixed(0)} km away (other part of the city or nearby city)`;
}

export function addDistanceLabelsToResults(
  results: FormattedStructuredResult[],
  user_lat?: number | null,
  user_lng?: number | null
): FormattedStructuredResult[] {
  return results.map(result => {
    if (result.type === 'place') {
      const label = computeDistanceLabelForResult(user_lat, user_lng, result.place_lat ?? null, result.place_lng ?? null);
      return {
        ...result,
        distance_label: label ?? result.distance_label ?? null
      };
    }
    return result;
  });
}

export function convertStructuredResultsToSearchContext(
  formatted: FormattedStructuredResult[],
  query: string,
  user_lat?: number | null,
  user_lng?: number | null
): SearchContext {
  console.log('📍 [CONTEXT] Building search context for AI summary...', {
    totalFormattedResults: formatted.length,
    hasUserLocation: typeof user_lat === 'number' && typeof user_lng === 'number',
    user_lat,
    user_lng
  });

  const results: SearchContext['results'] = formatted.map((result) => {
    const recommendations = result.recommendations.map((rec) => {
      // Extract notes from description or content_data
      const notes = rec.description || rec.content_data?.notes || rec.content_data?.quote || undefined;
      
      return {
        user_name: rec.user_name,
        notes,
        rating: rec.rating,
        labels: rec.labels || [],
        went_with: rec.content_data?.went_with || [],
        visit_date: rec.content_data?.visit_date || rec.created_at?.toISOString().split('T')[0]
      };
    });

    if (result.type === 'place') {
      console.log('📍 [CONTEXT] Converted place result:', {
        place_id: result.place_id,
        place_name: result.place_name,
        hasCoords: typeof result.place_lat === 'number' && typeof result.place_lng === 'number',
        place_lat: result.place_lat,
        place_lng: result.place_lng
      });
      return {
        type: 'place',
        place_id: result.place_id ?? null,
        place_name: result.place_name || '',
        place_address: result.place_address || undefined,
        place_lat: result.place_lat ?? undefined,
        place_lng: result.place_lng ?? undefined,
        place_primary_type: result.recommendations[0]?.content_data?.place_primary_type,
        place_types: result.recommendations[0]?.content_data?.place_types || [],
        total_recommendations: result.total_recommendations,
        average_similarity: result.average_similarity ?? 0,
        recommendations
      };
    } else {
      console.log('📍 [CONTEXT] Converted service result:', {
        service_id: result.service_id,
        service_name: result.service_name,
        // Services rarely have coordinates, but log if we ever capture them
        hasCoords: Boolean((result as any).service_lat && (result as any).service_lng)
      });
      return {
        type: 'service',
        service_id: result.service_id ?? null,
        service_name: result.service_name || '',
        service_type: result.recommendations[0]?.content_data?.service_type || null,
        service_address: result.service_address || undefined,
        total_recommendations: result.total_recommendations,
        average_similarity: result.average_similarity ?? 0,
        recommendations
      };
    }
  });

  const total_places = results.filter(r => r.type === 'place').length;
  const total_recommendations = results.reduce((sum, r) => sum + r.total_recommendations, 0);

  console.log('📍 [CONTEXT] Search context summary:', {
    total_places,
    total_results: results.length,
    total_recommendations
  });

  return {
    query,
    results,
    total_places,
    total_recommendations,
    user_lat: user_lat ?? null,
    user_lng: user_lng ?? null
  };
}

/**
 * Helper to safely parse tool call arguments (handles both string and object formats)
 */
export function parseToolArguments(args: any): any {
  if (typeof args === 'string') {
    return JSON.parse(args);
  }
  if (typeof args === 'object' && args !== null) {
    return args;
  }
  return JSON.parse(JSON.stringify(args));
}

export function normalizeStructuredSearchArgs(
  rawArgs: any,
  fallbackLat?: number,
  fallbackLng?: number
): StructuredSearchArgs {
  if (!rawArgs || typeof rawArgs.intent !== 'string' || rawArgs.intent.trim().length === 0) {
    throw new Error('intent is required');
  }

  // Normalize location: treat string "null"/"none"/"" as null
  let normalizedLocation: string | null | undefined = rawArgs.location;
  if (typeof normalizedLocation === 'string') {
    const trimmed = normalizedLocation.trim().toLowerCase();
    if (!trimmed || trimmed === 'null' || trimmed === 'none') {
      normalizedLocation = null;
    }
  }

  // Normalize user_lat/user_lng: handle string "null" that Groq sometimes sends
  const normalizeCoord = (val: any): number | null => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return null;
    if (typeof val === 'string' && (val.trim().toLowerCase() === 'null' || val.trim() === '')) return null;
    return null;
  };

  // Normalize content_type: only accept 'place', 'service', or null/undefined
  let normalizedContentType: 'place' | 'service' | null | undefined = undefined;
  if (rawArgs.content_type === 'place' || rawArgs.content_type === 'service') {
    normalizedContentType = rawArgs.content_type;
  } else if (rawArgs.content_type === null || rawArgs.content_type === undefined) {
    normalizedContentType = null;
  }
  
  // Log LLM's content_type decision
  console.log('   🤖 [LLM] Content type decision:', {
    raw: rawArgs.content_type,
    normalized: normalizedContentType,
    intent: rawArgs.intent?.substring(0, 50)
  });
  
  if (normalizedContentType === 'service') {
    console.log('   ✅ [LLM] LLM correctly identified this as a SERVICE search');
  } else if (normalizedContentType === 'place') {
    console.log('   ✅ [LLM] LLM identified this as a PLACE search');
  } else {
    console.log('   ⚠️  [LLM] LLM did not specify content_type - will search both places and services');
  }

  // Normalize category_id
  let normalizedCategoryId: number | null | undefined = undefined;
  if (typeof rawArgs.category_id === 'number') {
    normalizedCategoryId = rawArgs.category_id;
  } else if (rawArgs.category_id === null || rawArgs.category_id === undefined) {
    normalizedCategoryId = null;
  }
  
  // Log category_id decision
  if (normalizedContentType === 'service') {
    if (normalizedCategoryId) {
      console.log('   ✅ [LLM] LLM set category_id:', normalizedCategoryId);
    } else {
      console.log('   ⚠️  [LLM] WARNING: LLM did not set category_id for service search!');
      console.log('   ⚠️  [LLM] This may return irrelevant services (e.g., tutors when searching for architects)');
    }
  }

  const normalized: StructuredSearchArgs = {
    intent: rawArgs.intent.trim(),
    location: normalizedLocation ?? undefined,
    user_lat: normalizeCoord(rawArgs.user_lat),
    user_lng: normalizeCoord(rawArgs.user_lng),
    max_price_inr: typeof rawArgs.max_price_inr === 'number' ? rawArgs.max_price_inr : null,
    min_rating: typeof rawArgs.min_rating === 'number' ? rawArgs.min_rating : null,
    require_fresh: Boolean(rawArgs.require_fresh),
    require_high_trust: Boolean(rawArgs.require_high_trust),
    content_type: normalizedContentType,
    category_id: normalizedCategoryId,
    price_range: rawArgs.price_range && ['₹', '₹₹', '₹₹₹', '₹₹₹₹'].includes(rawArgs.price_range) ? rawArgs.price_range : null,
    context_tags: Array.isArray(rawArgs.context_tags) ? rawArgs.context_tags : null,
    limit: [1, 2, 3].includes(rawArgs.limit) ? rawArgs.limit : 2
  };

  if (
    (normalized.location === null || normalized.location === undefined) &&
    typeof fallbackLat === 'number' &&
    typeof fallbackLng === 'number'
  ) {
    normalized.user_lat = fallbackLat;
    normalized.user_lng = fallbackLng;
  }

  return normalized;
}

export function parseAskMyNetworkArgs(rawArgs: any): AskMyNetworkArgs {
  if (!rawArgs || typeof rawArgs.intent !== 'string' || rawArgs.intent.trim().length === 0) {
    throw new Error('intent is required for ask_my_network');
  }
  if (!rawArgs.reason || typeof rawArgs.reason !== 'string') {
    throw new Error('reason is required for ask_my_network');
  }

  return {
    intent: rawArgs.intent.trim(),
    reason: rawArgs.reason.trim(),
    urgency:
      rawArgs.urgency && ['low', 'normal', 'high'].includes(rawArgs.urgency)
        ? rawArgs.urgency
        : 'normal',
    preferred_circle:
      typeof rawArgs.preferred_circle === 'string' ? rawArgs.preferred_circle : null
  };
}

export async function enqueueAskNetworkRequest(userId: string, args: AskMyNetworkArgs) {
  console.log('🆘 ask_my_network invoked', { userId, args });
  return {
    status: 'queued',
    intent: args.intent,
    reason: args.reason,
    urgency: args.urgency,
    preferred_circle: args.preferred_circle,
    ticket_id: `ask_${Date.now()}`
  };
}


// Helpers
function normalizeContactInfo(raw: any, description?: string): { phone?: string; email?: string } {
  // Import normalization functions for consistency
  const { normalizePhoneNumber, normalizeEmail } = require('../db/services');
  
  // Accept string or { phone, email }
  let phone: string | undefined;
  let email: string | undefined;

  if (raw && typeof raw === 'object') {
    if (raw.phone && typeof raw.phone === 'string') {
      phone = normalizePhoneNumber(raw.phone);
      if (!phone || phone.length < 10) phone = undefined;
    }
    if (raw.email && typeof raw.email === 'string' && /@/.test(raw.email)) {
      email = normalizeEmail(raw.email);
    }
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Try phone first
    phone = normalizePhoneNumber(trimmed);
    if (!phone || phone.length < 10) {
      phone = undefined;
      // Then try email
      if (/@/.test(trimmed)) {
        email = normalizeEmail(trimmed);
      }
    }
  }

  // Fallback: try description for a phone-like number
  if (!phone && typeof description === 'string') {
    const m = description.replace(/\s+/g, '').match(/\+?\d{10,15}/);
    if (m) {
      phone = normalizePhoneNumber(m[0]);
      if (!phone || phone.length < 10) phone = undefined;
    }
  }

  return { phone, email };
}


// Interface for the recommendation request
interface SaveRecommendationRequest {
  // Content classification
  content_type?: 'place' | 'service' | 'unclear';
  
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
  // service_business_name removed from the API surface; retained only in legacy content_data
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
    // Reject deprecated types (tip, contact) if provided
    const contentTypeStr = content_type as string | undefined;
    if (contentTypeStr && (contentTypeStr === 'tip' || contentTypeStr === 'contact')) {
      return res.status(400).json({
        success: false,
        message: 'Content types "tip" and "contact" are no longer supported. Please use "place" or "service".'
      });
    }
    let finalContentType: 'place' | 'service' | 'unclear' = (content_type === 'place' || content_type === 'service' || content_type === 'unclear') ? content_type : 'unclear';
    if (finalContentType === 'unclear' || !finalContentType) {
      // Infer from payload: if core service identifiers exist, treat as service
      if (service_name || service_phone || service_email || service_type) {
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
      const derivedBusinessName = cd.business_name;
      const derivedAddress = service_address || place_address || cd.service_address || cd.address;
      const derivedWebsite = service_website || cd.service_website || cd.website;
      const derivedServiceType = service_type || cd.service_type || cd.category;
      const combinedMetadata = { ...(service_metadata || {}), ...cd } as Record<string, any>;
      // Helper: attempt type from highlights/description text if name/business didn't yield one
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
        extractedServiceType = inferTypeFromFreeText(cd?.highlights, cd?.category, description, derivedServiceName);
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
        // business_name deprecated at write-path; legacy column remains populated for old data only
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
    
    // Extract service_category_id from content_data if present
    const serviceCategoryId = finalContentType === 'service' && finalContentData?.service_category_id
      ? parseInt(finalContentData.service_category_id, 10)
      : undefined;

    const recommendationId = await insertRecommendation({
      user_id,
      content_type: finalContentType,
      place_id: placeId,
      service_id: serviceId,
      service_category_id: serviceCategoryId,
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

    // Transform recommendations to include place/service information where applicable
    const transformedRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => {
        let placeInfo = {};
        let serviceInfo = {};
        let title = '';
        
        // Get place information if this is a place-type recommendation
        if (recommendation.place_id) {
          const placeQuery = await pool.query(
            'SELECT name, address, lat, lng FROM places WHERE id = $1 AND deleted_at IS NULL',
            [recommendation.place_id]
          );
          const place = placeQuery.rows[0] || {};
          placeInfo = {
            place_name: place.name || 'Unknown Place',
            place_address: place.address,
            place_lat: place.lat,
            place_lng: place.lng
          };
          title = place.name || 'Unknown Place';
        }
        
        // Get service information if this is a service-type recommendation
        if (recommendation.service_id) {
          const serviceQuery = await pool.query(
            'SELECT name FROM services WHERE id = $1 AND deleted_at IS NULL',
            [recommendation.service_id]
          );
          const service = serviceQuery.rows[0] || {};
          serviceInfo = {
            service_name: service.name || 'Unknown Service'
          };
          title = service.name || 'Unknown Service';
        }

        return {
          id: recommendation.id,
          content_type: recommendation.content_type,
          title: title,
          description: recommendation.description,
          content_data: recommendation.content_data,
          rating: recommendation.rating,
          visibility: recommendation.visibility,
          labels: recommendation.labels,
          metadata: recommendation.metadata,
          created_at: recommendation.created_at,
          updated_at: recommendation.updated_at,
          ...placeInfo,
          ...serviceInfo
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

    // Transform recommendations to include user information and derive title
    const transformedRecommendations = await Promise.all(
      recommendations.map(async (recommendation) => {
        // Get user information (you might want to add a join query for better performance)
        const userQuery = await pool.query(
          'SELECT display_name, email, profile_picture_url FROM users WHERE id = $1',
          [recommendation.user_id]
        );
        const user = userQuery.rows[0] || {};
        
        // Derive title from place or service name
        let title = '';
        if (recommendation.place_id) {
          const placeQuery = await pool.query(
            'SELECT name FROM places WHERE id = $1 AND deleted_at IS NULL',
            [recommendation.place_id]
          );
          title = placeQuery.rows[0]?.name || 'Unknown Place';
        } else if (recommendation.service_id) {
          const serviceQuery = await pool.query(
            'SELECT name FROM services WHERE id = $1 AND deleted_at IS NULL',
            [recommendation.service_id]
          );
          title = serviceQuery.rows[0]?.name || 'Unknown Service';
        }

        return {
          id: recommendation.id,
          content_type: recommendation.content_type,
          title: title,
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
 * Uses authenticated user ID from JWT token (req.user.id) for security
 */
router.delete('/:recommendationId', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const recommendationIdNum = parseInt(recommendationId);
    
    // Get user ID from authenticated JWT token (set by authenticateJWT middleware)
    const userId = (req as any).user?.id;
    
    if (isNaN(recommendationIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Valid recommendation ID is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const success = await deleteRecommendation(recommendationIdNum, userId);

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
 * Allows localhost/internal requests without authentication for admin operations
 */
router.post('/regenerate-embeddings', async (req, res) => {
  try {
    // Allow localhost/internal requests without auth (for admin scripts)
    const isLocalhost = req.ip === '127.0.0.1' || 
                        req.ip === '::1' || 
                        req.ip === '::ffff:127.0.0.1' ||
                        req.headers.host?.includes('localhost') ||
                        !req.headers['x-forwarded-for']; // Direct connection (not through proxy)
    
    // If not localhost and no user (from JWT), require authentication
    if (!isLocalhost && !req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
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

// Initialize Groq client for function calling
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * POST /api/recommendations/search
 * LLM-driven tool-calling search for places and recommendations
 * Uses structured search with perfect filters via Groq function calling
 * Rate limited to 10 requests per minute per user
 */
router.post('/search', aiRateLimiter, async (req, res) => {
  try {
    // Get current user ID for follow filtering
    const currentUserId = getUserIdFromRequest(req);
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { query, limit = SEARCH_CONFIG.SEMANTIC_SEARCH.LIMIT, threshold = SEARCH_CONFIG.SEMANTIC_SEARCH.THRESHOLD, groupIds, content_type, noSummary, user_lat, user_lng, stream } = req.body;

    // Input validation: query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    // Sanitize and validate query length (max 500 characters)
    const MAX_QUERY_LENGTH = 500;
    const sanitizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (sanitizedQuery.length !== query.trim().length) {
      console.warn(`⚠️ Query truncated from ${query.trim().length} to ${sanitizedQuery.length} characters`);
    }
    
    // Validate GPS coordinates if provided
    if (user_lat !== undefined && user_lat !== null) {
      if (typeof user_lat !== 'number' || isNaN(user_lat) || user_lat < -90 || user_lat > 90) {
        return res.status(400).json({
          success: false,
          message: 'Invalid latitude. Must be a number between -90 and 90.'
        });
      }
    }
    
    if (user_lng !== undefined && user_lng !== null) {
      if (typeof user_lng !== 'number' || isNaN(user_lng) || user_lng < -180 || user_lng > 180) {
        return res.status(400).json({
          success: false,
          message: 'Invalid longitude. Must be a number between -180 and 180.'
        });
      }
    }
    
    // Both coordinates must be provided together if one is provided
    if ((user_lat !== undefined && user_lat !== null) !== (user_lng !== undefined && user_lng !== null)) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude must be provided together, or neither.'
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 SEARCH REQUEST RECEIVED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Query:', sanitizedQuery);
    console.log('📊 Parameters:', { 
      limit, 
      threshold, 
      groupIds: groupIds?.length || 0, 
      content_type, 
      noSummary,
      user_lat,
      user_lng,
      hasGPS: typeof user_lat === 'number' && typeof user_lng === 'number',
      stream: stream === true
    });
    console.log('👤 User ID:', currentUserId);

    // Set up Server-Sent Events if streaming is requested
    const shouldStream = stream === true;
    if (shouldStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    }

    try {
      if (process.env.GROQ_API_KEY) {
        console.log('───────────────────────────────────────────────────────────');
        console.log('🤖 STEP 1: LLM-DRIVEN TOOL CALLING');
        console.log('───────────────────────────────────────────────────────────');

        // TODO: Personal DNA integration - currently using fallbacks
        // Future implementation:
        // 1. Store user preferences (price range, favorite cuisines, etc.) in database
        // 2. Calculate trust scores between users based on recommendation overlap
        // 3. Track user's "loves" and "hates" from their recommendation history
        // 4. Use this data to:
        //    - Pre-filter search results by price range
        //    - Prioritize recommendations from high-trust reviewers
        //    - Boost results matching user's preferences
        //    - Filter out things the user dislikes
        console.log('📊 [STEP 1.1] Loading personal DNA...');
        const dnaStartTime = Date.now();
        let personalDNA;
        try {
          personalDNA = await getPersonalTasteDNA(currentUserId);
          const dnaLoadTime = Date.now() - dnaStartTime;
          console.log('✅ [STEP 1.1] Personal DNA loaded:', {
            loadTimeMs: dnaLoadTime,
            priceRange: personalDNA.priceRange,
            freshnessDays: personalDNA.freshnessDays,
            topReviewersCount: personalDNA.topReviewers.length,
            lovesCount: personalDNA.loves.length,
            hatesCount: personalDNA.hates.length
          });
        } catch (dnaError) {
          const dnaLoadTime = Date.now() - dnaStartTime;
          console.warn('⚠️ [STEP 1.1] Personal DNA unavailable, using defaults:', {
            loadTimeMs: dnaLoadTime,
            error: dnaError instanceof Error ? dnaError.message : 'Unknown error'
          });
          personalDNA = {
            priceRange: 'flexible',
            freshnessDays: 90,
            topReviewers: [],
            loves: [],
            hates: []
          };
        }

        const locationHint =
          typeof user_lat === 'number' && typeof user_lng === 'number'
            ? `Current GPS: ${user_lat}, ${user_lng}`
            : 'No GPS available';

        console.log('📝 [STEP 1.2] Building system prompt...', {
          hasLocation: typeof user_lat === 'number' && typeof user_lng === 'number',
          hasTrustCircle: personalDNA.topReviewers.length > 0,
          hasPreferences: personalDNA.loves.length > 0 || personalDNA.hates.length > 0
        });
        
        // Log query for service detection
        const queryLower = sanitizedQuery.toLowerCase();
        const serviceKeywords = ['service', 'plumber', 'tutor', 'instructor', 'contractor', 'doctor', 'lawyer', 'therapist', 'coach', 'trainer', 'photographer', 'designer', 'developer', 'consultant'];
        const hasServiceKeywords = serviceKeywords.some(keyword => queryLower.includes(keyword));
        console.log('🔍 [QUERY] Query analysis:', {
          query: sanitizedQuery,
          hasServiceKeywords,
          detectedKeywords: serviceKeywords.filter(kw => queryLower.includes(kw))
        });

        // Simplified system prompt - works without personal DNA data
        const systemPrompt = `You are a recommendation assistant that helps users find places and services from their trusted network.

Current context:
- User location: ${locationHint}
${personalDNA.topReviewers.length > 0 ? `- Trusted reviewers: ${personalDNA.topReviewers.map((r: any) => `${r.name} (${r.trust}%)`).join(', ')}` : ''}
${personalDNA.loves.length > 0 ? `- User preferences: ${personalDNA.loves.join(', ')}` : ''}

TOOL USAGE:
- Use search_my_network to find relevant places/services
- Use ask_my_network only when search_my_network returns zero results or very low confidence
- CRITICAL: Use JSON null (not string "null") for optional fields like user_lat, user_lng, location, max_price_inr, min_rating, content_type

CONTENT TYPE DETERMINATION:
- Determine if the query is for a physical location (place) or a service provider (service)
- Use content_type="place" for: restaurants, cafes, shops, venues, gyms, hotels, parks, beaches, tourist attractions, any physical location
- Use content_type="service" for: professionals (plumbers, tutors, instructors, contractors, doctors, lawyers), service providers, people offering services
- Use content_type=null when the query could be either type or is ambiguous (e.g., "massage" could be a spa place or a massage therapist service)

SERVICE CATEGORY FILTERING (CRITICAL FOR ACCURACY):
- When content_type="service", you MUST call lookup_service_category first to find the correct category_id
- Pass the service type from the query (e.g., "architect", "physics tutor", "plumber", "wedding photographer")
- The lookup tool will return matching categories with confidence scores
- Use the highest confidence match (confidence >= 0.5) in your search_my_network call
- If no high-confidence matches found (confidence < 0.5), proceed without category_id but note this may return irrelevant services
- IMPORTANT: Setting category_id ensures only relevant services are returned (e.g., architect queries won't return tutors)

EVALUATING SEARCH RESULTS:
1. ALWAYS check the "results_summary" array - it shows what was actually found
2. If results_summary contains places matching the query (e.g., query "jalebi" and summary shows "Kadimi Market" with "jalebi" in relevance_hint), those ARE valid results
3. Confidence levels:
   - HIGH (>= 0.8): Results are strong matches - ALWAYS show them
   - MODERATE (0.6-0.8): Results are relevant - show them
   - LOW (< 0.6): Results may be less relevant - use judgment

FINAL RESPONSE (JSON only, no extra text):
{
  "decision": "show_results" | "no_results" | "ask_network_only",
  "headline": "short summary",
  "show_cards": boolean
}

DECISION RULES:
- "show_results": Use when search_my_network found relevant results (even if you also ask the network)
- "ask_network_only": Use ONLY when search_my_network returned zero results or confidence < 0.5
- "no_results": Use when there are genuinely no matching results
- "show_cards": true if results are relevant (confidence >= 0.6), false only if completely irrelevant

CRITICAL: If top_confidence >= 0.8 and results_count > 0, you MUST set decision="show_results" and show_cards=true.`;

        console.log('🤖 [STEP 1.3] Executing search orchestration...');
        const orchestrationStartTime = Date.now();
        
        // Execute tool-calling loop via orchestrator
        const orchestrationResult = await executeSearchOrchestration({
          userId: currentUserId,
          query: sanitizedQuery,
          user_lat: user_lat ?? null,
          user_lng: user_lng ?? null,
          personalDNA,
          groq,
          systemPrompt,
          maxTurns: 4
        });
        
        const orchestrationTime = Date.now() - orchestrationStartTime;
        console.log(`✅ [STEP 1.3] Search orchestration completed in ${orchestrationTime}ms`);
        
          const { finalMessage, structuredContext, askNetworkContext } = orchestrationResult;
          
          // Log service results breakdown
          if (structuredContext?.formatted) {
            const serviceResults = structuredContext.formatted.filter((r: any) => r.type === 'service');
            const placeResults = structuredContext.formatted.filter((r: any) => r.type === 'place');
            console.log('📊 [STEP 2] Results breakdown after orchestration:', {
              total: structuredContext.formatted.length,
              services: serviceResults.length,
              places: placeResults.length,
              rawRecommendationsCount: structuredContext.raw?.recommendations?.length || 0
            });
            
            if (serviceResults.length > 0) {
              console.log('✅ [SERVICE] Service results found in orchestration:', serviceResults.length);
              serviceResults.forEach((result: any, idx: number) => {
                console.log(`   [SERVICE] ${idx + 1}. ${result.service_name} (ID: ${result.service_id}, category: ${result.service_category_name || 'N/A'})`);
              });
            } else {
              console.log('⚠️  [SERVICE] No service results found in orchestration');
              console.log('   ⚠️  [SERVICE] Raw recommendations count:', structuredContext.raw?.recommendations?.length || 0);
              if (structuredContext.raw?.recommendations && structuredContext.raw.recommendations.length > 0) {
                console.log('   ⚠️  [SERVICE] Raw recommendations exist but were not formatted as services. Sample:', 
                  structuredContext.raw.recommendations[0]);
              }
            }
          } else {
            console.log('⚠️  [STEP 2] No structured context available after orchestration');
          }

        // Process LLM's final decision
        if (finalMessage) {
          console.log('📋 [STEP 3] Processing LLM final decision...');
          const finalContent = finalMessage.content?.trim() || '';
          console.log('   📝 [STEP 3] Final message content:', finalContent.substring(0, 500));
          let finalDecision: any;

          try {
            finalDecision = finalContent ? JSON.parse(finalContent) : {};
            console.log('   ✅ [STEP 3] Successfully parsed LLM JSON response:', finalDecision);
          } catch (parseError) {
            console.warn('   ⚠️ [STEP 3] LLM returned freeform text instead of JSON:', {
              contentPreview: finalContent.substring(0, 200),
              parseError: parseError instanceof Error ? parseError.message : 'Unknown'
            });
            finalDecision = { decision: 'freeform', headline: finalContent };
          }

          // Single source of truth for results visibility
          // Precedence order (highest to lowest):
          // 1. No results found -> hide
          // 2. LLM explicitly says "no_results" -> hide
          // 3. LLM says "ask_network_only" with no results -> hide
          // 4. AI summary says cards not allowed -> hide
          // 5. LLM explicitly sets show_cards=false -> hide
          // 6. Otherwise -> show
          
          const hasResults = (structuredContext?.formatted?.length ?? 0) > 0;
          const topConfidence = structuredContext?.raw.top_confidence ?? 0;
          const llmDecision = finalDecision.decision;
          const llmShowCards = typeof finalDecision.show_cards === 'boolean' 
            ? finalDecision.show_cards 
            : llmDecision === 'show_results';
          
          console.log('   📊 [STEP 3] LLM raw decision:', {
            decision: llmDecision,
            show_cards: finalDecision.show_cards,
            headline: finalDecision.headline?.substring(0, 100) || 'N/A',
            hasResults,
            topConfidence
          });

          // Generate AI summary if we have results
          let summaryText = '';
          let followUpPrompts: string[] = [];
          let aiCardsAllowed = true; // Default to true, AI summary can override
          
          if (hasResults) {
            const summaryStartTime = Date.now();
            try {
              console.log('   🔄 [STEP 4] Generating AI summary for structured search results...');
              
              const searchContext = convertStructuredResultsToSearchContext(
                structuredContext!.formatted,
                sanitizedQuery,
                user_lat ?? null,
                user_lng ?? null
              );
              
              console.log('   📊 [STEP 4] Search context prepared:', {
                resultsCount: searchContext.results.length,
                totalPlaces: searchContext.total_places,
                totalRecommendations: searchContext.total_recommendations,
                hasUserLocation: Boolean(searchContext.user_lat && searchContext.user_lng)
              });
              
              // Non-streaming mode: use existing logic
              const summaryResult = await generateAISummary(searchContext, 'detailed');
              const summaryTime = Date.now() - summaryStartTime;
              
              summaryText = summaryResult.text;
              followUpPrompts = summaryResult.followUps;
              aiCardsAllowed = summaryResult.cardsAllowed;
              
              console.log('   ✅ [STEP 4] AI summary generated:', {
                generationTimeMs: summaryTime,
                summaryLength: summaryText.length,
                summaryPreview: summaryText.substring(0, 150) + '...',
                followUpsCount: followUpPrompts.length,
                followUps: followUpPrompts,
                cardsAllowed: aiCardsAllowed
              });
            } catch (summaryError) {
              const summaryTime = Date.now() - summaryStartTime;
              console.error('   ❌ [STEP 4] Failed to generate AI summary:', {
                errorTimeMs: summaryTime,
                error: summaryError instanceof Error ? summaryError.message : 'Unknown error',
                stack: summaryError instanceof Error ? summaryError.stack : undefined
              });
              summaryText = typeof finalDecision.headline === 'string' && finalDecision.headline.trim().length > 0
                ? finalDecision.headline.trim()
                : finalContent || 'Your friends are thinking...';
              console.log('   ⚠️ [STEP 4] Using LLM headline as fallback:', {
                headlineLength: summaryText.length,
                headlinePreview: summaryText.substring(0, 100)
              });
            }
    } else {
            // Use LLM's headline when no results
            summaryText = typeof finalDecision.headline === 'string' && finalDecision.headline.trim().length > 0
              ? finalDecision.headline.trim()
              : finalContent || 'Your friends are thinking...';
            console.log('   ⏭️ [STEP 4] No results, using LLM headline:', {
              headlineLength: summaryText.length,
              headlinePreview: summaryText.substring(0, 100)
            });
          }

          // Log card marker usage so we know if summary placed cards inline
          const markerMatches = summaryText.match(/\[CARD:[^\]]+\]/g) || [];
          console.log('🧩 [STEP 4] Summary card marker audit:', {
            hasMarkers: markerMatches.length > 0,
            markerCount: markerMatches.length,
            markersSample: markerMatches.slice(0, 5),
            aiCardsAllowed,
            resultsCount: structuredContext?.formatted?.length || 0
          });

          // Single source of truth: Determine if results should be shown
          // Apply precedence rules in order
          let shouldShowResults = false;
          let visibilityReason = '';
          
          if (!hasResults) {
            shouldShowResults = false;
            visibilityReason = 'No results found';
          } else if (llmDecision === 'no_results') {
            shouldShowResults = false;
            visibilityReason = 'LLM explicitly said no_results';
          } else if (llmDecision === 'ask_network_only' && topConfidence < 0.5) {
            // Only hide if confidence is very low when asking network
            shouldShowResults = false;
            visibilityReason = 'LLM said ask_network_only with low confidence';
          } else if (!aiCardsAllowed) {
            shouldShowResults = false;
            visibilityReason = 'AI summary determined results are not relevant';
          } else if (llmShowCards === false) {
            shouldShowResults = false;
            visibilityReason = 'LLM explicitly set show_cards=false';
          } else {
            shouldShowResults = true;
            visibilityReason = 'All checks passed, showing results';
          }
          
          console.log('🎯 [STEP 5] Results visibility decision:', {
            shouldShowResults,
            visibilityReason,
            hasResults,
            llmDecision,
            llmShowCards,
            aiCardsAllowed,
            topConfidence,
            resultsCount: structuredContext?.formatted?.length || 0
          });

          // Handle streaming if requested
          if (shouldStream) {
            if (hasResults) {
              // Send initial data with results but empty summary
              const initialData = {
                type: 'init',
                data: {
                  query: sanitizedQuery,
                  summary: '',
                  follow_up_prompts: [],
                  cards_allowed: true,
                  results: shouldShowResults ? (structuredContext?.formatted || []) : [],
                  search_metadata: {
                    structured_search_used: Boolean(structuredContext),
                    top_confidence: structuredContext?.raw.top_confidence ?? null,
                    used_current_location: structuredContext?.raw.used_current_location ?? false,
                    filters_applied: structuredContext?.raw.metadata.filters_applied ?? [],
                    final_decision: finalDecision.decision || null,
                    ask_network: askNetworkContext,
                    skip_llm: false
                  },
                  llm_decision: finalDecision
                }
              };
              res.write(`data: ${JSON.stringify(initialData)}\n\n`);
              
              // Stream the AI summary
              const searchContext = convertStructuredResultsToSearchContext(
                structuredContext!.formatted,
                sanitizedQuery,
                user_lat ?? null,
                user_lng ?? null
              );
              
              await generateAISummaryStream(searchContext, {
                onChunk: (chunk: string) => {
                  const sseMessage = JSON.stringify({ type: 'chunk', data: chunk });
                  console.log(`📡 [SSE] Backend writing chunk to SSE: "${chunk}" (SSE message length: ${sseMessage.length})`);
                  res.write(`data: ${sseMessage}\n\n`);
                },
                onComplete: (result: any) => {
                  const finalData = {
                    type: 'done',
                    data: {
                      summary: result.text,
                      follow_up_prompts: result.followUps,
                      cards_allowed: result.cardsAllowed
                    }
                  };
                  res.write(`data: ${JSON.stringify(finalData)}\n\n`);
                  res.end();
                },
                onError: (error: Error) => {
                  console.error('   ❌ [STEP 4] Streaming AI summary failed:', error.message);
                  const errorData = {
                    type: 'error',
                    data: {
                      summary: summaryText || typeof finalDecision.headline === 'string' ? finalDecision.headline : 'Your friends are thinking...',
                      follow_up_prompts: [],
                      cards_allowed: true
                    }
                  };
                  res.write(`data: ${JSON.stringify(errorData)}\n\n`);
                  res.end();
                }
              }, 'detailed');
            } else {
              // No results case - send complete response immediately via SSE
              const noResultsData = {
                type: 'init',
                data: {
                  query: sanitizedQuery,
                  summary: summaryText,
                  follow_up_prompts: followUpPrompts,
                  cards_allowed: aiCardsAllowed,
                  results: [],
                  search_metadata: {
                    structured_search_used: Boolean(structuredContext),
                    top_confidence: structuredContext?.raw.top_confidence ?? null,
                    used_current_location: structuredContext?.raw.used_current_location ?? false,
                    filters_applied: structuredContext?.raw.metadata.filters_applied ?? [],
                    final_decision: finalDecision.decision || null,
                    ask_network: askNetworkContext,
                    skip_llm: false
                  },
                  llm_decision: finalDecision
                }
              };
              res.write(`data: ${JSON.stringify(noResultsData)}\n\n`);
              
              // Send done message immediately since there's no summary to stream
              const doneData = {
                type: 'done',
                data: {
                  summary: summaryText,
                  follow_up_prompts: followUpPrompts,
                  cards_allowed: aiCardsAllowed
                }
              };
              res.write(`data: ${JSON.stringify(doneData)}\n\n`);
              res.end();
            }
            
            // Return early for streaming - response is handled above
            return;
          }

          const responseData = {
            success: true,
            data: {
              query: sanitizedQuery,
              summary: summaryText,
              follow_up_prompts: followUpPrompts,
              cards_allowed: aiCardsAllowed,
              results: shouldShowResults ? (structuredContext?.formatted || []) : [],
              search_metadata: {
                structured_search_used: Boolean(structuredContext),
                top_confidence: structuredContext?.raw.top_confidence ?? null,
                used_current_location: structuredContext?.raw.used_current_location ?? false,
                filters_applied: structuredContext?.raw.metadata.filters_applied ?? [],
                final_decision: finalDecision.decision || null,
                ask_network: askNetworkContext,
                skip_llm: false
              },
              llm_decision: finalDecision
            },
            message: 'Search completed via structured tool calling'
          };

          console.log('✅ [STEP 6] Final response prepared:', {
            summaryLength: summaryText.length,
            followUpsCount: followUpPrompts.length,
            resultsCount: responseData.data.results.length,
            cardsAllowed: aiCardsAllowed,
            topConfidence: responseData.data.search_metadata.top_confidence,
            askedNetwork: Boolean(askNetworkContext),
            shouldShowResults
          });
          console.log('═══════════════════════════════════════════════════════════');

          return res.json(responseData);
        }

        // LLM didn't return a final response after 4 turns
        console.error('⚠️ LLM did not return a final response after maximum turns');
        return res.status(500).json({
          success: false,
          message: 'Search service temporarily unavailable. Please try again.',
          error: 'LLM did not complete search'
      });
    } else {
        // GROQ API key not configured
        console.error('⚠️ GROQ_API_KEY not configured - tool calling unavailable');
        return res.status(503).json({
          success: false,
          message: 'Search service not configured. Please contact support.',
          error: 'GROQ_API_KEY missing'
        });
      }
    } catch (functionCallError) {
    console.log('───────────────────────────────────────────────────────────');
      console.error('❌ TOOL-CALLING PIPELINE ERROR');
    console.log('───────────────────────────────────────────────────────────');
      console.error('   Error:', functionCallError);
      console.error('   Stack:', functionCallError instanceof Error ? functionCallError.stack : 'N/A');
      
      // Return error instead of falling back
      return res.status(500).json({
        success: false,
        message: 'Search failed. Please try again.',
        error: functionCallError instanceof Error ? functionCallError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in search endpoint:', error);
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

// Get embedding queue status (public endpoint for monitoring)
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