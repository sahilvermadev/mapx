import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RecommendationComposer from '@/components/RecommendationComposer';
import { apiClient } from '@/services/api';

const RecommendationComposerPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = apiClient.getCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      // Add a small delay to ensure auth state is properly cleared
      setTimeout(() => {
        navigate('/');
      }, 100);
    }
  }, [currentUser, navigate]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <RecommendationComposer
        isOpen={true}
        onClose={() => navigate(-1)}
        onPostCreated={() => navigate('/feed')}
        currentUserId={currentUser.id}
      />
    </div>
  );
};

export default RecommendationComposerPage;


