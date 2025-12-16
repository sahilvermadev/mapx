import Groq from 'groq-sdk';
import '../config/env';
import { validateSearchRelevance, generateNoRelevantResultsMessage, type SearchResultForValidation } from './relevanceValidator';

// Initialize AI client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface SearchContext {
  query: string;
  results: Array<
    | {
        type: 'place';
        place_id?: number | null;
        place_name: string;
        place_address?: string;
        place_lat?: number | null;
        place_lng?: number | null;
        place_primary_type?: string;
        place_types?: string[];
        total_recommendations: number;
        average_similarity: number;
        recommendations: Array<{
          user_name: string;
          notes?: string;
          rating?: number;
          labels?: string[];
          went_with?: string[];
          visit_date?: string;
        }>;
      }
    | {
        type: 'service';
        service_id?: number | null;
        service_name: string;
        service_type?: string | null;
        service_address?: string | null;
        total_recommendations: number;
        average_similarity: number;
        recommendations: Array<{
          user_name: string;
          notes?: string;
          rating?: number;
          labels?: string[];
          went_with?: string[];
          visit_date?: string;
        }>;
      }
  >;
  total_places: number;
  total_recommendations: number;
  follow_up_prompts?: string[];
  user_lat?: number | null;
  user_lng?: number | null;
}

export type SummaryMode = 'detailed';

interface CardCatalogEntry {
  key: string;
  name: string;
  ratingText: string;
  highlight: string;
}

function extractAreaFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length >= 2) {
    // e.g. "Karims, Jama Masjid, Delhi 110006" → "Jama Masjid"
    return parts[parts.length - 2];
  }
  return parts[0];
}

