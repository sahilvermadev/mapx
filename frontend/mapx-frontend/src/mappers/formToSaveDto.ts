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
  rating?: number | null;
  visibility?: 'friends' | 'public';
  labels?: string[];
  user_id: string;
}

function extractLocation(data: Record<string, any>): LocationData {
  const loc: LocationData = {
    name: data.name || data.location_name,
    address: data.location || data.location_address,
    lat: data.lat || data.location_lat,
    lng: data.lng || data.location_lng,
    google_place_id: data.google_place_id || data.location_google_place_id,
    // attempt to collect normalized fields if present in form/extracted data
    city_name: data.city_name || data.city || data.location_city,
    admin1_name: data.admin1_name || data.admin1 || data.state || data.location_admin1,
    country_code: (data.country_code || data.country || data.location_country || '').toString().toUpperCase() || undefined,
    location_text: typeof data.location === 'string' ? data.location : (typeof data.location_address === 'string' ? data.location_address : undefined),
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
    title: combined.name || location.name,
    description: formattedRecommendation,
    content_data,
    rating: rating || combined.rating || null,
    visibility: 'friends',
    labels: labels || [],
    user_id: currentUserId
  };

  return dto;
}






