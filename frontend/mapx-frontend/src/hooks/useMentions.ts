import { useCallback, useRef, useState } from 'react';
import { socialApi } from '@/services/socialService';

export interface MentionUser {
  id: string;
  displayName: string;
}

export function useMentions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const usernameToUser = useRef<Record<string, MentionUser>>({});

  const suggest = useCallback(async (query: string, currentUserId: string) => {
    if (!query) {
      setSuggestions([]);
      return [] as any[];
    }
    try {
      const res = await socialApi.searchUsers(query, currentUserId);
      if ((res as any).success) {
        const list = ((res as any).data || []) as any[];
        setSuggestions(list);
        return list;
      }
      setSuggestions([]);
      return [] as any[];
    } catch {
      setSuggestions([]);
      return [] as any[];
    }
  }, []);

  const rememberMapping = useCallback((username: string, user: MentionUser) => {
    usernameToUser.current[username] = user;
  }, []);

  const getMapping = useCallback(() => usernameToUser.current, []);

  return {
    suggestions,
    suggest,
    rememberMapping,
    getMapping,
  };
}






