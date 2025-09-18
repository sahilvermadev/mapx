import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, Heart, Bookmark, Filter, SortAsc, Search, Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { profileApi, type UserData, type UserStats, type FilterOptions, type SortOptions } from '@/services/profile';
import type { PlaceCard } from '@/services/profile';

import PlaceCardComponent from '@/components/PlaceCard';
import StatsCard from '@/components/StatsCard';
import FilterPanel from '@/components/FilterPanel';
import LoadingSpinner from '@/components/LoadingSpinner';

type TabType = 'recommendations' | 'likes' | 'saved';

interface ProfilePageProps {}

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  // State management
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('recommendations');
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter and sort state
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({ field: 'created_at', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab counts
  const [tabCounts, setTabCounts] = useState({
    recommendations: 0,
    likes: 0,
    saved: 0
  });

  // Load user profile data
  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading profile for user ID:', userId);
      
      const [profileData, statsData] = await Promise.all([
        profileApi.getUserProfile(userId),
        profileApi.getUserStats(userId)
      ]);
      
      setUserData(profileData);
      setUserStats(statsData);
      
      // Update tab counts
      setTabCounts({
        recommendations: statsData.total_recommendations,
        likes: statsData.total_likes,
        saved: statsData.total_saved
      });
      
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
      
      let result;
      
      switch (activeTab) {
        case 'recommendations':
          result = await profileApi.getUserRecommendations(
            userId, 
            { ...filters, search: searchQuery }, 
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
        case 'saved':
          result = await profileApi.getUserSaved(
            userId, 
            sortOptions, 
            { limit: 20, offset: currentOffset }
          );
          break;
      }
      
      if (result) {
        const newPlaces = result.data;
        setPlaces(prev => reset ? newPlaces : [...prev, ...newPlaces]);
        setHasMore(result.pagination.total > (currentOffset + newPlaces.length));
        setOffset(currentOffset + newPlaces.length);
      }
      
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load ${activeTab}`);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, activeTab, filters, sortOptions, searchQuery, offset]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
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
  };

  // Handle sort change
  const handleSortChange = (newSort: SortOptions) => {
    setSortOptions(newSort);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPlaces([]);
    setOffset(0);
    setHasMore(true);
  };

  // Handle place actions
  const handlePlaceAction = async (placeId: string, action: 'delete' | 'unlike' | 'remove') => {
    try {
      let success = false;
      
      switch (action) {
        case 'delete':
          success = await profileApi.deleteRecommendation(parseInt(placeId));
          break;
        case 'unlike':
          success = await profileApi.unlikePlace(parseInt(placeId));
          break;
        case 'remove':
          success = await profileApi.removeFromSaved(parseInt(placeId));
          break;
      }
      
      if (success) {
        // Remove from local state
        setPlaces(prev => prev.filter(place => place.id !== placeId));
        
        // Update stats
        if (userStats) {
          setUserStats(prev => {
            if (!prev) return prev;
            switch (action) {
              case 'delete':
                return { ...prev, total_recommendations: prev.total_recommendations - 1 };
              case 'unlike':
                return { ...prev, total_likes: prev.total_likes - 1 };
              case 'remove':
                return { ...prev, total_saved: prev.total_saved - 1 };
              default:
                return prev;
            }
          });
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} place:`, err);
    }
  };

  // Handle view on map
  const handleViewOnMap = (place: PlaceCard) => {
    if (place.place_lat && place.place_lng) {
      navigate('/', { 
        state: { 
          center: { lat: place.place_lat, lng: place.place_lng },
          place: place
        } 
      });
    }
  };

  // Effects
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  useEffect(() => {
    loadPlaces(true);
  }, [loadPlaces]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  // Check if user exists
  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-semibold">User Not Found</h2>
          <p className="text-muted-foreground">The requested user profile could not be found.</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Back to Map
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Map
          </Button>
          
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userData.profilePictureUrl} alt={userData.displayName} />
              <AvatarFallback>{getInitials(userData.displayName)}</AvatarFallback>
            </Avatar>
            
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{userData.displayName}</h1>
              <p className="text-sm text-muted-foreground truncate">{userData.email}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        {/* {userStats && (
          <section className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatsCard
                title="Recommendations"
                value={userStats.total_recommendations}
                icon={<Star className="h-4 w-4" />}
                color="primary"
              />
              <StatsCard
                title="Likes"
                value={userStats.total_likes}
                icon={<Heart className="h-4 w-4" />}
                color="secondary"
              />
              <StatsCard
                title="Saved"
                value={userStats.total_saved}
                icon={<Bookmark className="h-4 w-4" />}
                color="success"
              />
              <StatsCard
                title="Avg Rating"
                value={userStats.average_rating.toFixed(1)}
                icon={<Star className="h-4 w-4" />}
                color="warning"
                isRating
              />
            </div>
          </section>
        )} */}

        {/* Tab Navigation */}
        <nav className="flex space-x-1 mb-6">
          <Button
            variant={activeTab === 'recommendations' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('recommendations')}
            className="flex items-center gap-2"
          >
            <Star className="h-4 w-4" />
            Recommendations
            <Badge variant="secondary" className="ml-1">
              {tabCounts.recommendations}
            </Badge>
          </Button>
          <Button
            variant={activeTab === 'likes' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('likes')}
            className="flex items-center gap-2"
          >
            <Heart className="h-4 w-4" />
            Likes
            <Badge variant="secondary" className="ml-1">
              {tabCounts.likes}
            </Badge>
          </Button>
          <Button
            variant={activeTab === 'saved' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('saved')}
            className="flex items-center gap-2"
          >
            <Bookmark className="h-4 w-4" />
            Saved
            <Badge variant="secondary" className="ml-1">
              {tabCounts.saved}
            </Badge>
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
          {places.length === 0 && !loadingMore ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 text-muted-foreground">
                    {activeTab === 'recommendations' && <Star className="h-full w-full" />}
                    {activeTab === 'likes' && <Heart className="h-full w-full" />}
                    {activeTab === 'saved' && <Bookmark className="h-full w-full" />}
                  </div>
                  <h3 className="text-lg font-semibold">No {activeTab} yet</h3>
                  <p className="text-muted-foreground">Start exploring places to build your collection!</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {places.map((place, index) => (
                  <motion.div
                    key={place.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <PlaceCardComponent
                      place={place}
                      onViewOnMap={() => handleViewOnMap(place)}
                      onDelete={() => handlePlaceAction(place.id, 'delete')}
                      onUnlike={() => handlePlaceAction(place.id, 'unlike')}
                      onRemove={() => handlePlaceAction(place.id, 'remove')}
                      showActions={true}
                      tabType={activeTab}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
                size="lg"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="small" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ProfilePage; 