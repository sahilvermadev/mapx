/**
 * Constants for map-related functionality
 */

export const MAP_CONSTANTS = {
  // POI (Point of Interest) search configuration
  POI_SEARCH_RADIUS_METERS: 10,
  POI_DISTANCE_THRESHOLD_METERS: 25,

  // Map zoom levels
  DEFAULT_ZOOM: 9,
  LOCATION_ZOOM: 16,

  // Default map center (New York area)
  DEFAULT_CENTER: {
    lat: 40,
    lng: -74.5,
  },

  // Debounce and delay timings
  DEBOUNCE_DELAY_MS: 350,
  ANIMATION_DURATION_MS: 350,
  MAP_RESIZE_DELAY_MS: 350,

  // Geolocation options
  GEOLOCATION_TIMEOUT_MS: 10000,
  GEOLOCATION_MAX_AGE_MS: 60000,

  // Places service initialization fallback timeout
  PLACES_SERVICE_FALLBACK_TIMEOUT_MS: 3000,
} as const;



