"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationAI = void 0;
const places_1 = require("../db/places");
const annotations_1 = require("../db/annotations");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env file from the root directory
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
// Initialize Groq client
const groq = new groq_sdk_1.default({
    apiKey: process.env.GROQ_API_KEY,
});
class ConversationAI {
    sessions = new Map();
    async processMessage(sessionId, userId, message) {
        // Get or create conversation state
        let state = this.sessions.get(sessionId);
        if (!state) {
            state = this.createNewSession(sessionId, userId);
        }
        // Add user message to history
        state.conversation_history.push({
            role: 'user',
            message,
            timestamp: new Date()
        });
        // Process based on current step
        let response;
        let action = 'ask_followup';
        switch (state.current_step) {
            case 'intent_detection':
                response = await this.detectIntent(message, state);
                break;
            case 'data_extraction':
                response = await this.extractData(message, state);
                break;
            case 'confirmation':
                response = await this.confirmData(message, state);
                break;
            default:
                response = "I'm not sure how to help with that. Could you tell me about a place, service, or tip you'd like to share?";
        }
        // Add assistant response to history
        state.conversation_history.push({
            role: 'assistant',
            message: response,
            timestamp: new Date()
        });
        // Update session state
        this.sessions.set(sessionId, state);
        return {
            response,
            action: state.current_step === 'complete' ? 'complete' : action,
            extracted_data: state.current_step === 'complete' ? state.extracted_data : undefined,
            content_type: state.content_type
        };
    }
    async detectIntent(message, state) {
        try {
            // Use AI to detect what type of content the user wants to share
            const intent = await this.analyzeIntentWithAI(message);
            if (intent.confidence > 0.7) {
                state.content_type = intent.type;
                state.current_step = 'data_extraction';
                state.missing_fields = this.getRequiredFields(intent.type);
                return this.getInitialQuestion(intent.type);
            }
            else {
                return "I'd love to help you share local knowledge! Are you thinking of a place, service provider, useful tip, or contact information?";
            }
        }
        catch (error) {
            console.error('Error detecting intent:', error);
            return "I'd love to help you share local knowledge! Are you thinking of a place, service provider, useful tip, or contact information?";
        }
    }
    async extractData(message, state) {
        try {
            // Extract information from user's response using AI
            const extracted = await this.parseResponseWithAI(message, state);
            // Update extracted data
            state.extracted_data = { ...state.extracted_data, ...extracted };
            // Check if we have enough information
            const stillMissing = state.missing_fields.filter(field => !state.extracted_data[field]);
            if (stillMissing.length === 0) {
                state.current_step = 'confirmation';
                return this.generateConfirmationMessage(state);
            }
            else {
                return this.generateFollowUpQuestion(stillMissing[0], state);
            }
        }
        catch (error) {
            console.error('Error extracting data:', error);
            return "I'm having trouble understanding that. Could you try rephrasing?";
        }
    }
    async confirmData(message, state) {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('yes') || lowerMessage.includes('correct') || lowerMessage.includes('right') || lowerMessage.includes('save')) {
            state.current_step = 'complete';
            return "Perfect! I've saved this information. Is there anything else you'd like to add?";
        }
        else if (lowerMessage.includes('no') || lowerMessage.includes('wrong') || lowerMessage.includes('change')) {
            state.current_step = 'data_extraction';
            return "No problem! What would you like to change?";
        }
        else {
            return "Please confirm if this information is correct, or let me know what you'd like to change.";
        }
    }
    async analyzeIntentWithAI(message) {
        try {
            const prompt = `Analyze this message and determine what type of local knowledge the user wants to share:

Message: "${message}"

Types:
- place: restaurants, cafes, shops, attractions, landmarks
- service: professionals like carpenters, drivers, tutors, repair people
- tip: advice, shortcuts, best practices, local knowledge
- contact: phone numbers, contact information for people

Respond with JSON only:
{
  "type": "place|service|tip|contact",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant that analyzes user messages to determine what type of local knowledge they want to share. Respond with valid JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "llama-3.1-70b-versatile",
                temperature: 0.3,
                max_tokens: 200,
            });
            const response = completion.choices[0]?.message?.content?.trim();
            if (!response) {
                throw new Error('No response from AI');
            }
            const parsed = JSON.parse(response);
            return {
                type: parsed.type,
                confidence: parsed.confidence
            };
        }
        catch (error) {
            console.error('Error analyzing intent with AI:', error);
            // Fallback to keyword-based detection
            return this.analyzeIntentFallback(message);
        }
    }
    analyzeIntentFallback(message) {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('carpenter') || lowerMessage.includes('driver') || lowerMessage.includes('service') || lowerMessage.includes('repair') || lowerMessage.includes('tutor')) {
            return { type: 'service', confidence: 0.8 };
        }
        else if (lowerMessage.includes('restaurant') || lowerMessage.includes('cafe') || lowerMessage.includes('place') || lowerMessage.includes('shop') || lowerMessage.includes('store')) {
            return { type: 'place', confidence: 0.8 };
        }
        else if (lowerMessage.includes('tip') || lowerMessage.includes('advice') || lowerMessage.includes('should know') || lowerMessage.includes('best time') || lowerMessage.includes('shortcut')) {
            return { type: 'tip', confidence: 0.8 };
        }
        else if (lowerMessage.includes('contact') || lowerMessage.includes('number') || lowerMessage.includes('call') || lowerMessage.includes('phone')) {
            return { type: 'contact', confidence: 0.8 };
        }
        return { type: 'place', confidence: 0.5 }; // Default fallback
    }
    async parseResponseWithAI(message, state) {
        try {
            const contentType = state.content_type || 'place';
            const extracted = state.extracted_data;
            const prompt = `Extract relevant information from this user message for a ${contentType}:

Message: "${message}"

Current extracted data: ${JSON.stringify(extracted)}

Extract and return JSON with these fields based on the content type:

For ${contentType}:
${this.getExtractionFields(contentType)}

Only include fields that are clearly mentioned or can be reasonably inferred. Return valid JSON only.`;
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant that extracts structured information from user messages. Respond with valid JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "llama-3.1-70b-versatile",
                temperature: 0.3,
                max_tokens: 300,
            });
            const response = completion.choices[0]?.message?.content?.trim();
            if (!response) {
                throw new Error('No response from AI');
            }
            return JSON.parse(response);
        }
        catch (error) {
            console.error('Error parsing response with AI:', error);
            // Fallback to simple extraction
            return this.parseResponseFallback(message, state);
        }
    }
    parseResponseFallback(message, state) {
        const extracted = {};
        if (state.content_type === 'service') {
            // Extract contact info
            const phoneMatch = message.match(/\b\d{10}\b/);
            if (phoneMatch) {
                extracted.contact_info = { phone: phoneMatch[0] };
            }
            // Extract specialties
            const specialties = message.match(/(?:specializ|good at|expert in|does)\s+([^.]+)/i);
            if (specialties) {
                extracted.specialties = [specialties[1].trim()];
            }
        }
        return extracted;
    }
    getExtractionFields(contentType) {
        const fieldMap = {
            'place': `{
        "name": "string - name of the place",
        "description": "string - what makes it special",
        "location": "string - address or area",
        "category": "string - type of place",
        "rating": "number 1-5 - user's rating",
        "best_times": "string - when to visit",
        "tips": "string - any additional tips"
      }`,
            'service': `{
        "name": "string - name of the service provider",
        "description": "string - what they do",
        "contact_info": "object - phone, email, etc",
        "specialties": "array - what they're good at",
        "location": "string - where they operate",
        "rating": "number 1-5 - user's rating",
        "availability": "string - when they're available",
        "pricing": "string - price range or info"
      }`,
            'tip': `{
        "description": "string - the tip or advice",
        "context": "string - when/where it applies",
        "location": "string - relevant location",
        "category": "string - type of tip",
        "when_useful": "string - when to use this tip"
      }`,
            'contact': `{
        "name": "string - name of the contact",
        "role": "string - what they do",
        "contact_info": "object - phone, email, etc",
        "specialties": "array - what they're good at",
        "location": "string - where they operate",
        "rating": "number 1-5 - user's rating",
        "notes": "string - additional notes"
      }`
        };
        return fieldMap[contentType] || '{}';
    }
    getRequiredFields(contentType) {
        const fieldMap = {
            'place': ['name', 'description', 'location'],
            'service': ['name', 'description', 'contact_info'],
            'tip': ['description', 'context'],
            'contact': ['name', 'contact_info', 'role']
        };
        return fieldMap[contentType] || ['name', 'description'];
    }
    getInitialQuestion(contentType) {
        const questions = {
            'place': "Great! What's the name of this place and what makes it special?",
            'service': "Awesome! What's the name of this service provider and what do they do?",
            'tip': "Perfect! What's the tip you'd like to share?",
            'contact': "Excellent! What's the name of this contact and what's their role?"
        };
        return questions[contentType] || "Tell me more about this!";
    }
    generateFollowUpQuestion(missingField, state) {
        const questions = {
            'name': "What's the name?",
            'description': "Can you tell me more about it?",
            'location': "Where is this located?",
            'contact_info': "How can people contact them?",
            'specialties': "What are they good at?",
            'rating': "How would you rate them out of 5?",
            'context': "What's the context for this tip?",
            'when_useful': "When is this most useful?",
            'role': "What's their role or profession?",
            'availability': "When are they available?",
            'pricing': "What's their pricing like?",
            'best_times': "What's the best time to visit?",
            'tips': "Any additional tips or advice?"
        };
        return questions[missingField] || "Can you provide more details?";
    }
    generateConfirmationMessage(state) {
        const data = state.extracted_data;
        const contentType = state.content_type;
        if (contentType === 'service') {
            return `Let me confirm: You're recommending ${data.name} who specializes in ${data.specialties?.join(', ') || 'various services'}. Contact: ${data.contact_info?.phone || 'not provided'}. Location: ${data.location || 'not specified'}. Rating: ${data.rating || 'not provided'}/5. Is this correct?`;
        }
        else if (contentType === 'place') {
            return `Let me confirm: ${data.name} - ${data.description}. Location: ${data.location || 'not specified'}. Category: ${data.category || 'not specified'}. Rating: ${data.rating || 'not provided'}/5. Is this correct?`;
        }
        else if (contentType === 'tip') {
            return `Let me confirm: Tip - "${data.description}". Context: ${data.context || 'not specified'}. Location: ${data.location || 'not specified'}. Is this correct?`;
        }
        else if (contentType === 'contact') {
            return `Let me confirm: ${data.name} - ${data.role}. Contact: ${data.contact_info?.phone || 'not provided'}. Specialties: ${data.specialties?.join(', ') || 'not specified'}. Rating: ${data.rating || 'not provided'}/5. Is this correct?`;
        }
        return `Let me confirm the details: ${JSON.stringify(data, null, 2)}. Is this correct?`;
    }
    createNewSession(sessionId, userId) {
        return {
            user_id: userId,
            session_id: sessionId,
            extracted_data: {},
            conversation_history: [],
            current_step: 'intent_detection',
            missing_fields: [],
            confidence_score: 0
        };
    }
    async saveExtractedData(extractedData, contentType, userId) {
        try {
            if (contentType === 'place') {
                // Create place and annotation
                const placeId = await (0, places_1.upsertPlace)({
                    name: extractedData.name,
                    address: extractedData.location,
                    category_name: extractedData.category,
                    metadata: {
                        description: extractedData.description,
                        best_times: extractedData.best_times,
                        tips: extractedData.tips
                    }
                });
                const annotationId = await (0, annotations_1.insertAnnotation)({
                    place_id: placeId,
                    user_id: userId,
                    notes: extractedData.description,
                    rating: extractedData.rating,
                    visibility: 'public',
                    auto_generate_embedding: true
                });
                return {
                    success: true,
                    place_id: placeId,
                    annotation_id: annotationId,
                    message: 'Place information saved successfully!'
                };
            }
            else if (contentType === 'service' || contentType === 'contact') {
                // Create a special "service" place for contacts/services
                const placeId = await (0, places_1.upsertPlace)({
                    name: extractedData.name,
                    address: extractedData.location,
                    category_name: 'service',
                    metadata: {
                        type: contentType,
                        contact_info: extractedData.contact_info,
                        specialties: extractedData.specialties,
                        availability: extractedData.availability,
                        pricing: extractedData.pricing,
                        role: extractedData.role
                    }
                });
                const annotationId = await (0, annotations_1.insertAnnotation)({
                    place_id: placeId,
                    user_id: userId,
                    notes: extractedData.description,
                    rating: extractedData.rating,
                    visibility: 'public',
                    auto_generate_embedding: true
                });
                return {
                    success: true,
                    place_id: placeId,
                    annotation_id: annotationId,
                    message: `${contentType} information saved successfully!`
                };
            }
            else if (contentType === 'tip') {
                // Create a special "tip" place
                const placeId = await (0, places_1.upsertPlace)({
                    name: `Tip: ${extractedData.description.substring(0, 50)}...`,
                    address: extractedData.location,
                    category_name: 'tip',
                    metadata: {
                        type: 'tip',
                        context: extractedData.context,
                        when_useful: extractedData.when_useful,
                        category: extractedData.category
                    }
                });
                const annotationId = await (0, annotations_1.insertAnnotation)({
                    place_id: placeId,
                    user_id: userId,
                    notes: extractedData.description,
                    visibility: 'public',
                    auto_generate_embedding: true
                });
                return {
                    success: true,
                    place_id: placeId,
                    annotation_id: annotationId,
                    message: 'Tip saved successfully!'
                };
            }
            return {
                success: false,
                message: 'Unknown content type'
            };
        }
        catch (error) {
            console.error('Error saving extracted data:', error);
            return {
                success: false,
                message: 'Failed to save information'
            };
        }
    }
    // Clean up old sessions (call this periodically)
    cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) {
        const now = new Date();
        for (const [sessionId, state] of this.sessions.entries()) {
            const lastMessage = state.conversation_history[state.conversation_history.length - 1];
            if (lastMessage && (now.getTime() - lastMessage.timestamp.getTime()) > maxAge) {
                this.sessions.delete(sessionId);
            }
        }
    }
}
exports.conversationAI = new ConversationAI();
