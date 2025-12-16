// Build the SaveRecommendationRequest payload expected by the backend
// Centralizes mapping from collected form state to API DTO

import { type ContentType } from '@/components/composer/constants';

export type { ContentType };

export interface LocationData {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  google_place_id?: string;
  city_name?: string;
  admin1_name?: string;
  country_code?: string;
  location_text?: string; // raw text such as "Goa" or "Delhi, India"
}

export interface BuildDtoInput {
  contentType: ContentType;
  extractedData: Record<string, any>;
  fieldResponses: Record<string, any>;
  formattedRecommendation: string; // final formatted text
  rating?: number | null;
  currentUserId: string;
  labels?: string[]; // AI-generated labels
}

export interface SaveRecommendationRequestDTO {
  content_type?: ContentType;
  title?: string;
  description?: string;
  content_data?: Record<string, any>;
  google_place_id?: string;
  place_name?: string;
  place_address?: string;
  place_lat?: number;
  place_lng?: number;
  place_category?: string | null;
  place_metadata?: Record<string, any>;
  // Service data
  service_name?: string;
  service_phone?: string;
  service_email?: string;
  service_type?: string;
  service_address?: string;
  service_website?: string;
  service_metadata?: Record<string, any>;
  rating?: number | null;
  visibility?: 'friends' | 'public';
  labels?: string[];
  user_id: string;
}

function extractLocation(data: Record<string, any>): LocationData {
  // For services, check if city_location is provided as structured data
  const cityLocation = data.city_location;
  const loc: LocationData = {
    name: data.name || data.location_name,
    address: data.location || data.location_address || data.service_address,
    lat: data.lat || data.location_lat || data.city_lat,
    lng: data.lng || data.location_lng || data.city_lng,
    google_place_id: data.google_place_id || data.location_google_place_id,
    // attempt to collect normalized fields if present in form/extracted data
    // Priority: city_location object > direct fields > fallback to city string
    city_name: cityLocation?.city_name || data.city_name || data.city || data.location_city,
    admin1_name: cityLocation?.admin1_name || data.admin1_name || data.admin1 || data.state || data.location_admin1,
    country_code: cityLocation?.country_code || (data.country_code || data.country || data.location_country || '').toString().toUpperCase() || undefined,
    location_text: typeof data.location === 'string' ? data.location : (typeof data.location_address === 'string' ? data.location_address : (cityLocation?.name || undefined)),
  };
  return loc;
}

export function buildSaveRecommendationDto(input: BuildDtoInput): SaveRecommendationRequestDTO {
  const { contentType, extractedData, fieldResponses, formattedRecommendation, rating, currentUserId, labels } = input;
  const combined = { ...extractedData, ...fieldResponses } as Record<string, any>;
  const location = extractLocation(combined);

  const toSlug = (s?: string) => (typeof s === 'string' && s.trim().length > 0 ? s.trim().toLowerCase().replace(/\s+/g, '-') : undefined);

  // Derive a safe city name; NEVER fall back to the entity name.
  const parseCityFromText = (text?: string): string | undefined => {
    if (!text || typeof text !== 'string') return undefined;
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    // Take the first token before a comma; handles strings like "Goa" or "Mumbai, India"
    const first = trimmed.split(',')[0]?.trim();
    return first || undefined;
  };
  const inferredCityName = location.city_name
    || combined.location_city
    || combined.city
    || combined.location_name
    || parseCityFromText(location.location_text);
  const content_data: Record<string, any> = {
    place_name: location.name,
    address: location.address,
    coordinates: location.lat && location.lng ? { lat: location.lat, lng: location.lng } : undefined,
    category: combined.category,
    // Removed deprecated fields: best_times, tips
    contact_info: combined.contact_info,
    highlights: combined.highlights,
    google_place_id: location.google_place_id,
    // normalized location fields: included at root and under location for backend compatibility
    city_name: inferredCityName || undefined,
    city_slug: inferredCityName ? toSlug(inferredCityName) : undefined,
    admin1_name: location.admin1_name,
    country_code: location.country_code,
    location: {
      city_name: inferredCityName || undefined,
      city_slug: inferredCityName ? toSlug(inferredCityName) : undefined,
      admin1_name: location.admin1_name,
      country_code: location.country_code,
    },
    additional_details: { ...fieldResponses }
  };

  // Add service-specific fields if this is a service recommendation
  if (contentType === 'service') {
    content_data.service_rating = combined.service_rating || rating || null;
    content_data.service_price_range = combined.service_price_range || null;
    content_data.service_exact_price = combined.exact_price || null;
    content_data.service_experience = combined.service_experience || combined.description || formattedRecommendation;
    content_data.service_quote = combined.service_quote || combined.verbatim_quote || null;
    content_data.service_category_id = combined.service_category_id || null;
    content_data.context_tags = combined.context_tags || [];
    // Add phone country code for services
    content_data.phone_country_code = combined.phone_country_code || undefined;
    // Add structured location fields for services (from city_location)
    const cityLocation = combined.city_location;
    if (cityLocation) {
      content_data.city_name = cityLocation.city_name || location.city_name;
      content_data.city_slug = cityLocation.city_name ? toSlug(cityLocation.city_name) : location.city_name ? toSlug(location.city_name) : undefined;
      content_data.admin1_name = cityLocation.admin1_name || location.admin1_name;
      content_data.country_code = cityLocation.country_code || location.country_code;
    }
  }

  const dto: SaveRecommendationRequestDTO = {
    content_type: contentType,
    google_place_id: location.google_place_id,
    place_name: location.name,
    place_address: location.address,
    place_lat: location.lat,
    place_lng: location.lng,
    place_category: combined.category || null,
    place_metadata: {
      contact_info: combined.contact_info,
      highlights: combined.highlights,
      // Removed deprecated fields: best_times, tips
      type: combined.type,
      google_place_id: location.google_place_id
    },
    // Service fields (only populated if content_type is 'service')
    service_name: contentType === 'service' ? (combined.service_name || combined.name || location.name) : undefined,
    service_phone: contentType === 'service' ? (combined.service_phone || combined.contact_info?.phone) : undefined,
    service_email: contentType === 'service' ? (combined.service_email || combined.contact_info?.email) : undefined,
    // Backend will derive service_type from service_category_id
    service_type: contentType === 'service' ? combined.service_type : undefined,
    service_address: contentType === 'service' ? (combined.service_address || location.address) : undefined,
    service_website: contentType === 'service' ? combined.service_website : undefined,
    service_metadata: contentType === 'service' ? {
      contact_info: combined.contact_info,
      ...combined.service_metadata
    } : undefined,
    // Title removed - backend derives from place_name or service_name
    // Always set description so backend validation passes.
    // For services, this will typically mirror the experience summary,
    // but the UI for service posts will only render the structured
    // service experience card to avoid duplicate text.
    description: formattedRecommendation,
    content_data,
    rating: rating || combined.rating || null,
    visibility: 'friends',
    labels: labels || [],
    user_id: currentUserId
  };

  return dto;
}






