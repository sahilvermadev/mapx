import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { placesApiService } from '../services/placesApi';
import { recommendationsApi, type SearchResponse, type ReviewedPlace } from '../services/recommendations';
import { useAuth } from '../hooks/useAuth';
import LoginModal from '../components/LoginModal';
import ContentCard from '../components/ContentCard';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';
import type { PlaceDetails } from '../components/ContentCard';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import './MapPage.css';

// Constants
const DEFAULT_CENTER = { lat: 40, lng: -74.5 };
const DEFAULT_ZOOM = 9;
const POI_SEARCH_RADIUS = 10; // meters
const POI_DISTANCE_THRESHOLD = 25; // meters
const LOCATION_ZOOM = 16;
const TARGET_ZOOM = 25;



// Helper functions
const getCategoryFromTypes = (types: string[]): string => {
  // Map common place types to categories
  if (types.includes('restaurant')) return 'restaurant';
  if (types.includes('bar')) return 'bar';
  if (types.includes('cafe')) return 'cafe';
  if (types.includes('hotel')) return 'hotel';
  if (types.includes('park')) return 'park';
  if (types.includes('museum')) return 'museum';
  if (types.includes('shopping_mall')) return 'shopping';
  if (types.includes('store')) return 'store';
  if (types.includes('gas_station')) return 'gas_station';
  if (types.includes('hospital')) return 'hospital';
  if (types.includes('school')) return 'school';
  if (types.includes('university')) return 'university';
  if (types.includes('bank')) return 'bank';
  if (types.includes('atm')) return 'atm';
  if (types.includes('pharmacy')) return 'pharmacy';
  if (types.includes('post_office')) return 'post_office';
  if (types.includes('police')) return 'police';
  if (types.includes('fire_station')) return 'fire_station';
  if (types.includes('church')) return 'church';
  if (types.includes('mosque')) return 'mosque';
  if (types.includes('synagogue')) return 'synagogue';
  if (types.includes('temple')) return 'temple';
  if (types.includes('movie_theater')) return 'movie_theater';
  if (types.includes('stadium')) return 'stadium';
  if (types.includes('gym')) return 'gym';
  if (types.includes('spa')) return 'spa';
  if (types.includes('beauty_salon')) return 'beauty_salon';
  if (types.includes('car_rental')) return 'car_rental';
  if (types.includes('car_dealer')) return 'car_dealer';
  if (types.includes('car_repair')) return 'car_repair';
  if (types.includes('dentist')) return 'dentist';
  if (types.includes('doctor')) return 'doctor';
  if (types.includes('veterinary_care')) return 'veterinary_care';
  if (types.includes('library')) return 'library';
  if (types.includes('tourist_attraction')) return 'tourist_attraction';
  if (types.includes('amusement_park')) return 'amusement_park';
  if (types.includes('aquarium')) return 'aquarium';
  if (types.includes('art_gallery')) return 'art_gallery';
  if (types.includes('bowling_alley')) return 'bowling_alley';
  if (types.includes('casino')) return 'casino';
  if (types.includes('night_club')) return 'night_club';
  if (types.includes('parking')) return 'parking';
  if (types.includes('subway_station')) return 'subway_station';
  if (types.includes('train_station')) return 'train_station';
  if (types.includes('bus_station')) return 'bus_station';
  if (types.includes('airport')) return 'airport';
  
  // Default fallback
  return 'point_of_interest';
};

const createPlaceDetails = (
  place: google.maps.places.PlaceResult,
  enhancedDetails: any,
  latLng: google.maps.LatLng
): PlaceDetails => ({
  id: place.place_id || `poi-${Date.now()}`,
  name: enhancedDetails?.displayName?.text || place.name || 'Unknown place',
  address: enhancedDetails?.formattedAddress || place.vicinity || '',
  category: getCategoryFromTypes(place.types || []),
  userRating: 0,
  friendsRating: enhancedDetails?.rating || place.rating || 0,
  images: enhancedDetails?.photos?.slice(0, 3).map((photo: any) => 
    `https://places.googleapis.com/v1/${photo.name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`
  ) || place.photos?.slice(0, 3).map((photo: google.maps.places.PlacePhoto) => photo.getUrl()) || [],
  isLiked: false,
  isSaved: false,
  latitude: place.geometry?.location?.lat() || latLng.lat(),
  longitude: place.geometry?.location?.lng() || latLng.lng(),
  google_place_id: place.place_id,
});

