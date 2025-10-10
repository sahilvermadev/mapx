import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMapMarkerAlt, FaStar, FaUsers, FaTags, FaCalendarAlt, FaTimes, FaSearch } from 'react-icons/fa';
import type { SearchResponse, SearchResult } from '../services/recommendationsApi';
import { formatAddress } from '../utils/addressFormatter';
import './SearchResults.css';

interface SearchResultsProps {
  searchResponse: SearchResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onPlaceSelect?: (place: SearchResult) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  searchResponse,
  isLoading,
  onClose,
  onPlaceSelect
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <FaStar
        key={i}
        className={`star ${i < rating ? 'filled' : 'empty'}`}
      />
    ));
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 0.8) return 'high';
    if (similarity >= 0.6) return 'medium';
    return 'low';
  };

  if (isLoading) {
    return ReactDOM.createPortal(
      (
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
                <p>Analyzing your query and finding relevant places...</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ),
      document.body
    );
  }

  if (!searchResponse) {
    return null;
  }

  return ReactDOM.createPortal(
    (
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
            <div className="search-results-title">
              <FaSearch className="search-icon" />
              <div>
                <h2>Search Results</h2>
                <p className="search-query">"{searchResponse.query}"</p>
              </div>
            </div>
            <button className="close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <div className="search-results-content">
            {/* Summary */}
            <div className="search-summary">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '18px' }}>🤖</span>
                <p style={{ margin: 0, flex: 1 }}>{searchResponse.summary}</p>
              </div>
              <div className="search-stats">
                <span>{searchResponse.total_places} places found</span>
                <span>•</span>
                <span>{searchResponse.total_recommendations} recommendations</span>
              </div>
            </div>

            {/* Results */}
            <div className="search-results-list">
              <AnimatePresence>
                {searchResponse.results.map((result: any, index) => (
                  <motion.div
                    key={result.type === 'place' ? `place_${result.place_id}` : `service_${result.service_id}`}
                    className="search-result-item"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => {
                      if (result.type === 'place') {
                        onPlaceSelect?.(result);
                      }
                    }}
                  >
                    <div className="result-header">
                      <div className="result-place-info">
                        <h3 className="place-name">
                          {result.type === 'place' ? result.place_name : result.service_name}
                        </h3>
                        {result.type === 'place' && result.place_address && (
                          <p className="place-address">
                            <FaMapMarkerAlt />
                            {formatAddress(result.place_address)}
                          </p>
                        )}
                      </div>
                      <div className="result-meta">
                        <div className={`similarity-badge ${getSimilarityColor(result.average_similarity)}`}>
                          {Math.round(result.average_similarity * 100)}% match
                        </div>
                        <div className="recommendations-count">
                          {result.total_recommendations} review{result.total_recommendations !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="result-recommendations">
                      {result.recommendations.slice(0, 2).map((rec: any) => (
                        <div key={rec.recommendation_id} className="recommendation-preview">
                          <div className="rec-header">
                            <span className="rec-author">{rec.user_name}</span>
                            {rec.rating && (
                              <div className="rec-rating">
                                {renderStars(rec.rating)}
                                <span className="rating-text">{rec.rating}/5</span>
                              </div>
                            )}
                            <span className="rec-date">{formatDate(rec.created_at)}</span>
                          </div>
                          
                          {rec.description && (<p className="rec-notes">{rec.description}</p>)}
                          {!rec.description && rec.notes && (<p className="rec-notes">{rec.notes}</p>)}
                          
                          <div className="rec-tags">
                            {rec.labels && rec.labels.length > 0 && (
                              <div className="tags">
                                <FaTags />
                                {rec.labels.slice(0, 3).map((label: string, i: number) => (
                                  <span key={i} className="tag">{label}</span>
                                ))}
                                {rec.labels.length > 3 && (
                                  <span className="tag-more">+{rec.labels.length - 3}</span>
                                )}
                              </div>
                            )}
                            
                            {rec.went_with && rec.went_with.length > 0 && (
                              <div className="companions">
                                <FaUsers />
                                <span>Went with {rec.went_with.join(', ')}</span>
                              </div>
                            )}
                            
                            {rec.visit_date && (
                              <div className="visit-date">
                                <FaCalendarAlt />
                                <span>Visited {new Date(rec.visit_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {result.recommendations.length > 2 && (
                        <div className="more-recommendations">
                          +{result.recommendations.length - 2} more reviews
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {searchResponse.results.length === 0 && (
                <div className="no-results">
                  <div className="no-results-icon">🔍</div>
                  <h3>No relevant places found</h3>
                  <p>Try using different keywords or being more specific about what you're looking for.</p>
                  <div className="search-tips">
                    <h4>Search tips:</h4>
                    <ul>
                      <li>Include location names (e.g., "Hauz Khas", "Connaught Place")</li>
                      <li>Mention specific features (e.g., "wifi", "outdoor seating", "quiet")</li>
                      <li>Use activity-based terms (e.g., "good for work", "date night", "family")</li>
                      <li>Include cuisine or type (e.g., "Italian restaurant", "coffee shop")</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    ),
    document.body
  );
};

export default SearchResults; 