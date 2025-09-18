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
    rating?: number;
    specialties?: string[];
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
    "rating": number if mentioned,
    "specialties": ["array of specialties if mentioned"],
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
      "reasoning": "why this information is important"
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

      return {
        isValid: parsed.isValid || false,
        isGibberish: parsed.isGibberish || false,
        contentType: parsed.contentType || 'unclear',
        extractedData: parsed.extractedData || {},
        missingFields: parsed.missingFields || [],
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

    return {
      isValid: !isGibberish,
      isGibberish,
      contentType,
      extractedData: {
        description: text
      },
      missingFields: [],
      confidence: 0.3,
      reasoning: 'Fallback analysis used due to AI error'
    };
  }

  async formatRecommendationPost(data: any, originalText?: string): Promise<string> {
    try {
      console.log('=== RECOMMENDATION AI FORMAT ===');
      console.log('recommendationAI.formatRecommendationPost - data:', data);
      console.log('recommendationAI.formatRecommendationPost - originalText:', originalText);
      
      const prompt = `You are a formatting assistant that produces concise, well-structured recommendation posts.

STYLE & RULES:
- Output MUST be short, to-the-point, and highly scannable.
- Use a single short intro sentence (optional). Avoid verbosity or storytelling.
- Use labeled lines for key details. Preferred labels (use only if data exists):
  Name, Category, Location, Timings, Contact Information, Rating, Specialties, Best Times, Tips
- Keep labels capitalized and followed by a colon, e.g. "Timings: 10am–6pm".
- Use basic markdown for emphasis only where helpful: **bold** for labels and important values; _italics_ sparingly.
- No bullet points unless there are 3+ items; otherwise comma‑separate.
- Never invent data. Only include fields that exist in the provided input.
- NEVER add explanatory notes, disclaimers, or comments about missing information.
- NEVER mention what information is missing or unavailable.
- Prefer the following order if available: Name, Category, Location, Timings, Contact Information, Rating, Specialties, Best Times, Tips, Summary.

INPUT DATA:
${JSON.stringify(data, null, 2)}

ORIGINAL (optional):
${originalText || ''}

TASK:
Return a compact post using the format below. Only include lines for fields that exist. Do NOT add any notes or explanations about missing data.

Example format:
**Name:** Cafe Bloom
**Category:** Cafe
**Location:** 123 Main St
**Timings:** 10am–6pm
**Contact Information:** (555) 123‑4567
**Rating:** 4/5
**Specialties:** sourdough, flat whites
**Tips:** _Ask for the seasonal pastry._

Now produce the final post:`;

      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 500
      });

      const formattedText = response.choices[0]?.message?.content?.trim();
      
      console.log('recommendationAI.formatRecommendationPost - LLM response:', formattedText);
      
      if (!formattedText) {
        throw new Error('No response from LLM');
      }

      return formattedText;

    } catch (error) {
      console.error('Error formatting recommendation post:', error);
      throw error;
    }
  }
}

export const recommendationAI = new RecommendationAI();
