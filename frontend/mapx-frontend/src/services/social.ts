import { apiClient, type ApiResponse } from './api';

// Types for social features
export interface User {
  id: string;
  display_name: string;
  email: string;
  profile_picture_url?: string;
  created_at: string;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
  is_blocked?: boolean;
}

export interface Comment {
  id: number;
  annotation_id: number;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_picture?: string;
  likes_count?: number;
  is_liked_by_current_user?: boolean;
  replies?: Comment[];
}

export interface PrivacySettings {
  profile_visibility: 'public' | 'private';
  allow_follow_requests: boolean;
  show_location_in_feed: boolean;
  allow_messages: boolean;
}

export interface FeedPost {
  annotation_id: number;
  place_id: number;
  notes: string;
  rating: number;
  visit_date?: string;
  visibility: string;
  created_at: string;
  labels?: string[];
  metadata: any;
  place_name: string;
  place_address: string;
  place_lat: number;
  place_lng: number;
  google_place_id?: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  comments_count: string;
  likes_count: number;
  is_liked_by_current_user: boolean;
  is_saved?: boolean;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
}

// Social API service
export const socialApi = {
  // User search and discovery
  async searchUsers(query: string, currentUserId: string): Promise<ApiResponse<User[]>> {
    return apiClient.get('/social/users/search', { q: query, currentUserId });
  },

  async getSuggestedUsers(currentUserId: string, limit: number = 10): Promise<ApiResponse<User[]>> {
    return apiClient.get('/social/users/suggestions', { currentUserId, limit });
  },

  // Follow/unfollow functionality
  async followUser(targetUserId: string, currentUserId: string): Promise<ApiResponse<{ following: boolean }>> {
    return apiClient.post(`/social/follow/${targetUserId}`, { currentUserId });
  },

  async unfollowUser(targetUserId: string, currentUserId: string): Promise<ApiResponse<{ unfollowing: boolean }>> {
    return apiClient.delete(`/social/unfollow/${targetUserId}`, { currentUserId });
  },

  async getFollowers(userId: string, currentUserId: string, limit: number = 20, offset: number = 0): Promise<ApiResponse<{ users: User[], pagination: PaginationInfo }>> {
    return apiClient.get(`/social/users/${userId}/followers`, { currentUserId, limit, offset });
  },

  async getFollowing(userId: string, currentUserId: string, limit: number = 20, offset: number = 0): Promise<ApiResponse<{ users: User[], pagination: PaginationInfo }>> {
    return apiClient.get(`/social/users/${userId}/following`, { currentUserId, limit, offset });
  },

  async isFollowing(followerId: string, followingId: string): Promise<ApiResponse<{ is_following: boolean }>> {
    return apiClient.get('/social/following/check', { follower_id: followerId, following_id: followingId });
  },

  // Privacy settings
  async getPrivacySettings(userId: string): Promise<ApiResponse<PrivacySettings>> {
    return apiClient.get(`/social/privacy/${userId}`);
  },

  async updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<ApiResponse<PrivacySettings>> {
    return apiClient.put(`/social/privacy/${userId}`, settings);
  },

  // User blocking
  async blockUser(targetUserId: string, currentUserId: string): Promise<ApiResponse<{ blocked: boolean }>> {
    return apiClient.post(`/social/block/${targetUserId}`, { currentUserId });
  },

  async unblockUser(targetUserId: string, currentUserId: string): Promise<ApiResponse<{ unblocked: boolean }>> {
    return apiClient.delete(`/social/block/${targetUserId}`, { currentUserId });
  },

  async isBlocked(blockerId: string, blockedId: string): Promise<ApiResponse<{ is_blocked: boolean }>> {
    return apiClient.get('/social/block/check', { blocker_id: blockerId, blocked_id: blockedId });
  },

  // Comments
  async addComment(annotationId: number, currentUserId: string, comment: string): Promise<ApiResponse<Comment>> {
    return apiClient.post(`/social/comments/${annotationId}`, { currentUserId, comment });
  },

  async getComments(annotationId: number, currentUserId: string, limit: number = 50, offset: number = 0): Promise<ApiResponse<Comment[]>> {
    return apiClient.get(`/social/comments/${annotationId}`, { currentUserId, limit, offset });
  },

  async deleteComment(commentId: number, currentUserId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(`/social/comments/${commentId}`, { currentUserId });
  },

  // Likes for annotations (posts)
  async likeAnnotation(annotationId: number, currentUserId: string): Promise<ApiResponse<{ liked: boolean }>> {
    return apiClient.post(`/social/likes/annotation/${annotationId}`, { currentUserId });
  },

  async unlikeAnnotation(annotationId: number, currentUserId: string): Promise<ApiResponse<{ unliked: boolean }>> {
    return apiClient.delete(`/social/likes/annotation/${annotationId}`, { currentUserId });
  },

  async getAnnotationLikes(annotationId: number, currentUserId: string): Promise<ApiResponse<{ likes_count: number, is_liked: boolean }>> {
    return apiClient.get(`/social/likes/annotation/${annotationId}`, { currentUserId });
  },

  // Likes for comments
  async likeComment(commentId: number, currentUserId: string): Promise<ApiResponse<{ liked: boolean }>> {
    return apiClient.post(`/social/likes/comment/${commentId}`, { currentUserId });
  },

  async unlikeComment(commentId: number, currentUserId: string): Promise<ApiResponse<{ unliked: boolean }>> {
    return apiClient.delete(`/social/likes/comment/${commentId}`, { currentUserId });
  },

  // Saved places
  async savePlace(placeId: number, currentUserId: string, notes?: string): Promise<ApiResponse<{ saved: boolean }>> {
    return apiClient.post(`/social/saved/${placeId}`, { currentUserId, notes });
  },

  async unsavePlace(placeId: number, currentUserId: string): Promise<ApiResponse<{ unsaved: boolean }>> {
    return apiClient.delete(`/social/saved/${placeId}`, { currentUserId });
  },

  async isPlaceSaved(placeId: number, currentUserId: string): Promise<ApiResponse<{ is_saved: boolean }>> {
    return apiClient.get(`/social/saved/${placeId}`, { currentUserId });
  },
}; 