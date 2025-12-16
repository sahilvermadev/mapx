import React, { useRef, useEffect, useState } from 'react';
import { FaSearch, FaBrain, FaMapMarkerAlt } from 'react-icons/fa';
import type { PlaceDetails } from './ContentCard';
import type { SearchResponse } from '../services/recommendationsApiService';
import { getPrimaryGoogleType } from '../utils/placeTypes';
import { friendGroupsApi, type FriendGroup } from '../services/friendGroupsService';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import './SearchBar.css';

interface SearchBarProps {
  isAuthenticated: boolean;
  onPlaceSelected?: (place: PlaceDetails) => void;
  onClear?: () => void;
  onSemanticSearch?: (query: string) => Promise<SearchResponse>;
  onSearchResults?: (results: SearchResponse) => void;
  onSearchLoading?: (loading: boolean) => void;
  // Group filter props
  currentUserId?: string;
  selectedGroupIds?: number[];
  onGroupToggle?: (groupId: number) => void;
  onClearGroups?: () => void;
  showGroupFilters?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  isAuthenticated, 
  onPlaceSelected, 
  onClear,
  onSemanticSearch,
  onSearchResults,
  onSearchLoading,
  currentUserId,
  selectedGroupIds = [],
  onGroupToggle,
  onClearGroups,
  showGroupFilters = false
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const placesInput = useRef<HTMLInputElement>(null);
  const aiSearchInput = useRef<HTMLInputElement>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  // Always default to 'places' mode if AI search is not available
  const [searchMode, setSearchMode] = useState<'places' | 'semantic'>('places');
  
  // Ensure we stay in 'places' mode if AI search props are not provided
  useEffect(() => {
    if (!onSemanticSearch || !onSearchResults || !onSearchLoading) {
      setSearchMode('places');
    }
  }, [onSemanticSearch, onSearchResults, onSearchLoading]);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Load groups when component mounts or currentUserId changes
  useEffect(() => {
    if (showGroupFilters && currentUserId && isAuthenticated) {
      loadGroups();
    }
  }, [currentUserId, isAuthenticated, showGroupFilters]);

  const loadGroups = async () => {
    if (!currentUserId) return;
    
    setGroupsLoading(true);
    try {
      const response = await friendGroupsApi.getUserGroups(currentUserId);
      if (response && response.success && response.data) {
        setGroups(response.data);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    const g: any = (window as any).google;
    if (
      !placesInput.current ||
      !g ||
      !g.maps ||
      !g.maps.places ||
      !g.maps.places.Autocomplete
    ) {
      return;
    }

    // Clean up existing autocomplete
    if (autocomplete.current) {
      g.maps.event.clearInstanceListeners(autocomplete.current);
      autocomplete.current = null;
    }

    // Only initialize autocomplete for places mode
    if (searchMode === 'places') {
      console.log('🔍 SearchBar: Initializing autocomplete...');
      autocomplete.current = new g.maps.places.Autocomplete(placesInput.current, {
        types: ['establishment'],
        fields: ['place_id', 'geometry', 'name', 'formatted_address', 'types', 'photos']
      });

      if (autocomplete.current) {
        autocomplete.current.addListener('place_changed', () => {
        const place = autocomplete.current?.getPlace();
        if (place && place.geometry && onPlaceSelected) {
          // Validate coordinates
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();

          const latIsValid = typeof lat === 'number' && !Number.isNaN(lat);
          const lngIsValid = typeof lng === 'number' && !Number.isNaN(lng);

          if (!latIsValid || !lngIsValid) {
            console.warn('Invalid coordinates from Google Places API:', place?.name);
            return;
          }
          
          console.log('Place selected:', place.name, 'Coordinates:', lat, lng);
          console.log('Place types:', place.types);
          
          // Get the primary Google Places type
          const primaryType = getPrimaryGoogleType(place.types || []);
          console.log('Primary Google type:', primaryType);
          
          // Convert Google Places PlaceResult to PlaceDetails
          const placeDetails: PlaceDetails = {
            id: place.place_id || '',
            name: place.name || '',
            address: place.formatted_address || '',
            category: primaryType, // Use Google Places type directly
            images: place.photos?.map(photo => photo.getUrl()) || [],
            isSaved: false,
            // Add coordinates for map positioning
            latitude: lat as number,
            longitude: lng as number,
            google_place_id: place.place_id,
          };
          onPlaceSelected(placeDetails);
        }
      });
      }
    }
    // Cleanup on unmount or when toggling modes
    return () => {
      if (autocomplete.current && g?.maps?.event) {
        g.maps.event.clearInstanceListeners(autocomplete.current);
      }
      autocomplete.current = null;
    };
  }, [onPlaceSelected, searchMode]); // Initialize when dependencies ready

  const handleClearSearch = () => {
    // Clear both inputs
    if (placesInput.current) {
      placesInput.current.value = '';
    }
    if (aiSearchInput.current) {
      aiSearchInput.current.value = '';
    }
    setSemanticQuery('');
    if (onClear) {
      onClear();
    }
  };

  // Note: removed unused toggle helper to satisfy linter

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!semanticQuery.trim() || !onSemanticSearch || !onSearchResults || !onSearchLoading) {
      return;
    }

