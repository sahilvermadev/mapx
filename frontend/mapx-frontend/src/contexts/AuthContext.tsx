import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../services/api';
import { usernameService } from '../services/username';

interface UsernameStatus {
  hasUsername: boolean;
  username?: string;
  usernameSetAt?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  isLoggingOut: boolean;
  user: any | null;
  showLoginModal: boolean;
  showUsernameModal: boolean;
  usernameStatus: UsernameStatus | null;
}

type AuthAction = 
  | { type: 'SET_CHECKING'; payload: boolean }
  | { type: 'SET_AUTHENTICATED'; payload: { isAuth: boolean; user: any } }
  | { type: 'SET_LOGOUT_START' }
  | { type: 'SET_MODAL_STATE'; payload: { showLogin: boolean; showUsername: boolean } }
  | { type: 'SET_USERNAME_STATUS'; payload: UsernameStatus }
  | { type: 'RESET_AUTH' };

const initialState: AuthState = {
  isAuthenticated: false,
  isChecking: true,
  isLoggingOut: false,
  user: null,
  showLoginModal: false,
  showUsernameModal: false,
  usernameStatus: null,
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
        isChecking: false 
      };
    case 'SET_LOGOUT_START':
      return { ...state, isLoggingOut: true };
    case 'SET_MODAL_STATE':
      return { 
        ...state, 
        showLoginModal: action.payload.showLogin,
        showUsernameModal: action.payload.showUsername 
      };
    case 'SET_USERNAME_STATUS':
      return { 
        ...state, 
        usernameStatus: action.payload,
        showUsernameModal: !action.payload.hasUsername 
      };
    case 'RESET_AUTH':
      return {
        ...initialState,
        isChecking: false,
        showLoginModal: true
      };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (token: string) => void;
  logout: () => Promise<void>;
  closeLoginModal: () => void;
  openLoginModal: () => void;
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

      if (isAuth) {
        // Check username status
        try {
          const usernameStatus = await usernameService.getStatus();
          dispatch({ type: 'SET_USERNAME_STATUS', payload: usernameStatus });
        } catch (error) {
          console.error('Failed to check username status:', error);
          dispatch({ 
            type: 'SET_USERNAME_STATUS', 
            payload: { hasUsername: true } 
          });
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      dispatch({
        type: 'SET_AUTHENTICATED',
        payload: { isAuth: false, user: null }
      });
    }
  }, []);

  const login = useCallback((token: string) => {
    localStorage.setItem('authToken', token);
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    console.log('🔄 Logout initiated');
    
    // Set logout state
    dispatch({ type: 'SET_LOGOUT_START' });
    
    try {
      // Call backend logout
      await fetch('http://localhost:5000/auth/logout', {
        method: 'GET',
        credentials: 'include',
      });
      console.log('✅ Backend logout successful');
    } catch (error) {
      console.warn('⚠️ Backend logout failed, continuing with client-side logout:', error);
    }
    
    // Clear client state
    localStorage.removeItem('authToken');
    
    // Reset auth state
    dispatch({ type: 'RESET_AUTH' });
    
    console.log('✅ Logout completed');
    
    // Navigate to landing
    window.location.href = '/';
  }, []);

  const closeLoginModal = useCallback(() => {
    dispatch({ 
      type: 'SET_MODAL_STATE', 
      payload: { showLogin: false, showUsername: false } 
    });
  }, []);

  const openLoginModal = useCallback(() => {
    dispatch({ 
      type: 'SET_MODAL_STATE', 
      payload: { showLogin: true, showUsername: false } 
    });
  }, []);

  const closeUsernameModal = useCallback(() => {
    dispatch({ 
      type: 'SET_MODAL_STATE', 
      payload: { showLogin: false, showUsername: false } 
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

  // Initialize auth
  useEffect(() => {
    if (isInitialized.current) return;
    
    const initAuth = async () => {
      isInitialized.current = true;
      dispatch({ type: 'SET_CHECKING', payload: true });
      
      // Check for token in URL (OAuth callback) - only if not already handled
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token && !localStorage.getItem('authToken')) {
        localStorage.setItem('authToken', token);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
      
      await checkAuth();
    };
    
    // Add a small delay to prevent race conditions
    const timeoutId = setTimeout(initAuth, 50);
    
    // Listen for API unauthorized events
    const onUnauthorized = () => {
      dispatch({ 
        type: 'SET_MODAL_STATE', 
        payload: { showLogin: true, showUsername: false } 
      });
    };
    
    window.addEventListener('api:unauthorized', onUnauthorized as EventListener);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('api:unauthorized', onUnauthorized as EventListener);
    };
  }, [checkAuth]);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    closeLoginModal,
    openLoginModal,
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
