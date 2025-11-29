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

  async post<T>(url: string, data?: any, signal?: AbortSignal): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data, { signal });
      return response.data as ApiResponse<T>;
    } catch (error) {
      // Don't treat abort as an error
      if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
        return {
          success: false,
          error: 'Request cancelled',
        };
      }
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

  // Streaming support for Server-Sent Events
  async streamPost<T = any>(
    url: string,
    data?: any,
    callbacks?: {
      onMessage: (message: { type: string; data: any }) => void;
      onError: (error: Error) => void;
      onComplete?: () => void;
    },
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const token = await authService.getTokenForRequest();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...data, stream: true }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          callbacks?.onComplete?.();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim()) {
                const message = JSON.parse(jsonStr);
                if (message.type === 'chunk') {
                  console.log(`📥 [SSE] Frontend received chunk: "${message.data}" (length: ${message.data?.length || 0})`);
                } else {
                  console.log(`📥 [SSE] Frontend received message type: ${message.type}`, message);
                }
                callbacks?.onMessage?.(message);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE message:', parseError);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Aborted, don't call onError
      }
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
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