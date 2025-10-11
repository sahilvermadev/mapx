import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import FeedPost from '@/components/FeedPost';
import FeedPostSkeleton from '@/components/skeletons/FeedPostSkeleton';
import SimpleGroupFilter from '@/components/SimpleGroupFilter';
import FeedAISearch from '@/components/FeedAISearch';
import AIResponseBanner from '@/components/SocialFeed/AIResponseBanner';
import FeedGroups from '@/components/SocialFeed/FeedGroups';

import { useAuth } from '@/contexts/AuthContext';
import { useFeedSearchResults } from '@/hooks/useFeedSearchResults';
import { useFeedQuery } from '@/hooks/useFeedQuery';
import { useSuggestedUsersQuery } from '@/hooks/useSuggestedUsersQuery';
import { useFollowMutation } from '@/hooks/useFollowMutation';

import { type User, type FeedPost as FeedPostType } from '@/services/social';
import type { SearchResponse } from '@/services/recommendationsApi';

// Helper functions
const getInitials = (name: string): string => 
  name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const getProxiedImageUrl = (url?: string): string => {
  if (!url) return '';
  return url.includes('googleusercontent.com')
    ? `http://localhost:5000/auth/profile-picture?url=${encodeURIComponent(url)}`
    : url;
};

const SocialFeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  
  // Local state
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Search functionality
  const {
    searchScores,
    searchRecommendationScores,
    searchResponse,
    streamingText,
    recIdToGroupKey,
    groupKeyToMeta,
    clearSearch,
    loadFromResponse,
  } = useFeedSearchResults();
  
  // Data fetching with React Query
  const {
    data: feedData,
    isLoading: loading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedQuery(currentUser?.id || '', selectedGroupIds);
  
  const {
    data: suggestedUsers = [],
    isLoading: suggestedUsersLoading,
    error: suggestedUsersError,
  } = useSuggestedUsersQuery(currentUser?.id || '');
  
  const followMutation = useFollowMutation(currentUser?.id || '');
  
  // Derived state
  const error = feedError?.message || suggestedUsersError?.message || null;
  const posts = feedData?.pages.flatMap(page => (page as { data: FeedPostType[] }).data) || [];
  const typedPosts = posts as FeedPostType[];
  const typedSuggestedUsers = suggestedUsers as User[];

  // Effects
  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      navigate('/');
    }
  }, [isChecking, isAuthenticated, navigate]);

  useEffect(() => {
    if (!loading && !suggestedUsersLoading && typedPosts.length > 0) {
      console.log('🎉 [REACT-QUERY] SocialFeedPage fully loaded!');
      console.log(`📊 [REACT-QUERY] Stats: ${typedPosts.length} posts, ${typedSuggestedUsers.length} suggested users`);
    }
  }, [loading, suggestedUsersLoading, typedPosts.length, typedSuggestedUsers.length]);

  // Infinite scroll effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log('🔄 [INFINITE-SCROLL] Loading more posts...');
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Event handlers
  const handleFollow = useCallback((userId: string) => {
    if (!currentUser) return;
    followMutation.mutate(userId);
  }, [currentUser, followMutation]);

  const handleGroupToggle = useCallback((groupId: number) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  }, []);

  const handleNavigateToDiscover = useCallback(() => {
    navigate('/friends');
  }, [navigate]);

  const handleSearchResults = useCallback((res: SearchResponse | null) => {
    if (!res || !res.results) {
      clearSearch();
      return;
    }
    loadFromResponse(res);
  }, [clearSearch, loadFromResponse]);

  // Computed values
  const getScore = useCallback((post: FeedPostType): number => {
    const recScore = searchRecommendationScores?.[post.recommendation_id];
    if (typeof recScore === 'number') return recScore;
    const placeScore = post.place_id ? (searchScores?.[post.place_id] ?? 0) : 0;
    return placeScore;
  }, [searchScores, searchRecommendationScores]);

  const orderedPosts = useMemo(() => (
    (searchScores || searchRecommendationScores)
      ? [...typedPosts].sort((a, b) => getScore(b) - getScore(a))
      : typedPosts
  ), [typedPosts, searchScores, searchRecommendationScores, getScore]);

  // Render functions
  const renderFeedContent = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <FeedPostSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    if (typedPosts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
          <p className="text-muted-foreground mb-4 text-center">
            Follow some users to see their recommendations in your feed!
          </p>
          <Button onClick={handleNavigateToDiscover}>
            <Plus className="h-4 w-4 mr-2" />
            Find Friends
          </Button>
        </div>
      );
    }

    const shouldGroup = Boolean(searchScores || searchRecommendationScores);
    if (!shouldGroup) {
      return (
        <div className="space-y-6">
          {orderedPosts.map((post) => (
            <FeedPost
              key={post.recommendation_id}
              post={post}
              currentUserId={currentUser?.id || ''}
              onPostUpdate={() => window.location.reload()}
            />
          ))}
          
          {/* Load more trigger */}
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary"></div>
                <span className="text-sm">Loading more posts...</span>
              </div>
            )}
            {!hasNextPage && typedPosts.length > 0 && (
              <div className="text-center text-muted-foreground text-sm py-4">
                You've reached the end of your feed
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <FeedGroups
          posts={orderedPosts as FeedPostType[]}
          recIdToGroupKey={recIdToGroupKey}
          groupKeyToMeta={groupKeyToMeta}
        />
        
        {/* Load more trigger for grouped posts */}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary"></div>
              <span className="text-sm">Loading more posts...</span>
            </div>
          )}
          {!hasNextPage && typedPosts.length > 0 && (
            <div className="text-center text-muted-foreground text-sm py-4">
              You've reached the end of your feed
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSuggestedUser = (user: User) => (
    <div key={user.id} className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={getProxiedImageUrl(user.profile_picture_url)} alt={user.display_name} />
        <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{user.display_name}</div>
        <div className="text-xs text-muted-foreground">
          {user.followers_count || 0} followers
        </div>
      </div>
      
      <Button
        variant={user.is_following ? 'outline' : 'default'}
        size="sm"
        onClick={() => handleFollow(user.id)}
        disabled={user.is_following}
      >
        {user.is_following ? 'Following' : 'Follow'}
      </Button>
    </div>
  );

  const renderSuggestedUsersCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Suggested Users
        </CardTitle>
        <CardDescription>People you might want to follow</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {typedSuggestedUsers.length > 0 ? (
          typedSuggestedUsers.map(renderSuggestedUser)
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No suggestions available
          </p>
        )}
      </CardContent>
      
      <CardContent className="pt-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full" 
          onClick={handleNavigateToDiscover}
        >
          View All Users
        </Button>
      </CardContent>
    </Card>
  );

  const renderPageSkeleton = () => (
    <div className="min-h-[calc(100vh-64px)] bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="mb-6">
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <div className="mb-8">
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-start space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                      <Skeleton className="h-20 w-full" />
                      <div className="flex space-x-4">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white rounded-lg p-6 shadow-sm border">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-[150px]" />
                  <Skeleton className="h-4 w-[200px]" />
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-[120px]" />
                          <Skeleton className="h-3 w-[80px]" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Early returns for loading states
  if (isChecking || !currentUser) {
    return renderPageSkeleton();
  }


  return (
    <div className="min-h-[calc(100vh-64px)] bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 py-8">
        <div className={`grid grid-cols-1 gap-8 ${(suggestedUsersLoading || typedSuggestedUsers.length > 0) ? 'lg:grid-cols-4' : 'lg:grid-cols-1 lg:max-w-4xl lg:mx-auto'}`}>
          <div className={(suggestedUsersLoading || typedSuggestedUsers.length > 0) ? 'lg:col-span-3' : 'lg:col-span-1'}>
            <div className="mb-6">
              <FeedAISearch isAuthenticated={!!currentUser} onResults={handleSearchResults} />
            </div>

            <div className="mb-8">
              <SimpleGroupFilter
                currentUserId={currentUser.id}
                selectedGroupIds={selectedGroupIds}
                onGroupToggle={handleGroupToggle}
              />
            </div>
            
            {(searchResponse || streamingText) && (
              <div className="mb-12">
                <AIResponseBanner
                  text={streamingText}
                  totals={searchResponse ? { 
                    places: searchResponse.total_places, 
                    recs: searchResponse.total_recommendations 
                  } : undefined}
                />
              </div>
            )}
            
            <div className="space-y-8">
              {renderFeedContent()}
            </div>
          </div>

          {suggestedUsersLoading && (
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Suggested Users
                    </CardTitle>
                    <CardDescription>Loading suggestions...</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-[120px]" />
                          <Skeleton className="h-3 w-[80px]" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          {!suggestedUsersLoading && typedSuggestedUsers.length > 0 && (
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {renderSuggestedUsersCard()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(SocialFeedPage);
