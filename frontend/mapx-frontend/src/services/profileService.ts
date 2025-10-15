import { apiClient } from './apiClient';

// Types for profile data
export interface UserData {
  id: string;
  displayName: string;
  email: string;
  username?: string;
  profilePictureUrl?: string;
  created_at: string;
  last_login_at: string;
}

export interface UserStats {
  total_recommendations: number;
  total_likes: number;
  total_saved: number;
  average_rating: number;
  total_places_visited: number;
  total_reviews: number;
}


export interface FilterOptions {
  rating?: number;
  visibility?: 'public' | 'friends' | 'all';
  category?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  content_type?: 'place' | 'service' | 'all';
}

export interface SortOptions {
  field: 'created_at' | 'rating' | 'place_name' | 'visit_date' | 'category';
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface ProfileApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Profile API Service
class ProfileApiService {
  /**
   * Get user profile data
   */
  async getUserProfile(userId: string): Promise<UserData> {
    const response = await apiClient.get<UserData>(`/profile/${userId}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch user profile');
    }
    
    return response.data;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const response = await apiClient.get<UserStats>(`/profile/${userId}/stats`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch user stats');
    }
    
    return response.data;
  }

  /**
   * Get user recommendations with filtering and sorting
   */
  async getUserRecommendations(
    userId: string, 
    filters: FilterOptions = {}, 
    sort: SortOptions = { field: 'created_at', direction: 'desc' },
    pagination: PaginationOptions = { limit: 20, offset: 0 }
  ): Promise<{ data: any[], pagination: any }> {
    const params = {
      ...filters,
      sort_field: sort.field,
      sort_direction: sort.direction,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    const response = await apiClient.get<any[]>(`/profile/${userId}/recommendations`, params);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch recommendations');
    }
    
    return {
      data: response.data || [],
      pagination: response.pagination || { total: 0, page: 1, limit: pagination.limit, totalPages: 0 }
    };
  }

  /**
   * Get user likes with sorting
   */
  async getUserLikes(
    userId: string, 
    sort: SortOptions = { field: 'created_at', direction: 'desc' },
    pagination: PaginationOptions = { limit: 20, offset: 0 }
  ): Promise<{ data: any[], pagination: any }> {
    const params = {
      sort_field: sort.field,
      sort_direction: sort.direction,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    const response = await apiClient.get<any[]>(`/profile/${userId}/likes`, params);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch likes');
    }
    
    return {
      data: response.data || [],
      pagination: response.pagination || { total: 0, page: 1, limit: pagination.limit, totalPages: 0 }
    };
  }

  /**
   * Get user saved places with sorting
   */
  async getUserSaved(
    userId: string, 
    sort: SortOptions = { field: 'created_at', direction: 'desc' },
    pagination: PaginationOptions = { limit: 20, offset: 0 }
  ): Promise<{ data: any[], pagination: any }> {
    const params = {
      sort_field: sort.field,
      sort_direction: sort.direction,
      limit: pagination.limit,
      offset: pagination.offset,
    };

    const response = await apiClient.get<any[]>(`/profile/${userId}/saved`, params);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch saved places');
    }
    
    return {
      data: response.data || [],
      pagination: response.pagination || { total: 0, page: 1, limit: pagination.limit, totalPages: 0 }
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserData>): Promise<UserData> {
    const response = await apiClient.put<UserData>(`/profile/${userId}`, updates);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update profile');
    }
    
    return response.data;
  }

  /**
   * Delete a recommendation
   */
  async deleteRecommendation(annotationId: number): Promise<boolean> {
    const response = await apiClient.delete(`/recommendations/${annotationId}`);
    return response.success;
  }

  /**
   * Unlike a place
   */
  async unlikePlace(placeId: number): Promise<boolean> {
    const response = await apiClient.delete(`/profile/likes/${placeId}`);
    return response.success;
  }

  /**
   * Remove from saved
   */
  async removeFromSaved(placeId: number): Promise<boolean> {
    const response = await apiClient.delete(`/profile/saved/${placeId}`);
    return response.success;
  }
}

// Export singleton instance
export const profileApi = new ProfileApiService(); 