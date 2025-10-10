import { apiClient } from './api';

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
export const usernameService = {
  // Check if username is available
  async checkAvailability(username: string): Promise<UsernameCheckResult> {
    try {
      const response = await fetch(`http://localhost:5000/api/username/check/${encodeURIComponent(username)}`);
      return await response.json();
    } catch (error) {
      console.error('Username check error:', error);
      throw new Error('Failed to check username availability');
    }
  },

  // Set username for current user
  async setUsername(username: string): Promise<SetUsernameResponse> {
    try {
      const response = await fetch('http://localhost:5000/api/username/set', {
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

  // Get current user's username status
  async getStatus(): Promise<UsernameStatus> {
    try {
      const token = apiClient.getToken();
      // Basic client-side diagnostics
      try {
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const exp = payload?.exp ? new Date(payload.exp * 1000).toISOString() : 'none';
          console.log('Username.getStatus token present:', {
            preview: `${token.substring(0, 12)}...`,
            hasExp: Boolean(payload?.exp),
            expIso: exp,
          });
        } else {
          console.warn('Username.getStatus: no auth token present');
        }
      } catch (e) {
        console.warn('Username.getStatus: failed to decode token', e);
      }

      const response = await fetch('http://localhost:5000/api/username/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        try { window.dispatchEvent(new CustomEvent('api:unauthorized')); } catch {}
      }

      if (!response.ok) {
        let errorDetail: any = undefined;
        try {
          errorDetail = await response.json();
        } catch {
          try { errorDetail = await response.text(); } catch {}
        }
        console.error('Username.getStatus non-OK:', {
          status: response.status,
          statusText: response.statusText,
          body: errorDetail,
        });
        throw new Error('Failed to get username status');
      }

      return await response.json();
    } catch (error) {
      console.error('Get username status error:', error);
      // Return a default status if backend is not available
      return {
        hasUsername: true, // Assume user has username if backend is down
        username: 'unknown',
        usernameSetAt: new Date().toISOString()
      };
    }
  }
};
