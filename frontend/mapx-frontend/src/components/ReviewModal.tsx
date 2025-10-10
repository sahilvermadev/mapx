import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMapMarkerAlt, FaExclamationTriangle, FaPlus } from 'react-icons/fa';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { recommendationsApi, type SaveRecommendationRequest } from '../services/recommendationsApi';
import { useAuth } from '../contexts/AuthContext';
import { useMentions } from '@/hooks/useMentions';
import { insertPlainMention, convertUsernamesToTokens } from '@/utils/mentions';

// Types
export interface ReviewPayload {
  labels?: string[];
  notes?: string;
  specialities?: string;
  rating: number; // 1..5
  priceLevel?: number; // 1..4 (₹ to ₹₹₹₹)
  visibility?: 'friends' | 'public';
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (payload: ReviewPayload) => void;
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

// Constants
const LABEL_OPTIONS = [
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

const RATING_MESSAGES = {
  5: 'Truly exceptional!',
  4: 'Really good!',
  3: 'Worth trying!',
  2: 'Just okay!',
  1: 'Not it!'
} as const;

const PRICE_LABELS = {
  1: '₹',
  2: '₹₹',
  3: '₹₹₹',
} as const;

const PRICE_MESSAGES = {
  1: 'Budget-friendly',
  2: 'Moderate pricing',
  3: 'Higher-end',
} as const;


const getTodayIso = () => new Date().toISOString().slice(0, 10);

// Helper function to get caret position for mentions
const getCaretClientPosition = (textarea: HTMLTextAreaElement): { top: number; left: number } | null => {
  const { selectionStart } = textarea;
  if (selectionStart === null) return null;
  
  const rect = textarea.getBoundingClientRect();
  const div = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  // Copy styles that affect layout/wrapping
  Object.assign(div.style, {
    position: 'absolute',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: style.boxSizing,
    width: style.width,
    padding: style.padding,
    border: style.border,
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing
  });

  // Set text content up to caret
  const before = textarea.value.substring(0, selectionStart);
  const after = textarea.value.substring(selectionStart) || ' ';
  div.textContent = before;

  const span = document.createElement('span');
  span.textContent = after;
  div.appendChild(span);

  document.body.appendChild(div);
  const spanRect = span.getBoundingClientRect();
  const top = rect.top + (spanRect.top - div.getBoundingClientRect().top);
  const left = rect.left + (spanRect.left - div.getBoundingClientRect().left);
  document.body.removeChild(div);

  return { top, left };
};

const ReviewModal: React.FC<ReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  placeData,
  onSuccess,
  onError 
}) => {
  // Form state
  const [labels, setLabels] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [specialities, setSpecialities] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [priceLevel, setPriceLevel] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Mentions
  const { user } = useAuth();
  const mentions = useMentions();
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (rating < 1 || rating > 5) errors.rating = 'Please select a rating';
    if (!placeData?.name) errors.placeName = 'Place name is required';
    return errors;
  }, [rating, placeData?.name]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    return rating >= 1 && rating <= 5 && placeData?.name;
  }, [rating, placeData?.name]);

  // Mention handling
  const updateMentionQuery = useCallback((value: string) => {
    const el = notesRef.current;
    const cursor = el ? el.selectionStart || value.length : value.length;
    const left = value.slice(0, cursor);
    const match = /@([A-Za-z0-9_.-]{0,30})$/.exec(left);
    
    if (match) {
      const query = match[1];
      setShowMentionMenu(true);
      if (el) {
        const pos = getCaretClientPosition(el);
        if (pos) setMentionPosition(pos);
      }
      return query;
    }
    
    setShowMentionMenu(false);
    setMentionPosition(null);
    return null;
  }, []);

  // Event handlers
  const handleToggleLabel = (label: string) => {
    setLabels(prev => 
      prev.includes(label) 
        ? prev.filter(l => l !== label) 
        : [...prev, label]
    );
  };

  const addCustomLabel = () => {
    const value = customLabel.trim();
    if (!value) return;
    
    const normalized = value.replace(/\s+/g, ' ').slice(0, 40);
    const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    const exists = labels.some(l => l.toLowerCase() === capitalized.toLowerCase());
    if (exists) {
      setCustomLabel('');
      return;
    }
    
    setLabels(prev => [...prev, capitalized]);
    setCustomLabel('');
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setFieldErrors({});

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
      const notesTokenized = notes ? convertUsernamesToTokens(notes, mentions.getMapping()) : notes;
      const descriptionCombined = (notesTokenized || ' ').trim() || ' ';
      
      const reviewPayload: ReviewPayload = {
        labels,
        notes: notesTokenized?.trim() || undefined,
        specialities: specialities.trim() || undefined,
        rating,
        priceLevel: priceLevel > 0 ? priceLevel : undefined,
      };

      if (onSubmit) {
        onSubmit(reviewPayload);
      }

      const apiPayload: SaveRecommendationRequest = {
        content_type: 'place',
        title: undefined,
        description: descriptionCombined,
        content_data: {
          specialities: reviewPayload.specialities,
          labels: reviewPayload.labels,
          priceLevel: reviewPayload.priceLevel,
          visit_date: getTodayIso(),
        },
        place_name: placeData.name,
        place_address: placeData.address,
        place_lat: placeData.latitude,
        place_lng: placeData.longitude,
        google_place_id: placeData.google_place_id,
        labels: reviewPayload.labels,
        metadata: {
          specialities: reviewPayload.specialities,
        },
        visit_date: getTodayIso(),
        rating: reviewPayload.rating,
        visibility: 'friends',
      };

      const result = await recommendationsApi.saveRecommendation(apiPayload);
      
      if (onSuccess) {
        onSuccess({
          place_id: result.place_id,
          annotation_id: result.annotation_id
        });
      }

      onClose();
    } catch (error) {
      console.error('Failed to save review:', error);
      
      let errorMessage = 'Failed to save review';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. The server might be processing your request. Please try again.';
        } else if (error.message.includes('Network Error')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setSubmitError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effects
  useEffect(() => {
    if (!isOpen) {
      setLabels([]);
      setNotes('');
      setSpecialities('');
      setRating(0);
      setPriceLevel(0);
      setSubmitError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Render helpers
  const renderLabelButtons = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {LABEL_OPTIONS.map(label => (
        <button
          key={label}
          type="button"
          onClick={() => handleToggleLabel(label)}
          disabled={isSubmitting}
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors border select-none ${
            labels.includes(label)
              ? 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900'
          } ${isSubmitting ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {label}
        </button>
      ))}
      
      {labels.filter(l => !LABEL_OPTIONS.includes(l)).map(label => (
        <button
          key={`custom-${label}`}
          type="button"
          onClick={() => handleToggleLabel(label)}
          disabled={isSubmitting}
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors border select-none ${
            labels.includes(label)
              ? 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900'
          } ${isSubmitting ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {label}
        </button>
      ))}
      
      {showCustomInput ? (
        <div className="inline-flex items-center gap-1">
          <input
            className="px-2.5 py-1 rounded-full text-xs font-medium border-[1.5px] border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] transition-all duration-200"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomLabel();
                setShowCustomInput(false);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowCustomInput(false);
                setCustomLabel('');
              }
            }}
            onBlur={() => {
              if (!customLabel.trim()) {
                setShowCustomInput(false);
              }
            }}
            placeholder="Add label…"
            disabled={isSubmitting}
            autoFocus
          />
          <button
            type="button"
            onClick={() => { addCustomLabel(); setShowCustomInput(false); }}
            disabled={isSubmitting || !customLabel.trim()}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border-[1.5px] bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Add label"
          >
            <FaPlus />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustomInput(true)}
          disabled={isSubmitting}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border-[1.5px] bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Add label"
        >
          <FaPlus />
          <span className="ml-1">Add</span>
        </button>
      )}
    </div>
  );

  const renderMentionMenu = () => {
    if (!showMentionMenu || mentions.suggestions.length === 0) return null;

    return (
      <div 
        className="fixed z-50 w-64 rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg" 
        style={{
          top: (mentionPosition?.top || 0),
          left: (mentionPosition?.left || 0)
        }}
      >
        {mentions.suggestions.map((user: any) => (
          <button
            key={user.id}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
            onClick={() => {
              const el = notesRef.current;
              const cursor = el ? (el.selectionStart || notes.length) : notes.length;
              const username = (user.username || '').toLowerCase() || 
                (user.display_name || user.user_name || '').toLowerCase().replace(/\s+/g, '');
              const { text: newText, newCursor } = insertPlainMention(notes, cursor, username);
              const display = user.display_name || user.user_name || username;
              
              mentions.rememberMapping(username, { id: user.id, displayName: display });
              setNotes(newText);
              setShowMentionMenu(false);
              setMentionPosition(null);
              
              requestAnimationFrame(() => {
                el?.focus();
                el?.setSelectionRange(newCursor, newCursor);
              });
            }}
          >
            {user.profile_picture_url && (
              <img src={user.profile_picture_url} className="h-6 w-6 rounded-full" alt="" />
            )}
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium">{user.display_name || user.user_name}</span>
              {user.username && (
                <span className="text-xs text-gray-500">@{user.username}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 bg-black/40 flex justify-center items-center z-[1000] p-4 backdrop-blur-sm" 
          onMouseDown={onClose} 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-[20px] p-7 w-full max-w-[720px] max-h-[calc(100vh-32px)] overflow-y-auto relative border border-black/8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] font-sans md:p-7 md:rounded-[20px] p-5 w-[calc(100vw-24px)] rounded-2xl sm:p-4 sm:w-[calc(100vw-16px)] sm:rounded-2xl"
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            role="dialog" 
            aria-modal="true" 
            aria-label="Write a review"
          >
            <h2 className="text-[22px] font-semibold text-gray-900 mb-8 tracking-[-0.02em] leading-[1.2] md:text-[22px] text-xl sm:text-lg">Share your take</h2>
            
            {placeData && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 flex items-center gap-3 sm:flex-col sm:text-center sm:gap-2.5 sm:p-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white text-base flex-shrink-0 shadow-[0_4px_12px_rgba(59,130,246,0.2)] sm:w-8 sm:h-8 sm:text-sm">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <h3 className="m-0 text-gray-900 text-base font-semibold leading-[1.3] mb-1">{placeData.name}</h3>
                  {placeData.address && <p className="m-0 text-gray-500 text-sm leading-[1.4]">{placeData.address}</p>}
                </div>
              </div>
            )}

            <form className="flex flex-col gap-5 sm:gap-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              {/* Labels */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Tags
                </label>
                {renderLabelButtons()}
              </div>

              {/* Review Text */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Your review
                </label>
                <textarea 
                  ref={notesRef}
                  className="w-full p-3 rounded-lg border-[1.5px] border-gray-200 bg-white text-gray-900 text-sm font-inherit transition-all duration-200 box-border leading-[1.4] resize-y min-h-[70px] focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] focus:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 placeholder:text-gray-400" 
                  rows={4} 
                  value={notes} 
                  onChange={async e => {
                    const val = e.target.value;
                    setNotes(val);
                    const query = updateMentionQuery(val);
                    if (query !== null) {
                      await mentions.suggest(query, user?.id || '');
                    }
                  }} 
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setShowMentionMenu(false);
                    }
                  }}
                  placeholder="Share your experience... Tag friends with @ to give them a shout" 
                  disabled={isSubmitting}
                />
                {renderMentionMenu()}
              </div>

              {/* Highlights */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Highlights
                </label>
                <input 
                  className="w-full p-3 rounded-lg border-[1.5px] border-gray-200 bg-white text-gray-900 text-sm font-inherit transition-all duration-200 box-border leading-[1.4] focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] focus:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50" 
                  value={specialities} 
                  onChange={e => setSpecialities(e.target.value)} 
                  placeholder="e.g., Margherita pizza, Tiramisu, Live music" 
                  disabled={isSubmitting}
                />
              </div>

              {/* Rating and Price Range - Inline */}
              <div className="!flex !flex-row items-center justify-between gap-8 sm:flex-col sm:items-start sm:gap-4">
                {/* Price Range - First */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Price Range
                  </label>
                  
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map(level => (
                      <div key={level} className="relative group">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`size-8 p-0 transition-colors ${
                            priceLevel === level
                              ? 'bg-green-50 hover:bg-green-100'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setPriceLevel(priceLevel === level ? 0 : level)}
                          disabled={isSubmitting}
                        >
                          <span className={`text-sm font-medium ${
                            priceLevel === level
                              ? 'text-green-700'
                              : 'text-gray-400'
                          }`}>
                            {PRICE_LABELS[level as keyof typeof PRICE_LABELS]}
                          </span>
                        </Button>
                        {/* Hover tooltip */}
                        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none">
                          {PRICE_MESSAGES[level as 1|2|3]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rating - Second */}
                <div className="flex items-center gap-3 -ml-4">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 whitespace-nowrap">
                    Rating
                    <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="flex items-center gap-0">
                    {[1, 2, 3, 4, 5].map(star => (
                      <div key={star} className="relative group">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 p-0 hover:bg-yellow-50 transition-colors"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          disabled={isSubmitting}
                        >
                          <Star
                            className={`size-4 transition-colors ${
                              (hoverRating || rating) >= star 
                                ? 'fill-yellow-400 text-yellow-400' 
                                : 'text-gray-300'
                            }`}
                          />
                        </Button>
                        {/* Hover tooltip */}
                        <div className={`${star >= 4 ? 'right-0 left-auto translate-x-0' : 'left-1/2 -translate-x-1/2'} absolute -bottom-8 transform bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none`}>
                          {RATING_MESSAGES[star as 1|2|3|4|5]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                
                {/* Error display - Below both sections */}
                {fieldErrors.rating && (
                  <div className="mt-3 flex justify-end">
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <FaExclamationTriangle className="size-3" />
                      {fieldErrors.rating}
                    </p>
                  </div>
                )}

              {/* Error display */}
              {submitError && (
                <div className="bg-red-50 border-[1.5px] border-red-200 rounded-xl p-5 my-5 text-red-700 text-[15px] flex items-center gap-3 font-medium">
                  <FaExclamationTriangle />
                  <strong>Error:</strong> {submitError}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex justify-end mt-5 pt-5 border-t border-slate-100">
                <Button 
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="font-semibold"
                >
                  {isSubmitting ? 'Saving…' : 'Submit review'}
                </Button>
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