// AI-specific client for recommendation endpoints
// Uses the main API client for consistency and proper authentication

import { apiClient } from './api';

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






