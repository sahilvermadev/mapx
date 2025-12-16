import Groq from 'groq-sdk';
import '../config/env';
import { serviceCategoryService } from './serviceCategoryService';
import { extractServiceType } from '../utils/nameSimilarity';
import { getCategoryBySlug } from '../db/serviceCategories';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Confidence adjustment constants
const CONFIDENCE_ADJUSTMENT = {
  CATEGORY_DETECTED: 0.1, // Increase confidence when specific category is found
  CATEGORY_MISSING: 0.1, // Decrease confidence when category detection fails
  MIN_CONFIDENCE: 0.5, // Minimum confidence when category is missing
  ERROR_CONFIDENCE: 0.3, // Confidence level on analysis error
  FALLBACK_CONFIDENCE: 0.4, // Confidence for fallback keyword detection
  FALLBACK_MATCH_BOOST: 0.1, // Confidence boost per keyword match
  FALLBACK_MAX_CONFIDENCE: 0.7, // Maximum confidence for fallback detection
} as const;

export interface QuestionCategoryAnalysis {
  content_type: 'place' | 'service' | 'unclear';
  service_category_id: number | null;
  service_category_slug: string | null;
  confidence: number;
}

/**
 * Service for analyzing questions to detect expected answer category
 */
class QuestionAnalysisService {
  /**
   * Analyze question text to determine what type of answer is expected
   * 
   * @param questionText - The question text to analyze
   * @returns Analysis result with content type and category information
   */
  async analyzeQuestion(questionText: string): Promise<QuestionCategoryAnalysis> {
    try {
      // Use AI to determine content type (place vs service)
      const contentTypeAnalysis = await this.analyzeContentType(questionText);
      
      // If it's a service question, try to detect the specific category
      let serviceCategoryId: number | null = null;
      let serviceCategorySlug: string | null = null;
      
      if (contentTypeAnalysis.content_type === 'service') {
        const categoryDetection = await this.detectServiceCategory(questionText);
        serviceCategoryId = categoryDetection.categoryId || null;
        serviceCategorySlug = categoryDetection.categorySlug || null;
        
        // Adjust confidence based on category detection
        if (serviceCategoryId) {
          contentTypeAnalysis.confidence = Math.min(
            contentTypeAnalysis.confidence + CONFIDENCE_ADJUSTMENT.CATEGORY_DETECTED,
            1.0
          );
        } else {
          // Lower confidence if we couldn't detect specific category
          contentTypeAnalysis.confidence = Math.max(
            contentTypeAnalysis.confidence - CONFIDENCE_ADJUSTMENT.CATEGORY_MISSING,
            CONFIDENCE_ADJUSTMENT.MIN_CONFIDENCE
          );
        }
      }
      
      return {
        content_type: contentTypeAnalysis.content_type,
        service_category_id: serviceCategoryId,
        service_category_slug: serviceCategorySlug,
        confidence: contentTypeAnalysis.confidence,
      };
    } catch (error) {
      console.error('Error analyzing question:', error);
      // Return unclear with low confidence on error
      return {
        content_type: 'unclear',
        service_category_id: null,
        service_category_slug: null,
        confidence: CONFIDENCE_ADJUSTMENT.ERROR_CONFIDENCE,
      };
    }
  }

