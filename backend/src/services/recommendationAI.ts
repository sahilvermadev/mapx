import Groq from 'groq-sdk';
import '../config/env';
import {
  FIELD_CONFIG,
  isFieldForbidden,
  filterForbiddenFields,
  getMissingRequiredFields,
  normalizeFieldName,
  isFieldRequired,
  type ContentType,
} from '../config/fieldConfig';
import { CONTENT_TYPES, ERROR_MESSAGES } from '../config/constants';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface RecommendationAnalysis {
  isValid: boolean;
  isGibberish: boolean;
  contentType: ContentType;
  extractedData: {
    name?: string;
    description?: string;
    location?: string;
    contact_info?: {
      phone?: string;
      email?: string;
    };
    highlights?: string[];
    pricing?: string;
    experience?: string;
    // Removed deprecated fields: best_times, tips
    [key: string]: any;
  };
  missingFields: Array<{
    field: string;
    question: string;
    required: boolean;
    reasoning: string;
    needsLocationPicker?: boolean; // New field to indicate if this needs Google Maps picker
  }>;
  confidence: number;
  reasoning: string;
}

export interface RecommendationQuestion {
  field: string;
  question: string;
  required: boolean;
  reasoning: string;
}

class RecommendationAI {
  async analyzeRecommendation(text: string): Promise<RecommendationAnalysis> {
    try {
      // More sophisticated detection of question context
      const isAnsweringQuestion = this.detectQuestionContext(text);
      
      const prompt = `You are an intelligent AI assistant that analyzes user recommendations for a local knowledge sharing platform. Your job is to:

1. Determine if the text is valid content (not gibberish, spam, or irrelevant)
2. Identify what type of content it is (place, service, or unclear)
3. Extract any useful information already mentioned
4. Identify what important information is missing and generate smart follow-up questions

User's text: "${text}"

${isAnsweringQuestion ? `
CONTEXT: The user is answering a question from someone else. This text appears to be a question that someone is asking, and the user wants to provide a recommendation to answer it. 

The follow-up questions should be SHORT and DIRECT, like form fields. Use concise, simple questions:
- "What's the name?"
- "Where is it located?"

For places: ask only for name and location. DO NOT ask for contact information, tips, or best times.
For services: ask only for name and contact info.

Avoid long explanations or phrases like "To give a complete answer" or "To help others understand".
` : ''}

Analyze this text and respond with a JSON object containing:

{
  "isValid": boolean,
  "isGibberish": boolean,
  "contentType": "place|service|unclear",
  "extractedData": {
    "name": "extracted name if mentioned",
    "description": "the original text or a cleaned version",
    "location": "location if mentioned",
    "contact_info": {
      "phone": "phone number if mentioned",
      "email": "email if mentioned"
    },
    "highlights": ["array of highlights if mentioned"],
    "pricing": "pricing info if mentioned",
    "experience": "experience info if mentioned"
  },
  "missingFields": [
    {
      "field": "field_name",
      "question": "intelligent, contextual question to ask",
      "required": boolean,
      "reasoning": "why this information is important",
      "needsLocationPicker": boolean (true for location/address/place fields)
    }
  ],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of your analysis"
}

Guidelines:
- For places: ask ONLY for name and location if missing. DO NOT ask for contact information (phone/email), tips, best_times, highlights, or any other optional fields.
- For services: ask ONLY for name and contact information if missing. DO NOT ask for tips, best_times, or any other optional fields.
- Generate questions that feel natural and helpful
- Consider what information would be most valuable to other users
- Be specific and contextual in your questions
- Only ask for fields that are actually displayed and editable in the UI
- DO NOT ask for deprecated fields: tips, best_times, best_time
- If the text is gibberish or irrelevant, set isValid to false and isGibberish to true
- IMPORTANT: For location-related fields (location, address, place), set "needsLocationPicker": true to enable Google Maps location selection
${isAnsweringQuestion ? `
- IMPORTANT: Since this is answering a question, make follow-up questions SHORT and DIRECT like form fields
- Use simple, concise questions that feel like filling out a form
- Avoid long explanations or verbose phrasing
- Focus on getting the essential information quickly
` : ''}

Respond with valid JSON only.`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an intelligent AI assistant that analyzes user recommendations for a local knowledge sharing platform. You must respond with valid JSON only. Be thorough in your analysis and generate helpful, contextual questions. When the user is answering a question, make follow-up questions SHORT and DIRECT like form fields."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 1500,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('No response from AI');
      }

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);

