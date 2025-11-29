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
  console.log('[FeedFiltersContext] setFeedFiltersState called:', {
    hasValue: !!value,
    valueType: value ? typeof value : 'null',
    citiesCount: value?.cities?.length ?? 0,
    currentUserId: value?.currentUserId ?? 'none',
    listenerCount: listeners.size,
    timestamp: performance.now(),
  });
  globalFeedFiltersState = value;
  console.log('[FeedFiltersContext] Notifying listeners, count:', listeners.size);
  const listenerArray = Array.from(listeners);
  listenerArray.forEach((listener, index) => {
    console.log(`[FeedFiltersContext] Calling listener ${index + 1}/${listenerArray.length}`);
    listener(value);
  });
  console.log('[FeedFiltersContext] All listeners notified');
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
  
  console.log('[FeedFiltersProvider] Render:', {
    hasValue: !!value,
    valueChanged: prevValueRef.current !== value,
    citiesCount: value?.cities?.length ?? 0,
    currentUserId: value?.currentUserId ?? 'none',
    timestamp: performance.now(),
  });
  
  // Initialize global state synchronously on mount/update
  // Only update if value reference changed (since value is memoized in parent)
  // This ensures global state is available immediately when provider renders
  if (prevValueRef.current !== value) {
    console.log('[FeedFiltersProvider] Value changed, setting global state synchronously');
    prevValueRef.current = value;
    setFeedFiltersState(value);
  } else {
    console.log('[FeedFiltersProvider] Value unchanged, skipping update');
  }
  
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

  console.log('[useFeedFilters] Hook called:', {
    hasContextValue: !!contextValue,
    hasGlobalValue: !!globalValue,
    globalStateAtInit: !!globalFeedFiltersState,
    globalStateNow: !!globalFeedFiltersState,
    stateMatches: globalValue === globalFeedFiltersState,
    prevStateMatches: prevGlobalStateRef.current === globalFeedFiltersState,
    willReturn: contextValue ? 'contextValue' : (globalFeedFiltersState ? 'globalState (direct)' : 'globalValue (state)'),
    timestamp: performance.now(),
  });

  // Check if globalFeedFiltersState changed since last render and force update if needed
  // This runs on every render to catch changes that happen outside the listener mechanism
  // Use a ref to track the last value we've seen to avoid infinite loops
  const lastSeenRef = useRef<FeedFiltersContextValue | null>(globalFeedFiltersState);
  
  useEffect(() => {
    // Check if the global state changed since we last saw it
    if (lastSeenRef.current !== globalFeedFiltersState) {
      console.log('[useFeedFilters] globalFeedFiltersState changed outside listener, updating state:', {
        hadValue: !!lastSeenRef.current,
        hasNewValue: !!globalFeedFiltersState,
        timestamp: performance.now(),
      });
      lastSeenRef.current = globalFeedFiltersState;
      prevGlobalStateRef.current = globalFeedFiltersState;
      setGlobalValue(globalFeedFiltersState);
      // Force a re-render to ensure component picks up the change
      forceUpdate({});
    }
  }); // No deps - runs on every render to catch external changes

  // Subscribe to global state changes (for components outside provider)
  useEffect(() => {
    console.log('[useFeedFilters] Setting up listener, current globalState:', !!globalFeedFiltersState);
    const listener = (value: FeedFiltersContextValue | null) => {
      console.log('[useFeedFilters] Listener fired:', {
        hasValue: !!value,
        citiesCount: value?.cities?.length ?? 0,
        currentUserId: value?.currentUserId ?? 'none',
        currentGlobalValue: !!globalValue,
        willUpdate: value !== globalValue,
        timestamp: performance.now(),
      });
      prevGlobalStateRef.current = value;
      setGlobalValue(value);
    };
    listeners.add(listener);
    console.log('[useFeedFilters] Listener registered, total listeners:', listeners.size);
    
    // Sync with current state in case it was set before listener was registered
    // This handles the case where SocialFeedPage sets state before Header's listener is registered
    if (globalFeedFiltersState !== globalValue) {
      console.log('[useFeedFilters] Syncing with current globalState (was set before listener)', {
        hasGlobalState: !!globalFeedFiltersState,
        hasGlobalValue: !!globalValue,
      });
      prevGlobalStateRef.current = globalFeedFiltersState;
      setGlobalValue(globalFeedFiltersState);
    } else {
      console.log('[useFeedFilters] GlobalValue already in sync');
    }
    
    return () => {
      console.log('[useFeedFilters] Cleaning up listener');
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Prefer context value if available, otherwise use global state
  // IMPORTANT: Read directly from globalFeedFiltersState to get the latest value
  // This ensures we get the value even if state hasn't updated yet due to React batching
  const result = contextValue ?? globalFeedFiltersState ?? globalValue;
  console.log('[useFeedFilters] Returning:', {
    hasResult: !!result,
    hasContextValue: !!contextValue,
    hasGlobalFeedFiltersState: !!globalFeedFiltersState,
    hasGlobalValue: !!globalValue,
    source: contextValue ? 'context' : (globalFeedFiltersState ? 'globalState (direct)' : 'globalValue (state)'),
    citiesCount: result?.cities?.length ?? 0,
    currentUserId: result?.currentUserId ?? 'none',
    timestamp: performance.now(),
  });
  return result;
};