function getDistanceInKm(
  userLat: number,
  userLng: number,
  placeLat: number,
  placeLng: number
): number {
  const R = 6371; // km
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(placeLat - userLat);
  const dLng = toRad(placeLng - userLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLat)) *
      Math.cos(toRad(placeLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceLabel(
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  placeLat: number | null | undefined,
  placeLng: number | null | undefined
): string | null {
  if (
    typeof userLat !== 'number' ||
    typeof userLng !== 'number' ||
    typeof placeLat !== 'number' ||
    typeof placeLng !== 'number'
  ) {
    console.log('📍 [DISTANCE] Skipping distance label (missing coords):', {
      userLat,
      userLng,
      placeLat,
      placeLng
    });
    return null;
  }
  const km = getDistanceInKm(userLat, userLng, placeLat, placeLng);
  if (!Number.isFinite(km)) return null;

  if (km < 0.5) return 'within walking distance (~5–10 min)';
  if (km < 2) return `${km.toFixed(1)} km away (short ride)`;
  if (km < 8) return `${km.toFixed(1)} km away`;
  if (km < 20) return `${km.toFixed(0)} km away (a bit farther)`;
  return `${km.toFixed(0)} km away (other part of the city or nearby city)`;
}

function buildResultKey(result: SearchContext['results'][number]): string | null {
  if (result.type === 'place' && (result as any).place_id) {
    return `place:${(result as any).place_id}`;
  }
  if (result.type === 'service' && (result as any).service_id) {
    return `service:${(result as any).service_id}`;
  }
  return null;
}

/**
 * Generate an intelligent summary using Groq models
 */
export interface AISummaryResult {
  text: string;
  followUps: string[];
  cardsAllowed: boolean;
}

export interface StreamingAISummaryCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (result: AISummaryResult) => void;
  onError: (error: Error) => void;
}

export async function generateAISummary(context: SearchContext, mode: SummaryMode = 'detailed'): Promise<AISummaryResult> {
  const startTime = Date.now();
  console.log('🤖 [AI] Starting modern AI summary generation...');
  console.log('🤖 [AI] Query:', context.query);
  console.log('🤖 [AI] Results count:', context.results.length);
  console.log('🤖 [AI] Total places:', context.total_places);
  console.log('🤖 [AI] Total recommendations:', context.total_recommendations);
  console.log('📍 [AI DEBUG] Location context:', {
    user_lat: context.user_lat,
    user_lng: context.user_lng,
    hasGPS: typeof context.user_lat === 'number' && typeof context.user_lng === 'number',
  });
  
  // Early return for empty results to prevent AI hallucination
  if (context.results.length === 0) {
    console.log('🚫 [AI] No search results available, returning fallback summary');
    return {
      text: generateFallbackSummary(context),
      followUps: [],
      cardsAllowed: false,
    };
  }
  
  // Validate relevance before generating summary
  try {
    const resultsForValidation: SearchResultForValidation[] = context.results.map(result => {
      const firstRec = result.recommendations[0];
      const notes = (firstRec as any)?.notes || (firstRec as any)?.description;
      const labels = firstRec?.labels || [];
      
      return {
        average_similarity: result.average_similarity,
        place_name: (result as any).place_name,
        place_primary_type: (result as any).place_primary_type,
        place_types: (result as any).place_types || [],
        service_name: (result as any).service_name,
        service_type: (result as any).service_type,
        content_type: result.type === 'place' ? 'place' : 'service',
        description: notes,
        labels: labels,
      };
    });
    
    const relevanceCheck = await validateSearchRelevance(
      context.query,
      resultsForValidation,
      0.65 // More lenient threshold - semantic search already filters at 0.7
    );
    
    if (!relevanceCheck.isRelevant) {
      console.log('🚫 [AI] Results not relevant to query, returning no-relevant-results message');
      console.log('🚫 [AI] Relevance reason:', relevanceCheck.reason);
      console.log('🚫 [AI] Relevance confidence:', relevanceCheck.confidence);
      return {
        text: generateNoRelevantResultsMessage(context.query),
        followUps: [],
        cardsAllowed: false,
      };
    }
    
    console.log('✅ [AI] Results validated as relevant, proceeding with summary generation');
    console.log('✅ [AI] Relevance confidence:', relevanceCheck.confidence);
  } catch (error) {
    console.error('⚠️ [AI] Error during relevance validation, proceeding with summary:', error);
    // Continue with summary generation if validation fails
  }
  
  console.log('🤖 [AI] Sample results:', context.results.slice(0, 2).map(r => ({
    type: r.type,
    name: (r as any).place_name || (r as any).service_name,
    recs: r.total_recommendations
  })));
  
  try {
    // Log context enrichment timing
    const enrichStartTime = Date.now();
    console.log('⏱️  Starting context enrichment...');
    
    // Single detailed mode
    const modelName = 'llama-3.3-70b-versatile';
    console.log(`🔄 Using Groq ${modelName} (${mode} mode)...`);
    
    const enrichEndTime = Date.now();
    console.log(`⏱️  Context enrichment completed in ${enrichEndTime - enrichStartTime}ms`);

    const providerStartTime = Date.now();
    try {
      const summary = await generateWithGroq(context, mode);
      const providerEndTime = Date.now();
      const providerDuration = providerEndTime - providerStartTime;
      
      if (summary?.text && summary.text.length > 50) {
        console.log(`✅ Groq ${modelName} generated successful summary in ${providerDuration}ms`);
        console.log(`📊 Summary length: ${summary.text.length} characters`);
        const totalTime = Date.now() - startTime;
        console.log(`⏱️  Total AI summary generation time: ${totalTime}ms`);
        return summary;
      } else {
        console.log(`⚠️  Groq ${modelName} returned short/empty summary (${summary?.text?.length || 0} chars) in ${providerDuration}ms`);
        throw new Error('Summary too short');
      }
    } catch (error) {
      const providerEndTime = Date.now();
      const providerDuration = providerEndTime - providerStartTime;
      console.log(`❌ Groq ${modelName} failed after ${providerDuration}ms:`, error instanceof Error ? error.message : String(error));
      throw error;
    }

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Error generating AI summary after ${totalTime}ms:`, error);
    console.log('🔄 Using fallback summary');
    return {
      text: generateFallbackSummary(context),
      followUps: [],
      cardsAllowed: false,
    };
  }
}

async function generateWithGroq(context: SearchContext, mode: SummaryMode = 'detailed'): Promise<AISummaryResult> {
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
  const cardCatalogText = enrichedContext.cardCatalog.length
    ? enrichedContext.cardCatalog.map(card => `- KEY: ${card.key} | ${card.name} | ${card.ratingText} | Highlight: ${card.highlight}`).join('\n')
    : '- No cards available';
  
  const apiStartTime = Date.now();
  const modelName = 'llama-3.3-70b-versatile';
  console.log(`🚀 Groq: Making API call to ${modelName}...`);
  
  const userPrompt = [
    `User searched for: "${context.query}"`,
    '',
    'SEARCH RESULTS (use this information to answer the user\'s question):',
    enrichedContext.searchResultsText,
    '',
    'CARD CATALOG (Insert "[CARD:KEY]" markers where you want the UI to render the card, max 2 cards):',
    cardCatalogText,
    '',
    '---',
    'TASK: Write a helpful answer that USES the search results to answer the user\'s question. Weave the card markers directly into your message where they make sense.',
    '',
    'IMPORTANT GUIDELINES:',
    '1. **USE THE INFORMATION**: If results exist, use them to answer the question. Don\'t say "unfortunately no results" if there ARE results.',
    '2. **CARD MARKERS**:',
    '   - Insert [CARD:KEY] on its own line (blank line before and after) when you want the UI to show that card.',
    '   - Use at most TWO markers, only for keys listed in the catalog above.',
    '   - Reference the card in your surrounding text so the placement feels intentional.',
    '3. **BE SPECIFIC**: Mention concrete details (ratings, reviews, why it fits).',
    '4. **STRUCTURE**: 2-3 short paragraphs max. Keep it punchy.',
    '5. **TONE**: Positive, conversational, and actionable.',
    '',
    'FORMAT EXAMPLE:',
    'I found a chill trattoria that nails wood-fired pizza for date night.',
    '[CARD:place:123]',
    'Need something more private? This chef does on-demand Italian feasts.',
    '[CARD:service:45]',
    'Ask me for another mood if you want backups.',
    '',
    'ONLY say "unfortunately no relevant information" if the results are COMPLETELY unrelated (e.g., searching for "hotel" but only finding "restaurants" with no lodging-related content).',
    '',
    'After your main response, add a blank line and then write `FOLLOW_UP_PROMPTS:` followed by up to 3 ultra-short, data-grounded suggestions separated by ` | ` (example: FOLLOW_UP_PROMPTS: Cheaper wine bars? | Outdoor seating? ).',
    'The follow-up prompts must be informed by the user query or the actual recommendations above (price range, cuisine, vibe, distance, etc.). If nothing relevant comes to mind, output `FOLLOW_UP_PROMPTS:` with no entries after it.'
  ].join('\n');
  
  const completion = await groq.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: "system",
        content: "You are a helpful local recommendation assistant. Your job is to provide useful answers based on the search results provided. Use the information found to give practical, actionable recommendations. Be positive and helpful - if results exist, use them to answer the user's question."
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    temperature: 0.2,
    max_tokens: 700,
    stop: ['<END_PROMPTS>'],
  });

  const apiEndTime = Date.now();
  const apiDuration = apiEndTime - apiStartTime;
  console.log(`⏱️  Groq: API call completed in ${apiDuration}ms`);
  
  const rawResult = completion.choices[0]?.message?.content?.trim() || '';
  const totalGroqTime = Date.now() - groqStartTime;
  console.log(`📊 Groq: Total time: ${totalGroqTime}ms, Result length: ${rawResult.length} characters`);
  
  const followUpPrefix = 'FOLLOW_UP_PROMPTS:';
  let followUps: string[] = [];
  let text = rawResult;
  const markerIndex = rawResult.lastIndexOf(followUpPrefix);
  if (markerIndex !== -1) {
    text = rawResult.slice(0, markerIndex).trim();
    const promptSection = rawResult.slice(markerIndex + followUpPrefix.length).trim();
    followUps = promptSection
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  
  return { text, followUps, cardsAllowed: true };
}

export async function generateAISummaryStream(
  context: SearchContext,
  callbacks: StreamingAISummaryCallbacks,
  mode: SummaryMode = 'detailed'
): Promise<void> {
  const groqStartTime = Date.now();
  console.log('🔍 Groq: Starting streaming AI summary generation...');
  console.log('🤖 [AI] Query:', context.query);
  console.log('🤖 [AI] Results count:', context.results.length);
  
  if (!process.env.GROQ_API_KEY) {
    callbacks.onError(new Error('Groq API key not available'));
    return;
  }

  // Early return for empty results
  if (context.results.length === 0) {
    console.log('🚫 [AI] No search results available, returning fallback summary');
    const fallback = {
      text: generateFallbackSummary(context),
      followUps: [],
      cardsAllowed: false,
    };
    callbacks.onComplete(fallback);
    return;
  }

  try {
    const enrichStartTime = Date.now();
    const enrichedContext = enrichSearchContext(context, mode);
    const enrichEndTime = Date.now();
    console.log(`⏱️  Groq: Context enrichment completed in ${enrichEndTime - enrichStartTime}ms`);
    
    const cardCatalogText = enrichedContext.cardCatalog.length
      ? enrichedContext.cardCatalog.map(card => `- KEY: ${card.key} | ${card.name} | ${card.ratingText} | Highlight: ${card.highlight}`).join('\n')
      : '- No cards available';
    
    const apiStartTime = Date.now();
    const modelName = 'llama-3.3-70b-versatile';
    console.log(`🚀 Groq: Making streaming API call to ${modelName}...`);
    
    const userPrompt = [
      `User searched for: "${context.query}"`,
      '',
      'SEARCH RESULTS (use this information to answer the user\'s question):',
      enrichedContext.searchResultsText,
      '',
      'CARD CATALOG (Insert "[CARD:KEY]" markers where you want the UI to render the card, max 2 cards):',
      cardCatalogText,
      '',
      '---',
      'TASK: Write a helpful answer that USES the search results to answer the user\'s question. Weave the card markers directly into your message where they make sense.',
      '',
      'IMPORTANT GUIDELINES:',
      '1. **USE THE INFORMATION**: If results exist, use them to answer the question. Don\'t say "unfortunately no results" if there ARE results.',
      '2. **CARD MARKERS**:',
      '   - Insert [CARD:KEY] on its own line (blank line before and after) when you want the UI to show that card.',
      '   - Use at most TWO markers, only for keys listed in the catalog above.',
      '   - Reference the card in your surrounding text so the placement feels intentional.',
      '3. **BE SPECIFIC**: Mention concrete details (ratings, reviews, why it fits).',
      '4. **STRUCTURE**: 2-3 short paragraphs max. Keep it punchy.',
      '5. **TONE**: Positive, conversational, and actionable.',
      '',
      'FORMAT EXAMPLE:',
      'I found a chill trattoria that nails wood-fired pizza for date night.',
      '[CARD:place:123]',
      'Need something more private? This chef does on-demand Italian feasts.',
      '[CARD:service:45]',
      'Ask me for another mood if you want backups.',
      '',
      'ONLY say "unfortunately no relevant information" if the results are COMPLETELY unrelated (e.g., searching for "hotel" but only finding "restaurants" with no lodging-related content).',
      '',
      'After your main response, add a blank line and then write `FOLLOW_UP_PROMPTS:` followed by up to 3 ultra-short, data-grounded suggestions separated by ` | ` (example: FOLLOW_UP_PROMPTS: Cheaper wine bars? | Outdoor seating? ).',
      'The follow-up prompts must be informed by the user query or the actual recommendations above (price range, cuisine, vibe, distance, etc.). If nothing relevant comes to mind, output `FOLLOW_UP_PROMPTS:` with no entries after it.'
    ].join('\n');

    let accumulatedText = '';
    
    const stream = await groq.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You are a helpful local recommendation assistant. Your job is to provide useful answers based on the search results provided. Use the information found to give practical, actionable recommendations. Be positive and helpful - if results exist, use them to answer the user's question."
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 700,
      stop: ['<END_PROMPTS>'],
      stream: true,
    });

    let chunkCount = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        chunkCount++;
        accumulatedText += content;
        console.log(`📤 [STREAM] Backend sending chunk #${chunkCount}: "${content}" (length: ${content.length}, total so far: ${accumulatedText.length})`);
        callbacks.onChunk(content);
      }
    }
    console.log(`📊 [STREAM] Backend: Total chunks sent: ${chunkCount}, Final text length: ${accumulatedText.length}`);

    const apiEndTime = Date.now();
    const apiDuration = apiEndTime - apiStartTime;
    console.log(`⏱️  Groq: Streaming API call completed in ${apiDuration}ms`);
    
    const rawResult = accumulatedText.trim();
    const totalGroqTime = Date.now() - groqStartTime;
    console.log(`📊 Groq: Total time: ${totalGroqTime}ms, Result length: ${rawResult.length} characters`);

    // Parse follow-up prompts
    const followUpPrefix = 'FOLLOW_UP_PROMPTS:';
    let followUps: string[] = [];
    let text = rawResult;
    const markerIndex = rawResult.lastIndexOf(followUpPrefix);
    if (markerIndex !== -1) {
      text = rawResult.slice(0, markerIndex).trim();
      const promptSection = rawResult.slice(markerIndex + followUpPrefix.length).trim();
      followUps = promptSection
        .split('|')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    // Validate relevance
    let cardsAllowed = true;
    try {
      const validationResult = await validateSearchRelevance(
        context.query,
        context.results as SearchResultForValidation[]
      );
      if (!validationResult.isRelevant) {
        cardsAllowed = false;
        console.log('🚫 [AI] Results marked as not relevant by validator');
      }
    } catch (validationError) {
      console.error('⚠️ [AI] Relevance validation failed:', validationError);
    }

    const result: AISummaryResult = { text, followUps, cardsAllowed };
    callbacks.onComplete(result);
  } catch (error) {
    const totalTime = Date.now() - groqStartTime;
    console.error(`❌ Groq streaming failed after ${totalTime}ms:`, error);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

function enrichSearchContext(context: SearchContext, mode: SummaryMode = 'detailed') {
  const enrichStartTime = Date.now();
  console.log('🔧 Context Enrichment: Starting data processing...');
  console.log(`📊 Context Enrichment: Processing ${context.results.length} results`);
  
  // Pre-calculate statistics
  const totalResults = context.results.length;
  const totalRecommendations = context.total_recommendations;

  let totalRatingSum = 0;
  let totalRatingsCount = 0;

  const statsStartTime = Date.now();
  context.results.forEach(result => {
    result.recommendations.forEach(rec => {
      if (rec.rating !== null && rec.rating !== undefined) {
        totalRatingSum += rec.rating;
        totalRatingsCount++;
      }
    });
  });
  const statsEndTime = Date.now();
  console.log(`⏱️  Context Enrichment: Statistics calculation completed in ${statsEndTime - statsStartTime}ms`);
  console.log('📍 [AI DEBUG] Coordinate coverage:', {
    results_with_coords: context.results.filter((r: any) => r.place_lat && r.place_lng).length,
    total_results: context.results.length,
  });

  const averageRating = totalRatingsCount > 0 
    ? (totalRatingSum / totalRatingsCount).toFixed(1) 
    : 'N/A';

  // Enhanced search results with better context
  const textProcessingStartTime = Date.now();
  const areaBuckets = new Map<string, number>();
  const distanceBuckets = new Map<string, number>();
  
  // 🔍 DEBUG: Log the context data being passed to AI
  console.log('🔍 [AI DEBUG] Context data for AI summary generation:');
  console.log('🔍 [AI DEBUG] Query:', context.query);
  console.log('🔍 [AI DEBUG] Results count:', context.results.length);
  context.results.forEach((result, index) => {
    console.log(`🔍 [AI DEBUG] Result ${index + 1}:`, {
      type: result.type,
      name: (result as any).place_name || (result as any).service_name,
      average_similarity: result.average_similarity,
      match_percentage: Math.round(result.average_similarity * 100),
      total_recommendations: result.total_recommendations,
      individual_scores: result.recommendations.map((rec: any) => ({
        rec_id: rec.recommendation_id,
        similarity: rec.similarity,
        user: rec.user_name
      }))
    });
  });
  
  // Single detailed mode limits
  const maxResults = Math.min(context.results.length, 10);
  const maxRecsPerResult = 6;
  const maxContextLength = 12000;
  
  const limitedResults = context.results.slice(0, maxResults);
  const cardsCatalog: CardCatalogEntry[] = [];
  
  const searchResultsText = limitedResults.map(result => {
    // Limit recommendations per result for fast mode
    const limitedRecs = result.recommendations.slice(0, maxRecsPerResult);
    
    // Normalize notes field across shapes (notes | description | content_data.notes)
    const getNotes = (rec: any): string | undefined => {
      const n = rec?.notes ?? rec?.description ?? rec?.content_data?.notes;
      return typeof n === 'string' ? n : undefined;
    };
    const notesRecs = limitedRecs.filter(rec => {
      const n = getNotes(rec);
      return n && n.trim();
    });
    // Collect all labels from recommendations for this result
    const allLabels = new Set<string>();
    limitedRecs.forEach(rec => {
      if (rec.labels && Array.isArray(rec.labels)) {
        rec.labels.forEach(label => allLabels.add(label));
      }
    });
    const labelsDisplay = Array.from(allLabels).length > 0 
      ? `🏷️ Tags: ${Array.from(allLabels).join(', ')}`
      : '';
    
    const keyReviewSummary = notesRecs
      .map(rec => {
        const went = rec.went_with && rec.went_with.length > 0 ? ` (Went with: ${rec.went_with.join(', ')})` : '';
        const date = rec.visit_date ? ` [Visited: ${rec.visit_date}]` : '';
        const notes = getNotes(rec);
        return `${rec.user_name || 'Anonymous'}: "${notes}"${went}${date}`;
      })
      .join('; ');
    
    const avgRatingForResult = limitedRecs
      .filter(rec => rec.rating !== null && rec.rating !== undefined)
      .reduce((sum, rec, _, arr) => sum + rec.rating! / arr.length, 0);
    
    const ratingText = avgRatingForResult > 0 
      ? `${avgRatingForResult.toFixed(1)}/5 (${limitedRecs.filter(r => r.rating).length} rating${limitedRecs.filter(r => r.rating).length !== 1 ? 's' : ''})`
      : 'No ratings';

    const matchScore = Math.round(result.average_similarity * 100);
    console.log(`🔍 [AI DEBUG] Processing result: ${(result as any).place_name || (result as any).service_name}, average_similarity: ${result.average_similarity}, match_score: ${matchScore}%`);

    // Derive additional helpful signals
    const uniqueReviewers = new Set(limitedRecs.map(r => r.user_name || 'Anonymous')).size;
    const dates = limitedRecs
      .map(r => r.visit_date)
      .filter(Boolean)
      .map(d => new Date(d as string).getTime())
      .filter(ts => !Number.isNaN(ts));
    const mostRecent = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : undefined;
    const oldest = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : undefined;
    const positives = notesRecs
      .filter(r => (r.rating ?? 0) >= 4)
      .map(r => {
        const n = getNotes(r) as string;
        return `+ ${r.user_name || 'Anonymous'}: "${n.slice(0, 140)}${n.length > 140 ? '...' : ''}"`;
      })
      .slice(0, 1)
      .join('');
    const negatives = notesRecs
      .filter(r => (r.rating ?? 0) <= 2)
      .map(r => {
        const n = getNotes(r) as string;
        return `- ${r.user_name || 'Anonymous'}: "${n.slice(0, 140)}${n.length > 140 ? '...' : ''}"`;
      })
      .slice(0, 1)
      .join('');

    if (result.type === 'place') {
      const r = result as any;
      const reviewCount = limitedRecs.filter(rec => {
        const n = getNotes(rec);
        return n && n.trim();
      }).length;
      const ratingCount = limitedRecs.filter(rec => rec.rating).length;
      const hasDetailedReviews = reviewCount > 0;
      const hasRatings = ratingCount > 0;
      
      // Format place type information
      const placeTypeInfo = [];
      if (r.place_primary_type) {
        placeTypeInfo.push(r.place_primary_type);
      }
      if (r.place_types && Array.isArray(r.place_types) && r.place_types.length > 0) {
        // Add additional types that aren't already in primary_type
        const additionalTypes = r.place_types
          .filter((t: string) => t !== r.place_primary_type)
          .slice(0, 3); // Limit to top 3 additional types
        placeTypeInfo.push(...additionalTypes);
      }
      const typeDisplay = placeTypeInfo.length > 0 
        ? placeTypeInfo.join(', ')
        : 'Place';
      
      const key = buildResultKey(result as any);
      const area = extractAreaFromAddress(r.place_address);
      if (area) {
        areaBuckets.set(area, (areaBuckets.get(area) || 0) + 1);
      }
      const distanceLabel = getDistanceLabel(
        context.user_lat ?? null,
        context.user_lng ?? null,
        r.place_lat ?? null,
        r.place_lng ?? null
      );
      if (distanceLabel) {
        distanceBuckets.set(distanceLabel, (distanceBuckets.get(distanceLabel) || 0) + 1);
        console.log('📍 [AI DEBUG] Distance label for place result:', {
          name: r.place_name,
          address: r.place_address,
          distanceLabel,
          user_lat: context.user_lat,
          user_lng: context.user_lng,
          place_lat: r.place_lat,
          place_lng: r.place_lng,
        });
      } else {
        console.log('📍 [AI DEBUG] No distance label for place result (missing coords):', {
          name: r.place_name,
          user_lat: context.user_lat,
          user_lng: context.user_lng,
          place_lat: r.place_lat,
          place_lng: r.place_lng
        });
      }
      const primarySnippetSource = notesRecs[0] || limitedRecs[0];
      const snippetText = primarySnippetSource
        ? (getNotes(primarySnippetSource) || '').slice(0, 160)
        : '';

      if (key) {
        cardsCatalog.push({
          key,
          name: r.place_name,
          ratingText,
          highlight: snippetText || `Trusted by ${uniqueReviewers} friend${uniqueReviewers === 1 ? '' : 's'}.`
        });
      }
      
      return `
**${r.place_name}** (${typeDisplay})
${r.place_address ? `📍 ${r.place_address}` : ''}
${labelsDisplay ? `${labelsDisplay}\n` : ''}⭐ ${ratingText}
💬 Reviews: ${hasDetailedReviews ? `${reviewCount} with notes` : 'No detailed reviews available'} | Reviewers: ${uniqueReviewers}
${mostRecent ? `🗓️ Recency: ${mostRecent}${oldest && oldest !== mostRecent ? ` (range since ${oldest})` : ''}` : ''}
${keyReviewSummary ? `Key feedback: ${keyReviewSummary}` : ''}
${positives ? `Pros: ${positives}` : ''}
${negatives ? `Cons: ${negatives}` : ''}
📈 Data Quality: ${hasDetailedReviews && hasRatings ? 'High' : hasDetailedReviews || hasRatings ? 'Medium' : 'Low'}
      `.trim();
    } else {
      const r = result as any;
      const reviewCount = limitedRecs.filter(rec => {
        const n = getNotes(rec);
        return n && n.trim();
      }).length;
      const ratingCount = limitedRecs.filter(rec => rec.rating).length;
      const hasDetailedReviews = reviewCount > 0;
      const hasRatings = ratingCount > 0;
      
      const key = buildResultKey(result as any);
      const area = extractAreaFromAddress(r.service_address);
      if (area) {
        areaBuckets.set(area, (areaBuckets.get(area) || 0) + 1);
      }
      const distanceLabel = getDistanceLabel(
        context.user_lat ?? null,
        context.user_lng ?? null,
        (r as any).service_lat ?? null,
        (r as any).service_lng ?? null
      );
      if (distanceLabel) {
        distanceBuckets.set(distanceLabel, (distanceBuckets.get(distanceLabel) || 0) + 1);
        console.log('📍 [AI DEBUG] Distance label for service result:', {
          name: r.service_name,
          address: r.service_address,
          distanceLabel,
          user_lat: context.user_lat,
          user_lng: context.user_lng,
          service_lat: (r as any).service_lat,
          service_lng: (r as any).service_lng,
        });
      } else {
        console.log('📍 [AI DEBUG] No distance label for service result (missing coords):', {
          name: r.service_name,
          user_lat: context.user_lat,
          user_lng: context.user_lng,
          service_lat: (r as any).service_lat,
          service_lng: (r as any).service_lng
        });
      }
      const primarySnippetSource = notesRecs[0] || limitedRecs[0];
      const snippetText = primarySnippetSource
        ? (getNotes(primarySnippetSource) || '').slice(0, 160)
        : '';

      if (key) {
        cardsCatalog.push({
          key,
          name: r.service_name,
          ratingText,
          highlight: snippetText || `Recommended by ${uniqueReviewers} friend${uniqueReviewers === 1 ? '' : 's'}.`
        });
      }
      
      return `
**${r.service_name}** (${r.service_type || 'Service'})
${r.service_address ? `📍 ${r.service_address}` : ''}
${labelsDisplay ? `${labelsDisplay}\n` : ''}⭐ ${ratingText}
💬 Reviews: ${hasDetailedReviews ? `${reviewCount} with notes` : 'No detailed reviews available'} | Reviewers: ${uniqueReviewers}
${mostRecent ? `🗓️ Recency: ${mostRecent}${oldest && oldest !== mostRecent ? ` (range since ${oldest})` : ''}` : ''}
${keyReviewSummary ? `Key feedback: ${keyReviewSummary}` : ''}
${positives ? `Pros: ${positives}` : ''}
${negatives ? `Cons: ${negatives}` : ''}
📈 Data Quality: ${hasDetailedReviews && hasRatings ? 'High' : hasDetailedReviews || hasRatings ? 'Medium' : 'Low'}
      `.trim();
    }
  }).join('\n\n');
  
  // Add overall statistics for better analysis
  const totalReviews = limitedResults.reduce((sum, result) => 
    sum + result.recommendations.slice(0, maxRecsPerResult).filter((rec: any) => {
      const n = (rec?.notes ?? rec?.description ?? rec?.content_data?.notes) as string | undefined;
      return n && n.trim();
    }).length, 0);
  const totalRatings = limitedResults.reduce((sum, result) => 
    sum + result.recommendations.slice(0, maxRecsPerResult).filter(rec => rec.rating).length, 0);
  const avgMatchScore = limitedResults.reduce((sum, result) => sum + result.average_similarity, 0) / limitedResults.length;
  const highQualityResults = limitedResults.filter(result => {
    const recs = result.recommendations.slice(0, maxRecsPerResult);
    const hasReviews = recs.some((rec: any) => {
      const n = (rec?.notes ?? rec?.description ?? rec?.content_data?.notes) as string | undefined;
      return n && n.trim();
    });
    const hasRatings = recs.some(rec => rec.rating);
    return hasReviews && hasRatings;
  }).length;

  // Recency overview across all limited results
  const allDates = limitedResults
    .flatMap(result => result.recommendations.slice(0, maxRecsPerResult))
    .map(r => r.visit_date)
    .filter(Boolean)
    .map(d => new Date(d as string).getTime())
    .filter(ts => !Number.isNaN(ts));
  const mostRecentOverall = allDates.length ? new Date(Math.max(...allDates)).toISOString().slice(0, 10) : undefined;

  // Location / area summary for logging and prompt
  const areaSummary = Array.from(areaBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => `${area} (${count})`);

  const distanceSummary = Array.from(distanceBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => `${label} (${count})`);

  console.log('📍 [AI DEBUG] Derived area buckets for this search:', areaSummary);
  console.log('📍 [AI DEBUG] Derived distance buckets for this search:', distanceSummary);

  const analysisHeader = `
## **Search Analysis Overview**
- **Total Options**: ${limitedResults.length} (${context.results.length} total available)
- **Data Quality**: ${highQualityResults}/${limitedResults.length} options have both reviews and ratings
- **Review Coverage**: ${totalReviews} detailed reviews across all options
- **Rating Coverage**: ${totalRatings} ratings across all options
- **Data Completeness**: ${totalReviews > 0 && totalRatings > 0 ? 'Good' : totalReviews > 0 || totalRatings > 0 ? 'Partial' : 'Limited'}
${areaSummary.length ? `- **Primary Areas**: ${areaSummary.join(', ')}` : ''}
${distanceSummary.length ? `- **Typical Distances**: ${distanceSummary.join(', ')}` : ''}
${mostRecentOverall ? `- **Most Recent Visit**: ${mostRecentOverall}` : ''}

---

`;

  // Truncate context if too long for fast mode
  const baseSearchResultsText = analysisHeader + searchResultsText;
  const finalSearchResultsText = baseSearchResultsText.length > maxContextLength
    ? baseSearchResultsText.substring(0, maxContextLength) + '...'
    : baseSearchResultsText;
  const textProcessingEndTime = Date.now();
  console.log(`⏱️  Context Enrichment: Text processing completed in ${textProcessingEndTime - textProcessingStartTime}ms`);

  const totalEnrichTime = Date.now() - enrichStartTime;
  console.log(`📊 Context Enrichment: Total time: ${totalEnrichTime}ms, Output length: ${finalSearchResultsText.length} characters`);

  return {
    searchResultsText: finalSearchResultsText,
    totalResults,
    totalRecommendations,
    averageRating,
    cardCatalog: cardsCatalog.slice(0, 4)
  };
}

/**
 * Generate a fallback summary when AI is not available
 */
function generateFallbackSummary(context: SearchContext): string {
  if (context.results.length === 0) {
    return `I couldn't find any recommendations for "${context.query}" in your network yet. 

Try using different keywords or ask your friends to share their experiences first. Sometimes being more specific about what you're looking for helps too!`;
  }

  const topResult = context.results[0];
  const topRecommendation = topResult.recommendations[0];
  
  const hasReviews = (() => {
    const n = (topRecommendation as any)?.notes ?? (topRecommendation as any)?.description ?? (topRecommendation as any)?.content_data?.notes;
    return typeof n === 'string' && n.trim();
  })();
  const hasRating = topRecommendation.rating;

  // Calculate data quality
  const totalReviews = context.results.reduce((sum, result) => 
    sum + result.recommendations.filter((rec: any) => {
      const n = rec?.notes ?? rec?.description ?? rec?.content_data?.notes;
      return typeof n === 'string' && n.trim();
    }).length, 0);
  const totalRatings = context.results.reduce((sum, result) => 
    sum + result.recommendations.filter(rec => rec.rating).length, 0);

  let intro = `I found ${context.results.length} option${context.results.length > 1 ? 's' : ''} for you! `;

  if (totalReviews > 0 && totalRatings > 0) {
    intro += `Good news is there are ${totalReviews} detailed reviews and ${totalRatings} ratings to help you decide. `;
  } else if (totalReviews > 0 || totalRatings > 0) {
    intro += `There's some feedback available, though not as much as we'd like. `;
  } else {
    intro += `Unfortunately, there aren't many reviews or ratings to go on yet. `;
  }

  if ((topResult as any).type === 'place') {
    const r: any = topResult as any;
    
    intro += `\n\n${r.place_name} looks like the most promising option. `;
    
    if (hasReviews) {
      intro += `People have shared some feedback about it, which you can see below. `;
    }
    
    if (hasRating) {
      intro += `It's got a ${topRecommendation.rating}/5 rating from your network. `;
    }
    
    if (!hasReviews && !hasRating) {
      intro += `You might want to ask around for more recent experiences since there's limited feedback available. `;
    }
  } else {
    const r: any = topResult as any;
    
    intro += `\n\n${r.service_name}${r.service_type ? ` (${r.service_type})` : ''} looks like the most promising option. `;
    
    if (hasReviews) {
      intro += `People have shared some feedback about it, which you can see below. `;
    }
    
    if (hasRating) {
      intro += `It's got a ${topRecommendation.rating}/5 rating from your network. `;
    }
    
    if (!hasReviews && !hasRating) {
      intro += `You might want to ask around for more recent experiences since there's limited feedback available. `;
    }
  }

  intro += `Take a look at the details below and see what works best for you!`;

  const cardKeys = context.results
    .map(result => buildResultKey(result))
    .filter((key): key is string => Boolean(key))
    .slice(0, 2);

  if (cardKeys.length > 0) {
    intro += `\n\n${cardKeys.map(key => `[CARD:${key}]`).join('\n')}`;
  }

  return intro;
}

/**
 * Generate a more detailed analysis for specific places
 */
// NOTE: generatePlaceAnalysis helper was removed because no callers existed.
// If we re-introduce per-place analysis later, prefer building it on top of the
// new structured summary pipeline instead of adding another Groq call here.