    setIsSearching(true);
    onSearchLoading(true);

    try {
      const results = await onSemanticSearch(semanticQuery.trim());
      onSearchResults(results);
    } catch (error) {
      console.error('Semantic search failed:', error);
      // You could show an error toast here
    } finally {
      setIsSearching(false);
      onSearchLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSemanticQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchMode === 'semantic' && e.key === 'Enter') {
      handleSemanticSearch(e);
    } else if (searchMode === 'places' && e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Hide AI search toggle if semantic search props are not provided
  const showAISearchToggle = Boolean(onSemanticSearch && onSearchResults && onSearchLoading);

  return (
    <div className="search-container">
      {showAISearchToggle && (
        <div className="search-mode-toggle">
          <button
            className={`mode-btn ${searchMode === 'places' ? 'active' : ''}`}
            onClick={() => setSearchMode('places')}
            disabled={!isAuthenticated}
          >
            <FaMapMarkerAlt />
            Places
          </button>
          <button
            className={`mode-btn ${searchMode === 'semantic' ? 'active' : ''}`}
            onClick={() => setSearchMode('semantic')}
            disabled={!isAuthenticated}
          >
            <FaBrain />
            AI Search
          </button>
        </div>
      )}

      <form 
        onSubmit={handleSemanticSearch} 
        className="search"
        style={selectedTheme ? {
          backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || 'rgba(0, 0, 0, 0.6)',
          borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
        } : undefined}
      >
        {/* Places input with autocomplete */}
        {searchMode === 'places' && (
          <input 
            ref={placesInput}
            type="text" 
            placeholder="Search places, users, recs..."
            className="search-bar-input" 
            disabled={!isAuthenticated || isSearching}
            onKeyDown={handleKeyDown}
            style={selectedTheme ? {
              minWidth: 0,
              color: selectedTheme.inputText || selectedTheme.textPrimary || '#FFFFFF',
            } : { minWidth: 0, color: '#e8eefc' }}
            aria-label="Search places"
          />
        )}
        
        {/* AI Search input without autocomplete */}
        {searchMode === 'semantic' && (
          <input 
            ref={aiSearchInput}
            type="text" 
            placeholder="Ask about places (e.g., 'best cafe with wifi in Hauz Khas')"
            className="search-bar-input" 
            disabled={!isAuthenticated || isSearching}
            value={semanticQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={selectedTheme ? {
              minWidth: 0,
              color: selectedTheme.inputText || selectedTheme.textPrimary || '#FFFFFF',
            } : { minWidth: 0, color: '#e8eefc' }}
            autoComplete="off"
            data-lpignore="true"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="AI search query"
          />
        )}
        <style>{`
          .search-bar-input::placeholder {
            color: ${selectedTheme?.inputPlaceholder || selectedTheme?.textMuted || 'rgba(232, 238, 252, 0.6)'} !important;
          }
        `}</style>
        <button 
          type="button"
          className="clear-btn" 
          onClick={handleClearSearch} 
          aria-label="Clear search"
          disabled={isSearching}
        >
          ✕
        </button>
        {searchMode === 'semantic' && (
          <button 
            type="submit"
            className="search-btn"
            disabled={!semanticQuery.trim() || isSearching}
            aria-label="Search"
          >
            {isSearching ? (
              <div className="search-spinner"></div>
            ) : (
              <FaSearch />
            )}
          </button>
        )}
      </form>

      {/* Group Filters */}
      {showGroupFilters && isAuthenticated && (
        <div className="group-filters">
          {groupsLoading ? (
            <div className="group-filters-loading">
              <div className="group-filter-spinner"></div>
              <span>Loading groups...</span>
            </div>
          ) : groups.length > 0 ? (
            <div className="group-filters-container">
              {/* Clear all button if any groups are selected */}
              {selectedGroupIds.length > 0 && (
                <button
                  className="group-filter-clear"
                  onClick={onClearGroups}
                >
                  Clear All
                </button>
              )}
              
              {/* Group buttons */}
              {groups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    className={`group-filter-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => onGroupToggle?.(group.id)}
                  >
                    <span className="group-filter-icon">{group.icon || '👥'}</span>
                    <span className="group-filter-name">{group.name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SearchBar; 