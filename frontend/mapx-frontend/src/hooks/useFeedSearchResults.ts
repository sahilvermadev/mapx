import { useState, useCallback } from 'react';
import type { SearchResponse } from '@/services/recommendationsApiService';

export function useFeedSearchResults() {
  const [searchScores, setSearchScores] = useState<Record<number, number> | null>(null);
  const [searchRecommendationScores, setRecScores] = useState<Record<number, number> | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [recIdToGroupKey, setRecIdToGroupKey] = useState<Record<number, string>>({});
  const [groupKeyToMeta, setGroupKeyToMeta] = useState<Record<string, { title: string; subtitle?: string }>>({});

  const clearSearch = useCallback(() => {
    setSearchScores(null);
    setRecScores(null);
    setSearchResponse(null);
    setStreamingText('');
    setRecIdToGroupKey({});
    setGroupKeyToMeta({});
  }, []);

  const loadFromResponse = useCallback((res: SearchResponse) => {
    const placeScores: Record<number, number> = {};
    const recScores: Record<number, number> = {};
    const recToGroup: Record<number, string> = {};
    const groupMeta: Record<string, { title: string; subtitle?: string }> = {};

    res.results.forEach((group: any) => {
      if (group.type === 'place' && typeof group.place_id === 'number') {
        placeScores[group.place_id] = group.average_similarity ?? 0;
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
            recScores[rec.recommendation_id] = rec.similarity ?? group.average_similarity ?? 0;
            let key: string | null = null;
            if (group.type === 'service' && typeof group.service_id === 'number') key = `service:${group.service_id}`;
            else if (group.type === 'place' && typeof group.place_id === 'number') key = `place:${group.place_id}`;
            if (key) recToGroup[rec.recommendation_id] = key;
          }
        });
      }
    });

    setSearchScores(placeScores);
    setRecScores(recScores);
    setSearchResponse(res);
    setStreamingText(res.summary || '');
    setRecIdToGroupKey(recToGroup);
    setGroupKeyToMeta(groupMeta);
  }, []);

  return {
    searchScores,
    searchRecommendationScores,
    searchResponse,
    streamingText,
    recIdToGroupKey,
    groupKeyToMeta,
    clearSearch,
    loadFromResponse,
  } as const;
}







