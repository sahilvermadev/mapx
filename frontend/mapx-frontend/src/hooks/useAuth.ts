import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/services/api';

export interface AuthState {
  isAuthenticated: boolean;
  isChecking: boolean;
  user: any | null;
  showLoginModal: boolean;
}

export interface AuthActions {
  login: (token: string) => void;
  logout: () => Promise<void>;
  closeLoginModal: () => void;
  openLoginModal: () => void;
}

export const useAuth = (): AuthState & AuthActions => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isChecking: true,
    user: null,
    showLoginModal: false,
  });

  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Check authentication status
  const checkAuth = useCallback(() => {
    const isAuth = apiClient.isAuthenticated();
    const user = apiClient.getCurrentUser();

    setState(prev => ({
      ...prev,
      isAuthenticated: isAuth,
      isChecking: false,
      user: isAuth ? user : null,
      showLoginModal: !isAuth,
    }));
  }, []);

  // Handle token from URL (OAuth callback)
  const handleTokenFromUrl = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      localStorage.setItem('authToken', token);
      
      // Clear URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Check auth after token is stored
      setTimeout(() => {
        checkAuth();
      }, 100);
      return true;
    }
    return false;
  }, [checkAuth]);

  // Login function
  const login = useCallback((token: string) => {
    localStorage.setItem('authToken', token);
    checkAuth();
  }, [checkAuth]);

  // Logout function
  const logout = useCallback(async () => {
    console.log('🔄 Logout initiated');
    
    // Clear timers first
    clearTimers();
    
    try {
      // Call backend logout endpoint
      await fetch('http://localhost:5000/auth/logout', {
        method: 'GET',
        credentials: 'include',
      });
      console.log('✅ Backend logout successful');
    } catch (error) {
      console.warn('⚠️ Backend logout failed, continuing with client-side logout:', error);
    }
    
    // Clear client-side state
    localStorage.removeItem('authToken');
    
    setState({
      isAuthenticated: false,
      isChecking: false,
      user: null,
      showLoginModal: true,
    });
    
    console.log('✅ Logout completed');
    
    // Force a page reload to ensure clean state across all components
    window.location.href = '/';
  }, [clearTimers]);

  // Modal controls
  const closeLoginModal = useCallback(() => {
    setState(prev => ({ ...prev, showLoginModal: false }));
  }, []);

  const openLoginModal = useCallback(() => {
    setState(prev => ({ ...prev, showLoginModal: true }));
  }, []);

  // Initialize authentication
  useEffect(() => {
    console.log('🔐 Initializing authentication...');
    
    // Check if there's a token in URL (OAuth callback)
    if (handleTokenFromUrl()) {
      return;
    }
    
    // Check current authentication status
    checkAuth();
    
    // Set up retry mechanism for unauthenticated users
    if (!apiClient.isAuthenticated()) {
      retryTimerRef.current = setTimeout(() => {
        console.log('🔄 Retrying authentication check...');
        checkAuth();
      }, 500);
    }
    
    // Safety timer to prevent infinite loading
    safetyTimerRef.current = setTimeout(() => {
      console.log('⏰ Safety timer triggered - stopping auth check');
      setState(prev => ({ ...prev, isChecking: false }));
    }, 3000);
    
    // Cleanup function
    return () => {
      clearTimers();
    };
  }, [checkAuth, handleTokenFromUrl, clearTimers]);

  return {
    ...state,
    login,
    logout,
    closeLoginModal,
    openLoginModal,
  };
}; 