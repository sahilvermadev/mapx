import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Wrench, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import type { ContentType } from '@/components/composer/constants';

interface ContentTypeSelectionStepProps {
  onSelect: (contentType: ContentType) => void;
  onSkip?: () => void; // Allow skipping to default (place) flow
}

const ContentTypeSelectionStep: React.FC<ContentTypeSelectionStepProps> = ({
  onSelect,
  onSkip,
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left space-y-6 md:space-y-8 py-4 md:py-8"
    >
      <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
        <h1 
          className="text-2xl md:text-4xl lg:text-5xl font-light tracking-tight leading-tight"
          style={{ color: selectedTheme?.textPrimary || 'inherit' }}
        >
          What are you recommending?
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Place Option */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('place')}
            className="text-left p-6 md:p-8 rounded-lg border-2 transition-all hover:shadow-lg"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              borderColor: selectedTheme.borderColor || '#000000',
              boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : {
              backgroundColor: '#FFFFFF',
              borderColor: '#000000',
              boxShadow: '4px 4px 0 0 #000000',
            }}
          >
            <div className="flex items-start gap-4 mb-4">
              <div 
                className="p-3 rounded-lg border-2 flex-shrink-0"
                style={selectedTheme ? {
                  backgroundColor: accentColor,
                  borderColor: selectedTheme.borderColor || '#000000',
                } : {
                  backgroundColor: accentColor,
                  borderColor: '#000000',
                }}
              >
                <MapPin className="h-6 w-6 md:h-8 md:w-8" style={{ color: textOnAccent }} />
              </div>
              <div className="flex-1">
                <h2 
                  className="text-xl md:text-2xl font-semibold mb-2"
                  style={{ color: selectedTheme?.textPrimary || '#000000' }}
                >
                  A Place
                </h2>
                <p 
                  className="text-sm md:text-base"
                  style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
                >
                  Restaurant, hotel, shop, or any location
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span 
                className="text-xs md:text-sm font-medium"
                style={{ color: selectedTheme?.textMuted || '#6B7280' }}
              >
                Continue
              </span>
              <ArrowRight className="h-4 w-4" style={{ color: selectedTheme?.textMuted || '#6B7280' }} />
            </div>
          </motion.button>

          {/* Service Option */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect('service')}
            className="text-left p-6 md:p-8 rounded-lg border-2 transition-all hover:shadow-lg"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              borderColor: selectedTheme.borderColor || '#000000',
              boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : {
              backgroundColor: '#FFFFFF',
              borderColor: '#000000',
              boxShadow: '4px 4px 0 0 #000000',
            }}
          >
            <div className="flex items-start gap-4 mb-4">
              <div 
                className="p-3 rounded-lg border-2 flex-shrink-0"
                style={selectedTheme ? {
                  backgroundColor: accentColor,
                  borderColor: selectedTheme.borderColor || '#000000',
                } : {
                  backgroundColor: accentColor,
                  borderColor: '#000000',
                }}
              >
                <Wrench className="h-6 w-6 md:h-8 md:w-8" style={{ color: textOnAccent }} />
              </div>
              <div className="flex-1">
                <h2 
                  className="text-xl md:text-2xl font-semibold mb-2"
                  style={{ color: selectedTheme?.textPrimary || '#000000' }}
                >
                  A Service
                </h2>
                <p 
                  className="text-sm md:text-base"
                  style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
                >
                  Plumber, doctor, tutor, or any professional
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span 
                className="text-xs md:text-sm font-medium"
                style={{ color: selectedTheme?.textMuted || '#6B7280' }}
              >
                Continue
              </span>
              <ArrowRight className="h-4 w-4" style={{ color: selectedTheme?.textMuted || '#6B7280' }} />
            </div>
          </motion.button>
        </div>

        {onSkip && (
          <div className="flex justify-center pt-4">
            <Button
              variant="ghost"
              onClick={onSkip}
              className="text-sm"
              style={selectedTheme ? {
                color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
              } : undefined}
            >
              Skip (recommend a place)
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ContentTypeSelectionStep;








