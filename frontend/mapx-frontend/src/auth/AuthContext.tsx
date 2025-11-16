import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { authService } from './services/authService';
import { usernameService } from './services/usernameService';

interface UsernameStatus {
  hasUsername: boolean;
  username?: string;
  usernameSetAt?: string;
}

interface User {
  id: string;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
  username?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  isInitialized: boolean;
  user: User | null;
  showUsernameModal: boolean;
  usernameStatus: UsernameStatus | null;
  isLoggingOut: boolean;
}

type AuthAction = 
  | { type: 'SET_CHECKING'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: { isAuth: boolean; user: User | null } }
  | { type: 'SET_USERNAME_STATUS'; payload: UsernameStatus }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_LOGGING_OUT'; payload: boolean }
  | { type: 'RESET_AUTH' };

const initialState: AuthState = {
  isAuthenticated: false,
  isChecking: true,
  isInitialized: false,
  user: null,
  showUsernameModal: false,
  usernameStatus: null,
  isLoggingOut: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_CHECKING':
      return { ...state, isChecking: action.payload };
    case 'SET_AUTHENTICATED':
      return { 
        ...state, 
        isAuthenticated: action.payload.isAuth, 
        user: action.payload.user,
        isChecking: false,
        isInitialized: true
      };
    case 'SET_USERNAME_STATUS':
      return { 
        ...state, 
        usernameStatus: action.payload,
        showUsernameModal: !action.payload.hasUsername 
      };
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };
    case 'SET_LOGGING_OUT':
      return { ...state, isLoggingOut: action.payload };
    case 'RESET_AUTH':
      return {
        ...initialState,
        isInitialized: true,
        isLoggingOut: false,
      };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  logout: () => Promise<void>;
  closeUsernameModal: () => void;
  checkUsernameStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const isInitialized = useRef(false);
  const isRefreshingRef = useRef(false);

  const checkAuth = useCallback(async () => {
    try {
      // Ensure tokens are valid and refresh if needed
      await authService.ensureValidTokens();
      
      const isAuth = authService.isAuthenticated();
      const user = authService.getCurrentUser();
      
      dispatch({
        type: 'SET_AUTHENTICATED',
        payload: { isAuth, user }
      });

      // Check username status in background (non-blocking)
      if (isAuth && user) {
        usernameService.getStatus()
          .then(usernameStatus => {
            dispatch({ type: 'SET_USERNAME_STATUS', payload: usernameStatus });
          })
          .catch(() => {
            dispatch({ 
              type: 'SET_USERNAME_STATUS', 
              payload: { hasUsername: true } 
            });
          });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      dispatch({
        type: 'SET_AUTHENTICATED',
        payload: { isAuth: false, user: null }
      });
    }
  }, []);

  const logout = useCallback(async () => {
    dispatch({ type: 'SET_LOGGING_OUT', payload: true });
    
    try {
      // Use auth service for proper logout
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      // Continue with logout even if API call fails
    }
    
    // Clear client state
    dispatch({ type: 'RESET_AUTH' });
    
    // Navigate immediately - no delays
    window.location.href = '/';
  }, []);

  const closeUsernameModal = useCallback(() => {
    dispatch({ 
      type: 'SET_USERNAME_STATUS', 
      payload: { hasUsername: true } 
    });
  }, []);

  const checkUsernameStatus = useCallback(async () => {
    if (!authService.isAuthenticated()) return;
    
    try {
      const usernameStatus = await usernameService.getStatus();
      dispatch({ type: 'SET_USERNAME_STATUS', payload: usernameStatus });
    } catch (error) {
      console.error('Failed to check username status:', error);
    }
  }, []);

  // Initialize auth immediately - no delays
  useEffect(() => {
    if (isInitialized.current) return;
    
    const initAuth = async () => {
      isInitialized.current = true;
      dispatch({ type: 'SET_CHECKING', payload: true });
      
      // Check for OAuth callback tokens
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('accessToken');
      const refreshToken = urlParams.get('refreshToken');
      const legacyToken = urlParams.get('token'); // Backward compatibility
      const nextParam = urlParams.get('next');
      
      if (accessToken && refreshToken) {
        // Process new dual-token OAuth response
        authService.storeTokens(accessToken, refreshToken);
        const user = authService.getCurrentUser();
        dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuth: true, user } });
        window.history.replaceState({}, '', window.location.pathname);
        
        // Redirect immediately - respect next param if present
        window.location.href = nextParam || '/feed';
        return;
      } else if (legacyToken) {
        // Handle legacy single-token format (backward compatibility)
        localStorage.setItem('authToken', legacyToken);
        const user = authService.getCurrentUser();
        dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuth: true, user } });
        window.history.replaceState({}, '', window.location.pathname);
        
        // Redirect immediately - respect next param if present
        window.location.href = nextParam || '/feed';
        return;
      }
      
      await checkAuth();
    };
    
    // Initialize immediately - no timeout
    initAuth();
    
    // Set up periodic token refresh check for idle users (every 10 minutes)
    // This ensures tokens are refreshed proactively even when user is idle
    const tokenRefreshInterval = setInterval(async () => {
      if (authService.isAuthenticated()) {
        try {
          await authService.ensureValidTokens();
          // Re-check auth state after refresh attempt
          const isAuth = authService.isAuthenticated();
          const user = authService.getCurrentUser();
          dispatch({
            type: 'SET_AUTHENTICATED',
            payload: { isAuth, user }
          });
        } catch (error) {
          console.error('Periodic token refresh check failed:', error);
        }
      }
    }, 10 * 60 * 1000); // Check every 10 minutes
    
    const onUnauthorized = async () => {
      // Prevent concurrent refresh attempts using ref to persist across renders
      if (isRefreshingRef.current) {
        return;
      }
      
      isRefreshingRef.current = true;
      
      try {
        // Try to refresh tokens proactively before clearing user state
        // This handles cases where token refresh failed in the interceptor
        // but the refresh token might still be valid
        const refreshResult = await authService.refreshAccessToken();
        if (refreshResult.success) {
          // Refresh succeeded, update auth state
          const isAuth = authService.isAuthenticated();
          const user = authService.getCurrentUser();
          dispatch({
            type: 'SET_AUTHENTICATED',
            payload: { isAuth, user }
          });
          return;
        }
      } catch (error) {
        console.error('Token refresh attempt in unauthorized handler failed:', error);
      } finally {
        isRefreshingRef.current = false;
      }
      
      // Only clear user state if refresh truly failed
      dispatch({ 
        type: 'SET_AUTHENTICATED',
        payload: { isAuth: false, user: null }
      });
    };
    
    window.addEventListener('api:unauthorized', onUnauthorized as EventListener);
    
    return () => {
      clearInterval(tokenRefreshInterval);
      window.removeEventListener('api:unauthorized', onUnauthorized as EventListener);
    };
  }, [checkAuth]);

  const value: AuthContextType = {
    ...state,
    logout,
    closeUsernameModal,
    checkUsernameStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};