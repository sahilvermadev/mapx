import React, { useMemo, useState } from 'react';
import { MapPin, Users, ListFilter, Search, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import CitySearchPopover from './CitySearchPopover';

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
  variant?: 'feed' | 'profile'; // Variant to differentiate feed vs profile usage
  searchValue?: string; // Search query value (for profile variant)
  onSearchChange?: (query: string) => void; // Search query handler (for profile variant)
  searchPlaceholder?: string; // Placeholder for search input
  isSearching?: boolean; // Loading state for search (for profile variant)
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
  variant = 'feed', // Default to 'feed' for backward compatibility
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
  const [query, setQuery] = useState('');
  
  // Only show selected categories as chips
  // Use a stable reference to prevent re-renders when counts update
  const selectedCategories = useMemo(() => {
    return categories.filter(cat => selectedCategoryKeys.includes(cat.key));
  }, [categories, selectedCategoryKeys]);
  
  // Create a map for O(1) category lookup instead of O(n) find operations
  const categoriesMap = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count?: number }>();
    categories.forEach(cat => map.set(cat.key, cat));
    return map;
  }, [categories]);

  // Memoize filtered categories for dropdown search
  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return categories;
    return categories.filter(c => c.label.toLowerCase().includes(normalizedQuery));
  }, [categories, query]);

  // Variant-specific styling aligned with softened keylines (no heavy shadow/box)
  const containerStyles = 'w-full bg-background border border-black/10 rounded-xl';

  // Variant-specific tagline
  const defaultTagline = variant === 'profile'
    ? 'Explore your recommendations'
    : 'See where your friends love to go';

  // Show friend count/faces only for feed variant
  const showFriendStats = variant === 'feed';

  // Memoize available cities for CitySearchPopover to prevent unnecessary re-renders
  const availableCities = useMemo(() => 
    (cities || []).map(c => ({ id: c.id, name: c.name, country: c.country, recCount: c.recCount })),
    [cities]
  );

  return (
    <div className={`${containerStyles} ${className}`}>
      <div className={`w-full px-2 sm:px-3 md:px-6 h-[56px] lg:h-[64px] ${variant === 'profile' ? 'grid grid-cols-3 items-center' : 'flex items-center gap-2 sm:gap-4'}`}>
        {/* Left: City selector + tagline */}
        <div className={variant === 'profile' ? 'flex items-center gap-3 shrink-0 justify-start' : 'flex-1 min-w-0 flex items-center gap-3'}>
          <CitySearchPopover
            triggerLabel={triggerLabel}
            onSelect={(c) => onSelectCity({ id: c.id, name: c.name })}
            availableCities={availableCities}
          />
          {variant !== 'profile' && (
            <div className="hidden md:flex flex-col min-w-0">
              <div className="text-xs md:text-sm text-muted-foreground truncate">
                {city?.tagline || defaultTagline}
              </div>
              {city?.country && (
                <div className="text-[10px] md:text-xs text-muted-foreground/70">{city.country}</div>
              )}
            </div>
          )}
        </div>

        {/* Middle: Stats + faces (feed variant) or Search bar (profile variant) */}
        {showFriendStats && (
          <div className="hidden lg:flex items-center gap-5 px-4 border-l border-black/15">
            <div className="flex items-center gap-2 text-xs md:text-sm text-foreground/80">
              <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 opacity-70" strokeWidth={1.5} />
              <span>{summary?.recCount ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-foreground/80">
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4 opacity-70" strokeWidth={1.5} />
              <span>{summary?.friendCount ?? 0}</span>
            </div>
            <div className="flex -space-x-2">
              {(summary?.friendFaces ?? []).slice(0, 4).map(f => (
                <Avatar key={f.id} className="h-7 w-7 ring-2 ring-white">
                  <AvatarImage src={f.photoUrl} alt={f.name} />
                  <AvatarFallback>{getInitials(f.name)}</AvatarFallback>
                </Avatar>
              ))}
              {summary && (summary.friendFaces?.length || 0) > 4 && (
                <div className="h-7 w-7 rounded-full bg-white/80 text-xs flex items-center justify-center ring-2 ring-white">
                  +{(summary.friendFaces?.length || 0) - 4}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Search bar for profile variant - centered */}
        {variant === 'profile' && onSearchChange && (
          <div className="hidden md:flex items-center justify-center px-4">
            <div className="relative w-full max-w-md">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 transition-opacity ${isSearching ? 'opacity-0' : 'text-muted-foreground'}`} />
              {isSearching && (
                <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 animate-spin" />
              )}
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-9 w-full rounded-full border border-black/10 bg-white shadow-none focus:shadow-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all text-sm md:text-base font-medium min-w-0"
                disabled={isSearching}
              />
            </div>
          </div>
        )}

        {/* Right: Categories menu */}
        <div className={variant === 'profile' ? 'flex items-center gap-2 min-w-0 justify-end' : 'flex items-center gap-2 justify-end flex-1 min-w-0'}>
          {/* Categories dropdown with search showing ALL categories */}
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="All categories"
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 sm:w-auto rounded-full bg-transparent border ${selectedCategoryKeys.length > 0 ? 'border-black/40 bg-black/[0.03]' : 'border-black/10'} hover:border-black/40 hover:bg-black/[0.03] px-0 sm:px-2 text-xs md:text-sm flex items-center justify-center font-medium transition-all flex-shrink-0 relative`}
                >
                  <ListFilter className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
                  {selectedCategoryKeys.length > 0 ? (
                    <span className="hidden sm:inline ml-2 px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-black/10 font-medium">
                      {selectedCategoryKeys.length}
                    </span>
                  ) : categories.length > 0 ? (
                    <span className="hidden sm:inline ml-2 px-2 py-0.5 text-[10px] md:text-xs rounded-full bg-black/5">{categories.length}</span>
                  ) : null}
                  {/* Visual indicator dot when categories are selected */}
                  {selectedCategoryKeys.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-black border border-white" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[90vw] max-w-[360px] p-2 border border-black/10">
                <DropdownMenuLabel className="text-xs md:text-sm font-semibold">All Categories</DropdownMenuLabel>
                <div className="p-1">
                  <Input
                    placeholder="Search categories..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="border border-black/10 text-xs md:text-sm"
                  />
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-[60vh] overflow-y-auto pr-1" role="listbox" aria-label="All categories">
                  {filteredCategories.map(cat => {
                      const active = selectedCategoryKeys.includes(cat.key);
                      return (
                        <DropdownMenuItem key={cat.key} onSelect={() => onToggleCategory(cat.key)} className="cursor-pointer">
                          <div className={`inline-flex items-center gap-2 text-xs md:text-sm ${active ? 'font-medium' : ''}`}>
                            <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-black' : 'bg-gray-300'}`} />
                            <span>{cat.label}</span>
                            {typeof cat.count === 'number' && (
                              <Badge variant={active ? 'secondary' : 'outline'} className="ml-1 h-5 px-1 text-[10px] md:text-xs border-black/20">
                                {cat.count}
                              </Badge>
                            )}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  {filteredCategories.length === 0 && (
                    <div className="py-6 text-center text-xs md:text-sm text-muted-foreground">No categories found.</div>
                  )}
                </div>
                {selectedCategoryKeys.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => {
                        selectedCategoryKeys.forEach(k => onToggleCategory(k));
                      }}>
                        Clear filters
                      </Button>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default CityFilterBar;


