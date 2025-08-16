import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaChevronLeft, FaChevronRight, FaStar, FaHeart, FaBookmark, FaShare, FaMapMarkerAlt } from 'react-icons/fa';
import ReviewModal, { type ReviewPayload } from './ReviewModal';
import { recommendationsApi, type PlaceRecommendation } from '../services/recommendations';
import { formatGoogleTypeForDisplay } from '../utils/placeTypes';
import './ContentCard.css';

export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  category: string; // Google Places type (e.g., 'restaurant', 'bar', 'cafe', 'night_club', etc.)
  placeType?: string; // Google Places type for backward compatibility
  userRating?: number;
  friendsRating?: number;
  personalReview?: string;
  images?: string[];
  isLiked?: boolean;
  isSaved?: boolean;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
}

// Real review type from API
interface RealReview {
  id: number;
  user_name: string;
  title?: string;
  notes?: string;
  rating?: number;
  visit_date?: string;
  created_at: string;
}

interface ContentCardProps {
  place: PlaceDetails;
  onClose: () => void;
  onRate: (rating: number) => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
}

const ContentCard: React.FC<ContentCardProps> = ({
  place,
  onClose,
  onRate,
  onLike,
  onSave,
  onShare,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [userRating, setUserRating] = useState(place.userRating || 0);
  const [realReviews, setRealReviews] = useState<RealReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Fetch real recommendations when component mounts
  useEffect(() => {
    const fetchReviews = async () => {
      if (!place.google_place_id) {
        setReviewsLoading(false);
        setReviewsError('No Google Place ID available');
        return;
      }

      try {
        setReviewsLoading(true);
        setReviewsError(null);
        
        // First, get the database place ID from Google Place ID
        const placeInfo = await recommendationsApi.getPlaceByGoogleId(place.google_place_id);
        
        if (!placeInfo) {
          // Place doesn't exist in our database yet, so no reviews
          setRealReviews([]);
          setReviewsLoading(false);
          return;
        }

        // Now get recommendations using the database place ID
        const recommendations = await recommendationsApi.getPlaceRecommendations(placeInfo.id, 'all', 10);
        
        // Transform API data to our review format
        const reviews: RealReview[] = recommendations.map(rec => ({
          id: rec.id,
          user_name: rec.user_name,
          title: rec.title,
          notes: rec.notes,
          rating: rec.rating,
          visit_date: rec.visit_date,
          created_at: rec.created_at
        }));

        setRealReviews(reviews);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
        setReviewsError(error instanceof Error ? error.message : 'Failed to load reviews');
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [place.google_place_id]);

  const handleRate = (rating: number) => {
    setUserRating(rating);
    onRate(rating);
  };

  const totalImages = place.images?.length || 0;

  const handleSubmitReview = (payload: ReviewPayload) => {
    console.log('Review submitted:', payload);
    // This is now handled by the ReviewModal internally
  };

  const handleReviewSuccess = (result: { place_id: number; annotation_id: number }) => {
    console.log('Review saved successfully:', result);
    // Refresh reviews after successful submission by refetching
    const fetchReviews = async () => {
      if (!place.google_place_id) return;
      
      try {
        const placeInfo = await recommendationsApi.getPlaceByGoogleId(place.google_place_id);
        if (!placeInfo) return;

        const recommendations = await recommendationsApi.getPlaceRecommendations(placeInfo.id, 'all', 10);
        
        const reviews: RealReview[] = recommendations.map(rec => ({
          id: rec.id,
          user_name: rec.user_name,
          title: rec.title,
          notes: rec.notes,
          rating: rec.rating,
          visit_date: rec.visit_date,
          created_at: rec.created_at
        }));

        setRealReviews(reviews);
      } catch (error) {
        console.error('Failed to refresh reviews:', error);
      }
    };
    
    fetchReviews();
  };

  const handleReviewError = (error: string) => {
    console.error('Review save failed:', error);
    // You can add UI feedback here, like showing an error toast
  };

  // Format date for display
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

  // Calculate average rating from real reviews
  const calculateAverageRating = () => {
    if (realReviews.length === 0) return 0;
    const totalRating = realReviews.reduce((sum, review) => sum + (review.rating || 0), 0);
    return totalRating / realReviews.length;
  };

  // Filter out auto-generated titles like "Review of [Place Name]"
  const getDisplayTitle = (title: string | undefined, placeName: string) => {
    if (!title) return undefined;
    const autoGeneratedPattern = new RegExp(`^Review of ${placeName}$`, 'i');
    return autoGeneratedPattern.test(title) ? undefined : title;
  };

  const actualAverageRating = calculateAverageRating();

  return (
    <motion.div
      className="side-panel"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Image Gallery with integrated close button */}
      {place.images && place.images.length > 0 ? (
        <div className="image-gallery">
          <div className="main-image">
            <img src={place.images[currentImageIndex]} alt={place.name} />
            
            {/* Close Button - Integrated into image gallery */}
            <button 
              className="close-btn" 
              onClick={onClose} 
              aria-label="Close"
            >
              <FaTimes />
            </button>
            
            {totalImages > 1 && (
              <>
                <button 
                  className="gallery-nav prev" 
                  onClick={() => setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages)}
                  aria-label="Previous image"
                >
                  <FaChevronLeft />
                </button>
                <button 
                  className="gallery-nav next" 
                  onClick={() => setCurrentImageIndex((prev) => (prev + 1) % totalImages)}
                  aria-label="Next image"
                >
                  <FaChevronRight />
                </button>
                <div className="image-indicators">
                  {place.images.map((_, index) => (
                    <button
                      key={index}
                      className={`indicator ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Fallback for places without images */
        <div className="image-gallery">
          <div className="main-image">
            <div style={{ 
              width: '100%', 
              height: '100%', 
              background: '#f3f4f6', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: '16px'
            }}>
              No image available
            </div>
            
            {/* Close Button - Integrated into fallback image area */}
            <button 
              className="close-btn" 
              onClick={onClose} 
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      {/* Panel Content */}
      <div className="panel-content">
        {/* Place Header */}
        <div className="place-header">
          <h2 className="place-title">{place.name}</h2>
          <p className="place-address">
            <FaMapMarkerAlt style={{ fontSize: '12px' }} />
            {place.address}
          </p>
          {place.category && place.category !== 'point_of_interest' && (
            <div className="place-type-badge">{formatGoogleTypeForDisplay(place.category)}</div>
          )}
        </div>

        {/* Reviews Header and CTA */}
        <div className="reviews-header">
          <h3>Reviews ({realReviews.length})</h3>
          <button 
            className="write-review-btn" 
            onClick={() => setReviewOpen(true)}
          >
            Write a review
          </button>
        </div>

        {/* Real Reviews List */}
        <div className="reviews-section">
          {reviewsLoading ? (
            <div className="review-item loading">
              <div className="review-text">Loading reviews...</div>
            </div>
          ) : reviewsError ? (
            <div className="review-item error">
              <div className="review-text">
                Error loading reviews: {reviewsError}
              </div>
            </div>
          ) : realReviews.length === 0 ? (
            <div className="review-item">
              <div className="review-text">No reviews yet. Be the first to review!</div>
            </div>
          ) : (
            <AnimatePresence>
              {realReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  className="review-item"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ 
                    delay: index * 0.05,
                    duration: 0.2,
                    ease: 'easeOut'
                  }}
                >
                  <div className="review-top">
                    <div className="review-avatar" aria-hidden="true">
                      {review.user_name.charAt(0)}
                    </div>
                    <div className="review-meta">
                      <div className="author">{review.user_name}</div>
                      <div className="sub">
                        {formatDate(review.created_at)} 
                        {review.rating && ` • ${Array.from({length: review.rating}).map(() => '★').join('')}`}
                      </div>
                    </div>
                  </div>
                  {(getDisplayTitle(review.title, place.name) || review.notes) && (
                    <p className="review-text">
                      {getDisplayTitle(review.title, place.name) && (
                        <strong>{getDisplayTitle(review.title, place.name)}</strong>
                      )}
                      {getDisplayTitle(review.title, place.name) && review.notes && <br />}
                      {review.notes}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Personal Review */}
        {place.personalReview && (
          <div className="review-item">
            <div className="review-top">
              <div className="review-avatar" aria-hidden="true">
                You
              </div>
              <div className="review-meta">
                <div className="author">Your Review</div>
                <div className="sub">Personal notes</div>
              </div>
            </div>
            <p className="review-text">{place.personalReview}</p>
          </div>
        )}

        {/* Social Actions */}
        <div className="social-actions">
          <button 
            className={`action-btn ${place.isLiked ? 'liked' : ''}`} 
            onClick={onLike}
            aria-label={place.isLiked ? 'Unlike' : 'Like'}
          >
            <FaHeart />
            {place.isLiked ? 'Liked' : 'Like'}
          </button>
          
          <button 
            className={`action-btn ${place.isSaved ? 'saved' : ''}`} 
            onClick={onSave}
            aria-label={place.isSaved ? 'Remove from saved' : 'Save'}
          >
            <FaBookmark />
            {place.isSaved ? 'Saved' : 'Save'}
          </button>
          
          <button 
            className="action-btn" 
            onClick={onShare} 
            aria-label="Share"
          >
            <FaShare />
            Share
          </button>
        </div>
      </div>

      {/* Review Modal */}
      <ReviewModal 
        isOpen={reviewOpen} 
        onClose={() => setReviewOpen(false)} 
        onSubmit={handleSubmitReview}
        placeData={{
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          google_place_id: place.google_place_id,
        }}
        onSuccess={handleReviewSuccess}
        onError={handleReviewError}
      />
    </motion.div>
  );
};

export default ContentCard; 