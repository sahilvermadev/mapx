import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import FeedPost from '@/components/FeedPost';
import FeedPostSkeleton from '@/components/skeletons/FeedPostSkeleton';
import SimpleGroupFilter from '@/components/SimpleGroupFilter';
import { feedApi } from '@/services/feed';
import { socialApi, type User, type FeedPost as FeedPostType } from '@/services/social';
import FeedAISearch from '@/components/FeedAISearch';
import type { SearchResponse } from '@/services/recommendationsApi';
import { useAuth } from '@/contexts/AuthContext';
import AIResponseBanner from '@/components/SocialFeed/AIResponseBanner';
import FeedGroups from '@/components/SocialFeed/FeedGroups';
import { useFeedSearchResults } from '@/hooks/useFeedSearchResults';


// Constants
const FEED_LIMIT = 20;
const FEED_OFFSET = 0;
const SUGGESTED_USERS_LIMIT = 5;

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

// Component
const SocialFeedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  
  // State
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  // Search state handled by hook
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
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  

  // Effects
  useEffect(() => {
    // Only redirect if auth check is complete and user is not authenticated
    if (!isChecking && !isAuthenticated) {
      navigate('/');
      return;
    }
  }, [isChecking, isAuthenticated, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    loadFeed();
    loadSuggestedUsers();
  }, [currentUser, selectedGroupIds]);

  // Event handlers
  const loadFeed = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    
    try {
      let response;
      if (selectedGroupIds.length > 0) {
        response = await feedApi.getFeed(currentUser.id, FEED_LIMIT, FEED_OFFSET, selectedGroupIds);
      } else {
        response = await feedApi.getFeed(currentUser.id, FEED_LIMIT, FEED_OFFSET);
      }
      
      if (response.success && response.data) {
        setPosts(response.data);
      } else {
        setError(response.error || 'Failed to load feed');
        // Only clear posts if this is the initial load
        if (showLoading) {
          setPosts([]);
        }
      }
    } catch (e) {
      console.error('SocialFeedPage - Feed loading error:', e);
      setError('Failed to load feed');
      // Only clear posts if this is the initial load
      if (showLoading) {
        setPosts([]);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadSuggestedUsers = async () => {
    try {
      const res = await socialApi.getSuggestedUsers(currentUser.id, SUGGESTED_USERS_LIMIT);
      if (res.success && res.data) {
        setSuggestedUsers(res.data);
      }
    } catch (e) {
      console.error('Failed to load suggested users:', e);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      await socialApi.followUser(userId, currentUser.id);
      loadSuggestedUsers();
      loadFeed(false); // Refresh without showing loading state
    } catch (e) {
      console.error('Failed to follow user:', e);
    }
  };


  const handleGroupToggle = (groupId: number) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };


  const handleNavigateToDiscover = () => {
    navigate('/friends');
  };

  // Receive semantic search results and build maps for relevance sorting
  const handleSearchResults = useCallback((res: SearchResponse | null) => {
    if (!res || !res.results) {
      clearSearch();
      return;
    }
    loadFromResponse(res);
  }, [clearSearch, loadFromResponse]);

  // Render components

  // Map navigation no longer used by inline sorting


  // If we have search scores, sort posts by similarity desc.
  // Priority: per-recommendation similarity, then place-based similarity, else original order
  const getScore = (post: FeedPostType): number => {
    const recScore = searchRecommendationScores?.[post.recommendation_id];
    if (typeof recScore === 'number') return recScore;
    const placeScore = post.place_id ? (searchScores?.[post.place_id] ?? 0) : 0;
    return placeScore;
  };

  const orderedPosts = useMemo(() => (
    (searchScores || searchRecommendationScores)
      ? [...posts].sort((a, b) => getScore(b) - getScore(a))
      : posts
  ), [posts, searchScores, searchRecommendationScores]);

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
          <Button onClick={() => loadFeed(true)} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    if (posts.length === 0) {
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

    // Group consecutive results for the same place or service while a search is active
    const shouldGroup = Boolean(searchScores || searchRecommendationScores);
    if (!shouldGroup) {
      return (
        <div className="space-y-6">
          {orderedPosts.map((post) => (
            <FeedPost
              key={post.recommendation_id}
              post={post}
              currentUserId={currentUser.id}
              onPostUpdate={loadFeed}
            />
          ))}
        </div>
      );
    }

    // Defer to reusable component for grouped rendering
    return (
      <FeedGroups
        posts={orderedPosts}
        recIdToGroupKey={recIdToGroupKey}
        groupKeyToMeta={groupKeyToMeta}
      />
    );
  };

  const renderSuggestedUser = (user: User) => (
    <div key={user.id} className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={getProxiedImageUrl(user.profile_picture_url)} alt={user.display_name} />
        <AvatarFallback>
          {getInitials(user.display_name)}
        </AvatarFallback>
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
        <CardDescription>
          People you might want to follow
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {suggestedUsers.length > 0 ? (
          suggestedUsers.map(renderSuggestedUser)
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

  // Show loading while authentication is being checked
  if (isChecking) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background overflow-x-hidden">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-3">
              {/* Search Section Skeleton */}
              <div className="mb-6">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              {/* Group Filter Skeleton */}
              <div className="mb-8">
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
              
              {/* Feed Content Skeleton */}
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
                {/* Suggested Users Card Skeleton */}
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
  }

  // Early return for loading state
  if (!currentUser) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background overflow-x-hidden">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-3">
              {/* Search Section Skeleton */}
              <div className="mb-6">
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              {/* Group Filter Skeleton */}
              <div className="mb-8">
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
              
              {/* Feed Content Skeleton */}
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
                {/* Suggested Users Card Skeleton */}
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
  }

  // Main render
  return (
    <div className="min-h-[calc(100vh-64px)] bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 py-8">
        <div className={`grid grid-cols-1 gap-8 ${suggestedUsers.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-1 lg:max-w-4xl lg:mx-auto'}`}>
          <div className={suggestedUsers.length > 0 ? 'lg:col-span-3' : 'lg:col-span-1'}>
            {/* Search Section */}
            <div className="mb-6">
              <FeedAISearch isAuthenticated={!!currentUser} onResults={handleSearchResults} />
            </div>

            {/* Simple Group Filter */}
            <div className="mb-8">
              <SimpleGroupFilter
                currentUserId={currentUser.id}
                selectedGroupIds={selectedGroupIds}
                onGroupToggle={handleGroupToggle}
              />
            </div>
            
            {/* AI Response Section */}
            {(searchResponse || streamingText) && (
              <div className="mb-12">
                <AIResponseBanner
                  text={streamingText}
                  totals={searchResponse ? { places: searchResponse.total_places, recs: searchResponse.total_recommendations } : undefined}
                />
              </div>
            )}
            
            {/* Feed Content Section */}
            <div className="space-y-8">
              {renderFeedContent()}
            </div>
          </div>

          {suggestedUsers.length > 0 && (
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {renderSuggestedUsersCard()}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Inline results are rendered by FeedAISearch; no modal */}
    </div>
  );
};

export default React.memo(SocialFeedPage);
