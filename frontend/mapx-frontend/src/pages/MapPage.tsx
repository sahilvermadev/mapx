import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { placesApiService } from '../services/placesApi';
import { recommendationsApi, type SearchResponse } from '../services/recommendations';
import LoginModal from '../components/LoginModal';
import ContentCard from '../components/ContentCard';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';
import type { PlaceDetails } from '../components/ContentCard';
import './MapPage.css';

// Constants
const DEFAULT_CENTER = { lat: 40, lng: -74.5 };
const DEFAULT_ZOOM = 9;
const POI_SEARCH_RADIUS = 10; // meters
const POI_DISTANCE_THRESHOLD = 25; // meters
const LOCATION_ZOOM = 16;
const TARGET_ZOOM = 25;

// Types
type UserClaims = {
  id: string;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
};

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

// Function to proxy Google profile pictures through our backend
const getProxiedProfilePicture = (originalUrl: string): string => {
  if (!originalUrl) return '';
  
  // Check if it's a Google profile picture URL
  if (originalUrl.includes('googleusercontent.com')) {
    // Use our backend proxy to load the image
    const proxyUrl = `http://localhost:5000/auth/profile-picture?url=${encodeURIComponent(originalUrl)}`;
    console.log('🖼️ Proxying Google profile picture:', {
      original: originalUrl,
      proxy: proxyUrl
    });
    return proxyUrl;
  }
  
  return originalUrl;
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
  const navigate = useNavigate();
  
  // State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [showContentCard, setShowContentCard] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<UserClaims | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const accuracyCircle = useRef<google.maps.Circle | null>(null);
  const geoWatchId = useRef<number | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  // Semantic search handlers
  const handleSemanticSearch = async (query: string): Promise<SearchResponse> => {
    try {
      console.log('🔍 Performing semantic search:', query);
      const results = await recommendationsApi.semanticSearch(query);
      console.log('🔍 Search results:', results);
      return results;
    } catch (error) {
      console.error('❌ Semantic search failed:', error);
      throw error;
    }
  };

  const handleSearchResults = (results: SearchResponse) => {
    console.log('🔍 Setting search results:', results);
    setSearchResults(results);
  };

  const handleSearchLoading = (loading: boolean) => {
    console.log('🔍 Search loading:', loading);
    setIsSearching(loading);
  };

  const handleSearchClose = () => {
    setSearchResults(null);
  };

  const handleSearchPlaceSelect = (place: any) => {
    console.log('🔍 Place selected from search:', place);
    
    // Convert search result to PlaceDetails format
    const placeDetails: PlaceDetails = {
      id: place.place_id || place.place_id?.toString() || `search-${place.place_id}`,
      name: place.place_name,
      address: place.place_address || '',
      category: 'point_of_interest', // Default category
      userRating: 0,
      friendsRating: place.recommendations?.[0]?.rating || 0,
      personalReview: '',
      images: [], // No images from search results
      isLiked: false,
      isSaved: false,
      latitude: place.place_lat,
      longitude: place.place_lng,
      google_place_id: place.google_place_id,
    };

    setSelectedPlace(placeDetails);
    setShowContentCard(true);
    setSearchResults(null); // Close search results
  };

  // Authentication effect
  useEffect(() => {
    const checkAuth = () => {
      console.log('🔍 Checking authentication...');
      const isAuth = apiClient.isAuthenticated();
      console.log('🔍 Is authenticated:', isAuth);
      
      if (isAuth) {
        console.log('✅ User is authenticated, setting up map...');
        setIsAuthenticated(true);
        setShowLoginModal(false);
        setUser(apiClient.getCurrentUser());
        setIsAuthChecking(false);
      } else {
        // Check if we're coming from an OAuth redirect
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
          console.log('🔑 Token found in URL, storing and rechecking...');
          // Store the token and check again
          localStorage.setItem('authToken', token);
          
          // Recheck authentication after storing token
          setTimeout(() => {
            const newIsAuth = apiClient.isAuthenticated();
            console.log('🔍 Recheck after storing token:', newIsAuth);
            if (newIsAuth) {
              setIsAuthenticated(true);
              setShowLoginModal(false);
              setUser(apiClient.getCurrentUser());
            } else {
              setIsAuthenticated(false);
              setShowLoginModal(true);
              setUser(null);
            }
            setIsAuthChecking(false);
          }, 100);
          return;
        }
        
        console.log('❌ No authentication found, showing login modal');
        setIsAuthenticated(false);
        setShowLoginModal(true);
        setUser(null);
        setIsAuthChecking(false);
      }
    };

    // Check immediately
    checkAuth();

    // If not authenticated, check again after a short delay to handle OAuth redirects
    if (!apiClient.isAuthenticated()) {
      console.log('⏰ Setting up retry timer for auth check...');
      const retryTimer = setTimeout(() => {
        console.log('⏰ Retry timer fired, checking auth again...');
        checkAuth();
      }, 500); // 500ms delay to allow localStorage to be updated

      return () => {
        console.log('🧹 Cleaning up retry timer');
        clearTimeout(retryTimer);
      };
    }

    // Safety timeout to prevent infinite loading state
    const safetyTimer = setTimeout(() => {
      console.log('⚠️ Safety timeout reached, forcing auth check completion');
      setIsAuthChecking(false);
    }, 3000); // 3 seconds max

    return () => {
      clearTimeout(safetyTimer);
    };
  }, []);

  // Map initialization effect
  useEffect(() => {
    console.log('🗺️ Map init effect triggered:', { 
      isAuthenticated, 
      hasMapContainer: !!mapContainer.current, 
      hasMap: !!map.current 
    });
    
    if (!isAuthenticated || !mapContainer.current || map.current) {
      console.log('🗺️ Map init skipped:', { 
        reason: !isAuthenticated ? 'not authenticated' : 
                !mapContainer.current ? 'no container' : 'map already exists' 
      });
      return;
    }

    console.log('🗺️ Starting map initialization...');
    const initMap = async () => {
      // Add a small delay to ensure DOM is fully rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Double-check that the container is still available
      if (!mapContainer.current) {
        console.error('🗺️ Map container is null, cannot initialize map');
        return;
      }

      const loader = new Loader({ 
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, 
        version: 'weekly', 
        libraries: ['places', 'geometry'] 
      });

      try {
        console.log('🗺️ Loading Google Maps API...');
        const google = await loader.load();
        console.log('🗺️ Google Maps API loaded successfully');
        
        // Triple-check that the container is still available after API load
        if (!mapContainer.current) {
          console.error('🗺️ Map container became null after API load');
          return;
        }
        
        // Initialize map
        map.current = new google.maps.Map(mapContainer.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId: '95079f4fa5e07d01680ea67e',
          clickableIcons: true,
        });
        console.log('🗺️ Map initialized successfully');

        // Initialize Places service
        placesService.current = new google.maps.places.PlacesService(map.current);

        // Get user location
        getUserLocation(google);

        // Setup POI click handler
        setupPOIClickHandler(google);

        // Add global event listener to prevent default Google info windows
        setTimeout(() => {
          const mapElement = mapContainer.current;
          if (mapElement) {
            // Intercept clicks on POI elements before Google handles them
            mapElement.addEventListener('click', (e) => {
              const target = e.target as HTMLElement;
              
              // Check if this is a POI click by looking for Google's POI elements
              if (target.closest('[role="button"]') || 
                  target.closest('[aria-label*="restaurant"]') ||
                  target.closest('[aria-label*="cafe"]') ||
                  target.closest('[aria-label*="bar"]') ||
                  target.closest('[aria-label*="hotel"]') ||
                  target.closest('[aria-label*="park"]') ||
                  target.closest('[aria-label*="museum"]') ||
                  target.closest('[aria-label*="store"]') ||
                  target.closest('[aria-label*="gas"]') ||
                  target.closest('[aria-label*="hospital"]') ||
                  target.closest('[aria-label*="school"]') ||
                  target.closest('[aria-label*="bank"]') ||
                  target.closest('[aria-label*="pharmacy"]') ||
                  target.closest('[aria-label*="church"]') ||
                  target.closest('[aria-label*="temple"]') ||
                  target.closest('[aria-label*="theater"]') ||
                  target.closest('[aria-label*="gym"]') ||
                  target.closest('[aria-label*="library"]') ||
                  target.closest('[aria-label*="station"]') ||
                  target.closest('[aria-label*="airport"]') ||
                  target.closest('.poi') ||
                  target.closest('.place') ||
                  target.closest('[data-place-id]')) {
                
                // Prevent the default Google info window
                e.stopPropagation();
                e.preventDefault();
                
                // Also stop immediate propagation to prevent any other handlers
                e.stopImmediatePropagation();
              }
            }, true); // Use capture phase to intercept before Google's handlers
          }
        }, 1000); // Wait for map to fully load

      } catch (err) {
        console.error('🗺️ Error loading Google Maps:', err);
      }
    };

    void initMap();

    return () => {
      cleanup();
    };
  }, [isAuthenticated]);

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
        
        // Show accuracy circle if accuracy is good
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

  const setupPOIClickHandler = (google: typeof globalThis.google) => {
    if (!map.current) return;

    map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      // Prevent ALL default Google Maps click interactions immediately
      // This is crucial for stopping the default POI info window
      if (e.stop) {
        e.stop();
      }
      
      if (!e.latLng || !map.current) return;
      
      console.log('Map clicked at:', e.latLng.lat(), e.latLng.lng());
      
      // Check if this is a POI click (has placeId property)
      if ((e as any).placeId) {
        console.log('POI clicked with placeId:', (e as any).placeId);
      }
      
      const request: google.maps.places.PlaceSearchRequest = {
        location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
        radius: POI_SEARCH_RADIUS,
        type: 'establishment' // Search for all types of establishments
      };

      if (placesService.current) {
        placesService.current.nearbySearch(request, async (placeResults, placeStatus) => {
          console.log('Places API results:', placeResults?.length, 'Status:', placeStatus);
          
          if (placeStatus === google.maps.places.PlacesServiceStatus.OK && placeResults && placeResults.length > 0) {
            const closestPlace = findClosestPlace(placeResults, e.latLng!, google);
            
            if (closestPlace && closestPlace.distance <= POI_DISTANCE_THRESHOLD) {
              console.log('Found nearby place:', closestPlace.place.name, 'Distance:', closestPlace.distance, 'm');
              
              const enhancedDetails = await getEnhancedPlaceDetails(closestPlace.place.place_id);
              const placeDetails = createPlaceDetails(closestPlace.place, enhancedDetails, e.latLng!);
              
              setSelectedPlace(placeDetails);
              setShowContentCard(true);
            } else {
              console.log('No place found within threshold');
            }
          } else {
            console.log('No places found nearby');
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
      console.log('Enhanced details from New API:', enhancedDetails);
      return enhancedDetails;
    } catch (error) {
      console.warn('Could not get enhanced details:', error);
      return null;
    }
  };

  const cleanup = () => {
    if (geoWatchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchId.current);
    }
    accuracyCircle.current = null;
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = [];
    map.current = null;
    placesService.current = null;
    
    // Clean up global event listener
    const mapElement = mapContainer.current;
    if (mapElement) {
      // Remove all click event listeners from the map element
      mapElement.replaceWith(mapElement.cloneNode(true));
    }
  };

  // Event handlers
  const handleLogout = () => { 
    localStorage.removeItem('authToken'); 
    setIsAuthenticated(false); 
    setShowLoginModal(true); 
    setUser(null); 
  };

  const handleRate = (rating: number) => {
    if (selectedPlace) {
      setSelectedPlace({ ...selectedPlace, userRating: rating });
    }
  };

  const handleLike = () => {
    if (selectedPlace) {
      setSelectedPlace({ ...selectedPlace, isLiked: !selectedPlace.isLiked });
    }
  };

  const handleSave = () => {
    if (selectedPlace) {
      setSelectedPlace({ ...selectedPlace, isSaved: !selectedPlace.isSaved });
    }
  };

  const handleShare = () => {
    if (selectedPlace) {
      const text = `Check out ${selectedPlace.name} at ${selectedPlace.address}!`;
      if (navigator.share) {
        navigator.share({ title: selectedPlace.name, text });
      } else {
        navigator.clipboard.writeText(text);
      }
    }
  };

  const handleLocateMe = () => {
    if (!map.current) return;
    
    setIsLocating(true);
    
    // Clear existing accuracy circle
    if (accuracyCircle.current) {
      accuracyCircle.current.setMap(null);
      accuracyCircle.current = null;
    }

    getUserLocation(window.google);
  };

  const handlePlaceSelected = (place: PlaceDetails) => {
    if (!map.current) return;

    console.log('Handling place selection:', place.name, 'Coordinates:', place.latitude, place.longitude);

    // Validate coordinates
    if (!place.latitude || !place.longitude || 
        place.latitude === 0 || place.longitude === 0) {
      console.warn('No valid coordinates for place:', place.name);
      return;
    }

    // Clear previous markers
    markers.current.forEach(m => m.setMap(null));
    markers.current = [];

    // Navigate to place
    const location = new google.maps.LatLng(place.latitude, place.longitude);
    map.current.panTo(location);
    
    // Animate zoom
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

  // Render helpers
  const avatar = (user?.profilePictureUrl && !avatarError) ? (
    <img 
      src={getProxiedProfilePicture(user.profilePictureUrl)} 
      alt="" 
      onError={() => {
        console.log('❌ Avatar image failed to load:', user.profilePictureUrl);
        setAvatarError(true);
      }}
      onLoad={() => {
        console.log('✅ Avatar image loaded successfully:', user.profilePictureUrl);
      }}
    />
  ) : (
    <div className="avatar-fallback" aria-label="Profile">
      {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
    </div>
  );

  // Debug logging for render
  console.log('🎨 Rendering MapPage:', {
    isAuthChecking,
    isAuthenticated,
    showLoginModal,
    showContentCard: !!selectedPlace,
    hasUser: !!user
  });

  return (
    <div className="map-page-container">
      {/* Show loading screen while checking authentication */}
      {isAuthChecking && (
        <div className="auth-loading-overlay">
          <div className="auth-loading-content">
            <div className="auth-loading-spinner"></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      )}

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {showContentCard && selectedPlace && (
        <ContentCard
          place={selectedPlace}
          onClose={() => setShowContentCard(false)}
          onRate={handleRate}
          onLike={handleLike}
          onSave={handleSave}
          onShare={handleShare}
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

      <div className="appbar">
        <SearchBar 
          isAuthenticated={isAuthenticated}
          onPlaceSelected={handlePlaceSelected}
          onClear={() => {}}
          onSemanticSearch={handleSemanticSearch}
          onSearchResults={handleSearchResults}
          onSearchLoading={handleSearchLoading}
        />
        <div className="profile" onClick={() => setMenuOpen(v => !v)} aria-label="Profile menu">
          {avatar}
          {menuOpen && (
            <div className="menu">
              <a
                href={user?.id ? `/profile/${user.id}` : "#"}
                className="menu-item"
                onClick={e => {
                  if (!user?.id) {
                    e.preventDefault();
                  } else {
                    setMenuOpen(false);
                  }
                }}
              >
                My Profile
              </a>
              <a href="#" className="menu-item">My Maps</a>
              <a href="#" className="menu-item">Friends</a>
              <a className="menu-item danger" onClick={handleLogout}>Logout</a>
            </div>
          )}
        </div>
      </div>

      <div className="fab-group">
        <button 
          className={`fab ${isLocating ? 'locating' : ''}`} 
          onClick={handleLocateMe} 
          title="Locate me"
          disabled={isLocating}
        >
          {isLocating ? (
            <div className="spinner"></div>
          ) : (
            <svg viewBox="0 0 24 24" className="fab-icon" aria-hidden="true">
              <path fill="currentColor" d="M12 8a4 4 0 1 0 .001 8.001A4 4 0 0 0 12 8m8.94 3h-2.02A6.99 6.99 0 0 0 13 5.08V3h-2v2.08A6.99 6.99 0 0 0 5.08 11H3v2h2.08A6.99 6.99 0 0 0 11 18.92V21h2v-2.08A6.99 6.99 0 0 0 18.92 13H21v-2z"/>
            </svg>
          )}
        </button>
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};

export default MapPage;