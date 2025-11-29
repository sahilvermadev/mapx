import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaStar, FaMapMarkerAlt, FaMap } from 'react-icons/fa';
import type { SearchResponse, SearchResult } from '../services/recommendationsApiService';
import { formatAddress } from '../utils/addressFormatter';
import './SearchResultsInline.css';
import { useTheme } from '@/contexts/ThemeContext';
import { getTagBackground, getTagStyle } from '@/utils/themeUtils';
import { THEMES } from '@/services/profileService';

interface SearchResultsInlineProps {
  searchResponse: SearchResponse | null;
  summaryText?: string;
  followUpPrompts?: string[];
  isLoading: boolean;
  onPlaceSelect?: (place: SearchResult) => void;
  onFollowUpQuery?: (query: string) => void;
}

const CARD_TOKEN_REGEX = /\[CARD:([^\]]+)\]/g;

type SummaryBlock =
  | { type: 'text'; content: string }
  | { type: 'card'; key: string };

const getResultKey = (result: SearchResult): string | null => {
  if (result.type === 'place' && typeof (result as any).place_id === 'number') {
    return `place:${(result as any).place_id}`;
  }
  if (result.type === 'service' && typeof (result as any).service_id === 'number') {
    return `service:${(result as any).service_id}`;
  }
  return null;
};

const parseSummaryBlocks = (summary: string, availableKeys: Set<string>): SummaryBlock[] => {
  if (!summary) return [];
  const blocks: SummaryBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CARD_TOKEN_REGEX.lastIndex = 0;

  while ((match = CARD_TOKEN_REGEX.exec(summary)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = summary.slice(lastIndex, match.index).trim();
      if (textSegment) {
        blocks.push({ type: 'text', content: textSegment });
      }
    }
    const key = match[1]?.trim();
    if (key && availableKeys.has(key)) {
      blocks.push({ type: 'card', key });
    }
    lastIndex = match.index + match[0].length;
  }

  const tail = summary.slice(lastIndex).trim();
  if (tail) {
    blocks.push({ type: 'text', content: tail });
  }

  return blocks;
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const formatReviewDate = (dateString?: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};

const extractHeroImage = (contentData?: Record<string, any>): string | null => {
  if (!contentData) return null;
  const candidates = [
    'hero_image',
    'heroImage',
    'photo',
    'photo_url',
    'image',
    'image_url',
    'cover_photo',
    'coverPhoto'
  ];
  for (const key of candidates) {
    const value = contentData[key];
    if (typeof value === 'string' && value.trim().length > 4) {
      return value;
    }
  }
  if (Array.isArray(contentData.images) && contentData.images.length > 0) {
    const stringImage = contentData.images.find((img: any) => typeof img === 'string');
    if (stringImage) return stringImage;
    if (contentData.images[0]?.url) return contentData.images[0].url;
  }
  if (Array.isArray(contentData.photos) && contentData.photos.length > 0) {
    const stringPhoto = contentData.photos.find((img: any) => typeof img === 'string');
    if (stringPhoto) return stringPhoto;
    if (contentData.photos[0]?.url) return contentData.photos[0].url;
  }
  return null;
};

const getPriceRange = (rec: any): string => {
  const priceLevel =
    rec?.content_data?.price_level ||
    rec?.content_data?.priceLevel ||
    rec?.content_data?.price_range;
  if (typeof priceLevel === 'string') return priceLevel;
  if (typeof priceLevel === 'number') {
    const map: Record<number, string> = {
      1: '₹0–500',
      2: '₹500–1000',
      3: '₹1000–2000',
      4: '₹2000+'
    };
    return map[priceLevel] || '₹380–450';
  }
  return '₹380–450';
};

const getDistance = (rec: any): string | null => {
  if (rec?.content_data?.distance_minutes != null) {
    return `${rec.content_data.distance_minutes} min walk`;
  }
  if (rec?.content_data?.distance_text) {
    return rec.content_data.distance_text;
  }
  return null;
};

const getLocation = (result: SearchResult): string => {
  if (result.type === 'service') {
    return result.service_address || '';
  }
  const address = result.place_address || '';
  // Extract neighborhood/city from address (e.g., "Bandra West" from full address)
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim();
  }
  return formatAddress(address);
};

const renderStars = (rating: number): React.ReactNode => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="star-rating">
      {Array.from({ length: 5 }, (_, i) => {
        let starClass = 'empty';
        if (i < fullStars) {
          starClass = 'filled';
        } else if (i === fullStars && hasHalfStar) {
          starClass = 'half';
        }
        return (
          <FaStar
            key={i}
            className={`star ${starClass}`}
          />
        );
      })}
    </div>
  );
};

