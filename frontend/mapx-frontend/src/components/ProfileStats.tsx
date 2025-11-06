import React from 'react';
import { Star, MapPin, FileText } from 'lucide-react';
import type { UserStats } from '@/services/profileService';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileStatsProps {
  stats: UserStats | null;
  loading?: boolean;
  accentColor: string;
  textOnAccent: string;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ 
  stats, 
  loading = false,
  accentColor,
  textOnAccent 
}) => {
  if (loading || !stats) {
    return (
      <div className="flex gap-3 mb-6">
        <Skeleton className="h-16 flex-1 rounded-md" />
        <Skeleton className="h-16 flex-1 rounded-md" />
        <Skeleton className="h-16 w-32 rounded-md" />
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  return (
    <div className="flex gap-3 mb-6">
      {/* Recommendations */}
      <div 
        className="flex-1 rounded-md border border-black bg-white px-4 py-3 shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
      >
        <div className="flex items-center gap-3">
          <div 
            className="rounded-md border border-black/30 p-1.5"
            style={{
              backgroundColor: accentColor + '20',
              borderColor: accentColor
            }}
          >
            <Star 
              className="h-4 w-4"
              style={{ color: accentColor }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div 
              className="text-lg font-bold"
              style={{ color: accentColor }}
            >
              {formatNumber(stats.total_recommendations)}
            </div>
            <div className="text-xs text-gray-600">
              Recommendations
            </div>
          </div>
        </div>
      </div>

      {/* Places Visited */}
      <div 
        className="flex-1 rounded-md border border-black bg-white px-4 py-3 shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
      >
        <div className="flex items-center gap-3">
          <div 
            className="rounded-md border border-black/30 p-1.5"
            style={{
              backgroundColor: accentColor + '20',
              borderColor: accentColor
            }}
          >
            <MapPin 
              className="h-4 w-4"
              style={{ color: accentColor }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div 
              className="text-lg font-bold"
              style={{ color: accentColor }}
            >
              {formatNumber(stats.total_places_visited)}
            </div>
            <div className="text-xs text-gray-600">
              Places Visited
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Written */}
      <div 
        className="w-32 rounded-md border border-black bg-white px-4 py-3 shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
      >
        <div className="flex flex-col items-center gap-1">
          <div 
            className="rounded-md border border-black/30 p-1.5"
            style={{
              backgroundColor: accentColor + '20',
              borderColor: accentColor
            }}
          >
            <FileText 
              className="h-4 w-4"
              style={{ color: accentColor }}
            />
          </div>
          <div 
            className="text-lg font-bold text-center"
            style={{ color: accentColor }}
          >
            {formatNumber(stats.total_reviews)}
          </div>
          <div className="text-xs text-gray-600 text-center leading-tight">
            Reviews
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileStats;

