import type { SearchResponse } from '@/services/recommendationsApiService';

export interface SearchScoreData {
  placeScores: Record<number, number>;
  serviceScores: Record<number, number>;
  recommendationScores: Record<number, number>;
  groupScores: Record<string, number>;
}

export interface SearchResultWithScore {
  searchScore: number;
  similarity: number;
  matchPercentage: number;
}

export class SearchScoreManager {
  private scores: SearchScoreData = {
    placeScores: {},
    serviceScores: {},
    recommendationScores: {},
    groupScores: {}
  };

  /**
   * Process search response and extract all scores in one place
   */
  processSearchResponse(response: SearchResponse): SearchScoreData {
    const processedScores: SearchScoreData = {
      placeScores: {},
      serviceScores: {},
      recommendationScores: {},
      groupScores: {}
    };

    response.results.forEach((group: any) => {
      const groupScore = group.average_similarity ?? 0;
      const groupKey = group.type === 'place' ? `place:${group.place_id}` : `service:${group.service_id}`;
      
      // Store group score
      processedScores.groupScores[groupKey] = groupScore;

      if (group.type === 'place' && typeof group.place_id === 'number') {
        processedScores.placeScores[group.place_id] = groupScore;
      }
      
      if (group.type === 'service' && typeof group.service_id === 'number') {
        processedScores.serviceScores[group.service_id] = groupScore;
      }

      // Process individual recommendations
      if (Array.isArray(group.recommendations)) {
        group.recommendations.forEach((rec: any) => {
          if (typeof rec.recommendation_id === 'number') {
            const recScore = rec.similarity ?? groupScore;
            processedScores.recommendationScores[rec.recommendation_id] = recScore;
          }
        });
      }
    });

    this.scores = processedScores;
    return processedScores;
  }

  /**
   * Get score for any entity (place, service, or recommendation)
   */
  getScore(entity: { 
    place_id?: number; 
    service_id?: number; 
    recommendation_id?: number 
  }): number {
    // Priority: recommendation > service > place
    if (entity.recommendation_id && this.scores.recommendationScores[entity.recommendation_id] !== undefined) {
      return this.scores.recommendationScores[entity.recommendation_id];
    }
    
    if (entity.service_id && this.scores.serviceScores[entity.service_id] !== undefined) {
      return this.scores.serviceScores[entity.service_id];
    }
    
    if (entity.place_id && this.scores.placeScores[entity.place_id] !== undefined) {
      return this.scores.placeScores[entity.place_id];
    }
    
    return 0;
  }

  /**
   * Attach search scores to posts for consistent display
   */
  attachScoresToPosts(posts: any[]): any[] {
    return posts.map(post => {
      const score = this.getScore({
        place_id: post.place_id,
        service_id: post.service_id,
        recommendation_id: post.recommendation_id
      });
      
      return {
        ...post,
        searchScore: score,
        similarity: score,
        matchPercentage: Math.round(score * 100)
      };
    });
  }

  /**
   * Get all scores for debugging
   */
  getAllScores(): SearchScoreData {
    return { ...this.scores };
  }

  /**
   * Clear all scores
   */
  clearScores(): void {
    this.scores = {
      placeScores: {},
      serviceScores: {},
      recommendationScores: {},
      groupScores: {}
    };
  }
}






















