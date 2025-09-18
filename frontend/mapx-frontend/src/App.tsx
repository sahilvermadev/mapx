import React, { useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import MapPage from './pages/MapPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import ProfilePage from './pages/ProfilePage';
import SocialFeedPage from './pages/SocialFeedPage';
import UserDiscoveryPage from './pages/UserDiscoveryPage';
import RecommendationComposerPage from './pages/RecommendationComposerPage';

// Memoized MapPage to prevent unnecessary re-renders
const MemoizedMapPage = React.memo(MapPage);

// Main app component that handles persistent map
const AppContent: React.FC = () => {
  const location = useLocation();
  const isMapRoute = location.pathname === '/';
  const mapInstanceRef = useRef<React.ReactElement | null>(null);

  // Create map instance only once
  if (!mapInstanceRef.current) {
    mapInstanceRef.current = <MemoizedMapPage />;
  }

  return (
    <div className="w-full h-screen relative">
      {/* Always render the map, but control visibility */}
      <div 
        className={`absolute inset-0 ${isMapRoute ? 'z-10' : 'z-0'}`}
        style={{ 
          visibility: isMapRoute ? 'visible' : 'hidden',
          pointerEvents: isMapRoute ? 'auto' : 'none'
        }}
      >
        {mapInstanceRef.current}
      </div>
      
      {/* Render other pages when not on map route */}
      {!isMapRoute && (
        <div className="absolute inset-0 z-20">
          <Routes>
            <Route path="/auth/success" element={<AuthSuccessPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/feed" element={<SocialFeedPage />} />
            <Route path="/discover" element={<UserDiscoveryPage />} />
            <Route path="/compose" element={<RecommendationComposerPage />} />
          </Routes>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </Router>
  );
};

export default App;
