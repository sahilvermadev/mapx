import { useMutation } from '@tanstack/react-query';
import { questionsApi, type CreateQuestionPayload } from '@/services/questionsService';

export function useAskQuestion() {
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => questionsApi.createQuestion(payload),
  });
}
