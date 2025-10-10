import React, { Suspense, lazy, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import UsernameSetupModal from './components/UsernameSetupModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthErrorBoundary } from './components/AuthErrorBoundary';
import { apiClient } from './services/api';
import { Toaster } from "sonner";

// Lazy load page components for better performance
const MapPage = lazy(() => import('./pages/MapPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthSuccessPage = lazy(() => import('./pages/AuthSuccessPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SocialFeedPage = lazy(() => import('./pages/SocialFeedPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const RecommendationComposerPage = lazy(() => import('./pages/RecommendationComposerPage'));
const PostPage = lazy(() => import('./pages/PostPage'));

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Memoized MapPage component to prevent unnecessary re-renders
const MemoizedMapPage = React.memo(MapPage);

// Main app component that handles persistent map and header
const AppContent: React.FC = () => {
  const location = useLocation();
  const isMapRoute = location.pathname === '/map';
  const isLandingRoute = location.pathname === '/landing';
  const { logout, showUsernameModal, closeUsernameModal, checkUsernameStatus, isLoggingOut } = useAuth();
  
  // Get current user for header
  const currentUser = apiClient.getCurrentUser();

  // Handle username setup completion
  const handleUsernameComplete = async (username: string) => {
    console.log('Username setup completed:', username);
    closeUsernameModal();
    // Refresh username status to update the state
    await checkUsernameStatus();
  };

  // Create persistent map instance using useMemo to ensure it's only created once
  const persistentMapInstance = useMemo(() => <MemoizedMapPage />, []);

  return (
    <div className="w-full h-screen relative">
      <Toaster
        toastOptions={{
          classNames: {
            toast: 'bg-yellow-50 text-yellow-800 border border-yellow-200 shadow-sm',
            title: 'text-yellow-900',
            description: 'text-yellow-700',
            actionButton: 'bg-yellow-600 text-white hover:bg-yellow-700',
            cancelButton: 'text-yellow-800 hover:text-yellow-900',
            success: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
            info: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
            warning: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
          },
        }}
      />
      {/* Username Setup Modal */}
      {showUsernameModal && (
        <UsernameSetupModal
          onClose={closeUsernameModal}
          onComplete={handleUsernameComplete}
        />
      )}

      {/* Persistent Header - always visible except on landing page */}
      {!isLandingRoute && (currentUser || isLoggingOut) && (
        <Header 
          currentUserId={currentUser?.id}
          showProfileButton={!isLoggingOut}
          showLogoutButton={!isLoggingOut}
          title="RECCE"
          variant="dark"
          onLogout={logout}
          profilePictureUrl={currentUser?.profilePictureUrl}
          displayName={currentUser?.displayName}
          isLoggingOut={isLoggingOut}
        />
      )}
      
      {/* Persistent Map - always rendered but only visible on map route and not during logout */}
      {!isLoggingOut && (
        <div 
          className={`absolute inset-0 z-10 ${isMapRoute ? 'block' : 'hidden'}`}
          style={{ 
            top: '64px', // Account for header height
            height: 'calc(100vh - 64px)' // Full height minus header
          }}
        >
          {persistentMapInstance}
        </div>
      )}
      
      {/* Logout loading screen */}
      {isLoggingOut && (
        <div className="absolute inset-0 z-30 bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Logging out...</p>
          </div>
        </div>
      )}

      {/* Route content container - only for non-map routes */}
      {!isMapRoute && !isLoggingOut && (
        <div 
          className="absolute inset-0 z-20"
          style={{ top: isLandingRoute ? '0' : '64px' }} // No header offset for landing page
        >
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth/success" element={<AuthSuccessPage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
              <Route path="/feed" element={<SocialFeedPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/compose" element={<RecommendationComposerPage />} />
              <Route path="/post/:recommendationId" element={<PostPage />} />
            </Routes>
          </Suspense>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/landing" replace />} />
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </Router>
      </AuthProvider>
    </AuthErrorBoundary>
  );
};

export default App;
