import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import RecommendationComposer from '@/components/RecommendationComposer';
import { useAuth } from '@/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

const RecommendationComposerPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

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
      <div 
        className="min-h-[calc(100vh-64px)] flex items-center justify-center"
        style={{ 
          backgroundColor: selectedTheme?.backgroundColor || 'var(--app-bg)',
          color: selectedTheme?.textPrimary || 'var(--app-text)',
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ 
              borderColor: selectedTheme?.accentColor || '#2563EB',
            }}
          ></div>
          <p style={{ color: selectedTheme?.textPrimary || 'inherit' }}>
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  // Get question context from navigation state
  const questionContext = location.state?.questionContext;
  const questionId = location.state?.questionId;

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <RecommendationComposer
        isOpen={true}
        onClose={() => navigate(-1)}
        onPostCreated={() => {
          // Invalidate feed queries to refresh the data
          queryClient.invalidateQueries({ 
            queryKey: ['feed'],
            exact: false 
          });
          queryClient.invalidateQueries({ queryKey: ['profile'] });
          navigate('/feed');
        }}
        currentUserId={currentUser.id}
        questionContext={questionContext}
        questionId={questionId}
      />
    </div>
  );
};

export default React.memo(RecommendationComposerPage);
