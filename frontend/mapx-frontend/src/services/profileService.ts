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

export type ThemeName = 'neo-brutal' | 'ocean' | 'sunset' | 'forest' | 'monochrome';

export interface Theme {
  name: ThemeName;
  displayName: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  patternEnabled: boolean;
}

export const THEMES: Record<ThemeName, Theme> = {
  'neo-brutal': {
    name: 'neo-brutal',
    displayName: 'Sunflower',
    accentColor: '#FFE66D', // Yellow
    backgroundColor: '#FFF9E6', // Light yellow
    textColor: '#000000',
    patternEnabled: false,
  },
  'ocean': {
    name: 'ocean',
    displayName: 'Ocean',
    accentColor: '#4ECDC4', // Teal
    backgroundColor: '#F0FDFC', // Light teal
    textColor: '#000000',
    patternEnabled: false,
  },
  'sunset': {
    name: 'sunset',
    displayName: 'Cotton Candy',
    accentColor: '#FF6B6B', // Red
    backgroundColor: '#FFF5F5', // Light pink
    textColor: '#000000',
    patternEnabled: false,
  },
  'forest': {
    name: 'forest',
    displayName: 'Forest',
    accentColor: '#95D5B2', // Green
    backgroundColor: '#F6FFFA', // Light green
    textColor: '#000000',
    patternEnabled: false,
  },
  'monochrome': {
    name: 'monochrome',
    displayName: 'Monochrome',
    accentColor: '#000000', // Black
    backgroundColor: '#FFFFFF', // White
    textColor: '#000000',
    patternEnabled: true, // Dotted pattern
  },
};

export interface ProfilePreferences {
  bannerUrl?: string;
  theme?: ThemeName;
  font?: 'default' | 'serif' | 'mono' | 'sans-bold' | 'cursive';
}

export interface UserStats {
  total_recommendations: number;
  total_likes: number;
  total_questions: number;
  total_saved: number;
  average_rating: number;
  total_cities_visited: number;
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
  city_slug?: string;
  categories?: string[];
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

  async getUserPreferences(userId: string): Promise<ProfilePreferences> {
    const response = await apiClient.get<ProfilePreferences>(`/profile/${userId}/preferences`);
    if (!('success' in response) || !(response as any).success) {
      // Fallback shape
      return {} as ProfilePreferences;
    }
    return (response as any).data || {};
  }

  async updateUserPreferences(userId: string, prefs: ProfilePreferences): Promise<ProfilePreferences> {
    const response = await apiClient.put<ProfilePreferences>(`/profile/${userId}/preferences`, prefs);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to save preferences');
    }
    return response.data;
  }

  /**
   * Upload banner image
   */
  async uploadBannerImage(userId: string, file: File): Promise<{ bannerUrl: string }> {
    const formData = new FormData();
    formData.append('banner', file);
    
    // Use axios directly for multipart/form-data uploads
    const axios = (await import('axios')).default;
    const token = localStorage.getItem('accessToken');
    const { getApiBaseUrl } = await import('@/config/apiConfig');
    const baseURL = getApiBaseUrl();
    
    try {
      const response = await axios.post(
        `${baseURL}/profile/${userId}/banner`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - axios will set it automatically with boundary for FormData
          },
          maxContentLength: 10 * 1024 * 1024, // 10MB
          maxBodyLength: 10 * 1024 * 1024, // 10MB
        }
      );
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to upload banner image');
      }
      
      return response.data.data;
    } catch (error: any) {
      // Provide more detailed error message
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      if (error.response?.data?.details) {
        throw new Error(`${error.response.data.error}: ${error.response.data.details}`);
      }
      throw error;
    }
  }

  /**
   * Delete banner image
   */
  async deleteBannerImage(userId: string): Promise<void> {
    const response = await apiClient.delete(`/profile/${userId}/banner`);
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete banner image');
    }
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

  /**
   * Get user's questions
   */
  async getUserQuestions(userId: string): Promise<{ data: any[] }> {
    const response = await apiClient.get<any[]>(`/profile/${userId}/questions`);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch user questions');
    }
    
    return {
      data: response.data || []
    };
  }

}

// Export singleton instance
export const profileApi = new ProfileApiService(); 