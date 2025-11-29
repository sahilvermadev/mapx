import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CitySearchPopover from './CitySearchPopover';
import CategoryDropdown from './CategoryDropdown';
import GroupsDropdown from './GroupsDropdown';
import { getCurrentLocation } from '@/utils/geolocation';
import { friendGroupsApi, type FriendGroup } from '@/services/friendGroupsService';
import type { CitySummary } from './CityFilterBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileTheme } from '@/contexts/ProfileThemeContext';
import { THEMES } from '@/services/profileService';

interface UnifiedFeedFiltersProps {
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
  
  className?: string;
}

const UnifiedFeedFilters: React.FC<UnifiedFeedFiltersProps> = ({
  cities,
  selectedCityId,
  selectedCityName,
  globalSummary,
  onSelectCity,
  selectedCategoryKeys,
  onToggleCategory,
  overrideCategories,
  isAuthenticated,
  onStream,
  onCleared,
  searchPlaceholder = 'Tell us what you\'re looking for...',
  currentUserId,
  selectedGroupIds,
  onGroupToggle,
  className = '',
}) => {
  // City filter state
  const city = cities.find(c => c.id === selectedCityId);
  const triggerLabel = selectedCityName || city?.name || 'Worldwide';
  const summary = city || globalSummary;
  const summaryCategories = summary?.categories ?? [];
  const categories = useMemo(() => (overrideCategories ?? summaryCategories), [overrideCategories, summaryCategories]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Group filter state
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  
  // Memoize available cities
  const availableCities = useMemo(() => 
    (cities || []).map(c => ({ id: c.id, name: c.name, country: c.country, recCount: c.recCount })),
    [cities]
  );
  
  // Load groups
  const loadGroups = useCallback(async () => {
    if (!currentUserId) return;
    
    setGroupsLoading(true);
    try {
      const response = await friendGroupsApi.getUserGroups(currentUserId);
      if (response && response.success && response.data) {
        setGroups(response.data);
      } else {
        // Error is logged but not displayed to user - groups dropdown will simply not appear
        console.error('Failed to load groups: Invalid response', response);
      }
    } catch (error) {
      // Error is logged but not displayed to user - groups dropdown will simply not appear
      console.error('Failed to load groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  }, [currentUserId]);
  
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);
  
  // Search handler
  const runSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !isAuthenticated) {
      return;
    }
    
    // Cancel any in-flight search request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this search
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setSearchLoading(true);
    
    try {
      // Always try to get user location for location-aware search results
      let userLocation: { lat: number; lng: number } | null = null;
      try {
        const location = await getCurrentLocation();
        if (location) {
          userLocation = { lat: location.lat, lng: location.lng };
          console.log('📍 Using GPS coordinates for location-aware search:', userLocation);
        } else {
          console.log('📍 GPS coordinates unavailable, proceeding without location');
        }
      } catch (locationError) {
        if (abortController.signal.aborted) {
          return;
        }
        console.warn('⚠️ Failed to get GPS coordinates:', locationError);
      }
      
      if (abortController.signal.aborted) {
        return;
      }
      
      if (onStream) {
        onStream(trimmed, userLocation, selectedGroupIds.length > 0 ? selectedGroupIds : undefined);
        setSearchQuery('');
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        return;
      }
      console.error('Search failed:', err);
    } finally {
      if (!abortController.signal.aborted) {
        setSearchLoading(false);
      }
    }
  }, [isAuthenticated, onStream, searchQuery, selectedGroupIds]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // External search submit handler
  useEffect(() => {
    const handleExternalSubmit = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (typeof custom.detail === 'string' && custom.detail.trim().length > 0) {
        setSearchQuery(custom.detail);
        // Trigger search after setting query
        setTimeout(() => runSearch(), 0);
      }
    };
    
    window.addEventListener('feed-search:submit', handleExternalSubmit as EventListener);
    return () => window.removeEventListener('feed-search:submit', handleExternalSubmit as EventListener);
  }, [runSearch]);
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    runSearch();
  };
  
  // Get theme for styling
  // Get theme for styling - use profile theme if available (viewing someone else's profile)
  const { theme: userThemeName } = useTheme();
  const { profileTheme, profileThemeObject } = useProfileTheme();
  const themeName = profileTheme || userThemeName;
  const theme = profileThemeObject || (userThemeName && THEMES[userThemeName as keyof typeof THEMES] 
    ? THEMES[userThemeName as keyof typeof THEMES]
    : null);
  
  // Determine styling based on theme
  // Remove rounded corners and border to make it feel more cohesive with header
  const containerStyles = 'w-full';
  
  // Use transparent background since parent already has the header background
  const containerStyle = theme ? {
    backgroundColor: 'transparent',
    color: theme.headerText,
  } : undefined;
  
  return (
    <div className={`relative ${className}`}>
      {/* Main filter bar */}
      <div className={containerStyles} style={containerStyle}>
        <div className="w-full h-[56px] lg:h-[64px] flex items-center gap-4 sm:gap-6 md:gap-8">
          {/* Left: City selector */}
          <div className="flex-shrink-0">
            <CitySearchPopover
              triggerLabel={triggerLabel}
              onSelect={(c) => onSelectCity({ id: c.id, name: c.name })}
              availableCities={availableCities}
              className="bg-transparent"
              style={theme ? {
                borderColor: theme.borderColor,
                color: theme.buttonGhost.text || theme.textPrimary,
                backgroundColor: 'transparent',
              } : {
                borderColor: 'rgba(0, 0, 0, 0.1)',
                color: 'inherit',
                backgroundColor: 'transparent',
              }}
              hoverColor={theme?.buttonGhost.hover}
            />
          </div>
          
          {/* Center: Search bar */}
          <div className="flex-1 min-w-0 flex items-center justify-center max-w-2xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div 
                className="rounded-full border h-10 md:h-11 lg:h-12 px-5 md:px-6 lg:px-8 flex items-center gap-4 md:gap-5 shadow-sm"
                style={theme ? {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  color: theme.inputText,
                } : {
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5E5E5',
                }}
              >
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchQuery(v);
                    if (v.trim() === '') {
                      onCleared?.();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      runSearch();
                    }
                  }}
                  disabled={!isAuthenticated || searchLoading}
                  className="flex-1 bg-transparent outline-none text-sm md:text-base font-normal min-w-0 placeholder:opacity-60"
                  style={theme ? {
                    color: theme.inputText,
                  } : undefined}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 md:h-9 md:w-9 rounded-full flex-shrink-0"
                  style={theme ? {
                    backgroundColor: theme.buttonPrimary.background,
                    color: theme.buttonPrimary.text,
                    border: theme.buttonPrimary.border || 'none',
                  } : {
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                  }}
                  onMouseEnter={(e) => {
                    if (theme) {
                      e.currentTarget.style.backgroundColor = theme.buttonPrimary.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (theme) {
                      e.currentTarget.style.backgroundColor = theme.buttonPrimary.background;
                    }
                  }}
                  disabled={!searchQuery.trim() || searchLoading || !isAuthenticated}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    runSearch();
                  }}
                  aria-label="Search"
                >
                  {searchLoading ? (
                    <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
                  )}
                </Button>
              </div>
            </form>
          </div>
          
          {/* Right: Categories and Groups */}
          <div className="flex items-center gap-2 justify-end flex-shrink-0 min-w-0">
            {/* Groups dropdown */}
            <GroupsDropdown
              groups={groups}
              selectedIds={selectedGroupIds}
              onToggle={onGroupToggle}
              loading={groupsLoading}
            />
            
            {/* Categories dropdown */}
            {categories.length > 0 && (
              <CategoryDropdown
                categories={categories}
                selectedKeys={selectedCategoryKeys}
                onToggle={onToggleCategory}
                ariaLabel="All categories"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedFeedFilters;

