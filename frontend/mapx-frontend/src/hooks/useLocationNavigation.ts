import { useNavigate } from 'react-router-dom';
import type { LocationData, LocationNavigationOptions, LocationNavigationState } from '@/types/location';

/**
 * Custom hook for handling location navigation to map page
 * Eliminates duplication between FeedPost and QuestionFeedPost components
 */
export const useLocationNavigation = () => {
  const navigate = useNavigate();

  const createLocationClickHandler = (locationData: LocationData) => {
    if (!locationData.lat || !locationData.lng || 
        locationData.lat === 0 || locationData.lng === 0) {
      return undefined;
    }

    return () => {
      const navigationState: LocationNavigationState = {
        lat: locationData.lat,
        lng: locationData.lng,
        placeName: locationData.placeName || locationData.placeAddress,
        placeAddress: locationData.placeAddress,
        googlePlaceId: locationData.googlePlaceId
      };
      
      navigate('/map', { state: navigationState });
    };
  };

  const getLocationNavigationProps = (options: LocationNavigationOptions) => {
    const { hasCoordinates, locationData, className = '', title } = options;
    
    return {
      className: `truncate ${hasCoordinates ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''} ${className}`,
      onClick: hasCoordinates ? createLocationClickHandler(locationData) : undefined,
      title: hasCoordinates ? (title || 'Click to view on map') : undefined
    };
  };

  return {
    createLocationClickHandler,
    getLocationNavigationProps
  };
};
