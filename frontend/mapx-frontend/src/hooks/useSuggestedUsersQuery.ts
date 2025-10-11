import { useQuery } from '@tanstack/react-query';
import { socialApi } from '@/services/social';
import type { User } from '@/services/social';

// Constants
const SUGGESTED_USERS_LIMIT = 5;

export const useSuggestedUsersQuery = (currentUserId: string) => {
  return useQuery({
    queryKey: ['suggestedUsers', currentUserId],
    queryFn: async () => {
      console.log('👥 [REACT-QUERY] Fetching suggested users...');
      const startTime = performance.now();
      
      const response = await socialApi.getSuggestedUsers(currentUserId, SUGGESTED_USERS_LIMIT);
      
      const endTime = performance.now();
      console.log(`🌐 [REACT-QUERY] Suggested users API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load suggested users');
      }
      
      return response.data as User[];
    },
    enabled: !!currentUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
};
