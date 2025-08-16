import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaArrowLeft, FaStar, FaHeart, FaBookmark, FaFilter, FaSort, FaSearch } from 'react-icons/fa';
import { profileApi, type UserData, type UserStats, type FilterOptions, type SortOptions } from '../services/profile';
import type { PlaceCard } from '../services/profile';

import PlaceCardComponent from '../components/PlaceCard';
import StatsCard from '../components/StatsCard';
import FilterPanel from '../components/FilterPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import './ProfilePage.css';

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
      <div className="profile-page">
        <div className="profile-loading">
          <LoadingSpinner />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <h2>Error Loading Profile</h2>
          <p>{error}</p>
          <button onClick={loadUserProfile} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if user exists
  if (!userData) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <h2>User Not Found</h2>
          <p>The requested user profile could not be found.</p>
          <button onClick={() => navigate('/')} className="back-btn">
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <div className="header-container">
          <button onClick={() => navigate('/')} className="back-btn" aria-label="Back to map">
            <FaArrowLeft />
          </button>
          
          <div className="user-info">
            <div className="user-avatar">
              {userData.profilePictureUrl ? (
                <img src={userData.profilePictureUrl} alt={userData.displayName} />
              ) : (
                <div className="avatar-fallback">
                  {userData.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="user-details">
              <h1>{userData.displayName}</h1>
              <p>{userData.email}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="main-container">

      {/* Stats Dashboard */}
      {userStats && (
        <section className="stats-dashboard">
          <StatsCard
            title="Recommendations"
            value={userStats.total_recommendations}
            icon={<FaStar />}
            color="primary"
          />
          <StatsCard
            title="Likes"
            value={userStats.total_likes}
            icon={<FaHeart />}
            color="secondary"
          />
          <StatsCard
            title="Saved"
            value={userStats.total_saved}
            icon={<FaBookmark />}
            color="success"
          />
          <StatsCard
            title="Avg Rating"
            value={userStats.average_rating.toFixed(1)}
            icon={<FaStar />}
            color="warning"
            isRating
          />
        </section>
      )}

      {/* Tab Navigation */}
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => handleTabChange('recommendations')}
        >
          Recommendations
          <span className="tab-count">{tabCounts.recommendations}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'likes' ? 'active' : ''}`}
          onClick={() => handleTabChange('likes')}
        >
          Likes
          <span className="tab-count">{tabCounts.likes}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => handleTabChange('saved')}
        >
          Saved
          <span className="tab-count">{tabCounts.saved}</span>
        </button>
      </nav>

      {/* Controls */}
      <section className="controls-section">
        <div className="search-control">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="control-buttons">
          <button
            className={`control-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Toggle filters"
          >
            <FaFilter />
            Filters
          </button>
          
          <div className="sort-dropdown">
            <button className="control-btn" aria-label="Sort options">
              <FaSort />
              Sort
            </button>
            <div className="sort-menu">
              <button onClick={() => handleSortChange({ field: 'created_at', direction: 'desc' })}>
                Newest First
              </button>
              <button onClick={() => handleSortChange({ field: 'created_at', direction: 'asc' })}>
                Oldest First
              </button>
              <button onClick={() => handleSortChange({ field: 'rating', direction: 'desc' })}>
                Highest Rated
              </button>
              <button onClick={() => handleSortChange({ field: 'rating', direction: 'asc' })}>
                Lowest Rated
              </button>
              <button onClick={() => handleSortChange({ field: 'place_name', direction: 'asc' })}>
                Name A-Z
              </button>
              <button onClick={() => handleSortChange({ field: 'place_name', direction: 'desc' })}>
                Name Z-A
              </button>
            </div>
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
            className="filter-panel-container"
          >
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              activeTab={activeTab}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="content-area">
        {places.length === 0 && !loadingMore ? (
          <div className="empty-state">
            <div className="empty-icon">
              {activeTab === 'recommendations' && <FaStar />}
              {activeTab === 'likes' && <FaHeart />}
              {activeTab === 'saved' && <FaBookmark />}
            </div>
            <h3>No {activeTab} yet</h3>
            <p>Start exploring places to build your collection!</p>
          </div>
        ) : (
          <div className="places-grid">
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
          <div className="load-more-container">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="load-more-btn"
            >
              {loadingMore ? (
                <>
                  <LoadingSpinner size="small" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </main>
      </div>
    </div>
  );
};

export default ProfilePage; 