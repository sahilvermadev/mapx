import { questionsApi } from '@/services/questionsService';
import type { QuestionMetadata } from '@/hooks/useRecommendationComposer';

/**
 * Type guard to validate detected category structure
 */
function isValidDetectedCategory(data: any): data is QuestionMetadata['detected_category'] {
  return (
    data &&
    typeof data === 'object' &&
    ['place', 'service', 'unclear'].includes(data.content_type) &&
    typeof data.confidence === 'number' &&
    data.confidence >= 0 &&
    data.confidence <= 1 &&
    (data.service_category_id === null || typeof data.service_category_id === 'number') &&
    (data.service_category_slug === null || typeof data.service_category_slug === 'string')
  );
}

/**
 * Extract question metadata from API response
 * Validates structure and returns typed metadata or undefined
 */
export async function extractQuestionMetadata(
  questionId: number
): Promise<QuestionMetadata | undefined> {
  try {
    const response = await questionsApi.getQuestion(questionId);
    
    if (response.success && response.data?.metadata) {
      const metadata = response.data.metadata;
      
      // Validate detected_category structure
      if (metadata.detected_category && isValidDetectedCategory(metadata.detected_category)) {
        return {
          detected_category: metadata.detected_category,
        };
      }
    }
  } catch (error) {
    // Non-fatal; log but don't throw
    // Error will be handled by caller if needed
  }
  
  return undefined;
}



