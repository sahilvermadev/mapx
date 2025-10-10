import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface FeedPostSkeletonProps {
  noOuterSpacing?: boolean;
}

const FeedPostSkeleton: React.FC<FeedPostSkeletonProps> = ({ noOuterSpacing }) => {
  return (
    <article className={noOuterSpacing ? 'w-full' : 'w-full border-b border-border/50 pb-6 mb-6 last:border-b-0'}>
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex items-start space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-20 w-full" />
            <div className="flex space-x-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default FeedPostSkeleton;


