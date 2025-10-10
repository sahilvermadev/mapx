"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAISummary = generateAISummary;
exports.generatePlaceAnalysis = generatePlaceAnalysis;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env file from the root directory (two levels up from backend/src)
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
// Initialize Groq client
const groq = new groq_sdk_1.default({
    apiKey: process.env.GROQ_API_KEY,
});
/**
 * Generate an intelligent summary using Groq and Qwen/Qwen3-32b model
 */
async function generateAISummary(context) {
    try {
        console.log('🤖 Starting AI summary generation...');
        console.log('  Query:', context.query);
        console.log('  Results count:', context.results.length);
        if (!process.env.GROQ_API_KEY) {
            console.log('❌ GROQ_API_KEY not found, using fallback');
            throw new Error('GROQ_API_KEY environment variable is not set');
        }
        console.log('✅ GROQ_API_KEY found, proceeding with AI generation');
        // Prepare the context for the AI model
        const searchResultsText = context.results.map(result => {
            const topRecommendation = result.recommendations[0];
            if (result.type === 'place') {
                const r = result;
                return `
Place: ${r.place_name}
${r.place_address ? `Address: ${r.place_address}` : ''}
Match Score: ${Math.round(r.average_similarity * 100)}%
Reviews: ${r.total_recommendations}
${topRecommendation.notes ? `Top Review: "${topRecommendation.notes}"` : ''}
${topRecommendation.rating ? `Rating: ${topRecommendation.rating}/5` : ''}
${topRecommendation.labels && topRecommendation.labels.length > 0 ? `Tags: ${topRecommendation.labels.join(', ')}` : ''}
        `.trim();
            }
            else {
                const r = result;
                return `
Service: ${r.service_name}${r.service_type ? ` (${r.service_type})` : ''}
${r.service_address ? `Location: ${r.service_address}` : ''}
Match Score: ${Math.round(r.average_similarity * 100)}%
Recommendations: ${r.total_recommendations}
${topRecommendation.notes ? `Top Note: "${topRecommendation.notes}"` : ''}
${topRecommendation.rating ? `Rating: ${topRecommendation.rating}/5` : ''}
${topRecommendation.labels && topRecommendation.labels.length > 0 ? `Tags: ${topRecommendation.labels.join(', ')}` : ''}
        `.trim();
            }
        }).join('\n\n');
        const prompt = `You are a helpful assistant. A user searched for: "${context.query}"

Here are the possible relevant results (places and/or services):

${searchResultsText}

Totals — Places: ${context.total_places}, Recommendations: ${context.total_recommendations}

If the data answers the user's query, write a concise, helpful summary (3-4 sentences max) that:
1) Directly answers the query
2) Mentions who made any recommendations
3) Includes location context when relevant
4) Keeps it conversational

Otherwise, say we unfortunately don't have data that answers the query.

Format: Plain text.`;
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a helpful travel and dining assistant that provides concise, direct summaries. Always mention who made the recommendations. Give complete, actionable answers without truncation."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "qwen/qwen3-32b",
            temperature: 0.3, // Lower temperature for more focused responses
            max_tokens: 1000, // Increased max tokens to prevent truncation
            top_p: 1,
            stream: false,
        });
        const summary = completion.choices[0]?.message?.content?.trim();
        if (!summary) {
            throw new Error('No summary generated from AI model');
        }
        // Clean up the summary - remove any thinking tags or verbose content
        let cleanSummary = summary
            .replace(/<think>.*?<\/think>/gs, '') // Remove thinking tags
            .replace(/Okay,.*?Let me.*?/gs, '') // Remove thinking phrases
            .replace(/First,.*?Then,.*?/gs, '') // Remove enumeration
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold formatting
            .replace(/\n+/g, ' ') // Replace multiple newlines with single space
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        // If the summary is still too long, truncate it more gracefully
        if (cleanSummary.length > 500) {
            // Try to truncate at a sentence boundary
            const sentences = cleanSummary.split('. ');
            let truncated = '';
            for (const sentence of sentences) {
                if ((truncated + sentence + '. ').length > 500) {
                    break;
                }
                truncated += sentence + '. ';
            }
            cleanSummary = truncated.trim();
        }
        console.log('🤖 AI Summary generated successfully:', cleanSummary.substring(0, 100) + '...');
        return cleanSummary;
    }
    catch (error) {
        console.error('❌ Error generating AI summary:', error);
        console.error('  Error details:', error instanceof Error ? error.message : String(error));
        // Fallback to simple summary if AI fails
        console.log('🔄 Using fallback summary');
        return generateFallbackSummary(context);
    }
}
/**
 * Generate a fallback summary when AI is not available
 */
function generateFallbackSummary(context) {
    if (context.results.length === 0) {
        return `No relevant places found for your search query. Try using different keywords or being more specific about what you're looking for.`;
    }
    const topResult = context.results[0];
    const topRecommendation = topResult.recommendations[0];
    const highMatch = topResult.average_similarity > 0.8;
    const mediumMatch = topResult.average_similarity > 0.6;
    if (topResult.type === 'place') {
        const r = topResult;
        if (highMatch) {
            return `Based on ${r.total_recommendations} recommendation(s), "${r.place_name}" seems to match your search. ${topRecommendation.notes ? `Users say: "${topRecommendation.notes.substring(0, 100)}..."` : ''}`;
        }
        else if (mediumMatch) {
            return `I found some potentially relevant places. "${r.place_name}" has ${r.total_recommendations} recommendation(s) that might be related to your search.`;
        }
        else {
            return `I found some places that might be related to your search, though the match isn't very strong. Consider refining your query for better results.`;
        }
    }
    else {
        const r = topResult;
        if (highMatch) {
            return `Based on ${r.total_recommendations} recommendation(s), ${r.service_name}${r.service_type ? ` (${r.service_type})` : ''} seems to match your search${r.service_address ? ` in ${r.service_address}` : ''}. ${topRecommendation.notes ? `Users say: "${topRecommendation.notes.substring(0, 100)}..."` : ''}`;
        }
        else if (mediumMatch) {
            return `I found a potentially relevant service. ${r.service_name}${r.service_type ? ` (${r.service_type})` : ''} has ${r.total_recommendations} recommendation(s).`;
        }
        else {
            return `I found some services that might be related to your search, though the match isn't very strong. Consider refining your query for better results.`;
        }
    }
}
/**
 * Generate a more detailed analysis for specific places
 */
async function generatePlaceAnalysis(query, placeName, recommendations) {
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
                    content: "You are a helpful travel assistant that provides concise, relevant analysis of places based on user reviews and search context."
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
    }
    catch (error) {
        console.error('❌ Error generating place analysis:', error);
        return generateFallbackPlaceAnalysis(placeName, recommendations);
    }
}
/**
 * Fallback place analysis when AI is not available
 */
function generateFallbackPlaceAnalysis(placeName, recommendations) {
    const avgRating = recommendations.reduce((sum, rec) => sum + (rec.rating || 0), 0) / recommendations.length;
    const hasGoodReviews = recommendations.some(rec => rec.rating && rec.rating >= 4);
    if (hasGoodReviews) {
        return `${placeName} has received positive reviews with an average rating of ${avgRating.toFixed(1)}/5. Users have shared positive experiences that suggest this place meets their needs.`;
    }
    else {
        return `${placeName} has mixed reviews with an average rating of ${avgRating.toFixed(1)}/5. Consider reading the detailed reviews to see if it matches your specific requirements.`;
    }
}
