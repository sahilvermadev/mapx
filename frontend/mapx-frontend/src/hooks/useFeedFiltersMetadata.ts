import { useQuery } from '@tanstack/react-query';
import { feedApi, type FeedFilterMetadata } from '@/services/feedService';

const FEED_FILTERS_STALE_TIME = 10 * 60 * 1000; // 10 minutes
const FEED_FILTERS_GC_TIME = 30 * 60 * 1000; // 30 minutes

export const buildFeedFiltersQueryKey = (currentUserId: string) =>
  ['feed-filters', currentUserId] as const;

export const useFeedFiltersMetadata = (currentUserId: string | undefined) => {
  return useQuery({
    queryKey: buildFeedFiltersQueryKey(currentUserId || ''),
    enabled: !!currentUserId,
    staleTime: FEED_FILTERS_STALE_TIME,
    gcTime: FEED_FILTERS_GC_TIME,
    queryFn: async (): Promise<FeedFilterMetadata> => {
      if (!currentUserId) {
        throw new Error('Missing currentUserId for feed filters');
      }
      const response = await feedApi.getFeedFilters(currentUserId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to load feed filters');
      }
      return response.data;
    },
  });
};










