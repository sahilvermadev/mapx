import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import FeedPost from '@/components/FeedPost';
import FeedPostSkeleton from '@/components/skeletons/FeedPostSkeleton';
import SearchResultsInline from '@/components/SearchResultsInline';
import SuggestedUsersCard from '@/components/SocialFeed/SuggestedUsersCard';
import QuestionFeedPost from '@/components/QuestionFeedPost';
import NewPostsBanner from '@/components/SocialFeed/NewPostsBanner';
import FeedGroups from '@/components/SocialFeed/FeedGroups';
import FeedAISearch from '@/components/FeedAISearch';
import { FeedFiltersProvider } from '@/contexts/FeedFiltersContext';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

import { useAuth } from '@/auth';
import { useFeedSearchResults } from '@/hooks/useFeedSearchResults';
import { useQueryClient } from '@tanstack/react-query';

import { useFeedQuery } from '@/hooks/useFeedQuery';
import { useSuggestedUsersQuery } from '@/hooks/useSuggestedUsersQuery';
import { useFollowMutation } from '@/hooks/useFollowMutation';

import { type User, type FeedPost as FeedPostType } from '@/services/socialService';
import {
  getLastViewedFeedTimestamp,
  setLastViewedFeedTimestamp,
  countNewPosts,
  getFirstNewPostIndex,
} from '@/utils/feedTimestamp';

