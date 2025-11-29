import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Star, X, Pencil, ChevronDown, ChevronUp, ArrowLeft, Wand2 } from 'lucide-react';
import ContactReveal from '@/components/ContactReveal';
import { FaPlus } from 'react-icons/fa';
import { getProfilePictureUrl } from '@/config/apiConfig';
import InlineLocationPicker from '@/components/InlineLocationPicker';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getTagInlineStyles, getScrollbarStyles } from '@/utils/themeUtils';
import { RATING_MESSAGES, MAX_VISIBLE_LABELS, MAX_LABEL_LENGTH, INPUT_STYLE_PROPS, INPUT_CLASSES, CURATED_LABELS } from '../constants';

interface PreviewStepProps {
  currentUser: { displayName?: string; email?: string; profilePictureUrl?: string } | null | undefined;
  placeName?: string;
  placeAddress?: string;
  contentType?: 'place' | 'service' | 'tip' | 'contact' | 'unclear' | string;
  contact?: { phone?: string; email?: string } | null;
  isEditingDescription: boolean;
  editedPreview: string;
  onEditedPreviewChange: (v: string) => void;
  showMentionMenu: boolean;
  mentionMenu: React.ReactNode;
  rating: number | null;
  onRatingChange: (n: number) => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onApprove: () => void;
  onBack: () => void;
  onImproveText?: () => Promise<void>;
  isImprovingText?: boolean;
  labels?: string[];
  onLabelsChange?: (labels: string[]) => void;
  highlights?: string;
  onHighlightsChange?: (highlights: string) => void;
  onPlaceNameChange?: (name: string) => void;
  onPlaceAddressChange?: (address: string) => void;
  onLocationSelected?: (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
  }) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  currentUser,
  placeName,
  placeAddress,
  contentType,
  contact,
  isEditingDescription,
  editedPreview,
  onEditedPreviewChange,
  showMentionMenu,
  mentionMenu,
  rating,
  onRatingChange,
  onEdit,
  onSaveEdit,
  onApprove,
  onBack,
  onImproveText,
  isImprovingText = false,
  labels = [],
  onLabelsChange,
  highlights = '',
  onHighlightsChange,
  onPlaceNameChange,
  onPlaceAddressChange,
  onLocationSelected
}) => {
  const [customLabel, setCustomLabel] = useState<string>('');
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [showLabelPicker, setShowLabelPicker] = useState<boolean>(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(CURATED_LABELS)));
  const placeNameInputRef = useRef<HTMLInputElement>(null);
  const placeAddressInputRef = useRef<HTMLInputElement>(null);
  const highlightsInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Get theme-specific tag styles
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const tagInlineStyles = useMemo(() => getTagInlineStyles(themeName), [themeName]);
  
  /**
   * Memoized scrollbar styles based on current theme
   * These CSS variables are inherited by child elements with .label-menu-scrollbar class
   */
  const scrollbarStyles = useMemo(() => 
    getScrollbarStyles(themeName, selectedTheme),
    [themeName, selectedTheme]
  );

  // No special measurement logic — rely on native input size attribute for autosizing

  const handlePlaceNameChange = useCallback((value: string) => {
    if (!onPlaceNameChange) return;
    onPlaceNameChange(value);
  }, [onPlaceNameChange]);

  const handlePlaceNameInputFocus = useCallback(() => {
    if (placeNameInputRef.current) {
      const length = placeName?.length || 0;
      setTimeout(() => {
        placeNameInputRef.current?.setSelectionRange(length, length);
      }, 0);
    }
  }, [placeName]);

  // Label editing functions
  const removeLabel = useCallback((labelToRemove: string) => {
    if (!onLabelsChange) return;
    const newLabels = labels.filter(l => l !== labelToRemove);
    onLabelsChange(newLabels);
  }, [labels, onLabelsChange]);

  const addCustomLabel = useCallback(() => {
    const value = customLabel.trim();
    if (!value || !onLabelsChange) return;
    
    const normalized = value.replace(/\s+/g, ' ').slice(0, MAX_LABEL_LENGTH);
    const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    const exists = labels.some(l => l.toLowerCase() === capitalized.toLowerCase());
    if (exists) {
      setCustomLabel('');
      return;
    }
    
    const newLabels = [...labels, capitalized];
    onLabelsChange(newLabels);
    setCustomLabel('');
  }, [customLabel, labels, onLabelsChange]);

  const toggleLabel = useCallback((label: string) => {
    if (!onLabelsChange) return;
    const normalizedLabel = label.trim();
    const isSelected = labels.some(l => l.toLowerCase() === normalizedLabel.toLowerCase());
    
    if (isSelected) {
      const newLabels = labels.filter(l => l.toLowerCase() !== normalizedLabel.toLowerCase());
      onLabelsChange(newLabels);
    } else {
      const newLabels = [...labels, normalizedLabel];
      onLabelsChange(newLabels);
    }
  }, [labels, onLabelsChange]);

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

  const getProxiedImageUrl = useCallback((url?: string): string => {
    if (!url) return '';
    return getProfilePictureUrl(url) || url;
  }, []);

  const getRatingMessage = useCallback((rating: number): string => {
    const roundedRating = Math.floor(rating) as keyof typeof RATING_MESSAGES;
    return RATING_MESSAGES[roundedRating] || '';
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 md:space-y-6 py-4 md:py-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 md:h-10 md:w-10 p-0 rounded-full text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>

        <article className="w-full pb-4 md:pb-6 mb-4 md:mb-6 relative">
          <div className="relative">
            <div className="flex items-start gap-2 md:gap-3">
              <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <AvatarImage src={getProxiedImageUrl(currentUser?.profilePictureUrl)} alt={currentUser?.displayName || 'You'} />
                <AvatarFallback className="text-xs md:text-sm">{(currentUser?.displayName || 'You').split(' ').map(s => s[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="mb-3 md:mb-4">
                  <span className="font-bold text-sm md:text-base tracking-tight">{currentUser?.displayName || 'You'}</span>
                  <span className="text-sm md:text-base text-muted-foreground font-medium"> rated </span>
                  {onPlaceNameChange ? (
                    <div className="inline-flex items-center relative group max-w-full">
                      <input
                        ref={placeNameInputRef}
                        type="text"
                        value={placeName || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          handlePlaceNameChange(e.target.value);
                        }}
                        onFocus={handlePlaceNameInputFocus}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="Place name..."
                        className="inline-block h-auto py-0 px-1 pr-0 text-sm md:text-base font-bold tracking-tight rounded-none cursor-text border-0 focus:ring-0 focus:outline-none focus:border-0 focus-visible:ring-0 focus-visible:border-0 focus-visible:outline-none bg-transparent shadow-none appearance-none w-auto max-w-full"
                        size={Math.max((placeName || 'Place name...').length + 1, 6)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          pointerEvents: 'auto',
                          zIndex: 10
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          placeNameInputRef.current?.focus();
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors opacity-60 group-hover:opacity-100 z-20"
                        aria-label="Edit place name"
                        tabIndex={-1}
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-bold text-sm md:text-base tracking-tight">{placeName || 'a place'}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 md:gap-2.5 text-[10px] md:text-xs text-muted-foreground mb-4 font-medium">
                  <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" strokeWidth={1.5} />
                  {onLocationSelected ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0 group">
                      <span className="truncate flex-1">{placeAddress || 'No address'}</span>
                      <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors opacity-60 group-hover:opacity-100"
                        aria-label="Change location"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : onPlaceAddressChange ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Input
                        ref={placeAddressInputRef}
                        type="text"
                        value={placeAddress || ''}
                        onChange={(e) => onPlaceAddressChange(e.target.value)}
                        placeholder="Address..."
                        className={`flex-1 text-[10px] md:text-xs rounded-none min-w-0 cursor-text ${INPUT_CLASSES.base} ${INPUT_CLASSES.transparent}`}
                        style={{ width: '100%', minWidth: '100px', ...INPUT_STYLE_PROPS }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          placeAddressInputRef.current?.focus();
                          const length = placeAddress?.length || 0;
                          placeAddressInputRef.current?.setSelectionRange(length, length);
                        }}
                        className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors opacity-60 hover:opacity-100"
                        aria-label="Edit address"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate">{placeAddress || 'No address'}</span>
                  )}
                  {contentType === 'service' && (contact?.phone || contact?.email) && (
                    <ContactReveal
                      contact={contact}
                      className="relative ml-3 flex-shrink-0"
                      buttonClassName="h-5 w-5 md:h-5 md:w-5"
                      iconClassName="h-3 w-3"
                      align="right"
                    />
                  )}
                </div>

                {/* Location Picker Modal */}
                <AnimatePresence>
                  {showLocationPicker && onLocationSelected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                      onClick={() => setShowLocationPicker(false)}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                        style={selectedTheme ? {
                          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                        } : undefined}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 
                            className="text-lg font-semibold"
                            style={{ color: selectedTheme?.textPrimary || '#000000' }}
                          >
                            Change Location
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowLocationPicker(false)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            aria-label="Close"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <InlineLocationPicker
                          onLocationSelected={(location) => {
                            onLocationSelected(location);
                            setShowLocationPicker(false);
                          }}
                          onSkip={() => setShowLocationPicker(false)}
                        />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rating badge - always visible and editable */}
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="relative group">
                        <button
                          type="button"
                          onClick={() => onRatingChange(n)}
                          onMouseEnter={() => setHoverRating(n)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="focus:outline-none hover:scale-110 transition-transform"
                        >
                          <Star
                            className="h-3.5 w-3.5 transition-colors"
                            style={{
                              fill: (hoverRating || rating || 0) >= n
                                ? (selectedTheme?.accentColor || '#FCD34D')
                                : 'transparent',
                              color: (hoverRating || rating || 0) >= n
                                ? (selectedTheme?.accentColor || '#FCD34D')
                                : (selectedTheme?.textMuted || selectedTheme?.textSecondary || '#D1D5DB'),
                            }}
                            strokeWidth={1.5}
                          />
                        </button>
                        {/* Hover tooltip */}
                        <div 
                          className={`${n >= 4 ? 'right-0 left-auto translate-x-0' : 'left-1/2 -translate-x-1/2'} absolute -bottom-8 transform text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none`}
                          style={selectedTheme ? {
                            backgroundColor: selectedTheme.cardBackground || '#1F2937',
                            color: selectedTheme.textPrimary || '#FFFFFF',
                          } : undefined}
                        >
                          {RATING_MESSAGES[n as 1|2|3|4|5]}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(hoverRating || rating) && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {getRatingMessage(hoverRating || rating || 0)}
                    </span>
                  )}
                  {!rating && (
                    <span className="text-xs text-red-500 font-medium">*</span>
                  )}
                </div>

                {/* Description - editable inline */}
                <div className="mb-4 md:mb-5">
                  <div className="relative group">
                    <Textarea
                      ref={descriptionTextareaRef}
                      value={editedPreview || ''}
                      onChange={(e) => onEditedPreviewChange(e.target.value)}
                      onFocus={() => {
                        if (!isEditingDescription) {
                          onEdit();
                        }
                      }}
                      placeholder="Write your recommendation..."
                      className={`w-full text-xs md:text-sm leading-relaxed resize-none min-h-[80px] rounded-none font-medium p-0 pb-8 pr-2 placeholder:text-muted-foreground ${INPUT_CLASSES.base} ${INPUT_CLASSES.transparent}`}
                      style={INPUT_STYLE_PROPS}
                    />
                    {onImproveText && (
                      <button
                        type="button"
                        onClick={onImproveText}
                        disabled={isImprovingText || !editedPreview.trim()}
                        className="absolute bottom-0 right-0 flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors opacity-60 group-hover:opacity-100 z-10"
                        title="Improve language and grammar"
                      >
                        <Wand2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Highlights Section - Only for places, inline editable */}
                {contentType === 'place' && onHighlightsChange && (
                  <div className="mb-4 md:mb-5">
                    <div className="flex items-center gap-2">
                      {/**
                       * Highlights label uses theme's textPrimary, falling back to textColor,
                       * then to black. This ensures proper contrast in both light and dark themes.
                       */}
                      <span 
                        className="text-xs md:text-sm font-medium min-w-0 flex-shrink-0"
                        style={{
                          color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000'
                        }}
                      >
                        Highlights:
                      </span>
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {/**
                         * Highlights input text color follows the same fallback chain as the label
                         * to maintain visual consistency and readability across all themes.
                         */}
                        <Input
                          ref={highlightsInputRef}
                          type="text"
                          value={highlights || ''}
                          onChange={(e) => onHighlightsChange(e.target.value)}
                          placeholder="e.g., Margherita pizza, Tiramisu, Live music"
                          className={`flex-1 text-xs md:text-sm font-medium p-0 placeholder:text-muted-foreground ${INPUT_CLASSES.base} ${INPUT_CLASSES.transparent}`}
                          style={{
                            ...INPUT_STYLE_PROPS,
                            color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            highlightsInputRef.current?.focus();
                            const length = highlights?.length || 0;
                            highlightsInputRef.current?.setSelectionRange(length, length);
                          }}
                          className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors opacity-60 hover:opacity-100"
                          aria-label="Edit highlights"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Labels Section - inline editable - Only for places */}
                {contentType === 'place' && (
                  <div className="mb-4 md:mb-5">
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
                              {onLabelsChange && (
                                <button
                                  type="button"
                                  onClick={() => removeLabel(label)}
                                  className="ml-1 md:ml-1.5 focus:outline-none transition-colors text-xs"
                                  style={selectedTheme ? {
                                    color: selectedTheme.accentColor || '#D97706',
                                  } : undefined}
                                  onMouseEnter={(e) => {
                                    if (selectedTheme) {
                                      e.currentTarget.style.color = selectedTheme.accentColor || '#92400E';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (selectedTheme) {
                                      e.currentTarget.style.color = selectedTheme.accentColor || '#D97706';
                                    }
                                  }}
                                  aria-label={`Remove ${label} label`}
                                >
                                  ×
                                </button>
                              )}
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
                        onClick={() => setShowLabelPicker(true)}
                        className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium transition-all duration-200 border-[1.5px] hover:-translate-y-0.5"
                        style={selectedTheme ? {
                          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                          color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                          borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || '#E5E7EB',
                        } : undefined}
                        onMouseEnter={(e) => {
                          if (selectedTheme) {
                            e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || '#F9FAFB';
                            e.currentTarget.style.borderColor = selectedTheme.borderColor || '#D1D5DB';
                            e.currentTarget.style.color = selectedTheme.textPrimary || '#111827';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTheme) {
                            e.currentTarget.style.backgroundColor = selectedTheme.cardBackground || '#FFFFFF';
                            e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || selectedTheme.borderColor || '#E5E7EB';
                            e.currentTarget.style.color = selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280';
                          }
                        }}
                        aria-label="Add label"
                      >
                        <FaPlus />
                        <span className="ml-1">Add label</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Label Picker Modal */}
                <AnimatePresence>
                  {showLabelPicker && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                      onClick={() => {
                        setShowLabelPicker(false);
                      }}
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg shadow-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
                        style={selectedTheme ? {
                          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                          ...scrollbarStyles,
                        } : undefined}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 
                            className="text-lg font-semibold"
                            style={{ color: selectedTheme?.textPrimary || '#000000' }}
                          >
                            Select Labels
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setShowLabelPicker(false);
                            }}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            aria-label="Close"
                            style={{
                              color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
                            }}
                          >
                            <X className="h-5 w-5" style={{ color: 'inherit' }} />
                          </button>
                        </div>

                        {/* Labels by Category */}
                        <div className="flex-1 overflow-y-auto space-y-4 label-menu-scrollbar">
                          {Object.entries(CURATED_LABELS).map(([category, labelList]) => (
                            <div key={category} className="space-y-2">
                              {/**
                               * Category headers use a fallback chain: textSecondary -> textMuted -> textColor -> gray.
                               * On hover, they switch to textPrimary for better visibility.
                               * This provides clear visual hierarchy while maintaining theme consistency.
                               */}
                              <button
                                type="button"
                                onClick={() => toggleCategory(category)}
                                className="flex items-center gap-2 w-full text-left font-semibold text-sm transition-colors"
                                style={{
                                  color: selectedTheme?.textSecondary || selectedTheme?.textMuted || selectedTheme?.textColor || '#6B7280',
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedTheme) {
                                    e.currentTarget.style.color = selectedTheme.textPrimary || selectedTheme.textColor || '#000000';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedTheme) {
                                    e.currentTarget.style.color = selectedTheme.textSecondary || selectedTheme.textMuted || selectedTheme.textColor || '#6B7280';
                                  }
                                }}
                              >
                                {expandedCategories.has(category) ? (
                                  <ChevronDown className="h-4 w-4" style={{ color: 'inherit' }} />
                                ) : (
                                  <ChevronUp className="h-4 w-4" style={{ color: 'inherit' }} />
                                )}
                                <span style={{ color: 'inherit' }}>{category}</span>
                              </button>
                              {expandedCategories.has(category) && (
                                <div className="flex flex-wrap gap-2 pl-6">
                                  {labelList.map((label: string) => {
                                    const isSelected = labels.some(l => l.toLowerCase() === label.toLowerCase());
                                    return (
                                      <button
                                        key={label}
                                        type="button"
                                        onClick={() => toggleLabel(label)}
                                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all border select-none hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                                        style={selectedTheme ? isSelected ? {
                                          backgroundColor: selectedTheme.selectedBackground || selectedTheme.hoverBackground || 'rgba(251, 191, 36, 0.1)',
                                          color: selectedTheme.accentColor || selectedTheme.textPrimary || '#92400E',
                                          borderColor: selectedTheme.accentColor + '40' || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.3)',
                                          boxShadow: `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                                        } : {
                                          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                                          color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                                          borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)',
                                        } : undefined}
                                        onMouseEnter={(e) => {
                                          if (selectedTheme && !isSelected) {
                                            e.currentTarget.style.borderColor = selectedTheme.borderColor || 'rgba(0, 0, 0, 0.3)';
                                            e.currentTarget.style.boxShadow = `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`;
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (selectedTheme && !isSelected) {
                                            e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)';
                                            e.currentTarget.style.boxShadow = 'none';
                                          }
                                        }}
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Custom Label Input */}
                        {/**
                         * Border separator uses borderColorMuted (subtle) as primary choice,
                         * falling back to borderColor, then to a light gray.
                         * This maintains visual separation without being too prominent.
                         */}
                        <div 
                          className="mt-4 pt-4 border-t flex items-center gap-2"
                          style={{
                            borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          {/**
                           * Custom label input uses theme's inputBackground if available,
                           * otherwise falls back to cardBackground or transparent.
                           * Text color follows the standard fallback: textPrimary -> textColor -> black.
                           */}
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
                            className="flex-1 text-sm shadow-none border-0 focus:ring-0 focus:outline-none focus:border-0 appearance-none"
                            style={{
                              backgroundColor: selectedTheme?.inputBackground || selectedTheme?.cardBackground || 'transparent',
                              color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
                            }}
                          />
                          <Button
                            type="button"
                            onClick={addCustomLabel}
                            disabled={!customLabel.trim()}
                            size="sm"
                            className="px-3"
                            style={selectedTheme ? {
                              backgroundColor: selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000',
                              color: selectedTheme.buttonPrimary?.text || selectedTheme.textColor || '#FFFFFF',
                            } : undefined}
                            onMouseEnter={(e) => {
                              if (selectedTheme && customLabel.trim()) {
                                e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.hover || selectedTheme.accentColor || '#000000';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedTheme && customLabel.trim()) {
                                e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000';
                              }
                            }}
                          >
                            <FaPlus className="h-3 w-3" style={{ color: 'inherit' }} />
                          </Button>
                        </div>

                        {/* Done Button */}
                        <div 
                          className="mt-4 pt-4 border-t flex justify-end"
                          style={{
                            borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <Button
                            type="button"
                            onClick={() => setShowLabelPicker(false)}
                            className="px-6"
                            style={selectedTheme ? {
                              backgroundColor: selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000',
                              color: selectedTheme.buttonPrimary?.text || selectedTheme.textColor || '#FFFFFF',
                            } : undefined}
                            onMouseEnter={(e) => {
                              if (selectedTheme) {
                                e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.hover || selectedTheme.accentColor || '#000000';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedTheme) {
                                e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000';
                              }
                            }}
                          >
                            Done
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </article>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 pt-3 mt-6">
          <Button
            onClick={() => {
              if (!rating) return;
              if (isEditingDescription) {
                onSaveEdit();
              }
              onApprove();
            }}
            disabled={!rating}
            aria-label={rating ? 'Post recommendation' : 'Rating required to post'}
            size="sm"
            className="h-9 md:h-10 px-4 md:px-6 text-xs md:text-sm font-medium border-[1.5px] border-black rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            style={{ 
              backgroundColor: rating ? '#000' : '#666',
              color: '#fff',
              boxShadow: rating ? '3px 3px 0 0 #000' : 'none'
            }}
          >
            Post Recommendation
          </Button>
        </div>
        {isEditingDescription && showMentionMenu && mentionMenu}
      </div>
    </motion.div>
  );
};

export default PreviewStep;
