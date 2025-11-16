import Groq from 'groq-sdk';
import '../config/env';

/**
 * Relevance validation utility for search results
 * 
 * This module provides functions to validate whether search results are actually
 * relevant to the user's query intent, preventing false positives from semantic search.
 */

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Configuration for relevance validation
 */
const RELEVANCE_CONFIG = {
  /** Minimum similarity threshold for results to be considered potentially relevant */
  MIN_SIMILARITY_THRESHOLD: 0.65, // Lowered from 0.75 - semantic search already filters at 0.7
  
  /** Threshold for category-specific queries (hotels, restaurants, etc.) */
  CATEGORY_SPECIFIC_THRESHOLD: 0.7, // Lowered from 0.8 - be more lenient
  
  /** Maximum number of results to validate */
  MAX_RESULTS_TO_VALIDATE: 3,
  
  /** Minimum similarity to skip AI validation (if above this, trust keyword check) */
  HIGH_CONFIDENCE_THRESHOLD: 0.72,
} as const;

/**
 * Category keywords for intent detection
 */
const CATEGORY_KEYWORDS = {
  hotel: ['hotel', 'lodging', 'accommodation', 'stay', 'room', 'resort', 'inn', 'hostel'],
  restaurant: ['restaurant', 'cafe', 'food', 'dining', 'eat', 'meal', 'cuisine', 'bistro'],
  cafe: ['cafe', 'coffee', 'coffeeshop', 'espresso', 'latte'],
  bar: ['bar', 'pub', 'cocktail', 'drinks', 'nightlife'],
  service: ['service', 'provider', 'professional', 'business'],
} as const;

/**
 * Google Places API types mapping to our categories
 * These are the actual types returned by Google Places API
 */
const GOOGLE_PLACES_TYPE_MAPPING: Record<string, string[]> = {
  hotel: ['lodging', 'hotel', 'resort', 'inn', 'hostel', 'motel', 'bed_and_breakfast'],
  restaurant: ['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'cafe', 'bakery', 'bistro'],
  cafe: ['cafe', 'bakery', 'coffee_shop'],
  bar: ['bar', 'night_club', 'pub'],
  service: ['establishment', 'point_of_interest'],
} as const;

/**
 * Result from relevance validation
 */
export interface RelevanceValidationResult {
  /** Whether the results are relevant to the query */
  isRelevant: boolean;
  
  /** Reason for the validation decision */
  reason?: string;
  
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Search result for validation
 */
export interface SearchResultForValidation {
  /** Average similarity score */
  average_similarity: number;
  
  /** Place name (if applicable) */
  place_name?: string;
  
  /** Place primary type from Google Places API (e.g., "lodging", "restaurant") */
  place_primary_type?: string;
  
  /** Place types array from Google Places API */
  place_types?: string[];
  
  /** Service name (if applicable) */
  service_name?: string;
  
  /** Service type (e.g., "painter", "plumber") */
  service_type?: string;
  
  /** Content type */
  content_type?: string;
  
  /** Description or notes from recommendations */
  description?: string;
  
  /** Labels from recommendations */
  labels?: string[];
}

/**
 * Extract query intent category from search query
 * 
 * @param query - The search query
 * @returns Array of detected categories, ordered by confidence
 */
function detectQueryIntent(query: string): string[] {
  const queryLower = query.toLowerCase();
  const detectedCategories: Array<{ category: string; matches: number }> = [];
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = keywords.filter(keyword => queryLower.includes(keyword)).length;
    if (matches > 0) {
      detectedCategories.push({ category, matches });
    }
  }
  
  // Sort by number of matches (more matches = higher confidence)
  return detectedCategories
    .sort((a, b) => b.matches - a.matches)
    .map(c => c.category);
}

/**
 * Extract meaningful keywords from query (removes common words)
 */
function extractQueryKeywords(query: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'for', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'some', 'any', 'looking', 'for']);
  const words = query.toLowerCase().split(/\s+/);
  return words.filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Check if two words are semantically related (handles partial matches, synonyms)
 */
function wordsAreRelated(queryWord: string, resultWord: string): boolean {
  const q = queryWord.toLowerCase();
  const r = resultWord.toLowerCase();
  
  // Exact match
  if (r.includes(q) || q.includes(r)) {
    return true;
  }
  
  // Common synonyms and variations
  const synonymMap: Record<string, string[]> = {
    'asian': ['asian', 'pan asian', 'oriental', 'chinese', 'japanese', 'thai', 'indian', 'korean'],
    'food': ['food', 'cuisine', 'restaurant', 'dining', 'meal', 'dish', 'dishes'],
    'dj': ['dj', 'disc jockey', 'deejay', 'music', 'mixer', 'disc', 'jockey'],
    'sweet': ['sweet', 'sweets', 'dessert', 'candy', 'confectionery', 'mithai'],
    'shop': ['shop', 'store', 'wala', 'house'],
  };
  
  // Check if query word matches any synonym in result
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    // If query contains key or any synonym, check if result contains key or any synonym
    const queryHasKeyOrSynonym = q.includes(key) || synonyms.some(s => q.includes(s));
    const resultHasKeyOrSynonym = r.includes(key) || synonyms.some(s => r.includes(s));
    
    if (queryHasKeyOrSynonym && resultHasKeyOrSynonym) {
      return true;
    }
    
    // Also check if query word is in synonyms and result contains synonym
    if (synonyms.includes(q) && resultHasKeyOrSynonym) {
      return true;
    }
    if (synonyms.some(s => r.includes(s)) && queryHasKeyOrSynonym) {
      return true;
    }
  }
  
  // Check if query word appears as part of result word (e.g., "asian" in "pan asian")
  if (r.includes(q) || q.split(' ').some(qw => r.includes(qw))) {
    return true;
  }
  
  return false;
}

