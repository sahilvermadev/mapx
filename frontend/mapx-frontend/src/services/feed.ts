import { apiClient, type ApiResponse } from './apiClient';
import type { FeedPost } from './social';

// Feed API service
export const feedApi = {
  // Main social feed
  async getFeed(currentUserId: string, limit: number = 20, offset: number = 0, groupIds?: number[]): Promise<ApiResponse<FeedPost[]>> {
    const params: any = { currentUserId, limit, offset };
    if (groupIds && groupIds.length > 0) {
      params.groupIds = groupIds.join(',');
    }
    
    const response = await apiClient.get('/feed', params);
    
    // Transform the response to match expected structure
    if (response.success && response.data) {
      const posts = Array.isArray(response.data) ? response.data : (response.data as any).posts || [];
      return {
        ...response,
        data: posts
      };
    }
    return response as ApiResponse<FeedPost[]>;
  },

  // Friends-only feed
  async getFriendsFeed(currentUserId: string, limit: number = 20, offset: number = 0): Promise<ApiResponse<FeedPost[]>> {
    const response = await apiClient.get('/feed/friends', { currentUserId, limit, offset });
    // Transform the response to match expected structure
    if (response.success && response.data) {
      const posts = Array.isArray(response.data) ? response.data : (response.data as any).posts || [];
      return {
        ...response,
        data: posts
      };
    }
    return response as ApiResponse<FeedPost[]>;
  },

  // Category-filtered feed
  async getCategoryFeed(category: string, currentUserId: string, limit: number = 20, offset: number = 0): Promise<ApiResponse<FeedPost[]>> {
    const response = await apiClient.get(`/feed/category/${category}`, { currentUserId, limit, offset });
    // Transform the response to match expected structure
    if (response.success && response.data) {
      const posts = Array.isArray(response.data) ? response.data : (response.data as any).posts || [];
      return {
        ...response,
        data: posts
      };
    }
    return response as ApiResponse<FeedPost[]>;
  },
}; 