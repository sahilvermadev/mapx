import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader } from '@googlemaps/js-api-loader';
import { placesApiService } from '../services/placesApiService';
import { recommendationsApi, type SearchResponse, type ReviewedPlace } from '../services/recommendationsApiService';
import { useAuth } from '../auth';
import ContentCard from '../components/ContentCard';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';
import type { PlaceDetails } from '../components/ContentCard';
import { Button } from '@/components/ui/button';
import { getPrimaryGoogleType } from '../utils/placeTypes';
import { SEARCH_CONFIG } from '../config/searchConfig';
import './MapPage.css';

// Constants
const DEFAULT_CENTER = { lat: 40, lng: -74.5 };
const DEFAULT_ZOOM = 9;
const POI_SEARCH_RADIUS = 10; // meters
const POI_DISTANCE_THRESHOLD = 25; // meters
const LOCATION_ZOOM = 16;
const TARGET_ZOOM = 25;

// Helper functions

const createPlaceDetails = (
  place: google.maps.places.PlaceResult,
  enhancedDetails: any,
  latLng: google.maps.LatLng
): PlaceDetails => ({
  id: place.place_id || `poi-${Date.now()}`,
  name: enhancedDetails?.displayName?.text || place.name || 'Unknown place',
  address: enhancedDetails?.formattedAddress || place.vicinity || '',
  category: getPrimaryGoogleType(place.types || []),
  images: enhancedDetails?.photos?.slice(0, 3).map((photo: any) => 
    `https://places.googleapis.com/v1/${photo.name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`
  ) || place.photos?.slice(0, 3).map((photo: google.maps.places.PlacePhoto) => photo.getUrl()) || [],
  isSaved: false,
  latitude: place.geometry?.location?.lat() || latLng.lat(),
  longitude: place.geometry?.location?.lng() || latLng.lng(),
  google_place_id: place.place_id,
});

