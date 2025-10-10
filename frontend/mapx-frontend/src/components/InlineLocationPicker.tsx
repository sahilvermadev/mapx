import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPrimaryGoogleType } from '../utils/placeTypes';

interface InlineLocationPickerProps {
  onLocationSelected: (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
  }) => void;
  onSkip: () => void;
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
}

const InlineLocationPicker: React.FC<InlineLocationPickerProps> = ({
  onLocationSelected,
  onSkip
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<PlaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!searchInputRef.current || !window.google) {
      return;
    }

    // Clean up previous autocomplete
    if (autocomplete.current) {
      autocomplete.current = null;
    }

    // Initialize autocomplete
    console.log('🔍 InlineLocationPicker: Initializing autocomplete...');
    autocomplete.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      types: ['establishment', 'geocode'],
      fields: ['place_id', 'geometry', 'name', 'formatted_address', 'types', 'photos']
    });

    autocomplete.current.addListener('place_changed', () => {
      const place = autocomplete.current?.getPlace();
      if (place && place.geometry && place.place_id) {
        // Validate coordinates
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        
        if (!lat || !lng || lat === 0 || lng === 0) {
          console.warn('Invalid coordinates from Google Places API:', place.name);
          setError('Invalid location coordinates. Please try again.');
          return;
        }
        
        console.log('Place selected:', place.name, 'Coordinates:', lat, lng);
        console.log('Place types:', place.types);
        
        // Get the primary Google Places type
        const primaryType = getPrimaryGoogleType(place.types || []);
        console.log('Primary Google type:', primaryType);
        
        // Convert to our PlaceResult format
        const placeResult: PlaceResult = {
          place_id: place.place_id || '',
          name: place.name || '',
          formatted_address: place.formatted_address || '',
          geometry: {
            location: {
              lat: lat,
              lng: lng
            }
          },
          types: place.types || []
        };
        
        setSelectedLocation(placeResult);
        setError(null);
      }
    });

    // Cleanup function
    return () => {
      if (autocomplete.current) {
        autocomplete.current = null;
      }
    };
  }, []);

  // Auto-focus search input when component mounts
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleConfirmSelection = () => {
    if (selectedLocation) {
      onLocationSelected({
        name: selectedLocation.name,
        address: selectedLocation.formatted_address,
        lat: selectedLocation.geometry.location.lat,
        lng: selectedLocation.geometry.location.lng,
        google_place_id: selectedLocation.place_id
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Search Section */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a place or address..."
          className="pl-10 pr-4 py-3 text-lg"
        />
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="p-4 border border-blue-500 bg-blue-50 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-gray-900">
                  {selectedLocation.name}
                </h4>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {selectedLocation.formatted_address}
              </p>
              {selectedLocation.types.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedLocation.types.slice(0, 2).map((type, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                    >
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Check className="h-5 w-5 text-blue-600 flex-shrink-0 ml-3" />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          onClick={onSkip}
          variant="outline"
          className="px-6 py-2"
        >
          Skip
        </Button>
        {selectedLocation && (
          <Button
            onClick={handleConfirmSelection}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700"
          >
            Select Location
          </Button>
        )}
      </div>
    </div>
  );
};

export default InlineLocationPicker;
