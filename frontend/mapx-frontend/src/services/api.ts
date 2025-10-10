import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

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

// JWT token handling (matching your existing implementation)
interface UserClaims {
  id: string;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
  exp?: number; // JWT expiration (seconds since epoch)
}

function decodeJwt(token: string): UserClaims | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch (error) {
    return null;
  }
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false; // if no exp, assume not expired
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSeconds;
  } catch {
    return true;
  }
}

// Base API client configuration
class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // Increased timeout to 30 seconds for AI operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for JWT authentication
    this.client.interceptors.request.use(
      (config: any) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => Promise.reject(error)
    );

    // Add response interceptor for authentication errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Notify app to show login modal without forcibly redirecting or clearing token
          try {
            window.dispatchEvent(new CustomEvent('api:unauthorized'));
          } catch {}
        }
        // Don't reject the error here - let the individual methods handle it
        return Promise.reject(error);
      }
    );
  }

  // Authentication helpers (matching your existing localStorage usage)
  private getAuthToken(): string | null {
    return localStorage.getItem('authToken'); // Same key as AuthSuccessPage.tsx
  }


  // Get current user from JWT (without making API call)
  getCurrentUser(): UserClaims | null {
    const token = this.getAuthToken();
    if (!token || isTokenExpired(token)) return null;
    const user = decodeJwt(token);
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.log('Current user from JWT:', user);
    }
    return user;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getAuthToken();
    const isAuth = !!token && !isTokenExpired(token);
    // Only log in development mode and reduce frequency
    if (import.meta.env.DEV && Math.random() < 0.1) { // Only log 10% of the time
      console.log('🔐 isAuthenticated check:', { 
        hasToken: !!token,
        isExpired: token ? isTokenExpired(token) : true,
        tokenLength: token?.length,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
      });
    }
    return isAuth;
  }

  // Get auth token (public method for external use)
  getToken(): string | null {
    return this.getAuthToken();
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