// Common API types used across the application

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  profilePictureUrl?: string;
}

export interface Place {
  id: number;
  google_place_id?: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface Annotation {
  id: number;
  place_id: number;
  user_id: string;
  title?: string;
  went_with?: string[];
  labels?: string[];
  notes?: string;
  metadata?: Record<string, any>;
  visit_date?: string;
  rating?: number;
  visibility: 'friends' | 'public';
  created_at: string;
  updated_at: string;
} 