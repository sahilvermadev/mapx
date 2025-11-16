import { useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '@/services/socialService';

export const useFollowMutation = (currentUserId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      console.log('❤️ [REACT-QUERY] Starting follow action...');
      const startTime = performance.now();
      
      const response = await socialApi.followUser(userId, currentUserId);
      
      const endTime = performance.now();
      console.log(`✅ [REACT-QUERY] Follow action completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to follow user');
      }
      
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch both feed and suggested users
      // Use partial matching to invalidate all feed queries for this user
      queryClient.invalidateQueries({ 
        queryKey: ['feed', currentUserId],
        exact: false 
      });
      queryClient.invalidateQueries({ queryKey: ['suggestedUsers', currentUserId] });
      // Invalidate reviewed places so map markers update when following users
      queryClient.invalidateQueries({ 
        queryKey: ['reviewedPlaces', currentUserId],
        exact: false 
      });
    },
    onError: (error) => {
      console.error('❌ [REACT-QUERY] Follow action failed:', error);
    },
  });
};
