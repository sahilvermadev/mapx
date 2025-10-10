import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const HeaderSkeleton: React.FC = () => {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-4 p-6 bg-card rounded-lg border">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </section>
  );
};

export default HeaderSkeleton;


