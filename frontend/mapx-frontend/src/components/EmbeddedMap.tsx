import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader } from '@googlemaps/js-api-loader';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { placesApiService } from '../services/placesApiService';
import { getPrimaryGoogleType } from '../utils/placeTypes';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import PlaceConfirmationCard from './PlaceConfirmationCard';
import { MAP_CONSTANTS } from '@/constants/mapConstants';

interface AddressComponent {
  types?: string[];
  longName?: string;
  long_name?: string;
  shortName?: string;
  short_name?: string;
}

interface EmbeddedMapProps {
  onPlaceSelected: (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
  }) => void;
  height?: string;
}

const EmbeddedMap: React.FC<EmbeddedMapProps> = ({ 
  onPlaceSelected,
  height = '500px'
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  const mapContainer = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const selectedMarker = useRef<google.maps.Marker | null>(null);
  const userLocationMarker = useRef<google.maps.Marker | null>(null);
  const accuracyCircle = useRef<google.maps.Circle | null>(null);
  const placesServiceInitialized = useRef<boolean>(false);
  const fallbackTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showConfirmationCard, setShowConfirmationCard] = useState(false);
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [selectedPlaceForConfirmation, setSelectedPlaceForConfirmation] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
    image?: string;
  } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const loader = new Loader({ 
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, 
          version: 'weekly', 
          libraries: ['places', 'geometry'] 
        });

        const google = await loader.load();
        
        if (!mapContainer.current) return;

        const customMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '95079f4fa5e07d01680ea67e';
        const mapConfig: google.maps.MapOptions = {
          center: MAP_CONSTANTS.DEFAULT_CENTER,
          zoom: MAP_CONSTANTS.DEFAULT_ZOOM,
          clickableIcons: true,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: false,
          rotateControl: false,
          gestureHandling: 'greedy',
          disableDefaultUI: false,
          mapId: customMapId,
        };

        map.current = new google.maps.Map(mapContainer.current, mapConfig);

        // Get user location and center map
        getUserLocation(google);

        // Initialize places service after map is ready
        google.maps.event.addListenerOnce(map.current, 'idle', () => {
          if (!placesServiceInitialized.current && map.current) {
            try {
              placesService.current = new google.maps.places.PlacesService(map.current);
              placesServiceInitialized.current = true;
              setupMapClickHandler(google);
              setIsLoading(false);
              setMapReady(true);
            } catch (err) {
              // Places service initialization failed - map still works, just without place search
              setIsLoading(false);
              setMapReady(true);
              // Don't show error to user as map is still functional
            }
          }
        });

        // Fallback timeout
        fallbackTimeoutIdRef.current = setTimeout(() => {
          if (!placesServiceInitialized.current && !placesService.current && map.current) {
            try {
              placesService.current = new google.maps.places.PlacesService(map.current);
              placesServiceInitialized.current = true;
              setupMapClickHandler(google);
              setIsLoading(false);
              setMapReady(true);
            } catch (err) {
              // Fallback initialization failed - map still works
              setIsLoading(false);
              setMapReady(true);
            }
          }
        }, MAP_CONSTANTS.PLACES_SERVICE_FALLBACK_TIMEOUT_MS);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError('Failed to load map. Please check your internet connection and try again.');
        setIsLoading(false);
      }
    };

    void initMap();

    return () => {
      // Clear fallback timeout if it exists
      if (fallbackTimeoutIdRef.current) {
        clearTimeout(fallbackTimeoutIdRef.current);
        fallbackTimeoutIdRef.current = null;
      }
      if (selectedMarker.current) {
        selectedMarker.current.setMap(null);
      }
      if (userLocationMarker.current) {
        userLocationMarker.current.setMap(null);
      }
      if (accuracyCircle.current) {
        accuracyCircle.current.setMap(null);
      }
      if (autocomplete.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete.current);
      }
      // Reset initialization flag on cleanup
      placesServiceInitialized.current = false;
      setMapReady(false);
    };
  }, []);

  // Check mobile on resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get user location and center map
  const getUserLocation = useCallback((google: typeof globalThis.google) => {
    if (!navigator.geolocation) {
      // If geolocation not available, keep default center
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const userLocation = new google.maps.LatLng(latitude, longitude);
        
        if (map.current) {
          map.current.setCenter(userLocation);
          map.current.setZoom(MAP_CONSTANTS.LOCATION_ZOOM);
          
          // Create user location marker with green circle icon (same as MapPage)
          if (userLocationMarker.current) {
            userLocationMarker.current.setMap(null);
          }
          
          userLocationMarker.current = new google.maps.Marker({
            position: userLocation,
            map: map.current,
            title: 'Your location',
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#10b981"/>
                  <circle cx="12" cy="12" r="4" fill="white"/>
                </svg>
              `)}`,
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12)
            },
            zIndex: 2000 // High z-index to appear above other markers
          });
          
          // Create accuracy circle for high accuracy locations
          if (accuracy < 1000) {
            if (accuracyCircle.current) {
              accuracyCircle.current.setMap(null);
            }
            
            accuracyCircle.current = new google.maps.Circle({
              strokeColor: '#10b981',
              strokeOpacity: 0.5,
              strokeWeight: 1.5,
              fillColor: '#10b981',
              fillOpacity: 0.08,
              map: map.current,
              center: userLocation,
              radius: accuracy,
              zIndex: 1000
            });
          }
        }
      },
      (error) => {
        // Geolocation failed - silently fall back to default center
        // This is expected behavior if user denies location permission
        // No need to show error as map still works with default center
      },
      {
        enableHighAccuracy: true,
        timeout: MAP_CONSTANTS.GEOLOCATION_TIMEOUT_MS,
        maximumAge: MAP_CONSTANTS.GEOLOCATION_MAX_AGE_MS
      }
    );
  }, []);

  // Handle reverse geocoding for locations without places
  const handleReverseGeocode = useCallback(async (latLng: google.maps.LatLng, google: typeof globalThis.google) => {
    // Clear any previous errors
    setError(null);

    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const result = results[0];
          const address = result.formatted_address || '';
          
          // Extract address components
          let city_name: string | undefined;
          let admin1_name: string | undefined;
          let country_code: string | undefined;
          
          result.address_components?.forEach(comp => {
            const types = comp.types || [];
            if (!city_name && (types.includes('locality') || types.includes('postal_town'))) {
              city_name = comp.long_name || comp.short_name;
            }
            if (!admin1_name && types.includes('administrative_area_level_1')) {
              admin1_name = comp.long_name || comp.short_name;
            }
            if (!country_code && types.includes('country')) {
              country_code = (comp.short_name || comp.long_name || '').toUpperCase();
            }
          });

          // Show confirmation card for reverse geocoded locations too
          setSelectedPlaceForConfirmation({
            name: address.split(',')[0] || 'Selected Location',
            address,
            lat: latLng.lat(),
            lng: latLng.lng(),
            city_name,
            admin1_name,
            country_code,
          });
          setShowConfirmationCard(true);
        } else {
          // Geocoding failed - show error to user
          setError('Unable to get address for this location. Please try selecting a different place.');
        }
      });
    } catch (err) {
      setError('Unable to get address for this location. Please try selecting a different place.');
    }
  }, []);

  // Handle place selection from autocomplete or map click
  const handlePlaceSelection = useCallback(async (place: google.maps.places.PlaceResult) => {
    if (!place.geometry || !place.place_id) return;

    // Clear any previous errors
    setError(null);

    try {
      // Get enhanced details for better address components
      const enhancedDetails = await placesApiService.getPlaceDetails(place.place_id);
      
      const lat = place.geometry.location?.lat();
      const lng = place.geometry.location?.lng();
      
      if (!lat || !lng) return;

      // Extract address components
      let city_name: string | undefined;
      let admin1_name: string | undefined;
      let country_code: string | undefined;
      
      const addressComponents = (enhancedDetails?.addressComponents || place.address_components || []) as AddressComponent[];
      addressComponents.forEach((comp: AddressComponent) => {
        const types = comp.types || [];
        if (!city_name && (types.includes('locality') || types.includes('postal_town'))) {
          city_name = comp.longName || comp.long_name || comp.shortName || comp.short_name;
        }
        if (!admin1_name && types.includes('administrative_area_level_1')) {
          admin1_name = comp.longName || comp.long_name || comp.shortName || comp.short_name;
        }
        if (!country_code && types.includes('country')) {
          country_code = (comp.shortName || comp.short_name || comp.longName || comp.long_name || '').toUpperCase();
        }
      });

      // Get place image if available - request higher resolution for sharpness
      let placeImage: string | undefined;
      if (enhancedDetails?.photos && enhancedDetails.photos.length > 0) {
        placeImage = `https://places.googleapis.com/v1/${enhancedDetails.photos[0].name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=1200`;
      } else if (place.photos && place.photos.length > 0) {
        placeImage = place.photos[0].getUrl({ maxWidth: 1200 });
      }

      const placeName = enhancedDetails?.displayName?.text || place.name || 'Unknown Place';
      const placeAddress = enhancedDetails?.formattedAddress || place.formatted_address || '';

      // Update marker
      if (selectedMarker.current) {
        selectedMarker.current.setMap(null);
      }

      if (map.current) {
        selectedMarker.current = new google.maps.Marker({
          position: { lat, lng },
          map: map.current,
          animation: google.maps.Animation.DROP,
        });

        // Pan to selected place
        map.current.panTo({ lat, lng });
        map.current.setZoom(16);
      }

      // Show confirmation card instead of immediately calling onPlaceSelected
      setSelectedPlaceForConfirmation({
        name: placeName,
        address: placeAddress,
        lat,
        lng,
        google_place_id: place.place_id,
        city_name,
        admin1_name,
        country_code,
        image: placeImage,
      });
      setShowConfirmationCard(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      // Check if it's a network error
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('timeout')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Failed to get place details. Please try selecting the place again.');
      }
    }
  }, []);

  // Setup map click handler to find places
  const setupMapClickHandler = useCallback((google: typeof globalThis.google) => {
    if (!map.current || !placesService.current) return;

    map.current.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !placesService.current) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      try {
        // Search for places near the clicked location
        const request: google.maps.places.PlaceSearchRequest = {
          location: e.latLng,
          radius: MAP_CONSTANTS.POI_SEARCH_RADIUS_METERS,
          type: 'establishment',
        };

        placesService.current.nearbySearch(request, async (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            const place = results[0];
            
            // Calculate distance to clicked point
            const placeLocation = place.geometry?.location;
            if (!placeLocation) return;

            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              e.latLng,
              placeLocation
            );

            // Only select if place is close enough
            if (distance <= MAP_CONSTANTS.POI_DISTANCE_THRESHOLD_METERS) {
              await handlePlaceSelection(place);
            } else {
              // If no place found nearby, use reverse geocoding
              handleReverseGeocode(e.latLng, google);
            }
            
            // Add marker for clicked location
            if (selectedMarker.current) {
              selectedMarker.current.setMap(null);
            }
            if (map.current) {
              selectedMarker.current = new google.maps.Marker({
                position: e.latLng,
                map: map.current,
                animation: google.maps.Animation.DROP,
              });
            }
          } else {
            // If no place found, use reverse geocoding
            handleReverseGeocode(e.latLng, google);
          }
        });
      } catch (err) {
        // Error finding place - fall back to reverse geocoding
        handleReverseGeocode(e.latLng, google);
      }
    });
  }, [handlePlaceSelection, handleReverseGeocode]);

  // Initialize autocomplete when map is ready
  useEffect(() => {
    if (!searchInputRef.current || !map.current || !mapReady) return;

    const g = window.google;
    if (!g?.maps?.places?.Autocomplete) return;

    // Clean up previous autocomplete
    if (autocomplete.current) {
      g.maps.event.clearInstanceListeners(autocomplete.current);
      autocomplete.current = null;
    }

    // Clear any previous errors when starting new search
    setError(null);

    // Initialize autocomplete
    autocomplete.current = new g.maps.places.Autocomplete(searchInputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['place_id', 'geometry', 'name', 'formatted_address', 'types', 'address_components'],
    });

    const placeChangedHandler = () => {
      const place = autocomplete.current?.getPlace();
      if (place && place.geometry && place.place_id) {
        handlePlaceSelection(place);
      }
    };

    autocomplete.current.addListener('place_changed', placeChangedHandler);

    return () => {
      if (autocomplete.current && g?.maps?.event) {
        g.maps.event.clearInstanceListeners(autocomplete.current);
      }
      autocomplete.current = null;
    };
  }, [mapReady, handlePlaceSelection]);

  // Handle place confirmation
  const handleConfirmPlace = useCallback(() => {
    if (selectedPlaceForConfirmation) {
      onPlaceSelected({
        name: selectedPlaceForConfirmation.name,
        address: selectedPlaceForConfirmation.address,
        lat: selectedPlaceForConfirmation.lat,
        lng: selectedPlaceForConfirmation.lng,
        google_place_id: selectedPlaceForConfirmation.google_place_id,
        city_name: selectedPlaceForConfirmation.city_name,
        admin1_name: selectedPlaceForConfirmation.admin1_name,
        country_code: selectedPlaceForConfirmation.country_code,
      });
      setShowConfirmationCard(false);
      setSelectedPlaceForConfirmation(null);
    }
  }, [selectedPlaceForConfirmation, onPlaceSelected]);

  // Handle change place
  const handleChangePlace = useCallback(() => {
    setShowConfirmationCard(false);
    setSelectedPlaceForConfirmation(null);
    // Remove selected marker to allow selecting different place
    if (selectedMarker.current) {
      selectedMarker.current.setMap(null);
      selectedMarker.current = null;
    }
    // Trigger map resize to return to full width
    setTimeout(() => {
      if (map.current) {
        window.google?.maps?.event?.trigger(map.current, 'resize');
      }
    }, 100);
  }, []);

  // Handle map resize when layout changes
  useEffect(() => {
    if (map.current && showConfirmationCard) {
      // Trigger resize after a short delay to ensure layout has updated
      const timer = setTimeout(() => {
        if (map.current && window.google?.maps?.event) {
          window.google.maps.event.trigger(map.current, 'resize');
          // Re-center on selected place if available
          if (selectedPlaceForConfirmation) {
            map.current.panTo({
              lat: selectedPlaceForConfirmation.lat,
              lng: selectedPlaceForConfirmation.lng,
            });
          }
        }
      }, MAP_CONSTANTS.MAP_RESIZE_DELAY_MS); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [showConfirmationCard, selectedPlaceForConfirmation]);

  const isSplitLayout = showConfirmationCard && selectedPlaceForConfirmation;

  return (
    <div className="relative w-full flex flex-col" style={{ height }}>
      {/* Search Bar - Full width above both sections, floating on mobile when place selected */}
      <div className={`relative mb-3 md:mb-4 z-10 flex-shrink-0 ${isSplitLayout ? 'md:static absolute top-4 left-0 right-0 md:top-auto md:left-auto md:right-auto px-4 md:px-0' : 'px-0'}`}>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10"
            style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#9CA3AF' }}
          />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a place..."
            className={`pl-10 pr-4 py-3 md:py-2.5 text-sm md:text-base rounded-xl md:rounded-lg border-0 md:border-2 ${isSplitLayout ? 'md:shadow-lg shadow-xl' : 'shadow-lg md:shadow-lg'}`}
            style={{
              backgroundColor: selectedTheme?.cardBackground || (isMobile ? '#374151' : '#FFFFFF'),
              borderColor: selectedTheme?.borderColor || '#000000',
              color: selectedTheme?.textPrimary || (isMobile ? '#FFFFFF' : '#000000'),
            }}
          />
          <style>{`
            input::placeholder {
              color: ${selectedTheme?.textMuted || selectedTheme?.textSecondary || (isMobile ? '#9CA3AF' : '#6B7280')} !important;
            }
          `}</style>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-opacity-90 z-20"
          style={{
            backgroundColor: selectedTheme?.backgroundColor || '#F3F4F6',
          }}
        >
          <div className="text-center">
            <div 
              className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent mx-auto mb-2"
              style={{
                borderColor: selectedTheme?.borderColor || '#000000',
                borderTopColor: 'transparent',
              }}
            ></div>
            <p 
              className="text-sm"
              style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
            >
              Loading map...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-20 left-4 right-4 z-20 border-2 rounded-lg p-3 flex items-start justify-between gap-2 shadow-lg"
          style={{
            backgroundColor: selectedTheme?.cardBackground || '#FEF2F2',
            borderColor: selectedTheme?.borderColor || '#FECACA',
          }}
        >
          <p 
            className="text-sm flex-1"
            style={{ color: selectedTheme?.textPrimary || '#991B1B' }}
          >
            {error}
          </p>
          <button
            onClick={() => setError(null)}
            className="flex-shrink-0 text-sm font-medium hover:opacity-70 transition-opacity"
            style={{ color: selectedTheme?.textPrimary || '#991B1B' }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* Main Content Area - Split or Full Layout */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-4 min-h-0 relative">
        {/* Desktop: Confirmation Card - Primary on left */}
        {isSplitLayout && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="hidden md:flex flex-col min-h-0 md:w-[65%] md:max-w-[65%]"
          >
            <PlaceConfirmationCard
              place={selectedPlaceForConfirmation}
              onSelect={handleConfirmPlace}
            />
          </motion.div>
        )}

        {/* Map Container - Full screen on mobile, split on desktop */}
        <motion.div
          initial={false}
          animate={{
            width: isSplitLayout ? '100%' : '100%',
            flexBasis: isSplitLayout ? undefined : '100%',
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`min-h-0 ${isSplitLayout ? 'md:w-[35%] md:max-w-[35%] md:flex-1' : 'flex-1 w-full'}`}
        >
          <div 
            ref={mapContainer} 
            className="w-full h-full rounded-lg border-2 min-h-[300px] md:min-h-[400px]" 
            style={{ 
              borderColor: selectedTheme?.borderColor || '#000000',
            }} 
          />
        </motion.div>

        {/* Mobile: Bottom Sheet for Place Confirmation */}
        {isSplitLayout && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/40 z-30"
              onClick={handleChangePlace}
            />
            
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ 
                type: 'spring',
                damping: 30,
                stiffness: 300
              }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl border-t-2 max-h-[85vh] flex flex-col safe-area-inset-bottom"
              style={{
                backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
                borderColor: selectedTheme?.borderColor || '#000000',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                <div 
                  className="w-12 h-1.5 rounded-full"
                  style={{
                    backgroundColor: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#D1D5DB',
                  }}
                />
              </div>

              {/* Place Card Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <PlaceConfirmationCard
                  place={selectedPlaceForConfirmation}
                  onSelect={handleConfirmPlace}
                />
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmbeddedMap;

