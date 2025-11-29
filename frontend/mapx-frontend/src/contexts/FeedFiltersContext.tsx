import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { CitySummary } from '@/components/SocialFeed/CityFilterBar';

export interface FeedFiltersContextValue {
  // City filter props
  cities: CitySummary[];
  selectedCityId?: string;
  selectedCityName?: string;
  globalSummary?: CitySummary;
  onSelectCity: (city?: { id?: string; name?: string }) => void;
  
  // Category filter props
  selectedCategoryKeys: string[];
  onToggleCategory: (key: string) => void;
  overrideCategories?: Array<{ key: string; label: string; count?: number }>;
  
  // Search props
  isAuthenticated: boolean;
  onStream?: (query: string, userLocation?: { lat: number; lng: number } | null, groupIds?: number[]) => void;
  onCleared?: () => void;
  searchPlaceholder?: string;
  
  // Group filter props
  currentUserId: string;
  selectedGroupIds: number[];
  onGroupToggle: (groupId: number) => void;
  
  // Visibility
  hasActiveSearch: boolean;
}

// Module-level state store for feed filters (accessible outside React tree)
let globalFeedFiltersState: FeedFiltersContextValue | null = null;
const listeners = new Set<(value: FeedFiltersContextValue | null) => void>();

export const setFeedFiltersState = (value: FeedFiltersContextValue | null) => {
  globalFeedFiltersState = value;
  listeners.forEach(listener => listener(value));
};

export const getFeedFiltersState = (): FeedFiltersContextValue | null => {
  return globalFeedFiltersState;
};

const FeedFiltersContext = createContext<FeedFiltersContextValue | null>(null);

export const FeedFiltersProvider: React.FC<{
  children: ReactNode;
  value: FeedFiltersContextValue;
}> = ({ children, value }) => {
  // Update global state when value changes
  useEffect(() => {
    setFeedFiltersState(value);
    return () => {
      setFeedFiltersState(null);
    };
  }, [value]);

  return (
    <FeedFiltersContext.Provider value={value}>
      {children}
    </FeedFiltersContext.Provider>
  );
};

export const useFeedFilters = (): FeedFiltersContextValue | null => {
  const contextValue = useContext(FeedFiltersContext);
  const [globalValue, setGlobalValue] = useState<FeedFiltersContextValue | null>(globalFeedFiltersState);

  // Subscribe to global state changes (for components outside provider)
  useEffect(() => {
    const listener = (value: FeedFiltersContextValue | null) => {
      setGlobalValue(value);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Prefer context value if available, otherwise use global state
  return contextValue ?? globalValue;
};

