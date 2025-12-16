import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import EmbeddedMap from '@/components/EmbeddedMap';
import ErrorBoundary from '@/components/ErrorBoundary';

interface MapStepProps {
  onBack: () => void;
  onPlaceSelected: (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
  }) => void;
}

const MapStep: React.FC<MapStepProps> = ({ onBack, onPlaceSelected }) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left h-full flex flex-col w-full"
    >
      {/* Mobile: Full screen layout without container */}
      <div className="md:hidden w-full h-full flex flex-col">
        <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-1">
          <h1 
            className="text-xl font-semibold tracking-tight leading-tight"
            style={{ color: selectedTheme?.textPrimary || '#FFFFFF' }}
          >
            Find the place
          </h1>
          <p 
            className="text-sm leading-relaxed"
            style={{ color: selectedTheme?.textPrimary || '#FFFFFF' }}
          >
            Search and discover locations near you
          </p>
        </div>

        <div className="flex-1 min-h-0 w-full relative px-4 md:px-0">
          <ErrorBoundary fallback={
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <p className="text-sm mb-4" style={{ color: selectedTheme?.textPrimary || '#FFFFFF' }}>
                Map failed to load. Please try again.
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="text-sm"
                style={selectedTheme ? {
                  backgroundColor: selectedTheme.buttonPrimary?.background || selectedTheme.accentColor,
                  color: selectedTheme.buttonPrimary?.text || selectedTheme.backgroundColor,
                  borderColor: selectedTheme.borderColor,
                } : undefined}
              >
                Reload
              </Button>
            </div>
          }>
            <EmbeddedMap 
              onPlaceSelected={onPlaceSelected}
              height="100%"
            />
          </ErrorBoundary>
        </div>

        <div className="flex justify-center py-3 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-sm"
            style={selectedTheme ? {
              color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
            } : undefined}
          >
            Back
          </Button>
        </div>
      </div>

      {/* Desktop: Container layout */}
      <div className="hidden md:flex max-w-7xl mx-auto w-full h-full flex-col space-y-3 md:space-y-4 py-3 md:py-4">
        <div className="flex-shrink-0">
          <h1 
            className="text-xl md:text-3xl lg:text-4xl font-light tracking-tight leading-tight mb-1 md:mb-2"
            style={{ color: selectedTheme?.textPrimary || 'inherit' }}
          >
            Find the place on the map
          </h1>

          <p 
            className="text-sm md:text-base"
            style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
          >
            Search for the place you want to recommend or click on the map to select it.
          </p>
        </div>

        <div className="flex-1 min-h-0 w-full">
          <ErrorBoundary fallback={
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <p className="text-sm mb-4" style={{ color: selectedTheme?.textPrimary || 'inherit' }}>
                Map failed to load. Please try again.
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="text-sm"
                style={selectedTheme ? {
                  backgroundColor: selectedTheme.buttonPrimary?.background || selectedTheme.accentColor,
                  color: selectedTheme.buttonPrimary?.text || selectedTheme.backgroundColor,
                  borderColor: selectedTheme.borderColor,
                } : undefined}
              >
                Reload
              </Button>
            </div>
          }>
            <EmbeddedMap 
              onPlaceSelected={onPlaceSelected}
              height="100%"
            />
          </ErrorBoundary>
        </div>

        <div className="flex justify-center pt-1 md:pt-2 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-sm"
            style={selectedTheme ? {
              color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
            } : undefined}
          >
            Back
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default MapStep;

