// frontend/mapx-frontend/src/services/authService.ts
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// JWT token handling
interface UserClaims {
  id: string;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
  username?: string;
  type?: 'access' | 'refresh';
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

function isTokenExpiringSoon(token: string | null, bufferMinutes: number = 2): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bufferSeconds = bufferMinutes * 60;
    return payload.exp <= (nowSeconds + bufferSeconds);
  } catch {
    return true;
  }
}

class AuthService {
  private baseURL: string;

  constructor() {
    this.baseURL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  }

  /**
   * Store authentication tokens
   */
  storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Clear legacy token for backward compatibility
    localStorage.removeItem('authToken');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    
    if (!accessToken || !refreshToken) return false;
    
    if (isTokenExpired(accessToken) && isTokenExpired(refreshToken)) {
      // Both tokens expired, clear them
      this.clearTokens();
      return false;
    }
    
    return true;
  }

  /**
   * Get current user information
   */
  getCurrentUser(): UserClaims | null {
    const token = this.getAccessToken();
    if (!token) return null;
    
    if (isTokenExpired(token)) {
      // Clear expired token automatically
      this.clearTokens();
      return null;
    }
    
    return decodeJwt(token);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<RefreshResponse> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token available'
        };
      }

      const response = await fetch(`${this.baseURL.replace('/api', '')}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();
      
      if (data.success && data.accessToken) {
        // Update stored access token
        const currentRefreshToken = this.getRefreshToken();
        if (currentRefreshToken) {
          this.storeTokens(data.accessToken, currentRefreshToken);
        }
        return data;
      } else {
        // Refresh failed, clear tokens
        this.clearTokens();
        return {
          success: false,
          error: data.error || 'Token refresh failed'
        };
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      return {
        success: false,
        error: 'Network error during token refresh'
      };
    }
  }

  /**
   * Get token for API requests (with automatic refresh)
   */
  async getTokenForRequest(): Promise<string | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    // Check if token is expiring soon and refresh if needed
    if (isTokenExpiringSoon(accessToken)) {
      const refreshResult = await this.refreshAccessToken();
      if (refreshResult.success && refreshResult.accessToken) {
        return refreshResult.accessToken;
      } else {
        return null;
      }
    }

    return accessToken;
  }

  /**
   * Logout user and clear all tokens
   */
  async logout(): Promise<LogoutResponse> {
    try {
      const accessToken = this.getAccessToken();
      const refreshToken = this.getRefreshToken();
      
      if (accessToken && refreshToken) {
        // Call backend logout to blacklist tokens
        const response = await fetch(`${this.baseURL.replace('/api', '')}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        });

        const data = await response.json();
        
        // Clear tokens regardless of API response
        this.clearTokens();
        
        return data;
      } else {
        // No tokens to logout, just clear local state
        this.clearTokens();
        return {
          success: true,
          message: 'Logged out successfully'
        };
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Clear tokens even if API call fails
      this.clearTokens();
      return {
        success: true,
        message: 'Logged out successfully'
      };
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(): Promise<LogoutResponse> {
    try {
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        this.clearTokens();
        return {
          success: true,
          message: 'No active session to logout'
        };
      }

      const response = await fetch(`${this.baseURL}/auth/logout-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      // Clear local tokens
      this.clearTokens();
      
      return data;
    } catch (error) {
      console.error('Logout all devices error:', error);
      // Clear tokens even if API call fails
      this.clearTokens();
      return {
        success: true,
        message: 'Logged out from all devices successfully'
      };
    }
  }

  /**
   * Check if tokens are valid and refresh if needed
   */
  async ensureValidTokens(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    const accessToken = this.getAccessToken();
    if (!accessToken) {
      return false;
    }

    // Check if access token is expiring soon (within 2 minutes)
    if (isTokenExpiringSoon(accessToken)) {
      const refreshResult = await this.refreshAccessToken();
      return refreshResult.success;
    }

    return true;
  }


  /**
   * Get token expiration time
   */
  getTokenExpiration(): Date | null {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    const payload = decodeJwt(accessToken);
    if (payload && payload.exp) {
      return new Date(payload.exp * 1000);
    }

    return null;
  }

  /**
   * Get refresh token expiration time
   */
  getRefreshTokenExpiration(): Date | null {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    const payload = decodeJwt(refreshToken);
    if (payload && payload.exp) {
      return new Date(payload.exp * 1000);
    }

    return null;
  }
}

// Export singleton instance
export const authService = new AuthService();
