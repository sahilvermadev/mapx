/**
 * Geolocation utilities for getting user's current GPS coordinates
 * 
 * Used for "near me" searches - gets coordinates from browser geolocation API
 * on-demand when user searches, rather than storing them in the database.
 */

export interface GeolocationResult {
  lat: number;
  lng: number;
  accuracy?: number;
}

/**
 * Get user's current GPS coordinates from browser geolocation API
 * 
 * @param options - Geolocation options (timeout, enableHighAccuracy, etc.)
 * @returns Promise with coordinates or null if unavailable/denied
 */
export async function getCurrentLocation(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000 // Accept cached location up to 1 minute old
  }
): Promise<GeolocationResult | null> {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        // Don't throw - just return null so search can proceed without location
        resolve(null);
      },
      options
    );
  });
}

/**
 * Check if a search query indicates "near me" intent
 * 
 * @param query - Search query text
 * @returns true if query suggests location-based search
 */
export function isNearMeQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const nearMeKeywords = [
    'near me',
    'nearby',
    'close to me',
    'around me',
    'nearby places',
    'local',
    'in my area',
    'close by'
  ];
  
  return nearMeKeywords.some(keyword => lowerQuery.includes(keyword));
}