/**
 * Check if labels match query keywords
 */
function checkLabelsMatchQuery(
  labels: string[],
  queryKeywords: string[],
  detectedCategories: string[]
): boolean {
  const labelsLower = labels.map(l => l.toLowerCase());
  const labelsText = labelsLower.join(' ');
  
  // Check if any query keyword matches labels
  for (const qw of queryKeywords) {
    // Direct match in labels
    if (labelsLower.some(label => label.includes(qw) || qw.includes(label))) {
      return true;
    }
    // Semantic match
    if (labelsLower.some(label => wordsAreRelated(qw, label))) {
      return true;
    }
    // Check if label text contains query word (e.g., "disc jockey" contains "dj")
    if (typeof labelsText === 'string' && labelsText.includes(qw)) {
      return true;
    }
  }
  
  // Check category keywords against labels
  for (const category of detectedCategories) {
    const categoryKeywords = CATEGORY_KEYWORDS[category as keyof typeof CATEGORY_KEYWORDS] || [];
    if (categoryKeywords.some((keyword: string) => 
      labelsLower.some((label: string) => label.includes(keyword) || keyword.includes(label))
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if place types match detected categories
 */
function checkPlaceTypesMatch(
  placeTypes: string[],
  detectedCategories: string[]
): boolean {
  for (const category of detectedCategories) {
    const expectedTypes = GOOGLE_PLACES_TYPE_MAPPING[category] || [];
    const hasMatchingType = expectedTypes.some(type => 
      placeTypes.some(pt => pt.includes(type) || type.includes(pt))
    );
    if (hasMatchingType) {
      return true;
    }
  }
  return false;
}

/**
 * Check if query keywords match result text (name/description)
 */
function checkQueryKeywordsMatch(
  queryKeywords: string[],
  resultName: string,
  resultDescription: string
): boolean {
  return queryKeywords.some(qw => {
    // Direct match
    if (resultName.includes(qw) || resultDescription.includes(qw)) {
      return true;
    }
    // Semantic match
    if (wordsAreRelated(qw, resultName) || wordsAreRelated(qw, resultDescription)) {
      return true;
    }
    // Check if query word appears in result (handles "asian" -> "pan asian")
    const resultText = `${resultName} ${resultDescription}`;
    if (resultText.includes(qw) || qw.split(' ').some(w => resultText.includes(w))) {
      return true;
    }
    return false;
  });
}

/**
 * Quick keyword-based relevance check
 * 
 * @param query - The search query
 * @param result - The search result to validate
 * @param detectedCategories - Categories detected in the query
 * @returns Whether the result appears relevant based on keywords
 */
function quickKeywordCheck(
  query: string,
  result: SearchResultForValidation,
  detectedCategories: string[]
): boolean {
  const resultName = (result.place_name || result.service_name || '').toLowerCase();
  const resultDescription = (result.description || '').toLowerCase();
  const queryKeywords = extractQueryKeywords(query);
  
  // If no specific category detected, check for keyword matches
  if (detectedCategories.length === 0) {
    return queryKeywords.length === 0 || checkQueryKeywordsMatch(queryKeywords, resultName, resultDescription);
  }
  
  // Check Google Places API types for places (most reliable)
  if (result.place_primary_type || (result.place_types && result.place_types.length > 0)) {
    const placeTypes = [
      result.place_primary_type,
      ...(result.place_types || [])
    ].filter(Boolean).map(t => t!.toLowerCase());
    
    if (checkPlaceTypesMatch(placeTypes, detectedCategories)) {
      return true;
    }
  }
  
  // Check service type for services
  if (result.service_type && detectedCategories.includes('service')) {
    const serviceTypeLower = result.service_type.toLowerCase();
    const serviceKeywords = CATEGORY_KEYWORDS.service;
    if (serviceKeywords.some(keyword => serviceTypeLower.includes(keyword))) {
      return true;
    }
  }
  
  // Check labels from recommendations (very important for service matching)
  if (result.labels && result.labels.length > 0) {
    if (checkLabelsMatchQuery(result.labels, queryKeywords, detectedCategories)) {
      return true;
    }
  }
  
  // Enhanced keyword matching with semantic relations
  const hasQueryKeywords = checkQueryKeywordsMatch(queryKeywords, resultName, resultDescription);
  
  if (hasQueryKeywords) {
    return true;
  }
  
  // For category-specific queries without keyword matches, be lenient
  // (let similarity score decide in the caller)
  return true;
}

/**
 * Validate relevance using AI (for borderline cases)
 * 
 * @param query - The search query
 * @param results - Top search results to validate
 * @returns Validation result with confidence score
 */
async function validateWithAI(
  query: string,
  results: SearchResultForValidation[]
): Promise<RelevanceValidationResult> {
  if (!process.env.GROQ_API_KEY) {
    // Fallback to keyword-based check if AI not available
    const detectedCategories = detectQueryIntent(query);
    const topResult = results[0];
    const isRelevant = quickKeywordCheck(query, topResult, detectedCategories);
    return {
      isRelevant,
      reason: isRelevant ? 'Keyword match' : 'No keyword match found',
      confidence: isRelevant ? 0.6 : 0.3,
    };
  }
  
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

/**
 * Validate whether search results are relevant to the query
 * 
 * This function performs multi-stage validation:
 * 1. Checks similarity thresholds
 * 2. Detects query intent (category-specific queries)
 * 3. Performs keyword-based validation
 * 4. Uses AI validation for borderline cases
 * 
 * @param query - The search query
 * @param results - Search results to validate
 * @param strictThreshold - Optional custom threshold (defaults to config value)
 * @returns Validation result with reason and confidence
 */
export async function validateSearchRelevance(
  query: string,
  results: SearchResultForValidation[],
  strictThreshold?: number
): Promise<RelevanceValidationResult> {
  // Early return for empty results
  if (results.length === 0) {
    return {
      isRelevant: false,
      reason: 'No search results found',
      confidence: 0,
    };
  }
  
  const threshold = strictThreshold ?? RELEVANCE_CONFIG.MIN_SIMILARITY_THRESHOLD;
  const topResult = results[0];
  
  // Stage 1: Check similarity threshold
  if (topResult.average_similarity < threshold) {
    return {
      isRelevant: false,
      reason: `Top result similarity (${Math.round(topResult.average_similarity * 100)}%) below threshold (${Math.round(threshold * 100)}%)`,
      confidence: 0.2,
    };
  }
  
  // Stage 2: Detect query intent
  const detectedCategories = detectQueryIntent(query);
  const isCategorySpecific = detectedCategories.length > 0;
  
  // Stage 3: For category-specific queries, use stricter threshold
  if (isCategorySpecific) {
    const categoryThreshold = RELEVANCE_CONFIG.CATEGORY_SPECIFIC_THRESHOLD;
    if (topResult.average_similarity < categoryThreshold) {
      // Still do keyword check before rejecting
      const keywordRelevant = quickKeywordCheck(query, topResult, detectedCategories);
      if (!keywordRelevant) {
        return {
          isRelevant: false,
          reason: `Category-specific query (${detectedCategories.join(', ')}) but result similarity (${Math.round(topResult.average_similarity * 100)}%) below category threshold (${Math.round(categoryThreshold * 100)}%)`,
          confidence: 0.3,
        };
      }
    }
  }
  
  // Stage 4: Quick keyword check
  const keywordRelevant = quickKeywordCheck(query, topResult, detectedCategories);
  
  // If keyword check passes, trust it (especially for high similarity scores)
  if (keywordRelevant) {
    return {
      isRelevant: true,
      reason: 'Keyword match found',
      confidence: Math.min(0.95, topResult.average_similarity + 0.15),
    };
  }
  
  // If similarity is high enough, trust it even without keyword match
  if (topResult.average_similarity >= RELEVANCE_CONFIG.HIGH_CONFIDENCE_THRESHOLD) {
    return {
      isRelevant: true,
      reason: 'High similarity score',
      confidence: Math.min(0.9, topResult.average_similarity + 0.1),
    };
  }
  
  // Only use AI validation for borderline cases (low similarity AND no keyword match)
  if (topResult.average_similarity < RELEVANCE_CONFIG.HIGH_CONFIDENCE_THRESHOLD) {
    // Use AI validation but be more lenient
    const aiResult = await validateWithAI(query, results);
    // If AI says relevant OR similarity is decent (>= 0.68), accept it
    if (aiResult.isRelevant || topResult.average_similarity >= 0.68) {
      return {
        isRelevant: true,
        reason: aiResult.isRelevant ? aiResult.reason : 'Similarity score acceptable',
        confidence: Math.max(aiResult.confidence || 0.5, topResult.average_similarity),
      };
    }
    return aiResult;
  }
  
  return {
    isRelevant: true,
    reason: 'Similarity score acceptable',
    confidence: Math.min(0.9, topResult.average_similarity + 0.1),
  };
}

/**
 * Generate a user-friendly "no relevant results" message
 * 
 * @param query - The search query
 * @returns Formatted message for the user
 */
export function generateNoRelevantResultsMessage(query: string): string {
  return `Unfortunately, your network doesn't have any relevant information about "${query}" yet.

The search found some loosely related recommendations, but they don't match what you're looking for. Try asking your friends to share their experiences, or refine your search with more specific keywords.`;
}

