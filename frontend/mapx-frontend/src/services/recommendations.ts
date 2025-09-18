import { apiClient } from './api';

// Types matching your backend API
export interface SaveRecommendationRequest {
  // Place data
  google_place_id?: string;
  place_name: string;
  place_address?: string;
  place_lat?: number;
  place_lng?: number;
  place_metadata?: Record<string, any>;
  place_category?: string; // Add category for the place
  
  // Annotation data
  title?: string;
  went_with?: string[];
  labels?: string[];
  notes?: string;
  metadata?: Record<string, any>;
  visit_date?: string;
  rating?: number;
  visibility?: 'friends' | 'public';
  
  // Note: user_id will be extracted from JWT automatically
}

export interface SaveRecommendationResponse {
  success: boolean;
  place_id: number;
  annotation_id: number;
  message: string;
}

export interface UserRecommendation {
  id: number;
  place_name: string;
  place_address?: string;
  title?: string;
  notes?: string;
  rating?: number;
  visit_date?: string;
  created_at: string;
}

export interface PlaceRecommendation {
  id: number;
  user_name: string;
  title?: string;
  notes?: string;
  rating?: number;
  visit_date?: string;
  created_at: string;
}

export interface PlaceInfo {
  id: number;
  google_place_id?: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  metadata?: Record<string, any>;
}

// Semantic search types
export interface SearchRecommendation {
  annotation_id: number;
  user_name: string;
  notes?: string;
  rating?: number;
  visit_date?: string;
  labels?: string[];
  went_with?: string[];
  metadata?: Record<string, any>;
  similarity: number;
  created_at: string;
}

export interface SearchResult {
  place_id: number;
  place_name: string;
  place_address?: string;
  place_lat?: number;
  place_lng?: number;
  google_place_id?: string;
  recommendations: SearchRecommendation[];
  average_similarity: number;
  total_recommendations: number;
}

export interface SearchResponse {
  query: string;
  summary: string;
  results: SearchResult[];
  total_places: number;
  total_recommendations: number;
  search_metadata: {
    threshold: number;
    limit: number;
    query_processed: boolean;
  };
}

// Interface for reviewed places
export interface ReviewedPlace {
  id: number;
  google_place_id?: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  metadata?: Record<string, any>;
  category_name?: string;
  review_count: number;
  average_rating: number;
  latest_review_date: string;
  created_at: string;
  updated_at: string;
}

// Recommendation API functions
export const recommendationsApi = {
  /**
   * Get place information by Google Place ID
   */
  async getPlaceByGoogleId(googlePlaceId: string): Promise<PlaceInfo | null> {
    const response = await apiClient.get<PlaceInfo>(`/recommendations/place/google/${googlePlaceId}`);
    
    if (!response.success || !response.data) {
      return null;
    }
    
    return response.data;
  },

  /**
   * Save a new recommendation
   * Automatically extracts user_id from JWT token
   */
  async saveRecommendation(data: SaveRecommendationRequest): Promise<SaveRecommendationResponse> {
    // Get user ID from JWT token (no need to pass it in the request)
    const user = apiClient.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const response = await apiClient.post<SaveRecommendationResponse>('/recommendations/save', {
      ...data,
      user_id: user.id, // Automatically added from JWT
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to save recommendation');
    }
    
    return response.data;
  },

  /**
   * Get recommendations for the current user
   */
  async getMyRecommendations(limit = 50, offset = 0): Promise<UserRecommendation[]> {
    const user = apiClient.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const response = await apiClient.get<UserRecommendation[]>(`/recommendations/user/${user.id}`, {
      limit,
      offset,
    });
    
    return response.data || [];
  },

  /**
   * Get recommendations for a specific place
   */
  async getPlaceRecommendations(placeId: number, visibility: 'friends' | 'public' | 'all' = 'all', limit = 50): Promise<PlaceRecommendation[]> {
    const response = await apiClient.get<PlaceRecommendation[]>(`/recommendations/place/${placeId}`, {
      visibility,
      limit,
    });
    
    return response.data || [];
  },

  /**
   * Update an existing recommendation
   */
  async updateRecommendation(annotationId: number, updates: Partial<SaveRecommendationRequest>): Promise<boolean> {
    const response = await apiClient.put(`/recommendations/${annotationId}`, updates);
    return response.success;
  },

  /**
   * Delete a recommendation
   */
  async deleteRecommendation(annotationId: number): Promise<boolean> {
    const response = await apiClient.delete(`/recommendations/${annotationId}`);
    return response.success;
  },

  /**
   * Get all places that have reviews/annotations
   */
  async getReviewedPlaces(
    visibility: 'friends' | 'public' | 'all' = 'all',
    limit = 100,
    offset = 0
  ): Promise<ReviewedPlace[]> {
    const response = await apiClient.get<ReviewedPlace[]>('/recommendations/places/reviewed', {
      visibility,
      limit,
      offset,
    });
    
    return response.data || [];
  },

  /**
   * Perform semantic search for places and recommendations
   */
  async semanticSearch(query: string, limit = 10, threshold = 0.7): Promise<SearchResponse> {
    const response = await apiClient.post<SearchResponse>('/recommendations/search', {
      query: query.trim(),
      limit,
      threshold,
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Search failed');
    }
    
    return response.data;
  },
}; 