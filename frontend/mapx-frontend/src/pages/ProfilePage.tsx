import React, { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue, startTransition } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Star, Heart, HelpCircle, Settings, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { profileApi, type FilterOptions, type ProfilePreferences, THEMES, type ThemeName, type UserData } from '@/services/profileService';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileTheme } from '@/contexts/ProfileThemeContext';
import { getReadableTextColor } from '@/utils/color';
import { useAuth } from '@/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useProfileQuery } from '@/hooks/useProfileQuery';
import { useProfileStatsQuery } from '@/hooks/useProfileStatsQuery';
import { useProfilePreferencesQuery } from '@/hooks/useProfilePreferencesQuery';
import { useProfilePlacesQuery } from '@/hooks/useProfilePlacesQuery';
import { getApiBaseUrl } from '@/config/apiConfig';

import FeedPost from '@/components/FeedPost';
import ServiceFeedPost from '@/components/ServiceFeedPost';
import QuestionFeedPost from '@/components/QuestionFeedPost';
import CityFilterBar, { type CitySummary } from '@/components/SocialFeed/CityFilterBar';

type TabType = 'recommendations' | 'likes' | 'questions';

interface ProfilePageProps {}

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  // React Query hooks for data fetching
  const { data: userData, isLoading: loading, error: profileError, refetch: refetchProfile } = useProfileQuery(userId) as { data: UserData | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
  const { data: userStats } = useProfileStatsQuery(userId);
  const { data: prefsData, refetch: refetchPrefs } = useProfilePreferencesQuery(userId);
  
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('recommendations');
  const [showCustomize, setShowCustomize] = useState(false);
  const [deletedPostIds, setDeletedPostIds] = useState<Set<number>>(new Set());
  const [editingBio, setEditingBio] = useState(userData?.bio || '');
  const [editingCity, setEditingCity] = useState(userData?.city || '');
  
  
  // Search state (for city bar integration)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // City filter state
  const [selectedCity, setSelectedCity] = useState<{ id?: string; name?: string } | undefined>(undefined);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  
  // Sync editing state with userData
  useEffect(() => {
    if (userData) {
      setEditingBio(userData.bio || '');
      setEditingCity(userData.city || '');
    }
  }, [userData]);

  // Format preferences banner URL (for display)
  const prefsDisplay: ProfilePreferences = useMemo(() => {
    if (!prefsData) return {};
    
    const formattedPrefs = { ...prefsData };
    // Ensure bannerUrl is properly formatted (add base URL if it's a relative path)
    if (formattedPrefs.bannerUrl && !formattedPrefs.bannerUrl.startsWith('http')) {
      const apiBase = getApiBaseUrl();
      // Remove '/api' suffix if present, as bannerUrl already includes the path
      const baseURL = apiBase.replace(/\/api$/, '');
      formattedPrefs.bannerUrl = formattedPrefs.bannerUrl.startsWith('/') 
        ? `${baseURL}${formattedPrefs.bannerUrl}` 
        : `${baseURL}/api${formattedPrefs.bannerUrl}`;
    }
    return formattedPrefs;
  }, [prefsData]);

  // Local state for editing preferences (only used when customize panel is open)
  const [prefs, setPrefs] = useState<ProfilePreferences>(() => prefsDisplay);
  
  // Sync local state with server data
  useEffect(() => {
    // Initialize from server when panel opens (transitions from closed to open)
    const wasClosed = !prevShowCustomizeRef.current;
    const isNowOpen = showCustomize;
    
    if (wasClosed && isNowOpen) {
      setPrefs(prefsDisplay);
    }
    
    prevShowCustomizeRef.current = showCustomize;
  }, [showCustomize, prefsDisplay]); // When panel opens, sync from server
  
  // Also sync when server data changes (after save/refetch) but only if panel is closed
  useEffect(() => {
    if (!showCustomize) {
      setPrefs(prefsDisplay);
    }
  }, [prefsDisplay, showCustomize]);

  // Build filters for recommendations
  const trimmedSearch = debouncedSearchQuery.trim();
  const citySlug = selectedCity?.id;
  const filters: FilterOptions = useMemo(() => ({
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
    ...(citySlug ? { city_slug: citySlug } : {}),
    ...(selectedCategoryKeys.length > 0 ? { categories: selectedCategoryKeys } : {})
  }), [trimmedSearch, citySlug, selectedCategoryKeys]);

  // React Query hook for places (recommendations/likes/questions)
  const placesQuery = useProfilePlacesQuery({
    userId,
    tab: activeTab,
    filters: activeTab === 'recommendations' ? filters : undefined,
    sort: { field: 'created_at', direction: 'desc' },
  });

  // Type guard to check if query is infinite query
  const isInfiniteQuery = (query: typeof placesQuery): query is Extract<typeof placesQuery, { fetchNextPage: () => void }> => {
    return 'fetchNextPage' in query && typeof (query as { fetchNextPage?: unknown }).fetchNextPage === 'function';
  };

  // Extract places data based on query type
  // Memoized to prevent unnecessary recalculations
  const places = useMemo(() => {
    let result: any[] = [];
    if (activeTab === 'questions') {
      // Regular query result - placesQuery is UseQueryResult<any[], Error>
      const regularQuery = placesQuery as Extract<typeof placesQuery, { data?: any[] }>;
      result = regularQuery.data || [];
    } else if (isInfiniteQuery(placesQuery)) {
      // Infinite query result - flatten pages
      const infiniteQuery = placesQuery as any;
      const pages = infiniteQuery.data?.pages;
      if (!pages || !Array.isArray(pages)) {
        result = [];
      } else {
        // Use flatMap for efficient flattening
        result = pages.flatMap((page: { data: any[] }) => page.data || []);
      }
    }
    
    // Filter out deleted posts
    if (deletedPostIds.size > 0) {
      result = result.filter((item: any) => {
        const postId = item.id || item.recommendation_id;
        return !deletedPostIds.has(postId);
      });
    }
    
    return result;
  }, [placesQuery.data, activeTab, placesQuery.isLoading, deletedPostIds]);

  const placesLoading = placesQuery.isLoading || placesQuery.isFetching;
  const loadingMore = useMemo(() => {
    if (activeTab === 'questions') return false;
    if (isInfiniteQuery(placesQuery)) {
      const infiniteQuery = placesQuery as Extract<typeof placesQuery, { isFetchingNextPage?: boolean }>;
      return infiniteQuery.isFetchingNextPage ?? false;
    }
    return false;
  }, [activeTab, placesQuery]);
  
  const hasMore = useMemo(() => {
    if (activeTab === 'questions') return false;
    if (isInfiniteQuery(placesQuery)) {
      const infiniteQuery = placesQuery as any;
      const pages = infiniteQuery.data?.pages;
      if (pages && Array.isArray(pages) && pages.length > 0) {
        const lastPage = pages[pages.length - 1];
        return lastPage?.nextPage !== undefined;
      }
    }
    return false;
  }, [activeTab, placesQuery]);
  const hasLoadedFirstPage = places.length > 0;
  const error = profileError?.message || placesQuery.error?.message || null;

  // Request versioning to avoid race conditions on async updates
  const prevShowCustomizeRef = useRef(showCustomize);
  
  // Store refetch function in ref to avoid callback dependency issues
  const placesQueryRefetchRef = useRef<(() => Promise<any>) | null>(null);
  useEffect(() => {
    if (isInfiniteQuery(placesQuery)) {
      placesQueryRefetchRef.current = placesQuery.refetch;
    } else {
      placesQueryRefetchRef.current = (placesQuery as any).refetch || null;
    }
  }, [placesQuery]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // React Query will automatically refetch when tab changes
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && isInfiniteQuery(placesQuery)) {
      const infiniteQuery = placesQuery as Extract<typeof placesQuery, { fetchNextPage: () => void }>;
      infiniteQuery.fetchNextPage();
    }
  };

  // Handle search - only update query, debounce will trigger reload
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // Don't clear places immediately - wait for debounce to avoid jarring UX
    // The debounced query change will handle the reset
  }, []);

  // Helper function to derive category from post - memoized to prevent recreation
  const categoryKeyFromPost = useCallback((post: any): string | null => {
    const primary: string | undefined = post?.place_primary_type;
    if (primary && typeof primary === 'string') return primary.toLowerCase();
    if (post?.labels && Array.isArray(post.labels)) {
      const labels = post.labels.map((l: any) => String(l).toLowerCase());
      if (labels.some((l: string) => l.includes('restaurant') || l.includes('food'))) return 'restaurant';
      if (labels.some((l: string) => l.includes('cafe') || l.includes('coffee'))) return 'cafe';
      if (labels.some((l: string) => l.includes('experience') || l.includes('activity'))) return 'experience';
      if (labels.some((l: string) => l.includes('service'))) return 'service';
    }
    if (post?.content_type === 'place') return 'restaurant';
    if (post?.content_type === 'service') return 'service';
    return null;
  }, []);

  // Helper to convert slug to title case - memoized
  const toTitle = useCallback((s?: string): string | undefined => {
    if (!s) return undefined;
    return s.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
  }, []);

  // Build city summaries from places/recommendations
  // Use deferred value to prevent blocking UI updates during heavy computations
  // Use a ref to maintain stable category structure and only update counts
  const citySummariesRef = useRef<CitySummary[]>([]);
  const deferredPlaces = useDeferredValue(places);
  const citySummaries: CitySummary[] = useMemo(() => {
    // Early return if no places to avoid unnecessary computation
    if (!deferredPlaces || deferredPlaces.length === 0) {
      return citySummariesRef.current;
    }

    const byCity: Record<string, CitySummary> = {};
    const friendFace = userId && userData ? { id: userId, name: userData?.displayName || 'User', photoUrl: userData?.profilePictureUrl } : null;

    // First, create structure from existing ref if available, to maintain stability
    citySummariesRef.current.forEach(city => {
      byCity[city.id] = {
        ...city,
        recCount: 0,
        categories: city.categories.map(cat => ({ ...cat, count: 0 }))
      };
    });

    // Use Map for O(1) category lookups instead of O(n) find operations
    const categoryMap = new Map<string, { key: string; label: string; count: number }>();

    deferredPlaces.forEach((p: any) => {
      const slug: string | undefined = p?.place_city_slug;
      const country: string | undefined = p?.place_country_code;
      let name: string | undefined = slug ? toTitle(String(slug)) : undefined;
      let key: string | undefined = slug;

      if (!key || !name) return;

      if (!byCity[key]) {
        byCity[key] = {
          id: key,
          name,
          country,
          recCount: 0,
          friendCount: 1, // For profile page, this is the user themselves
          friendFaces: friendFace ? [friendFace] : [],
          categories: [],
        };
      }
      const summary = byCity[key];
      summary.recCount += 1;
      
      // Category buckets - use Map for faster lookup
      const cat = categoryKeyFromPost(p);
      if (cat) {
        const cityCategoryKey = `${key}:${cat}`;
        let bucket = categoryMap.get(cityCategoryKey);
        if (!bucket) {
          bucket = { key: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1), count: 0 };
          categoryMap.set(cityCategoryKey, bucket);
          summary.categories.push(bucket);
        }
        bucket.count += 1;
      }
    });

    const result = Object.values(byCity)
      .map(c => ({
        ...c,
        friendFaces: c.friendFaces.slice(0, 8),
        categories: c.categories.sort((a, b) => (b.count || 0) - (a.count || 0))
      }))
      .sort((a, b) => b.recCount - a.recCount);
    
    // Update ref for next render
    citySummariesRef.current = result;
    
    return result;
  }, [deferredPlaces, userId, userData?.displayName, userData?.profilePictureUrl, categoryKeyFromPost, toTitle]);

  // Global summary (all recommendations)
  // Use deferred value to prevent blocking UI updates
  // Use a ref to maintain stable category structure and only update counts
  const globalSummaryRef = useRef<CitySummary | undefined>(undefined);
  const globalSummary: CitySummary | undefined = useMemo(() => {
    // Early return if no places
    if (!deferredPlaces || deferredPlaces.length === 0) {
      return globalSummaryRef.current;
    }

    const categories = new Map<string, number>();
    deferredPlaces.forEach((p: any) => {
      const cat = categoryKeyFromPost(p);
      if (cat) {
        categories.set(cat, (categories.get(cat) || 0) + 1);
      }
    });

    // If we have an existing structure, preserve category keys even with 0 count
    const categoryEntries = Array.from(categories.entries())
      .map(([key, count]) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        count
      }));

    // Merge with existing categories to maintain structure
    if (globalSummaryRef.current) {
      const existingKeys = new Set(categoryEntries.map(c => c.key));
      globalSummaryRef.current.categories.forEach(existingCat => {
        if (!existingKeys.has(existingCat.key)) {
          categoryEntries.push({ ...existingCat, count: 0 });
        }
      });
    }

    const friendFace = userId && userData ? { id: userId, name: userData?.displayName || 'User', photoUrl: userData?.profilePictureUrl } : null;

    const result = {
      id: 'worldwide',
      name: 'Worldwide',
      recCount: deferredPlaces.length,
      friendCount: 1,
      friendFaces: friendFace ? [friendFace] : [],
      categories: categoryEntries.sort((a, b) => (b.count || 0) - (a.count || 0))
    };
    
    // Update ref for next render
    globalSummaryRef.current = result;
    
    return result;
  }, [deferredPlaces, userId, userData?.displayName, userData?.profilePictureUrl, categoryKeyFromPost]);

  // Handle city selection
  const handleCitySelect = useCallback((city?: { id?: string; name?: string }) => {
    setSelectedCity(city);
    // React Query will automatically refetch when filters change
  }, []);

  // Handle category toggle
  const toggleCategory = useCallback((key: string) => {
    setSelectedCategoryKeys(prev => {
      const newKeys = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      // React Query will automatically refetch when filters change
      return newKeys;
    });
  }, []);


  // Reset state when userId changes
  useEffect(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setActiveTab('recommendations');
    setSelectedCity(undefined);
    setSelectedCategoryKeys([]);
    setDeletedPostIds(new Set());
  }, [userId]);


  // Debounce search input to reduce flicker and request churn
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmedQuery = searchQuery.trim();
      setDebouncedSearchQuery(trimmedQuery);
      // React Query will automatically refetch when filters change
    }, 600); // Increased debounce delay for better UX
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Theme hook - must be called before any early returns
  const { setTheme } = useTheme();
  const { setProfileTheme } = useProfileTheme();
  
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const isOwnProfile = currentUser?.id === userId;
  // Use preview theme when customize panel is open, otherwise use saved theme
  const previewTheme = showCustomize ? prefs.theme : prefsDisplay.theme;
  const selectedTheme = previewTheme ? THEMES[previewTheme] : THEMES['dark'];
  const accentColor = selectedTheme.accentColor;
  const backgroundColor = selectedTheme.backgroundColor;
  
  // When viewing someone else's profile, set their theme in the context so Header and other components can use it
  useEffect(() => {
    if (!isOwnProfile && previewTheme && THEMES[previewTheme]) {
      // Validate theme before setting to prevent runtime errors
      setProfileTheme(previewTheme as ThemeName);
    } else {
      setProfileTheme(null);
    }
    // Cleanup: clear profile theme when leaving profile page
    return () => {
      setProfileTheme(null);
    };
  }, [isOwnProfile, previewTheme, setProfileTheme]);

  // For own profile: Apply and persist theme preference globally
  // Only apply saved theme when customize panel is closed (not during preview)
  // This hook must be called before any early returns
  useEffect(() => {
    if (!isOwnProfile || !prefsDisplay.theme || showCustomize) {
      return;
    }
    
    // Validate theme before applying
    const themeName = prefsDisplay.theme;
    if (!THEMES[themeName]) {
      console.warn(`Invalid theme preference: ${themeName}`);
      return;
    }
    
    const ownTheme = themeName as ThemeName;
    
    // Use startTransition to mark theme update as non-urgent
    // This prevents blocking the UI and allows dropdown to close smoothly
    // The theme update will happen in the next frame without blocking rendering
    startTransition(() => {
      requestAnimationFrame(() => {
        setTheme(ownTheme);
      });
    });
  }, [isOwnProfile, prefsDisplay.theme, setTheme, showCustomize]);

  // Stable callback references to prevent FeedPost re-renders
  const handlePostUpdate = useCallback(async (deletedPostId?: number) => {
    // Optimistically remove the post from UI immediately
    if (deletedPostId) {
      setDeletedPostIds(prev => new Set([...prev, deletedPostId]));
    }
    
    // Comprehensive cache invalidation - invalidate all relevant queries
    // Profile queries
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    queryClient.invalidateQueries({ queryKey: ['profile', userId, 'places'] });
    queryClient.invalidateQueries({ queryKey: ['profile', userId, 'stats'] });
    
    // Feed queries (where this post might appear)
    queryClient.invalidateQueries({ queryKey: ['feed'], exact: false });
    
    // Search queries (if search results include this post)
    queryClient.invalidateQueries({ queryKey: ['search'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['recommendations'], exact: false });
    
    // Wait for refetch to complete, then clear deleted IDs
    try {
      await placesQueryRefetchRef.current?.();
      
      // Clear deleted ID after successful refetch
      if (deletedPostId) {
        setDeletedPostIds(prev => {
          const next = new Set(prev);
          next.delete(deletedPostId);
          return next;
        });
      }
    } catch (error) {
      // If refetch fails, restore the item (rollback optimistic update)
      console.error('Failed to refetch after deletion:', error);
      if (deletedPostId) {
        setDeletedPostIds(prev => {
          const next = new Set(prev);
          next.delete(deletedPostId);
          return next;
        });
      }
    }
  }, [queryClient, userId]);

  const handleQuestionUpdate = useCallback(() => {
    // Invalidate profile data and places
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    placesQueryRefetchRef.current?.();
  }, [queryClient, userId]);

  // Error state - must come after all hooks
  if (error) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6 text-center max-w-md">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Error Loading Profile</h2>
          <p className="text-muted-foreground text-base font-medium">{error}</p>
          <Button 
            onClick={() => refetchProfile()} 
            variant="outline"
            className="border-[1.5px] border-black rounded-none px-6 py-3 h-auto font-medium transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            style={{ boxShadow: '2px 2px 0 0 #000' }}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }
  
  // Note: For other users' profiles, we do NOT change the global theme
  // Their theme is only applied via inline styles on the profile page itself (see pageStyle below)
  
  const rootStyle: React.CSSProperties = {
    ['--profile-accent' as any]: accentColor,
  };
  
  const getFontClass = () => {
    // Use preview font when customize panel is open, otherwise use saved font
    const previewFont = showCustomize ? prefs.font : prefsDisplay.font;
    switch (previewFont) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      case 'sans-bold': return 'font-sans font-bold';
      case 'cursive': return 'font-serif italic';
      default: return '';
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    if (!userId) return;
    
      try {
        // Upload the image to the server
        const result = await profileApi.uploadBannerImage(userId, file);
        
        // Ensure the URL is properly formatted with base URL
        const apiBase = getApiBaseUrl();
        // Remove '/api' suffix if present, as bannerUrl already includes the path
        const baseURL = apiBase.replace(/\/api$/, '');
        const bannerUrl = result.bannerUrl.startsWith('/') 
          ? `${baseURL}${result.bannerUrl}` 
          : `${baseURL}/api${result.bannerUrl}`;
        
        // Update local state with the server URL
        setPrefs(prev => ({ ...prev, bannerUrl }));
      } catch (error) {
      console.error('Failed to upload banner image:', error);
      // Show error to user (you can add toast notification here)
      alert('Failed to upload banner image. Please try again.');
    }
  };

  const patternedBg = selectedTheme.patternEnabled
    ? {
        backgroundImage:
          'radial-gradient(#e5e7eb 1px, transparent 1px), radial-gradient(#e5e7eb 1px, transparent 1px)',
        backgroundPosition: '0 0, 8px 8px',
        backgroundSize: '16px 16px'
      }
    : undefined;

  const pageStyle: React.CSSProperties = {
    backgroundColor,
    color: selectedTheme.textColor,
    ...rootStyle,
    ...(patternedBg || {})
  };

  const textOnAccent = getReadableTextColor(accentColor);

  // Show skeleton immediately on first render for instant feedback
  const isInitialLoad = !userData && !error && loading;
  
  return (
    <div className={`min-h-[calc(100vh-64px)] ${getFontClass()}`} style={pageStyle}>
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-16">
        {/* Profile Header (with optional banner background) */}
        {isInitialLoad ? (
          <motion.section 
            className="mb-8 md:mb-12 lg:mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div 
              className="relative rounded-xl overflow-hidden min-h-[160px] md:min-h-[200px] lg:min-h-[240px]"
              style={{ backgroundColor: selectedTheme?.hoverBackground || selectedTheme?.borderColorMuted || '#F3F4F6' }}
            >
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
                <div 
                  className="inline-flex items-center gap-4 md:gap-5 lg:gap-6 border-[1.5px] p-4 md:p-5 lg:p-6 w-full max-w-fit"
                  style={selectedTheme ? {
                    backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                    borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)',
                  } : undefined}
                >
                  <Skeleton className="h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 rounded-full border-[1.5px]" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)' } : undefined} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        ) : userData ? (
          <motion.section 
            className="mb-8 md:mb-12 lg:mb-16"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="relative rounded-xl overflow-hidden min-h-[160px] md:min-h-[200px] lg:min-h-[240px]">
              {/* Art Deco geometric pattern overlay - subtle */}
              <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(45deg, transparent, transparent 2px, #000 2px, #000 4px),
                    repeating-linear-gradient(-45deg, transparent, transparent 2px, #000 2px, #000 4px)
                  `,
                  backgroundSize: '16px 16px'
                }}
              />
              
              {prefsDisplay.bannerUrl ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center" 
                  style={{ 
                    backgroundImage: `url(${prefsDisplay.bannerUrl})` 
                  }} 
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: backgroundColor,
                    backgroundImage: `repeating-linear-gradient(45deg, ${accentColor}15 0px, ${accentColor}15 8px, transparent 8px, transparent 16px)`
                  }}
                />
              )}
              {/* Subtle scrim for readability */}
              {prefsDisplay.bannerUrl && (
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/15 pointer-events-none" />
              )}
              
              {/* Profile card positioned at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
                <div className="inline-flex items-center gap-4 md:gap-5 lg:gap-6 bg-white border-[1.5px] border-black p-4 md:p-5 lg:p-6 w-full max-w-fit" style={{ boxShadow: '4px 4px 0 0 #000' }}>
                  <Avatar className="h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 flex-shrink-0 border-[1.5px] border-black">
                    <AvatarImage src={userData?.profilePictureUrl} alt={userData?.displayName || 'User'} />
                    <AvatarFallback className="text-base md:text-lg lg:text-xl font-semibold">{getInitials(userData?.displayName || 'User')}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 pr-2 md:pr-0">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight truncate mb-1" style={{ letterSpacing: '-0.02em', color: '#000000' }}>
                      {userData?.displayName || 'User'}
                    </h1>
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <p className="text-sm md:text-base truncate font-medium" style={{ color: '#6B7280' }}>@{userData?.username || 'no-username'}</p>
                      {userData?.city && (
                        <>
                          <span className="text-sm md:text-base" style={{ color: '#6B7280' }}>•</span>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} style={{ color: '#6B7280' }} />
                            <p className="text-sm md:text-base font-medium" style={{ color: '#6B7280' }}>{userData.city}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Follower/Following counts */}
                    {(userData?.followers_count !== undefined || userData?.following_count !== undefined) && (
                      <div className="flex items-center gap-4 md:gap-5 mt-2 md:mt-3">
                        {userData.followers_count !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm md:text-base font-semibold" style={{ color: '#000000' }}>
                              {userData.followers_count.toLocaleString()}
                            </span>
                            <span className="text-sm md:text-base" style={{ color: '#6B7280' }}>
                              {userData.followers_count === 1 ? 'follower' : 'followers'}
                            </span>
                          </div>
                        )}
                        {userData.following_count !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm md:text-base font-semibold" style={{ color: '#000000' }}>
                              {userData.following_count.toLocaleString()}
                            </span>
                            <span className="text-sm md:text-base" style={{ color: '#6B7280' }}>following</span>
                          </div>
                        )}
                      </div>
                    )}
                    {userData?.bio && (
                      <p className="text-sm md:text-base mt-2 md:mt-3 leading-relaxed max-w-2xl" style={{ color: '#000000' }}>
                        {userData.bio}
                      </p>
                    )}
                  </div>

                  {isOwnProfile && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowCustomize(v => !v)}
                      className="bg-white border-[1.5px] border-black h-9 w-9 md:h-10 md:w-10 p-0 flex items-center justify-center transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none flex-shrink-0 rounded-none"
                      style={{ 
                        boxShadow: showCustomize ? 'none' : '2px 2px 0 0 #000',
                        backgroundColor: showCustomize ? accentColor : 'white',
                        color: showCustomize ? textOnAccent : '#000'
                      }}
                      aria-label={showCustomize ? 'Close customize panel' : 'Open customize panel'}
                      title={showCustomize ? 'Close' : 'Customize'}
                    >
                      <Settings className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section 
            className="mb-8 md:mb-12 lg:mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div 
              className="flex items-center gap-6 p-8 border rounded-xl"
              style={selectedTheme ? {
                backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)',
              } : undefined}
            >
              <Skeleton className="h-20 w-20 rounded-full border-[1.5px]" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)' } : undefined} />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </motion.section>
        )}

        {/* Tab Navigation and Content Area */}
        <div className="lg:max-w-4xl lg:mx-auto">
          {/* Tab Navigation */}
          <nav className="flex flex-wrap gap-3 mb-8 md:mb-10">
            <Button
              variant={activeTab === 'recommendations' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('recommendations')}
              className="flex items-center gap-2 transition-all text-sm md:text-base font-medium whitespace-nowrap rounded-none px-4 py-2 h-auto border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
              style={{
                color: activeTab === 'recommendations' ? textOnAccent : undefined,
                backgroundColor: activeTab === 'recommendations' ? accentColor : undefined
              }}
            >
              <Star className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Recommendations</span>
              <span className="sm:hidden">Recs</span>
              {userStats && userStats.total_recommendations > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-xs font-bold bg-black/10 border border-black/20">
                  {userStats.total_recommendations}
                </span>
              )}
            </Button>
            <Button
              variant={activeTab === 'likes' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('likes')}
              className="flex items-center gap-2 transition-all text-sm md:text-base font-medium whitespace-nowrap rounded-none px-4 py-2 h-auto border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
              style={{
                color: activeTab === 'likes' ? textOnAccent : undefined,
                backgroundColor: activeTab === 'likes' ? accentColor : undefined
              }}
            >
              <Heart className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Likes</span>
              <span className="sm:hidden">Likes</span>
              {userStats && userStats.total_likes > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-xs font-bold bg-black/10 border border-black/20">
                  {userStats.total_likes}
                </span>
              )}
            </Button>
            <Button
              variant={activeTab === 'questions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('questions')}
              className="flex items-center gap-2 transition-all text-sm md:text-base font-medium whitespace-nowrap rounded-none px-4 py-2 h-auto border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
              style={{
                color: activeTab === 'questions' ? textOnAccent : undefined,
                backgroundColor: activeTab === 'questions' ? accentColor : undefined
              }}
            >
              <HelpCircle className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Questions</span>
              <span className="sm:hidden">Qs</span>
              {userStats && userStats.total_questions > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-xs font-bold bg-black/10 border border-black/20">
                  {userStats.total_questions}
                </span>
              )}
            </Button>
          </nav>

          {/* City Filter Bar - Only for recommendations tab */}
          {activeTab === 'recommendations' && (
            <div className="mb-8 md:mb-10">
              <CityFilterBar
                cities={citySummaries}
                selectedCityId={selectedCity?.id}
                selectedCityName={selectedCity?.name}
                selectedCategoryKeys={selectedCategoryKeys}
                onSelectCity={handleCitySelect}
                onToggleCategory={toggleCategory}
                globalSummary={globalSummary}
                searchValue={searchQuery}
                onSearchChange={handleSearch}
                searchPlaceholder="Search recommendations..."
                isSearching={placesLoading && searchQuery !== debouncedSearchQuery}
              />
            </div>
          )}

          {/* Customize Panel - Own profile only */}
          {isOwnProfile && showCustomize && (
            <section className="mb-8 md:mb-10">
              <div 
                className="border p-6 md:p-8 transition-all"
                style={selectedTheme ? {
                  backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                  borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)',
                } : undefined}
              >
                {/* Art Deco divider */}
                <div 
                  className="mb-6 h-px bg-gradient-to-r"
                  style={selectedTheme ? {
                    background: `linear-gradient(to right, transparent, ${selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)'}, transparent)`,
                  } : undefined}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div>
                    <label 
                      className="text-sm font-semibold block mb-3 tracking-tight"
                      style={{ color: selectedTheme?.textPrimary || '#000000' }}
                    >
                      Banner Image
                    </label>
                    <input 
                      id="banner-upload"
                      type="file" 
                      accept="image/*"
                      onChange={handleBannerUpload}
                      className="block w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-none file:border-[1.5px] file:cursor-pointer file:font-medium file:transition-all file:hover:translate-x-[1px] file:hover:translate-y-[1px] file:hover:shadow-none"
                      style={selectedTheme ? {
                        color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                        boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                      } : undefined}
                    />
                    <style>{`
                      #banner-upload::file-selector-button {
                        border-color: ${selectedTheme?.borderColor || '#000000'};
                        background-color: ${selectedTheme?.cardBackground || '#FFFFFF'};
                        color: ${selectedTheme?.textPrimary || '#000000'};
                      }
                      #banner-upload::file-selector-button:hover {
                        background-color: ${selectedTheme?.hoverBackground || selectedTheme?.borderColorMuted || '#F9FAFB'};
                      }
                    `}</style>
                    {prefsDisplay.bannerUrl && (
                      <div 
                        className="mt-3 text-xs font-medium"
                        style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
                      >
                        Banner uploaded successfully. Click "Clear All" to remove it.
                      </div>
                    )}
                  </div>
                  <div>
                    <label 
                      className="text-sm font-semibold block mb-3 tracking-tight"
                      style={{ color: selectedTheme?.textPrimary || '#000000' }}
                    >
                      Theme
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.keys(THEMES) as ThemeName[]).map((themeName) => {
                        const theme = THEMES[themeName];
                        const isSelected = prefs.theme === themeName || (!prefs.theme && themeName === 'neo-brutal');
                        return (
                          <button
                            key={themeName}
                            type="button"
                            onClick={() => setPrefs(prev => ({ ...prev, theme: themeName }))}
                            className="p-3 border-[1.5px] text-left transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                            style={{
                              backgroundColor: theme.backgroundColor,
                              borderColor: selectedTheme?.borderColor || '#000000',
                              color: theme.textColor,
                              boxShadow: isSelected ? 'none' : `2px 2px 0 0 ${selectedTheme?.borderColor || '#000000'}`,
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <div
                                className="w-4 h-4 border-[1.5px]"
                                style={{ 
                                  backgroundColor: theme.accentColor,
                                  borderColor: selectedTheme?.borderColor || '#000000',
                                }}
                              />
                              <span className="text-sm font-semibold tracking-tight">{theme.displayName}</span>
                            </div>
                            {theme.patternEnabled && (
                              <div 
                                className="text-xs font-medium"
                                style={{ opacity: 0.7 }}
                              >
                                With pattern
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label 
                      className="text-sm font-semibold block mb-3 tracking-tight"
                      style={{ color: selectedTheme?.textPrimary || '#000000' }}
                    >
                      Font
                    </label>
                    <select 
                      className="h-10 w-full border-[1.5px] rounded-none px-3 font-medium transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2" 
                      value={prefs.font || 'default'} 
                      onChange={(e) => setPrefs(prev => ({ ...prev, font: e.target.value as any }))}
                      style={selectedTheme ? {
                        backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
                        borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
                        color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
                        boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                      } : undefined}
                    >
                      <option value="default">Default (System Sans)</option>
                      <option value="serif">Serif (Classic)</option>
                      <option value="mono">Monospace (Code-like)</option>
                      <option value="sans-bold">Sans Bold (Bold & Clean)</option>
                      <option value="cursive">Cursive (Elegant)</option>
                    </select>
                  </div>
                  <div>
                    <label 
                      className="text-sm font-semibold block mb-3 tracking-tight"
                      style={{ color: selectedTheme?.textPrimary || '#000000' }}
                    >
                      City
                    </label>
                    <input
                      type="text"
                      value={editingCity}
                      onChange={(e) => setEditingCity(e.target.value)}
                      onBlur={async () => {
                        if (!userId || !isOwnProfile) return;
                        const newCity = editingCity.trim() || null;
                        if (newCity !== (userData?.city || null)) {
                          try {
                            await profileApi.updateUserProfile(userId, { city: newCity });
                            await refetchProfile();
                          } catch (error) {
                            console.error('Failed to update city:', error);
                            // Reset input on error
                            setEditingCity(userData?.city || '');
                          }
                        }
                      }}
                      placeholder="e.g., New York, London"
                      maxLength={255}
                      className="h-10 w-full border-[1.5px] rounded-none px-3 font-medium transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={selectedTheme ? {
                        backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
                        borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
                        color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
                        boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                      } : undefined}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label 
                      className="text-sm font-semibold block mb-3 tracking-tight"
                      style={{ color: selectedTheme?.textPrimary || '#000000' }}
                    >
                      Bio
                    </label>
                    <textarea
                      value={editingBio}
                      onChange={(e) => setEditingBio(e.target.value)}
                      onBlur={async () => {
                        if (!userId || !isOwnProfile) return;
                        const newBio = editingBio.trim() || null;
                        if (newBio !== (userData?.bio || null)) {
                          try {
                            await profileApi.updateUserProfile(userId, { bio: newBio });
                            await refetchProfile();
                          } catch (error) {
                            console.error('Failed to update bio:', error);
                            // Reset textarea on error
                            setEditingBio(userData?.bio || '');
                          }
                        }
                      }}
                      placeholder="Tell us about yourself..."
                      maxLength={500}
                      rows={4}
                      className="w-full border-[1.5px] rounded-none px-3 py-2 font-medium transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2 resize-none"
                      style={selectedTheme ? {
                        backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
                        borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
                        color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
                        boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                      } : undefined}
                    />
                    <style>{`
                      textarea::placeholder {
                        color: ${selectedTheme?.inputPlaceholder || selectedTheme?.textMuted || '#9CA3AF'} !important;
                      }
                    `}</style>
                    <div 
                      className="mt-2 text-xs font-medium"
                      style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
                    >
                      {editingBio.length}/500 characters
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-[1.5px] rounded-none px-4 py-2 h-auto font-medium transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                      style={selectedTheme ? {
                        backgroundColor: 'transparent',
                        borderColor: selectedTheme.borderColor || '#000000',
                        color: selectedTheme.buttonGhost.text || selectedTheme.textPrimary || '#000000',
                        boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                      } : undefined}
                      onMouseEnter={(e) => {
                        if (selectedTheme) {
                          e.currentTarget.style.backgroundColor = selectedTheme.buttonGhost.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTheme) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      onClick={async () => {
                        if (!userId) return;
                        // Delete banner if it exists on server
                        if (prefsDisplay.bannerUrl) {
                          try {
                            await profileApi.deleteBannerImage(userId);
                          } catch (error) {
                            console.error('Failed to delete banner:', error);
                          }
                        }
                        setPrefs({});
                        if (document.getElementById('banner-upload') as HTMLInputElement) {
                          (document.getElementById('banner-upload') as HTMLInputElement).value = '';
                        }
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                
                {/* Art Deco divider */}
                <div 
                  className="mt-8 h-px bg-gradient-to-r"
                  style={selectedTheme ? {
                    background: `linear-gradient(to right, transparent, ${selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)'}, transparent)`,
                  } : undefined}
                />
                
                <div className="mt-6 flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-[1.5px] rounded-none px-5 py-2 h-auto font-medium transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    style={selectedTheme ? {
                      backgroundColor: 'transparent',
                      borderColor: selectedTheme.borderColor || '#000000',
                      color: selectedTheme.buttonGhost.text || selectedTheme.textPrimary || '#000000',
                      boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                    } : undefined}
                    onMouseEnter={(e) => {
                      if (selectedTheme) {
                        e.currentTarget.style.backgroundColor = selectedTheme.buttonGhost.hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTheme) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    onClick={() => setShowCustomize(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    className="border-[1.5px] rounded-none px-5 py-2 h-auto font-medium transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    style={selectedTheme ? {
                      backgroundColor: accentColor, 
                      borderColor: selectedTheme.borderColor || '#000000', 
                      color: textOnAccent,
                      boxShadow: `3px 3px 0 0 ${selectedTheme.borderColor || '#000000'}`
                    } : undefined}
                    onClick={async () => {
                      if (!userId) return;
                      try {
                        // Save all preferences including bannerUrl
                        await profileApi.updateUserPreferences(userId, prefs);
                        // Update global theme if it's the user's own profile
                        if (isOwnProfile && prefs.theme) {
                          const themeName = prefs.theme;
                          if (THEMES[themeName]) {
                            setTheme(themeName as ThemeName);
                          }
                        }
                        await refetchPrefs();
                        setShowCustomize(false);
                      } catch (e) {
                        console.error('Failed to save preferences:', e);
                      }
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </section>
          )}


          {/* Content Area */}
          <main>
          {/* Content skeletons stay until posts are actually present */}
          {(places.length === 0 && (loading || placesLoading)) ? (
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div 
                  key={i} 
                  className="border p-6 md:p-8"
                  style={selectedTheme ? {
                    backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                    borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)',
                  } : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.2 }}
                >
                  <div className="flex items-start gap-4 md:gap-6">
                    <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-full border-[1.5px]" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)' } : undefined} />
                    <div className="flex-1 space-y-4">
                      <Skeleton className="h-5 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                      <Skeleton className="h-24 w-full" />
                      <div className="flex gap-4">
                        <Skeleton className="h-9 w-20 border" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)' } : undefined} />
                        <Skeleton className="h-9 w-20 border" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)' } : undefined} />
                        <Skeleton className="h-9 w-20 border" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)' } : undefined} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : places.length === 0 && !loading && !placesLoading && hasLoadedFirstPage ? (
            <Card className="border-[1.5px] border-black" style={{ boxShadow: '4px 4px 0 0 #000' }}>
              <CardContent className="py-16 md:py-20 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="h-16 w-16 text-muted-foreground opacity-60">
                      {activeTab === 'recommendations' && <Star className="h-full w-full" strokeWidth={1.5} />}
                      {activeTab === 'likes' && <Heart className="h-full w-full" strokeWidth={1.5} />}
                      {activeTab === 'questions' && <HelpCircle className="h-full w-full" strokeWidth={1.5} />}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight">No {activeTab} yet</h3>
                    <p className="text-muted-foreground text-base max-w-md font-medium">
                      {activeTab === 'questions' && 'Start asking questions to get recommendations!'}
                      {(activeTab === 'recommendations' || activeTab === 'likes') && 'Start exploring places to build your collection!'}
                    </p>
                  </div>
              </CardContent>
            </Card>
          ) : (
            <LayoutGroup>
              <AnimatePresence mode="popLayout">
                <motion.div 
                  className="space-y-8 relative"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Optimized: Only animate first few items, rest render without animation for better performance */}
                  {places.map((item: any, index: number) => {
                    const shouldAnimate = index < 5; // Only animate first 5 items
                    const postId = item.id || item.recommendation_id;
                    const uniqueKey = postId || `item-${index}`;
                    
                    const PostComponent = activeTab === 'questions' ? (
                      <QuestionFeedPost
                        key={uniqueKey}
                        question={item}
                        currentUserId={currentUser?.id || ''}
                        onQuestionUpdate={handleQuestionUpdate}
                        allowEdit={true}
                      />
                    ) : item.content_type === 'service' ? (
                      <ServiceFeedPost
                        key={uniqueKey}
                        post={item}
                        currentUserId={currentUser?.id || ''}
                        allowEdit={true}
                        onPostUpdate={() => handlePostUpdate(postId)}
                      />
                    ) : (
                      <FeedPost
                        key={uniqueKey}
                        post={item}
                        currentUserId={currentUser?.id || ''}
                        allowEdit={true}
                        onPostUpdate={() => handlePostUpdate(postId)}
                      />
                    );

                    if (shouldAnimate) {
                      return (
                        <motion.div
                          key={uniqueKey}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20, scale: 0.95 }}
                          transition={{ 
                            layout: { duration: 0.2, ease: 'easeOut' },
                            exit: { duration: 0.3, ease: 'easeIn' }
                          }}
                        >
                          {PostComponent}
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div
                        key={uniqueKey}
                        layout
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ 
                          layout: { duration: 0.2, ease: 'easeOut' },
                          exit: { duration: 0.3, ease: 'easeIn' }
                        }}
                      >
                        {PostComponent}
                      </motion.div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </LayoutGroup>
          )}

          {/* Load More - Only show for recommendations and likes */}
          {hasMore && hasLoadedFirstPage && (activeTab === 'recommendations' || activeTab === 'likes') && (
            <div className="mt-12 text-center">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full border-[1.5px]" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)' } : undefined} />
                  <Skeleton className="h-6 w-24 border-[1.5px]" style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)' } : undefined} />
                </div>
              ) : (
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  size="lg"
                  className="rounded-none px-6 py-3 h-auto font-medium transition-all border border-black/10 bg-transparent hover:border-black/40 hover:bg-black/[0.03]"
                  style={{ color: accentColor }}
                >
                  Load More
                </Button>
              )}
            </div>
          )}
        </main>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProfilePage); 