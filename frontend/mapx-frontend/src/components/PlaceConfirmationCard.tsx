import React from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';

interface PlaceConfirmationCardProps {
  place: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    image?: string;
  };
  onSelect: () => void;
}

const PlaceConfirmationCard: React.FC<PlaceConfirmationCardProps> = ({
  place,
  onSelect,
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  return (
    <div
      className="h-full flex flex-col overflow-hidden md:rounded-lg md:border-2"
      style={selectedTheme ? {
        backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
        borderColor: selectedTheme.borderColor || '#000000',
      } : {
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
      }}
    >
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 md:space-y-4 overscroll-contain">
        {/* Place Image */}
        {place.image && (
          <div 
            className="w-full rounded-xl md:rounded-lg overflow-hidden border-2 -mx-4 md:mx-0"
            style={{
              borderColor: selectedTheme?.borderColor || '#000000',
              aspectRatio: '16/9',
            }}
          >
            <img
              src={place.image}
              alt={place.name}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* Place Details */}
        <div className="space-y-3 md:space-y-3">
          <h4
            className="text-xl md:text-2xl font-semibold leading-tight"
            style={{ color: selectedTheme?.textPrimary || '#000000' }}
          >
            {place.name}
          </h4>
          <div className="flex items-start gap-2.5 md:gap-3 text-sm md:text-base leading-relaxed">
            <MapPin
              className="h-4 w-4 md:h-5 md:w-5 mt-0.5 flex-shrink-0"
              style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
            />
            <p
              className="leading-relaxed flex-1"
              style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
            >
              {place.address}
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div 
        className="p-4 md:p-5 border-t-2 flex-shrink-0 bg-inherit"
        style={selectedTheme ? {
          borderColor: selectedTheme.borderColor || '#000000',
          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
        } : undefined}
      >
        <Button
          onClick={onSelect}
          className="w-full h-12 md:h-12 rounded-xl md:rounded-lg border-2 font-semibold text-base md:text-base touch-manipulation"
          style={selectedTheme ? {
            backgroundColor: accentColor,
            color: textOnAccent,
            borderColor: selectedTheme.borderColor || '#000000',
            boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : undefined}
        >
          Select Place
        </Button>
      </div>
    </div>
  );
};

export default PlaceConfirmationCard;

