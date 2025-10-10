import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import FeedPost from '@/components/FeedPost';
import { apiClient } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { FeedPost as FeedPostType } from '@/services/social';

const PostPage: React.FC = () => {
  const { recommendationId } = useParams<{ recommendationId: string }>();
  const navigate = useNavigate();
  const { user: currentUser, isChecking, isAuthenticated } = useAuth();
  const [post, setPost] = useState<FeedPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!recommendationId) {
        setError('No post ID provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiClient.get(`/recommendations/${recommendationId}`);
        
        if (response.data && typeof response.data === 'object' && response.data !== null && 'recommendation_id' in response.data) {
          setPost(response.data as FeedPostType);
        } else {
          setError('Post not found');
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [recommendationId]);

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      navigate('/landing');
    }
  }, [isChecking, isAuthenticated, navigate]);

  if (isChecking) {
    return null;
  }

  return (
    <div 
      className="h-full grid place-items-center overflow-hidden"
      style={{
        backgroundImage: 'url(/src/assets/post-page-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="w-full max-w-2xl p-4">

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin mb-4 text-gray-400" />
            <p className="text-gray-500">Loading post...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        )}

        {/* Post Content */}
        {post && !loading && !error && (
          <Card className="p-6 shadow-sm border border-white/40 bg-white/90 backdrop-blur-sm">
            <div className="w-full flex justify-center">
              <div className="w-full max-w-xl">
                <FeedPost
                  post={post}
                  currentUserId={currentUser.id}
                  noOuterSpacing
                  onPostUpdate={() => {
                    // Reload the post data after update
                    window.location.reload();
                  }}
                />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PostPage;