const buildFallbackSummary = (searchResponse: SearchResponse): string => {
  const topResult = searchResponse.results?.[0];
  const topRec = topResult?.recommendations?.[0];
  
  if (!topResult || !topRec) {
    return 'Found some options for you.';
  }
  
  const placeName = topResult.type === 'place' ? topResult.place_name : topResult.service_name;
  const reviewerName = topRec.user_name || 'Someone';
  const trustPercent = topRec.personal_overlap_percent || 0;
  const daysAgo = formatDate(topRec.created_at);
  const rawSnippet =
    topRec.description ||
    topRec.notes ||
    topRec.content_data?.quote ||
    '';
  const snippet = rawSnippet
    ? rawSnippet.replace(/["“”]/g, '').trim().slice(0, 120)
    : '';
  const ratingText = topRec.rating ? `rated ${topRec.rating.toFixed(1)}/5` : '';
  const detail = snippet
    ? `"${snippet}${rawSnippet.length > 120 ? '…' : ''}"`
    : ratingText;
  
  const trustSuffix = trustPercent >= 80 ? ` (${Math.round(trustPercent)}% match)` : '';
  const freshnessSuffix = daysAgo ? ` • ${daysAgo}` : '';
  
  return `${placeName} clicked for ${reviewerName}${trustSuffix}${freshnessSuffix}${detail ? ` — ${detail}` : ''}.`;
};

const selectSummaryText = (response: SearchResponse | null, override?: string, isLoading?: boolean) => {
  if (!response) return '';
  let candidate = (override ?? response.summary ?? '').trim();
  
  // Remove FOLLOW_UP_PROMPTS: section from the text if it exists
  // The backend extracts these separately, so we don't want to show them in the text
  const followUpPrefix = 'FOLLOW_UP_PROMPTS:';
  const markerIndex = candidate.lastIndexOf(followUpPrefix);
  if (markerIndex !== -1) {
    candidate = candidate.slice(0, markerIndex).trim();
  }
  
  if (candidate.length > 0) {
    return candidate;
  }
  // Don't show fallback summary if we're still loading - wait for actual summary
  if (isLoading) {
    return '';
  }
  return buildFallbackSummary(response);
};

interface ConversationEntry {
  id: string;
  query: string;
  summary: string;
  response: SearchResponse;
}

const SearchResultsInline: React.FC<SearchResultsInlineProps> = ({
  searchResponse,
  summaryText,
  followUpPrompts,
  isLoading,
  onPlaceSelect,
  onFollowUpQuery
}) => {
  const { theme } = useTheme();
  const [thread, setThread] = useState<ConversationEntry[]>([]);
  const selectedTheme = THEMES[theme];
  
  const userBubbleStyle = useMemo(() => {
    const tagStyle = getTagStyle(theme);
    const background = getTagBackground(tagStyle.background);
    return {
      background,
      color: tagStyle.textColor,
      border: `${tagStyle.borderWidth ?? '1px'} solid ${tagStyle.borderColor ?? 'rgba(0, 0, 0, 0.08)'}`,
      boxShadow:
        tagStyle.shadow && tagStyle.shadow !== 'none'
          ? tagStyle.shadow
          : '0 15px 35px rgba(0, 0, 0, 0.12)',
    } as React.CSSProperties;
  }, [theme]);

  const aiResponseStyle = useMemo(() => {
    return {
      color: selectedTheme?.textPrimary || '#111827',
    } as React.CSSProperties;
  }, [selectedTheme]);

  const aiLabelStyle = useMemo(() => {
    return {
      color: selectedTheme?.textMuted || '#6b7280',
    } as React.CSSProperties;
  }, [selectedTheme]);

  const searchingTextStyle = useMemo(() => {
    return {
      color: selectedTheme?.textMuted || '#6b7280',
    } as React.CSSProperties;
  }, [selectedTheme]);
  const lastSignatureRef = useRef<string | null>(null);
  const activeEntryIdRef = useRef<string | null>(null);

  const effectiveSummary = useMemo(
    () => selectSummaryText(searchResponse, summaryText, isLoading),
    [searchResponse, summaryText, isLoading]
  );

  useEffect(() => {
    if (!searchResponse) {
      setThread([]);
      lastSignatureRef.current = null;
      activeEntryIdRef.current = null;
      return;
    }

    // Use only the query for signature to prevent duplicates when results arrive
    // The same query should update the existing entry, not create a new one
    const signature = searchResponse.query || 'unknown';

    // If we already have an entry for this query, update it instead of creating a new one
    if (signature === lastSignatureRef.current && activeEntryIdRef.current) {
      // Update existing entry with new response data
      setThread(prev =>
        prev.map(entry =>
          entry.id === activeEntryIdRef.current
            ? {
                ...entry,
                summary: effectiveSummary,
                response: searchResponse
              }
            : entry
        )
      );
      return;
    }

    // Create entry immediately when we have a query (even if no results yet)
    // This allows the user query bubble to appear right away
    if (searchResponse.query && searchResponse.query.trim().length > 0) {
      lastSignatureRef.current = signature;
      const entryId = `${Date.now()}-${Math.random()}`;
      activeEntryIdRef.current = entryId;
      setThread(prev => [
        ...prev,
        {
          id: entryId,
          query: searchResponse.query || 'Tell me something good.',
          summary: effectiveSummary,
          response: searchResponse
        }
      ]);
    }
  }, [searchResponse, effectiveSummary]);

  useEffect(() => {
    if (!searchResponse || !activeEntryIdRef.current) return;
    setThread(prev =>
      prev.map(entry =>
        entry.id === activeEntryIdRef.current && entry.summary !== effectiveSummary
          ? { ...entry, summary: effectiveSummary }
          : entry
      )
    );
  }, [effectiveSummary, searchResponse]);

  // Show nothing if we don't have a searchResponse at all
  if (!searchResponse) {
    return null;
  }

  const cardStyle = useMemo(() => {
    return {
      backgroundColor: selectedTheme?.cardBackground || '#ffffff',
      borderColor: selectedTheme?.borderColorMuted || '#e5e7eb',
      color: selectedTheme?.textPrimary || '#111827',
    } as React.CSSProperties;
  }, [selectedTheme]);

  const cardTextStyle = useMemo(() => {
    return {
      color: selectedTheme?.textPrimary || '#111827',
    } as React.CSSProperties;
  }, [selectedTheme]);

  const cardMutedTextStyle = useMemo(() => {
    return {
      color: selectedTheme?.textMuted || '#6b7280',
    } as React.CSSProperties;
  }, [selectedTheme]);

  const renderResultCard = (result: SearchResult, uniqueKey: string) => {
    const rec = result.recommendations?.[0];
    if (!rec) return null;

    const placeName = result.type === 'place' ? result.place_name : result.service_name;
    const reviewerName = rec.user_name || 'Someone';
    const trustPercent = rec.personal_overlap_percent || 0;
    const daysAgo = formatDate(rec.created_at);
    const rating = rec.rating || 0;
    const reviewCount = result.total_recommendations || 1;
    const priceRange = getPriceRange(rec);
    const distance = getDistance(rec);
    const location = getLocation(result);
    const heroImage = extractHeroImage(rec.content_data);
    const reviewQuote = rec.description || rec.notes || '';
    const reviewDate = formatReviewDate(rec.created_at);

    const handleMapClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (result.type === 'place') {
        // Prefer google_place_id for more accurate linking
        if (result.google_place_id) {
          window.open(
            `https://www.google.com/maps/place/?q=place_id:${result.google_place_id}`,
            '_blank',
            'noopener noreferrer'
          );
        } else if (result.place_lat && result.place_lng) {
          // Fall back to coordinates if placeId not available
          window.open(
            `https://www.google.com/maps/search/?api=1&query=${result.place_lat},${result.place_lng}`,
            '_blank',
            'noopener noreferrer'
          );
        } else {
          // Last resort: use place name as query
          const query = encodeURIComponent(placeName);
          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener noreferrer');
        }
      } else {
        // Services: use service name as query
        const query = encodeURIComponent(placeName);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener noreferrer');
      }
    };

    return (
      <div
        key={uniqueKey}
        className="result-card"
        onClick={() => onPlaceSelect?.(result)}
        style={cardStyle}
      >
        <div className="card-header">
          <h3 className="place-name" style={cardTextStyle}>{placeName}</h3>
          <div className="rating-section">
            {renderStars(rating)}
            <span className="rating-value" style={cardTextStyle}>{rating.toFixed(1)}</span>
            <span className="review-count" style={cardMutedTextStyle}>• {reviewCount} review{reviewCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="card-meta" style={cardMutedTextStyle}>
          <span className="days-ago" style={cardTextStyle}>{daysAgo}</span>
          <span className="meta-separator">by</span>
          <span className="reviewer-name" style={cardTextStyle}>{reviewerName}</span>
          {trustPercent >= 80 && (
            <>
              <span className="meta-separator">(</span>
              <span className="taste-match">{Math.round(trustPercent)}%</span>
              <span className="meta-separator">)</span>
            </>
          )}
        </div>

        <div className="card-details">
          <span className="price-range">{priceRange}</span>
          {distance && (
            <>
              <span className="detail-separator">•</span>
              <span className="distance">{distance}</span>
            </>
          )}
          {location && (
            <>
              <span className="detail-separator">•</span>
              <span className="location">
                <FaMapMarkerAlt className="location-icon" />
                {location}
              </span>
            </>
          )}
          <button
            className="map-button"
            onClick={handleMapClick}
            type="button"
          >
            <FaMap className="map-icon" />
            Map
          </button>
        </div>

        {heroImage && (
          <div className="hero-image-container">
            <img src={heroImage} alt={placeName} className="hero-image" />
          </div>
        )}

        {reviewQuote && (
          <div className="review-quote">
            <p className="quote-text" style={cardTextStyle}>"{reviewQuote}"</p>
            <p className="quote-author" style={cardMutedTextStyle}>
              — {reviewerName} • {reviewDate}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Only create fallback conversation entry if we have results or a summary
  // This prevents showing empty/loading state as a conversation entry
  const conversation = thread.length > 0
    ? thread
    : (searchResponse.results && searchResponse.results.length > 0) || (effectiveSummary && effectiveSummary.trim().length > 0)
    ? [{
        id: 'current',
        query: searchResponse.query || 'Tell me something good.',
        summary: effectiveSummary,
        response: searchResponse
      }]
    : [];

  return (
    <div className="search-results-inline">
      {conversation.map((entry, index) => {
        const resultsList = entry.response.results || [];
        const resultMap = new Map<string, SearchResult>();
        resultsList.forEach((result) => {
          const key = getResultKey(result);
          if (key) resultMap.set(key, result);
        });
        const keySet = new Set(Array.from(resultMap.keys()));
        let blocks = parseSummaryBlocks(entry.summary, keySet);
        if (blocks.length === 0 && entry.summary.trim().length > 0) {
          blocks = [{ type: 'text', content: entry.summary.trim() }];
        }
        const hasCardBlocks = blocks.some(block => block.type === 'card');
        const fallbackCards = hasCardBlocks ? [] : resultsList.slice(0, 2);
        const isLast = index === conversation.length - 1;

        return (
          <div
            key={entry.id}
            className="chat-bubbles"
          >
            <div className="chat-bubble you" style={userBubbleStyle}>
              <p className="bubble-text">{entry.query}</p>
            </div>

            <div className="ai-response" style={aiResponseStyle}>
              <div className="ai-response-blocks">
                {/* Show "Searching..." animation when loading and no content yet */}
                {isLoading && isLast && blocks.length === 0 && resultsList.length === 0 && (
                  <div className="ai-text-block searching-indicator">
                    <p className="searching-text" style={searchingTextStyle}>
                      <span className="searching-dot">.</span>
                      <span className="searching-dot">.</span>
                      <span className="searching-dot">.</span>
                    </p>
                  </div>
                )}
                
                {blocks.map((block, blockIndex) => {
                  if (block.type === 'text') {
                    const paragraphs = block.content
                      .split(/\n{2,}/)
                      .map(paragraph => paragraph.trim())
                      .filter(Boolean);
                    return (
                      <div
                        className="ai-text-block"
                        key={`${entry.id}-text-${blockIndex}`}
                        style={aiResponseStyle}
                      >
                        {paragraphs.map((paragraph, paragraphIndex) => (
                          <p
                            key={`${entry.id}-text-${blockIndex}-${paragraphIndex}`}
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  const cardResult = resultMap.get(block.key);
                  if (!cardResult) return null;
                  return (
                    <div
                      key={`${entry.id}-card-${block.key}-${blockIndex}`}
                    >
                      {renderResultCard(cardResult, `${entry.id}-card-${block.key}-${blockIndex}`)}
                    </div>
                  );
                })}

                {!hasCardBlocks && searchResponse?.cards_allowed !== false && fallbackCards.map((result, cardIndex) => (
                  <div
                    key={`${entry.id}-fallback-${cardIndex}`}
                  >
                    {renderResultCard(result, `${entry.id}-fallback-${cardIndex}`)}
                  </div>
                ))}

                {/* Only show "No trusted spots" message if we're not loading and have no results */}
                {resultsList.length === 0 && !isLoading && (
                  <div className="ai-text-block" style={aiResponseStyle}>
                    <p>No trusted spots matched that ask. Try a follow-up question.</p>
                  </div>
                )}
              </div>

              {isLast && onFollowUpQuery && followUpPrompts && followUpPrompts.length > 0 && (
                <div className="follow-up-chips">
                  {followUpPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onFollowUpQuery(suggestion)}
                      style={{
                        color: selectedTheme?.textPrimary || '#111827',
                        borderColor: selectedTheme?.borderColor || '#e5e7eb',
                        backgroundColor: selectedTheme?.cardBackground || '#ffffff',
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SearchResultsInline;
