import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recommendationsApi, type SearchResponse } from '@/services/recommendationsApiService';
import { getCurrentLocation } from '@/utils/geolocation';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

interface FeedAISearchProps {
  isAuthenticated: boolean;
  onResults?: (response: SearchResponse | null) => void;
  onStream?: (query: string, userLocation?: { lat: number; lng: number } | null, groupIds?: number[]) => void;
  onCleared?: () => void; // called when query is cleared
  variant?: 'top' | 'bottom';
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  filterSlot?: React.ReactNode;
}

const FeedAISearch: React.FC<FeedAISearchProps> = ({
  isAuthenticated,
  onResults,
  onStream,
  onCleared,
  variant = 'top',
  placeholder = 'Search...',
  autoFocus = false,
  className = '',
  filterSlot
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (override?: string) => {
    const raw = override ?? query;
    const trimmed = raw.trim();
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
    
    if (override !== undefined) {
      setQuery(override);
    }
    setLoading(true);
    setError(null);

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
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }
        console.warn('⚠️ Failed to get GPS coordinates:', locationError);
        // Continue without location - search will still work
      }

      // Check if request was aborted before making API call
      if (abortController.signal.aborted) {
        return;
      }

      // Use streaming if onStream is provided, otherwise use regular search
      if (onStream) {
        onStream(trimmed, userLocation, undefined);
        // Clear query after initiating stream search
        setQuery('');
      } else {
      const res = await recommendationsApi.semanticSearch(
        trimmed,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        'fast',
          userLocation,
          abortController.signal
        );
        
        // Check if request was aborted after API call
        if (abortController.signal.aborted) {
          return;
        }
        
      onResults?.(res);
        // Clear query after getting results
        setQuery('');
      }
    } catch (err) {
      // Don't show error if request was aborted
      if (abortController.signal.aborted) {
        return;
      }
      setError('Search failed. Please try again.');
      onResults?.(null);
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
      setLoading(false);
    }
    }
  }, [isAuthenticated, onResults, onStream, query]);
  
  // Cleanup: abort any in-flight requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSearch = useCallback((e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    runSearch();
  }, [runSearch]);

  useEffect(() => {
    const handleExternalSubmit = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (typeof custom.detail === 'string' && custom.detail.trim().length > 0) {
        runSearch(custom.detail);
      }
    };

    window.addEventListener('feed-search:submit', handleExternalSubmit as EventListener);
    return () => window.removeEventListener('feed-search:submit', handleExternalSubmit as EventListener);
  }, [runSearch]);

  const shellClasses =
    variant === 'bottom'
      ? 'rounded-[32px] border backdrop-blur text-foreground h-16 px-6 flex items-center gap-3 shadow-sm'
      : 'rounded-full border text-foreground h-12 md:h-14 px-5 md:px-6 flex items-center gap-3 shadow-sm';
  
  const shellStyle: React.CSSProperties = (() => {
    if (!selectedTheme) {
      return variant === 'bottom' 
        ? { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: 'rgba(0, 0, 0, 0.1)' }
        : { backgroundColor: '#FFFFFF', borderColor: 'rgba(0, 0, 0, 0.1)' };
    }
    const bgColor = selectedTheme.inputBackground || selectedTheme.cardBackground;
    // Convert hex to rgba for opacity
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return {
      backgroundColor: variant === 'bottom' 
        ? `rgba(${r}, ${g}, ${b}, 0.95)` // 95% opacity for bottom variant
        : bgColor,
      borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)',
      color: selectedTheme.inputText || selectedTheme.textPrimary,
    };
  })();

  // Create a unique ID for this component instance to scope the placeholder styles
  const inputId = `feed-ai-search-input-${variant}`;

  return (
    <div className={`w-full ${className}`}>
      {/* Placeholder color styling */}
      {selectedTheme && (
        <style>{`
          #${inputId}::placeholder {
            color: ${selectedTheme.inputPlaceholder || selectedTheme.textMuted || '#9CA3AF'};
            opacity: 1;
          }
        `}</style>
      )}
      {/* Pill search bar */}
      <form 
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSearch(e);
        }}
      >
        <div className={shellClasses} style={shellStyle}>
          <input
            id={inputId}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.trim() === '') {
                if (variant !== 'bottom') {
                onCleared?.();
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSearch(e);
              }
            }}
            disabled={!isAuthenticated || loading}
            className={`flex-1 bg-transparent outline-none ${
              variant === 'bottom' ? 'text-base font-normal' : 'text-sm md:text-base font-normal'
            }`}
            style={{
              color: selectedTheme?.inputText || selectedTheme?.textPrimary || 'inherit',
            }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={autoFocus}
          />

          <Button
            type="button"
            size="icon"
            className={`${
              variant === 'bottom'
                ? 'h-12 w-12 rounded-full'
                : 'h-9 w-9 md:h-10 md:w-10 rounded-full'
            }`}
            style={selectedTheme ? {
              backgroundColor: selectedTheme.buttonPrimary.background || '#000000',
              color: selectedTheme.buttonPrimary.text || '#FFFFFF',
            } : {
              backgroundColor: variant === 'bottom' ? '#111827' : '#000000',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary.hover || selectedTheme.buttonPrimary.background || '#000000';
              } else {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary.background || '#000000';
              } else {
                e.currentTarget.style.backgroundColor = variant === 'bottom' ? '#111827' : '#000000';
              }
            }}
            disabled={!query.trim() || loading || !isAuthenticated}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSearch();
            }}
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <ArrowUp className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
            )}
          </Button>
        </div>
        {filterSlot && (
          <div className={`mt-3 ${variant === 'bottom' ? 'px-1' : 'px-1'}`}>
            {filterSlot}
          </div>
        )}
      </form>

      {error && (
        <div className="text-sm text-destructive mt-2">{error}</div>
      )}

    </div>
  );
};

export default FeedAISearch;








