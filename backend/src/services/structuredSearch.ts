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
  // Service-specific filters
  category_id?: number | null;
  price_range?: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹' | null;
  context_tags?: string[] | null;
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
  // Location metadata for service filtering
  country_code?: string;
  city_name?: string;
  admin1_name?: string;
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
    service_price_range?: string;
    service_exact_price?: string;
    service_category_name?: string;
    service_category_slug?: string;
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
/**
 * Extract location metadata from Google Geocoding result
 */
function extractLocationMetadata(result: any): { country_code?: string; city_name?: string; admin1_name?: string } {
  const metadata: { country_code?: string; city_name?: string; admin1_name?: string } = {};
  
  if (result.address_components) {
    for (const component of result.address_components) {
      const types = component.types || [];
      
      if (!metadata.country_code && types.includes('country')) {
        metadata.country_code = (component.short_name || component.long_name || '').toUpperCase();
      }
      
      if (!metadata.city_name && (types.includes('locality') || types.includes('postal_town'))) {
        metadata.city_name = component.long_name || component.short_name;
      }
      
      if (!metadata.admin1_name && types.includes('administrative_area_level_1')) {
        metadata.admin1_name = component.long_name || component.short_name;
      }
    }
  }
  
  return metadata;
}

async function resolveLocation(
  location: string | null | undefined,
  userLat: number | null | undefined,
  userLng: number | null | undefined
): Promise<LocationBounds | null> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured for geocoding');
  }
  
  const googleMapsClient = new Client({});
  let lat: number;
  let lng: number;
  let locationMetadata: { country_code?: string; city_name?: string; admin1_name?: string } = {};
  
  // If null, try to use user's current GPS coordinates from request
  if (location === null || location === undefined) {
    // Check if GPS coordinates were provided in the request
    if (typeof userLat === 'number' && typeof userLng === 'number' && 
        !isNaN(userLat) && !isNaN(userLng) &&
        userLat >= -90 && userLat <= 90 && userLng >= -180 && userLng <= 180) {
      lat = userLat;
      lng = userLng;
      
      // Reverse geocode GPS coordinates to get location metadata for service filtering
      try {
        const reverseGeocodeResponse = await googleMapsClient.reverseGeocode({
          params: {
            latlng: { lat: userLat, lng: userLng },
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        });
        
        if (reverseGeocodeResponse.data.status === 'OK' && reverseGeocodeResponse.data.results?.[0]) {
          locationMetadata = extractLocationMetadata(reverseGeocodeResponse.data.results[0]);
          console.log('   🌍 Reverse geocoded GPS coordinates:', {
            lat,
            lng,
            country_code: locationMetadata.country_code,
            city_name: locationMetadata.city_name,
            admin1_name: locationMetadata.admin1_name
          });
        }
      } catch (reverseGeocodeError) {
        console.warn('   ⚠️  Failed to reverse geocode GPS coordinates, proceeding without location metadata:', reverseGeocodeError);
        // Continue without metadata - we'll still filter places by distance
      }
      
      return {
        lat,
        lng,
        radiusKm: GPS_RADIUS_KM,
        usedCurrentLocation: true,
        ...locationMetadata
      };
    }
    
    // No GPS coordinates provided - search without location filter (this is expected)
    console.log('   ℹ️  No location specified - searching entire network without location filter');
    return null;
  }
  
  // String location: geocode it
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
  lat = result.geometry.location.lat;
  lng = result.geometry.location.lng;
  locationMetadata = extractLocationMetadata(result);
  
  console.log('   🌍 Geocoded location:', {
    location,
    lat,
    lng,
    country_code: locationMetadata.country_code,
    city_name: locationMetadata.city_name,
    admin1_name: locationMetadata.admin1_name
  });
  
  return {
    lat,
    lng,
    radiusKm: LOCATION_RADIUS_KM,
    usedCurrentLocation: false,
    ...locationMetadata
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
  console.log('   🗄️  [STRUCTURED_SEARCH] Starting structured search:', {
    userId,
    intent: args.intent,
    content_type: args.content_type,
    category_id: args.category_id,
    location: args.location,
    user_lat: args.user_lat,
    user_lng: args.user_lng,
    limit: args.limit
  });
  
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
      COALESCE(p.name, s.name) as title,
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
      s.city_name as service_city_name,
      s.admin1_name as service_admin1_name,
      s.country_code as service_country_code,
      srd.rating as service_rating,
      srd.price_range as service_price_range,
      srd.exact_price as service_exact_price,
      srd.experience_summary as service_experience_summary,
      srd.verbatim_quote as service_quote,
      srd.context_tags as service_context_tags,
      srd.search_vector as service_search_vector,
      sc.name as service_category_name,
      sc.slug as service_category_slug
    FROM recommendations r
    INNER JOIN users u ON r.user_id = u.id
    LEFT JOIN places p ON r.place_id = p.id AND p.deleted_at IS NULL
    LEFT JOIN services s ON r.service_id = s.id AND s.deleted_at IS NULL
    LEFT JOIN service_recommendation_details srd ON r.id = srd.recommendation_id
    LEFT JOIN service_categories sc ON sc.id = r.service_category_id
    INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
    WHERE r.visibility IN ('friends', 'public')
      AND r.deleted_at IS NULL
  `;
  
  const queryParams: any[] = [userId];
  let paramIndex = 2;
  
  // Content type filter
  if (args.content_type === 'place' || args.content_type === 'service') {
    query += ` AND r.content_type = $${paramIndex}`;
    queryParams.push(args.content_type);
    paramIndex++;
    filtersApplied.push('content_type');
    console.log(`   🏷️  [CONTENT_TYPE] Adding content_type filter: ${args.content_type}`);
    
    if (args.content_type === 'service') {
      console.log('   🔧 [SERVICE] Filtering for services only');
      console.log('   🔧 [SERVICE] Query intent:', args.intent);
      
      // Diagnostic: Check total services in network before filters
      try {
        const serviceCheckResult = await pool.query(
          `SELECT COUNT(*) as count 
           FROM recommendations r
           INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
           WHERE r.visibility IN ('friends', 'public')
             AND r.deleted_at IS NULL
             AND r.content_type = 'service'`,
          [userId]
        );
        const totalServices = parseInt(serviceCheckResult.rows[0]?.count || '0');
        console.log(`   🔧 [SERVICE] DIAGNOSTIC: Total services in network (before filters): ${totalServices}`);
      } catch (error) {
        console.log(`   ⚠️  [SERVICE] Could not check total services:`, error);
      }
    }
  } else {
    console.log('   📋 [MIXED] No content_type filter - will search both places and services');
  }

  // Service category filter
  if (args.category_id !== null && args.category_id !== undefined) {
    console.log(`   🏷️  [CATEGORY] Adding category filter: category_id=${args.category_id}`);
    console.log(`   🏷️  [CATEGORY] This will filter services to only those with category_id=${args.category_id} in service_to_category table`);
    
    // Diagnostic: Check how many services exist with this category_id and their location data
    try {
      const categoryCheckResult = await pool.query(
        `SELECT COUNT(*) as count FROM service_to_category WHERE category_id = $1`,
        [args.category_id]
      );
      const serviceCount = parseInt(categoryCheckResult.rows[0]?.count || '0');
      console.log(`   🏷️  [CATEGORY] DIAGNOSTIC: Found ${serviceCount} services linked to category_id=${args.category_id} in database`);
      
      if (serviceCount > 0) {
        // Get sample services with their location data
        const serviceLocationCheck = await pool.query(
          `SELECT s.id, s.name, s.country_code, s.city_name, s.admin1_name, s.city_slug
           FROM services s
           INNER JOIN service_to_category stc ON s.id = stc.service_id
           WHERE stc.category_id = $1 AND s.deleted_at IS NULL
           LIMIT 5`,
          [args.category_id]
        );
        console.log(`   🏷️  [CATEGORY] DIAGNOSTIC: Sample services with category_id=${args.category_id}:`, 
          serviceLocationCheck.rows.map(r => ({
            id: r.id,
            name: r.name,
            country_code: r.country_code,
            city_name: r.city_name,
            admin1_name: r.admin1_name,
            city_slug: r.city_slug
          }))
        );
      } else {
        console.log(`   ⚠️  [CATEGORY] WARNING: No services found with category_id=${args.category_id}! This category may not have any services yet.`);
      }
    } catch (error) {
      console.log(`   ⚠️  [CATEGORY] Could not check category count:`, error);
    }
    
    query += ` AND EXISTS (
      SELECT 1 FROM service_to_category stc
      WHERE stc.service_id = s.id AND stc.category_id = $${paramIndex}
    )`;
    queryParams.push(args.category_id);
    paramIndex++;
    filtersApplied.push('category');
  } else if (args.content_type === 'service') {
    console.log(`   ⚠️  [CATEGORY] WARNING: Service search but no category_id provided!`);
    console.log(`   ⚠️  [CATEGORY] This may return services from any category, which could be irrelevant.`);
    console.log(`   ⚠️  [CATEGORY] Expected: LLM should call lookup_service_category first, then use returned category_id.`);
  }

  // Service price range filter
  if (args.price_range !== null && args.price_range !== undefined) {
    query += ` AND srd.price_range = $${paramIndex}`;
    queryParams.push(args.price_range);
    paramIndex++;
    filtersApplied.push('price_range');
    console.log(`   💰 Adding price_range filter: ${args.price_range}`);
  }

  // Service context tags filter
  if (args.context_tags && Array.isArray(args.context_tags) && args.context_tags.length > 0) {
    query += ` AND srd.context_tags && $${paramIndex}::text[]`;
    queryParams.push(args.context_tags);
    paramIndex++;
    filtersApplied.push('context_tags');
    console.log(`   🏷️  Adding context_tags filter: ${args.context_tags.join(', ')}`);
  }

  // Full-text search on service recommendation details
  // For services: Use full-text search if available, but don't require it (allow NULL search_vector)
  let serviceFulltextApplied = false;
  if (args.intent && args.content_type === 'service') {
    // Add full-text search on service_recommendation_details.search_vector
    // Make it optional: if search_vector is NULL, this condition is true (allows service through)
    // This way services without search_vector can still be found via embedding similarity
    query += ` AND (
      srd.search_vector IS NULL OR
      srd.search_vector @@ plainto_tsquery('english', $${paramIndex})
    )`;
    queryParams.push(args.intent);
    paramIndex++;
    filtersApplied.push('service_fulltext');
    serviceFulltextApplied = true;
    console.log(`   🔍 [SERVICE] Adding optional full-text search on service details for: "${args.intent}"`);
    console.log(`   🔍 [SERVICE] Services with NULL search_vector will still be included (can match via embeddings)`);
  } else if (args.content_type === 'service' && args.intent) {
    console.log(`   ⚠️  [SERVICE] WARNING: Service search with intent but full-text search not applied!`);
    console.log(`   ⚠️  [SERVICE] Intent: "${args.intent}"`);
    console.log(`   ⚠️  [SERVICE] Will rely on embedding similarity or text matching`);
  }
  
  // Location filter
  // For places: Use PostGIS distance (ST_DWithin)
  // For services: Filter by country_code (and optionally city/state) since services don't have PostGIS geometry
  if (locationBounds) {
    console.log('   📍 Adding location filter:', {
      lat: locationBounds.lat,
      lng: locationBounds.lng,
      radiusKm: locationBounds.radiusKm,
      radiusMeters: locationBounds.radiusKm * 1000,
      country_code: locationBounds.country_code,
      city_name: locationBounds.city_name,
      admin1_name: locationBounds.admin1_name
    });
    
    // Build location filter conditions
    const locationConditions: string[] = [];
    
    // Places: Filter by PostGIS distance
    locationConditions.push(`(
      p.id IS NOT NULL AND 
      p.geom IS NOT NULL AND 
      ST_DWithin(
        p.geom::geography,
        ST_MakePoint($${paramIndex}, $${paramIndex + 1})::geography,
        $${paramIndex + 2}
      )
    )`);
    queryParams.push(locationBounds.lng, locationBounds.lat, locationBounds.radiusKm * 1000); // Convert km to meters
    paramIndex += 3;
    
    // Services: Filter by location metadata (country_code is minimum requirement)
    // IMPORTANT: Services with NULL location data should still be included (they might be valid but location not set)
    if (locationBounds.country_code) {
      const serviceConditions: string[] = [];
      serviceConditions.push(`s.id IS NOT NULL`);
      
      // Build location matching condition: either matches location OR has NULL location data
      const locationMatchConditions: string[] = [];
      
      // Match country_code
      locationMatchConditions.push(`s.country_code = $${paramIndex}`);
      queryParams.push(locationBounds.country_code);
      paramIndex++;
      
      // Optionally match city if available
      if (locationBounds.city_name) {
        locationMatchConditions.push(`s.city_name ILIKE $${paramIndex}`);
        queryParams.push(`%${locationBounds.city_name}%`);
        paramIndex++;
        console.log('   📍 [SERVICE] Filtering services by country and city (fuzzy match):', {
          country_code: locationBounds.country_code,
          city_name: locationBounds.city_name,
          city_pattern: `%${locationBounds.city_name}%`
        });
      } else {
        console.log('   📍 [SERVICE] Filtering services by country only:', {
          country_code: locationBounds.country_code
        });
      }
      
      // Optionally match state/admin1 if available and city not available
      if (!locationBounds.city_name && locationBounds.admin1_name) {
        locationMatchConditions.push(`s.admin1_name = $${paramIndex}`);
        queryParams.push(locationBounds.admin1_name);
        paramIndex++;
        console.log('   📍 [SERVICE] Also filtering by state:', {
          admin1_name: locationBounds.admin1_name
        });
      }
      
      // Include services that match location OR have NULL location data (location not set yet)
      serviceConditions.push(`(
        (${locationMatchConditions.join(' AND ')})
        OR
        (s.country_code IS NULL AND s.city_name IS NULL)
      )`);
      
      locationConditions.push(`(${serviceConditions.join(' AND ')})`);
      console.log('   📍 [SERVICE] Location filter will include services with NULL location data (location not set)');
    } else {
      // No country_code available - include all services (fallback behavior)
      console.log('   ⚠️  [SERVICE] No country_code available from location, including all services (may return irrelevant results)');
      locationConditions.push(`(s.id IS NOT NULL)`);
    }
    
    query += ` AND (${locationConditions.join(' OR ')})`;
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
  // For services: Always use embedding similarity (full-text search is now optional, so this is the primary filter)
  // For places: Use embedding similarity as primary filter
  let intentEmbeddingStr: string | null = null;
  const isServiceSearch = args.content_type === 'service';
  
  if (args.intent) {
    // Always use embedding similarity for intent matching (for both services and places)
    // For services, full-text search is optional, so embedding similarity is the primary matching method
    if (isServiceSearch) {
      console.log('   🔍 [SERVICE] Adding embedding similarity for service search:', args.intent);
    } else {
      console.log('   🔍 Adding intent filter using embedding similarity:', args.intent);
    }
    
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
      
      if (isServiceSearch) {
        console.log('      ✅ [SERVICE] Using vector similarity for service intent matching');
        console.log('      ⚠️  [SERVICE] NOTE: Services without embeddings (r.embedding IS NULL) will be excluded');
        console.log('      ⚠️  [SERVICE] Similarity threshold: < 0.3 (cosine distance) = > 0.7 similarity');
      } else {
        console.log('      ✅ Using vector similarity for intent matching');
      }
    } catch (embeddingError) {
      console.error('      ❌ Failed to generate intent embedding, falling back to text search:', embeddingError);
      // Fallback to text matching if embedding generation fails
      query += ` AND (
        r.description ILIKE $${paramIndex}
        OR COALESCE(p.name, s.name) ILIKE $${paramIndex}
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
    // No intent filter or using service fulltext - add null similarity for consistency
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
  
  // Service-specific query logging
  if (args.content_type === 'service') {
    console.log('   🔧 [SERVICE] Executing service search query...');
    console.log('   🔧 [SERVICE] Query includes service_recommendation_details join:', query.includes('service_recommendation_details'));
    console.log('   🔧 [SERVICE] Query includes service_categories join:', query.includes('service_categories'));
  }
  
  console.log('   🗄️  [STRUCTURED_SEARCH] Executing database query with', queryParams.length, 'parameters');
  console.log('   🗄️  [STRUCTURED_SEARCH] Query preview (first 500 chars):', query.substring(0, 500));
  
  const candidatesResult = await pool.query(query, queryParams);
  const candidates = candidatesResult.rows;
  console.log('   ✅ [STRUCTURED_SEARCH] Found', candidates.length, 'candidates from database');
  
  if (candidates.length === 0) {
    console.log('   ⚠️  [STRUCTURED_SEARCH] DIAGNOSTIC: Zero candidates found!');
    console.log('   ⚠️  [STRUCTURED_SEARCH] Applied filters:', filtersApplied);
    console.log('   ⚠️  [STRUCTURED_SEARCH] Query params:', queryParams.map((p, i) => `$${i + 1}: ${typeof p === 'string' && p.length > 100 ? p.substring(0, 100) + '...' : p}`));
  }
  
  // Breakdown by content type
  const serviceCandidates = candidates.filter(c => c.content_type === 'service');
  const placeCandidates = candidates.filter(c => c.content_type === 'place');
  const unclearCandidates = candidates.filter(c => c.content_type === 'unclear');
  
  console.log('   📊 [BREAKDOWN] Candidates by type:', {
    services: serviceCandidates.length,
    places: placeCandidates.length,
    unclear: unclearCandidates.length,
    total: candidates.length
  });
  
  // Log service locations if location filter was applied
  if (locationBounds && serviceCandidates.length > 0) {
    const serviceLocations = serviceCandidates.map((c: any) => ({
      service_name: c.service_name || 'Unknown',
      country_code: c.service_country_code || 'N/A',
      city_name: c.service_city_name || 'N/A',
      admin1_name: c.service_admin1_name || 'N/A'
    }));
    console.log('   📍 [SERVICE] Service locations after filter:', {
      expected_country: locationBounds.country_code,
      expected_city: locationBounds.city_name,
      expected_admin1: locationBounds.admin1_name,
      services_found: serviceCandidates.length,
      sample_locations: serviceLocations.slice(0, 3)
    });
    
    // Warn if services from wrong country are found (data quality issue)
    if (locationBounds.country_code) {
      const wrongCountryServices = serviceCandidates.filter((c: any) => 
        c.service_country_code && c.service_country_code !== locationBounds.country_code
      );
      if (wrongCountryServices.length > 0) {
        console.log('   ⚠️  [SERVICE] WARNING: Found services from different country!', {
          expected: locationBounds.country_code,
          found: wrongCountryServices.map((c: any) => ({
            name: c.service_name,
            country: c.service_country_code
          }))
        });
      }
    }
  }
  
  // Log similarity scores for services (if available)
  if (serviceCandidates.length > 0 && args.intent) {
    const servicesWithScores = serviceCandidates
      .filter(c => c.similarity !== null && c.similarity !== undefined)
      .map(c => ({ 
        id: c.recommendation_id, 
        similarity: c.similarity,
        service_name: c.service_name || 'N/A'
      }))
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    const servicesWithoutScores = serviceCandidates.filter(c => c.similarity === null || c.similarity === undefined);
    
    console.log('   🔍 [SERVICE] Similarity scores:', {
      with_scores: servicesWithScores.length,
      without_scores: servicesWithoutScores.length,
      top_similarities: servicesWithScores.slice(0, 5).map(s => ({
        name: s.service_name,
        score: s.similarity?.toFixed(3)
      }))
    });
    
    if (servicesWithScores.length > 0) {
      const avgSimilarity = servicesWithScores.reduce((sum, s) => sum + (s.similarity || 0), 0) / servicesWithScores.length;
      const maxSimilarity = Math.max(...servicesWithScores.map(s => s.similarity || 0));
      const minSimilarity = Math.min(...servicesWithScores.map(s => s.similarity || 0));
      console.log('   📊 [SERVICE] Similarity stats:', {
        avg: avgSimilarity.toFixed(3),
        max: maxSimilarity.toFixed(3),
        min: minSimilarity.toFixed(3),
        threshold: '0.7 (cosine distance < 0.3)'
      });
    }
  }
  
  if (args.content_type === 'service' && serviceCandidates.length === 0) {
    console.log('   ⚠️  [SERVICE] DIAGNOSTIC: No service candidates found in database query!');
    console.log('   ⚠️  [SERVICE] Possible issues:');
    console.log('      1. No services in network (check if user follows anyone with service recommendations)');
    console.log('      2. Service full-text search_vector is NULL or not matching');
    console.log('      3. Service embeddings not generated (r.embedding IS NULL) - THIS IS LIKELY THE ISSUE');
    console.log('      4. Service category filter too restrictive');
    console.log('      5. Location filter excluding services (city_name might not match exactly)');
    console.log('      6. Embedding similarity threshold too strict (< 0.3 cosine distance = > 0.7 similarity)');
    
    // Diagnostic: Check what services exist with the category_id in the user's network
    if (args.category_id) {
      try {
        const diagnosticQuery = `
          SELECT s.id, s.name, s.country_code, s.city_name, s.admin1_name, s.city_slug,
                 r.id as recommendation_id, r.embedding IS NOT NULL as has_embedding,
                 r.user_id, uf.follower_id IS NOT NULL as in_network
          FROM services s
          INNER JOIN service_to_category stc ON s.id = stc.service_id
          INNER JOIN recommendations r ON r.service_id = s.id
          LEFT JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
          WHERE stc.category_id = $2
            AND s.deleted_at IS NULL
            AND r.deleted_at IS NULL
            AND r.visibility IN ('friends', 'public')
          LIMIT 10
        `;
        const diagnosticResult = await pool.query(diagnosticQuery, [userId, args.category_id]);
        console.log(`   🔍 [SERVICE] DIAGNOSTIC: Services with category_id=${args.category_id} in network:`, 
          diagnosticResult.rows.length > 0 ? diagnosticResult.rows.map(r => ({
            service_id: r.id,
            service_name: r.name,
            country_code: r.country_code,
            city_name: r.city_name,
            admin1_name: r.admin1_name,
            city_slug: r.city_slug,
            recommendation_id: r.recommendation_id,
            has_embedding: r.has_embedding,
            in_network: r.in_network
          })) : 'NONE FOUND'
        );
        
        if (locationBounds && diagnosticResult.rows.length > 0) {
          console.log(`   🔍 [SERVICE] DIAGNOSTIC: Location filter comparison:`, {
            expected_country: locationBounds.country_code,
            expected_city: locationBounds.city_name,
            services_found: diagnosticResult.rows.map(r => ({
              name: r.name,
              country: r.country_code,
              city: r.city_name,
              matches_country: r.country_code === locationBounds.country_code,
              matches_city: r.city_name && locationBounds.city_name && r.city_name.toLowerCase().includes(locationBounds.city_name.toLowerCase())
            }))
          });
        }
      } catch (error) {
        console.log(`   ⚠️  [SERVICE] Could not run diagnostic query:`, error);
      }
    }
    
    // Run diagnostic query to check service embeddings
    if (args.intent) {
      try {
        const diagnosticQuery = `
          SELECT 
            COUNT(*) as total_services,
            COUNT(r.embedding) as services_with_embeddings,
            COUNT(*) - COUNT(r.embedding) as services_without_embeddings
          FROM recommendations r
          INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
          WHERE r.content_type = 'service'
            AND r.visibility IN ('friends', 'public')
            AND r.deleted_at IS NULL
        `;
        const diagnosticResult = await pool.query(diagnosticQuery, [userId]);
        const diag = diagnosticResult.rows[0];
        console.log('   🔍 [SERVICE] Embedding diagnostic:', {
          total_services: diag.total_services,
          with_embeddings: diag.services_with_embeddings,
          without_embeddings: diag.services_without_embeddings,
          embedding_coverage: diag.total_services > 0 
            ? `${((diag.services_with_embeddings / diag.total_services) * 100).toFixed(1)}%`
            : 'N/A'
        });
        
        if (parseInt(diag.services_without_embeddings) > 0) {
          console.log('   ⚠️  [SERVICE] CRITICAL: Some services are missing embeddings!');
          console.log('   ⚠️  [SERVICE] These services will be excluded from embedding similarity search');
          console.log('   ⚠️  [SERVICE] Solution: Run embedding generation script for services');
        }
      } catch (diagError) {
        console.error('   ❌ [SERVICE] Failed to run embedding diagnostic:', diagError);
      }
    }
    
    // Diagnostic query to check if services exist at all
    if (SEARCH_CONFIG.DEBUG.ENABLE_DIAGNOSTIC_QUERIES) {
      const serviceCheckResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM recommendations r
         INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
         WHERE r.content_type = 'service'
           AND r.visibility IN ('friends', 'public')
           AND r.deleted_at IS NULL`,
        [userId]
      );
      const totalServices = parseInt(serviceCheckResult.rows[0]?.total || '0');
      console.log('   📊 [SERVICE] Total services in network:', totalServices);
      
      if (totalServices > 0) {
        const serviceWithDetailsResult = await pool.query(
          `SELECT COUNT(*) as total
           FROM recommendations r
           INNER JOIN user_follows uf ON uf.following_id = r.user_id AND uf.follower_id = $1
           INNER JOIN service_recommendation_details srd ON r.id = srd.recommendation_id
           WHERE r.content_type = 'service'
             AND r.visibility IN ('friends', 'public')
             AND r.deleted_at IS NULL
             AND srd.search_vector IS NOT NULL`,
          [userId]
        );
        const servicesWithSearchVector = parseInt(serviceWithDetailsResult.rows[0]?.total || '0');
        console.log('   📊 [SERVICE] Services with search_vector:', servicesWithSearchVector);
        console.log('   📊 [SERVICE] Services without search_vector:', totalServices - servicesWithSearchVector);
      }
    }
  }
  
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
    fresh: 0,
    services: 0,
    places: 0
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
    
    // Price filter (for places - service price_range is filtered in SQL)
    if (args.max_price_inr !== null && args.max_price_inr !== undefined) {
      // For services, check service_price_range from service_recommendation_details
      if (candidate.service_id) {
        const servicePriceRange = candidate.service_price_range;
        if (servicePriceRange) {
          const priceMap: Record<string, number> = {
            '₹': 500,
            '₹₹': 1000,
            '₹₹₹': 2000,
            '₹₹₹₹': 5000,
          };
          const servicePriceValue = priceMap[servicePriceRange] || 0;
          if (servicePriceValue > args.max_price_inr) {
            filterStats.price++;
            filterStats.services++;
            if (args.content_type === 'service') {
              console.log(`   💰 [SERVICE] Filtered out service "${candidate.service_name}" - price ${servicePriceRange} (${servicePriceValue} INR) > max ${args.max_price_inr} INR`);
            }
            passed = false;
            continue;
          }
        } else {
          // Service has no price_range - allow it through
          if (args.content_type === 'service') {
            console.log(`   💰 [SERVICE] Service "${candidate.service_name}" has no price_range - allowing through`);
          }
        }
      } else {
        // For places, use existing logic
        if (!isWithinPrice(contentData, args.max_price_inr)) {
          filterStats.price++;
          filterStats.places++;
          passed = false;
          continue;
        }
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
      // Log service that passed all filters
      if (candidate.content_type === 'service' && args.content_type === 'service') {
        console.log(`   ✅ [SERVICE] Service "${candidate.service_name || 'Unknown'}" passed all filters`, {
          service_id: candidate.service_id,
          recommendation_id: candidate.recommendation_id,
          similarity: candidate.similarity?.toFixed(3) || 'N/A',
          rating: candidate.rating || 'N/A',
          price_range: candidate.service_price_range || 'N/A'
        });
      }
    }
  }
  
  // Breakdown filtered results by type
  const filteredServices = filtered.filter(c => c.content_type === 'service');
  const filteredPlaces = filtered.filter(c => c.content_type === 'place');
  
  console.log('   📊 Filter statistics:');
  console.log('      - Candidates before filters:', candidates.length);
  console.log('        • Services:', serviceCandidates.length);
  console.log('        • Places:', placeCandidates.length);
  console.log('      - Filtered out by rating:', filterStats.rating);
  console.log('      - Filtered out by price:', filterStats.price, `(services: ${filterStats.services}, places: ${filterStats.places})`);
  console.log('      - Filtered out by freshness:', filterStats.fresh);
  console.log('      - Candidates after filters:', filtered.length);
  console.log('        • Services:', filteredServices.length);
  console.log('        • Places:', filteredPlaces.length);
  
  if (args.content_type === 'service' && filteredServices.length === 0 && serviceCandidates.length > 0) {
    console.log('   ⚠️  [SERVICE] WARNING: Services found in query but ALL filtered out by post-query filters!');
    console.log('   ⚠️  [SERVICE] Check rating, price, and freshness filters');
  }
  
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
      service_price_range: rec.service_price_range,
      service_exact_price: rec.service_exact_price,
      service_category_name: rec.service_category_name,
      service_category_slug: rec.service_category_slug,
      created_at: rec.created_at,
      similarity: rec.similarity ? parseFloat(rec.similarity) : undefined
    };
  });
  
  // Final breakdown by content type
  const finalServices = recommendations.filter(r => r.content_type === 'service');
  const finalPlaces = recommendations.filter(r => r.content_type === 'place');
  
  console.log('   ✅ Structured search complete');
  console.log('      - Recommendations:', recommendations.length);
  console.log('        • Services:', finalServices.length);
  console.log('        • Places:', finalPlaces.length);
  console.log('      - Top confidence:', topConfidence);
  console.log('      - Used current location:', usedCurrentLocation);
  console.log('      - Total matched:', filtered.length);
  console.log('      - Filters applied:', [...new Set(filtersApplied)].join(', '));
  
  if (args.content_type === 'service' && finalServices.length === 0) {
    console.log('   ❌ [SERVICE] ERROR: Service search returned ZERO service results!');
    console.log('   ❌ [SERVICE] Summary:');
    console.log('      - Service candidates from DB:', serviceCandidates.length);
    console.log('      - Services after filters:', filteredServices.length);
    console.log('      - Final service recommendations:', finalServices.length);
    console.log('   ❌ [SERVICE] This indicates a problem in the service search pipeline');
  }
  
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

