import { apiClient } from './apiClient';

// Types for profile data
export interface UserData {
  id: string;
  displayName: string;
  email: string;
  username?: string;
  profilePictureUrl?: string;
  bio?: string | null;
  city?: string | null;
  created_at: string;
  last_login_at: string;
  followers_count?: number;
  following_count?: number;
}

export type ThemeName = 'neo-brutal' | 'ocean' | 'sunset' | 'forest' | 'monochrome' | 'dark';

export interface Theme {
  name: ThemeName;
  displayName: string;
  
  // Core Basics
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  patternEnabled: boolean; // For backgrounds like dots/grids
  
  // Component Specifics
  headerBackground: string;
  headerText: string;
  headerBorder: string;
  
  // Button Variants
  buttonPrimary: {
    background: string;
    text: string;
    hover: string;
    border?: string;
  };
  buttonSecondary: {
    background: string;
    text: string;
    hover: string;
    border?: string;
  };
  buttonGhost: {
    text: string;
    hover: string;
  };
  
  // Borders & Dividers
  borderColor: string;
  borderColorMuted: string; // Faint dividers
  
  // Typography Tokens
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHighlight: string; // For selection or highlights
  
  // Interactive States
  hoverBackground: string;
  activeBackground: string;
  selectedBackground: string;
  
  // Form Elements
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  
  // Card/Post Background
  cardBackground: string; // Background for feed posts and cards
  
  // Tag/Pill Styling
  tagStyle: {
    background: string | { from: string; to: string };
    textColor: string;
    borderColor?: string;
    borderWidth?: string;
    shadow?: string;
    hoverBackground?: string | { from: string; to: string };
  };
}

