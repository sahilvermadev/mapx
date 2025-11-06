import { useQuery } from '@tanstack/react-query';
import { profileApi, type ProfilePreferences } from '@/services/profileService';

export const useProfilePreferencesQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', userId, 'preferences'],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      console.log('🎨 [REACT-QUERY] Fetching user preferences...');
      const startTime = performance.now();
      
      const prefs = await profileApi.getUserPreferences(userId);
      
      const endTime = performance.now();
      console.log(`✅ [REACT-QUERY] Preferences API call completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      return prefs;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - preferences change rarely
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
};