const SocialFeedPage: React.FC = () => {
  // Get feed click time from sessionStorage, or use current time if not available
  const getFeedClickTime = (): number => {
    const stored = sessionStorage.getItem('feedClickTime');
    if (stored) {
      const clickTime = parseFloat(stored);
      const timestamp = sessionStorage.getItem('feedClickTimestamp');
      console.log(`[PERF] SocialFeedPage: Found feed click time${timestamp ? ` (clicked at ${new Date(parseInt(timestamp)).toISOString()})` : ''}`);
      sessionStorage.removeItem('feedClickTime'); // Clean up after reading
      sessionStorage.removeItem('feedClickTimestamp');
      return clickTime;
    }
    // Fallback to current time if navigating directly (not from header click)
    const now = performance.now();
    console.log(`[PERF] SocialFeedPage: No click time found, using mount time`);
    return now;
  };
  
  const feedClickTime = useRef<number>(getFeedClickTime());
  const pageLoadStartTime = useRef<number>(feedClickTime.current);
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  const queryClient = useQueryClient();
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  
  // Log component mount
  useEffect(() => {
    const mountTime = performance.now() - pageLoadStartTime.current;
    console.log(`[PERF] SocialFeedPage mounted in ${mountTime.toFixed(2)}ms (from ${feedClickTime.current === pageLoadStartTime.current ? 'click' : 'mount'})`);
  }, []);
  
  // Local state
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [selectedCity, setSelectedCity] = useState<{ id?: string; name?: string } | undefined>(undefined);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  const [isSuggestedUsersClosed, setIsSuggestedUsersClosed] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  
  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const firstNewPostRef = useRef<HTMLDivElement | null>(null);
  const initialScrollYRef = useRef<number>(0);
  
  // Search functionality
  const {
    searchResponse,
    streamingText,
    isSummaryLoading,
    recIdToGroupKey,
    groupKeyToMeta,
    clearSearch,
    loadFromStream,
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
  const flattenStartTime = performance.now();
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
  const flattenTime = performance.now() - flattenStartTime;
  if (flattenTime > 5) {
    console.log(`[PERF] Post flattening/deduplication took ${flattenTime.toFixed(2)}ms for ${allPosts.length} posts`);
  }
  const typedSuggestedUsers = suggestedUsers as User[];
  const hasActiveSearch = Boolean(searchResponse);
  const showSuggestedUsers = typedSuggestedUsers.length > 0 && !hasActiveSearch && !isSuggestedUsersClosed;

  // Effects
  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      navigate('/');
    }
  }, [isChecking, isAuthenticated, navigate]);
  

  useEffect(() => {
    if (!loading && !suggestedUsersLoading && typedPosts.length > 0) {
      const totalLoadTime = performance.now() - pageLoadStartTime.current;
      console.log('🎉 [PERF] SocialFeedPage fully loaded!');
      console.log(`📊 [PERF] Stats: ${typedPosts.length} posts, ${typedSuggestedUsers.length} suggested users`);
      console.log(`⏱️ [PERF] Total page load time: ${totalLoadTime.toFixed(2)}ms (from ${feedClickTime.current === pageLoadStartTime.current ? 'button click' : 'component mount'})`);
    }
  }, [loading, suggestedUsersLoading, typedPosts.length, typedSuggestedUsers.length]);

  // Calculate new posts count when feed loads
  useEffect(() => {
    if (!loading && typedPosts.length > 0 && !searchResponse) {
      const lastViewed = getLastViewedFeedTimestamp();
      const count = countNewPosts(typedPosts, lastViewed);
      setNewPostsCount(count);
      setShowNewPostsBanner(count > 0);
      
      // Reset ref when posts change
      firstNewPostRef.current = null;
    } else if (searchResponse) {
      // Hide banner during search
      setShowNewPostsBanner(false);
    }
  }, [loading, typedPosts, searchResponse]);

  // Update last viewed timestamp when user leaves the page or when page becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && typedPosts.length > 0) {
        // Update to the most recent post's timestamp when user switches tabs or minimizes
        const mostRecentPost = typedPosts[0];
        if (mostRecentPost?.created_at) {
          setLastViewedFeedTimestamp(mostRecentPost.created_at);
        }
      }
    };

    const handleBeforeUnload = () => {
      if (typedPosts.length > 0) {
        // Update to the most recent post's timestamp
        const mostRecentPost = typedPosts[0];
        if (mostRecentPost?.created_at) {
          setLastViewedFeedTimestamp(mostRecentPost.created_at);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [typedPosts]);

  // Scroll detection to auto-dismiss banner
  useEffect(() => {
    if (!showNewPostsBanner || newPostsCount === 0) return;

    // Record initial scroll position when banner appears
    initialScrollYRef.current = window.scrollY || window.pageYOffset;

    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      // Debounce scroll events
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const currentScrollY = window.scrollY || window.pageYOffset;
        const scrollDelta = currentScrollY - initialScrollYRef.current;
        
        // If user has scrolled down significantly (200px), dismiss banner
        if (scrollDelta > 200) {
          setShowNewPostsBanner(false);
          if (typedPosts.length > 0 && typedPosts[0]?.created_at) {
            setLastViewedFeedTimestamp(typedPosts[0].created_at);
          }
          return;
        }
        
        // Also check if we've scrolled past the first new post
        if (firstNewPostRef.current) {
          const headerHeight = 64;
          const cityBarHeight = window.innerWidth >= 1024 ? 64 : 56;
          const totalOffset = headerHeight + cityBarHeight;
          
          const firstNewPostTop = firstNewPostRef.current.getBoundingClientRect().top;

          // If user has scrolled past the first new post (accounting for fixed headers), dismiss banner
          if (firstNewPostTop < totalOffset - 50) {
            setShowNewPostsBanner(false);
            // Update timestamp to the most recent post
            if (typedPosts.length > 0 && typedPosts[0]?.created_at) {
              setLastViewedFeedTimestamp(typedPosts[0].created_at);
            }
          }
        }
      }, 100); // Debounce by 100ms
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [showNewPostsBanner, newPostsCount, typedPosts]);

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

  const handleSearchCleared = useCallback(() => {
    // If user clears the query input, just clear search state, don't open modal
    clearSearch();
  }, [clearSearch]);

  const handleFollowUpQuery = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('feed-search:submit', { detail: text }));
  }, []);

  const handleShowNewPosts = useCallback(() => {
    if (firstNewPostRef.current) {
      // Account for fixed header (64px) and city bar (56px mobile, 64px desktop)
      // Header height is now dynamic via CSS variable
      const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '64');
      const offset = headerHeight + 20; // 20px padding
      
      const elementTop = firstNewPostRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: Math.max(0, elementTop - offset),
        behavior: 'smooth',
      });
    } else {
      // Fallback: refresh the feed
      queryClient.invalidateQueries({ queryKey: ['feed', currentUser?.id, selectedGroupIds] });
    }
  }, [currentUser?.id, selectedGroupIds, queryClient]);

  const handleDismissBanner = useCallback(() => {
    setShowNewPostsBanner(false);
    // Update timestamp to current time (user has seen the new posts notification)
    if (typedPosts.length > 0 && typedPosts[0]?.created_at) {
      setLastViewedFeedTimestamp(typedPosts[0].created_at);
    }
  }, [typedPosts]);

  // Computed values - now using centralized getScore from hook
  const { matchedRecIds, matchedAnswerRecIds, matchedQuestionIds } = useMemo(() => {
    const startTime = performance.now();
    const recIds = new Set<number>();
    const answerRecIds = new Set<number>();
    const questionIds = new Set<number>();
    if (searchResponse) {
      for (const group of (searchResponse as any).results || []) {
        if (Array.isArray((group as any).recommendations)) {
          for (const rec of (group as any).recommendations) {
            if (typeof rec.recommendation_id === 'number') recIds.add(rec.recommendation_id);
          }
        }
      }
      const qna = (searchResponse as any).qna;
      if (qna?.answers) {
        for (const a of qna.answers) {
          const id = (a as any).recommendation_id ?? (a as any).id;
          if (typeof id === 'number') answerRecIds.add(id);
        }
      }
      if (qna?.questions) {
        for (const q of qna.questions) {
          if (typeof q.id === 'number') questionIds.add(q.id);
        }
      }
    }
    const time = performance.now() - startTime;
    if (time > 5) {
      console.log(`[PERF] matchedRecIds computation took ${time.toFixed(2)}ms`);
    }
    return { matchedRecIds: recIds, matchedAnswerRecIds: answerRecIds, matchedQuestionIds: questionIds };
  }, [searchResponse]);

  const matchedPosts = useMemo(() => {
    if (!searchResponse) return typedPosts;
    return (typedPosts as any[]).filter(p => {
      if (p.type === 'recommendation') return matchedRecIds.has(p.recommendation_id);
      if (p.type === 'answer') return matchedAnswerRecIds.has(p.recommendation_id);
      if (p.type === 'question') return matchedQuestionIds.has(p.id);
      return false;
    });
  }, [typedPosts, searchResponse, matchedRecIds, matchedAnswerRecIds, matchedQuestionIds]);

  const orderedPosts = useMemo(() => {
    const startTime = performance.now();
    let result;
    if (searchResponse) {
      // Sort strictly matched posts by search score and attach scores
      const sortedPosts = [...matchedPosts].sort((a, b) => getScore(b) - getScore(a));
      result = attachScoresToPosts(sortedPosts);
    } else {
      result = typedPosts;
    }
    const time = performance.now() - startTime;
    if (time > 5) {
      console.log(`[PERF] orderedPosts computation took ${time.toFixed(2)}ms for ${result.length} posts`);
    }
    return result;
  }, [typedPosts, matchedPosts, searchResponse, getScore, attachScoresToPosts]);


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
    const startTime = performance.now();
    let base = orderedPosts as any[];

    if ((!selectedCity?.id && !selectedCity?.name && selectedCategoryKeys.length === 0)) {
      const time = performance.now() - startTime;
      if (time > 5) {
        console.log(`[PERF] filteredPosts (no filters) took ${time.toFixed(2)}ms`);
      }
      return base;
    }
    const result = (base as any[]).filter(p => {
      // City filter: require a match when a city is selected
      if (selectedCity && !matchesSelectedCity(p, selectedCity)) return false;
      // Categories filter: require at least one match when categories selected
      if (selectedCategoryKeys.length > 0) {
        const anyMatch = selectedCategoryKeys.some(key => postHasCategory(p, key));
        if (!anyMatch) return false;
      }
      return true;
    });
    const time = performance.now() - startTime;
    if (time > 5) {
      console.log(`[PERF] filteredPosts took ${time.toFixed(2)}ms, filtered ${base.length} -> ${result.length} posts`);
    }
    return result;
  }, [orderedPosts, selectedCity, selectedCategoryKeys]);

  // Derive available categories for the current scope (Worldwide or selected city)
  // Optimized: Only process first 100 posts to reduce computation overhead
  const availableCategories = useMemo(() => {
    const startTime = performance.now();
    
    // Early return if no posts
    if (orderedPosts.length === 0) {
      return [];
    }
    
    const counts = new Map<string, number>();
    const push = (key: string) => counts.set(key, (counts.get(key) || 0) + 1);

    const sourcePosts = selectedCity?.id || selectedCity?.name
      ? (orderedPosts as any[]).filter(p => matchesSelectedCity(p, selectedCity))
      : (orderedPosts as any[]);

    // Limit to first 100 posts for performance
    const limitedPosts = sourcePosts.slice(0, 100);

    for (const p of limitedPosts) {
      const key = categoryKeyFromPost(p);
      if (key) push(key);
    }
    const result = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), count }));
    const time = performance.now() - startTime;
    if (time > 5) {
      console.log(`[PERF] availableCategories computation took ${time.toFixed(2)}ms for ${limitedPosts.length} posts (of ${sourcePosts.length} total), found ${result.length} categories`);
    }
    return result;
  }, [orderedPosts, selectedCity]);

  // Render functions
  const renderFeedContent = () => {
    if (loading) {
      return (
        <div className="space-y-1.5">
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
      const lastViewed = getLastViewedFeedTimestamp();
      const firstNewIndex = getFirstNewPostIndex(filteredPosts, lastViewed);
      let firstNewPostSet = false; // Track if we've set the ref
      
      return (
        <div className="space-y-1.5">
          {filteredPosts.map((post: any, index: number) => {
            const isFirstNewPost = !firstNewPostSet && index === firstNewIndex && firstNewIndex >= 0;
            
            if (isFirstNewPost) {
              firstNewPostSet = true;
            }
            
            if (post.type === 'question') {
              return (
                <div
                  key={`q-${post.id}`}
                  ref={isFirstNewPost ? (el) => {
                    if (el) {
                      firstNewPostRef.current = el;
                    }
                  } : undefined}
                  data-is-new-post={isFirstNewPost ? 'true' : undefined}
                >
                  <QuestionFeedPost
                    question={post}
                    currentUserId={currentUser?.id || ''}
                    onQuestionUpdate={() => {
                      // Invalidate and refetch the feed data
                      queryClient.invalidateQueries({ queryKey: ['feed', currentUser?.id, selectedGroupIds] });
                    }}
                  />
                </div>
              );
            }
            return (
              <div
                key={post.recommendation_id}
                ref={isFirstNewPost ? (el) => {
                  if (el) {
                    firstNewPostRef.current = el;
                  }
                } : undefined}
                data-is-new-post={isFirstNewPost ? 'true' : undefined}
              >
                <FeedPost
                  post={post}
                  currentUserId={currentUser?.id || ''}
                  onPostUpdate={() => {
                    // Invalidate and refetch the feed data
                    queryClient.invalidateQueries({ queryKey: ['feed', currentUser?.id, selectedGroupIds] });
                  }}
                />
              </div>
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

  const renderSuggestedUsersCard = () => (
    <SuggestedUsersCard 
      users={typedSuggestedUsers as any}
      onFollow={(id) => handleFollow(id)}
      onViewAll={handleNavigateToDiscover}
      onClose={() => setIsSuggestedUsersClosed(true)}
    />
  );

  const renderPageSkeleton = () => (
    <div className="min-h-[calc(100vh-64px)] overflow-x-hidden" style={{ backgroundColor: selectedTheme?.backgroundColor || 'var(--app-bg)', color: selectedTheme?.textPrimary || 'var(--app-text)' }}>
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
                <div 
                  key={i} 
                  className="rounded-lg p-6 shadow-sm border"
                  style={selectedTheme ? {
                    backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                    borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor,
                  } : undefined}
                >
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
              <div 
                className="rounded-lg p-6 shadow-sm border"
                style={selectedTheme ? {
                  backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                  borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor,
                } : undefined}
              >
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
    <FeedFiltersProvider
      value={{
        cities: [],
        selectedCityId: selectedCity?.id,
        selectedCityName: selectedCity?.name,
        globalSummary: undefined,
        onSelectCity: (c: { id?: string; name?: string } | undefined) => setSelectedCity(c),
        selectedCategoryKeys,
        onToggleCategory: toggleCategory,
        overrideCategories: availableCategories,
        isAuthenticated: !!currentUser,
        onStream: loadFromStream,
        onCleared: handleSearchCleared,
        searchPlaceholder: "Tell us what you're looking for...",
        currentUserId: currentUser?.id || '',
        selectedGroupIds,
        onGroupToggle: handleGroupToggle,
        hasActiveSearch,
      }}
    >
      <div 
        className={`min-h-[calc(100vh-64px)] overflow-x-hidden ${hasActiveSearch ? 'pb-20' : ''}`} 
        style={{ 
          backgroundColor: hasActiveSearch && selectedTheme 
            ? selectedTheme.backgroundColor 
            : 'var(--app-bg)', 
          color: 'var(--app-text)' 
        }}
      >
      <div className="container mx-auto px-4 py-8">
        <div className={`grid grid-cols-1 gap-8 ${showSuggestedUsers ? 'lg:grid-cols-4' : 'lg:grid-cols-1 lg:max-w-4xl lg:mx-auto'}`}>
          <div className={showSuggestedUsers ? 'lg:col-span-3' : 'lg:col-span-1'}>
            
            {/* New Posts Banner - small floating element above posts */}
            {showNewPostsBanner && newPostsCount > 0 && (
              <NewPostsBanner
                count={newPostsCount}
                onShowNewPosts={handleShowNewPosts}
                onDismiss={handleDismissBanner}
              />
            )}
            
            {(searchResponse || isSummaryLoading) && (
              <div className="mb-12 space-y-4">
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-10 w-10 rounded-full"
                    onClick={handleSearchCleared}
                    aria-label="Back to feed"
                  >
                    ←
                  </Button>
                </div>
                <div className="relative z-20 search-results-container">
                <SearchResultsInline
                  searchResponse={searchResponse}
                    summaryText={streamingText}
                    followUpPrompts={searchResponse?.follow_up_prompts}
                    isLoading={isSummaryLoading}
                  onFollowUpQuery={handleFollowUpQuery}
                />
                </div>
              </div>
            )}
            
            {!searchResponse && (
              <div className="space-y-1.5">
                {renderFeedContent()}
              </div>
            )}
          </div>

          {/* Sidebar: Only render when we actually have suggestions to avoid layout flash */}
          
            {showSuggestedUsers && (
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {renderSuggestedUsersCard()}
              </div>
            </div>
          )}
      </div>
    </div>
      {hasActiveSearch && (
        <div 
          className="pointer-events-none fixed inset-0 z-10" 
          style={(() => {
            if (!selectedTheme) {
              return { backgroundColor: 'rgba(0, 0, 0, 0.3)' };
            }
            // Convert hex to rgb for rgba usage
            const hex = selectedTheme.backgroundColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.8)` }; // 80% opacity
          })()}
        />
      )}
      {hasActiveSearch && (
        <>
          {/* Gradient fade overlay to hide content behind search bar - starts at search bar level */}
          <div 
            className="fixed bottom-0 left-0 right-0 pointer-events-none z-30" 
            style={(() => {
              if (!selectedTheme) {
                return {
                  height: '88px',
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.3) 20%, rgba(255, 255, 255, 0.7) 50%, rgb(255, 255, 255) 100%)'
                };
              }
              // Convert hex to rgb for rgba usage
              const hex = selectedTheme.backgroundColor.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              return {
                height: '88px',
                background: `linear-gradient(to bottom, transparent 0%, rgba(${r}, ${g}, ${b}, 0.25) 20%, rgba(${r}, ${g}, ${b}, 0.7) 50%, rgba(${r}, ${g}, ${b}, 1) 100%)`
              };
            })()}
          />
          <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-40">
            <div className="pointer-events-auto container mx-auto px-4 w-full max-w-4xl">
            <FeedAISearch
              key="feed-search-bottom"
              isAuthenticated={!!currentUser}
              onStream={loadFromStream}
              onCleared={handleSearchCleared}
              variant="bottom"
              placeholder="Ask a follow-up…"
              autoFocus
            />
          </div>
        </div>
    </>
      )}
      </div>
    </FeedFiltersProvider>
  );
};

export default React.memo(SocialFeedPage);
