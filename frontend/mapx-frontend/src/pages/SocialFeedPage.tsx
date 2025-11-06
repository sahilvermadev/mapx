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
import SuggestedUsersCard from '@/components/SocialFeed/SuggestedUsersCard';
import QuestionFeedPost from '@/components/QuestionFeedPost';

import { useAuth } from '@/auth';
// import { AskQuestionModal } from '@/components/AskQuestionModal';
import { useFeedSearchResults } from '@/hooks/useFeedSearchResults';
// import { useAskQuestion } from '@/hooks/useAskQuestion';
import { useQueryClient } from '@tanstack/react-query';
import CityFilterBar, { type CitySummary } from '@/components/SocialFeed/CityFilterBar';
import AskQuestionModal from '@/components/SocialFeed/AskQuestionModal';

// (Ask Question modal moved to components)

import { useFeedQuery } from '@/hooks/useFeedQuery';
import { useSuggestedUsersQuery } from '@/hooks/useSuggestedUsersQuery';
import { useFollowMutation } from '@/hooks/useFollowMutation';

import { type User, type FeedPost as FeedPostType } from '@/services/socialService';
import type { SearchResponse } from '@/services/recommendationsApiService';

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
  const queryClient = useQueryClient();
  
  // Local state
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [askOpen, setAskOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<{ id?: string; name?: string } | undefined>(undefined);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  
  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isSearchingRef = useRef(false);
  const lastSearchTimeRef = useRef(0);
  
  // Guard to prevent modal from opening during/after search operations
  const setAskOpenSafe = useCallback((value: boolean) => {
    if (value === true) {
      const timeSinceSearch = Date.now() - lastSearchTimeRef.current;
      // Block modal opening if search was just performed (within 500ms)
      if (isSearchingRef.current || timeSinceSearch < 500) {
        return;
      }
    }
    setAskOpen(value);
  }, []);
  
  // Search functionality
  const {
    searchResponse,
    streamingText,
    recIdToGroupKey,
    groupKeyToMeta,
    clearSearch,
    loadFromResponse,
    getScore,
    attachScoresToPosts,
  } = useFeedSearchResults();
  
  // Data fetching with React Query
  const citySlug = selectedCity?.id || (selectedCity?.name ? selectedCity.name.trim().toLowerCase().replace(/\s+/g, '-') : undefined);
  const {
    data: feedData,
    isLoading: loading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedQuery(currentUser?.id || '', selectedGroupIds, { includeQna: true, citySlug, countryCode: undefined, category: undefined });
  
  const {
    data: suggestedUsers = [],
    isLoading: suggestedUsersLoading,
    error: suggestedUsersError,
  } = useSuggestedUsersQuery(currentUser?.id || '');
  
  const followMutation = useFollowMutation(currentUser?.id || '');
  
  // Derived state
  const error = feedError?.message || suggestedUsersError?.message || null;
  // Flatten all pages and deduplicate posts by recommendation_id or id
  const allPosts = feedData?.pages.flatMap(page => (page as { data: any[] }).data) || [];
  const postsMap = new Map<number, any>();
  allPosts.forEach(post => {
    const postId = post.recommendation_id || post.id;
    if (postId && !postsMap.has(postId)) {
      postsMap.set(postId, post);
    }
  });
  const posts = Array.from(postsMap.values());
  const typedPosts = posts as any[];
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

  const toggleCategory = useCallback((key: string) => {
    setSelectedCategoryKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const handleSearchResults = useCallback((res: SearchResponse | null) => {
    // Mark that we just did a search to prevent accidental modal opening
    isSearchingRef.current = true;
    lastSearchTimeRef.current = Date.now();
    
    // Process search results - always load response to maintain search state
    // This allows UI to show results or "no results" message appropriately
    if (res) {
      loadFromResponse(res);
    } else {
      clearSearch();
    }
    
    // Reset search flag after a delay to allow modal opening again
    setTimeout(() => {
      isSearchingRef.current = false;
    }, 500);
  }, [clearSearch, loadFromResponse]);

  const handleSearchCleared = useCallback(() => {
    // If user clears the query input, just clear search state, don't open modal
    clearSearch();
  }, [clearSearch]);

  // Computed values - now using centralized getScore from hook

  const orderedPosts = useMemo(() => {
    if (searchResponse) {
      // Sort posts by search score and attach the scores to each post
      const sortedPosts = [...typedPosts].sort((a, b) => getScore(b) - getScore(a));
      
      // Use centralized method to attach scores
      return attachScoresToPosts(sortedPosts);
    }
    return typedPosts;
  }, [typedPosts, searchResponse, getScore, attachScoresToPosts]);

  // Build city summaries from live feed posts
  const deriveCityKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');

  const getCityFromPost = (post: any): { id: string; name: string } | null => {
    const address: string | undefined = post?.place_address || post?.service_address || post?.metadata?.address;
    const titleLike: string | undefined = post?.place_name || post?.service_name || post?.title;
    const tryCandidates: string[] = [];
    if (typeof post?.metadata?.city === 'string') tryCandidates.push(post.metadata.city);
    if (address) tryCandidates.push(address);
    if (titleLike) tryCandidates.push(titleLike);
    for (const cand of tryCandidates) {
      if (!cand) continue;
      const lc = cand.toLowerCase();
      // Simple city detection for common patterns
      if (lc.includes('delhi')) return { id: 'delhi', name: 'Delhi' };
      if (lc.includes('mumbai') || lc.includes('bombay')) return { id: 'mumbai', name: 'Mumbai' };
      if (lc.includes('gurgaon') || lc.includes('gurugram')) return { id: 'gurgaon', name: 'Gurgaon' };
      if (lc.includes('bangalore') || lc.includes('bengaluru')) return { id: 'bangalore', name: 'Bangalore' };
      if (lc.includes('new york') || lc.includes('nyc')) return { id: 'nyc', name: 'New York' };
      if (lc.includes('london')) return { id: 'london', name: 'London' };
      if (lc.includes('san francisco') || lc.includes('sf')) return { id: 'sf', name: 'San Francisco' };
    }
    return null;
  };

  const textContains = (hay: any, needle: string): boolean => {
    if (!hay) return false;
    const s = String(hay).toLowerCase();
    return s.includes(needle.toLowerCase());
  };

  const matchesSelectedCity = (post: any, selected?: { id?: string; name?: string }): boolean => {
    if (!selected?.id && !selected?.name) return true;
    const toSlug = (s?: string) => (s ? s.trim().toLowerCase().replace(/\s+/g, '-') : undefined);
    const wantedSlug = selected?.id || toSlug(selected?.name);
    if (!wantedSlug) return true;
    // Prefer backend normalized fields first
    if (post?.place_city_slug && post.place_city_slug === wantedSlug) return true;
    if (post?.service_city_slug && post.service_city_slug === wantedSlug) return true;
    // Heuristic inference (legacy fields)
    const inferred = inferCityId(post);
    if (inferred && inferred === wantedSlug) return true;
    // Fallback: substring match against common text fields
    const name = selected?.name || selected?.id || '';
    return (
      textContains(post?.metadata?.city, name) ||
      textContains(post?.place_address, name) ||
      textContains(post?.service_address, name) ||
      textContains(post?.place_name, name) ||
      textContains(post?.service_name, name) ||
      textContains(post?.title, name)
    );
  };

  const categoryKeyFromPost = (post: any): string | null => {
    // Prefer backend-provided normalized field from places
    const primary: string | undefined = post?.place_primary_type;
    if (primary && typeof primary === 'string') return primary.toLowerCase();
    // Fallbacks
    if (post?.labels && Array.isArray(post.labels)) {
      const labels = post.labels.map((l: any) => String(l).toLowerCase());
      if (labels.some((l: string) => l.includes('restaurant') || l.includes('food'))) return 'restaurant';
      if (labels.some((l: string) => l.includes('cafe') || l.includes('coffee'))) return 'cafe';
      if (labels.some((l: string) => l.includes('experience') || l.includes('activity'))) return 'experience';
      if (labels.some((l: string) => l.includes('service'))) return 'service';
    }
    // Generic sensible defaults to keep chips visible for legacy posts
    if (post?.content_type === 'place') return 'restaurant';
    if (post?.content_type === 'service') return 'service';
    return null;
  };

  const citySummaries: CitySummary[] = useMemo(() => {
    const byCity: Record<string, CitySummary> = {};
    const toTitle = (s?: string) => s ? s.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ') : undefined;

    (typedPosts as any[]).forEach((p) => {
      // Prefer normalized slugs from backend (places or services)
      const slug: string | undefined = p?.place_city_slug || p?.service_city_slug;
      const country: string | undefined = p?.place_country_code || p?.service_country_code;
      let name: string | undefined = slug ? toTitle(String(slug)) : undefined;
      let key: string | undefined = slug;
      if (!key) {
        // Fallback to heuristic inference for legacy posts
        const city = getCityFromPost(p);
        if (city) {
          key = city.id || deriveCityKey(city.name);
          name = city.name;
        }
      }
      if (!key || !name) return;

      if (!byCity[key]) {
        byCity[key] = {
          id: key,
          name,
          country,
          recCount: 0,
          friendCount: 0,
          friendFaces: [],
          categories: [],
        };
      }
      const summary = byCity[key];
      summary.recCount += 1;
      // friend faces (unique by user)
      const userId = String(p.user_id);
      if (!summary.friendFaces.some(f => f.id === userId)) {
        summary.friendFaces.push({ id: userId, name: p.user_name || 'Friend', photoUrl: p.user_picture });
        summary.friendCount = summary.friendFaces.length;
      }
      // category buckets
      const cat = categoryKeyFromPost(p);
      if (cat) {
        const bucket = summary.categories.find(c => c.key === cat);
        if (bucket) bucket.count = (bucket.count || 0) + 1;
        else summary.categories.push({ key: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1), count: 1 });
      }
    });

    return Object.values(byCity)
      .map(c => ({
        ...c,
        friendFaces: c.friendFaces.slice(0, 8),
        categories: c.categories.sort((a, b) => (b.count || 0) - (a.count || 0))
      }))
      .sort((a, b) => b.recCount - a.recCount);
  }, [typedPosts]);

  // Heuristic: try to infer a normalized city id from a post
  const inferCityId = (post: any): string | undefined => {
    const cityName =
      post?.place?.city?.name ||
      post?.place?.city_name ||
      post?.location?.city ||
      post?.city ||
      undefined;
    if (!cityName || typeof cityName !== 'string') return undefined;
    const lc = cityName.toLowerCase();
    if (lc.includes('delhi')) return 'delhi';
    if (lc.includes('mumbai') || lc.includes('bombay')) return 'mumbai';
    if (lc.includes('new york') || lc.includes('nyc')) return 'nyc';
    return undefined;
  };

  const postHasCategory = (post: any, key: string): boolean => {
    const primary = categoryKeyFromPost(post);
    if (primary) return primary === key.toLowerCase();
    return false;
  };

  const filteredPosts = useMemo(() => {
    if ((!selectedCity?.id && !selectedCity?.name && selectedCategoryKeys.length === 0)) return orderedPosts;
    return (orderedPosts as any[]).filter(p => {
      // City filter: require a match when a city is selected
      if (selectedCity && !matchesSelectedCity(p, selectedCity)) return false;
      // Categories filter: require at least one match when categories selected
      if (selectedCategoryKeys.length > 0) {
        const anyMatch = selectedCategoryKeys.some(key => postHasCategory(p, key));
        if (!anyMatch) return false;
      }
      return true;
    });
  }, [orderedPosts, selectedCity, selectedCategoryKeys]);

  // Derive available categories for the current scope (Worldwide or selected city)
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    const push = (key: string) => counts.set(key, (counts.get(key) || 0) + 1);

    const sourcePosts = selectedCity?.id || selectedCity?.name
      ? (orderedPosts as any[]).filter(p => matchesSelectedCity(p, selectedCity))
      : (orderedPosts as any[]);

    for (const p of sourcePosts) {
      const key = categoryKeyFromPost(p);
      if (key) push(key);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), count }));
  }, [orderedPosts, selectedCity]);

  const globalSummary: CitySummary | undefined = useMemo(() => {
    const all = (typedPosts as any[]) || [];
    if (all.length === 0) return {
      id: 'worldwide',
      name: 'Worldwide',
      recCount: 0,
      friendCount: 0,
      friendFaces: [],
      categories: [],
    };
    const uniqueUsers = new Map<string, { id: string; name: string; photoUrl?: string }>();
    const catCounts = new Map<string, number>();
    for (const p of all) {
      const uid = String(p.user_id);
      if (!uniqueUsers.has(uid)) uniqueUsers.set(uid, { id: uid, name: p.user_name || 'Friend', photoUrl: p.user_picture });
      const cat = categoryKeyFromPost(p);
      if (cat) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    }
    return {
      id: 'worldwide',
      name: 'Worldwide',
      recCount: all.length,
      friendCount: uniqueUsers.size,
      friendFaces: Array.from(uniqueUsers.values()).slice(0, 8),
      categories: Array.from(catCounts.entries())
        .sort((a,b)=>b[1]-a[1])
        .map(([key,count])=>({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), count })),
    };
  }, [typedPosts]);

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

    const shouldGroup = Boolean(searchResponse);
    if (!shouldGroup) {
      return (
        <div className="space-y-6">
          {filteredPosts.map((post: any) => {
            if (post.type === 'question') {
              return (
                <QuestionFeedPost
                  key={`q-${post.id}`}
                  question={post}
                  currentUserId={currentUser?.id || ''}
                  onQuestionUpdate={() => {
                    // Invalidate and refetch the feed data
                    queryClient.invalidateQueries({ queryKey: ['feed', currentUser?.id, selectedGroupIds] });
                  }}
                />
              );
            }
            return (
              <FeedPost
                key={post.recommendation_id}
                post={post}
                currentUserId={currentUser?.id || ''}
                onPostUpdate={() => {
                  // Invalidate and refetch the feed data
                  queryClient.invalidateQueries({ queryKey: ['feed', currentUser?.id, selectedGroupIds] });
                }}
              />
            );
          })}
          
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
          posts={filteredPosts as FeedPostType[]}
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
        className="rounded-none border-2 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]"
      >
        {user.is_following ? 'Following' : 'Follow'}
      </Button>
    </div>
  );

  const renderSuggestedUsersCard = () => (
    <SuggestedUsersCard 
      users={typedSuggestedUsers as any}
      onFollow={(id) => handleFollow(id)}
      onViewAll={handleNavigateToDiscover}
    />
  );

  const renderPageSkeleton = () => (
    <div className="min-h-[calc(100vh-64px)] overflow-x-hidden" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>
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
    <div className="min-h-[calc(100vh-64px)] overflow-x-hidden" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>
      {/* Secondary sticky header: City filter bar */}
      {/* Fixed city filter bar under main header */}
      <div className="fixed top-16 left-0 right-0 z-40">
        <CityFilterBar
          cities={citySummaries}
          selectedCityId={selectedCity?.id}
          selectedCityName={selectedCity?.name}
          selectedCategoryKeys={selectedCategoryKeys}
          onSelectCity={(c: { id?: string; name?: string } | undefined) => setSelectedCity(c)}
          onToggleCategory={toggleCategory}
          globalSummary={globalSummary}
          overrideCategories={availableCategories}
        />
      </div>
      {/* Spacer to offset fixed bar height */}
      <div className="h-[56px] lg:h-[64px]" />
      <div className="container mx-auto px-4 py-8">
        <div className={`grid grid-cols-1 gap-8 ${typedSuggestedUsers.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-1 lg:max-w-4xl lg:mx-auto'}`}>
          <div className={typedSuggestedUsers.length > 0 ? 'lg:col-span-3' : 'lg:col-span-1'}>
            <div className="mb-6">
              <FeedAISearch isAuthenticated={!!currentUser} onResults={handleSearchResults} onCleared={handleSearchCleared} />
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
                  text={searchResponse?.summary || streamingText}
                  isLoading={Boolean(searchResponse && (!searchResponse.summary || searchResponse.summary.trim().length === 0))}
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

          {/* Sidebar: Only render when we actually have suggestions to avoid layout flash */}
          
            {typedSuggestedUsers.length > 0 && (
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {renderSuggestedUsersCard()}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Floating Ask button */}
      <button
        type="button"
        className="fixed bottom-6 right-6 rounded-none border-2 border-black bg-yellow-300 px-6 py-3 text-black shadow-[6px_6px_0_0_#000] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0_0_#000]"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAskOpenSafe(true);
        }}
        aria-label="Ask a question"
      >
        <span className="font-extrabold tracking-wide">ASK</span>
      </button>
      <AskQuestionModal open={askOpen} initialText="" onClose={() => setAskOpenSafe(false)} />
    </div>
  );
};

export default React.memo(SocialFeedPage);
