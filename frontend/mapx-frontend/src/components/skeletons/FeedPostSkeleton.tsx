import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

interface FeedPostSkeletonProps {
  noOuterSpacing?: boolean;
}

const FeedPostSkeleton: React.FC<FeedPostSkeletonProps> = ({ noOuterSpacing }) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  return (
    <article className={noOuterSpacing ? 'w-full' : 'w-full border-b pb-6 mb-6 last:border-b-0'} style={selectedTheme ? { borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor } : undefined}>
      <div 
        className="rounded-lg p-6 shadow-sm border"
        style={selectedTheme ? {
          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
          borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor,
        } : undefined}
      >
        <div className="flex items-start space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-[200px]" />
            {/* <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-20 w-full" /> */}
            {/* <div className="flex space-x-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div> */}
          </div>
        </div>
      </div>
    </article>
  );
};

export default FeedPostSkeleton;