  /**
   * Use AI to determine if the question is asking for a place or service
   */
  private async analyzeContentType(questionText: string): Promise<{
    content_type: 'place' | 'service' | 'unclear';
    confidence: number;
  }> {
    try {
      const prompt = `Analyze this question and determine what type of answer is expected.

Question: "${questionText}"

Determine if the question is asking for:
- A PLACE (restaurant, cafe, shop, venue, gym, hotel, park, beach, tourist attraction, any physical location)
- A SERVICE (professional like plumber, tutor, instructor, contractor, doctor, lawyer, service provider, person offering services)
- UNCLEAR (could be either, or ambiguous)

Respond with JSON only:
{
  "content_type": "place" | "service" | "unclear",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that analyzes questions to determine what type of answer is expected. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('No response from AI');
      }

      // Clean and parse JSON response
      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);

      const contentType = parsed.content_type === 'service' ? 'service' 
        : parsed.content_type === 'place' ? 'place' 
        : 'unclear';

      return {
        content_type: contentType,
        confidence: Math.max(0.0, Math.min(1.0, parsed.confidence || 0.5)),
      };
    } catch (error) {
      console.error('Error analyzing content type:', error);
      // Fallback: use keyword-based detection
      return this.fallbackContentTypeDetection(questionText);
    }
  }

  /**
   * Detect specific service category from question text
   */
  private async detectServiceCategory(questionText: string): Promise<{
    categoryId: number | undefined;
    categorySlug: string | undefined;
  }> {
    try {
      // First, try to extract service type using existing utility
      const extractedType = extractServiceType(questionText, '');
      
      if (extractedType) {
        // Try to find category by slug
        const category = await getCategoryBySlug(extractedType);
        if (category) {
          return {
            categoryId: category.id,
            categorySlug: category.slug,
          };
        }
      }

      // If that didn't work, try using AI to extract service type
      const aiExtractedType = await this.extractServiceTypeWithAI(questionText);
      if (aiExtractedType) {
        const category = await getCategoryBySlug(aiExtractedType);
        if (category) {
          return {
            categoryId: category.id,
            categorySlug: category.slug,
          };
        }
      }

      return {
        categoryId: undefined,
        categorySlug: undefined,
      };
    } catch (error) {
      console.error('Error detecting service category:', error);
      return {
        categoryId: undefined,
        categorySlug: undefined,
      };
    }
  }

  /**
   * Use AI to extract service type from question text
   */
  private async extractServiceTypeWithAI(questionText: string): Promise<string | null> {
    try {
      const prompt = `Extract the service type or profession mentioned in this question.

Question: "${questionText}"

Examples:
- "Do you know a good plumber?" → "plumber"
- "Looking for a tutor" → "tutor"
- "Need an electrician" → "electrician"
- "Best hair stylist?" → "hair stylist"

Respond with JSON only:
{
  "service_type": "extracted service type slug (e.g., 'plumber', 'tutor', 'electrician') or null if not found"
}`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that extracts service types from questions. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 100,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        return null;
      }

      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);

      return parsed.service_type || null;
    } catch (error) {
      console.error('Error extracting service type with AI:', error);
      return null;
    }
  }

  /**
   * Fallback content type detection using keyword matching
   */
  private fallbackContentTypeDetection(questionText: string): {
    content_type: 'place' | 'service' | 'unclear';
    confidence: number;
  } {
    const lowerText = questionText.toLowerCase();
    
    // Service keywords
    const serviceKeywords = [
      'plumber', 'electrician', 'carpenter', 'mechanic', 'contractor',
      'tutor', 'instructor', 'teacher', 'coach', 'trainer',
      'doctor', 'lawyer', 'dentist', 'therapist', 'counselor',
      'cleaner', 'maid', 'driver', 'cook', 'chef',
      'gardener', 'security', 'guard', 'delivery', 'courier',
      'singer', 'musician', 'hair stylist', 'barber', 'makeup artist',
      'property dealer', 'realtor', 'broker', 'service provider', 'professional'
    ];
    
    // Place keywords
    const placeKeywords = [
      'restaurant', 'cafe', 'coffee', 'shop', 'store', 'mall',
      'gym', 'hotel', 'park', 'beach', 'museum', 'theater',
      'cinema', 'venue', 'bar', 'pub', 'club', 'library',
      'hospital', 'clinic', 'school', 'university', 'college',
      'temple', 'church', 'mosque', 'attraction', 'tourist'
    ];
    
    const serviceMatches = serviceKeywords.filter(keyword => lowerText.includes(keyword)).length;
    const placeMatches = placeKeywords.filter(keyword => lowerText.includes(keyword)).length;
    
    if (serviceMatches > placeMatches && serviceMatches > 0) {
      return {
        content_type: 'service',
        confidence: Math.min(
          CONFIDENCE_ADJUSTMENT.FALLBACK_MAX_CONFIDENCE,
          CONFIDENCE_ADJUSTMENT.MIN_CONFIDENCE + (serviceMatches * CONFIDENCE_ADJUSTMENT.FALLBACK_MATCH_BOOST)
        ),
      };
    } else if (placeMatches > serviceMatches && placeMatches > 0) {
      return {
        content_type: 'place',
        confidence: Math.min(
          CONFIDENCE_ADJUSTMENT.FALLBACK_MAX_CONFIDENCE,
          CONFIDENCE_ADJUSTMENT.MIN_CONFIDENCE + (placeMatches * CONFIDENCE_ADJUSTMENT.FALLBACK_MATCH_BOOST)
        ),
      };
    }
    
    return {
      content_type: 'unclear',
      confidence: CONFIDENCE_ADJUSTMENT.FALLBACK_CONFIDENCE,
    };
  }

  /**
   * Clean JSON response to ensure it's valid
   */
  private cleanJsonResponse(response: string): string {
    // Remove any text before the first { and after the last }
    const startIndex = response.indexOf('{');
    const lastIndex = response.lastIndexOf('}');
    
    if (startIndex === -1 || lastIndex === -1) {
      throw new Error('Invalid JSON response');
    }
    
    return response.substring(startIndex, lastIndex + 1);
  }
}

export const questionAnalysisService = new QuestionAnalysisService();

