import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header as LandingHeader } from '@/components/landing/Header';
import { Card } from '@/components/ui/card';
import FeedPostSkeleton from '@/components/skeletons/FeedPostSkeleton';
import FeedPost from '@/components/FeedPost';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/auth';
import type { FeedPost as FeedPostType } from '@/services/socialService';

const PostPage: React.FC = () => {
  const { recommendationId } = useParams<{ recommendationId: string }>();
  const { user: currentUser, isChecking, isAuthenticated } = useAuth();
  const [post, setPost] = useState<FeedPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bgReady, setBgReady] = useState(false);
  const [followSuggestion, setFollowSuggestion] = useState<{ friendId: string; friendName: string } | null>(null);

  useEffect(() => {
    if (!recommendationId) {
      setError('No post ID provided');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchPublic = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: payload } = await apiClient.get(`/public/recommendations/${recommendationId}`);
        const raw = payload && typeof payload === 'object' && (payload as any).data ? (payload as any).data : payload;
        if (!raw) return;
        if (!cancelled) setPost(raw as any);
      } catch (e: any) {
        const data = e?.response?.data;
        if (!cancelled) setError(data?.error || 'Failed to load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPublic();

    // If authenticated, fetch the full data and replace
    const fetchPrivate = async () => {
      if (!isAuthenticated) return;
      try {
        const { data: payload } = await apiClient.get(`/recommendations/${recommendationId}`);
        const raw = payload && typeof payload === 'object' && (payload as any).data ? (payload as any).data : payload;
        if (raw && !cancelled) setPost(raw as any);
      } catch {}
    };
    fetchPrivate();
    return () => { cancelled = true; };
  }, [recommendationId, isAuthenticated]);

  useEffect(() => {
    const img = new Image();
    img.src = '/post-page-bg.jpg';
    img.onload = () => setBgReady(true);
  }, []);

  // Suggest following sharer post-login
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const friendId = params.get('friendId');
    const friendName = params.get('friendName');
    if (friendId && friendName) {
      setFollowSuggestion({ friendId, friendName });
    }
  }, [isAuthenticated]);

  if (isChecking) {
    return null;
  }

  return (
    <div className="h-full grid place-items-center overflow-hidden relative">
      {/* Background image with opacity control */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage: 'url(/post-page-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: bgReady ? 1 : 0.7,
          zIndex: 0
        }}
      />
      {/* Content layer */}
      <div className="relative z-10 w-full max-w-2xl p-4">
        {!isAuthenticated && (
          <LandingHeader
            variant="dark"
            hideNav
            position="fixed"
            onSignInClick={async () => {
              const { getBackendUrl } = await import('@/config/apiConfig');
              const nextUrl = `/post/${recommendationId}`;
              window.location.href = `${getBackendUrl('/auth/google')}?next=${encodeURIComponent(nextUrl)}`;
            }}
          />
        )}

        {/* Loading State */}
        {loading && (
          <Card className={`p-6 shadow-sm border border-white/40 bg-white/90 ${bgReady ? 'backdrop-blur-sm' : ''}`}>
            <FeedPostSkeleton noOuterSpacing />
          </Card>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-red-500">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Try Again
            </Button>
            {!isAuthenticated && (
              <Button
                size="sm"
                onClick={async () => {
                  const { getBackendUrl } = await import('@/config/apiConfig');
                  const nextUrl = `/post/${recommendationId}`;
                  window.location.href = `${getBackendUrl('/auth/google')}?next=${encodeURIComponent(nextUrl)}`;
                }}
              >
                Sign in to view more
              </Button>
            )}
          </div>
        )}

        {/* Post Content */}
        {post && !loading && !error && (
          <Card className={`p-6 shadow-sm border border-white/40 bg-white/90 ${bgReady ? 'backdrop-blur-sm' : ''}`}>
            <div className="w-full flex justify-center">
              <div className="w-full max-w-xl">
                {post && (
                  <FeedPost
                    post={post}
                    currentUserId={isAuthenticated && currentUser ? currentUser.id : undefined}
                    noOuterSpacing
                    readOnly={!isAuthenticated}
                    onPostUpdate={() => {
                      window.location.reload();
                    }}
                  />
                )}
              </div>
            </div>
          </Card>
        )}
        {!isAuthenticated && !loading && !error && post && followSuggestion && (
          <div className="mt-3 text-center text-sm text-gray-600">
            You'll be able to follow {followSuggestion.friendName} after signing in.
          </div>
        )}
      </div>
    </div>
  );
};

export default PostPage;