export const THEMES: Record<ThemeName, Theme> = {
  'neo-brutal': {
    name: 'neo-brutal',
    displayName: 'Sunflower',
    accentColor: '#FFD93D', // Punchy Yellow
    backgroundColor: '#FFFDF5', // Warm Off-White
    textColor: '#18181B', // Zinc-900
    patternEnabled: false,
    
    headerBackground: '#FFD93D',
    headerText: '#18181B',
    headerBorder: '#18181B',
    buttonPrimary: {
      background: '#18181B',
      text: '#FFD93D',
      hover: '#3F3F46',
      border: 'none'
    },
    buttonSecondary: {
      background: '#FFD93D',
      text: '#18181B',
      hover: '#FCD34D',
      border: '2px solid #18181B'
    },
    buttonGhost: {
      text: '#18181B',
      hover: 'rgba(255, 217, 61, 0.3)',
    },
    borderColor: '#18181B', // Stark borders
    borderColorMuted: 'rgba(24, 24, 27, 0.2)',
    textPrimary: '#18181B',
    textSecondary: '#451A03', // Deep Brown
    textMuted: '#78716C',
    textHighlight: '#FFD93D',
    hoverBackground: '#FFFBEB',
    activeBackground: '#FEF3C7',
    selectedBackground: '#FDE68A',
    inputBackground: '#FFFFFF',
    inputBorder: '#18181B',
    inputText: '#18181B',
    inputPlaceholder: '#78716C',
    cardBackground: '#FFFFFF',
    tagStyle: {
      background: '#FFD93D',
      textColor: '#18181B',
      borderColor: '#18181B',
      borderWidth: '2px',
      shadow: '4px 4px 0px 0px #18181B', // Hard shadow for brutalism
      hoverBackground: '#FCD34D',
    },
  },
  'ocean': {
    name: 'ocean',
    displayName: 'Ocean',
    accentColor: '#06B6D4', // Cyan-500
    backgroundColor: '#ECFEFF', // Cyan-50
    textColor: '#0F172A', // Slate-900
    patternEnabled: false,
    headerBackground: '#CFFAFE', // Cyan-100
    headerText: '#155E75', // Cyan-800
    headerBorder: 'transparent',
    buttonPrimary: {
      background: '#06B6D4',
      text: '#FFFFFF',
      hover: '#0891B2',
    },
    buttonSecondary: {
      background: '#FFFFFF',
      text: '#0891B2',
      hover: '#E0F2FE',
      border: '1px solid #A5F3FC'
    },
    buttonGhost: {
      text: '#155E75',
      hover: 'rgba(6, 182, 212, 0.1)',
    },
    borderColor: '#A5F3FC', // Cyan-200
    borderColorMuted: 'rgba(165, 243, 252, 0.5)',
    textPrimary: '#164E63', // Cyan-900
    textSecondary: '#0E7490', // Cyan-700
    textMuted: '#64748B', // Slate-500
    textHighlight: '#67E8F9',
    hoverBackground: '#E0F2FE', // Sky-100
    activeBackground: '#BAE6FD', // Sky-200
    selectedBackground: '#A5F3FC', // Cyan-200
    inputBackground: '#FFFFFF',
    inputBorder: '#67E8F9',
    inputText: '#155E75',
    inputPlaceholder: '#94A3B8',
    cardBackground: '#FFFFFF',
    tagStyle: {
      background: { from: '#E0F2FE', to: '#CFFAFE' }, // Subtle gradient
      textColor: '#0E7490',
      borderColor: '#67E8F9',
      borderWidth: '1px',
      shadow: '0 2px 4px rgba(6, 182, 212, 0.1)',
      hoverBackground: '#BAE6FD',
    },
  },
  'sunset': {
    name: 'sunset',
    displayName: 'Cotton Candy',
    accentColor: '#FB7185', // Rose-400
    backgroundColor: '#FFF1F2', // Rose-50
    textColor: '#4C0519', // Rose-950
    patternEnabled: false,
    headerBackground: '#FFE4E6', // Rose-100
    headerText: '#9F1239', // Rose-800
    headerBorder: 'transparent',
    buttonPrimary: {
      background: '#E11D48', // Rose-600
      text: '#FFFFFF',
      hover: '#BE123C', // Rose-700
    },
    buttonSecondary: {
      background: '#FFFFFF',
      text: '#E11D48',
      hover: '#FFF1F2',
      border: '1px solid #FECDD3'
    },
    buttonGhost: {
      text: '#9F1239',
      hover: 'rgba(251, 113, 133, 0.1)',
    },
    borderColor: '#FECDD3', // Rose-200
    borderColorMuted: 'rgba(254, 205, 211, 0.5)',
    textPrimary: '#881337', // Rose-900
    textSecondary: '#9F1239', // Rose-800
    textMuted: '#9CA3AF', // Gray-400
    textHighlight: '#FDA4AF',
    hoverBackground: '#FFF1F2',
    activeBackground: '#FFE4E6',
    selectedBackground: '#FECDD3',
    inputBackground: '#FFFFFF',
    inputBorder: '#FDA4AF',
    inputText: '#881337',
    inputPlaceholder: '#CBD5E1',
    cardBackground: '#FFFFFF',
    tagStyle: {
      background: '#FFF1F2',
      textColor: '#BE123C',
      borderColor: '#FB7185',
      borderWidth: '1px',
      shadow: 'none',
      hoverBackground: '#FFE4E6',
    },
  },
  'forest': {
    name: 'forest',
    displayName: 'Forest',
    accentColor: '#10B981', // Emerald-500
    backgroundColor: '#F0FDF4', // Emerald-50
    textColor: '#022C22', // Emerald-950
    patternEnabled: false,
    headerBackground: '#D1FAE5', // Emerald-100
    headerText: '#065F46', // Emerald-800
    headerBorder: 'transparent',
    buttonPrimary: {
      background: '#059669', // Emerald-600
      text: '#FFFFFF',
      hover: '#047857', // Emerald-700
    },
    buttonSecondary: {
      background: '#FFFFFF',
      text: '#059669',
      hover: '#ECFDF5',
      border: '1px solid #6EE7B7'
    },
    buttonGhost: {
      text: '#065F46',
      hover: 'rgba(16, 185, 129, 0.1)',
    },
    borderColor: '#A7F3D0', // Emerald-200
    borderColorMuted: 'rgba(167, 243, 208, 0.5)',
    textPrimary: '#064E3B', // Emerald-900
    textSecondary: '#047857', // Emerald-700
    textMuted: '#6B7280', // Gray-500
    textHighlight: '#6EE7B7',
    hoverBackground: '#ECFDF5',
    activeBackground: '#D1FAE5',
    selectedBackground: '#A7F3D0',
    inputBackground: '#FFFFFF',
    inputBorder: '#34D399',
    inputText: '#064E3B',
    inputPlaceholder: '#9CA3AF',
    cardBackground: '#FFFFFF',
    tagStyle: {
      background: '#ECFDF5',
      textColor: '#047857',
      borderColor: '#34D399',
      borderWidth: '1px',
      shadow: '0 1px 2px rgba(0,0,0,0.05)',
      hoverBackground: '#D1FAE5',
    },
  },
  'monochrome': {
    name: 'monochrome',
    displayName: 'Monochrome',
    accentColor: '#000000',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
    patternEnabled: true, // Dots or Grid
    headerBackground: '#FFFFFF',
    headerText: '#000000',
    headerBorder: '#E5E5E5',
    buttonPrimary: {
      background: '#000000',
      text: '#FFFFFF',
      hover: '#333333',
    },
    buttonSecondary: {
      background: '#FFFFFF',
      text: '#000000',
      hover: '#F5F5F5',
      border: '1px solid #000000'
    },
    buttonGhost: {
      text: '#000000',
      hover: '#F5F5F5',
    },
    borderColor: '#E5E5E5', // Neutral-200
    borderColorMuted: '#F5F5F5', // Neutral-100
    textPrimary: '#000000',
    textSecondary: '#525252', // Neutral-600
    textMuted: '#A3A3A3', // Neutral-400
    textHighlight: '#E5E5E5',
    hoverBackground: '#FAFAFA',
    activeBackground: '#F5F5F5',
    selectedBackground: '#E5E5E5',
    inputBackground: '#FAFAFA',
    inputBorder: '#D4D4D4',
    inputText: '#000000',
    inputPlaceholder: '#A3A3A3',
    cardBackground: '#FFFFFF',
    tagStyle: {
      background: '#FFFFFF',
      textColor: '#000000',
      borderColor: '#000000',
      borderWidth: '1px',
      shadow: 'none',
      hoverBackground: '#F5F5F5',
    },
  },
  'dark': {
    name: 'dark',
    displayName: 'Dark',
    accentColor: '#E5E7EB', // Subtle light gray accent
    backgroundColor: '#0A0A0A', // Near black
    textColor: '#FFFFFF', // White
    patternEnabled: false,
    headerBackground: '#1A1A1A', // Slightly lighter than background
    headerText: '#FFFFFF', // White
    headerBorder: '#2A2A2A', // Subtle border
    buttonPrimary: {
      background: '#E5E7EB', // Light gray
      text: '#0A0A0A', // Dark text for contrast
      hover: '#D1D5DB', // Slightly darker gray on hover
      border: 'none',
    },
    buttonSecondary: {
      background: '#1A1A1A',
      text: '#FFFFFF',
      hover: '#2A2A2A',
      border: '1px solid #2A2A2A',
    },
    buttonGhost: {
      text: '#FFFFFF',
      hover: 'rgba(229, 231, 235, 0.1)', // Subtle light gray hover
    },
    borderColor: '#2A2A2A', // Subtle gray borders
    borderColorMuted: '#1A1A1A', // Muted borders
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB', // Light gray
    textMuted: '#9CA3AF', // Medium gray
    textHighlight: '#E5E7EB', // Light gray highlight
    hoverBackground: '#2A2A2A', // Subtle lightening
    activeBackground: '#3A3A3A', // More pronounced
    selectedBackground: 'rgba(229, 231, 235, 0.15)', // Subtle light gray tint
    inputBackground: '#1A1A1A', // Dark input background
    inputBorder: '#2A2A2A',
    inputText: '#FFFFFF',
    inputPlaceholder: '#6B7280', // Muted placeholder
    cardBackground: '#1A1A1A', // Dark card background
    tagStyle: {
      background: '#1A1A1A',
      textColor: '#FFFFFF',
      borderColor: '#2A2A2A',
      borderWidth: '1px',
      shadow: 'none',
      hoverBackground: '#2A2A2A',
    },
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