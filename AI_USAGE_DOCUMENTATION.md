# AI Usage in MapX Application

## Application Overview

### What MapX Is For

MapX (recce_) is a location-based recommendation platform that solves the problem of untrustworthy and impersonal review systems. Traditional review platforms suffer from:
- **Fake reviews** that mislead users
- **Lack of personal context** - reviews from strangers don't reflect your preferences
- **Fear of honest feedback** - people hesitate to share negative experiences publicly

MapX creates a **trusted, AI-powered ecosystem** where authentic recommendations flow naturally between people who know and trust each other through their social network.

### What MapX Does

**Core Features:**

1. **Social Recommendation Network**
   - Users build a network of trusted friends/connections
   - Share recommendations for places (restaurants, cafes, shops) and services (plumbers, electricians, professionals)
   - Recommendations are only visible to your network, enabling honest feedback
   - Map-based interface for visualizing recommendations geographically

2. **Recommendation Creation**
   - Users create recommendations with details like:
     - Place/service name and location
     - Personal notes and experiences
     - Ratings (1-5 stars)
     - Labels/tags (e.g., "family friendly", "good for work")
     - Visit dates, companions, favorite dishes, pricing info
   - Recommendations can be created as answers to questions from network members

3. **Discovery and Search**
   - Browse recommendations from your network on an interactive map
   - Search for specific places, locations, or users
   - Filter by ratings, labels, dates, and other criteria
   - View recommendation feeds and user profiles

4. **Question-Answer System**
   - Users can ask questions to their network (e.g., "Where's a good place for a date night?")
   - Network members can answer with recommendations
   - Questions and answers create a knowledge base within the social network

### How AI Fits In

AI is the **intelligence layer** that makes MapX's recommendation system powerful and user-friendly:

1. **Semantic Search** - AI enables natural language queries instead of exact keyword matching:
   - Users can search "quiet cafes good for work" and find relevant recommendations even if those exact words aren't in the text
   - Understands intent and context, not just keywords

2. **Content Understanding** - AI analyzes free-form text input to:
   - Extract structured data (names, locations, contact info) automatically
   - Determine content type (place vs. service)
   - Identify missing required information
   - Generate contextual follow-up questions

3. **Intelligent Summarization** - AI converts search results into:
   - Conversational, natural language answers
   - Actionable recommendations with specific details
   - User-attributed summaries that maintain trust

4. **Quality Control** - AI validates:
   - Whether search results match user intent
   - Content relevance and authenticity
   - Prevents spam and gibberish from entering the system

5. **User Experience Enhancement** - AI improves:
   - Text formatting and grammar
   - Question generation based on context
   - Search result presentation

**The Result:** Users can discover relevant recommendations through natural conversation, while the system maintains data quality and provides intelligent assistance throughout the recommendation creation and discovery process.

## AI Techniques and Implementation

### 1. Vector Embeddings for Semantic Search

**Service:** OpenAI `text-embedding-ada-002`
**Location:** `backend/src/utils/embeddings.ts`

**What it does:**
- Converts recommendation text (place names, addresses, reviews, labels, ratings, metadata) into 1536-dimensional vectors
- Converts user search queries into vectors for similarity matching
- Stores embeddings in PostgreSQL with pgvector extension

