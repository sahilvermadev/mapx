import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '@/services/feedService';
import type { FeedPost } from '@/services/socialService';

// Constants
const FEED_LIMIT = 20;

export const useFeedQuery = (currentUserId: string, selectedGroupIds: number[] = []) => {
  return useInfiniteQuery({
    queryKey: ['feed', currentUserId, selectedGroupIds],
    queryFn: async ({ pageParam = 0 }) => {
      console.log('📰 [REACT-QUERY] Fetching feed data...', { page: pageParam });
      const startTime = performance.now();
      
      let response;
      if (selectedGroupIds.length > 0) {
        response = await feedApi.getFeed(currentUserId, FEED_LIMIT, pageParam, selectedGroupIds);
      } else {
        response = await feedApi.getFeed(currentUserId, FEED_LIMIT, pageParam);
      }
      
      const endTime = performance.now();
      console.log(`🌐 [REACT-QUERY] Feed API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load feed');
      }
      
      return {
        data: response.data as FeedPost[],
        nextPage: response.data.length === FEED_LIMIT ? pageParam + FEED_LIMIT : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!currentUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
};
