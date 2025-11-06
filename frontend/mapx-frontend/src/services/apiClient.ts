import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { authService } from '../auth/services/authService';

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}


import { getApiBaseUrl } from '@/config/apiConfig';

// Base API client configuration
class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = getApiBaseUrl();
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for JWT authentication and auto-refresh
    this.client.interceptors.request.use(
      async (config: any) => {
        const token = await authService.getTokenForRequest();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => Promise.reject(error)
    );

    // Add response interceptor for authentication errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Try to refresh token
          const newToken = await authService.getTokenForRequest();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } else {
            // Refresh failed, dispatch unauthorized event
            try {
              window.dispatchEvent(new CustomEvent('api:unauthorized'));
            } catch {}
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Authentication helpers - delegate to authService
  getCurrentUser() {
    return authService.getCurrentUser();
  }

  isAuthenticated(): boolean {
    return authService.isAuthenticated();
  }

  getToken(): string | null {
    return authService.getAccessToken();
  }

  storeTokens(accessToken: string, refreshToken: string): void {
    authService.storeTokens(accessToken, refreshToken);
  }

  logout(): void {
    authService.clearTokens();
  }

  // Generic HTTP methods
  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(url, { params });
      return response.data as ApiResponse<T>;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data);
      return response.data as ApiResponse<T>;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data);
      return response.data as ApiResponse<T>;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async delete<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(url, { data });
      return response.data as ApiResponse<T>;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  // Error handling
  private handleError<T>(error: any): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

// Export singleton instance
export const apiClient = new ApiClient();