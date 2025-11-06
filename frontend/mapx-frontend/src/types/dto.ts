export interface RecommendationDTO {
  recommendation_id: number;
  title?: string | null;
  description?: string | null;
  rating: number;
  created_at: string;
  content_type?: string | null;
  place_name?: string | null;
  place_address?: string | null;
  user_id: string;
  user_name: string;
  user_picture?: string | null;
  likes_count: number;
  comments_count: string;
  is_liked_by_current_user: boolean;
  visibility?: string;
  metadata?: Record<string, unknown>;
  content_data?: Record<string, unknown>;
}

export interface QuestionDTO {
  id: number;
  text: string;
  created_at: string;
  user_id: string;
  user_name: string;
  user_picture?: string | null;
  answers_count?: number;
}





