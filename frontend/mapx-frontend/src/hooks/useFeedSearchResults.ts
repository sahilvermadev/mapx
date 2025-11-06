import { useState, useCallback, useMemo } from 'react';
import type { SearchResponse } from '@/services/recommendationsApiService';
import { SearchScoreManager } from '@/utils/searchScoreManager';
import { SearchDebugger } from '@/utils/searchDebugger';

export function useFeedSearchResults() {
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [recIdToGroupKey, setRecIdToGroupKey] = useState<Record<number, string>>({});
  const [groupKeyToMeta, setGroupKeyToMeta] = useState<Record<string, { title: string; subtitle?: string }>>({});
  
  // Use SearchScoreManager for centralized score management
  const scoreManager = useMemo(() => new SearchScoreManager(), []);

  const clearSearch = useCallback(() => {
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

  return {
    searchResponse,
    streamingText,
    isSummaryLoading,
    recIdToGroupKey,
    groupKeyToMeta,
    clearSearch,
    loadFromResponse,
    // Expose score manager methods
    getScore: scoreManager.getScore.bind(scoreManager),
    attachScoresToPosts: scoreManager.attachScoresToPosts.bind(scoreManager),
    getAllScores: scoreManager.getAllScores.bind(scoreManager),
  } as const;
}