const MapPage: React.FC = () => {
  // Authentication state
  const {
    isAuthenticated,
    isChecking: isAuthChecking,
    user,
    showLoginModal,
    logout,
    closeLoginModal,
  } = useAuth();

  // Component state
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [showContentCard, setShowContentCard] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [reviewedPlaces, setReviewedPlaces] = useState<ReviewedPlace[]>([]);
  const [reviewedPlacesLoading, setReviewedPlacesLoading] = useState(false);
  const [reviewedPlacesError, setReviewedPlacesError] = useState<string | null>(null);
  const [showReviewedPlaces, setShowReviewedPlaces] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(9);

  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const accuracyCircle = useRef<google.maps.Circle | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const reviewedPlacesMarkers = useRef<google.maps.Marker[]>([]);

  // Event handlers
  const handleSemanticSearch = async (query: string): Promise<SearchResponse> => {
    try {
      const results = await recommendationsApi.semanticSearch(query);
      return results;
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  };

  const handleSearchResults = (results: SearchResponse) => {
    setSearchResults(results);
  };

  const handleSearchLoading = (loading: boolean) => {
    setIsSearching(loading);
  };

  const handleSearchClose = () => {
    setSearchResults(null);
  };

  const handleSearchPlaceSelect = (place: any) => {
    const placeDetails: PlaceDetails = {
      id: place.place_id || place.place_id?.toString() || `search-${place.place_id}`,
      name: place.place_name,
      address: place.place_address || '',
      category: 'point_of_interest',
      userRating: 0,
      friendsRating: place.recommendations?.[0]?.rating || 0,
      personalReview: '',
      images: [],
      isLiked: false,
      isSaved: false,
      latitude: place.place_lat,
      longitude: place.place_lng,
      google_place_id: place.google_place_id,
    };

    setSelectedPlace(placeDetails);
    setShowContentCard(true);
    setSearchResults(null);
  };

  const handleLogout = () => logout();

  const handleLocateMe = () => {
    if (!map.current) return;
    
    setIsLocating(true);
    
    if (accuracyCircle.current) {
      accuracyCircle.current.setMap(null);
      accuracyCircle.current = null;
    }

    getUserLocation(window.google);
  };

  const handlePlaceSelected = (place: PlaceDetails) => {
    if (!map.current) return;

    if (!place.latitude || !place.longitude || 
        place.latitude === 0 || place.longitude === 0) {
      console.warn('No valid coordinates for place:', place.name);
      return;
    }

    const location = new google.maps.LatLng(place.latitude, place.longitude);
    map.current.panTo(location);
    
    const currentZoom = map.current.getZoom() || 10;
    const zoomSteps = 20;
    const zoomInterval = 15;
    let currentStep = 0;
    
    const zoomAnimation = setInterval(() => {
      currentStep++;
      const progress = currentStep / zoomSteps;
      const currentZoomLevel = currentZoom + (TARGET_ZOOM - currentZoom) * progress;
      
      map.current?.setZoom(Math.round(currentZoomLevel));
      
      if (currentStep >= zoomSteps) {
        clearInterval(zoomAnimation);
      }
    }, zoomInterval);

    setSelectedPlace(place);
    setShowContentCard(true);
  };

  // Helper functions
  const getUserLocation = (google: typeof globalThis.google) => {
    if (!navigator.geolocation) {
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const userLocation = new google.maps.LatLng(latitude, longitude);
        
        map.current?.setCenter(userLocation);
        map.current?.setZoom(LOCATION_ZOOM);
        
        if (accuracy < 1000) {
          accuracyCircle.current = new google.maps.Circle({
            strokeColor: '#22d3ee',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#22d3ee',
            fillOpacity: 0.1,
            map: map.current,
            center: userLocation,
            radius: accuracy,
          });
        }
        
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Function to create markers for reviewed places
  const createReviewedPlacesMarkers = (places: ReviewedPlace[]) => {
    if (!map.current || !window.google) return;

    // Clear existing markers
    reviewedPlacesMarkers.current.forEach(marker => marker.setMap(null));
    reviewedPlacesMarkers.current = [];

    places.forEach(place => {
      if (!place.lat || !place.lng) return;

      const position = new google.maps.LatLng(place.lat, place.lng);
      
      // Create custom marker with collision behavior
      const marker = new google.maps.Marker({
        position,
        map: map.current,
        title: `${place.name} (${place.review_count} reviews, ${place.average_rating.toFixed(1)}★)`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
                </filter>
              </defs>
              <circle cx="14" cy="14" r="12" fill="${place.average_rating >= 4.5 ? '#22c55e' : place.average_rating >= 3.5 ? '#eab308' : '#ef4444'}" stroke="white" stroke-width="2" filter="url(#shadow)"/>
              <text x="14" y="18" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="Arial, sans-serif">${place.review_count}</text>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14)
        },
        zIndex: 1000, // Higher z-index for reviewed places
        collisionBehavior: google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL
      });

      // Add click listener to marker
      marker.addListener('click', async () => {
        try {
          console.log('Marker clicked for place:', place.name, 'Google Place ID:', place.google_place_id);
          
          // If we have a Google Place ID, fetch enhanced details
          let enhancedDetails = null;
          let images: string[] = [];
          let category = place.category_name || place.metadata?.category || 'point_of_interest';
          
          if (place.google_place_id) {
            try {
              console.log('Fetching enhanced details for Google Place ID:', place.google_place_id);
              enhancedDetails = await getEnhancedPlaceDetails(place.google_place_id);
              console.log('Enhanced details received:', enhancedDetails);
              
              // Only get category from Google Places API if we don't have it in database
              if (!place.category_name && enhancedDetails?.types && enhancedDetails.types.length > 0) {
                category = enhancedDetails.types[0]; // Use the first type as category
                console.log('Category from Google Places API:', category);
              }
              
              if (enhancedDetails?.photos && enhancedDetails.photos.length > 0) {
                images = enhancedDetails.photos.slice(0, 3).map((photo: any) => {
                  const imageUrl = `https://places.googleapis.com/v1/${photo.name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`;
                  console.log('Generated image URL:', imageUrl);
                  return imageUrl;
                });
                console.log('Generated images array:', images);
              } else {
                console.log('No photos found in enhanced details');
              }
            } catch (error) {
              console.warn('Could not fetch enhanced details for place:', place.name, error);
            }
          } else if (place.lat && place.lng) {
            // Fallback: try to find the place using nearby search
            try {
              console.log('No Google Place ID, trying nearby search for:', place.name);
              const nearbyResponse = await placesApiService.nearbySearch({
                location: { latitude: place.lat, longitude: place.lng },
                radius: 100, // Small radius to find the exact place
                maxResultCount: 5
              });
              
              // Find the closest match by name
              const closestMatch = nearbyResponse.places.find(p => 
                p.displayName.text.toLowerCase().includes(place.name.toLowerCase()) ||
                place.name.toLowerCase().includes(p.displayName.text.toLowerCase())
              );
              
              if (closestMatch) {
                // Only get category from nearby search if we don't have it in database
                if (!place.category_name && closestMatch.types && closestMatch.types.length > 0) {
                  category = closestMatch.types[0];
                  console.log('Category from nearby search:', category);
                }
                
                if (closestMatch.photos && closestMatch.photos.length > 0) {
                  images = closestMatch.photos.slice(0, 3).map((photo: any) => {
                    const imageUrl = `https://places.googleapis.com/v1/${photo.name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`;
                    console.log('Generated image URL from nearby search:', imageUrl);
                    return imageUrl;
                  });
                  console.log('Generated images array from nearby search:', images);
                }
              }
            } catch (error) {
              console.warn('Could not find place via nearby search:', place.name, error);
            }
          } else {
            console.log('No Google Place ID or coordinates available for place:', place.name);
          }

          const placeDetails: PlaceDetails = {
            id: place.id.toString(),
            name: place.name,
            address: place.address || '',
            category: category, // Use the determined category
            userRating: 0,
            friendsRating: place.average_rating,
            personalReview: '',
            images: images, // Use fetched images
            isLiked: false,
            isSaved: false,
            latitude: place.lat,
            longitude: place.lng,
            google_place_id: place.google_place_id,
          };

          console.log('Setting place details with images:', placeDetails);
          setSelectedPlace(placeDetails);
          setShowContentCard(true);
        } catch (error) {
          console.error('Error handling marker click:', error);
          
          // Fallback to basic place details without images
          const placeDetails: PlaceDetails = {
            id: place.id.toString(),
            name: place.name,
            address: place.address || '',
            category: place.category_name || place.metadata?.category || 'point_of_interest', // Use fallback category
            userRating: 0,
            friendsRating: place.average_rating,
            personalReview: '',
            images: [],
            isLiked: false,
            isSaved: false,
            latitude: place.lat,
            longitude: place.lng,
            google_place_id: place.google_place_id,
          };

          setSelectedPlace(placeDetails);
          setShowContentCard(true);
        }
      });

      reviewedPlacesMarkers.current.push(marker);
    });

    // Add zoom-based visibility control
    const updateMarkerVisibility = () => {
      if (!map.current) return;
      
      const zoom = map.current.getZoom() || 0;
      const isVisible = showReviewedPlaces && zoom >= 12; // Only show markers at zoom level 12 and higher
      
      reviewedPlacesMarkers.current.forEach(marker => {
        marker.setMap(isVisible ? map.current : null);
      });
    };

    // Set initial visibility
    updateMarkerVisibility();

    // Add zoom change listener
    map.current.addListener('zoom_changed', updateMarkerVisibility);
  };

  // Function to setup POI click handler with improved collision behavior
  const setupPOIClickHandler = (google: typeof globalThis.google) => {
    if (!map.current) return;

    map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.stop) {
        e.stop();
      }
      
      if (!e.latLng || !map.current) return;
      
      const request: google.maps.places.PlaceSearchRequest = {
        location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
        radius: POI_SEARCH_RADIUS,
        type: 'establishment'
      };

      if (placesService.current) {
        placesService.current.nearbySearch(request, async (placeResults, placeStatus) => {
          if (placeStatus === google.maps.places.PlacesServiceStatus.OK && placeResults && placeResults.length > 0) {
            const closestPlace = findClosestPlace(placeResults, e.latLng!, google);
            
            if (closestPlace && closestPlace.distance <= POI_DISTANCE_THRESHOLD) {
              const enhancedDetails = await getEnhancedPlaceDetails(closestPlace.place.place_id);
              const placeDetails = createPlaceDetails(closestPlace.place, enhancedDetails, e.latLng!);
              
              setSelectedPlace(placeDetails);
              setShowContentCard(true);
            }
          }
        });
      }
    });
  };

  const findClosestPlace = (
    places: google.maps.places.PlaceResult[], 
    latLng: google.maps.LatLng,
    google: typeof globalThis.google
  ) => {
    let closestPlace = places[0];
    let minDistance = Infinity;
    
    places.forEach(place => {
      if (place.geometry?.location) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          latLng,
          place.geometry.location
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestPlace = place;
        }
      }
    });
    
    return { place: closestPlace, distance: minDistance };
  };

  const getEnhancedPlaceDetails = async (placeId: string | undefined) => {
    if (!placeId) return null;
    
    try {
      const enhancedDetails = await placesApiService.getPlaceDetails(placeId);
      return enhancedDetails;
    } catch (error) {
      console.warn('Could not get enhanced details for place ID:', placeId, error);
      return null;
    }
  };

  // Function to fetch reviewed places
  const fetchReviewedPlaces = async () => {
    if (!isAuthenticated) return;

    try {
      setReviewedPlacesLoading(true);
      setReviewedPlacesError(null);
      
      const places = await recommendationsApi.getReviewedPlaces('all', 200, 0);
      setReviewedPlaces(places);
      
      // Create markers for reviewed places
      createReviewedPlacesMarkers(places);
    } catch (error) {
      console.error('Failed to fetch reviewed places:', error);
      setReviewedPlacesError(error instanceof Error ? error.message : 'Failed to load reviewed places');
    } finally {
      setReviewedPlacesLoading(false);
    }
  };

  // Function to toggle reviewed places visibility
  const toggleReviewedPlaces = () => {
    const newVisibility = !showReviewedPlaces;
    setShowReviewedPlaces(newVisibility);
    
    // Update marker visibility based on zoom level
    if (map.current) {
      const zoom = map.current.getZoom() || 0;
      const isVisible = newVisibility && zoom >= 12;
      
      reviewedPlacesMarkers.current.forEach(marker => {
        marker.setMap(isVisible ? map.current : null);
      });
    }
  };

  const cleanup = () => {
    if (accuracyCircle.current) {
      accuracyCircle.current.setMap(null);
      accuracyCircle.current = null;
    }
    
    // Clear reviewed places markers
    reviewedPlacesMarkers.current.forEach(marker => marker.setMap(null));
    reviewedPlacesMarkers.current = [];
    
    map.current = null;
    placesService.current = null;
  };

  // Effects

  useEffect(() => {
    if (!isAuthenticated || !mapContainer.current || map.current) {
      return;
    }

    const initMap = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!mapContainer.current) {
        return;
      }

      const loader = new Loader({ 
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, 
        version: 'weekly', 
        libraries: ['places', 'geometry'] 
      });

      try {
        const google = await loader.load();
        
        if (!mapContainer.current) {
          return;
        }
        
        map.current = new google.maps.Map(mapContainer.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId: '95079f4fa5e07d01680ea67e',
          clickableIcons: true,
          // Start with POI markers hidden by default
          styles: [
            // Hide POI markers completely
            {
              featureType: 'poi',
              elementType: 'all',
              stylers: [{ visibility: 'off' }]
            },
            // Hide business markers
            {
              featureType: 'business',
              elementType: 'all',
              stylers: [{ visibility: 'off' }]
            },
            // Hide transit stations
            {
              featureType: 'transit',
              elementType: 'all',
              stylers: [{ visibility: 'off' }]
            },
            // Hide landmarks
            {
              featureType: 'landmark',
              elementType: 'all',
              stylers: [{ visibility: 'off' }]
            },
            // Hide natural features
            {
              featureType: 'natural',
              elementType: 'all',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        placesService.current = new google.maps.places.PlacesService(map.current);
        getUserLocation(google);
        setupPOIClickHandler(google);
        fetchReviewedPlaces(); // Fetch reviewed places on map load

      } catch (err) {
        console.error('Error loading Google Maps:', err);
      }
    };

    void initMap();

    return () => {
      cleanup();
    };
  }, [isAuthenticated]);

  // Fetch reviewed places when user is authenticated
  useEffect(() => {
    if (isAuthenticated && map.current) {
      fetchReviewedPlaces();
    }
  }, [isAuthenticated]);

  // Add zoom change listener to track current zoom level
  useEffect(() => {
    if (!map.current) return;

    const updateZoom = () => {
      const zoom = map.current?.getZoom() || 9;
      setCurrentZoom(zoom);
    };

    map.current.addListener('zoom_changed', updateZoom);
    updateZoom(); // Set initial zoom

    return () => {
      // Cleanup listener if needed
    };
  }, [map.current]);

  // Show loading only when we're checking auth and don't have a user yet
  if (isAuthChecking && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p>Loading user...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not checking auth, show the main container with login modal
  if (!isAuthenticated && !isAuthChecking) {
    return (
      <div className="map-page-container">
        {showLoginModal && <LoginModal onClose={closeLoginModal} />}
        <div className="map-container" />
      </div>
    );
  }

  return (
    <div className="map-page-container">
      {isAuthChecking && (
        <div className="auth-loading-overlay">
          <div className="auth-loading-content">
            <div className="auth-loading-spinner"></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      )}

      {showLoginModal && <LoginModal onClose={closeLoginModal} />}

      {showContentCard && selectedPlace && (
        <ContentCard
          place={selectedPlace}
          onClose={() => setShowContentCard(false)}
          onRate={() => {}}
          onLike={() => {}}
          onSave={() => {}}
          onShare={() => {}}
        />
      )}

      {searchResults && (
        <SearchResults
          searchResponse={searchResults}
          isLoading={isSearching}
          onClose={handleSearchClose}
          onPlaceSelect={handleSearchPlaceSelect}
        />
      )}

      {/* Reviewed Places Status */}
      {isAuthenticated && (
        <div className="fixed top-20 right-4 z-40 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <div className="space-y-3">
            {/* Reviewed Places Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${showReviewedPlaces ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium">Reviewed Places</span>
              </div>
            </div>
            
            {/* Loading and Error States */}
            {reviewedPlacesLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                Loading places...
              </div>
            )}
            
            {reviewedPlacesError && (
              <div className="text-sm text-red-600">
                {reviewedPlacesError}
              </div>
            )}
            
            {!reviewedPlacesLoading && !reviewedPlacesError && (
              <div className="text-sm text-gray-600 border-t pt-2">
                <div>{reviewedPlaces.length} places with reviews</div>
                <div className="text-xs text-gray-500 mt-1">
                  Zoom: {currentZoom} 
                  {showReviewedPlaces && currentZoom < 12 && (
                    <span className="text-orange-600 ml-1">(markers hidden, zoom in)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Header 
        currentUserId={user?.id}
        showMapButton={true}
        showProfileButton={true}
        showDiscoverButton={true}
        showLogoutButton={true}
        title="RECCE"
        variant="dark"
        mapButtonText="Feed"
        mapButtonLink="/feed"
        onLogout={handleLogout}
        profilePictureUrl={user?.profilePictureUrl}
        displayName={user?.displayName}
      />

      <div className="search-container">
        <SearchBar 
          isAuthenticated={isAuthenticated}
          onPlaceSelected={handlePlaceSelected}
          onClear={() => {}}
          onSemanticSearch={handleSemanticSearch}
          onSearchResults={handleSearchResults}
          onSearchLoading={handleSearchLoading}
        />
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <Button
          onClick={toggleReviewedPlaces}
          size="icon"
          className={`h-14 w-14 rounded-full shadow-lg ${
            showReviewedPlaces 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-gray-600 hover:bg-gray-700'
          } text-white`}
          title={showReviewedPlaces ? 'Hide reviewed places' : 'Show reviewed places'}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </Button>

        <Button
          onClick={handleLocateMe}
          disabled={isLocating}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
          title="Locate me"
        >
          {isLocating ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path fill="currentColor" d="M12 8a4 4 0 1 0 .001 8.001A4 4 0 0 0 12 8m8.94 3h-2.02A6.99 6.99 0 0 0 13 5.08V3h-2v2.08A6.99 6.99 0 0 0 5.08 11H3v2h2.08A6.99 6.99 0 0 0 11 18.92V21h2v-2.08A6.99 6.99 0 0 0 18.92 13H21v-2z"/>
            </svg>
          )}
        </Button>
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};

export default MapPage;