import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../services/api';
import { usernameService } from '../services/username';

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

  const checkAuth = useCallback(async () => {
    try {
      const isAuth = apiClient.isAuthenticated();
      const user = apiClient.getCurrentUser();
      
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
    
    // Clear client state immediately
    localStorage.removeItem('authToken');
    dispatch({ type: 'RESET_AUTH' });
    
    // Navigate immediately - no delays
    window.location.href = '/';
    
    // Call backend logout in background (non-blocking)
    fetch('http://localhost:5000/auth/logout', {
      method: 'GET',
      credentials: 'include',
    }).catch(() => {
      // Ignore errors - user is already logged out locally
    });
  }, []);

  const closeUsernameModal = useCallback(() => {
    dispatch({ 
      type: 'SET_USERNAME_STATUS', 
      payload: { hasUsername: true } 
    });
  }, []);

  const checkUsernameStatus = useCallback(async () => {
    if (!apiClient.isAuthenticated()) return;
    
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
      
      // Check for OAuth callback token
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token) {
        // Process OAuth token immediately
        localStorage.setItem('authToken', token);
        const user = apiClient.getCurrentUser();
        dispatch({ type: 'SET_AUTHENTICATED', payload: { isAuth: true, user } });
        window.history.replaceState({}, '', window.location.pathname);
        
        // Redirect immediately - no delays
        window.location.href = '/feed';
        return;
      }
      
      await checkAuth();
    };
    
    // Initialize immediately - no timeout
    initAuth();
    
    const onUnauthorized = () => {
      dispatch({ 
        type: 'SET_AUTHENTICATED',
        payload: { isAuth: false, user: null }
      });
    };
    
    window.addEventListener('api:unauthorized', onUnauthorized as EventListener);
    
    return () => {
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