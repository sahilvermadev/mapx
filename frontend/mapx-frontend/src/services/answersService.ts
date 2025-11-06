import { apiClient, type ApiResponse } from './apiClient';

export interface CreateAnswerPayload {
  recommendation_id?: number;
  recommendation_payload?: Record<string, any>;
  text?: string;
  metadata?: Record<string, any>;
}

export const answersApi = {
  createAnswer: async (questionId: number, payload: CreateAnswerPayload): Promise<{ id: number; recommendation_id: number }> => {
    const response = await apiClient.post<{ id: number; recommendation_id: number }>(`/questions/${questionId}/answers`, payload);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create answer');
    }
    
    return response.data;
  },
  likeAnswer: async (answerId: number, userId: string): Promise<ApiResponse<any>> => {
    return apiClient.post(`/answers/${answerId}/like`, { user_id: userId });
  },
  unlikeAnswer: async (answerId: number, userId: string): Promise<ApiResponse<any>> => {
    return apiClient.delete(`/answers/${answerId}/like`, { user_id: userId });
  },
};


