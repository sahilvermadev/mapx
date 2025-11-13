// AI-specific client for recommendation endpoints
// Uses the main API client for consistency and proper authentication

import { apiClient } from './api';
import { CONTENT_TYPES, type ContentType } from '@/components/composer/constants';

export interface RecommendationAnalysis {
  isValid: boolean;
  isGibberish: boolean;
  contentType: ContentType;
  extractedData: Record<string, any>;
  missingFields: Array<{
    field: string;
    question: string;
    required: boolean;
    needsLocationPicker?: boolean;
  }>;
  confidence: number;
  reasoning: string;
}

export interface ValidationResult {
  isValid: boolean;
  extractedValue: string;
  confidence: number;
  feedback?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

export const aiClient = {
  async analyze(text: string): Promise<RecommendationAnalysis> {
    const payload = { text };
    const result = await withTimeout(
      apiClient.post<RecommendationAnalysis>('/ai-recommendation/analyze', payload),
      15000
    );
    return result.data!;
  },

  async validate(question: string, userResponse: string, expectedField: string): Promise<ValidationResult> {
    const payload = { question, userResponse, expectedField };
    const result = await withTimeout(
      apiClient.post<ValidationResult>('/ai-recommendation/validate', payload),
      10000
    );
    return result.data!;
  },

  async format(data: any, originalText: string): Promise<string | null> {
    const payload = { data, originalText };
    
    // Retry logic for AI formatting
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await withTimeout(
          apiClient.post<{ formattedText?: string }>('/ai-recommendation/format', payload),
          20000
        );
        // Endpoint returns { success, formattedText } (top-level), not under data
        const formatted = (result as any).formattedText || result.data?.formattedText;
        if (typeof formatted === 'string' && formatted.trim().length > 0) {
          return formatted.trim();
        }
      } catch (error) {
        if (attempt === 2) {
          return null;
        }
        // Wait 1 second before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  },

  async improveText(text: string): Promise<string | null> {
    const payload = { text };
    
    try {
      const result = await withTimeout(
        apiClient.post<{ success?: boolean; improvedText?: string }>('/ai-recommendation/improve-text', payload),
        20000
      );
      
      // Backend returns { success: true, improvedText: "..." }
      // apiClient.post returns the axios response.data, which is the backend response
      const improved = (result as any).improvedText;
      
      if (typeof improved === 'string' && improved.trim().length > 0) {
        return improved.trim();
      }
      
      return null;
    } catch (error) {
      throw error; // Re-throw to let the hook handle it with toast
    }
  }
};






