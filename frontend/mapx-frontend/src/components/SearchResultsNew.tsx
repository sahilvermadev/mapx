import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMapMarkerAlt, FaStar, FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import type { SearchResponse, SearchResult } from '../services/recommendationsApiService';
import { formatAddress } from '../utils/addressFormatter';
import './SearchResultsNew.css';

interface SearchResultsNewProps {
  searchResponse: SearchResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onPlaceSelect?: (place: SearchResult) => void;
}

type ResponseArchetype = 'clear_winner' | 'two_contenders' | 'weak_match' | 'nothing';

const SearchResultsNew: React.FC<SearchResultsNewProps> = ({
  searchResponse,
  isLoading,
  onClose,
  onPlaceSelect
}) => {
  const [showAlternatives, setShowAlternatives] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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

  const getFreshnessColor = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 90) return 'green';
    if (diffDays <= 180) return 'orange';
    return 'gray';
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <FaStar
        key={i}
        className={`star ${i < Math.floor(rating) ? 'filled' : 'empty'}`}
      />
    ));
  };

  const determineArchetype = (response: SearchResponse): ResponseArchetype => {
    if (!response.results || response.results.length === 0) {
      return 'nothing';
    }

    const topResult = response.results[0];
    const topRec = topResult.recommendations?.[0];
    
    if (!topRec) return 'nothing';

    const trustPercent = topRec.personal_overlap_percent || 0;
    const confidence = response.search_metadata?.top_confidence || 0;
    const daysSince = topRec.created_at 
      ? Math.ceil((Date.now() - new Date(topRec.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    // Clear winner: high trust (≥75%), fresh (≤90 days), high confidence (≥0.9)
    if (trustPercent >= 75 && daysSince <= 90 && confidence >= 0.9 && response.results.length >= 1) {
      return 'clear_winner';
    }

    // Two contenders: 2+ results with decent trust and confidence
    if (response.results.length >= 2 && confidence >= 0.7) {
      return 'two_contenders';
    }

    // Weak match: something found but not perfect
    if (response.results.length > 0) {
      return 'weak_match';
    }

    return 'nothing';
  };

  const getAIHeadline = (archetype: ResponseArchetype, response: SearchResponse): string => {
    if (archetype === 'clear_winner') {
      const topResult = response.results[0];
      const topRec = topResult.recommendations?.[0];
      const placeName = topResult.place_name || topResult.service_name;
      const reviewerName = topRec?.user_name || 'Someone';
      const trustPercent = topRec?.personal_overlap_percent || 0;
      
      return `${placeName} is still the move — ${reviewerName}${trustPercent >= 80 ? ` (${trustPercent}% taste match)` : ''} went ${formatDate(topRec?.created_at || '')} and says it's fire.`;
    }
    
    if (archetype === 'two_contenders') {
      return "Two places you'll actually love right now:";
    }
    
    if (archetype === 'weak_match') {
      return 'Nothing perfect right now. Closest your crew loves:';
    }
    
    return `Nobody you trust has found a proper ${response.query || 'match'} yet. Want me to ask the food crew?`;
  };

  if (isLoading) {
    return ReactDOM.createPortal(
      <motion.div
        className="search-results-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="search-results-modal"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
        >
          <div className="search-results-header">
            <h2>Searching...</h2>
            <button className="close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
          <div className="search-results-content">
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Finding the perfect match...</p>
            </div>
          </div>
        </motion.div>
      </motion.div>,
      document.body
    );
  }

  if (!searchResponse) {
    return null;
  }

  const archetype = determineArchetype(searchResponse);
  const aiHeadline = getAIHeadline(archetype, searchResponse);

  return ReactDOM.createPortal(
    <motion.div
      className="search-results-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="search-results-modal new-layout"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
      >
        <div className="search-results-header">
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="search-results-content new-content">
          {/* AI Headline (max 2 lines) */}
          <div className="ai-headline">
            <strong>{aiHeadline}</strong>
          </div>

          {/* Main Content Based on Archetype */}
          {archetype === 'clear_winner' && (
            <ClearWinnerCard 
              result={searchResponse.results[0]} 
              onPlaceSelect={onPlaceSelect}
              formatDate={formatDate}
              getFreshnessColor={getFreshnessColor}
              renderStars={renderStars}
            />
          )}

          {archetype === 'two_contenders' && (
            <TwoContendersCards 
              results={searchResponse.results.slice(0, 2)}
              onPlaceSelect={onPlaceSelect}
              formatDate={formatDate}
              getFreshnessColor={getFreshnessColor}
              renderStars={renderStars}
            />
          )}

          {archetype === 'weak_match' && (
            <WeakMatchCard 
              result={searchResponse.results[0]}
              totalResults={searchResponse.results.length}
              onPlaceSelect={onPlaceSelect}
              formatDate={formatDate}
              getFreshnessColor={getFreshnessColor}
              renderStars={renderStars}
            />
          )}

          {archetype === 'nothing' && (
            <NothingFound 
              query={searchResponse.query}
            />
          )}

          {/* Collapsible Footer */}
          {archetype !== 'nothing' && searchResponse.results.length > (archetype === 'clear_winner' ? 1 : 2) && (
            <div className="search-footer">
              <button 
                className="footer-toggle"
                onClick={() => setShowAlternatives(!showAlternatives)}
              >
                {showAlternatives ? <FaChevronUp /> : <FaChevronDown />}
                <span>
                  {searchResponse.results.length - (archetype === 'clear_winner' ? 1 : 2)} older/lower-trust options
                </span>
              </button>
              
              {showAlternatives && (
                <div className="alternatives-list">
                  {searchResponse.results.slice(archetype === 'clear_winner' ? 1 : 2).map((result, index) => (
                    <div key={index} className="alternative-item">
                      {result.place_name || result.service_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

// Clear Winner: Single Big Card (70-90% of screen)
const ClearWinnerCard: React.FC<{
  result: SearchResult;
  onPlaceSelect?: (place: SearchResult) => void;
  formatDate: (date: string) => string;
  getFreshnessColor: (date: string) => string;
  renderStars: (rating: number) => React.ReactNode;
}> = ({ result, onPlaceSelect, formatDate, getFreshnessColor, renderStars }) => {
  const rec = result.recommendations?.[0];
  if (!rec) return null;

  const placeName = result.place_name || result.service_name;
  const address = result.place_address || result.service_address;
  const trustPercent = rec.personal_overlap_percent || 0;
  const freshnessColor = getFreshnessColor(rec.created_at);
  const daysAgo = formatDate(rec.created_at);

  return (
    <div className="clear-winner-card" onClick={() => onPlaceSelect?.(result)}>
      <div className="card-header">
        <h2 className="place-name">{placeName}</h2>
        {rec.rating && (
          <div className="rating-display">
            {renderStars(rec.rating)}
            <span className="rating-value">{rec.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="card-meta">
        <span className={`reviewer-name ${trustPercent >= 80 ? 'high-trust' : ''}`}>
          {rec.user_name}
          {trustPercent >= 80 && (
            <span className="trust-badge">{trustPercent}%</span>
          )}
        </span>
        <span className="meta-separator">•</span>
        <span className={`freshness freshness-${freshnessColor}`}>
          {daysAgo}
        </span>
      </div>

      {address && (
        <div className="card-location">
          <FaMapMarkerAlt />
          <span>{formatAddress(address)}</span>
        </div>
      )}

      {rec.description && (
        <div className="card-description">
          <p>"{rec.description}"</p>
          <span className="card-author">— {rec.user_name} • {new Date(rec.created_at).toLocaleDateString()}</span>
        </div>
      )}

      <div className="card-actions">
        {result.place_lat && result.place_lng && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${result.place_lat},${result.place_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn primary"
            onClick={(e) => e.stopPropagation()}
          >
            Open in Maps
          </a>
        )}
        <button className="action-btn secondary">Save</button>
        <button className="action-btn secondary">Ask {rec.user_name}</button>
      </div>
    </div>
  );
};

// Two Contenders: Two Equal Cards
const TwoContendersCards: React.FC<{
  results: SearchResult[];
  onPlaceSelect?: (place: SearchResult) => void;
  formatDate: (date: string) => string;
  getFreshnessColor: (date: string) => string;
  renderStars: (rating: number) => React.ReactNode;
}> = ({ results, onPlaceSelect, formatDate, getFreshnessColor, renderStars }) => {
  return (
    <div className="two-contenders">
      {results.map((result, index) => {
        const rec = result.recommendations?.[0];
        if (!rec) return null;

        const placeName = result.place_name || result.service_name;
        const trustPercent = rec.personal_overlap_percent || 0;
        const freshnessColor = getFreshnessColor(rec.created_at);
        const daysAgo = formatDate(rec.created_at);

        return (
          <div 
            key={index} 
            className="contender-card"
            onClick={() => onPlaceSelect?.(result)}
          >
            <h3 className="place-name">{placeName}</h3>
            {rec.rating && (
              <div className="rating-display">
                {renderStars(rec.rating)}
                <span>{rec.rating.toFixed(1)}</span>
              </div>
            )}
            <div className="card-meta">
              <span className={`reviewer-name ${trustPercent >= 80 ? 'high-trust' : ''}`}>
                {rec.user_name}
                {trustPercent >= 80 && (
                  <span className="trust-badge">{trustPercent}%</span>
                )}
              </span>
              <span className="meta-separator">•</span>
              <span className={`freshness freshness-${freshnessColor}`}>
                {daysAgo}
              </span>
            </div>
            {rec.description && (
              <p className="card-description-small">"{rec.description.substring(0, 100)}{rec.description.length > 100 ? '...' : ''}"</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Weak Match: Honest paragraph + one card
const WeakMatchCard: React.FC<{
  result: SearchResult;
  totalResults: number;
  onPlaceSelect?: (place: SearchResult) => void;
  formatDate: (date: string) => string;
  getFreshnessColor: (date: string) => string;
  renderStars: (rating: number) => React.ReactNode;
}> = ({ result, totalResults, onPlaceSelect, formatDate, getFreshnessColor, renderStars }) => {
  const rec = result.recommendations?.[0];
  if (!rec) return null;

  return (
    <div className="weak-match">
      <p className="honest-message">
        Nothing perfect right now. Closest your crew loves is {result.place_name || result.service_name} — {rec.user_name} went {formatDate(rec.created_at)}, rated {rec.rating || 'N/A'}, says {rec.description?.substring(0, 80) || 'it\'s worth checking out'}.
      </p>
      <button className="ask-network-btn">Ask network</button>
      <ClearWinnerCard 
        result={result}
        onPlaceSelect={onPlaceSelect}
        formatDate={formatDate}
        getFreshnessColor={getFreshnessColor}
        renderStars={renderStars}
      />
    </div>
  );
};

// Nothing Found
const NothingFound: React.FC<{ query: string }> = ({ query }) => {
  return (
    <div className="nothing-found">
      <p>Nobody you trust has found a proper {query} yet. Want me to ask the food crew?</p>
      <button className="ask-network-btn primary">Ask network</button>
    </div>
  );
};

export default SearchResultsNew;

