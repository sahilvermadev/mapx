import React from 'react';
import { useNavigate } from 'react-router-dom';

import SearchBar from './SearchBar';
import type { PlaceDetails } from './ContentCard';
import type { SearchResponse } from '@/services/recommendations';

interface AppHeaderProps {
  currentUserId?: string;
  showMapButton?: boolean;
  showSearchButton?: boolean;
  showProfileButton?: boolean;
  showDiscoverButton?: boolean;
  // MapPage specific props
  isAuthenticated?: boolean;
  onPlaceSelected?: (place: PlaceDetails) => void;
  onSemanticSearch?: (query: string) => Promise<SearchResponse>;
  onSearchResults?: (results: SearchResponse) => void;
  onSearchLoading?: (loading: boolean) => void;
  user?: any;
  avatar?: React.ReactNode;
  onLogout?: () => void;
  onMenuOpen?: () => void;
  menuOpen?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  currentUserId,
  showMapButton = true,
  showProfileButton = true,
  showDiscoverButton = true,
  // MapPage specific props
  isAuthenticated,
  onPlaceSelected,
  onSemanticSearch,
  onSearchResults,
  onSearchLoading,
}) => {
  const navigate = useNavigate();

  // If this is the MapPage (has search functionality)
  if (isAuthenticated !== undefined && onPlaceSelected) {
    return (
      <div className="searchbar">
        <SearchBar 
          isAuthenticated={isAuthenticated}
          onPlaceSelected={onPlaceSelected}
          onClear={() => {}}
          onSemanticSearch={onSemanticSearch}
          onSearchResults={onSearchResults}
          onSearchLoading={onSearchLoading}
        />
      </div>
    );
  }
};

export default AppHeader; 