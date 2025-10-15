// Authentication module exports
// This file provides a clean interface for all authentication-related functionality

// Context and Provider
export { AuthProvider, useAuth } from './AuthContext';

// Services
export { authService } from './services/authService';
export { usernameService } from './services/usernameService';

// Components
export { AuthErrorBoundary } from './components/AuthErrorBoundary';
export { default as LoginModal } from './components/LoginModal';
export { default as UsernameSetupModal } from './components/UsernameSetupModal';

// Types (re-export from services)
export type { AuthTokens, RefreshResponse, LogoutResponse } from './services/authService';
