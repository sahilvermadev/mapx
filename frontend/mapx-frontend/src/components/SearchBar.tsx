import React, { useRef, useEffect, useState } from 'react';
import { FaSearch, FaBrain, FaMapMarkerAlt } from 'react-icons/fa';
import type { PlaceDetails } from './ContentCard';
import type { SearchResponse } from '../services/recommendations';
import { getPrimaryGoogleType } from '../utils/placeTypes';
import './SearchBar.css';

interface SearchBarProps {
  isAuthenticated: boolean;
  onPlaceSelected?: (place: PlaceDetails) => void;
  onClear?: () => void;
  onSemanticSearch?: (query: string) => Promise<SearchResponse>;
  onSearchResults?: (results: SearchResponse) => void;
  onSearchLoading?: (loading: boolean) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  isAuthenticated, 
  onPlaceSelected, 
  onClear,
  onSemanticSearch,
  onSearchResults,
  onSearchLoading
}) => {
  const placesInput = useRef<HTMLInputElement>(null);
  const aiSearchInput = useRef<HTMLInputElement>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const [searchMode, setSearchMode] = useState<'places' | 'semantic'>('places');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!placesInput.current || !window.google) {
      return;
    }

    // Clean up existing autocomplete
    if (autocomplete.current) {
      google.maps.event.clearInstanceListeners(autocomplete.current);
      autocomplete.current = null;
    }

    // Only initialize autocomplete for places mode
    if (searchMode === 'places') {
      console.log('🔍 SearchBar: Initializing autocomplete...');
      autocomplete.current = new window.google.maps.places.Autocomplete(placesInput.current, {
        types: ['establishment'],
        fields: ['place_id', 'geometry', 'name', 'formatted_address', 'types', 'photos']
      });

      autocomplete.current.addListener('place_changed', () => {
        const place = autocomplete.current?.getPlace();
        if (place && place.geometry && onPlaceSelected) {
          // Validate coordinates
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          
          if (!lat || !lng || lat === 0 || lng === 0) {
            console.warn('Invalid coordinates from Google Places API:', place.name);
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
            placeType: primaryType, // Keep for backward compatibility
            userRating: 0,
            friendsRating: 4.2, // Default rating for demo
            personalReview: '',
            images: place.photos?.map(photo => photo.getUrl()) || [],
            isLiked: false,
            isSaved: false,
            // Add coordinates for map positioning
            latitude: lat,
            longitude: lng,
            google_place_id: place.place_id,
          };
          onPlaceSelected(placeDetails);
        }
      });
    }
  }, [onPlaceSelected, window.google, searchMode]); // Add searchMode as dependency

  const handleClearSearch = () => {
    // Clear both inputs
    if (placesInput.current) {
      placesInput.current.value = '';
    }
    if (aiSearchInput.current) {
      aiSearchInput.current.value = '';
    }
    setSearchQuery('');
    if (onClear) {
      onClear();
    }
  };

  const handleSearchModeToggle = () => {
    const newMode = searchMode === 'places' ? 'semantic' : 'places';
    setSearchMode(newMode);
    handleClearSearch();
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim() || !onSemanticSearch || !onSearchResults || !onSearchLoading) {
      return;
    }

    setIsSearching(true);
    onSearchLoading(true);

    try {
      const results = await onSemanticSearch(searchQuery.trim());
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
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchMode === 'semantic' && e.key === 'Enter') {
      handleSemanticSearch(e);
    }
  };

  return (
    <div className="search-container">
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

      <form onSubmit={handleSemanticSearch} className="search">
        {/* Places input with autocomplete */}
        {searchMode === 'places' && (
          <input 
            ref={placesInput}
            type="text" 
            placeholder="Search places, users, recs..."
            className="search-bar-input" 
            disabled={!isAuthenticated || isSearching}
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={{ minWidth: 0 }}
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
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            style={{ minWidth: 0 }}
            autoComplete="off"
            data-lpignore="true"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
        <button 
          className="clear-btn" 
          onClick={handleClearSearch} 
          aria-label="Clear"
          disabled={isSearching}
        >
          ✕
        </button>
        {searchMode === 'semantic' && (
          <button 
            type="submit"
            className="search-btn"
            disabled={!searchQuery.trim() || isSearching}
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
    </div>
  );
};

export default SearchBar; 