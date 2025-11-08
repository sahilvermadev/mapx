import React, { Suspense, lazy, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from './components/Header';
import { UsernameSetupModal } from './auth';
import { AuthProvider, useAuth } from './auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './hooks/useOffline';
import { Toaster } from "sonner";
import { ThemeProvider } from '@/contexts/ThemeContext';

// Lazy load page components for better performance
const MapPage = lazy(() => import('./pages/MapPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SocialFeedPage = lazy(() => import('./pages/SocialFeedPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const RecommendationComposerPage = lazy(() => import('./pages/RecommendationComposerPage'));
const PostPage = lazy(() => import('./pages/PostPage'));
const QuestionPage = lazy(() => import('./pages/QuestionPage'));

// Fast loading component
const LoadingSkeleton: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary"></div>
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

// Memoized MapPage component to prevent unnecessary re-renders
const MemoizedMapPage = React.memo(MapPage);

// Main app component with optimized routing
const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMapRoute = location.pathname === '/map';
  const isLandingRoute = location.pathname === '/landing';
  const isRootRoute = location.pathname === '/';
  const { 
    logout, 
    showUsernameModal, 
    closeUsernameModal, 
    checkUsernameStatus, 
    user: currentUser, 
    isAuthenticated, 
    isChecking, 
    isInitialized,
    isLoggingOut 
  } = useAuth();

  // Handle root route redirect immediately - no delays
  useEffect(() => {
    if (isRootRoute && isInitialized && !isChecking) {
      // Check if we're in the middle of an OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('accessToken');
      const refreshToken = urlParams.get('refreshToken');
      const legacyToken = urlParams.get('token');
      
      if (accessToken || refreshToken || legacyToken) {
        // Don't redirect if we're processing an OAuth callback
        return;
      }
      
      // Immediate redirect based on authentication status
      const redirectPath = isAuthenticated && currentUser ? '/feed' : '/landing';
      navigate(redirectPath, { replace: true });
    }
  }, [isRootRoute, isAuthenticated, currentUser, isChecking, isInitialized, navigate]);

  // Handle username setup completion
  const handleUsernameComplete = async () => {
    closeUsernameModal();
    await checkUsernameStatus();
  };

  // Create persistent map instance using useMemo to ensure it's only created once
  const persistentMapInstance = useMemo(() => <MemoizedMapPage />, []);

  // Show logout transition
  if (isLoggingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary"></div>
          <p className="text-sm text-gray-600">Signing out...</p>
        </div>
      </div>
    );
  }

  // Show loading while checking authentication
  if (isChecking || !isInitialized) {
    return <LoadingSkeleton />;
  }

  return (
    <div className={`w-full h-screen relative ${isMapRoute ? 'overflow-hidden' : 'overflow-auto'}`}>
      <OfflineIndicator />
      <Toaster
        toastOptions={{
          classNames: {
            toast: 'bg-white/95 backdrop-blur-sm text-gray-800 border border-gray-200 shadow-lg',
            title: 'text-gray-900 font-medium',
            description: 'text-gray-600',
            actionButton: 'bg-primary text-white hover:bg-primary/90',
            cancelButton: 'text-gray-600 hover:text-gray-800',
            success: 'bg-green-50/95 text-green-800 border-green-200',
            info: 'bg-blue-50/95 text-blue-800 border-blue-200',
            warning: 'bg-yellow-50/95 text-yellow-800 border-yellow-200',
            error: 'bg-red-50/95 text-red-800 border-red-200',
          },
        }}
      />
      
      {/* Username Setup Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <UsernameSetupModal
            onClose={closeUsernameModal}
            onComplete={handleUsernameComplete}
          />
        </div>
      )}

      {/* Persistent Header */}
      {!isLandingRoute && currentUser && (
        <Header 
          currentUserId={currentUser?.id}
          showProfileButton={true}
          showLogoutButton={true}
          title="REKKY"
          variant="dark"
          onLogout={logout}
          profilePictureUrl={currentUser?.profilePictureUrl}
          displayName={currentUser?.displayName}
        />
      )}
      
      {/* Persistent Map */}
      <div 
        className={`absolute inset-0 z-10 transition-opacity duration-200 ${
          isMapRoute ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ 
          top: '64px',
          height: 'calc(100vh - 64px)'
        }}
      >
        {persistentMapInstance}
      </div>
      
      {/* Route content container */}
      {!isMapRoute && (
        <div 
          className="absolute inset-0 z-20 overflow-auto"
          style={{ 
            top: isLandingRoute ? '0' : '64px'
          }}
        >
          <Suspense fallback={<LoadingSkeleton />}>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/feed" element={<SocialFeedPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/compose" element={<RecommendationComposerPage />} />
              <Route path="/post/:recommendationId" element={<PostPage />} />
              <Route path="/question/:id" element={<QuestionPage />} />
            </Routes>
          </Suspense>
        </div>
      )}
    </div>
  );
};

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
          <Router>
            <Routes>
              <Route path="/*" element={<AppContent />} />
            </Routes>
          </Router>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;