import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
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
  const listenerArray = Array.from(listeners);
  listenerArray.forEach((listener) => {
    listener(value);
  });
};

export const getFeedFiltersState = (): FeedFiltersContextValue | null => {
  return globalFeedFiltersState;
};

const FeedFiltersContext = createContext<FeedFiltersContextValue | null>(null);

export const FeedFiltersProvider: React.FC<{
  children: ReactNode;
  value: FeedFiltersContextValue;
}> = ({ children, value }) => {
  // Track previous value to avoid unnecessary updates
  const prevValueRef = useRef<FeedFiltersContextValue | null>(null);
  
  // Update global state in useEffect to avoid React warning about updating during render
  useEffect(() => {
    // Only update if value reference changed (since value is memoized in parent)
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setFeedFiltersState(value);
    }
  }, [value]);
  
  // Don't clear global state on unmount - it should persist across navigation
  // The state will be updated when a new FeedFiltersProvider mounts
  // Clearing it causes issues where Header loses the state during navigation

  return (
    <FeedFiltersContext.Provider value={value}>
      {children}
    </FeedFiltersContext.Provider>
  );
};

export const useFeedFilters = (): FeedFiltersContextValue | null => {
  const contextValue = useContext(FeedFiltersContext);
  const [globalValue, setGlobalValue] = useState<FeedFiltersContextValue | null>(globalFeedFiltersState);
  const prevGlobalStateRef = useRef<FeedFiltersContextValue | null>(globalFeedFiltersState);
  const [, forceUpdate] = useState({});

  // Check if globalFeedFiltersState changed since last render and force update if needed
  // This runs on every render to catch changes that happen outside the listener mechanism
  // Use a ref to track the last value we've seen to avoid infinite loops
  const lastSeenRef = useRef<FeedFiltersContextValue | null>(globalFeedFiltersState);
  
  useEffect(() => {
    // Check if the global state changed since we last saw it
    if (lastSeenRef.current !== globalFeedFiltersState) {
      lastSeenRef.current = globalFeedFiltersState;
      prevGlobalStateRef.current = globalFeedFiltersState;
      setGlobalValue(globalFeedFiltersState);
      // Force a re-render to ensure component picks up the change
      forceUpdate({});
    }
  }); // No deps - runs on every render to catch external changes

  // Subscribe to global state changes (for components outside provider)
  useEffect(() => {
    const listener = (value: FeedFiltersContextValue | null) => {
      prevGlobalStateRef.current = value;
      setGlobalValue(value);
    };
    listeners.add(listener);
    
    // Sync with current state in case it was set before listener was registered
    // This handles the case where SocialFeedPage sets state before Header's listener is registered
    if (globalFeedFiltersState !== globalValue) {
      prevGlobalStateRef.current = globalFeedFiltersState;
      setGlobalValue(globalFeedFiltersState);
    }
    
    return () => {
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Prefer context value if available, otherwise use global state
  // IMPORTANT: Read directly from globalFeedFiltersState to get the latest value
  // This ensures we get the value even if state hasn't updated yet due to React batching
  const result = contextValue ?? globalFeedFiltersState ?? globalValue;
  return result;
};

