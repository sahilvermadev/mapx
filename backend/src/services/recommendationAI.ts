import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface RecommendationAnalysis {
  isValid: boolean;
  isGibberish: boolean;
  contentType: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  extractedData: {
    name?: string;
    description?: string;
    location?: string;
    contact_info?: {
      phone?: string;
      email?: string;
    };
    specialities?: string[];
    pricing?: string;
    experience?: string;
    best_times?: string;
    tips?: string;
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
      const prompt = `You are an intelligent AI assistant that analyzes user recommendations for a local knowledge sharing platform. Your job is to:

1. Determine if the text is valid content (not gibberish, spam, or irrelevant)
2. Identify what type of content it is (place, service, tip, contact, or unclear)
3. Extract any useful information already mentioned
4. Identify what important information is missing and generate smart follow-up questions

User's text: "${text}"

Analyze this text and respond with a JSON object containing:

{
  "isValid": boolean,
  "isGibberish": boolean,
  "contentType": "place|service|tip|contact|unclear",
  "extractedData": {
    "name": "extracted name if mentioned",
    "description": "the original text or a cleaned version",
    "location": "location if mentioned",
    "contact_info": {
      "phone": "phone number if mentioned",
      "email": "email if mentioned"
    },
    "specialities": ["array of specialities if mentioned"],
    "pricing": "pricing info if mentioned",
    "experience": "experience info if mentioned",
    "best_times": "best times if mentioned",
    "tips": "tips if mentioned"
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
- For services (carpenter, plumber, etc.): ALWAYS ask for contact information if missing
- For places: ask for location, best times to visit, insider tips
- For contacts: ask what they can help with, their services
- For tips: ask where it applies, when it's useful
- Generate questions that feel natural and helpful
- Consider what information would be most valuable to other users
- Be specific and contextual in your questions
- If the text is gibberish or irrelevant, set isValid to false and isGibberish to true
- IMPORTANT: For location-related fields (location, address, place), set "needsLocationPicker": true to enable Google Maps location selection

Respond with valid JSON only.`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are an intelligent AI assistant that analyzes user recommendations for a local knowledge sharing platform. You must respond with valid JSON only. Be thorough in your analysis and generate helpful, contextual questions."
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
      const contentType: RecommendationAnalysis['contentType'] = parsed.contentType || 'unclear';
      const extractedData = parsed.extractedData || {};
      let missingFields: RecommendationAnalysis['missingFields'] = Array.isArray(parsed.missingFields) ? parsed.missingFields : [];

      // Post-process: enforce category-specific required fields
      missingFields = this.ensureCategoryRequirements(contentType, extractedData, missingFields);

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
    try {
      const prompt = `You are an intelligent AI assistant that generates contextual follow-up questions for a local knowledge sharing platform.

Current information collected:
${JSON.stringify(currentData, null, 2)}

Content type: ${contentType}
Missing field: ${missingField}
Conversation history: ${conversationHistory.join(' | ')}

Generate a smart, contextual question to ask for the missing field. The question should:
1. Be natural and conversational
2. Provide context about why this information is important
3. Give examples when helpful
4. Be specific to the content type

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
            content: "You are an intelligent AI assistant that generates contextual follow-up questions. Respond with valid JSON only."
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
    let contentType: 'place' | 'service' | 'tip' | 'contact' | 'unclear' = 'unclear';
    if (['carpenter', 'plumber', 'electrician', 'mechanic', 'service'].some(word => lowerText.includes(word))) {
      contentType = 'service';
    } else if (['restaurant', 'cafe', 'shop', 'place', 'location'].some(word => lowerText.includes(word))) {
      contentType = 'place';
    } else if (['tip', 'advice', 'suggestion'].some(word => lowerText.includes(word))) {
      contentType = 'tip';
    } else if (['contact', 'phone', 'number', 'call'].some(word => lowerText.includes(word))) {
      contentType = 'contact';
    }

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
   * - place: require location/address selection via Maps picker
   * - service: require at least one identifier (phone or email)
   * - future categories: add here; UI can render dynamically
   */
  private ensureCategoryRequirements(
    contentType: RecommendationAnalysis['contentType'],
    extractedData: Record<string, any>,
    existingMissing: RecommendationAnalysis['missingFields']
  ): RecommendationAnalysis['missingFields'] {
    const missing: RecommendationAnalysis['missingFields'] = [...existingMissing];

    const hasField = (key: string) => {
      const v = extractedData?.[key];
      return v !== undefined && v !== null && String(v).trim().length > 0;
    };

    // Helper to add missing item if not already present
    const addMissing = (field: string, question: string, required = true, reasoning = 'Required for this recommendation', needsLocationPicker = false) => {
      const already = missing.some(m => m.field === field);
      if (!already) {
        missing.push({ field, question, required, reasoning, ...(needsLocationPicker ? { needsLocationPicker: true } : {}) });
      }
    };

    if (contentType === 'place') {
      // Require location; support multiple possible keys from frontend mapping
      const hasLocation = hasField('location') || hasField('location_address') || hasField('address') || hasField('location_name');
      if (!hasLocation) {
        addMissing(
          'location',
          'Where is this place? Please select it on the map.',
          true,
          'Place recommendations must include a concrete location to save in Places.',
          true
        );
      }
    } else if (contentType === 'service') {
      // Require at least one of phone/email
      const phone = extractedData?.contact_info?.phone || extractedData?.phone || extractedData?.service_phone;
      const email = extractedData?.contact_info?.email || extractedData?.email || extractedData?.service_email;
      if (!phone && !email) {
        addMissing(
          'contact_info',
          'What is the best contact for this service (phone or email)?',
          true,
          'Services must have a phone or email to deduplicate and save in Services.'
        );
      }
    }

    return missing;
  }

  async formatRecommendationPost(data: any, originalText?: string): Promise<string> {
    try {
      console.log('=== RECOMMENDATION AI FORMAT ===');
      console.log('recommendationAI.formatRecommendationPost - data:', data);
      console.log('recommendationAI.formatRecommendationPost - originalText:', originalText);
      
      const prompt = `You are a formatting assistant creating short, utilitarian recommendation posts in a third-person perspective.
  
  STYLE:
  - Write 3–8 concise sentences in third-person, focusing on key details to inform and engage readers.
  - Use a natural, straightforward tone that feels authentic and avoids overly personal or fake enthusiasm.
  - Include only the following fields if explicitly provided in data: name/category, address, pricing, contact (phone/email), best time, tips, specialities.
  - Order: name/category; address; pricing; contact; best time; tips; specialities.
  - Completely skip any field not provided in the data; do not mention missing fields or say they are unavailable.
  - Never invent or assume details; use only the provided data.
  - Ensure readability with line breaks between sentences.
  - Craft the post to pique interest with practical details, avoiding fluff or emojis.
  - If originalText is provided, use it as inspiration for tone but prioritize data accuracy.
  
  DATA (includes additional_details from Q&A):
  ${JSON.stringify(data, null, 2)}
  
  ORIGINAL (optional):
  ${originalText || ''}
  
  TASK:
  Produce a recommendation post in 3–8 lines, each a simple sentence in third-person.
  Example:
  Cafe Bloom offers a cozy cafe experience.
  It's located at 123 Main St, Springfield.
  Pricing is mid-range.
  Mornings are the best time to visit.
  Try the seasonal pastry for a treat.
  
  Return only the final text:`;
  
      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.6, // Consistent, controlled output
        max_tokens: 300 // Enforces brevity
      });
  
      const formattedText = response.choices[0]?.message?.content?.trim();
      
      console.log('recommendationAI.formatRecommendationPost - LLM response:', formattedText);
      
      if (!formattedText) {
        throw new Error('No response from LLM');
      }

      return formattedText;
  
    } catch (error) {
      console.error('Error formatting recommendation post:', error);
      // Fallback: construct a simple formatted post locally to keep UX flowing
      const lines: string[] = [];
      const nameOrCategory = (data?.name || data?.category || data?.type || data?.contentType || 'This recommendation').toString();
      lines.push(`${nameOrCategory} is recommended.`);
      if (data?.address || data?.location) {
        lines.push(`Located at ${data.address || data.location}.`);
      }
      if (data?.pricing) {
        lines.push(`Pricing: ${data.pricing}.`);
      }
      const contactParts: string[] = [];
      const contact = data?.contact || data?.contact_info;
      if (contact?.phone) contactParts.push(`Phone: ${contact.phone}`);
      if (contact?.email) contactParts.push(`Email: ${contact.email}`);
      if (contactParts.length) {
        lines.push(contactParts.join(' | '));
      }
      if (data?.best_times) {
        lines.push(`Best time: ${data.best_times}.`);
      }
      if (data?.tips) {
        lines.push(`${data.tips}.`);
      }
      if (Array.isArray(data?.specialities) && data.specialities.length) {
        lines.push(`specialities: ${data.specialities.join(', ')}.`);
      }
      if (lines.length === 1 && originalText) {
        // Ensure minimum content
        lines.push(originalText);
      }
      return lines.join('\n');
    }
  }
}

export const recommendationAI = new RecommendationAI();