const MapPage: React.FC = () => {
  // Use global authentication state
  const { isAuthenticated, isChecking: isAuthChecking, user } = useAuth();
  
  // Get location state from navigation
  const location = useLocation();
  const locationState = location.state as { lat?: number; lng?: number; placeName?: string; placeAddress?: string; googlePlaceId?: string } | null;

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
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const accuracyCircle = useRef<google.maps.Circle | null>(null);
  const userLocationMarker = useRef<google.maps.Marker | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const reviewedPlacesMarkers = useRef<google.maps.Marker[]>([]);

  // Event handlers - memoized to prevent unnecessary re-renders
  const handleSemanticSearch = useCallback(async (query: string): Promise<SearchResponse> => {
    try {
      const results = await recommendationsApi.semanticSearch(
        query, 
        SEARCH_CONFIG.SEMANTIC_SEARCH.LIMIT, 
        SEARCH_CONFIG.SEMANTIC_SEARCH.THRESHOLD, 
        selectedGroupIds.length > 0 ? selectedGroupIds : undefined, 
        SEARCH_CONFIG.SEMANTIC_SEARCH.DEFAULT_CONTENT_TYPE
      );
      return results;
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }, [selectedGroupIds]);

  const handleSearchResults = useCallback((results: SearchResponse) => {
    setSearchResults(results);
  }, []);

  const handleSearchLoading = useCallback((loading: boolean) => {
    setIsSearching(loading);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchResults(null);
  }, []);

  const handleSearchPlaceSelect = useCallback(async (place: any) => {
    try {
      // Create basic place details first
      const placeDetails: PlaceDetails = {
        id: place.place_id || place.place_id?.toString() || `search-${place.place_id}`,
        name: place.place_name,
        address: place.place_address || '',
        category: 'point_of_interest',
        images: [],
        isSaved: false,
        latitude: place.place_lat,
        longitude: place.place_lng,
        google_place_id: place.google_place_id,
      };

      // Set the place immediately to show the content card
      setSelectedPlace(placeDetails);
      setShowContentCard(true);
      setSearchResults(null);

      // Navigate map to the place
      if (place.place_lat && place.place_lng) {
        moveMapToPlace(placeDetails);
      }

      // Fetch enhanced details and images if we have a Google Place ID
      if (place.google_place_id) {
        try {
          const enhancedDetails = await getEnhancedPlaceDetails(place.google_place_id);
          if (enhancedDetails) {
            // Update the place details with enhanced information
            const updatedPlaceDetails: PlaceDetails = {
              ...placeDetails,
              name: enhancedDetails?.displayName?.text || place.place_name,
              address: enhancedDetails?.formattedAddress || place.place_address || '',
              category: getPrimaryGoogleType(enhancedDetails?.types || []),
              images: enhancedDetails?.photos?.slice(0, 3).map((photo: any) => 
                `https://places.googleapis.com/v1/${photo.name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`
              ) || [],
            };
            
            // Update the selected place with enhanced details
            setSelectedPlace(updatedPlaceDetails);
          }
        } catch (error) {
          console.warn('Could not fetch enhanced details for place:', place.place_name, error);
        }
      }
    } catch (error) {
      console.error('Error handling search place select:', error);
    }
  }, []);

  const handleGroupToggle = useCallback((groupId: number) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  }, []);

  const handleClearGroups = useCallback(() => {
    setSelectedGroupIds([]);
  }, []);

  // Reload reviewed places when group selection changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchReviewedPlaces();
    }
  }, [selectedGroupIds, isAuthenticated]);

  const handleLocateMe = useCallback(() => {
    if (!map.current) return;
    
    setIsLocating(true);
    
    // Clear existing user location indicators
    if (accuracyCircle.current) {
      accuracyCircle.current.setMap(null);
      accuracyCircle.current = null;
    }
    
    if (userLocationMarker.current) {
      userLocationMarker.current.setMap(null);
      userLocationMarker.current = null;
    }

    getUserLocation(window.google);
  }, []);

  const moveMapToPlace = useCallback((place: PlaceDetails) => {
    if (!map.current) return;

    if (!place.latitude || !place.longitude || 
        place.latitude === 0 || place.longitude === 0) {
      console.warn('No valid coordinates for place:', place.name);
      return;
    }

    const location = new google.maps.LatLng(place.latitude, place.longitude);
    map.current.panTo(location);
    
    const initialZoom = map.current.getZoom() || 10;
    const zoomSteps = 20;
    const zoomInterval = 15;
    let currentStep = 0;
    
    const zoomAnimation = setInterval(() => {
      currentStep++;
      const progress = currentStep / zoomSteps;
      const currentZoomLevel = initialZoom + (TARGET_ZOOM - initialZoom) * progress;
      
      map.current?.setZoom(Math.round(currentZoomLevel));
      
      if (currentStep >= zoomSteps) {
        clearInterval(zoomAnimation);
      }
    }, zoomInterval);

    setSelectedPlace(place);
    setShowContentCard(true);
  }, []);

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
        
        // Create user location marker with pulsing animation
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
          zIndex: 2000, // High z-index to appear above other markers
          animation: google.maps.Animation.DROP
        });
        
        
        // Create accuracy circle for high accuracy locations
        if (accuracy < 1000) {
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
      
      // Create beautiful metallic markers based on rating tier
      // Excellent (4+): Gold (#EFBF04)
      // Good (3-4): Silver (#C4C4C4)
      // Fair (<3): Bronze (#CE8946)
      const getMarkerSvg = (rating: number, markerId: string) => {
        if (rating >= 4) {
          // Beautiful Gold marker with gradient and highlight
          return `
            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="goldGrad-${markerId}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#F5D547;stop-opacity:1" />
                  <stop offset="50%" style="stop-color:#EFBF04;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#D4A904;stop-opacity:1" />
                </linearGradient>
                <filter id="goldShadow-${markerId}" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(239,191,4,0.4)"/>
                  <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
                </filter>
              </defs>
              <circle cx="14" cy="14" r="12" fill="url(#goldGrad-${markerId})" stroke="#D4A904" stroke-width="1.5" filter="url(#goldShadow-${markerId})"/>
              <ellipse cx="10" cy="10" rx="4" ry="3" fill="rgba(255,255,255,0.4)" opacity="0.8"/>
              <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
            </svg>
          `;
        } else if (rating >= 3) {
          // Beautiful Silver marker with gradient and highlight
          return `
            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="silverGrad-${markerId}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#E8E8E8;stop-opacity:1" />
                  <stop offset="50%" style="stop-color:#C4C4C4;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#A8A8A8;stop-opacity:1" />
                </linearGradient>
                <filter id="silverShadow-${markerId}" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(196,196,196,0.3)"/>
                  <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
                </filter>
              </defs>
              <circle cx="14" cy="14" r="12" fill="url(#silverGrad-${markerId})" stroke="#A8A8A8" stroke-width="1.5" filter="url(#silverShadow-${markerId})"/>
              <ellipse cx="10" cy="10" rx="4" ry="3" fill="rgba(255,255,255,0.5)" opacity="0.9"/>
              <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
            </svg>
          `;
        } else {
          // Beautiful Bronze marker with gradient and highlight
          return `
            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="bronzeGrad-${markerId}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#E0A570;stop-opacity:1" />
                  <stop offset="50%" style="stop-color:#CE8946;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#B8753A;stop-opacity:1" />
                </linearGradient>
                <filter id="bronzeShadow-${markerId}" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(206,137,70,0.3)"/>
                  <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.2)"/>
                </filter>
              </defs>
              <circle cx="14" cy="14" r="12" fill="url(#bronzeGrad-${markerId})" stroke="#B8753A" stroke-width="1.5" filter="url(#bronzeShadow-${markerId})"/>
              <ellipse cx="10" cy="10" rx="4" ry="3" fill="rgba(255,255,255,0.3)" opacity="0.7"/>
              <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
            </svg>
          `;
        }
      };
      
      // Create custom marker with collision behavior
      const marker = new google.maps.Marker({
        position,
        map: map.current,
        title: `${place.name} (${place.review_count} reviews, ${place.average_rating.toFixed(1)}★)`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(getMarkerSvg(place.average_rating, place.id.toString()))}`,
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 28)
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
                category = getPrimaryGoogleType(enhancedDetails.types); // Use standardized category determination
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
                  category = getPrimaryGoogleType(closestMatch.types); // Use standardized category determination
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
            images: images, // Use fetched images
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
            images: [],
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
    if (!map.current) {
      console.log('Map not available for POI click handler setup');
      return;
    }

    console.log('Setting up POI click handler');
    map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      console.log('Map clicked at:', e.latLng);
      if (e.stop) {
        e.stop();
      }
      
      if (!e.latLng || !map.current) return;
      
      const request: google.maps.places.PlaceSearchRequest = {
        location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
        radius: POI_SEARCH_RADIUS,
        type: 'establishment'
      };

      console.log('Searching for places near:', request.location, 'with radius:', request.radius);
      if (placesService.current) {
        try {
          placesService.current.nearbySearch(request, async (placeResults, placeStatus) => {
            console.log('Places search result:', placeStatus, placeResults?.length, 'places found');
            if (placeStatus === google.maps.places.PlacesServiceStatus.OK && placeResults && placeResults.length > 0) {
              const closestPlace = findClosestPlace(placeResults, e.latLng!, google);
              console.log('Closest place:', closestPlace?.place.name, 'distance:', closestPlace?.distance);
              
              if (closestPlace && closestPlace.distance <= POI_DISTANCE_THRESHOLD) {
                console.log('Place within threshold, getting enhanced details');
                const enhancedDetails = await getEnhancedPlaceDetails(closestPlace.place.place_id);
                const placeDetails = createPlaceDetails(closestPlace.place, enhancedDetails, e.latLng!);
                
                setSelectedPlace(placeDetails);
                setShowContentCard(true);
              } else {
                console.log('No places within threshold');
              }
            } else {
              console.log('No places found or search failed:', placeStatus);
            }
          });
        } catch (error) {
          console.error('Places search error:', error);
        }
      } else {
        console.log('Places service not available, attempting to initialize...');
        // Try to initialize places service if it's not available
        if (map.current) {
          try {
            placesService.current = new google.maps.places.PlacesService(map.current!);
            console.log('Places service initialized on demand:', placesService.current);
            // Retry the search
            placesService.current.nearbySearch(request, async (placeResults, placeStatus) => {
              console.log('Retry search result:', placeStatus, placeResults?.length, 'places found');
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
          } catch (initError) {
            console.error('Failed to initialize places service on demand:', initError);
          }
        }
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
      
      const places = await recommendationsApi.getReviewedPlaces('friends', 200, 0, selectedGroupIds.length > 0 ? selectedGroupIds : undefined);
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
  const toggleReviewedPlaces = useCallback(() => {
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
  }, [showReviewedPlaces]);

  const cleanup = () => {
    if (accuracyCircle.current) {
      accuracyCircle.current.setMap(null);
      accuracyCircle.current = null;
    }
    
    if (userLocationMarker.current) {
      userLocationMarker.current.setMap(null);
      userLocationMarker.current = null;
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
        
        // Map configuration - use custom mapId if available, otherwise use default
        // Note: If mapId doesn't exist in Google Cloud Console or API key doesn't have access,
        // Google Maps will silently fall back to default map style
        const mapConfig: google.maps.MapOptions = {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          clickableIcons: true,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: false,
          rotateControl: false,
          gestureHandling: 'greedy',
          disableDefaultUI: true
        };

        // Use custom mapId - can be overridden via VITE_GOOGLE_MAPS_MAP_ID environment variable
        // Default mapId: 95079f4fa5e07d01680ea67e
        // To override: Set VITE_GOOGLE_MAPS_MAP_ID in your .env file
        const customMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '95079f4fa5e07d01680ea67e';
        mapConfig.mapId = customMapId;
        console.log('Using custom map style with mapId:', customMapId);

        map.current = new google.maps.Map(mapContainer.current, mapConfig);

        // Listen for map errors (e.g., invalid mapId)
        google.maps.event.addListenerOnce(map.current, 'tilesloaded', () => {
          console.log('Map tiles loaded successfully');
        });

        // Wait for map to be fully loaded before initializing places service
        google.maps.event.addListenerOnce(map.current, 'idle', () => {
          console.log('Map is idle, initializing places service...');
          try {
            placesService.current = new google.maps.places.PlacesService(map.current!);
            console.log('Places service initialized:', placesService.current);
            
            // Now that places service is ready, set up click handler
            setupPOIClickHandler(google);
            
            // Mark map as ready for SearchBar
            setIsMapReady(true);
          } catch (error) {
            console.error('Failed to initialize places service:', error);
            // Fallback: try again after a short delay
            setTimeout(() => {
              try {
                placesService.current = new google.maps.places.PlacesService(map.current!);
                console.log('Places service initialized on retry:', placesService.current);
                setupPOIClickHandler(google);
                setIsMapReady(true);
              } catch (retryError) {
                console.error('Places service retry failed:', retryError);
              }
            }, 1000);
          }
        });

        // Fallback timeout in case the idle event doesn't fire
        setTimeout(() => {
          if (!placesService.current && map.current) {
            console.log('Fallback: Initializing places service after timeout...');
            try {
              placesService.current = new google.maps.places.PlacesService(map.current!);
              console.log('Places service initialized via fallback:', placesService.current);
              setupPOIClickHandler(google);
              setIsMapReady(true);
            } catch (error) {
              console.error('Fallback places service initialization failed:', error);
            }
          }
        }, 3000);

        getUserLocation(google);
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

  // Handle location state from navigation
  useEffect(() => {
    if (locationState && locationState.lat && locationState.lng && map.current && isMapReady) {
      const { lat, lng, placeName, placeAddress, googlePlaceId } = locationState;
      
      // If a Google Place ID is provided, prefer that to ensure reviews load
      if (googlePlaceId) {
        (async () => {
          try {
            const enhancedDetails = await getEnhancedPlaceDetails(googlePlaceId);
            const placeDetails: PlaceDetails = {
              id: googlePlaceId,
              name: enhancedDetails?.displayName?.text || placeName || 'Selected Location',
              address: enhancedDetails?.formattedAddress || placeAddress || '',
              category: getPrimaryGoogleType(enhancedDetails?.types || []),
              images: enhancedDetails?.photos?.slice(0, 3).map((photo: any) => 
                `https://places.googleapis.com/v1/${photo.name}/media?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`
              ) || [],
              isSaved: false,
              latitude: lat,
              longitude: lng,
              google_place_id: googlePlaceId
            };
            moveMapToPlace(placeDetails);
          } catch {
            // Fall through to reverse geocoding if enhanced details fail
          }
        })();
        return;
      }

      // Try to find a Google Place ID for this location using reverse geocoding
      const findGooglePlaceId = async () => {
        try {
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            const latLng = new window.google.maps.LatLng(lat, lng);
            
            const results = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ location: latLng }, (results, status) => {
                if (status === 'OK' && results) {
                  resolve(results);
                } else {
                  reject(new Error('Geocoding failed'));
                }
              });
            });
            
            // Find the best result (usually the first one)
            const bestResult = results[0];
            if (bestResult && bestResult.place_id) {
              // Create place details with Google Place ID
              const placeDetails: PlaceDetails = {
                id: bestResult.place_id,
                name: placeName || bestResult.formatted_address || 'Selected Location',
                address: placeAddress || bestResult.formatted_address || '',
                category: getPrimaryGoogleType(bestResult.types || []),
                images: [],
                isSaved: false,
                latitude: lat,
                longitude: lng,
                google_place_id: bestResult.place_id
              };
              
              // Move map to the location
              moveMapToPlace(placeDetails);
              return;
            }
          }
        } catch (error) {
          console.warn('Could not find Google Place ID for location:', error);
        }
        
        // Fallback: Create place details without Google Place ID
        const placeDetails: PlaceDetails = {
          id: `nav-${Date.now()}`,
          name: placeName || 'Selected Location',
          address: placeAddress || '',
          category: 'location',
          images: [],
          isSaved: false,
          latitude: lat,
          longitude: lng,
          google_place_id: undefined
        };
        
        // Move map to the location
        moveMapToPlace(placeDetails);
      };
      
      findGooglePlaceId();
    }
  }, [locationState, isMapReady, moveMapToPlace]);

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
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p>Loading user...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not checking auth, show empty map container
  if (!isAuthenticated && !isAuthChecking) {
    return (
      <div className="map-page-container">
        <div className="map-container" />
      </div>
    );
  }

  // Prevent body scroll on mobile when content card is open
  useEffect(() => {
    if (showContentCard && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showContentCard]);

  return (
    <div className="map-page-container">

      {showContentCard && selectedPlace && (
        <ContentCard
          place={selectedPlace}
          onClose={() => setShowContentCard(false)}
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

      {/* Reviewed Places Status - Compact Neobrutalist Design */}
      {isAuthenticated && !showContentCard && (
        <div className="fixed top-20 right-4 z-40 hidden md:block">
          <div className="bg-white border-2 border-black rounded-lg shadow-[4px_4px_0_0_#000] px-3 py-2 inline-block">
            <div className="flex items-center gap-2">
              {/* Status Indicator */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${showReviewedPlaces ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              
              {/* Content */}
              {reviewedPlacesLoading ? (
                <div className="flex items-center gap-1.5">
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-black border-t-transparent"></div>
                  <span className="text-xs font-semibold text-black">Loading...</span>
                </div>
              ) : reviewedPlacesError ? (
                <span className="text-xs font-semibold text-red-600">Error</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-black">{reviewedPlaces.length}</span>
                  <span className="text-xs font-medium text-gray-700">places</span>
                  {showReviewedPlaces && currentZoom < 12 && (
                    <span className="text-[10px] font-medium text-orange-600 ml-0.5">(zoom in)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isMapReady && (
        <div className="search-container">
          <SearchBar 
            isAuthenticated={isAuthenticated}
            onPlaceSelected={moveMapToPlace}
            onSemanticSearch={handleSemanticSearch}
            onSearchResults={handleSearchResults}
            onSearchLoading={handleSearchLoading}
            currentUserId={user?.id}
            selectedGroupIds={selectedGroupIds}
            onGroupToggle={handleGroupToggle}
            onClearGroups={handleClearGroups}
            showGroupFilters={true}
          />
        </div>
      )}

      <div className={`fixed ${showContentCard ? 'bottom-24 md:bottom-6' : 'bottom-6'} right-4 md:right-6 z-40 flex flex-col gap-3 transition-all duration-300 ${showContentCard ? 'hidden md:flex' : 'flex'}`}>
        <Button
          onClick={toggleReviewedPlaces}
          size="icon"
          className={`h-11 w-11 rounded-lg border-0 transition-all duration-200 ${
            showReviewedPlaces 
              ? 'bg-green-600 hover:bg-green-700 shadow-lg' 
              : 'bg-gray-800 hover:bg-gray-700 shadow-md'
          } text-white`}
          title={showReviewedPlaces ? 'Hide reviewed places' : 'Show reviewed places'}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </Button>

        <Button
          onClick={handleLocateMe}
          disabled={isLocating}
          size="icon"
          className="h-11 w-11 rounded-lg bg-gray-800 hover:bg-gray-700 border-0 shadow-md text-white transition-all duration-200 disabled:opacity-50"
          title="Locate me"
        >
          {isLocating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-white"></div>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path fill="currentColor" d="M12 8a4 4 0 1 0 .001 8.001A4 4 0 0 0 12 8m8.94 3h-2.02A6.99 6.99 0 0 0 13 5.08V3h-2v2.08A6.99 6.99 0 0 0 5.08 11H3v2h2.08A6.99 6.99 0 0 0 11 18.92V21h2v-2.08A6.99 6.99 0 0 0 18.92 13H21v-2z"/>
            </svg>
          )}
        </Button>
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
};

export default React.memo(MapPage);