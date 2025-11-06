/**
 * Centralized search configuration for backend
 * All search parameters can be tweaked from this single location
 */

export const SEARCH_CONFIG = {
  // Semantic search parameters
  SEMANTIC_SEARCH: {
    // Similarity threshold (0.0 = very permissive, 1.0 = very strict)
    // Lower values allow more loosely related results
    // Higher values only show very similar results
    THRESHOLD: 0.7,
    
    // Maximum number of results to return
    LIMIT: 10,
    
    // Default content type filter
    DEFAULT_CONTENT_TYPE: 'place' as const,
  },
  
  // AI Summary parameters
  AI_SUMMARY: {
    // Maximum number of results to include in AI summary context
    MAX_RESULTS_FOR_SUMMARY: 10,
    
    // Whether to enable AI summary generation
    ENABLED: true,
  },
  
  // Filtering parameters
  FILTERING: {
    // Enable keyword-based filtering on top of semantic search
    ENABLE_KEYWORD_FILTERING: true,
    
    // Minimum similarity score for keyword filtering
    KEYWORD_FILTER_THRESHOLD: 0.5,
  },
  
  // Debug and logging
  DEBUG: {
    // Enable detailed logging for search operations (disabled in production)
    ENABLE_LOGGING: process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_LOGGING === 'true',
    
    // Log similarity scores for debugging (disabled in production)
    LOG_SIMILARITY_SCORES: process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEBUG_LOGGING === 'true',
  }
} as const;

// Type definitions for better IDE support
export type SearchThreshold = typeof SEARCH_CONFIG.SEMANTIC_SEARCH.THRESHOLD;
export type SearchLimit = typeof SEARCH_CONFIG.SEMANTIC_SEARCH.LIMIT;
export type ContentType = typeof SEARCH_CONFIG.SEMANTIC_SEARCH.DEFAULT_CONTENT_TYPE;
