import React, { useState } from 'react';
import { Mic, ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recommendationsApi, type SearchResponse } from '@/services/recommendationsApiService';

interface FeedAISearchProps {
  isAuthenticated: boolean;
  onResults?: (response: SearchResponse | null) => void;
  onCleared?: () => void; // called when query is cleared
}

const FeedAISearch: React.FC<FeedAISearchProps> = ({ isAuthenticated, onResults, onCleared }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setResponse] = useState<SearchResponse | null>(null);

  const handleSearch = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!query.trim() || !isAuthenticated) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // First get fast results without summary
      const res = await recommendationsApi.semanticSearch(query.trim(), undefined, undefined, undefined, undefined, true);
      setResponse(res);
      onResults?.(res);
      
      // Then fetch with fast summary for better UX
      try {
        const resWithSummary = await recommendationsApi.semanticSearch(query.trim(), undefined, undefined, undefined, undefined, false, 'fast');
        setResponse(resWithSummary);
        onResults?.(resWithSummary);
      } catch (summaryError) {
        console.warn('Failed to fetch AI summary:', summaryError);
        // Keep the fast results even if summary fails
      }
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
      <form 
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSearch(e);
        }}
      >
        <div className="rounded-full bg-white border border-black/10 text-foreground h-12 md:h-14 px-5 md:px-6 flex items-center gap-3 shadow-sm">
          <input
            type="text"
            placeholder="Ask anything..."
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.trim() === '') {
                setResponse(null);
                // Notify parent that input was cleared; do not treat as a failed search
                onCleared?.();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSearch(e);
              }
            }}
            disabled={!isAuthenticated || loading}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm md:text-base font-medium"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          <button
            type="button"
            className="shrink-0 h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Voice"
            disabled={!isAuthenticated || loading}
          >
            <Mic className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" strokeWidth={1.5} />
          </button>

          <Button
            type="button"
            size="icon"
            className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-black text-white hover:bg-black/90"
            disabled={!query.trim() || loading || !isAuthenticated}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSearch();
            }}
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 md:h-4 md:w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <ArrowUp className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
            )}
          </Button>
        </div>
      </form>

      {error && (
        <div className="text-sm text-destructive mt-2">{error}</div>
      )}

    </div>
  );
};

export default FeedAISearch;


