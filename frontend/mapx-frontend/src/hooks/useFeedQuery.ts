import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '@/services/feedService';

// Constants
const FEED_LIMIT = 20;

export type FeedQueryOpts = {
  citySlug?: string;
  countryCode?: string;
  category?: string;
  includeQna?: boolean;
};

export type FeedPageCursor = { createdAt: string; id: number } | null;

/**
 * Build the canonical React Query key for all feed queries.
 * Any changes here MUST stay in sync with the server-side feed semantics.
 */
export const buildFeedQueryKey = (
  currentUserId: string,
  selectedGroupIds: number[] = [],
  opts?: FeedQueryOpts
) =>
  [
    'feed',
    currentUserId,
    selectedGroupIds,
    opts?.citySlug,
    opts?.countryCode,
    opts?.category,
    opts?.includeQna ?? true,
  ] as const;

/**
 * Canonical function for fetching a single page of the feed.
 * Both the live feed hook and early prefetch in App.tsx call this so we
 * have a single source of truth for pagination and cursor handling.
 */
export const fetchFeedPage = async (params: {
  currentUserId: string;
  selectedGroupIds?: number[];
  opts?: FeedQueryOpts;
  pageParam: FeedPageCursor;
  logPerf?: boolean;
}) => {
  const {
    currentUserId,
    selectedGroupIds = [],
    opts,
    pageParam,
    logPerf = true,
  } = params;

  const startTime = performance.now();
  if (logPerf && import.meta.env.DEV) {
    console.log(
      `[PERF] useFeedQuery: Starting fetch${pageParam ? ' (next page)' : ' (initial)'}`
    );
  }

  const cursorOpts = pageParam
    ? {
        cursorCreatedAt: pageParam.createdAt,
        cursorId: pageParam.id,
        includeQna: opts?.includeQna ?? true,
        citySlug: opts?.citySlug,
        countryCode: opts?.countryCode,
        category: opts?.category,
      }
    : {
        includeQna: opts?.includeQna ?? true,
        citySlug: opts?.citySlug,
        countryCode: opts?.countryCode,
        category: opts?.category,
      };

  const apiStartTime = performance.now();
  const response =
    selectedGroupIds.length > 0
      ? await feedApi.getFeed(currentUserId, FEED_LIMIT, 0, selectedGroupIds, cursorOpts)
      : await feedApi.getFeed(currentUserId, FEED_LIMIT, 0, undefined, cursorOpts);
  const apiTime = performance.now() - apiStartTime;

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  if (!response.success) {
    if (logPerf && import.meta.env.DEV) {
      console.error(
        `[PERF] useFeedQuery: API call failed after ${totalTime.toFixed(
          2
        )}ms`
      );
    }
    throw new Error(response.error || 'Failed to load feed');
  }

  const pagination = (response as any).pagination;
  const data = response.data || [];

  // Use backend's pagination info to determine next page
  // If backend says hasNext and provides nextCursor, use it
  // Otherwise, check if we got a full page (which might indicate more data)
  const nextCursor = pagination?.nextCursor;
  const hasNext = pagination?.hasNext ?? data.length === FEED_LIMIT;

  if (logPerf && import.meta.env.DEV) {
    console.log(
      `[PERF] useFeedQuery: Completed in ${totalTime.toFixed(
        2
      )}ms (API: ${apiTime.toFixed(
        2
      )}ms, processing: ${(totalTime - apiTime).toFixed(
        2
      )}ms), received ${data.length} posts`
    );
  }

  return {
    data,
    nextPage:
      hasNext && nextCursor
        ? { createdAt: nextCursor.createdAt, id: nextCursor.id }
        : undefined,
  };
};

export const useFeedQuery = (
  currentUserId: string,
  selectedGroupIds: number[] = [],
  opts?: FeedQueryOpts
) => {
  return useInfiniteQuery({
    queryKey: buildFeedQueryKey(currentUserId, selectedGroupIds, opts),
    initialPageParam: null as FeedPageCursor,
    queryFn: ({ pageParam }) =>
      fetchFeedPage({
        currentUserId,
        selectedGroupIds,
        opts,
        pageParam,
        logPerf: true,
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!currentUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes - reduce unnecessary refetches
    gcTime: 15 * 60 * 1000, // 15 minutes - increased for better caching
    retry: 1,
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    // Allow refetch on mount when data is stale so that flows which
    // invalidate ['feed'] while the feed page is unmounted (e.g. posting
    // an answer from the composer) will fetch fresh data when the user
    // returns to /feed.
  });
};
