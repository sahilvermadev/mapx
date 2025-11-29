import { useState, useCallback, useMemo, useRef } from 'react';
import type { SearchResponse } from '@/services/recommendationsApiService';
import { recommendationsApi } from '@/services/recommendationsApiService';
import { SearchScoreManager } from '@/utils/searchScoreManager';
import { SearchDebugger } from '@/utils/searchDebugger';

export function useFeedSearchResults() {
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [recIdToGroupKey, setRecIdToGroupKey] = useState<Record<number, string>>({});
  const [groupKeyToMeta, setGroupKeyToMeta] = useState<Record<string, { title: string; subtitle?: string }>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingBufferRef = useRef<string>('');
  const rafIdRef = useRef<number | undefined>(undefined);
  
  // Use SearchScoreManager for centralized score management
  const scoreManager = useMemo(() => new SearchScoreManager(), []);

  const clearSearch = useCallback(() => {
    // Cancel any ongoing streaming request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    scoreManager.clearScores();
    setSearchResponse(null);
    setStreamingText('');
    setIsSummaryLoading(false);
    setRecIdToGroupKey({});
    setGroupKeyToMeta({});
  }, [scoreManager]);

  const loadFromResponse = useCallback((res: SearchResponse) => {
    // Use centralized debugger
    SearchDebugger.logSearchResponse(res, 'Processing search response');
    
    // Process scores using SearchScoreManager
    scoreManager.processSearchResponse(res);
    
    // Build group metadata and mappings
    const recToGroup: Record<number, string> = {};
    const groupMeta: Record<string, { title: string; subtitle?: string }> = {};

    res.results.forEach((group: any) => {
      if (group.type === 'place' && typeof group.place_id === 'number') {
        const key = `place:${group.place_id}`;
        groupMeta[key] = { title: group.place_name, subtitle: group.place_address };
      }
      
      if (group.type === 'service' && typeof group.service_id === 'number') {
        const key = `service:${group.service_id}`;
        groupMeta[key] = { title: group.service_name, subtitle: group.service_address };
      }
      
      if (Array.isArray(group.recommendations)) {
        group.recommendations.forEach((rec: any) => {
          if (typeof rec.recommendation_id === 'number') {
            let key: string | null = null;
            if (group.type === 'service' && typeof group.service_id === 'number') {
              key = `service:${group.service_id}`;
            } else if (group.type === 'place' && typeof group.place_id === 'number') {
              key = `place:${group.place_id}`;
            }
            if (key) recToGroup[rec.recommendation_id] = key;
          }
        });
      }
    });

    setSearchResponse(res);
    if (typeof res.summary === 'string' && res.summary.trim().length > 0) {
      setStreamingText(res.summary);
      setIsSummaryLoading(false);
    } else {
      setIsSummaryLoading(true);
    }
    setRecIdToGroupKey(recToGroup);
    setGroupKeyToMeta(groupMeta);
  }, [scoreManager]);

  const loadFromStream = useCallback(async (
    query: string,
    userLocation?: { lat: number; lng: number } | null,
    groupIds?: number[]
  ) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const newAbortController = new AbortController();
    abortControllerRef.current = newAbortController;

    // Reset state and set initial minimal searchResponse immediately
    // This ensures the UI shows the search container right away
    streamingBufferRef.current = '';
    setStreamingText('');
    setIsSummaryLoading(true);
    if (rafIdRef.current !== undefined) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    setSearchResponse({
      query: query.trim(),
      summary: '',
      results: [],
      follow_up_prompts: [],
      cards_allowed: true,
      search_metadata: {
        structured_search_used: false,
        top_confidence: undefined,
        used_current_location: false,
        filters_applied: [],
      },
    });

    try {
      await recommendationsApi.semanticSearchStream(
        query,
        {
          onChunk: (chunk: string) => {
            // Accumulate chunks in a ref for immediate updates
            console.log(`✨ [HOOK] onChunk called with: "${chunk}" (length: ${chunk.length})`);
            streamingBufferRef.current += chunk;
            
            // Filter out FOLLOW_UP_PROMPTS: section from streaming text in real-time
            // The backend extracts these separately, so we don't want to show them in the text
            const followUpPrefix = 'FOLLOW_UP_PROMPTS:';
            let filteredText = streamingBufferRef.current;
            const markerIndex = filteredText.lastIndexOf(followUpPrefix);
            if (markerIndex !== -1) {
              filteredText = filteredText.slice(0, markerIndex).trim();
            }
            
            // Cancel any pending RAF update
            if (rafIdRef.current !== undefined) {
              cancelAnimationFrame(rafIdRef.current);
            }
            
            // Schedule update for next frame to ensure smooth rendering
            rafIdRef.current = requestAnimationFrame(() => {
              setStreamingText(filteredText);
              console.log(`✨ [HOOK] setStreamingText: length=${filteredText.length}`);
              rafIdRef.current = undefined;
            });
          },
          onComplete: (response: SearchResponse) => {
            // onComplete is called twice:
            // 1. When 'init' message arrives (with results but empty summary)
            // 2. When 'done' message arrives (with final summary and metadata)
            
            // Check if this is the init message (has results but no summary) or done message (has summary)
            const isInitMessage = response.results && response.results.length > 0 && (!response.summary || response.summary.length === 0);
            const isDoneMessage = response.summary && response.summary.length > 0 && response.follow_up_prompts !== undefined;
            
            if (isInitMessage) {
              // For init message, just update searchResponse with results (don't call loadFromResponse to avoid duplicate thread entries)
              // Build group metadata and mappings for immediate display
              const recToGroup: Record<number, string> = {};
              const groupMeta: Record<string, { title: string; subtitle?: string }> = {};

              response.results.forEach((group: any) => {
                if (group.type === 'place' && typeof group.place_id === 'number') {
                  const key = `place:${group.place_id}`;
                  groupMeta[key] = { title: group.place_name, subtitle: group.place_address };
                }
                
                if (group.type === 'service' && typeof group.service_id === 'number') {
                  const key = `service:${group.service_id}`;
                  groupMeta[key] = { title: group.service_name, subtitle: group.service_address };
                }
                
                if (Array.isArray(group.recommendations)) {
                  group.recommendations.forEach((rec: any) => {
                    if (typeof rec.recommendation_id === 'number') {
                      let key: string | null = null;
                      if (group.type === 'service' && typeof group.service_id === 'number') {
                        key = `service:${group.service_id}`;
                      } else if (group.type === 'place' && typeof group.place_id === 'number') {
                        key = `place:${group.place_id}`;
                      }
                      if (key) recToGroup[rec.recommendation_id] = key;
                    }
                  });
                }
              });

              setSearchResponse(response);
              setRecIdToGroupKey(recToGroup);
              setGroupKeyToMeta(groupMeta);
            } else if (isDoneMessage) {
              // For done message, call loadFromResponse to process final data (this will update the existing thread entry, not create a new one)
              loadFromResponse(response);
              setIsSummaryLoading(false);
            }
            
            if (abortControllerRef.current === newAbortController) {
              abortControllerRef.current = null;
            }
          },
          onError: (error: Error) => {
            setIsSummaryLoading(false);
            console.error('Streaming search error:', error);
            if (abortControllerRef.current === newAbortController) {
              abortControllerRef.current = null;
            }
          },
        },
        undefined, // limit
        undefined, // threshold
        groupIds,
        undefined, // content_type
        false, // noSummary
        'detailed', // summaryMode
        userLocation,
        newAbortController.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Streaming search aborted');
        return;
      }
      setIsSummaryLoading(false);
      console.error('Streaming search failed:', error);
      if (abortControllerRef.current === newAbortController) {
        abortControllerRef.current = null;
      }
    }
  }, [loadFromResponse]);

  // Memoize bound methods to prevent recreation on every render
  const getScore = useCallback((entity: { 
    place_id?: number; 
    service_id?: number; 
    recommendation_id?: number;
    [key: string]: any; // Allow posts with additional properties
  }): number => {
    return scoreManager.getScore({
      place_id: entity.place_id,
      service_id: entity.service_id,
      recommendation_id: entity.recommendation_id,
    });
  }, [scoreManager]);

  const attachScoresToPosts = useCallback((posts: any[]): any[] => {
    return scoreManager.attachScoresToPosts(posts);
  }, [scoreManager]);

  const getAllScores = useCallback(() => {
    return scoreManager.getAllScores();
  }, [scoreManager]);

  return {
    searchResponse,
    streamingText,
    isSummaryLoading,
    recIdToGroupKey,
    groupKeyToMeta,
    clearSearch,
    loadFromResponse,
    loadFromStream,
    // Expose score manager methods (now memoized)
    getScore,
    attachScoresToPosts,
    getAllScores,
  } as const;
}







