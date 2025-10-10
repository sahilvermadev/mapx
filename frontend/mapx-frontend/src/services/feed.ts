import { apiClient, type ApiResponse } from './api';
import type { FeedPost } from './social';

// Feed API service
export const feedApi = {
  // Main social feed
  async getFeed(currentUserId: string, limit: number = 20, offset: number = 0, groupIds?: number[]): Promise<ApiResponse<FeedPost[]>> {
    console.log('=== FEED API CALL ===');
    console.log('feedApi.getFeed - currentUserId:', currentUserId);
    console.log('feedApi.getFeed - limit:', limit);
    console.log('feedApi.getFeed - offset:', offset);
    console.log('feedApi.getFeed - groupIds:', groupIds);
    
    const params: any = { currentUserId, limit, offset };
    if (groupIds && groupIds.length > 0) {
      params.groupIds = groupIds.join(',');
    }
    
    const response = await apiClient.get('/feed', params);
    console.log('feedApi.getFeed - raw response:', response);
    
    // Transform the response to match expected structure
    if (response.success && response.data) {
      const posts = Array.isArray(response.data) ? response.data : (response.data as any).posts || [];
      console.log('feedApi.getFeed - transformed posts:', posts);
      console.log('feedApi.getFeed - posts count:', posts.length);
      return {
        ...response,
        data: posts
      };
    }
    console.log('feedApi.getFeed - no data in response');
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