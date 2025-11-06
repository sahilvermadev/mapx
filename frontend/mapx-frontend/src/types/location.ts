/**
 * Common location-related types used across the application
 */

export interface LocationData {
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  googlePlaceId?: string;
}

export interface LocationNavigationState {
  lat: number;
  lng: number;
  placeName?: string;
  placeAddress?: string;
  googlePlaceId?: string;
}

export interface PlaceCoordinates {
  lat: number;
  lng: number;
}

export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  category: string;
  images: string[];
  isSaved: boolean;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

export interface LocationNavigationOptions {
  hasCoordinates: boolean;
  locationData: LocationData;
  className?: string;
  title?: string;
}


















