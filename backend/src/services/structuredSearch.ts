/**
 * Structured Search Service
 * 
 * Implements function-calling based search with perfect filter enforcement.
 * This replaces free-text LLM search with structured, guaranteed-accurate results.
 */

import pool from '../db';
import { Client } from '@googlemaps/google-maps-services-js';
import { generateSearchEmbedding } from '../utils/embeddings';
import { calculatePersonalOverlapBatch } from '../utils/personalOverlap';
import { SEARCH_CONFIG } from '../config/searchConfig';

// Constants
const GPS_RADIUS_KM = 25;
const LOCATION_RADIUS_KM = 50;
const FRESH_DAYS_THRESHOLD = 90;

/**
 * Search arguments from function calling
 */
export interface StructuredSearchArgs {
  intent: string;
  location?: string | null;
  user_lat?: number | null; // User's current GPS latitude (from browser)
  user_lng?: number | null; // User's current GPS longitude (from browser)
  max_price_inr?: 500 | 1000 | 2000 | 5000 | null;
  min_rating?: 4.0 | 4.5 | 4.7 | null;
  require_fresh?: boolean;
  require_high_trust?: boolean;
  content_type?: 'place' | 'service' | null;
  limit?: 1 | 2 | 3;
}

/**
 * Location resolution result
 */
interface LocationBounds {
  lat: number;
  lng: number;
  radiusKm: number;
  usedCurrentLocation: boolean;
}

/**
 * Structured search result with confidence
 */
export interface StructuredSearchResult {
  recommendations: Array<{
    recommendation_id: number;
    content_type: 'place' | 'service' | 'unclear';
    title?: string;
    description: string;
    content_data: Record<string, any>;
    rating?: number;
    labels?: string[];
    user_name: string;
    user_id: string;
    personal_overlap_percent: number; // Trust % (0-100)
    place_id?: number;
    place_name?: string;
    place_address?: string;
    place_lat?: number;
    place_lng?: number;
    place_google_place_id?: string;
    service_id?: number;
    service_name?: string;
    service_address?: string;
    similarity?: number;
    created_at: Date;
  }>;
  top_confidence: number;
  used_current_location: boolean;
  metadata: {
    total_matched: number;
    filters_applied: string[];
  };
}

/**
 * Resolve location to lat/lng bounds
 * 
 * Priority:
 * 1. If location is a string -> geocode it (50km radius)
 * 2. If location is null AND user_lat/user_lng provided -> use GPS coordinates (15km radius)
 * 3. If location is null AND no GPS -> search without location filter
 */
async function resolveLocation(
  location: string | null | undefined,
  userLat: number | null | undefined,
  userLng: number | null | undefined
): Promise<LocationBounds | null> {
  // If null, try to use user's current GPS coordinates from request
  if (location === null || location === undefined) {
    // Check if GPS coordinates were provided in the request
    if (typeof userLat === 'number' && typeof userLng === 'number' && 
        !isNaN(userLat) && !isNaN(userLng) &&
        userLat >= -90 && userLat <= 90 && userLng >= -180 && userLng <= 180) {
      return {
        lat: userLat,
        lng: userLng,
        radiusKm: GPS_RADIUS_KM,
        usedCurrentLocation: true
      };
    }
    
    // No GPS coordinates provided - search without location filter (this is expected)
    console.log('   ℹ️  No location specified - searching entire network without location filter');
    return null;
  }
  
  // String location: geocode it
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured for geocoding');
  }
  
  const googleMapsClient = new Client({});
  const geocodeResponse = await googleMapsClient.geocode({
    params: {
      address: location,
      key: process.env.GOOGLE_MAPS_API_KEY
    }
  });
  
  if (geocodeResponse.data.status !== 'OK' || !geocodeResponse.data.results?.[0]) {
    throw new Error(`Failed to geocode location: ${location}`);
  }
  
  const result = geocodeResponse.data.results[0];
  const lat = result.geometry.location.lat;
  const lng = result.geometry.location.lng;
  
  return {
    lat,
    lng,
    radiusKm: LOCATION_RADIUS_KM,
    usedCurrentLocation: false
  };
}

/**
 * Check if recommendation is fresh (visited within threshold days)
 */
