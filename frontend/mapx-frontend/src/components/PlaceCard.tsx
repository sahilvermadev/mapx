import React from 'react';
import { FaStar, FaMapMarkerAlt, FaTrash, FaHeart, FaBookmark, FaEye, FaEyeSlash } from 'react-icons/fa';
import type { PlaceCard as PlaceCardType } from '../services/profile';
import { formatGoogleTypeForDisplay } from '../utils/placeTypes';
import './PlaceCard.css';

type TabType = 'recommendations' | 'likes' | 'saved';

interface PlaceCardProps {
  place: PlaceCardType;
  onViewOnMap: () => void;
  onDelete?: () => void;
  onUnlike?: () => void;
  onRemove?: () => void;
  showActions?: boolean;
  tabType: TabType;
}

const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  onViewOnMap,
  onDelete,
  onUnlike,
  onRemove,
  showActions = false,
  tabType
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

  const getActionButton = () => {
    if (!showActions) return null;

    switch (tabType) {
      case 'recommendations':
        return onDelete ? (
          <button onClick={onDelete} className="place-action-btn delete" aria-label="Delete recommendation">
            <FaTrash />
          </button>
        ) : null;
      case 'likes':
        return onUnlike ? (
          <button onClick={onUnlike} className="place-action-btn unlike" aria-label="Unlike place">
            <FaHeart />
          </button>
        ) : null;
      case 'saved':
        return onRemove ? (
          <button onClick={onRemove} className="place-action-btn remove" aria-label="Remove from saved">
            <FaBookmark />
          </button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="place-card">
      <div className="profile-place-header">
        <div className="place-info">
          <h3 className="place-name">{place.place_name}</h3>
          {place.place_address && (
            <p className="place-address">
              <FaMapMarkerAlt className="address-icon" />
              {place.place_address}
            </p>
          )}
        </div>
        
        {showActions && (
          <div className="place-actions">
            {getActionButton()}
            <button onClick={onViewOnMap} className="place-action-btn view-map" aria-label="View on map">
              <FaMapMarkerAlt />
            </button>
          </div>
        )}
      </div>

      <div className="place-content">
        {place.category && (
          <div className="place-category">
            {formatGoogleTypeForDisplay(place.category)}
          </div>
        )}

        {place.rating && (
          <div className="place-rating">
            <div className="stars">
              {renderStars(place.rating)}
            </div>
            <span className="rating-text">{place.rating}/5</span>
          </div>
        )}

        {place.visit_date && (
          <div className="visit-date">
            Visited: {new Date(place.visit_date).toLocaleDateString()}
          </div>
        )}

        {place.visibility && (
          <div className="visibility-badge">
            {place.visibility === 'public' ? (
              <>
                <FaEye className="visibility-icon" />
                Public
              </>
            ) : (
              <>
                <FaEyeSlash className="visibility-icon" />
                Friends Only
              </>
            )}
          </div>
        )}

        {place.notes && (
          <div className="place-notes">
            <p>{place.notes}</p>
          </div>
        )}

        {place.labels && place.labels.length > 0 && (
          <div className="place-labels">
            {place.labels.map((label, index) => (
              <span key={index} className="label-tag">
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="place-meta">
          <span className="created-date">
            {formatDate(place.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlaceCard; 