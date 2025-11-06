import { apiClient, type ApiResponse } from './apiClient';

export interface QuestionDto {
  id: number;
  user_id: string;
  user_name?: string;
  user_picture?: string | null;
  text: string;
  visibility: 'public' | 'friends';
  labels?: string[] | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
  answers_count?: number;
}

export interface AnswerDto {
  id: number;
  user_id: string;
  user_name?: string;
  user_picture?: string | null;
  text?: string | null;
  created_at: string;
  recommendation_id?: number;
  recommendation_title?: string | null;
  recommendation_description?: string | null;
  place_name?: string | null;
  place_address?: string | null;
}

export interface CreateQuestionPayload {
  text: string;
  visibility?: 'public' | 'friends';
  labels?: string[];
  metadata?: Record<string, any>;
}

export const questionsApi = {
  createQuestion: async (payload: CreateQuestionPayload): Promise<ApiResponse<{ id: number; created_at: string }>> => {
    const res = await apiClient.post('/questions', payload);
    return res.data as ApiResponse<{ id: number; created_at: string }>;
  },
  getQuestion: async (questionId: number): Promise<ApiResponse<QuestionDto>> => {
    const res = await apiClient.get(`/questions/${questionId}`);
    return res.data as ApiResponse<QuestionDto>;
  },
  getAnswers: async (questionId: number, params?: { limit?: number }): Promise<ApiResponse<AnswerDto[]>> => {
    return apiClient.get<AnswerDto[]>(`/questions/${questionId}/answers`, params);
  },
  listQuestions: async (params?: { limit?: number; cursorCreatedAt?: string; cursorId?: number }): Promise<ApiResponse<QuestionDto[]>> => {
    const res = await apiClient.get('/questions', { params });
    return res.data as ApiResponse<QuestionDto[]>;
  },
};


