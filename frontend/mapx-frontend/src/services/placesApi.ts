// Places API (New) service
// Based on: https://developers.google.com/maps/documentation/places/web-service

const PLACES_API_BASE_URL = 'https://places.googleapis.com/v1';

export interface PlaceSearchRequest {
  location?: {
    latitude: number;
    longitude: number;
  };
  radius?: number;
  type?: string;
  query?: string;
  maxResultCount?: number;
}

export interface PlaceDetails {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  types: string[];
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
  }>;
  rating?: number;
  userRatingCount?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  placeId: string;
}

export interface NearbySearchResponse {
  places: PlaceDetails[];
  nextPageToken?: string;
}

export interface TextSearchResponse {
  places: PlaceDetails[];
  nextPageToken?: string;
}

class PlacesApiService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const url = new URL(`${PLACES_API_BASE_URL}${endpoint}`);
    
    // Add API key
    url.searchParams.append('key', this.apiKey);
    
    // Add other parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Places API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Places API request failed:', error);
      throw error;
    }
  }

  // Nearby Search - equivalent to nearbySearch in Legacy API
  async nearbySearch(request: PlaceSearchRequest): Promise<NearbySearchResponse> {
    const params: Record<string, any> = {};
    
    if (request.location) {
      params.locationRestriction = {
        circle: {
          center: request.location,
          radius: request.radius || 500
        }
      };
    }
    
    if (request.type) {
      params.includedTypes = [request.type];
    }
    
    if (request.maxResultCount) {
      params.maxResultCount = request.maxResultCount;
    }

    return this.makeRequest('/places:searchNearby', params);
  }

  // Text Search - equivalent to textSearch in Legacy API
  async textSearch(request: PlaceSearchRequest): Promise<TextSearchResponse> {
    const params: Record<string, any> = {};
    
    if (request.query) {
      params.textQuery = request.query;
    }
    
    if (request.location) {
      params.locationRestriction = {
        circle: {
          center: request.location,
          radius: request.radius || 500
        }
      };
    }
    
    if (request.type) {
      params.includedTypes = [request.type];
    }
    
    if (request.maxResultCount) {
      params.maxResultCount = request.maxResultCount;
    }

    return this.makeRequest('/places:searchText', params);
  }

  // Get Place Details - equivalent to getDetails in Legacy API
  async getPlaceDetails(placeId: string, fields: string[] = ['id', 'displayName', 'formattedAddress', 'types', 'photos', 'rating', 'userRatingCount', 'location']): Promise<PlaceDetails> {
    const params = {
      fields: fields.join(',')
    };

    return this.makeRequest(`/places/${placeId}`, params);
  }

  // Find Place - equivalent to findPlaceFromQuery in Legacy API
  async findPlace(query: string, fields: string[] = ['id', 'displayName', 'formattedAddress', 'types', 'photos', 'rating', 'userRatingCount', 'location']): Promise<PlaceDetails[]> {
    const params = {
      textQuery: query,
      fields: fields.join(',')
    };

    const response = await this.makeRequest('/places:findPlace', params);
    return response.places || [];
  }

  // Convert New API PlaceDetails to your existing PlaceDetails format
  convertToLegacyFormat(place: PlaceDetails): any {
    return {
      place_id: place.placeId,
      name: place.displayName.text,
      formatted_address: place.formattedAddress,
      types: place.types,
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      geometry: place.location ? {
        location: {
          lat: () => place.location!.latitude,
          lng: () => place.location!.longitude
        }
      } : undefined,
      photos: place.photos?.map(photo => ({
        getUrl: () => `https://places.googleapis.com/v1/${photo.name}/media?key=${this.apiKey}&maxWidthPx=400`
      })) || [],
      vicinity: place.formattedAddress
    };
  }
}

export const placesApiService = new PlacesApiService(); 