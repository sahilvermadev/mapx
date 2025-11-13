import { useQuery } from '@tanstack/react-query';
import { profileApi, type UserData } from '@/services/profileService';

export const useProfileQuery = (userId: string | undefined) => {
  const queryStartTime = performance.now();
  
  if (import.meta.env.DEV) {
    console.log(`🔄 [PERF] useProfileQuery hook called for userId: ${userId}`);
    performance.mark(`profile-query-start-${userId}`);
  }
  
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const apiStartTime = performance.now();
      if (import.meta.env.DEV) {
        console.log('👤 [REACT-QUERY] Fetching user profile...');
        performance.mark(`profile-api-start-${userId}`);
      }
      
      const profileData = await profileApi.getUserProfile(userId);
      
      if (import.meta.env.DEV) {
        const apiEndTime = performance.now();
        const apiDuration = apiEndTime - apiStartTime;
        console.log(`✅ [REACT-QUERY] Profile API call completed in ${apiDuration.toFixed(2)}ms`);
        performance.mark(`profile-api-end-${userId}`);
        performance.measure(`profile-api-${userId}`, `profile-api-start-${userId}`, `profile-api-end-${userId}`);
      }
      
      return profileData;
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes - profile data doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      if (import.meta.env.DEV) {
        const totalTime = performance.now() - queryStartTime;
        console.log(`✅ [PERF] useProfileQuery completed in ${totalTime.toFixed(2)}ms`);
      }
    },
  });
};

