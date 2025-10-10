import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RecommendationComposer from '@/components/RecommendationComposer';
import { useAuth } from '@/contexts/AuthContext';

const RecommendationComposerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();

  useEffect(() => {
    // Only redirect if auth check is complete and user is not authenticated
    if (!isChecking && !isAuthenticated) {
      navigate('/');
      return;
    }
  }, [isChecking, isAuthenticated, navigate]);

  // Show loading while authentication is being checked
  if (isChecking) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <RecommendationComposer
        isOpen={true}
        onClose={() => navigate(-1)}
        onPostCreated={() => navigate('/feed')}
        currentUserId={currentUser.id}
      />
    </div>
  );
};

export default React.memo(RecommendationComposerPage);
