import React, { useState } from 'react';
import { Mic, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recommendationsApi, type SearchResponse } from '@/services/recommendationsApi';

interface FeedAISearchProps {
  isAuthenticated: boolean;
  onResults?: (response: SearchResponse | null) => void;
}

const FeedAISearch: React.FC<FeedAISearchProps> = ({ isAuthenticated, onResults }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setResponse] = useState<SearchResponse | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || !isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await recommendationsApi.semanticSearch(query.trim());
      setResponse(res);
      onResults?.(res);
    } catch (err) {
      setError('Search failed. Please try again.');
      setResponse(null);
      onResults?.(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Pill search bar */}
      <div className="w-full">
        <div className="rounded-full bg-white border border-gray-200 text-foreground h-14 px-6 flex items-center gap-3 shadow-sm">

          <input
            type="text"
            placeholder="Ask anything..."
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.trim() === '') {
                setResponse(null);
                onResults?.(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            disabled={!isAuthenticated || loading}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          <button
            type="button"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Voice"
            disabled={!isAuthenticated || loading}
          >
            <Mic className="h-4 w-4 text-muted-foreground" />
          </button>

          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-full bg-black text-white hover:bg-black/90"
            disabled={!query.trim() || loading || !isAuthenticated}
            onClick={() => handleSearch()}
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive mt-2">{error}</div>
      )}

    </div>
  );
};

export default FeedAISearch;


