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
  // Questions don't support pagination yet, so use regular query
  const questionsQuery = useQuery<any[], Error>({
    queryKey: ['profile', userId, 'places', 'questions'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      if (import.meta.env.DEV) {
        console.log(`📝 [REACT-QUERY] Fetching user questions...`);
      }
      const startTime = performance.now();
      
      const result = await profileApi.getUserQuestions(userId);
      
      if (import.meta.env.DEV) {
        const endTime = performance.now();
        console.log(`✅ [REACT-QUERY] questions API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return result.data || [];
    },
    enabled: !!userId && tab === 'questions',
    staleTime: 60 * 1000, // 1 minute - questions change occasionally
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Recommendations and likes use infinite query for pagination
  const infiniteQuery = useInfiniteQuery<InfiniteQueryPage, Error>({
    queryKey: ['profile', userId, 'places', tab, filters, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) throw new Error('User ID is required');
      
      if (import.meta.env.DEV) {
        console.log(`📝 [REACT-QUERY] Fetching user ${tab} (page ${pageParam})...`);
      }
      const startTime = performance.now();
      
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
        const endTime = performance.now();
        console.log(`✅ [REACT-QUERY] ${tab} API call completed in ${(endTime - startTime).toFixed(2)}ms`);
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
  });

  // Return the appropriate query based on tab
  if (tab === 'questions') {
    return questionsQuery as ProfilePlacesQueryResult;
  }
  
  return infiniteQuery as ProfilePlacesQueryResult;
};

