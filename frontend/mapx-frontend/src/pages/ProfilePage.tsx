import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Heart, Filter, SortAsc, Search, ChevronDown } from 'lucide-react';
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
import { profileApi, type UserData, type FilterOptions, type SortOptions } from '@/services/profile';
import { useAuth } from '@/contexts/AuthContext';

import FeedPost from '@/components/FeedPost';
import FilterPanel from '@/components/FilterPanel';

type TabType = 'recommendations' | 'likes';

interface ProfilePageProps {}

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  
  // State management
  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('recommendations');
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [hasLoadedFirstPage, setHasLoadedFirstPage] = useState(false);
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter and sort state
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({ field: 'created_at', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  // Request versioning to avoid race conditions on async updates
  const profileRequestVersionRef = useRef(0);
  const placesRequestVersionRef = useRef(0);
  


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
  const loadPlaces = useCallback(async (reset = false) => {
    if (!userId) return;
    
    try {
      const currentOffset = reset ? 0 : offset;
      setLoadingMore(!reset);
      setPlacesLoading(true);
      const currentVersion = ++placesRequestVersionRef.current;
      
      let result;
      
      switch (activeTab) {
        case 'recommendations':
          result = await profileApi.getUserRecommendations(
            userId, 
            { ...filters, search: debouncedSearchQuery }, 
            sortOptions, 
            { limit: 20, offset: currentOffset }
          );
          break;
        case 'likes':
          result = await profileApi.getUserLikes(
            userId, 
            sortOptions, 
            { limit: 20, offset: currentOffset }
          );
          break;
      }
      
      if (currentVersion !== placesRequestVersionRef.current) {
        return; // stale response
      }

      if (result) {
        const newPlaces = result.data;
        setPlaces(prev => reset ? newPlaces : [...prev, ...newPlaces]);
        setHasMore(result.pagination.total > (currentOffset + newPlaces.length));
        setOffset(currentOffset + newPlaces.length);
        setHasLoadedFirstPage(true);
      }
      
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load ${activeTab}`);
    } finally {
      setLoadingMore(false);
      setPlacesLoading(false);
    }
  }, [userId, activeTab, filters, sortOptions, debouncedSearchQuery, offset]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    setHasLoadedFirstPage(false);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPlaces(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
    setHasLoadedFirstPage(false);
  };

  // Handle sort change
  const handleSortChange = (newSort: SortOptions) => {
    setSortOptions(newSort);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
    setHasLoadedFirstPage(false);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
    setHasLoadedFirstPage(false);
  };


  // Reset state when userId changes
  useEffect(() => {
    setUserData(null);
    setPlaces([]);
    setLoading(true);
    setPlacesLoading(false);
    setError(null);
    setHasLoadedFirstPage(false);
    setHasMore(true);
    setOffset(0);
    setFilters({});
    setSortOptions({ field: 'created_at', direction: 'desc' });
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setActiveTab('recommendations');
  }, [userId]);

  // Effects
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  useEffect(() => {
    loadPlaces(true);
  }, [loadPlaces]);

  // Debounce search input to reduce flicker and request churn
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);


  // Error state
  if (error) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold">Error Loading Profile</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={loadUserProfile} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }



  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);


  const getSortLabel = () => {
    const { field, direction } = sortOptions;
    if (field === 'created_at') return direction === 'desc' ? 'Newest First' : 'Oldest First';
    if (field === 'rating') return direction === 'desc' ? 'Highest Rated' : 'Lowest Rated';
    if (field === 'place_name') return direction === 'asc' ? 'Name A-Z' : 'Name Z-A';
    return 'Sort';
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Profile User Info */}
        {userData ? (
          <section className="mb-8">
            <div className="flex items-center gap-4 p-6 bg-card rounded-lg border">
              <Avatar className="h-16 w-16">
                <AvatarImage src={userData.profilePictureUrl} alt={userData.displayName} />
                <AvatarFallback className="text-lg">{getInitials(userData.displayName)}</AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold truncate">{userData.displayName}</h1>
                <p className="text-muted-foreground truncate">@{userData.username || 'no-username'}</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-8">
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
        <nav className="flex space-x-1 mb-6">
          <Button
            variant={activeTab === 'recommendations' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('recommendations')}
            className="flex items-center gap-2"
          >
            <Star className="h-4 w-4" />
            My Recommendations
          </Button>
          <Button
            variant={activeTab === 'likes' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('likes')}
            className="flex items-center gap-2"
          >
            <Heart className="h-4 w-4" />
            My Likes
          </Button>
        </nav>

        {/* Controls */}
        <section className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SortAsc className="h-4 w-4 mr-2" />
                    {getSortLabel()}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSortChange({ field: 'created_at', direction: 'desc' })}>
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange({ field: 'created_at', direction: 'asc' })}>
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange({ field: 'rating', direction: 'desc' })}>
                    Highest Rated
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange({ field: 'rating', direction: 'asc' })}>
                    Lowest Rated
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange({ field: 'place_name', direction: 'asc' })}>
                    Name A-Z
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange({ field: 'place_name', direction: 'desc' })}>
                    Name Z-A
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </section>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <Card>
                <CardContent className="p-4">
                  <FilterPanel
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    activeTab={activeTab}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

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
                  </div>
                  <h3 className="text-lg font-semibold">No {activeTab} yet</h3>
                  <p className="text-muted-foreground">Start exploring places to build your collection!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <AnimatePresence>
                {places.map((place, index) => (
                  <motion.div
                    key={place.id || `place-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <FeedPost
                      post={place}
                      currentUserId={currentUser?.id || ''}
                      onPostUpdate={() => loadUserProfile()}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load More */}
          {hasMore && hasLoadedFirstPage && (
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
                >
                  Load More
                </Button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default React.memo(ProfilePage); 