**Implementation:**
```12:29:backend/src/utils/embeddings.ts
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Embedding Data Structure:**
- Place information: name, address
- User information: reviewer name
- Review content: notes, descriptions
- Metadata: labels, ratings, companions, visit dates, pricing, experience details

**Effects:**
- Enables natural language search queries like "quiet cafes good for work" or "family friendly restaurants"
- Finds semantically similar recommendations even without exact keyword matches
- Supports location-based searches ("places in Hauz Khas")
- Supports user-based searches ("reviews by Sahil")

### 2. LLM-Based Content Analysis

**Service:** Groq API with `llama-3.3-70b-versatile`
**Location:** `backend/src/services/recommendationAI.ts`

**What it does:**
- Analyzes user input text to determine content type (place/service/unclear)
- Extracts structured data (name, location, contact info, highlights, pricing)
- Detects gibberish/spam
- Generates contextual follow-up questions for missing required fields
- Detects question context to adjust question style

**Implementation:**
```56:181:backend/src/services/recommendationAI.ts
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
```

**Effects:**
- Automatically extracts structured data from free-form text input
- Guides users through required fields with contextual questions
- Prevents invalid/spam content from being submitted
- Adapts question style based on context (answering questions vs. creating new recommendations)

### 3. AI-Powered Search Summaries

**Service:** Groq API with `llama-3.3-70b-versatile`
**Location:** `backend/src/utils/aiSummaries.ts`

**What it does:**
- Generates natural language summaries of search results
- Attributes recommendations to specific users
- Provides contextual, actionable answers to user queries
- Validates result relevance before generating summaries

**Implementation:**
```160:237:backend/src/utils/aiSummaries.ts
async function generateWithGroq(context: SearchContext, mode: SummaryMode = 'detailed'): Promise<string> {
  const groqStartTime = Date.now();
  console.log('🔍 Groq: Checking API key availability...');
  
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq API key not available');
  }
  console.log('✅ Groq: API key found');

  const enrichStartTime = Date.now();
  console.log('⏱️  Groq: Starting context enrichment...');
  const enrichedContext = enrichSearchContext(context, mode);
  const enrichEndTime = Date.now();
  console.log(`⏱️  Groq: Context enrichment completed in ${enrichEndTime - enrichStartTime}ms`);
  console.log(`📊 Groq: Context length: ${enrichedContext.searchResultsText.length} characters`);
  
  const apiStartTime = Date.now();
  const modelName = 'llama-3.3-70b-versatile';
  console.log(`🚀 Groq: Making API call to ${modelName}...`);
  
  const completion = await groq.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: "You are a helpful local recommendation assistant. Your job is to provide useful answers based on the search results provided. Use the information found to give practical, actionable recommendations. Be positive and helpful - if results exist, use them to answer the user's question."
      },
      {
        role: "user",
        content: `User searched for: "${context.query}"

SEARCH RESULTS (use this information to answer the user's question):
${enrichedContext.searchResultsText}

---
TASK: Write a helpful answer that USES the search results to answer the user's question.

IMPORTANT GUIDELINES:
1. **USE THE INFORMATION**: If results exist, use them to answer the question. Don't say "unfortunately no results" if there ARE results.
2. **BE HELPFUL**: Provide actionable recommendations based on what was found.
3. **BE SPECIFIC**: Mention specific places/services, ratings, and reviews from the data.
4. **BE POSITIVE**: If results match the query (even partially), present them positively.

FORMAT:
- Start with a brief answer to their question
- Highlight the top 2-3 most relevant options with specific details (ratings, reviews)
- Mention any important caveats (limited reviews, etc.) but don't let this overshadow the recommendations
- End with a helpful next step

EXAMPLES:
- If searching for "dj" and finding "DJ Snake" with "disc jockey" tag → Say "I found DJ Snake, a disc jockey with a 4.0/5 rating..."
- If searching for "asian food" and finding "Pan Asian Story" → Say "I found Enoki Pan Asian Story, which specializes in Pan Asian cuisine..."
- If searching for "sweet shop" and finding places with "sweets" → Say "I found Aggarwal Lassi Wala and Sweet House, which offers sweets..."

ONLY say "unfortunately no relevant information" if the results are COMPLETELY unrelated (e.g., searching for "hotel" but only finding "restaurants" with no lodging-related content).

STYLE:
- Conversational and helpful
- Use specific details from the search results
- Be concise but informative
- Focus on what WAS found, not what wasn't
`
      }
    ],
    temperature: 0.2,
    max_tokens: 700,
  });

  const apiEndTime = Date.now();
  const apiDuration = apiEndTime - apiStartTime;
  console.log(`⏱️  Groq: API call completed in ${apiDuration}ms`);
  
  const result = completion.choices[0]?.message?.content?.trim() || '';
  const totalGroqTime = Date.now() - groqStartTime;
  console.log(`📊 Groq: Total time: ${totalGroqTime}ms, Result length: ${result.length} characters`);
  
  return result;
}
```

**Effects:**
- Provides conversational, natural language answers instead of raw search results
- Helps users quickly understand what was found and why it's relevant
- Reduces cognitive load by summarizing multiple recommendations
- Maintains user attribution for trust and authenticity

### 4. Relevance Validation

**Service:** Groq API with `llama-3.3-70b-versatile`
**Location:** `backend/src/utils/relevanceValidator.ts`

**What it does:**
- Validates whether search results match user query intent
- Prevents false positives from semantic search
- Uses multi-stage validation: similarity thresholds, keyword matching, AI validation
- Handles semantic relationships (e.g., "asian food" → "Pan Asian restaurant")

**Implementation:**
```335:437:backend/src/utils/relevanceValidator.ts
async function validateWithAI(
  query: string,
  results: SearchResultForValidation[]
): Promise<RelevanceValidationResult> {
  
  try {
    const resultsText = results.slice(0, RELEVANCE_CONFIG.MAX_RESULTS_TO_VALIDATE)
      .map((r, i) => {
        const name = r.place_name || r.service_name || 'Unknown';
        const similarity = Math.round(r.average_similarity * 100);
        const typeInfo = r.place_primary_type 
          ? ` [Type: ${r.place_primary_type}]`
          : r.service_type 
          ? ` [Service: ${r.service_type}]`
          : '';
        return `${i + 1}. ${name}${typeInfo} (${similarity}% match)`;
      })
      .join('\n');
    
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a relevance validator. Your job is to determine if search results match the user\'s query intent. Be reasonable - mark as relevant if results are reasonably related to the query, even if not perfect matches. For example: "asian food" matches "Pan Asian restaurant", "dj" matches "DJ Snake", "sweet shop" matches places with "sweets" in the name.',
        },
        {
          role: 'user',
          content: `Query: "${query}"

Search Results:
${resultsText}

Task: Determine if these results are relevant to the query. Consider:
1. Does the query ask for a specific category (hotel, restaurant, etc.)?
2. Do the results match that category (be lenient - partial matches count)?
3. Are the similarity scores high enough to indicate genuine relevance?
4. Look for semantic relationships (e.g., "asian food" -> "Pan Asian", "dj" -> "DJ", "sweet shop" -> "sweets")

Be REASONABLE - if results are reasonably related to the query, mark as relevant. Only reject if results are clearly unrelated.

Respond with ONLY a JSON object in this exact format:
{
  "isRelevant": true/false,
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    });
    
    const responseText = completion.choices[0]?.message?.content?.trim() || '';
    
    // Try to parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isRelevant: Boolean(parsed.isRelevant),
          reason: parsed.reason || 'AI validation',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        };
      }
    } catch (parseError) {
      console.warn('Failed to parse AI relevance validation response:', parseError);
    }
    
    // Fallback: check if response indicates relevance
    const responseLower = responseText.toLowerCase();
    const isRelevant = responseLower.includes('relevant') && !responseLower.includes('not relevant');
    
    return {
      isRelevant,
      reason: 'AI validation (parsed from text)',
      confidence: isRelevant ? 0.7 : 0.3,
    };
  } catch (error) {
    console.error('Error in AI relevance validation:', error);
    // Fallback to keyword check
    const detectedCategories = detectQueryIntent(query);
    const topResult = results[0];
    const isRelevant = quickKeywordCheck(query, topResult, detectedCategories);
    return {
      isRelevant,
      reason: 'Fallback keyword check (AI unavailable)',
      confidence: isRelevant ? 0.6 : 0.3,
    };
  }
}
```

**Effects:**
- Reduces irrelevant search results shown to users
- Handles edge cases where semantic similarity might be misleading
- Improves search quality by validating intent alignment
- Provides confidence scores for result relevance

### 5. Text Formatting and Improvement

**Service:** Groq API with `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`
**Location:** `backend/src/services/recommendationAI.ts`

**What it does:**
- Formats recommendation posts into polished, third-person descriptions
- Corrects spelling and grammar errors
- Adapts formatting based on content type (place vs. service)

**Effects:**
- Ensures consistent, professional presentation of recommendations
- Improves readability and user experience
- Maintains neutral, third-person voice for recommendations

## AI Services and Models

### OpenAI
- **Model:** `text-embedding-ada-002`
- **Purpose:** Vector embeddings for semantic search
- **Dimensions:** 1536
- **Usage:** All recommendation and search query embeddings

### Groq
- **Model:** `llama-3.3-70b-versatile`
- **Purpose:** Content analysis, search summaries, relevance validation, text formatting
- **Temperature:** 0.1-0.3 (varies by task)
- **Usage:** All LLM-based text generation and analysis

- **Model:** `llama-3.1-8b-instant`
- **Purpose:** Grammar and spelling correction
- **Temperature:** 0.1
- **Usage:** Text improvement tasks

## Technical Architecture

### Asynchronous Processing
- Embeddings generated asynchronously via queue system (`backend/src/services/embeddingQueue.ts`)
- Non-blocking user operations
- Background processing with retry logic

### Database
- PostgreSQL with pgvector extension for vector similarity search
- Cosine similarity for matching embeddings
- Configurable similarity thresholds (default: 0.3-0.7)

### Configuration
- Search thresholds: `backend/src/config/searchConfig.ts`
- Field requirements: `backend/src/config/fieldConfig.ts`
- Environment variables: `OPENAI_API_KEY`, `GROQ_API_KEY`

## Key Effects Summary

1. **Semantic Search:** Natural language queries find relevant recommendations without exact keyword matches
2. **Content Extraction:** Automatically structures free-form text into organized data
3. **Intelligent Summarization:** Converts search results into conversational, actionable answers
4. **Quality Control:** Validates content relevance and prevents spam/gibberish
5. **User Experience:** Reduces friction in creating recommendations and finding relevant content

