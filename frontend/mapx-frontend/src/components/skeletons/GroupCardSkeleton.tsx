import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

const GroupCardSkeleton: React.FC = () => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  return (
    <div 
      className="border rounded-lg p-4"
      style={selectedTheme ? {
        backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
        borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor,
      } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Skeleton className="h-6 w-6 rounded" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <div className="flex items-center space-x-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
};

export default GroupCardSkeleton;


