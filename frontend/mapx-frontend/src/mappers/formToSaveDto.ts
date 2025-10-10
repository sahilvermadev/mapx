// Build the SaveRecommendationRequest payload expected by the backend
// Centralizes mapping from collected form state to API DTO

export type ContentType = 'place' | 'service' | 'tip' | 'contact' | 'unclear';

export interface LocationData {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  google_place_id?: string;
}

export interface BuildDtoInput {
  contentType: ContentType;
  extractedData: Record<string, any>;
  fieldResponses: Record<string, any>;
  formattedRecommendation: string; // final formatted text
  rating?: number | null;
  currentUserId: string;
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
    google_place_id: data.google_place_id || data.location_google_place_id
  };
  return loc;
}

export function buildSaveRecommendationDto(input: BuildDtoInput): SaveRecommendationRequestDTO {
  const { contentType, extractedData, fieldResponses, formattedRecommendation, rating, currentUserId } = input;
  const combined = { ...extractedData, ...fieldResponses } as Record<string, any>;
  const location = extractLocation(combined);

  const content_data: Record<string, any> = {
    place_name: location.name,
    address: location.address,
    coordinates: location.lat && location.lng ? { lat: location.lat, lng: location.lng } : undefined,
    category: combined.category,
    best_times: combined.best_times,
    tips: combined.tips,
    contact_info: combined.contact_info,
    specialities: combined.specialities,
    google_place_id: location.google_place_id,
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
      specialities: combined.specialities,
      best_times: combined.best_times,
      tips: combined.tips,
      type: combined.type,
      google_place_id: location.google_place_id
    },
    title: combined.name || location.name,
    description: formattedRecommendation,
    content_data,
    rating: rating || combined.rating || null,
    visibility: 'public',
    labels: Array.isArray(combined.specialities)
      ? combined.specialities
      : combined.specialities
      ? [combined.specialities]
      : [],
    user_id: currentUserId
  };

  return dto;
}






