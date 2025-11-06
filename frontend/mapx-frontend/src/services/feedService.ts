import { apiClient, type ApiResponse } from './apiClient';
import type { FeedPost } from './socialService';

// Feed API service
export const feedApi = {
  // Main social feed
  async getFeed(
    currentUserId: string,
    limit: number = 20,
    offset: number = 0,
    groupIds?: number[],
    opts?: { includeQna?: boolean; citySlug?: string; countryCode?: string; category?: string; cursorCreatedAt?: string; cursorId?: number }
  ): Promise<ApiResponse<FeedPost[]>> {
    const params: any = { currentUserId, limit };
    // Use cursor-based pagination if provided, otherwise use offset
    if (opts?.cursorCreatedAt && opts?.cursorId) {
      params.cursorCreatedAt = opts.cursorCreatedAt;
      params.cursorId = opts.cursorId;
    } else {
      params.offset = offset;
    }
    if (opts?.includeQna ?? true) params.includeQna = true;
    if (opts?.citySlug) params.city_slug = opts.citySlug;
    if (opts?.countryCode) params.country_code = opts.countryCode;
    if (opts?.category) params.category = opts.category;
    if (groupIds && groupIds.length > 0) {
      params.groupIds = groupIds.join(',');
    }
    const response = await apiClient.get('/feed', params);
    
    // Transform the response to match expected structure
    if (response.success && response.data) {
      const posts = Array.isArray(response.data) ? response.data : (response.data as any).posts || [];
      return {
        ...response,
        data: posts,
        pagination: (response as any).pagination // Include pagination info from backend
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