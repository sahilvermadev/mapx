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
        place_name: string;
        place_address?: string;
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
        service_name: string;
        service_type?: string | null;
        service_business_name?: string | null;
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
}

export type SummaryMode = 'detailed';

/**
 * Generate an intelligent summary using Groq models
 */
export async function generateAISummary(context: SearchContext, mode: SummaryMode = 'detailed'): Promise<string> {
  const startTime = Date.now();
  console.log('🤖 [AI] Starting modern AI summary generation...');
  console.log('🤖 [AI] Query:', context.query);
  console.log('🤖 [AI] Results count:', context.results.length);
  console.log('🤖 [AI] Total places:', context.total_places);
  console.log('🤖 [AI] Total recommendations:', context.total_recommendations);
  
  // Early return for empty results to prevent AI hallucination
  if (context.results.length === 0) {
    console.log('🚫 [AI] No search results available, returning fallback summary');
    return generateFallbackSummary(context);
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
      return generateNoRelevantResultsMessage(context.query);
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
      
      if (summary && summary.length > 50) {
        console.log(`✅ Groq ${modelName} generated successful summary in ${providerDuration}ms`);
        console.log(`📊 Summary length: ${summary.length} characters`);
        const totalTime = Date.now() - startTime;
        console.log(`⏱️  Total AI summary generation time: ${totalTime}ms`);
        return summary;
      } else {
        console.log(`⚠️  Groq ${modelName} returned short/empty summary (${summary?.length || 0} chars) in ${providerDuration}ms`);
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
    return generateFallbackSummary(context);
  }
}

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

  const averageRating = totalRatingsCount > 0 
    ? (totalRatingSum / totalRatingsCount).toFixed(1) 
    : 'N/A';

  // Enhanced search results with better context
  const textProcessingStartTime = Date.now();
  
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

  const analysisHeader = `
## **Search Analysis Overview**
- **Total Options**: ${limitedResults.length} (${context.results.length} total available)
- **Data Quality**: ${highQualityResults}/${limitedResults.length} options have both reviews and ratings
- **Review Coverage**: ${totalReviews} detailed reviews across all options
- **Rating Coverage**: ${totalRatings} ratings across all options
- **Data Completeness**: ${totalReviews > 0 && totalRatings > 0 ? 'Good' : totalReviews > 0 || totalRatings > 0 ? 'Partial' : 'Limited'}
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
    averageRating
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

  return intro;
}

/**
 * Generate a more detailed analysis for specific places
 */
export async function generatePlaceAnalysis(
  query: string, 
  placeName: string, 
  recommendations: Array<{
    user_name: string;
    notes?: string;
    rating?: number;
    labels?: string[];
    went_with?: string[];
    visit_date?: string;
  }>
): Promise<string> {
  try {
    if (!process.env.GROQ_API_KEY) {
      return generateFallbackPlaceAnalysis(placeName, recommendations);
    }

    const recommendationsText = recommendations.map(rec => `
- ${rec.user_name}: ${rec.rating ? `${rec.rating}/5 stars` : 'No rating'}${rec.notes ? ` - "${rec.notes}"` : ''}${rec.labels && rec.labels.length > 0 ? ` (Tags: ${rec.labels.join(', ')})` : ''}
    `.trim()).join('\n');

    const prompt = `A user searched for: "${query}" and found "${placeName}" as a relevant result.

Here are the reviews for this place:

${recommendationsText}

Please provide a brief, helpful analysis (2-3 sentences) that:
1. Explains why this place matches their search
2. Highlights key positive aspects from the reviews
3. Mentions any relevant details that would be useful for their specific query

Be conversational and focus on what would help them decide if this place is right for their needs.`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Your goal is to provide a concise, relevant analysis of a place or service based on user reviews and the user's original search query."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "qwen/qwen3-32b",
      temperature: 0.7,
      max_tokens: 200,
      top_p: 1,
      stream: false,
    });

    const analysis = completion.choices[0]?.message?.content?.trim();
    
    if (!analysis) {
      return generateFallbackPlaceAnalysis(placeName, recommendations);
    }

    return analysis;

  } catch (error) {
    console.error('❌ Error generating place analysis:', error);
    return generateFallbackPlaceAnalysis(placeName, recommendations);
  }
}

/**
 * Fallback place analysis when AI is not available
 */
function generateFallbackPlaceAnalysis(
  placeName: string, 
  recommendations: Array<{
    user_name: string;
    notes?: string;
    rating?: number;
    labels?: string[];
    went_with?: string[];
    visit_date?: string;
  }>
): string {
  const avgRating = recommendations.reduce((sum, rec) => sum + (rec.rating || 0), 0) / recommendations.length;
  const hasGoodReviews = recommendations.some(rec => rec.rating && rec.rating >= 4);
  
  if (hasGoodReviews) {
    return `${placeName} has received positive reviews with an average rating of ${avgRating.toFixed(1)}/5. Users have shared positive experiences that suggest this place meets their needs.`;
  } else {
    return `${placeName} has mixed reviews with an average rating of ${avgRating.toFixed(1)}/5. Consider reading the detailed reviews to see if it matches your specific requirements.`;
  }
} 