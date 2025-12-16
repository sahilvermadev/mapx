import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { cn } from '@/lib/utils';
import { fetchWithTimeout, getNetworkErrorMessage } from '@/utils/fetchUtils';
import { MAP_CONSTANTS } from '@/constants/mapConstants';

interface LocationData {
  name: string;
  city_name?: string;
  admin1_name?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
}

interface CityLocalitySearchProps {
  selectedLocation?: LocationData | null;
  onSelect: (location: LocationData | null) => void;
  className?: string;
  placeholder?: string;
}

interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText?: string;
  types?: string[]; // For filtering
}

const CityLocalitySearch: React.FC<CityLocalitySearchProps> = ({
  selectedLocation,
  onSelect,
  className = '',
  placeholder = 'Search cities or localities...',
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  
  const sessionToken = useMemo(() => {
    // Generate a session token for autocomplete requests
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (e) {
      // crypto.randomUUID might exist but throw an error
    }
    // Fallback: generate a UUID-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  // Update search value when location is selected
  useEffect(() => {
    if (selectedLocation) {
      setSearchValue(selectedLocation.name);
    } else {
      setSearchValue('');
    }
  }, [selectedLocation]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (!apiKey) {
      return;
    }
    if (!searchValue || searchValue.length < 2) {
      setSuggestions([]);
      setError(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      if (isCancelled) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const requestBody = {
          input: searchValue,
          sessionToken,
        };
        
        const res = await fetchWithTimeout(
          'https://places.googleapis.com/v1/places:autocomplete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': '*',
            },
            body: JSON.stringify(requestBody),
            timeout: 12000, // 12 seconds timeout
            retries: 1, // Retry once on failure
            retryDelay: 500,
          }
        );

        if (isCancelled) return;

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        
        if (isCancelled) return;
        
        // Parse all suggestions
        const allSuggestions: PlaceSuggestion[] = (data?.suggestions || [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({
            placeId: p.placeId || '',
            mainText: p?.structuredFormat?.mainText?.text || p?.text?.text || '',
            secondaryText: p?.structuredFormat?.secondaryText?.text,
            types: p?.types || [],
          }));

        // Limit to 8 suggestions
        const prioritizedSuggestions = allSuggestions
          .slice(0, 8)
          .map(({ types, ...rest }) => rest);

        setSuggestions(prioritizedSuggestions);
        setError(null);
      } catch (e: any) {
        if (isCancelled) return;
        
        // Don't show error for aborted requests (user typing)
        if (e.name === 'AbortError') {
          return;
        }
        
        const errorMessage = getNetworkErrorMessage(e);
        setError(errorMessage);
        setSuggestions([]);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, MAP_CONSTANTS.DEBOUNCE_DELAY_MS); // Debounce delay

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [apiKey, searchValue, sessionToken]);

  const fetchPlaceDetails = async (placeId: string): Promise<LocationData | null> => {
    if (!apiKey) return null;

    setFetchingDetails(true);
    try {
      const res = await fetchWithTimeout(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
          },
          timeout: 10000, // 10 seconds timeout
          retries: 1,
          retryDelay: 500,
        }
      );

      if (!res.ok) {
        throw new Error('Place details fetch failed');
      }

      const data = await res.json();
      
      // Extract structured data from address components
      let city_name: string | undefined;
      let admin1_name: string | undefined;
      let country_code: string | undefined;
      
      const addressComponents = data.addressComponents || [];
      for (const comp of addressComponents) {
        const types = comp.types || [];
        // Use longText for city_name (full name), fallback to shortText
        if (!city_name && (types.includes('locality') || types.includes('postal_town'))) {
          city_name = comp.longText || comp.shortText;
        }
        // Fallback to admin level 2 if locality is absent (common in some countries)
        if (!city_name && types.includes('administrative_area_level_2')) {
          city_name = comp.longText || comp.shortText;
        }
        // Use longText for admin1_name (full state/province name)
        if (!admin1_name && types.includes('administrative_area_level_1')) {
          admin1_name = comp.longText || comp.shortText;
        }
        // Use shortText for country_code (ISO code), fallback to longText
        if (!country_code && types.includes('country')) {
          country_code = (comp.shortText || comp.longText || '').toUpperCase();
        }
      }

      const location: LocationData = {
        name: data.displayName?.text || searchValue,
        city_name,
        admin1_name,
        country_code,
        lat: data.location?.latitude,
        lng: data.location?.longitude,
      };

      return location;
    } catch (e) {
      // Return basic location data if details fetch fails
      return {
        name: searchValue,
      };
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    const location = await fetchPlaceDetails(suggestion.placeId);
    if (location) {
      onSelect(location);
      setOpen(false);
      setTimeout(() => inputRef.current?.blur(), 0);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSearchValue('');
    onSelect(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setOpen(true);
    setHighlightedIndex(-1);
    setError(null);
    // Clear selection if user starts typing
    if (selectedLocation && value !== selectedLocation.name) {
      onSelect(null);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only set open if focus is coming from outside (not from popover content)
    if (!e.relatedTarget || !containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(true);
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Ensure input gets focus on click
    if (document.activeElement !== e.currentTarget) {
      e.currentTarget.focus();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) {
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
      }
    } else if (e.key === 'Enter' && open && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Enter' && open && suggestions.length === 1) {
      e.preventDefault();
      handleSelect(suggestions[0]);
    }
  };

  // Note: We intentionally avoid a custom click-outside handler here.
  // Radix Popover already handles outside clicks via onOpenChange,
  // and adding our own listener can cause focus/flicker issues.

  const handleOpenChange = (newOpen: boolean) => {
    // Prevent Radix from closing when:
    // 1. Input is still focused (user is typing)
    // 2. Focus is within our container (input or popover content)
    if (!newOpen) {
      const isInputFocused = inputRef.current === document.activeElement;
      const isFocusInContainer = containerRef.current?.contains(document.activeElement as Node);
      
      if (isInputFocused || isFocusInContainer) {
        return; // Don't close if focus is still within our component
      }
    }
    
    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <PopoverAnchor asChild>
          <div 
            className="relative" 
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onClick={handleInputClick}
              onMouseDown={(e) => {
                // Prevent PopoverAnchor from interfering with focus
                e.stopPropagation();
                // Ensure input gets focus on mousedown (before click)
                if (document.activeElement !== e.currentTarget) {
                  e.currentTarget.focus();
                }
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholder}
              className={cn(
                "w-full h-9 sm:h-10 text-sm sm:text-base pr-10",
                className
              )}
              style={selectedTheme ? {
                backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
                borderColor: error 
                  ? (selectedTheme.textHighlight || selectedTheme.accentColor || '#EF4444')
                  : (selectedTheme.inputBorder || selectedTheme.borderColor || '#000000'),
                color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
              disabled={fetchingDetails}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {selectedLocation && searchValue === selectedLocation.name && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={handleClear}
                  style={{ color: selectedTheme?.textMuted || '#6B7280' }}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </div>
        </PopoverAnchor>
        
        <PopoverContent 
          className="p-0 w-full" 
          align="start"
          style={{
            width: containerRef.current?.offsetWidth ? `${containerRef.current.offsetWidth}px` : undefined,
            ...(selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              borderColor: selectedTheme.borderColor || '#000000',
              boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : {})
          }}
        >
          <div
            style={selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
            } : undefined}
          >
            <div 
              className="max-h-[300px] overflow-y-auto overflow-x-hidden"
              role="listbox"
            >
              {loading || fetchingDetails ? (
                <div className="py-6 text-center text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
                  {fetchingDetails ? 'Loading details...' : 'Searching...'}
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm px-4" style={{ color: selectedTheme?.textHighlight || selectedTheme?.accentColor || '#EF4444' }}>
                  {error}
                </div>
              ) : suggestions.length === 0 && searchValue.length >= 2 ? (
                <div className="py-6 text-center text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
                  No location found.
                </div>
              ) : suggestions.length === 0 ? (
                <div className="py-6 text-center text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
                  Start typing to search...
                </div>
              ) : (
                <div className="p-1">
                  {suggestions.map((suggestion, index) => {
                    const isSelected = selectedLocation?.name === suggestion.mainText;
                    const isHighlighted = index === highlightedIndex;
                    return (
                      <div
                        key={suggestion.placeId}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(suggestion)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(suggestion);
                          } else if (e.key === 'ArrowDown' && index < suggestions.length - 1) {
                            e.preventDefault();
                            setHighlightedIndex(index + 1);
                            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                            nextElement?.focus();
                          } else if (e.key === 'ArrowUp' && index > 0) {
                            e.preventDefault();
                            setHighlightedIndex(index - 1);
                            const prevElement = e.currentTarget.previousElementSibling as HTMLElement;
                            prevElement?.focus();
                          }
                        }}
                        tabIndex={0}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                          isSelected || isHighlighted
                            ? "bg-accent text-accent-foreground" 
                            : "hover:bg-accent/50"
                        )}
                        style={selectedTheme ? {
                          color: selectedTheme.textPrimary || '#000000',
                          backgroundColor: isSelected || isHighlighted
                            ? (selectedTheme.accentColor + '20' || 'rgba(0, 0, 0, 0.1)')
                            : 'transparent',
                        } : undefined}
                        onMouseEnter={(e) => {
                          setHighlightedIndex(index);
                          if (selectedTheme && !isSelected && !isHighlighted) {
                            e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || 'rgba(0, 0, 0, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTheme && !isSelected && !isHighlighted) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="flex-1 truncate">{suggestion.mainText}</span>
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                          style={selectedTheme ? {
                            color: selectedTheme.accentColor || '#000000',
                          } : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </div>
    </Popover>
  );
};

export default CityLocalitySearch;


