import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { FaMapMarkerAlt, FaExclamationTriangle, FaPlus } from 'react-icons/fa';
import { Star, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { recommendationsApi, type SaveRecommendationRequest } from '../services/recommendationsApiService';
import { useAuth } from '../auth';
import { useMentions } from '@/hooks/useMentions';
import { insertPlainMention, convertUsernamesToTokens } from '@/utils/mentions';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { CURATED_LABELS, MAX_VISIBLE_LABELS, MAX_LABEL_LENGTH } from '@/components/composer/constants';
import { getTagInlineStyles } from '@/utils/themeUtils';

// Types
export interface ReviewPayload {
  labels?: string[];
  notes?: string;
  highlights?: string;
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

// Constants - Using CURATED_LABELS from composer constants

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
  const [highlights, setHighlights] = useState<string>('');
  const [rating, setRating] = useState<number>(0);
  const [priceLevel, setPriceLevel] = useState<number>(0);
  const [showLabelPicker, setShowLabelPicker] = useState<boolean>(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(CURATED_LABELS)));
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [labelSearch, setLabelSearch] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Mobile detection - initialize immediately
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Mentions
  const { user } = useAuth();
  const mentions = useMentions();
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  
  // Theme support
  const { theme } = useTheme();
  const selectedTheme = THEMES[theme];
  const accentColor = selectedTheme.accentColor;
  const textOnAccent = getReadableTextColor(accentColor);
  const tagInlineStyles = useMemo(() => getTagInlineStyles(theme), [theme]);

  const filteredLabelEntries = useMemo(() => {
    const query = labelSearch.trim().toLowerCase();
    if (!query) {
      return Object.entries(CURATED_LABELS);
    }

    return Object.entries(CURATED_LABELS)
      .map(([category, labelList]) => {
        const filtered = labelList.filter(label =>
          label.toLowerCase().includes(query)
        );
        return [category, filtered] as [string, string[]];
      })
      .filter(([, labels]) => labels.length > 0);
  }, [labelSearch]);

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
  const removeLabel = useCallback((labelToRemove: string) => {
    const newLabels = labels.filter(l => l !== labelToRemove);
    setLabels(newLabels);
  }, [labels]);

  const addCustomLabel = useCallback(() => {
    const value = customLabel.trim();
    if (!value) return;
    
    const normalized = value.replace(/\s+/g, ' ').slice(0, MAX_LABEL_LENGTH);
    const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    const exists = labels.some(l => l.toLowerCase() === capitalized.toLowerCase());
    if (exists) {
      setCustomLabel('');
      return;
    }
    
    setLabels(prev => [...prev, capitalized]);
    setCustomLabel('');
  }, [customLabel, labels]);

  const toggleLabel = useCallback((label: string) => {
    const normalizedLabel = label.trim();
    const isSelected = labels.some(l => l.toLowerCase() === normalizedLabel.toLowerCase());
    
    if (isSelected) {
      const newLabels = labels.filter(l => l.toLowerCase() !== normalizedLabel.toLowerCase());
      setLabels(newLabels);
    } else {
      const newLabels = [...labels, normalizedLabel];
      setLabels(newLabels);
    }
  }, [labels]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const handleOpenLabelPicker = useCallback(() => {
    setShowLabelPicker(true);
    setLabelSearch('');
    setCustomLabel('');
    setExpandedCategories(new Set(Object.keys(CURATED_LABELS)));
  }, []);

  const handleCloseLabelPicker = useCallback(() => {
    setShowLabelPicker(false);
    setLabelSearch('');
    setCustomLabel('');
    setExpandedCategories(new Set(Object.keys(CURATED_LABELS)));
  }, []);

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
        highlights: highlights.trim() || undefined,
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
          highlights: reviewPayload.highlights,
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
          highlights: reviewPayload.highlights,
        },
        visit_date: getTodayIso(),
        rating: reviewPayload.rating,
        visibility: 'friends',
      };

      const result = await recommendationsApi.saveRecommendation(apiPayload);
      
      if (onSuccess) {
        onSuccess({
          place_id: result.place_id,
          annotation_id: result.recommendation_id
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

  // Check if mobile device
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    
    handleChange(mediaQuery);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Drag handlers for mobile swipe-to-close
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  
  const handleDragEnd = useCallback((event: any, info: any) => {
    if (isMobile && info.offset.y > 100) {
      onClose();
    } else {
      y.set(0);
    }
  }, [isMobile, onClose, y]);

  // Prevent body scroll on mobile when modal is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, isMobile]);

  // Effects
  useEffect(() => {
    if (!isOpen) {
      setLabels([]);
      setNotes('');
      setHighlights('');
      setRating(0);
      setPriceLevel(0);
      setSubmitError(null);
      setFieldErrors({});
      setShowLabelPicker(false);
      setCustomLabel('');
      setExpandedCategories(new Set(Object.keys(CURATED_LABELS)));
      setLabelSearch('');
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
      {/* Display existing labels */}
      {labels.length > 0 && (
        <>
          {labels.slice(0, MAX_VISIBLE_LABELS).map((label: string, i: number) => (
            <span
              key={`${label}-${i}`}
              className="inline-flex items-center px-2.5 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md cursor-default"
              style={tagInlineStyles}
            >
              {label}
              <button
                type="button"
                onClick={() => removeLabel(label)}
                className="ml-1 md:ml-1.5 text-yellow-600 hover:text-yellow-800 focus:outline-none transition-colors text-xs"
                aria-label={`Remove ${label} label`}
                disabled={isSubmitting}
              >
                ×
              </button>
            </span>
          ))}
          {labels.length > MAX_VISIBLE_LABELS && (
            <span 
              className="inline-flex items-center px-2.5 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md cursor-default"
              style={tagInlineStyles}
            >
              +{labels.length - MAX_VISIBLE_LABELS} more
            </span>
          )}
        </>
      )}
      {/* Add label button */}
      <button
        type="button"
        onClick={handleOpenLabelPicker}
        disabled={isSubmitting}
        className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium transition-all duration-200 border-[1.5px] bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Add label"
      >
        <FaPlus />
        <span className="ml-1">Add label</span>
      </button>
    </div>
  );

  const renderMentionMenu = () => {
    if (!showMentionMenu || mentions.suggestions.length === 0) return null;

    return (
      <div 
        className="fixed z-50 w-64 rounded-md border-2 border-black bg-white text-gray-900 shadow-[4px_4px_0_0_#000]" 
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
        <>
          {/* Backdrop overlay */}
          <motion.div 
            className="fixed inset-0 bg-black/50 z-[1000] md:bg-black/40 backdrop-blur-sm" 
            onClick={onClose}
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
          />
          
          {/* Modal Content */}
          <motion.div
            className="
              fixed bg-white z-[1001] overflow-y-auto font-sans
              inset-x-0 bottom-0 rounded-t-2xl border-t-2 border-black shadow-[0_-8px_0_0_#000] max-h-[90vh]
              md:inset-x-auto md:inset-y-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:bottom-auto md:w-full md:max-w-[720px] md:rounded-lg md:rounded-t-none md:border-t-0 md:border-2 md:shadow-[8px_8px_0_0_#000] md:max-h-[calc(100vh-32px)]
            "
            onMouseDown={(e) => e.stopPropagation()}
            initial={isMobile ? { y: '100%' } : { y: 40, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { y: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%' } : { y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            drag={isMobile ? 'y' : false}
            dragConstraints={isMobile ? { top: 0 } : {}}
            dragElastic={isMobile ? 0.2 : 0}
            onDragEnd={handleDragEnd}
            style={isMobile ? { y, opacity } : {}}
            role="dialog" 
            aria-modal="true" 
            aria-label="Write a review"
          >
            {/* Drag handle for mobile */}
            <div 
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none md:hidden"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Close button - visible on mobile */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 md:top-6 md:right-6 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border-0 z-10 flex items-center justify-center transition-all"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-4 md:p-7">
              <h2 className="text-xl md:text-[22px] font-semibold text-gray-900 mb-6 md:mb-8 tracking-[-0.02em] leading-[1.2] pr-12">Share your take</h2>
            
            {placeData && (
              <div className="bg-slate-50 border border-black/20 rounded-md p-4 mb-5 flex items-center gap-3 shadow-sm sm:flex-col sm:text-center sm:gap-2.5 sm:p-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-md border border-black/20 flex items-center justify-center text-white text-base flex-shrink-0 shadow-[2px_2px_0_0_#000] sm:w-8 sm:h-8 sm:text-sm">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <h3 className="m-0 text-gray-900 text-base font-semibold leading-[1.3] mb-1">{placeData.name}</h3>
                  {placeData.address && <p className="m-0 text-gray-500 text-sm leading-[1.4]">{placeData.address}</p>}
                </div>
              </div>
            )}

            <form className="flex flex-col gap-4 md:gap-5" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              {/* Review Text */}
              <div className="flex flex-col gap-2 relative">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Your review
                </label>
                <textarea 
                  ref={notesRef}
                  className="w-full p-3 rounded-md border border-black/20 bg-white text-gray-900 text-sm font-inherit transition-all duration-200 box-border leading-[1.4] resize-y min-h-[70px] focus:outline-none focus:border-black focus:shadow-[2px_2px_0_0_#000] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 placeholder:text-gray-400" 
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
                  className="w-full p-3 rounded-md border border-black/20 bg-white text-gray-900 text-sm font-inherit transition-all duration-200 box-border leading-[1.4] focus:outline-none focus:border-black focus:shadow-[2px_2px_0_0_#000] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50" 
                  value={highlights} 
                  onChange={e => setHighlights(e.target.value)} 
                  placeholder="e.g., Margherita pizza, Tiramisu, Live music" 
                  disabled={isSubmitting}
                />
              </div>

              {/* Labels */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Labels
                </label>
                {renderLabelButtons()}
              </div>

              {/* Label Picker Panel */}
              <AnimatePresence initial={false}>
                {showLabelPicker && (
                  <motion.div
                    key="label-picker"
                    initial={{ opacity: 0, y: -12, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <motion.div
                      layout
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="rounded-md border border-black/20 bg-white shadow-sm"
                    >
                      {/* Header */}
                      <motion.div
                        layout="position"
                        className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-white p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <motion.h3
                          layout="position"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: 0.05 }}
                          className="text-sm font-semibold text-gray-900"
                        >
                          Select Labels
                        </motion.h3>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                          <Input
                            value={labelSearch}
                            onChange={(e) => setLabelSearch(e.target.value)}
                            placeholder="Search labels..."
                            className="h-8 w-full md:w-56"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCloseLabelPicker}
                            className="h-8 w-full md:w-8 md:p-0"
                            aria-label="Close label picker"
                          >
                            <span className="md:hidden">Done</span>
                            <span className="hidden md:inline">
                              <X className="h-4 w-4" />
                            </span>
                          </Button>
                        </div>
                      </motion.div>

                      {/* Selected labels summary */}
                      <AnimatePresence>
                        {labels.length > 0 && (
                          <motion.div
                            key="selected-labels"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="border-b border-dashed border-black/10 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {labels.map((label, i) => (
                                <motion.span
                                  key={`${label}-${i}`}
                                  layout
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md"
                                  style={tagInlineStyles}
                                >
                                  {label}
                                  <button
                                    type="button"
                                    onClick={() => removeLabel(label)}
                                    className="ml-1 text-yellow-600 hover:text-yellow-800 text-xs"
                                    aria-label={`Remove ${label}`}
                                  >
                                    ×
                                  </button>
                                </motion.span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Categories */}
                      <div className="max-h-[45vh] overflow-y-auto p-3 space-y-4">
                        {filteredLabelEntries.length > 0 ? (
                          filteredLabelEntries.map(([category, labelList]) => (
                            <motion.div key={category} layout className="space-y-2">
                              <button
                                type="button"
                                onClick={() => toggleCategory(category)}
                                className="flex items-center gap-2 w-full text-left font-semibold text-sm text-foreground hover:text-foreground/80 transition-colors"
                              >
                                {expandedCategories.has(category) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronUp className="h-4 w-4" />
                                )}
                                <span>{category}</span>
                              </button>
                              <AnimatePresence initial={false}>
                                {expandedCategories.has(category) && (
                                  <motion.div
                                    key={`${category}-labels`}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="flex flex-wrap gap-2 pl-6"
                                  >
                                    {labelList.map((label: string) => {
                                      const isSelected = labels.some(
                                        l => l.toLowerCase() === label.toLowerCase()
                                      );
                                      return (
                                        <motion.button
                                          key={label}
                                          type="button"
                                          whileTap={{ scale: 0.96 }}
                                          onClick={() => toggleLabel(label)}
                                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all border select-none ${
                                            isSelected
                                              ? 'bg-yellow-50 text-yellow-800 border-black/30 shadow-[1px_1px_0_0_#000]'
                                              : 'bg-white text-gray-600 border-black/20 hover:border-black/30 hover:shadow-[1px_1px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none'
                                          }`}
                                        >
                                          {label}
                                        </motion.button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ))
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-md border border-dashed border-black/10 bg-gray-50 p-4 text-sm text-gray-500 text-center"
                          >
                            No labels found. Try a different search.
                          </motion.div>
                        )}
                      </div>

                      {/* Footer */}
                      <motion.div
                        layout="position"
                        className="sticky bottom-0 flex flex-col gap-3 border-t bg-white p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={customLabel}
                            onChange={(e) => setCustomLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addCustomLabel();
                              }
                            }}
                            placeholder="Add custom label..."
                            className="h-8 w-full md:w-56"
                          />
                          <Button
                            type="button"
                            onClick={addCustomLabel}
                            disabled={!customLabel.trim()}
                            size="sm"
                            className="px-3"
                          >
                            <FaPlus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex justify-end md:justify-start">
                          <Button
                            type="button"
                            onClick={handleCloseLabelPicker}
                            className="px-6"
                          >
                            Done
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Rating and Price Range - Inline */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8">
                {/* Price Range - First */}
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
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
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                    Rating
                    <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="flex items-center gap-0 flex-shrink-0">
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
                <div className="bg-red-50 border-2 border-red-300 rounded-md p-5 my-5 text-red-700 text-[15px] flex items-center gap-3 font-medium shadow-[2px_2px_0_0_#ef4444]">
                  <FaExclamationTriangle />
                  <strong>Error:</strong> {submitError}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex justify-end mt-5 pt-5 border-t-2 border-black/20">
                <Button 
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full md:w-auto font-semibold rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                  style={{ backgroundColor: accentColor, borderColor: '#000', color: textOnAccent }}
                >
                  {isSubmitting ? 'Saving…' : 'Submit review'}
                </Button>
              </div>
            </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default ReviewModal;