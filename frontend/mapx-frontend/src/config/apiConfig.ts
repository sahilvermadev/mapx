/**
 * Centralized API and Backend URL Configuration
 * 
 * This module provides a single source of truth for all backend URLs.
 * To change the domain, update the environment variables:
 * - VITE_API_BASE_URL: Base URL for API requests (defaults to '/api' in prod, 'http://localhost:5000/api' in dev)
 * - VITE_BACKEND_URL: Base URL for backend (OAuth, profile pictures, etc.) (defaults to 'http://localhost:5000' in dev)
 * 
 * In production, API requests use relative URLs that are proxied by nginx.
 * Backend URLs (for OAuth redirects) use the full domain.
 */

/**
 * Get the API base URL for making API requests
 * - In production: Uses relative URL '/api' (proxied by nginx)
 * - In development: Uses 'http://localhost:5000/api'
 * - Can be overridden with VITE_API_BASE_URL environment variable
 */
export function getApiBaseUrl(): string {
  const envApiBase = import.meta.env.VITE_API_BASE_URL;
  
  if (envApiBase) {
    return envApiBase;
  }
  
  // Default: relative URL in production, localhost in development
  return import.meta.env.PROD ? '/api' : 'http://localhost:5000/api';
}

/**
 * Get the backend base URL for OAuth redirects, profile pictures, etc.
 * - In production: Uses VITE_BACKEND_URL or constructs from current origin
 * - In development: Uses 'http://localhost:5000'
 * - Can be overridden with VITE_BACKEND_URL environment variable
 */
export function getBackendBaseUrl(): string {
  const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (envBackendUrl) {
    return envBackendUrl;
  }
  
  // In production, try to construct from current origin
  if (import.meta.env.PROD) {
    // If we're in production but no VITE_BACKEND_URL is set,
    // construct it from the current origin (assumes backend is on port 5000)
    const origin = window.location.origin;
    // Extract hostname and port
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname}:5000`;
  }
  
  // Default: localhost in development
  return 'http://localhost:5000';
}

/**
 * Get the full URL for an API endpoint
 * @param endpoint - API endpoint path (e.g., '/users', '/recommendations')
 * @returns Full URL to the API endpoint
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Get the full URL for a backend endpoint (OAuth, profile pictures, etc.)
 * @param endpoint - Backend endpoint path (e.g., '/auth/google', '/auth/profile-picture')
 * @returns Full URL to the backend endpoint
 */
export function getBackendUrl(endpoint: string): string {
  const baseUrl = getBackendBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Get the profile picture URL
 * Handles both relative and absolute URLs
 * @param url - Profile picture URL (can be relative or absolute)
 * @returns Full URL to the profile picture
 */
export function getProfilePictureUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // If it's a Google profile picture URL, always proxy it through our backend for CORS
  // This must be checked BEFORE checking if it's absolute, since Google URLs are absolute
  if (url.includes('googleusercontent.com')) {
    return getBackendUrl(`/auth/profile-picture?url=${encodeURIComponent(url)}`);
  }
  
  // If already an absolute URL (and not Google), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // For relative URLs, construct from API base URL
  const apiBase = getApiBaseUrl();
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${apiBase}${cleanUrl}`;
}

// Export singleton instances for convenience
export const apiConfig = {
  apiBaseUrl: getApiBaseUrl(),
  backendBaseUrl: getBackendBaseUrl(),
  getApiUrl,
  getBackendUrl,
  getProfilePictureUrl,
} as const;

