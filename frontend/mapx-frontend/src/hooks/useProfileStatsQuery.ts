import { useQuery } from '@tanstack/react-query';
import { profileApi, type UserStats } from '@/services/profileService';

export const useProfileStatsQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', userId, 'stats'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      if (import.meta.env.DEV) {
        console.log('📊 [REACT-QUERY] Fetching user stats...');
      }
      const startTime = performance.now();
      
      const stats = await profileApi.getUserStats(userId);
      
      if (import.meta.env.DEV) {
        const endTime = performance.now();
        console.log(`✅ [REACT-QUERY] Stats API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return stats;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes - stats change occasionally
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

