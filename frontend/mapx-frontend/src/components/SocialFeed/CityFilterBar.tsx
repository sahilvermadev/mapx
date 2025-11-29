import React, { useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import CitySearchPopover from './CitySearchPopover';
import CategoryDropdown from './CategoryDropdown';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileTheme } from '@/contexts/ProfileThemeContext';
import { THEMES } from '@/services/profileService';

export interface CitySummary {
  id: string;
  name: string;
  country?: string;
  tagline?: string;
  recCount: number;
  friendCount: number;
  friendFaces: Array<{ id: string; name: string; photoUrl?: string }>; 
  categories: Array<{ key: string; label: string; count?: number }>;
}

type Props = {
  cities: CitySummary[];
  selectedCityId?: string;
  selectedCityName?: string;
  selectedCategoryKeys: string[];
  onSelectCity: (city?: { id?: string; name?: string }) => void;
  onToggleCategory: (key: string) => void;
  className?: string;
  globalSummary?: CitySummary; // Used when no city is selected (Worldwide)
  overrideCategories?: Array<{ key: string; label: string; count?: number }>; // Derived categories for current scope
  searchValue?: string; // Search query value
  onSearchChange?: (query: string) => void; // Search query handler
  searchPlaceholder?: string; // Placeholder for search input
  isSearching?: boolean; // Loading state for search
};

const CityFilterBar: React.FC<Props> = ({
  cities,
  selectedCityId,
  selectedCityName,
  selectedCategoryKeys,
  onSelectCity,
  onToggleCategory,
  className = '',
  globalSummary,
  overrideCategories,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search recommendations...',
  isSearching = false,
}) => {
  const city = cities.find(c => c.id === selectedCityId);
  const triggerLabel = selectedCityName || city?.name || 'Worldwide';
  const summary = city || globalSummary;
  
  // Memoize categories to prevent unnecessary re-renders when summary object reference changes
  // Only depend on the actual categories array, not the entire summary object
  const summaryCategories = summary?.categories ?? [];
  const categories = useMemo(() => (overrideCategories ?? summaryCategories), [overrideCategories, summaryCategories]);

  // Get theme for styling - use profile theme if available (viewing someone else's profile)
  const { theme: userThemeName } = useTheme();
  const { profileTheme, profileThemeObject } = useProfileTheme();
  const themeName = profileTheme || userThemeName;
  const theme = profileThemeObject || (userThemeName && THEMES[userThemeName as keyof typeof THEMES] 
    ? THEMES[userThemeName as keyof typeof THEMES] 
    : null);

  // Container styling
  const containerStyles = 'w-full border rounded-xl';

  // Memoize available cities for CitySearchPopover to prevent unnecessary re-renders
  const availableCities = useMemo(() => 
    (cities || []).map(c => ({ id: c.id, name: c.name, country: c.country, recCount: c.recCount })),
    [cities]
  );

  return (
    <div 
      className={`${containerStyles} ${className}`}
      style={theme ? {
        backgroundColor: theme.cardBackground,
        borderColor: theme.borderColorMuted,
      } : {
        backgroundColor: 'var(--background)',
        borderColor: 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="w-full px-2 sm:px-3 md:px-6 h-[56px] lg:h-[64px] grid grid-cols-3 items-center">
        {/* Left: City selector */}
        <div className="flex items-center gap-3 shrink-0 justify-start">
          <CitySearchPopover
            triggerLabel={triggerLabel}
            onSelect={(c) => onSelectCity({ id: c.id, name: c.name })}
            availableCities={availableCities}
            style={theme ? {
              borderColor: theme.borderColor,
              color: theme.buttonGhost.text || theme.textPrimary,
              backgroundColor: 'transparent',
            } : undefined}
            hoverColor={theme?.buttonGhost.hover}
          />
        </div>
        
        {/* Middle: Search bar - centered */}
        {onSearchChange && (
          <div className="hidden md:flex items-center justify-center px-4">
            <div className="relative w-full max-w-md">
              <Search 
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 transition-opacity ${isSearching ? 'opacity-0' : ''}`}
                style={{ color: theme?.inputPlaceholder || '#9CA3AF' }}
              />
              {isSearching && (
                <Loader2 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 animate-spin"
                  style={{ color: theme?.inputPlaceholder || '#9CA3AF' }}
                />
              )}
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-9 w-full rounded-full border shadow-none focus:shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all text-sm md:text-base font-medium min-w-0"
                style={theme ? {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.inputBorder,
                  color: theme.inputText,
                } : {
                  backgroundColor: '#FFFFFF',
                  borderColor: 'rgba(0, 0, 0, 0.1)',
                }}
                disabled={isSearching}
              />
            </div>
          </div>
        )}

        {/* Right: Categories menu */}
        <div className="flex items-center gap-2 min-w-0 justify-end">
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
  );
};

export default CityFilterBar;


