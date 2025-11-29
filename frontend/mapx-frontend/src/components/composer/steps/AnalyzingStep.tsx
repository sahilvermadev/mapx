import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

export const AnalyzingStep: React.FC = () => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#FCD34D';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center space-y-8 py-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <div 
              className="animate-spin rounded-full h-16 w-16 border-2 border-t-transparent"
              style={selectedTheme ? {
                borderColor: selectedTheme.borderColor || '#000000',
              } : undefined}
            ></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-4 h-4"
                style={{ backgroundColor: accentColor }}
              ></div>
            </div>
          </div>
        </div>

        <h1 
          className="text-4xl font-semibold leading-tight"
          style={{ color: selectedTheme?.textPrimary || '#000000' }}
        >
          Analyzing
        </h1>
      </div>
    </motion.div>
  );
};

export default AnalyzingStep;






