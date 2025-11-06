import { apiClient } from '../../services/apiClient';

export interface UsernameCheckResult {
  available: boolean;
  username: string;
  error?: string;
}

export interface UsernameStatus {
  hasUsername: boolean;
  username?: string;
  usernameSetAt?: string;
}

export interface SetUsernameRequest {
  username: string;
}

export interface SetUsernameResponse {
  success: boolean;
  username: string;
}

// Username service methods
import { getApiBaseUrl } from '@/config/apiConfig';

export const usernameService = {
  // Check if username is available
  async checkAvailability(username: string): Promise<UsernameCheckResult> {
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/username/check/${encodeURIComponent(username)}`);
      return await response.json();
    } catch (error) {
      console.error('Username check error:', error);
      throw new Error('Failed to check username availability');
    }
  },

  // Set username for current user
  async setUsername(username: string): Promise<SetUsernameResponse> {
    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/username/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiClient.getToken()}`
        },
        body: JSON.stringify({ username })
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('api:unauthorized')); } catch {}
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set username');
      }

      return await response.json();
    } catch (error) {
      console.error('Set username error:', error);
      throw error;
    }
  },

  // Get current user's username status with fast fallback
  async getStatus(): Promise<UsernameStatus> {
    try {
      const token = apiClient.getToken();
      
      // Use Promise.race to timeout quickly if backend is slow
      const timeoutPromise = new Promise<UsernameStatus>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000) // 2 second timeout
      );
      
      const apiBase = getApiBaseUrl();
      const fetchPromise = fetch(`${apiBase}/username/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).then(async (response) => {
        if (response.status === 401) {
          try { window.dispatchEvent(new CustomEvent('api:unauthorized')); } catch {}
        }

        if (!response.ok) {
          throw new Error('Failed to get username status');
        }

        return await response.json();
      });

      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error) {
      console.warn('Username status check failed, using fallback:', error);
      // Fast fallback - assume user has username
      return {
        hasUsername: true,
        username: 'user',
        usernameSetAt: new Date().toISOString()
      };
    }
  }
};