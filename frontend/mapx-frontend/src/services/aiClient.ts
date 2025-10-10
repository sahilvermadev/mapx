// Lightweight client for AI endpoints used by the composer
// Centralizes retries, timeouts, and error normalization

export interface RecommendationAnalysis {
  isValid: boolean;
  isGibberish: boolean;
  contentType: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
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

async function jsonPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as any)?.success === false) {
    const msg = (data as any)?.error || (data as any)?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const aiClient = {
  async analyze(text: string, currentUserId: string): Promise<RecommendationAnalysis> {
    const payload = { text, currentUserId };
    type Resp = { success: boolean; data: RecommendationAnalysis };
    const result = await withTimeout(jsonPost<Resp>('http://localhost:5000/api/ai-recommendation/analyze', payload), 15000);
    return result.data;
  },

  async validate(question: string, userResponse: string, expectedField: string, currentUserId: string): Promise<ValidationResult> {
    const payload = { question, userResponse, expectedField, currentUserId };
    type Resp = { success: boolean; data: ValidationResult };
    const result = await withTimeout(jsonPost<Resp>('http://localhost:5000/api/ai-recommendation/validate', payload), 10000);
    return result.data;
  },

  async format(data: any, originalText: string, currentUserId: string): Promise<string | null> {
    const payload = { data, originalText, currentUserId };
    type Resp = { success: boolean; formattedText?: string };
    try {
      const result = await withTimeout(jsonPost<Resp>('http://localhost:5000/api/ai-recommendation/format', payload), 12000);
      return result.formattedText || null;
    } catch {
      return null;
    }
  }
};






