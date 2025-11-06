/**
 * Type definitions for feed-related database queries and API responses
 */

export interface FeedPostRow {
  recommendation_id: number;
  user_id: string;
  content_type: string;
  title: string;
  description: string;
  content_data: any;
  rating: number | null;
  visibility: 'public' | 'friends';
  labels: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
  place_id: number | null;
  place_name: string | null;
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  google_place_id: string | null;
  user_name: string;
  user_picture: string | null;
  comments_count: number;
  likes_count: number;
  is_liked_by_current_user: boolean;
  is_saved: boolean;
}

export interface QuestionFeedRow {
  id: number;
  type: 'question';
  created_at: string;
  user_id: string;
  content_type: string | null;
  title: string | null;
  description: string;
  content_data: any;
  rating: number | null;
  visibility: 'public' | 'friends';
  labels: string[];
  metadata: any;
  place_id: number | null;
  place_name: string | null;
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  google_place_id: string | null;
  user_name: string;
  user_picture: string | null;
  answers_count: number;
  comments_count: number;
  likes_count: number;
  is_liked_by_current_user: boolean;
  is_saved: boolean;
}

export interface AnswerFeedRow {
  id: number;
  type: 'answer';
  created_at: string;
  recommendation_id: number;
  user_id: string;
  content_type: string;
  title: string;
  description: string;
  content_data: any;
  rating: number | null;
  visibility: 'public' | 'friends';
  labels: string[];
  metadata: any;
  place_id: number | null;
  place_name: string | null;
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  google_place_id: string | null;
  user_name: string;
  user_picture: string | null;
  answers_count: number | null;
  comments_count: number;
  likes_count: number;
  is_liked_by_current_user: boolean;
  is_saved: boolean;
}

export type UnifiedFeedRow = FeedPostRow | QuestionFeedRow | AnswerFeedRow;

export interface FeedQueryParams {
  userId: string;
  limit: number;
  cursorCreatedAt?: string;
  cursorId?: number;
  categoryFilter?: string;
  groupIds?: number[];
}

export interface FeedResponse {
  success: boolean;
  data: UnifiedFeedRow[];
  hasNext: boolean;
  nextCursor?: {
    created_at: string;
    id: number;
  };
}


















