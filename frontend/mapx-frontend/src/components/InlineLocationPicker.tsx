import React, { useState, useRef, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
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
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
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
  address_components?: any[];
  city_name?: string;
  admin1_name?: string;
  country_code?: string;
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

  // Initialize Google Places Autocomplete (with loader fallback)
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!searchInputRef.current) return;

      // Ensure Google Maps JS API is loaded
      if (!(window as any).google?.maps?.places?.Autocomplete) {
        try {
          const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
          if (!apiKey) {
            setError('Google Maps API key is not configured');
            return;
          }
          const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] });
          await loader.load();
        } catch (e) {
          if (!cancelled) setError('Failed to load Google Maps Places library');
          return;
        }
      }

      if (cancelled || !searchInputRef.current) return;

      // Clean up previous autocomplete
      autocomplete.current = null;

      // Initialize autocomplete
      autocomplete.current = new (window as any).google.maps.places.Autocomplete(searchInputRef.current, {
        types: ['establishment', 'geocode'],
        fields: ['place_id', 'geometry', 'name', 'formatted_address', 'types', 'photos', 'address_components']
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
        
        // Derive admin fields from address_components if present
        let city_name: string | undefined;
        let admin1_name: string | undefined;
        let country_code: string | undefined;
        const comps: any[] = (place as any).address_components || [];
        for (const c of comps) {
          const types: string[] = c.types || [];
          if (!city_name && (types.includes('locality') || types.includes('postal_town'))) city_name = c.long_name || c.short_name;
          if (!admin1_name && types.includes('administrative_area_level_1')) admin1_name = c.long_name || c.short_name;
          if (!country_code && types.includes('country')) country_code = (c.short_name || c.long_name || '').toUpperCase();
        }
        
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
          types: place.types || [],
          address_components: comps,
          city_name,
          admin1_name,
          country_code
        };
        
        setSelectedLocation(placeResult);
        setError(null);
      }
    });
    };

    init();

    // Cleanup function
    return () => {
      cancelled = true;
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
        google_place_id: selectedLocation.place_id,
        city_name: selectedLocation.city_name,
        admin1_name: selectedLocation.admin1_name,
        country_code: selectedLocation.country_code
      });
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Search Section */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a place or address..."
          className="pl-10 pr-4 py-3 text-base bg-transparent border border-border rounded-lg focus:border-foreground focus:ring-0"
        />
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="p-4 md:p-5 rounded-xl border border-border bg-card/50 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="h-4 w-4 text-foreground/70" />
                <h4 className="font-medium text-foreground tracking-tight">
                  {selectedLocation.name}
                </h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {selectedLocation.formatted_address}
              </p>
              {selectedLocation.types.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedLocation.types.slice(0, 2).map((type, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground"
                    >
                      {getPrimaryGoogleType([type]).replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Check className="h-5 w-5 text-foreground/70 flex-shrink-0 ml-3" />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          onClick={onSkip}
          variant="ghost"
          className="h-10 px-3 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Skip
        </Button>
        {selectedLocation && (
          <Button
            onClick={handleConfirmSelection}
            className="p-3 rounded-full bg-foreground text-background hover:opacity-90"
          >
            Select Location
          </Button>
        )}
      </div>
    </div>
  );
};

export default InlineLocationPicker;
