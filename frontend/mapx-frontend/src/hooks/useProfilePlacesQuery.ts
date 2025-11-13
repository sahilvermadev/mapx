import { useInfiniteQuery, useQuery, type UseQueryResult, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { profileApi, type FilterOptions, type SortOptions } from '@/services/profileService';

const PLACES_LIMIT = 20;

interface UseProfilePlacesQueryOptions {
  userId: string | undefined;
  tab: 'recommendations' | 'likes' | 'questions';
  filters?: FilterOptions;
  sort?: SortOptions;
}

type InfiniteQueryPage = {
  data: any[];
  nextPage: number | undefined;
  total: number;
};

// Union type for the return value
type ProfilePlacesQueryResult = 
  | UseQueryResult<any[], Error>
  | UseInfiniteQueryResult<InfiniteQueryPage, Error>;

export const useProfilePlacesQuery = ({
  userId,
  tab,
  filters = {},
  sort = { field: 'created_at', direction: 'desc' },
}: UseProfilePlacesQueryOptions): ProfilePlacesQueryResult => {
  const queryStartTime = performance.now();
  
  if (import.meta.env.DEV) {
    console.log(`🔄 [PERF] useProfilePlacesQuery hook called - tab: ${tab}, userId: ${userId}`);
    performance.mark(`places-query-start-${tab}-${userId}`);
  }
  
  // Questions don't support pagination yet, so use regular query
  const questionsQuery = useQuery<any[], Error>({
    queryKey: ['profile', userId, 'places', 'questions'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const apiStartTime = performance.now();
      if (import.meta.env.DEV) {
        console.log(`📝 [REACT-QUERY] Fetching user questions...`);
        performance.mark(`questions-api-start-${userId}`);
      }
      
      const result = await profileApi.getUserQuestions(userId);
      
      if (import.meta.env.DEV) {
        const apiEndTime = performance.now();
        const apiDuration = apiEndTime - apiStartTime;
        console.log(`✅ [REACT-QUERY] questions API call completed in ${apiDuration.toFixed(2)}ms`);
        performance.mark(`questions-api-end-${userId}`);
        performance.measure(`questions-api-${userId}`, `questions-api-start-${userId}`, `questions-api-end-${userId}`);
      }
      
      return result.data || [];
    },
    enabled: !!userId && tab === 'questions',
    staleTime: 60 * 1000, // 1 minute - questions change occasionally
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      if (import.meta.env.DEV) {
        const totalTime = performance.now() - queryStartTime;
        console.log(`✅ [PERF] useProfilePlacesQuery (questions) completed in ${totalTime.toFixed(2)}ms (${data.length} items)`);
      }
    },
  });

  // Recommendations and likes use infinite query for pagination
  const infiniteQuery = useInfiniteQuery<InfiniteQueryPage, Error>({
    queryKey: ['profile', userId, 'places', tab, filters, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) throw new Error('User ID is required');
      
      const apiStartTime = performance.now();
      if (import.meta.env.DEV) {
        console.log(`📝 [REACT-QUERY] Fetching user ${tab} (page ${pageParam})...`);
        performance.mark(`${tab}-api-start-${userId}-${pageParam}`);
      }
      
      let result;
      if (tab === 'recommendations') {
        result = await profileApi.getUserRecommendations(
          userId,
          filters,
          sort,
          { limit: PLACES_LIMIT, offset: pageParam }
        );
      } else {
        // likes
        result = await profileApi.getUserLikes(
          userId,
          sort,
          { limit: PLACES_LIMIT, offset: pageParam }
        );
      }
      
      if (import.meta.env.DEV) {
        const apiEndTime = performance.now();
        const apiDuration = apiEndTime - apiStartTime;
        console.log(`✅ [REACT-QUERY] ${tab} API call completed in ${apiDuration.toFixed(2)}ms (page ${pageParam}, ${result.data?.length || 0} items)`);
        performance.mark(`${tab}-api-end-${userId}-${pageParam}`);
        performance.measure(`${tab}-api-${userId}-${pageParam}`, `${tab}-api-start-${userId}-${pageParam}`, `${tab}-api-end-${userId}-${pageParam}`);
      }
      
      return {
        data: result.data || [],
        nextPage: result.pagination?.total && (pageParam + result.data.length) < result.pagination.total
          ? pageParam + result.data.length
          : undefined,
        total: result.pagination?.total || 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!userId && tab !== 'questions',
    staleTime: 30 * 1000, // 30 seconds - places change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      if (import.meta.env.DEV) {
        const totalTime = performance.now() - queryStartTime;
        const totalItems = data.pages.reduce((sum, page) => sum + (page.data?.length || 0), 0);
        console.log(`✅ [PERF] useProfilePlacesQuery (${tab}) completed in ${totalTime.toFixed(2)}ms (${data.pages.length} pages, ${totalItems} total items)`);
      }
    },
  });

  // Return the appropriate query based on tab
  if (tab === 'questions') {
    return questionsQuery as ProfilePlacesQueryResult;
  }
  
  return infiniteQuery as ProfilePlacesQueryResult;
};