function isFresh(createdAt: Date, contentData: Record<string, any>): boolean {
  // Check visit_date in content_data first
  const visitDate = contentData.visit_date || contentData.visited_at;
  if (visitDate) {
    const visit = new Date(visitDate);
    const daysSince = (Date.now() - visit.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= FRESH_DAYS_THRESHOLD;
  }
  
  // Fallback to created_at
  const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince <= FRESH_DAYS_THRESHOLD;
}

/**
 * Check if price is within max_price_inr
 */
function isWithinPrice(contentData: Record<string, any>, maxPrice: number | null): boolean {
  if (maxPrice === null) return true;
  
  const priceLevel = contentData.price_level || contentData.priceLevel;
  if (!priceLevel) return true; // No price info = pass filter
  
  // Map price levels to approximate INR ranges
  // 1 = budget (0-500), 2 = moderate (500-1000), 3 = higher-end (1000-2000), 4 = luxury (2000+)
  const priceRanges: Record<number, number> = {
    1: 500,
    2: 1000,
    3: 2000,
    4: 5000
  };
  
  const estimatedPrice = priceRanges[priceLevel] || 5000;
  return estimatedPrice <= maxPrice;
}

/**
 * Execute structured search with perfect filter enforcement
 */
export async function executeStructuredSearch(
  userId: string,
  args: StructuredSearchArgs
): Promise<StructuredSearchResult> {
  const filtersApplied: string[] = [];
  let locationBounds: LocationBounds | null = null;
  let usedCurrentLocation = false;
  
  // Resolve location
  // Note: GPS coordinates (user_lat/user_lng) should be provided by frontend
  // when user searches "near me" - frontend gets these from browser geolocation API
  try {
    locationBounds = await resolveLocation(args.location, args.user_lat, args.user_lng);
    if (locationBounds) {
      usedCurrentLocation = locationBounds.usedCurrentLocation;
      filtersApplied.push('location');
    }
  } catch (error) {
    console.warn('Location resolution failed, proceeding without location filter:', error);
    // Continue without location filter - this is acceptable for searches without location
    locationBounds = null;
  }
  
  // Diagnostic queries (only run in debug mode to avoid performance overhead)
  if (SEARCH_CONFIG.DEBUG.ENABLE_DIAGNOSTIC_QUERIES) {
  const networkCheckResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM recommendations r
     INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
     WHERE r.visibility IN ('friends', 'public')`,
    [userId]
  );
  const totalNetworkRecommendations = parseInt(networkCheckResult.rows[0]?.total || '0');
  console.log('   📊 Network diagnostics:');
  console.log('      - Total recommendations in network:', totalNetworkRecommendations);
  }
  
  // Build base query with follow filtering
  // Note: Only returns recommendations from users the current user follows
  let query = `
    SELECT DISTINCT
      r.id as recommendation_id,
      r.content_type,
      r.title,
      r.description,
      r.content_data,
      r.rating,
      r.labels,
      r.user_id,
      r.created_at,
      u.display_name as user_name,
      p.id as place_id,
      p.name as place_name,
      p.address as place_address,
      p.lat as place_lat,
      p.lng as place_lng,
      p.geom as place_geom,
      p.google_place_id as place_google_place_id,
      s.id as service_id,
      s.name as service_name,
      s.address as service_address,
      s.city_name as service_city_name
    FROM recommendations r
    INNER JOIN users u ON r.user_id = u.id
    LEFT JOIN places p ON r.place_id = p.id
    LEFT JOIN services s ON r.service_id = s.id
    INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
    WHERE r.visibility IN ('friends', 'public')
  `;
  
  const queryParams: any[] = [userId];
  let paramIndex = 2;
  
  // Content type filter
  if (args.content_type === 'place' || args.content_type === 'service') {
    query += ` AND r.content_type = $${paramIndex}`;
    queryParams.push(args.content_type);
    paramIndex++;
    filtersApplied.push('content_type');
    console.log(`   🏷️  Adding content_type filter: ${args.content_type}`);
  }
  
  // Location filter (PostGIS distance for places)
  // Note: Services don't have PostGIS geometry, so we can't filter them by location.
  // When location is specified:
  // - Places are filtered by location (must be within radius)
  // - Services are included regardless of location (since we can't filter them spatially)
  if (locationBounds) {
    console.log('   📍 Adding location filter:', {
      lat: locationBounds.lat,
      lng: locationBounds.lng,
      radiusKm: locationBounds.radiusKm,
      radiusMeters: locationBounds.radiusKm * 1000
    });
    // Include places within radius OR services (services can't be filtered by location)
    query += ` AND (
      (p.id IS NOT NULL AND p.geom IS NOT NULL AND ST_DWithin(
        p.geom::geography,
        ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography,
        $${paramIndex + 2}
      ))
      OR (s.id IS NOT NULL)
    )`;
    queryParams.push(locationBounds.lng, locationBounds.lat, locationBounds.radiusKm * 1000); // Convert km to meters
    paramIndex += 3;
    filtersApplied.push('location');
    
    // Diagnostic query: Check how many recommendations exist with location filter (only in debug mode)
    if (SEARCH_CONFIG.DEBUG.ENABLE_DIAGNOSTIC_QUERIES) {
    const locationCheckResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM recommendations r
       INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
       LEFT JOIN places p ON r.place_id = p.id
       WHERE r.visibility IN ('friends', 'public')
           AND p.id IS NOT NULL 
           AND p.geom IS NOT NULL 
           AND ST_DWithin(
             p.geom::geography,
             ST_MakePoint($2, $3)::geography,
             $4
         )`,
      [userId, locationBounds.lng, locationBounds.lat, locationBounds.radiusKm * 1000]
    );
    const totalWithLocation = parseInt(locationCheckResult.rows[0]?.total || '0');
    console.log('      - Recommendations with location filter:', totalWithLocation);
    }
  }
  
  // Intent filter using embedding similarity (replaces ILIKE for semantic matching)
  let intentEmbeddingStr: string | null = null;
  if (args.intent) {
    console.log('   🔍 Adding intent filter using embedding similarity:', args.intent);
    
    try {
      // Generate embedding for the intent
      const intentEmbedding = await generateSearchEmbedding(args.intent);
      intentEmbeddingStr = `[${intentEmbedding.join(',')}]`;
      
      // Add similarity score to SELECT and use it for filtering
      // Cosine distance < 0.3 means similarity > 0.7
      // We calculate similarity as: 1 - (embedding <=> intent_embedding)
      query = query.replace(
        'SELECT DISTINCT',
        `SELECT DISTINCT
      1 - (r.embedding <=> $${paramIndex}::vector) as similarity,`
      );
      
      // Add intent filter using vector similarity
      query += ` AND r.embedding IS NOT NULL
                 AND (r.embedding <=> $${paramIndex}::vector) < 0.3`;
      queryParams.push(intentEmbeddingStr);
      paramIndex++;
      filtersApplied.push('intent');
      
      console.log('      ✅ Using vector similarity for intent matching');
    } catch (embeddingError) {
      console.error('      ❌ Failed to generate intent embedding, falling back to text search:', embeddingError);
      // Fallback to text matching if embedding generation fails
      query += ` AND (
        r.description ILIKE $${paramIndex}
        OR r.title ILIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM unnest(r.labels) AS label
          WHERE label ILIKE $${paramIndex}
        )
      )`;
      queryParams.push(`%${args.intent}%`);
      paramIndex++;
      filtersApplied.push('intent');
    }
  } else {
    // No intent filter - add null similarity for consistency
    query = query.replace(
      'SELECT DISTINCT',
      `SELECT DISTINCT
      NULL::float as similarity,`
    );
  }
  
  // Add ORDER BY to sort by similarity (if available) or by created_at
  if (intentEmbeddingStr) {
    query += ' ORDER BY similarity DESC NULLS LAST';
  } else {
    query += ' ORDER BY r.created_at DESC';
  }
  
  // Execute query and get all candidates
  console.log('   🗄️  Executing final database query...');
  console.log('   📊 Query params:', queryParams.length);
  console.log('   📝 Query preview:', query.substring(0, 200) + '...');
  const candidatesResult = await pool.query(query, queryParams);
  const candidates = candidatesResult.rows;
  console.log('   ✅ Found', candidates.length, 'candidates from database');
  
  if (candidates.length === 0) {
    console.log('   ⚠️  DIAGNOSTIC: No candidates found. Possible reasons:');
    console.log('      1. No recommendations in network (check totalNetworkRecommendations above)');
    console.log('      2. Location filter too restrictive (15km radius)');
    console.log('      3. Intent filter too strict (looking for exact word match)');
    console.log('      4. User not following anyone with recommendations');
    console.log('      5. All recommendations are "unclear" visibility or blocked');
  }
  
  // Apply filters that require data processing
  console.log('   🔍 Applying post-query filters...');
  const filtered: typeof candidates = [];
  const filterStats = {
    rating: 0,
    price: 0,
    fresh: 0
  };
  
  // Note: require_high_trust filter is not yet implemented - will be added in a future phase
  
  for (const candidate of candidates) {
    const contentData = candidate.content_data || {};
    const createdAt = new Date(candidate.created_at);
    let passed = true;
    
    // Rating filter
    if (args.min_rating !== null && args.min_rating !== undefined) {
      if (!candidate.rating || candidate.rating < args.min_rating) {
        filterStats.rating++;
        passed = false;
        continue;
      }
      if (!filtersApplied.includes('min_rating')) filtersApplied.push('min_rating');
    }
    
    // Price filter
    if (args.max_price_inr !== null && args.max_price_inr !== undefined) {
      if (!isWithinPrice(contentData, args.max_price_inr)) {
        filterStats.price++;
        passed = false;
        continue;
      }
      if (!filtersApplied.includes('max_price')) filtersApplied.push('max_price');
    }
    
    // Fresh filter
    if (args.require_fresh === true) {
      if (!isFresh(createdAt, contentData)) {
        filterStats.fresh++;
        passed = false;
        continue;
      }
      if (!filtersApplied.includes('require_fresh')) filtersApplied.push('require_fresh');
    }
    
    // Note: require_high_trust filter is not yet implemented - will be added in a future phase
    
    if (passed) {
      filtered.push(candidate);
    }
  }
  
  console.log('   📊 Filter statistics:');
  console.log('      - Candidates before filters:', candidates.length);
  console.log('      - Filtered out by rating:', filterStats.rating);
  console.log('      - Filtered out by price:', filterStats.price);
  console.log('      - Filtered out by freshness:', filterStats.fresh);
  console.log('      - Candidates after filters:', filtered.length);
  
  // Limit results
  const limit = args.limit || 2;
  const limited = filtered.slice(0, limit);
  console.log('   📏 Applied limit:', limit, '→', limited.length, 'results');
  
  // Calculate confidence based on result quality
  let topConfidence = 0.0;
  if (limited.length > 0) {
    console.log('   📊 Calculating confidence for top result...');
    const topResult = limited[0];
    
    // Start with embedding similarity if available (0.0-1.0)
    // If no similarity (no intent filter), use base of 0.6
    const similarity = topResult.similarity !== null && topResult.similarity !== undefined 
      ? parseFloat(topResult.similarity) 
      : 0.6;
    
    let confidence = similarity;
    
    // Boost confidence for high ratings
    if (topResult.rating && topResult.rating >= 4.5) {
      confidence += 0.1;
    } else if (topResult.rating && topResult.rating >= 4.0) {
      confidence += 0.05;
    }
    
    // Boost confidence for fresh results
    if (args.require_fresh && isFresh(new Date(topResult.created_at), topResult.content_data || {})) {
      confidence += 0.1;
    }
    
    // Note: require_high_trust boost will be added when trust scoring is implemented
    
    // Boost confidence if location was used
    if (locationBounds) {
      confidence += 0.05;
    }
    
    topConfidence = Math.min(1.0, Math.max(0.0, confidence));
    console.log('   ✅ Top confidence calculated:', topConfidence.toFixed(2), 
                `(similarity: ${similarity.toFixed(2)})`);
  } else {
    console.log('   ⚠️  No results after filtering - confidence is 0.0');
  }
  
  // Format results with personal overlap (batch calculation to avoid N+1 queries)
  console.log('   📦 Formatting', limited.length, 'results...');
  
  // Extract unique reviewer user IDs
  const reviewerUserIds = [...new Set(limited.map(rec => rec.user_id))];
  
  // Batch calculate personal overlap for all reviewers in a single query
  const overlapMap = await calculatePersonalOverlapBatch(userId, reviewerUserIds);
  
  // Map results with pre-calculated overlap values
  const recommendations = limited.map((rec) => {
    const personalOverlap = overlapMap.get(rec.user_id) ?? 0;
    
    return {
      recommendation_id: rec.recommendation_id,
      content_type: rec.content_type,
      title: rec.title,
      description: rec.description,
      content_data: rec.content_data,
      rating: rec.rating,
      labels: rec.labels || [],
      user_name: rec.user_name || 'Anonymous',
      user_id: rec.user_id,
      personal_overlap_percent: personalOverlap,
      place_id: rec.place_id,
      place_name: rec.place_name,
      place_address: rec.place_address,
      place_lat: rec.place_lat,
      place_lng: rec.place_lng,
      place_google_place_id: rec.place_google_place_id,
      service_id: rec.service_id,
      service_name: rec.service_name,
      service_address: rec.service_address,
      created_at: rec.created_at,
      similarity: rec.similarity ? parseFloat(rec.similarity) : undefined
    };
  });
  
  console.log('   ✅ Structured search complete');
  console.log('      - Recommendations:', recommendations.length);
  console.log('      - Top confidence:', topConfidence);
  console.log('      - Used current location:', usedCurrentLocation);
  console.log('      - Total matched:', filtered.length);
  console.log('      - Filters applied:', [...new Set(filtersApplied)].join(', '));
  
  return {
    recommendations,
    top_confidence: topConfidence,
    used_current_location: usedCurrentLocation,
    metadata: {
      total_matched: filtered.length,
      filters_applied: [...new Set(filtersApplied)]
    }
  };
}