      // Normalize
      const contentType: RecommendationAnalysis['contentType'] = (parsed.contentType || CONTENT_TYPES.UNCLEAR) as ContentType;
      const extractedData = parsed.extractedData || {};
      
      // Only ask for required fields per content type (ignore LLM optional suggestions)
      let missingFields: RecommendationAnalysis['missingFields'] = [];
      missingFields = this.ensureCategoryRequirements(contentType, extractedData, []);

      return {
        isValid: parsed.isValid || false,
        isGibberish: parsed.isGibberish || false,
        contentType,
        extractedData,
        missingFields,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'Analysis completed'
      };

    } catch (error) {
      console.error('Error analyzing recommendation with AI:', error);
      // Fallback analysis
      return this.fallbackAnalysis(text);
    }
  }

  async generateFollowUpQuestion(
    currentData: any, 
    missingField: string, 
    contentType: string,
    conversationHistory: string[]
  ): Promise<RecommendationQuestion> {
    // Use field configuration to check if field is forbidden or not required
    const normalizedContentType = contentType as ContentType;
    if (isFieldForbidden(missingField, normalizedContentType)) {
      throw new Error(ERROR_MESSAGES.FIELD_FORBIDDEN(missingField, contentType));
    }
    
    // Only allow required fields to be asked
    if (!isFieldRequired(missingField, normalizedContentType)) {
      throw new Error(ERROR_MESSAGES.INVALID_FIELD(missingField, contentType));
    }
    
    try {
      // Check if this is part of answering a question using more sophisticated detection
      const isAnsweringQuestion = this.detectQuestionContext(conversationHistory.join(' '));

      const prompt = `You are an intelligent AI assistant that generates contextual follow-up questions for a local knowledge sharing platform.

Current information collected:
${JSON.stringify(currentData, null, 2)}

Content type: ${contentType}
Missing field: ${missingField}
Conversation history: ${conversationHistory.join(' | ')}

${isAnsweringQuestion ? `
CONTEXT: The user is answering a question from someone else. Your follow-up question should be SHORT and DIRECT, like a form field.

Use concise, simple questions:
- "What's the name?"
- "Where is it located?"

For places: ask only for name and location. DO NOT ask for contact information, tips, or best times.
For services: ask only for name and contact info.

DO NOT ask for deprecated fields: tips, best_times, best_time.

Avoid long explanations or verbose phrasing.
` : ''}

Generate a smart, contextual question to ask for the missing field. The question should:
1. Be natural and conversational
2. Provide context about why this information is important
3. Give examples when helpful
4. Be specific to the content type
${isAnsweringQuestion ? `
5. Be SHORT and DIRECT like a form field - avoid verbose explanations
` : ''}

Respond with JSON:
{
  "field": "${missingField}",
  "question": "your intelligent question here",
  "required": boolean,
  "reasoning": "why this information is important"
}`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an intelligent AI assistant that generates contextual follow-up questions. Respond with valid JSON only. When the user is answering a question, make questions SHORT and DIRECT like form fields."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        max_tokens: 300,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('No response from AI');
      }

      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);

      return {
        field: parsed.field || missingField,
        question: parsed.question || `What is the ${missingField}?`,
        required: parsed.required || false,
        reasoning: parsed.reasoning || 'This information is helpful for others'
      };

    } catch (error) {
      console.error('Error generating follow-up question:', error);
      return {
        field: missingField,
        question: `What is the ${missingField}?`,
        required: false,
        reasoning: 'This information is helpful for others'
      };
    }
  }

  async validateUserResponse(
    question: string,
    userResponse: string,
    expectedField: string
  ): Promise<{
    isValid: boolean;
    extractedValue: string;
    confidence: number;
    feedback?: string;
  }> {
    try {
      const prompt = `You are an AI assistant that validates user responses to questions.

Question asked: "${question}"
User's response: "${userResponse}"
Expected field: "${expectedField}"

Analyze if the user's response is:
1. Valid and relevant to the question
2. Contains the expected information
3. Makes sense in context

Respond with JSON:
{
  "isValid": boolean,
  "extractedValue": "the relevant information extracted from the response",
  "confidence": 0.0-1.0,
  "feedback": "optional feedback if the response is unclear or needs clarification"
}`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an AI assistant that validates user responses. Respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('No response from AI');
      }

      const cleanedResponse = this.cleanJsonResponse(response);
      const parsed = JSON.parse(cleanedResponse);

      return {
        isValid: parsed.isValid || false,
        extractedValue: parsed.extractedValue || userResponse,
        confidence: parsed.confidence || 0.5,
        feedback: parsed.feedback
      };

    } catch (error) {
      console.error('Error validating user response:', error);
      return {
        isValid: true,
        extractedValue: userResponse,
        confidence: 0.5
      };
    }
  }

  private detectQuestionContext(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Check for question patterns
    const questionIndicators = [
      '?', 'what', 'where', 'when', 'why', 'how', 'which', 'who', 'can you', 'do you know',
      'any recommendations', 'suggestions', 'advice', 'help with', 'looking for'
    ];
    
    const hasQuestionIndicators = questionIndicators.some(indicator => lowerText.includes(indicator));
    
    // Check for question sentence structure
    const questionWords = ['what', 'where', 'when', 'why', 'how', 'which', 'who'];
    const startsWithQuestionWord = questionWords.some(word => lowerText.startsWith(word));
    
    // Check for question patterns in the text
    const hasQuestionPattern = /\?/.test(text) || 
                              /^(what|where|when|why|how|which|who|can|do|are|is|would|could|should)/i.test(text.trim());
    
    // Check if it looks like someone is asking for recommendations
    const isAskingForRecommendations = /(recommend|suggest|know.*good|looking.*for|any.*good|best.*place|good.*restaurant|good.*service)/i.test(text);
    
    return hasQuestionIndicators || startsWithQuestionWord || hasQuestionPattern || isAskingForRecommendations;
  }

  private cleanJsonResponse(response: string): string {
    // Remove any text before the first { and after the last }
    const startIndex = response.indexOf('{');
    const lastIndex = response.lastIndexOf('}');
    
    if (startIndex === -1 || lastIndex === -1) {
      throw new Error('Invalid JSON response');
    }
    
    return response.substring(startIndex, lastIndex + 1);
  }

  private fallbackAnalysis(text: string): RecommendationAnalysis {
    // Simple fallback analysis
    const lowerText = text.toLowerCase();
    
    // Check for gibberish (very short, no meaningful words, etc.)
    const isGibberish = text.length < 10 || 
                       !/[a-zA-Z]/.test(text) || 
                       text.split(' ').length < 2;
    
    // Simple content type detection
    let contentType: ContentType = CONTENT_TYPES.UNCLEAR;
    if (['carpenter', 'plumber', 'electrician', 'mechanic', 'service', 'contact', 'phone', 'number', 'call'].some(word => lowerText.includes(word))) {
      contentType = CONTENT_TYPES.SERVICE;
    } else if (['restaurant', 'cafe', 'shop', 'place', 'location'].some(word => lowerText.includes(word))) {
      contentType = CONTENT_TYPES.PLACE;
    }
    // Note: tip/advice/suggestion keywords now default to UNCLEAR since tip content type is deprecated

    const extractedData: any = { description: text };
    const enforcedMissing = this.ensureCategoryRequirements(contentType, extractedData, []);

    return {
      isValid: !isGibberish,
      isGibberish,
      contentType,
      extractedData,
      missingFields: enforcedMissing,
      confidence: 0.3,
      reasoning: 'Fallback analysis used due to AI error'
    };
  }

  /**
   * Ensure per-category required fields are represented in missingFields with correct UI hints.
   * Uses centralized field configuration for consistency.
   */
  private ensureCategoryRequirements(
    contentType: RecommendationAnalysis['contentType'],
    extractedData: Record<string, any>,
    existingMissing: RecommendationAnalysis['missingFields']
  ): RecommendationAnalysis['missingFields'] {
    const missing: RecommendationAnalysis['missingFields'] = [...existingMissing];
    const config = FIELD_CONFIG[contentType];

    // Helper to add missing item if not already present
    const addMissing = (field: string, question: string, required = true, reasoning = 'Required for this recommendation', needsLocationPicker = false) => {
      const already = missing.some(m => m.field === field);
      if (!already) {
        missing.push({ field, question, required, reasoning, ...(needsLocationPicker ? { needsLocationPicker: true } : {}) });
      }
    };

    // Check for missing required fields using centralized configuration
    const missingRequired = getMissingRequiredFields(extractedData, contentType);
    
    for (const field of missingRequired) {
      if (field === 'name') {
        addMissing(
          'name',
          "What's the name?",
          true,
          'The name is required.'
        );
      } else if (field === 'location') {
        addMissing(
          'location',
          'Where is this place? Please select it on the map.',
          true,
          'Place recommendations must include a concrete location to save in Places.',
          true
        );
      } else if (field === 'contact_info') {
        addMissing(
          'contact_info',
          'What is the best contact for this service (phone or email)?',
          true,
          'Services must have a phone or email to deduplicate and save in Services.'
        );
      }
    }

    // Filter out any forbidden fields (double-check)
    return missing.filter(m => !isFieldForbidden(m.field, contentType));
  }

  async formatRecommendationPost(data: any, originalText?: string): Promise<string> {
    try {
      // Determine content type from data (backend tolerant of either key)
      const contentType: string = data?.contentType || data?.type || 'unclear';

      // Build a content-type-aware prompt
      const baseData = JSON.stringify(data, null, 2);
      const original = originalText || '';

      const servicePrompt = `You are formatting a SERVICE recommendation.

GOAL:
- Produce copy that reads like a trustworthy human wrote it: specific, clear, and to the point.

STYLE:
- Write 3–5 short sentences in third-person, using active voice.
- Mention concrete details only when provided: highlights, outcomes, responsiveness, pricing, years of experience.
- Prefer the professional title (e.g., neurosurgeon, carpenter) over generic terms like "service provider".
- Avoid boilerplate phrases and hedging: do not use "recommended service provider", "skilled professional", "notable recommendation", or "as evidenced by".
- Do not repeat the name more than once and vary sentence openings.
- If the ORIGINAL text contains first-person details (e.g., "treated my son"), paraphrase to neutral third-person without implying AI authorship (e.g., "treated a patient" or "completed a successful procedure"). Do not mention "the recommender".
- Never invent details.
- Do not include location or contact information; the UI shows those separately.
${original && (original.includes('?') || original.includes('what') || original.includes('where') || original.includes('how')) ? `
- CONTEXT: This is answering a question. Make sure the recommendation directly addresses what was asked and provides a helpful answer.
` : ''}

DATA:
${baseData}

ORIGINAL (optional):
${original}

Return only the final text.`;

      const placePrompt = `You are formatting a PLACE recommendation.

GOAL:
- Help a reader quickly understand why the place is worth a visit.

STYLE:
- Write 3–5 short sentences in third-person, using active voice.
- Focus on vibe, what it's good for, best times to go, and any practical tip provided (queues, noise level, must-try items).
- Avoid generic phrases like "recommended place" and avoid repeating the name more than once.
- If the ORIGINAL text uses first-person anecdotes, paraphrase to neutral third-person (e.g., "I loved the quiet mornings" -> "Quiet in the mornings"). Do not mention "the recommender".
- Keep language descriptive but utilitarian; no emojis or fluff. Never invent details.
- Do not include location or contact information; the UI shows those separately.
${original && (original.includes('?') || original.includes('what') || original.includes('where') || original.includes('how')) ? `
- CONTEXT: This is answering a question. Make sure the recommendation directly addresses what was asked and provides a helpful answer.
` : ''}

DATA:
${baseData}

ORIGINAL (optional):
${original}

Return only the final text.`;

      const genericPrompt = `You are a formatting assistant creating short, useful recommendation posts in third-person.

STYLE:
- Write 3–5 short sentences in active voice.
- Be specific, avoid filler and clichés. Do not repeat the name more than once.
- Only use details that exist in the data (category, highlights, pricing, best time, tips). Never invent.
- Convert any first-person statements from the ORIGINAL into neutral third-person without implying authorship or personal involvement. Avoid phrases like "I recommend" or "the recommender".
- Do not include location or contact information; the UI surfaces those separately.
${original && (original.includes('?') || original.includes('what') || original.includes('where') || original.includes('how')) ? `
- CONTEXT: This is answering a question. Make sure the recommendation directly addresses what was asked and provides a helpful answer.
` : ''}

DATA:
${baseData}

ORIGINAL (optional):
${original}

Return only the final text.`;

      const prompt = contentType === 'service' ? servicePrompt
        : contentType === 'place' ? placePrompt
        : genericPrompt;

      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.6, // Consistent, controlled output
        max_tokens: 300 // Enforces brevity
      });
  
      const formattedText = response.choices[0]?.message?.content?.trim();
      
      if (!formattedText) {
        throw new Error('No response from LLM');
      }

      return formattedText;
  
    } catch (error) {
      console.error('Error formatting recommendation post:', error);
      // Fallback: construct a simple formatted post locally to keep UX flowing (content-type aware, no contact info in text)
      const lines: string[] = [];
      const nameOrCategory = (data?.name || data?.category || data?.title || 'This recommendation').toString();
      const ct: string = data?.contentType || data?.type || 'unclear';

      if (ct === 'service') {
        lines.push(`${nameOrCategory} is recommended for their expertise.`);
        if (Array.isArray(data?.highlights) && data.highlights.length) {
          lines.push(`Highlights: ${data.highlights.join(', ')}.`);
        }
        // Removed deprecated fields: best_times, tips
      } else if (ct === 'place') {
        lines.push(`${nameOrCategory} is a recommended place to visit.`);
        const address = data?.location || data?.location_address;
        if (address) lines.push(`Address: ${address}.`);
        if (data?.pricing) lines.push(`Pricing: ${data.pricing}.`);
        // Removed deprecated fields: best_times, tips
      } else {
        lines.push(`${nameOrCategory} is recommended.`);
        if (data?.pricing) lines.push(`Pricing: ${data.pricing}.`);
        // Removed deprecated fields: best_times, tips
        if (Array.isArray(data?.highlights) && data.highlights.length) lines.push(`highlights: ${data.highlights.join(', ')}.`);
      }

      if (!lines.length && originalText) lines.push(originalText);
      return lines.join('\n');
    }
  }

  async improveText(text: string): Promise<string> {
    try {
      const prompt = `Fix all spelling and grammar errors in this text. Return ONLY the corrected text, nothing else.

Text with errors:
"${text}"

Corrected text:`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a spelling and grammar checker. Fix all errors and return only the corrected text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.1, // Very low temperature for consistent corrections
        max_tokens: 1000,
      });

      const rawResponse = completion.choices[0]?.message?.content?.trim() || '';
      
      if (!rawResponse) {
        return text;
      }
      
      // Clean up the response
      let improvedText = rawResponse
        .replace(/^```[\w]*\n?/g, '')
        .replace(/\n?```$/g, '')
        .replace(/^["']/g, '')
        .replace(/["']$/g, '')
        .trim();
      
      // Always return the AI response, even if it seems the same
      // (sometimes the AI makes subtle improvements)
      return improvedText || text;
    } catch (error) {
      console.error('Error in improveText:', error);
      // Return original text on error
      return text;
    }
  }
}

export const recommendationAI = new RecommendationAI();
