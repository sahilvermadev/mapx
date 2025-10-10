import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const ReviewItemSkeleton: React.FC = () => {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
};

export default ReviewItemSkeleton;


