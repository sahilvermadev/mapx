import React, { useEffect, useMemo, useState, useRef } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Props = {
  triggerLabel: string;
  onSelect: (city: { id?: string; name?: string; country?: string }) => void;
  className?: string;
  // List of cities with available recommendations; used to avoid unnecessary API searches
  availableCities?: Array<{ id: string; name: string; country?: string; recCount?: number }>;
};

const normalizeCityId = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-');

const CitySearchPopover: React.FC<Props> = ({ triggerLabel, onSelect, className, availableCities = [] }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<Array<{ name: string; country?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const sessionToken = useMemo(() => {
    // Fallback for browsers that don't support crypto.randomUUID()
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (e) {
      // crypto.randomUUID might exist but throw an error
    }
    // Fallback: generate a UUID-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  // Autofocus the input when the popover opens
  useEffect(() => {
    if (open) {
      // Next tick to ensure content is mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!apiKey) return;
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': '*',
          },
          signal: controller.signal,
          body: JSON.stringify({
            input: query,
            includedPrimaryTypes: ['(cities)'],
            sessionToken,
          }),
        });
        if (!res.ok) throw new Error('places autocomplete failed');
        const data = await res.json();
        const suggestions = (data?.suggestions || [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => {
            const main = p?.structuredFormat?.mainText?.text || p?.text?.text || '';
            const secondary = p?.structuredFormat?.secondaryText?.text || '';
            // crude extract of country as last segment
            const country = secondary?.split(',')?.at(-1)?.trim();
            return { name: main, country };
          });
        setResults(suggestions);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, query, sessionToken]);

  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableCities;
    return availableCities.filter(c => c.name.toLowerCase().includes(q));
  }, [availableCities, query]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={`px-3 py-2 h-9 rounded-full border border-black/10 bg-transparent hover:border-black/40 hover:bg-black/[0.03] shadow-none text-xs md:text-sm font-medium transition-all ${className || ''}`}>
          <MapPin className="mr-1 h-3.5 w-3.5 opacity-70" strokeWidth={1.5} />
          <span className="font-medium">{triggerLabel}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={8} className="w-80 p-3 border border-black/10">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              className="text-xs underline text-muted-foreground hover:text-foreground"
              onClick={() => { onSelect({ id: undefined }); setOpen(false); setQuery(''); }}
            >
              Worldwide
            </button>
          </div>
            <Input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search any city in the world" className="h-9 border border-black/10" />
          <div className="max-h-72 overflow-auto rounded-md border border-black/10 divide-y">
            {/* Available cities section */}
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Your cities</div>
              {filteredAvailable.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No cities yet</div>
              )}
              {filteredAvailable.map((c) => (
                <button
                  key={c.id}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-accent"
                  onClick={() => { onSelect({ id: c.id, name: c.name, country: c.country }); setOpen(false); setQuery(''); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.name}</div>
                    {typeof c.recCount === 'number' && <span className="text-[10px] text-muted-foreground">{c.recCount}</span>}
                  </div>
                  {c.country && <div className="text-[10px] text-muted-foreground">{c.country}</div>}
                </button>
              ))}
            </div>
            {/* Worldwide search results */}
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Search worldwide</div>
              {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
              {!loading && results.length === 0 && query.length >= 2 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
              )}
              {!loading && results.map((r, idx) => (
                <button key={idx} className="block w-full text-left px-3 py-2 text-xs hover:bg-accent" onClick={() => { onSelect({ id: normalizeCityId(r.name), name: r.name, country: r.country }); setOpen(false); setQuery(''); }}>
                  <div className="font-medium">{r.name}</div>
                  {r.country && <div className="text-[10px] text-muted-foreground">{r.country}</div>}
                </button>
              ))}
              {results.length > 0 && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground/70 text-right">Powered by Google Places</div>
              )}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CitySearchPopover;


