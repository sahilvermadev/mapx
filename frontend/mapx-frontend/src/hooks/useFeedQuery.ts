import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '@/services/feedService';

// Constants
const FEED_LIMIT = 20;

export const useFeedQuery = (
  currentUserId: string,
  selectedGroupIds: number[] = [],
  opts?: { citySlug?: string; countryCode?: string; category?: string; includeQna?: boolean }
) => {
  return useInfiniteQuery({
    queryKey: ['feed', currentUserId, selectedGroupIds, opts?.citySlug, opts?.countryCode, opts?.category, opts?.includeQna ?? true],
    initialPageParam: null as { createdAt: string; id: number } | null,
    queryFn: async ({ pageParam }) => {
      const startTime = performance.now();
      
      let response;
      const cursorOpts = pageParam ? {
        cursorCreatedAt: pageParam.createdAt,
        cursorId: pageParam.id,
        includeQna: opts?.includeQna ?? true,
        citySlug: opts?.citySlug,
        countryCode: opts?.countryCode,
        category: opts?.category
      } : {
        includeQna: opts?.includeQna ?? true,
        citySlug: opts?.citySlug,
        countryCode: opts?.countryCode,
        category: opts?.category
      };
      
      if (selectedGroupIds.length > 0) {
        response = await feedApi.getFeed(currentUserId, FEED_LIMIT, 0, selectedGroupIds, cursorOpts);
      } else {
        response = await feedApi.getFeed(currentUserId, FEED_LIMIT, 0, undefined, cursorOpts);
      }
      
      const endTime = performance.now();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load feed');
      }
      
      const pagination = (response as any).pagination;
      const data = response.data || [];
      
      // Use backend's pagination info to determine next page
      // If backend says hasNext and provides nextCursor, use it
      // Otherwise, check if we got a full page (which might indicate more data)
      const nextCursor = pagination?.nextCursor;
      const hasNext = pagination?.hasNext ?? (data.length === FEED_LIMIT);
      
      return {
        data,
        nextPage: hasNext && nextCursor ? { createdAt: nextCursor.createdAt, id: nextCursor.id } : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!currentUserId,
    staleTime: 30 * 1000, // 30 seconds - very responsive updates
    gcTime: 15 * 60 * 1000, // 15 minutes - increased for better caching
    retry: 1,
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: true, // Refetch when component mounts to get latest data
  });
};
