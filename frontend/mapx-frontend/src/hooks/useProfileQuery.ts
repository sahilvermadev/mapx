import { useQuery } from '@tanstack/react-query';
import { profileApi, type UserData } from '@/services/profileService';

export const useProfileQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      if (import.meta.env.DEV) {
        console.log('👤 [REACT-QUERY] Fetching user profile...');
      }
      const startTime = performance.now();
      
      const profileData = await profileApi.getUserProfile(userId);
      
      if (import.meta.env.DEV) {
        const endTime = performance.now();
        console.log(`✅ [REACT-QUERY] Profile API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return profileData;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes - profile data doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

