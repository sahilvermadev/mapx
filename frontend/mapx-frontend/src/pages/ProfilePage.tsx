import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Star, Heart, HelpCircle, Settings, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { profileApi, type UserData, type UserStats, type FilterOptions, type SortOptions, type ProfilePreferences, THEMES, type ThemeName } from '@/services/profileService';
import { useTheme } from '@/contexts/ThemeContext';
import { getReadableTextColor } from '@/utils/color';
import { useAuth } from '@/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useProfileQuery } from '@/hooks/useProfileQuery';
import { useProfileStatsQuery } from '@/hooks/useProfileStatsQuery';
import { useProfilePreferencesQuery } from '@/hooks/useProfilePreferencesQuery';
import { useProfilePlacesQuery } from '@/hooks/useProfilePlacesQuery';

import FeedPost from '@/components/FeedPost';
import QuestionFeedPost from '@/components/QuestionFeedPost';
import CityFilterBar, { type CitySummary } from '@/components/SocialFeed/CityFilterBar';

type TabType = 'recommendations' | 'likes' | 'questions';

interface ProfilePageProps {}

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  // React Query hooks for data fetching
  const { data: userData, isLoading: loading, error: profileError, refetch: refetchProfile } = useProfileQuery(userId);
  const { data: userStats, isLoading: statsLoading } = useProfileStatsQuery(userId);
  const { data: prefsData, isLoading: prefsLoading, refetch: refetchPrefs } = useProfilePreferencesQuery(userId);
  
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('recommendations');
  const [showCustomize, setShowCustomize] = useState(false);
  
  // Cities visited modal state
  const [showCitiesModal, setShowCitiesModal] = useState(false);
  const [uniqueCities, setUniqueCities] = useState<Array<{ city_slug: string; city_name: string; country_code?: string; admin1_name?: string }>>([]);
  const [citiesModalLoading, setCitiesModalLoading] = useState(false);
  
  // Mobile detection for cities modal
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  
  // Drag handlers for mobile swipe-to-close
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  
  const handleCitiesModalDragEnd = useCallback((_event: unknown, info: { offset: { y: number } }) => {
    if (isMobile && info.offset.y > 100) {
      setShowCitiesModal(false);
    } else {
      y.set(0);
    }
  }, [isMobile, y]);
  
  // Search state (for city bar integration)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // City filter state
  const [selectedCity, setSelectedCity] = useState<{ id?: string; name?: string } | undefined>(undefined);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  
  // Format preferences banner URL (for display)
  const prefsDisplay: ProfilePreferences = useMemo(() => {
    if (!prefsData) return {};
    
    const formattedPrefs = { ...prefsData };
    // Ensure bannerUrl is properly formatted (add base URL if it's a relative path)
    if (formattedPrefs.bannerUrl && !formattedPrefs.bannerUrl.startsWith('http')) {
      // Use relative URL in production (via nginx proxy), absolute URL in development
      const envApiBase = import.meta.env.VITE_API_BASE_URL;
      const baseURL = envApiBase || (import.meta.env.PROD ? '' : 'http://localhost:5000');
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
  const places = useMemo(() => {
    if (activeTab === 'questions') {
      // Regular query result - placesQuery is UseQueryResult<any[], Error>
      const regularQuery = placesQuery as Extract<typeof placesQuery, { data?: any[] }>;
      return regularQuery.data || [];
    }
    // Infinite query result - flatten pages
    if (isInfiniteQuery(placesQuery)) {
      const infiniteQuery = placesQuery as Extract<typeof placesQuery, { data?: { pages: Array<{ data: any[] }> } }>;
      return infiniteQuery.data?.pages.flatMap(page => page.data) || [];
    }
    return [];
  }, [placesQuery, activeTab]);

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
      const infiniteQuery = placesQuery as Extract<typeof placesQuery, { data?: { pages: Array<{ nextPage?: number }> } }>;
      if (infiniteQuery.data?.pages) {
        const lastPage = infiniteQuery.data.pages[infiniteQuery.data.pages.length - 1];
        return lastPage?.nextPage !== undefined;
      }
    }
    return false;
  }, [activeTab, placesQuery]);
  const hasLoadedFirstPage = places.length > 0;
  const error = profileError?.message || placesQuery.error?.message || null;

  // Request versioning to avoid race conditions on async updates
  const profileRequestVersionRef = useRef(0);
  const placesRequestVersionRef = useRef(0);
  const prevShowCustomizeRef = useRef(showCustomize);
  


  // Load user profile data
  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading profile for user ID:', userId);
      
      const currentVersion = ++profileRequestVersionRef.current;
      const profileData = await profileApi.getUserProfile(userId);
      if (currentVersion === profileRequestVersionRef.current) {
        setUserData(profileData);
      }
      
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load places for current tab
  // Accept offset as parameter to avoid dependency issues
  const loadPlaces = useCallback(async (requestOffset: number, reset: boolean = false) => {
    if (!userId) return;
    
    try {
      setLoadingMore(!reset);
      setPlacesLoading(reset);
      const currentVersion = ++placesRequestVersionRef.current;
      
      let result;
      
      switch (activeTab) {
        case 'recommendations': {
          // Build filters object, conditionally including search, city, and categories if present
          const trimmedSearch = debouncedSearchQuery.trim();
          const citySlug = selectedCity?.id;
          const filtersWithSearch = {
            ...(trimmedSearch ? { search: trimmedSearch } : {}),
            ...(citySlug ? { city_slug: citySlug } : {}),
            ...(selectedCategoryKeys.length > 0 ? { categories: selectedCategoryKeys } : {})
          };
          
          result = await profileApi.getUserRecommendations(
            userId, 
            filtersWithSearch, 
            { field: 'created_at', direction: 'desc' }, 
            { limit: 20, offset: requestOffset }
          );
          break;
        }
        case 'likes':
          // Use default sort (created_at desc) - no sort options needed
          result = await profileApi.getUserLikes(
            userId, 
            { field: 'created_at', direction: 'desc' }, 
            { limit: 20, offset: requestOffset }
          );
          break;
        case 'questions':
          result = await profileApi.getUserQuestions(userId);
          break;
      }
      
      if (currentVersion !== placesRequestVersionRef.current) {
        return; // stale response
      }

      if (result) {
        const newPlaces = result.data;
        setPlaces(prev => reset ? newPlaces : [...prev, ...newPlaces]);
        
        // Handle pagination for different tab types
        if (activeTab === 'questions') {
          // Questions don't support pagination yet
          setHasMore(false);
          setOffset(newPlaces.length);
        } else {
          const total = (result as any).pagination?.total || 0;
          setHasMore(total > (requestOffset + newPlaces.length));
          setOffset(requestOffset + newPlaces.length);
        }
        
        setHasLoadedFirstPage(true);
      }
      
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load ${activeTab}`);
    } finally {
      setLoadingMore(false);
      setPlacesLoading(false);
    }
  }, [userId, activeTab, debouncedSearchQuery, selectedCity, selectedCategoryKeys]);

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
  // Use a ref to maintain stable category structure and only update counts
  const citySummariesRef = useRef<CitySummary[]>([]);
  const citySummaries: CitySummary[] = useMemo(() => {
    const byCity: Record<string, CitySummary> = {};

    // First, create structure from existing ref if available, to maintain stability
    citySummariesRef.current.forEach(city => {
      byCity[city.id] = {
        ...city,
        recCount: 0,
        categories: city.categories.map(cat => ({ ...cat, count: 0 }))
      };
    });

    places.forEach((p: any) => {
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
          friendFaces: [{ id: userId || '', name: userData?.display_name || 'User', photoUrl: userData?.profile_picture_url }].filter(f => f.id),
          categories: [],
        };
      }
      const summary = byCity[key];
      summary.recCount += 1;
      
      // Category buckets
      const cat = categoryKeyFromPost(p);
      if (cat) {
        const bucket = summary.categories.find(c => c.key === cat);
        if (bucket) {
          bucket.count = (bucket.count || 0) + 1;
        } else {
          summary.categories.push({ key: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1), count: 1 });
        }
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
  }, [places, userId, userData, categoryKeyFromPost, toTitle]);

  // Global summary (all recommendations)
  // Use a ref to maintain stable category structure and only update counts
  const globalSummaryRef = useRef<CitySummary | undefined>(undefined);
  const globalSummary: CitySummary | undefined = useMemo(() => {
    const categories = new Map<string, number>();
    places.forEach((p: any) => {
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

    const result = {
      id: 'worldwide',
      name: 'Worldwide',
      recCount: places.length,
      friendCount: 1,
      friendFaces: userId ? [{ id: userId, name: userData?.display_name || 'User', photoUrl: userData?.profile_picture_url }] : [],
      categories: categoryEntries.sort((a, b) => (b.count || 0) - (a.count || 0))
    };
    
    // Update ref for next render
    globalSummaryRef.current = result;
    return result;
  }, [places, userId, userData, categoryKeyFromPost]);

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
  }, [userId]);

  // Load unique cities when modal opens
  const loadUniqueCities = useCallback(async () => {
    if (!userId) return;
    
    try {
      setCitiesModalLoading(true);
      // Fetch a large number of recommendations to get all cities
      const result = await profileApi.getUserRecommendations(
        userId,
        {},
        { field: 'created_at', direction: 'desc' },
        { limit: 1000, offset: 0 }
      );
      
      // Extract unique cities by city_slug
      const citiesMap = new Map<string, { city_slug: string; city_name: string; country_code?: string; admin1_name?: string }>();
      
      result.data.forEach((rec: any) => {
        // Try different field names based on what's available
        const citySlug = rec.place_city_slug || rec.city_slug;
        const cityName = rec.place_city_name || rec.city_name;
        
        if (citySlug && cityName) {
          if (!citiesMap.has(citySlug)) {
            citiesMap.set(citySlug, {
              city_slug: citySlug,
              city_name: cityName,
              country_code: rec.place_country_code || rec.country_code,
              admin1_name: rec.place_admin1_name || rec.admin1_name,
            });
          }
        }
      });
      
      setUniqueCities(Array.from(citiesMap.values()).sort((a, b) => a.city_name.localeCompare(b.city_name)));
    } catch (e) {
      console.error('Failed to load unique cities:', e);
      setUniqueCities([]);
    } finally {
      setCitiesModalLoading(false);
    }
  }, [userId]);

  // Load cities when modal opens
  useEffect(() => {
    if (showCitiesModal) {
      loadUniqueCities();
    }
  }, [showCitiesModal, loadUniqueCities]);
  
  // Mobile detection for cities modal
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    handleChange(mediaQuery);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);
  
  // Prevent body scroll on mobile when cities modal is open
  useEffect(() => {
    if (showCitiesModal && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showCitiesModal, isMobile]);

  // Debounce search input to reduce flicker and request churn
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmedQuery = searchQuery.trim();
      setDebouncedSearchQuery(trimmedQuery);
      // React Query will automatically refetch when filters change
    }, 600); // Increased debounce delay for better UX
    return () => clearTimeout(id);
  }, [searchQuery]);


  // Error state
  if (error) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold">Error Loading Profile</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => refetchProfile()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }



  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);



  const isOwnProfile = currentUser?.id === userId;
  // Use preview theme when customize panel is open, otherwise use saved theme
  const previewTheme = showCustomize ? prefs.theme : prefsDisplay.theme;
  const selectedTheme = previewTheme ? THEMES[previewTheme] : THEMES['neo-brutal'];
  const accentColor = selectedTheme.accentColor;
  const backgroundColor = selectedTheme.backgroundColor;
  const { setTheme } = useTheme();
  
  // For own profile: Apply and persist theme preference globally
  // Only apply saved theme when customize panel is closed (not during preview)
  useEffect(() => {
    if (!isOwnProfile || !prefsDisplay.theme || showCustomize) return;
    
    // Validate theme before applying
    const themeName = prefsDisplay.theme;
    if (!THEMES[themeName]) {
      console.warn(`Invalid theme preference: ${themeName}`);
      return;
    }
    
    const ownTheme = themeName as ThemeName;
    setTheme(ownTheme);
  }, [isOwnProfile, prefsDisplay.theme, setTheme, showCustomize]);
  
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
        // Use relative URL in production (via nginx proxy), absolute URL in development
      const envApiBase = import.meta.env.VITE_API_BASE_URL;
      const baseURL = envApiBase || (import.meta.env.PROD ? '' : 'http://localhost:5000');
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

  return (
    <div className={`min-h-[calc(100vh-64px)] ${getFontClass()}`} style={pageStyle}>
      <div className="container mx-auto px-4 py-4 md:py-8">
        {/* Profile Header (with optional banner background) */}
        {userData ? (
          <section className="mb-4 md:mb-8">
            <div className="relative rounded-lg border border-black/20 shadow-md overflow-hidden min-h-[120px] md:min-h-[180px] lg:min-h-[220px]">
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
                    backgroundImage: `repeating-linear-gradient(45deg, ${accentColor}22 0px, ${accentColor}22 10px, transparent 10px, transparent 20px)`
                  }}
                />
              )}
              {/* Soft scrim to ensure banner edges don't clash with the chip */}
              {prefsDisplay.bannerUrl && (
                <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10 pointer-events-none" />
              )}
              
              {/* Places Visited Badge - Top Right on mobile, Bookmark style on desktop */}
              {userStats && userStats.total_cities_visited > 0 && (
                <motion.div
                  className="absolute top-3 right-3 md:top-0 md:right-0 z-10"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <div 
                    className="relative bg-white/95 backdrop-blur-sm rounded-md md:rounded-none md:rounded-bl-md border border-black px-1.5 md:px-2 py-1 md:py-1.5 shadow-[2px_2px_0_0_#000] md:shadow-[0_4px_0_0_#000] cursor-pointer transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none md:hover:translate-x-0 md:hover:translate-y-0.5 md:hover:shadow-[0_2px_0_0_#000]"
                    onClick={() => setShowCitiesModal(true)}
                  >
                    {/* Bookmark triangle on desktop */}
                    <div className="hidden md:block absolute -top-2 right-0 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px]" style={{ borderBottomColor: accentColor }} />
                    
                    <motion.div 
                      className="flex items-center justify-center gap-0.5 md:gap-1 px-1 md:px-1.5 py-0.5 rounded md:rounded-none md:rounded-bl-md border border-black md:border-t-0 md:border-r-0 md:border-l-0"
                      style={{
                        backgroundColor: accentColor,
                      }}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
                    >
                      <motion.span 
                        className="text-xs md:text-sm font-black"
                        style={{ color: textOnAccent }}
                        key={userStats.total_cities_visited}
                        initial={{ scale: 1.3 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {userStats.total_cities_visited}
                      </motion.span>
                    </motion.div>
                  </div>
                </motion.div>
              )}
              
              {/* Profile card positioned at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 lg:p-4">
                <div className="inline-flex items-center gap-2 md:gap-3 lg:gap-4 bg-white rounded-lg border-2 border-black p-2 md:p-3 lg:p-4 shadow-[3px_3px_0_0_#000] md:shadow-[4px_4px_0_0_#000] w-full max-w-fit">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-16 lg:w-16 flex-shrink-0">
                    <AvatarImage src={userData.profilePictureUrl} alt={userData.displayName} />
                    <AvatarFallback className="text-xs sm:text-sm md:text-base lg:text-lg">{getInitials(userData.displayName)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 pr-2 md:pr-0">
                    <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold truncate">
                      {userData.displayName}
                    </h1>
                    <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3 mt-0.5 md:mt-1">
                      <p className="text-xs sm:text-sm md:text-base text-muted-foreground truncate">@{userData.username || 'no-username'}</p>
                    </div>
                  </div>

                  {isOwnProfile && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowCustomize(v => !v)}
                      className="rounded-md bg-white/95 shadow-[1px_1px_0_0_#000] h-7 w-7 sm:h-8 sm:w-8 md:h-8 md:w-8 p-0 flex items-center justify-center transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none flex-shrink-0 border-0"
                      style={showCustomize ? { backgroundColor: accentColor, color: textOnAccent } : {}}
                      aria-label={showCustomize ? 'Close customize panel' : 'Open customize panel'}
                      title={showCustomize ? 'Close' : 'Customize'}
                    >
                      <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-4 md:mb-8">
            <div className="flex items-center gap-4 p-6 bg-card rounded-lg border">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </section>
        )}

        {/* Tab Navigation */}
        <nav className="flex flex-wrap gap-2 mb-4 md:mb-6 overflow-x-auto">
          <Button
            variant={activeTab === 'recommendations' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('recommendations')}
            className="flex items-center gap-1.5 md:gap-2 rounded-md border border-black bg-white shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm whitespace-nowrap"
            style={activeTab === 'recommendations' ? { backgroundColor: accentColor, borderColor: '#000', color: textOnAccent } : {}}
          >
            <Star className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">My Recommendations</span>
            <span className="sm:hidden">Recs</span>
            {userStats && userStats.total_recommendations > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold bg-black/10">
                {userStats.total_recommendations}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'likes' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('likes')}
            className="flex items-center gap-1.5 md:gap-2 rounded-md border border-black bg-white shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm whitespace-nowrap"
            style={activeTab === 'likes' ? { backgroundColor: accentColor, borderColor: '#000', color: textOnAccent } : {}}
          >
            <Heart className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">My Likes</span>
            <span className="sm:hidden">Likes</span>
            {userStats && userStats.total_likes > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold bg-black/10">
                {userStats.total_likes}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'questions' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('questions')}
            className="flex items-center gap-1.5 md:gap-2 rounded-md border border-black bg-white shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm whitespace-nowrap"
            style={activeTab === 'questions' ? { backgroundColor: accentColor, borderColor: '#000', color: textOnAccent } : {}}
          >
            <HelpCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">My Questions</span>
            <span className="sm:hidden">Qs</span>
            {userStats && userStats.total_questions > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold bg-black/10">
                {userStats.total_questions}
              </span>
            )}
          </Button>
        </nav>

        {/* City Filter Bar - Only for recommendations tab */}
        {activeTab === 'recommendations' && (
          <div className="mb-6">
            <CityFilterBar
              cities={citySummaries}
              selectedCityId={selectedCity?.id}
              selectedCityName={selectedCity?.name}
              selectedCategoryKeys={selectedCategoryKeys}
              onSelectCity={handleCitySelect}
              onToggleCategory={toggleCategory}
              globalSummary={globalSummary}
              variant="profile"
              searchValue={searchQuery}
              onSearchChange={handleSearch}
              searchPlaceholder="Search recommendations..."
              isSearching={placesLoading && searchQuery !== debouncedSearchQuery}
            />
          </div>
        )}

        {/* Customize Panel - Own profile only */}
        {isOwnProfile && showCustomize && (
          <section className="mb-4 md:mb-6">
            <div className="rounded-lg border border-black/20 bg-white p-4 md:p-6 shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Banner Image</label>
                  <input 
                    id="banner-upload"
                    type="file" 
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-none file:border-2 file:border-black file:bg-white file:text-black file:cursor-pointer hover:file:bg-gray-50"
                  />
                  {prefsDisplay.bannerUrl && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Banner uploaded successfully. Click "Clear All" to remove it.
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Theme</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(THEMES) as ThemeName[]).map((themeName) => {
                      const theme = THEMES[themeName];
                      const isSelected = prefs.theme === themeName || (!prefs.theme && themeName === 'neo-brutal');
                      return (
                        <button
                          key={themeName}
                          type="button"
                          onClick={() => setPrefs(prev => ({ ...prev, theme: themeName }))}
                      className={`p-3 border border-black rounded-md text-left transition-all hover:scale-[1.02] ${
                        isSelected ? 'shadow-[3px_3px_0_0_#000] border-2' : 'shadow-[1px_1px_0_0_#000]'
                      }`}
                          style={{
                            backgroundColor: theme.backgroundColor,
                            borderColor: '#000',
                            color: theme.textColor,
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-4 h-4 border-2 border-black"
                              style={{ backgroundColor: theme.accentColor }}
                            />
                            <span className="text-sm font-semibold">{theme.displayName}</span>
                          </div>
                          {theme.patternEnabled && (
                            <div className="text-xs opacity-70">With pattern</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Font</label>
                  <select 
                    className="h-9 w-full border-2 border-black rounded-none px-2 bg-white" 
                    value={prefs.font || 'default'} 
                    onChange={(e) => setPrefs(prev => ({ ...prev, font: e.target.value as any }))}
                  >
                    <option value="default">Default (System Sans)</option>
                    <option value="serif">Serif (Classic)</option>
                    <option value="mono">Monospace (Code-like)</option>
                    <option value="sans-bold">Sans Bold (Bold & Clean)</option>
                    <option value="cursive">Cursive (Elegant)</option>
                  </select>
                </div>
                <div className="flex items-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-md border border-black shadow-[1px_1px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
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
              <div className="mt-4 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-md border border-black shadow-[1px_1px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                  onClick={() => setShowCustomize(false)}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                  style={{ backgroundColor: accentColor, borderColor: '#000', color: textOnAccent }}
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
          ) : places.length === 0 && !loading && !placesLoading && hasLoadedFirstPage ? (
            <Card>
              <CardContent className="py-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 text-muted-foreground">
                      {activeTab === 'recommendations' && <Star className="h-full w-full" />}
                      {activeTab === 'likes' && <Heart className="h-full w-full" />}
                      {activeTab === 'questions' && <HelpCircle className="h-full w-full" />}
                    </div>
                    <h3 className="text-lg font-semibold">No {activeTab} yet</h3>
                    <p className="text-muted-foreground">
                      {activeTab === 'questions' && 'Start asking questions to get recommendations!'}
                      {(activeTab === 'recommendations' || activeTab === 'likes') && 'Start exploring places to build your collection!'}
                    </p>
                  </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {places.map((item, index) => (
                  <motion.div
                    key={item.id || `item-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {activeTab === 'questions' && (
                      <QuestionFeedPost
                        question={item}
                        currentUserId={currentUser?.id || ''}
                        onQuestionUpdate={() => {
                          // Invalidate profile data and places
                          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
                          placesQuery.refetch();
                        }}
                      />
                    )}
                    {(activeTab === 'recommendations' || activeTab === 'likes') && (
                      <FeedPost
                        post={item}
                        currentUserId={currentUser?.id || ''}
                        onPostUpdate={() => {
                          // Invalidate profile data and places
                          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
                          placesQuery.refetch();
                        }}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load More - Only show for recommendations and likes */}
          {hasMore && hasLoadedFirstPage && (activeTab === 'recommendations' || activeTab === 'likes') && (
            <div className="mt-8 text-center">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ) : (
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  size="lg"
                  className="rounded-md border border-black shadow-[1px_1px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                  style={{ borderColor: accentColor, color: accentColor }}
                >
                  Load More
                </Button>
              )}
            </div>
          )}
        </main>
      </div>
      
      {/* Cities Visited Modal */}
      <AnimatePresence>
        {showCitiesModal && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-[1000] md:bg-black/40 backdrop-blur-sm"
              onClick={() => setShowCitiesModal(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            
            {/* Modal Content */}
            <motion.div
              className="
                fixed bg-white z-[1001] overflow-y-auto font-sans
                inset-x-0 bottom-0 rounded-t-2xl border-t-2 border-black shadow-[0_-8px_0_0_#000] max-h-[90vh]
                md:inset-x-auto md:inset-y-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:bottom-auto md:w-full md:max-w-2xl md:rounded-lg md:rounded-t-none md:border-t-0 md:border-2 md:shadow-[8px_8px_0_0_#000] md:max-h-[80vh]
              "
              onMouseDown={(e) => e.stopPropagation()}
              initial={isMobile ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
              animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
              exit={isMobile ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              drag={isMobile ? 'y' : false}
              dragConstraints={isMobile ? { top: 0 } : {}}
              dragElastic={isMobile ? 0.2 : 0}
              onDragEnd={handleCitiesModalDragEnd}
              style={isMobile ? { y, opacity } : {}}
              role="dialog"
              aria-modal="true"
              aria-label="Cities Visited"
            >
              {/* Drag handle for mobile */}
              <div
                className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none md:hidden"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
              </div>
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 md:p-4 border-b-2 border-black">
                <div>
                  <h2 className="text-lg md:text-xl font-bold">Cities Visited</h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    {userStats?.total_cities_visited || 0} {userStats?.total_cities_visited === 1 ? 'city' : 'cities'}
                  </p>
                </div>
                <button
                  onClick={() => setShowCitiesModal(false)}
                  className="rounded-md border border-black p-1.5 hover:bg-gray-100 transition-colors h-8 w-8 md:h-auto md:w-auto flex items-center justify-center"
                  style={{ borderColor: '#000' }}
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-4">
                {citiesModalLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : uniqueCities.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">No cities visited yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {uniqueCities.map((city, index) => (
                      <motion.div
                        key={city.city_slug}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="flex items-center gap-3 p-3 rounded-md border border-black/20 hover:border-black/40 bg-white hover:bg-gray-50/50 shadow-sm hover:shadow-[2px_2px_0_0_#000] transition-all"
                      >
                        <div 
                          className="rounded-full border-2 border-black p-2 flex-shrink-0"
                          style={{ backgroundColor: accentColor }}
                        >
                          <MapPin 
                            className="h-5 w-5" 
                            style={{ color: textOnAccent }}
                            fill="currentColor"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">{city.city_name}</h3>
                          {(city.admin1_name || city.country_code) && (
                            <p className="text-sm text-muted-foreground truncate">
                              {city.admin1_name ? `${city.admin1_name}, ` : ''}
                              {city.country_code?.toUpperCase()}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(ProfilePage); 