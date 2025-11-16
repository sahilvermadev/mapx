import type { SearchResponse } from '@/services/recommendationsApiService';
import { SEARCH_CONFIG } from '@/config/searchConfig';

export class SearchDebugger {
  /**
   * Log search response processing at different stages
   */
  static logSearchResponse(response: SearchResponse, stage: string): void {
    if (!SEARCH_CONFIG.DEBUG.ENABLE_LOGGING) return;
    
    console.log(`🔍 [SEARCH DEBUG] ${stage}:`, {
      query: response.query,
      resultsCount: response.results.length,
      totalPlaces: response.total_places,
      totalRecommendations: response.total_recommendations,
      scores: response.results.map(r => ({
        type: r.type,
        name: (r as any).place_name || (r as any).service_name,
        similarity: r.average_similarity,
        match: Math.round(r.average_similarity * 100),
        totalRecs: r.total_recommendations
      }))
    });
  }

  /**
   * Log score calculation for debugging
   */
  static logScoreCalculation(entity: any, score: number, source: string): void {
    if (!SEARCH_CONFIG.DEBUG.ENABLE_LOGGING) return;
    
    console.log(`🔍 [SCORE DEBUG] ${source}:`, {
      entity: {
        rec_id: entity.recommendation_id,
        place_id: entity.place_id,
        service_id: entity.service_id,
        title: entity.title
      },
      score: score,
      match: Math.round(score * 100)
    });
  }

  /**
   * Log group processing in FeedGroups
   */
  static logGroupProcessing(key: string, group: any[], scores: any[]): void {
    if (!SEARCH_CONFIG.DEBUG.ENABLE_LOGGING) return;
    
    console.log(`🔍 [GROUP DEBUG] Processing group ${key}:`, {
      groupLength: group.length,
      scores: scores,
      posts: group.map(p => ({
        rec_id: p.recommendation_id,
        searchScore: p.searchScore,
        similarity: p.similarity,
        rating: p.rating,
        title: p.title
      }))
    });
  }

  /**
   * Log final match percentage calculation
   */
  static logMatchCalculation(name: string, matchPercentage: number, source: string): void {
    if (!SEARCH_CONFIG.DEBUG.ENABLE_LOGGING) return;
    
    console.log(`🔍 [MATCH DEBUG] ${source}:`, {
      name: name,
      matchPercentage: matchPercentage
    });
  }
}






























