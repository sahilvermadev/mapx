import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { recommendationsApi, type ReviewedPlace } from '@/services/recommendationsApiService';

export const useReviewedPlacesQuery = (
  userId: string | undefined,
  selectedGroupIds: number[] = [],
  enabled: boolean = true
) => {
  // Stabilize groupIds array for query key to prevent unnecessary refetches
  // when array reference changes but contents are the same
  const stableGroupIds = useMemo(() => {
    return selectedGroupIds.length > 0 
      ? [...selectedGroupIds].sort((a, b) => a - b).join(',')
      : '';
  }, [selectedGroupIds]);

  return useQuery<ReviewedPlace[]>({
    queryKey: ['reviewedPlaces', userId, stableGroupIds],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const places = await recommendationsApi.getReviewedPlaces(
        'friends',
        200,
        0,
        selectedGroupIds.length > 0 ? selectedGroupIds : undefined
      );
      
      return places;
    },
    enabled: enabled && !!userId,
    staleTime: 30 * 1000, // 30 seconds - places can change when users are followed
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

