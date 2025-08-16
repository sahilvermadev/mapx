import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserFriends, FaTags, FaStickyNote, FaUtensils, FaCalendarAlt, FaStar, FaTimes, FaEye, FaEyeSlash, FaMapMarkerAlt, FaExclamationTriangle } from 'react-icons/fa';
import { recommendationsApi, type SaveRecommendationRequest } from '../services/recommendations';
import './ReviewModal.css';

// Updated ReviewPayload interface to align with backend API
export interface ReviewPayload {
  companions?: string;
  labels?: string[];
  notes?: string;
  favoriteDishes?: string[];
  visitDate: string; // ISO date (YYYY-MM-DD)
  rating: number; // 1..5
  visibility?: 'friends' | 'public';
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (payload: ReviewPayload) => void; // Made optional since we handle API calls internally
  placeData?: {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    google_place_id?: string;
  };
  onSuccess?: (result: { place_id: number; annotation_id: number }) => void;
  onError?: (error: string) => void;
}

const allLabelOptions = [
  'Good for dates',
  'Family friendly',
  'Work-friendly',
  'Pet friendly',
  'Budget',
  'Luxury',
  'Live music',
  'Rooftop',
  'Outdoor seating',
  'Quick service',
  'Fine dining',
  'Casual'
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const ReviewModal: React.FC<ReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  placeData,
  onSuccess,
  onError 
}) => {
  // Form state
  const [companions, setCompanions] = useState<string>('');
  const [labels, setLabels] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [favoriteDishes, setFavoriteDishes] = useState<string>('');
  const [visitDate, setVisitDate] = useState<string>(todayIso());
  const [rating, setRating] = useState<number>(0);
  const [visibility, setVisibility] = useState<'friends' | 'public'>('friends');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Validation errors
  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!visitDate) errs.visitDate = 'Visit date is required';
    if (rating < 1 || rating > 5) errs.rating = 'Please rate between 1 and 5';
    if (!placeData?.name) errs.placeName = 'Place name is required';
    return errs;
  }, [visitDate, rating, placeData?.name]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCompanions('');
      setLabels([]);
      setNotes('');
      setFavoriteDishes('');
      setVisitDate(todayIso());
      setRating(0);
      setVisibility('friends');
      setSubmitError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleToggleLabel = (lbl: string) => {
    setLabels(prev => prev.includes(lbl) ? prev.filter(l => l !== lbl) : [...prev, lbl]);
  };

  const handleSubmit = async () => {
    // Clear previous errors
    setSubmitError(null);
    setFieldErrors({});

    // Validate form
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    if (!placeData) {
      setSubmitError('Place data is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the review payload for the parent component (if callback provided)
      const reviewPayload: ReviewPayload = {
        companions: companions.trim() || undefined,
        labels,
        notes: notes.trim() || undefined,
        favoriteDishes: favoriteDishes.trim() ? favoriteDishes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        visitDate,
        rating,
        visibility,
      };

      // Call the parent's onSubmit handler if provided
      if (onSubmit) {
        onSubmit(reviewPayload);
      }

      // Prepare API payload
      const apiPayload: SaveRecommendationRequest = {
        place_name: placeData.name,
        place_address: placeData.address,
        place_lat: placeData.latitude,
        place_lng: placeData.longitude,
        google_place_id: placeData.google_place_id,
        title: undefined, // Don't auto-generate title - let users write their own
        went_with: reviewPayload.companions ? [reviewPayload.companions] : undefined,
        labels: reviewPayload.labels,
        notes: reviewPayload.notes,
        metadata: {
          favorite_dishes: reviewPayload.favoriteDishes,
          visit_type: reviewPayload.labels?.includes('Work-friendly') ? 'work' : 'leisure',
          companions_count: reviewPayload.companions ? reviewPayload.companions.split(',').length : 0,
        },
        visit_date: reviewPayload.visitDate,
        rating: reviewPayload.rating,
        visibility: reviewPayload.visibility || 'friends',
      };

      console.log('Submitting review with payload:', apiPayload);

      // Save to API
      const result = await recommendationsApi.saveRecommendation(apiPayload);
      
      console.log('Review saved successfully:', result);
      
      // Call success callback
      if (onSuccess) {
        onSuccess({
          place_id: result.place_id,
          annotation_id: result.annotation_id
        });
      }

      // Close modal on success
      onClose();

    } catch (error) {
      console.error('Failed to save review:', error);
      
      let errorMessage = 'Failed to save review';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for specific timeout errors
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. The server might be processing your request. Please try again.';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      setSubmitError(errorMessage);
      
      // Call error callback
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="rm-overlay" 
          onMouseDown={onClose} 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="rm-modal"
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            role="dialog" 
            aria-modal="true" 
            aria-label="Write a review"
          >
            <button 
              className="rm-close" 
              onClick={onClose} 
              aria-label="Close"
              disabled={isSubmitting}
            >
              <FaTimes />
            </button>

            <h2 className="rm-title">Write a review</h2>
            <p className="rm-subtitle">Share your experience and help others discover great places</p>
            
            {placeData && (
              <div className="rm-place-info">
                <div className="rm-place-icon">
                  <FaMapMarkerAlt />
                </div>
                <div className="rm-place-details">
                  <h3>{placeData.name}</h3>
                  {placeData.address && <p>{placeData.address}</p>}
                </div>
              </div>
            )}

            <form className="rm-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              {/* Companions */}
              <div className="rm-field">
                <label className="rm-label">
                  <FaUserFriends className="rm-ico" /> 
                  Who did you go with?
                  <span className="optional">(optional)</span>
                </label>
                <input 
                  className="rm-input" 
                  value={companions} 
                  onChange={e => setCompanions(e.target.value)} 
                  placeholder="e.g., Neha and Rohan" 
                  disabled={isSubmitting}
                />
              </div>

              {/* Labels */}
              <div className="rm-field">
                <label className="rm-label">
                  <FaTags className="rm-ico" /> 
                  Labels
                  <span className="optional">(optional)</span>
                </label>
                <div className="rm-chips">
                  {allLabelOptions.map(lbl => (
                    <button 
                      key={lbl} 
                      type="button" 
                      className={`rm-chip ${labels.includes(lbl) ? 'active' : ''}`} 
                      onClick={() => handleToggleLabel(lbl)}
                      disabled={isSubmitting}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="rm-field">
                <label className="rm-label">
                  <FaStickyNote className="rm-ico" /> 
                  Notes
                  <span className="optional">(optional)</span>
                </label>
                <textarea 
                  className="rm-textarea" 
                  rows={4} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Share your thoughts, tips, or memorable moments..." 
                  disabled={isSubmitting}
                />
              </div>

              {/* Favorite dishes */}
              <div className="rm-field">
                <label className="rm-label">
                  <FaUtensils className="rm-ico" /> 
                  Favorite dishes
                  <span className="optional">(optional)</span>
                </label>
                <input 
                  className="rm-input" 
                  value={favoriteDishes} 
                  onChange={e => setFavoriteDishes(e.target.value)} 
                  placeholder="Comma-separated, e.g., Margherita, Tiramisu" 
                  disabled={isSubmitting}
                />
              </div>

              <div className="rm-row">
                {/* Visit date */}
                <div className="rm-field">
                  <label className="rm-label">
                    <FaCalendarAlt className="rm-ico" /> 
                    Visit date
                    <span className="required">*</span>
                  </label>
                  <input 
                    type="date" 
                    className={`rm-input ${fieldErrors.visitDate ? 'error' : ''}`} 
                    value={visitDate} 
                    onChange={e => setVisitDate(e.target.value)} 
                    disabled={isSubmitting}
                  />
                  {fieldErrors.visitDate && (
                    <div className="rm-error">
                      <FaExclamationTriangle />
                      {fieldErrors.visitDate}
                    </div>
                  )}
                </div>

                {/* Rating */}
                <div className="rm-field">
                  <label className="rm-label">
                    <FaStar className="rm-ico" /> 
                    Rating
                    <span className="required">*</span>
                  </label>
                  <div className="rm-stars">
                    {[1,2,3,4,5].map(s => (
                      <button 
                        key={s} 
                        type="button" 
                        className={`rm-star ${rating >= s ? 'filled' : ''}`} 
                        onClick={() => setRating(s)} 
                        aria-label={`Rate ${s} stars`}
                        disabled={isSubmitting}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {fieldErrors.rating && (
                    <div className="rm-error">
                      <FaExclamationTriangle />
                      {fieldErrors.rating}
                    </div>
                  )}
                </div>
              </div>

              {/* Visibility */}
              <div className="rm-field">
                <label className="rm-label">
                  {visibility === 'public' ? <FaEye className="rm-ico" /> : <FaEyeSlash className="rm-ico" />}
                  Visibility
                </label>
                <div className="rm-visibility">
                  <button 
                    type="button"
                    className={`rm-visibility-btn ${visibility === 'friends' ? 'active' : ''}`}
                    onClick={() => setVisibility('friends')}
                    disabled={isSubmitting}
                  >
                    <FaEyeSlash />
                    Friends only
                  </button>
                  <button 
                    type="button"
                    className={`rm-visibility-btn ${visibility === 'public' ? 'active' : ''}`}
                    onClick={() => setVisibility('public')}
                    disabled={isSubmitting}
                  >
                    <FaEye />
                    Public
                  </button>
                </div>
              </div>

              {/* Error display */}
              {submitError && (
                <div className="rm-error-global">
                  <FaExclamationTriangle />
                  <strong>Error:</strong> {submitError}
                </div>
              )}
              
              {/* Actions */}
              <div className="rm-actions">
                <button 
                  type="button"
                  className="rm-btn" 
                  onClick={onClose} 
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="rm-btn primary" 
                  disabled={Object.keys(validationErrors).length > 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="rm-spinner"></div>
                      Saving...
                    </>
                  ) : (
                    'Submit Review'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default ReviewModal; 