import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Star, X, Pencil, ArrowLeft, Wand2 } from 'lucide-react';
import ContactReveal from '@/components/ContactReveal';
import { FaPlus } from 'react-icons/fa';
import { getProfilePictureUrl } from '@/config/apiConfig';
import InlineLocationPicker from '@/components/InlineLocationPicker';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getTagInlineStyles } from '@/utils/themeUtils';
import { getReadableTextColor } from '@/utils/color';
import { RATING_MESSAGES, MAX_VISIBLE_LABELS, INPUT_STYLE_PROPS, INPUT_CLASSES, CURATED_LABELS } from '../constants';
import LabelPicker from '@/components/LabelPicker';
import ServiceFeedPost from '@/components/ServiceFeedPost';
import type { FeedPost } from '@/services/socialService';
import { serviceCategoriesApi } from '@/services/serviceCategoriesApi';

interface PreviewStepProps {
  currentUser: { displayName?: string; email?: string; profilePictureUrl?: string; id?: string } | null | undefined;
  placeName?: string;
  placeAddress?: string;
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
  serviceDetails?: Record<string, any>;
  serviceBasics?: {
    category_id?: number | null;
    name?: string;
    city_location?: {
      name: string;
      city_name?: string;
      admin1_name?: string;
      country_code?: string;
      lat?: number;
      lng?: number;
    } | null;
    phone_country_code?: string;
    phone?: string;
    email?: string;
    description?: string;
  } | null;
  serviceCategoryName?: string;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  currentUser,
  placeName,
  placeAddress,
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
  onLocationSelected,
  serviceDetails = {},
  serviceBasics = null,
  serviceCategoryName
}) => {
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
  const [showLabelPicker, setShowLabelPicker] = useState<boolean>(false);
  const [fetchedCategoryName, setFetchedCategoryName] = useState<string | undefined>(serviceCategoryName);
  const placeNameInputRef = useRef<HTMLInputElement>(null);
  const placeAddressInputRef = useRef<HTMLInputElement>(null);
  const highlightsInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Infer service type from service state
  const isService = Boolean(serviceBasics || serviceDetails?.service_category_id);

  // Fetch category name if not provided but category_id exists
  useEffect(() => {
    const fetchCategoryName = async () => {
      if (fetchedCategoryName) return; // Already have category name
      if (!serviceBasics?.category_id) return; // No category ID to fetch
      
      try {
        const categories = await serviceCategoriesApi.getAllCategories();
        const category = categories.find(cat => cat.id === serviceBasics?.category_id);
        if (category) {
          setFetchedCategoryName(category.name);
        }
      } catch (error) {
        console.error('Failed to fetch service category:', error);
      }
    };

    fetchCategoryName();
  }, [serviceBasics?.category_id, fetchedCategoryName]);

  // Build mock FeedPost object for ServiceFeedPost preview
  const mockFeedPost = useMemo<FeedPost | null>(() => {
    if (!isService) return null;

    const categoryName = fetchedCategoryName || serviceCategoryName;
    const serviceTitle = placeName || serviceBasics?.name || 'Service';
    const experienceSummary = serviceDetails?.service_experience || serviceDetails?.experience_summary || editedPreview || '';

    return {
      recommendation_id: 0,
      content_type: 'service',
      title: serviceTitle,
      description: '', // Empty for service posts - experience summary is shown instead
      rating: rating ?? 0,
      labels: labels || [],
      user_id: currentUser?.id || '',
      user_name: currentUser?.displayName || 'You',
      user_picture: currentUser?.profilePictureUrl,
      place_address: placeAddress,
      content_data: {
        service_price_range: serviceDetails?.service_price_range,
        service_exact_price: serviceDetails?.exact_price,
        service_experience: experienceSummary,
        service_experience_summary: experienceSummary,
        service_quote: serviceDetails?.service_quote,
        context_tags: serviceDetails?.context_tags || [],
        contact_info: contact,
        service_address: placeAddress,
      },
      service_price_range: serviceDetails?.service_price_range || null,
      service_exact_price: serviceDetails?.exact_price || null,
      service_experience_summary: experienceSummary,
      service_verbatim_quote: serviceDetails?.service_quote || null,
      service_context_tags: serviceDetails?.context_tags || [],
      service_category_name: categoryName || null,
      service_category_slug: null,
      comments_count: '0',
      likes_count: 0,
      is_liked_by_current_user: false,
      created_at: new Date().toISOString(),
      visibility: 'public',
      metadata: {},
    };
  }, [
    isService,
    fetchedCategoryName,
    serviceCategoryName,
    placeName,
    serviceBasics?.name,
    editedPreview,
    rating,
    labels,
    currentUser?.id,
    currentUser?.displayName,
    currentUser?.profilePictureUrl,
    placeAddress,
    serviceDetails,
    contact,
  ]);

  // Get theme-specific tag styles
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const tagInlineStyles = useMemo(() => getTagInlineStyles(themeName), [themeName]);
  const accentColor = selectedTheme?.accentColor || '#FCD34D';
  const textOnAccent = getReadableTextColor(accentColor);


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

  const getProxiedImageUrl = useCallback((url?: string): string => {
    if (!url) return '';
    return getProfilePictureUrl(url) || url;
  }, []);

  const getRatingMessage = useCallback((rating: number): string => {
    const roundedRating = Math.floor(rating) as keyof typeof RATING_MESSAGES;
    return RATING_MESSAGES[roundedRating] || '';
  }, []);

  // Helper to remove rating message prefix from text
  const removeRatingMessagePrefix = useCallback((text: string): string => {
    if (!text || !text.trim()) return text;
    
    const ratingMessages = Object.values(RATING_MESSAGES);
    const trimmedText = text.trim();
    
    for (const message of ratingMessages) {
      if (trimmedText.startsWith(message.trim())) {
        return trimmedText.substring(message.trim().length).trim().replace(/^[!.,\s]+/, '');
      }
    }
    
    return text;
  }, []);

  // Auto-clean editedPreview if it starts with a rating message
  useEffect(() => {
    if (editedPreview && editedPreview.trim()) {
      const cleaned = removeRatingMessagePrefix(editedPreview);
      if (cleaned !== editedPreview.trim()) {
        onEditedPreviewChange(cleaned);
      }
    }
  }, [editedPreview, removeRatingMessagePrefix, onEditedPreviewChange]);

  // Remove rating message prefix from editedPreview for display
  const cleanedEditedPreview = useMemo(() => {
    return removeRatingMessagePrefix(editedPreview || '');
  }, [editedPreview, removeRatingMessagePrefix]);

  // Helper to get experience summary from service details
  const getExperienceSummary = useCallback((): string => {
    return serviceDetails?.service_experience || serviceDetails?.experience_summary || '';
  }, [serviceDetails]);

  // Validation helpers for post button
  const hasValidRating = useMemo(() => rating && rating > 0, [rating]);
  const hasValidExperienceSummary = useMemo(() => {
    if (!isService) return true;
    // For services, allow either a structured experience summary OR edited preview text
    const structured = getExperienceSummary().trim();
    const previewText = cleanedEditedPreview.trim();
    const isValid = structured.length > 0 || previewText.length > 0;
    
    // Debug logging
    if (!isValid) {
      console.log('[PreviewStep] Experience summary validation failed:', {
        structured: structured,
        structuredLength: structured.length,
        previewText: previewText,
        previewTextLength: previewText.length,
        serviceDetails,
      });
    }
    
    return isValid;
  }, [isService, getExperienceSummary, cleanedEditedPreview, serviceDetails]);
  const isPostButtonEnabled = useMemo(() => {
    const enabled = hasValidRating && hasValidExperienceSummary;
    if (!enabled && isService) {
      console.log('[PreviewStep] Button disabled:', { hasValidRating, hasValidExperienceSummary });
    }
    return enabled;
  }, [hasValidRating, hasValidExperienceSummary, isService]);

  // Button styling based on validation state
  const postButtonStyle = useMemo(() => {
    if (!selectedTheme) {
      return {
        backgroundColor: isPostButtonEnabled ? '#000' : '#666',
        borderColor: '#000000',
        color: '#fff',
        boxShadow: isPostButtonEnabled ? '3px 3px 0 0 #000' : 'none',
      };
    }

    return {
      backgroundColor: isPostButtonEnabled 
        ? accentColor 
        : (selectedTheme.borderColorMuted || selectedTheme.hoverBackground || '#E5E7EB'),
      borderColor: selectedTheme.borderColor || '#000000',
      color: isPostButtonEnabled 
        ? textOnAccent 
        : (selectedTheme.textMuted || '#6B7280'),
      boxShadow: isPostButtonEnabled 
        ? `3px 3px 0 0 ${selectedTheme.borderColor || '#000000'}` 
        : 'none',
    };
  }, [selectedTheme, isPostButtonEnabled, accentColor, textOnAccent]);

  const postButtonAriaLabel = useMemo(() => {
    if (!hasValidRating) return 'Rating required to post';
    if (!hasValidExperienceSummary) return 'Experience summary required to post';
    return 'Post recommendation';
  }, [hasValidRating, hasValidExperienceSummary]);

  const handlePostClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[PreviewStep] Post button clicked', {
      isPostButtonEnabled,
      hasValidRating,
      hasValidExperienceSummary,
      experienceSummary: getExperienceSummary(),
      cleanedEditedPreview: cleanedEditedPreview.trim(),
      serviceDetails,
      isService,
    });
    
    if (!isPostButtonEnabled) {
      console.warn('[PreviewStep] Post button disabled:', {
        hasValidRating,
        hasValidExperienceSummary,
        experienceSummary: getExperienceSummary(),
        cleanedEditedPreview: cleanedEditedPreview.trim(),
      });
      return;
    }
    
    // Save edit if currently editing
    if (isEditingDescription) {
      onSaveEdit();
    }
    
    // Call onApprove to submit
    if (onApprove) {
      try {
        console.log('[PreviewStep] Calling onApprove...');
        await onApprove();
        console.log('[PreviewStep] onApprove completed successfully');
      } catch (error) {
        console.error('[PreviewStep] Error submitting recommendation:', error);
        throw error; // Re-throw so parent can handle it
      }
    } else {
      console.error('[PreviewStep] onApprove is not defined!');
    }
  }, [isPostButtonEnabled, isEditingDescription, onSaveEdit, onApprove, hasValidRating, hasValidExperienceSummary, getExperienceSummary, cleanedEditedPreview, serviceDetails, isService]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-3 md:space-y-6 py-3 md:py-6 px-4 md:px-0"
    >
        {/* Back button - outside preview card */}
        <div className="container mx-auto px-0 md:px-4">
        <div className="flex justify-start -ml-1 md:ml-0 mb-4 md:mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-full flex-shrink-0 hover:bg-opacity-10 touch-manipulation"
            style={selectedTheme ? {
              color: selectedTheme.textPrimary || '#000000',
            } : undefined}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = selectedTheme.textPrimary || '#000000';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = selectedTheme.textPrimary || '#000000';
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>

        {/* Preview post card */}
        <div className="container mx-auto px-0 md:px-4">
        <div className={`lg:max-w-4xl lg:mx-auto`}>
          {isService && mockFeedPost ? (
            <ServiceFeedPost
              post={mockFeedPost}
              currentUserId={currentUser?.id}
              readOnly={true}
              noOuterSpacing={false}
              showRatingSelector={true}
              editableRating={rating}
              onRatingChange={onRatingChange}
            />
          ) : (
        <article className="w-full mb-1.5 md:mb-2 relative">
          <div 
            className="relative p-3 md:p-4 group border transition-all"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              // Use borderColor if borderColorMuted is too similar to cardBackground (for dark themes)
              borderColor: (selectedTheme.borderColorMuted === selectedTheme.cardBackground) 
                ? (selectedTheme.borderColor || 'rgba(0, 0, 0, 0.1)')
                : (selectedTheme.borderColorMuted || 'rgba(0, 0, 0, 0.1)'),
              color: selectedTheme.textPrimary || '#000000',
            } : {
              backgroundColor: '#FFFFFF',
              borderColor: 'rgba(0, 0, 0, 0.1)',
              color: '#000000',
            }}
          >
            <div className="flex items-start gap-2.5 md:gap-3">
              <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <AvatarImage src={getProxiedImageUrl(currentUser?.profilePictureUrl)} alt={currentUser?.displayName || 'You'} />
                <AvatarFallback className="text-xs md:text-sm">{(currentUser?.displayName || 'You').split(' ').map(s => s[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="mb-2.5 md:mb-4">
                  <span className="font-bold text-base md:text-base tracking-tight">{currentUser?.displayName || 'You'}</span>
                  <span className="text-sm md:text-base text-muted-foreground font-medium"> rated </span>
                  {onPlaceNameChange ? (
                    <div className="inline-flex items-center relative group max-w-full">
                      <input
                        ref={placeNameInputRef}
                        type="text"
                        value={placeName || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          onPlaceNameChange?.(e.target.value);
                        }}
                        onFocus={handlePlaceNameInputFocus}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="Place name..."
                        className="inline-block h-auto py-0 px-1 pr-6 md:pr-0 text-base md:text-base font-bold tracking-tight rounded-none cursor-text border-0 focus:ring-0 focus:outline-none focus:border-0 focus-visible:ring-0 focus-visible:border-0 focus-visible:outline-none bg-transparent shadow-none appearance-none w-auto max-w-full"
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
                        className="absolute right-0 top-1/2 -translate-y-1/2 flex-shrink-0 p-1 md:p-0.5 hover:bg-muted rounded transition-colors opacity-60 group-hover:opacity-100 z-20 touch-manipulation"
                        aria-label="Edit place name"
                        tabIndex={-1}
                      >
                        <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <span className="font-bold text-base md:text-base tracking-tight">{placeName || 'a place'}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 md:gap-2.5 text-xs md:text-xs text-muted-foreground mb-3 md:mb-4 font-medium">
                  <MapPin className="h-3.5 w-3.5 md:h-3.5 md:w-3.5 flex-shrink-0" strokeWidth={1.5} />
                  {onLocationSelected ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0 group">
                      <span className="truncate flex-1">{placeAddress || 'No address'}</span>
                      <button
                        type="button"
                        onClick={() => setShowLocationPicker(true)}
                        className="flex-shrink-0 p-1 md:p-0.5 hover:bg-muted rounded transition-colors opacity-60 group-hover:opacity-100 touch-manipulation"
                        aria-label="Change location"
                      >
                        <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3 text-muted-foreground hover:text-foreground" />
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
                        className={`flex-1 text-xs md:text-xs rounded-none min-w-0 cursor-text ${INPUT_CLASSES.base} ${INPUT_CLASSES.transparent}`}
                        style={{ width: '100%', minWidth: '100px', ...INPUT_STYLE_PROPS }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          placeAddressInputRef.current?.focus();
                          const length = placeAddress?.length || 0;
                          placeAddressInputRef.current?.setSelectionRange(length, length);
                        }}
                        className="flex-shrink-0 p-1 md:p-0.5 hover:bg-muted rounded transition-colors opacity-60 hover:opacity-100 touch-manipulation"
                        aria-label="Edit address"
                      >
                        <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate">{placeAddress || 'No address'}</span>
                  )}
                  {isService && (contact?.phone || contact?.email) && (
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
                <div className="flex items-center gap-2.5 md:gap-2 mb-3 md:mb-4">
                  <div className="flex items-center gap-1 md:gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="relative">
                        <button
                          type="button"
                          onClick={() => onRatingChange(n)}
                          onMouseEnter={() => setHoverRating(n)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="focus:outline-none hover:scale-110 transition-transform touch-manipulation p-1 -m-1"
                        >
                          <Star
                            className="h-5 w-5 md:h-3.5 md:w-3.5 transition-colors"
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
                      </div>
                    ))}
                  </div>
                  {(hoverRating || rating) && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {getRatingMessage(hoverRating || rating || 0)}
                    </span>
                  )}
                  {(!rating || rating <= 0) && (
                    <span className="text-xs text-red-500 font-medium">*</span>
                  )}
                </div>

                {/* Description - editable inline */}
                <div className="mb-3 md:mb-5">
                  <div className="relative group">
                    <Textarea
                      ref={descriptionTextareaRef}
                      value={cleanedEditedPreview || ''}
                      onChange={(e) => {
                        const cleaned = removeRatingMessagePrefix(e.target.value);
                        onEditedPreviewChange(cleaned);
                      }}
                      onFocus={() => {
                        if (!isEditingDescription) {
                          onEdit();
                        }
                      }}
                      placeholder="Write your recommendation..."
                      className={`w-full text-sm md:text-sm leading-relaxed resize-none min-h-[100px] md:min-h-[80px] rounded-none font-medium p-0 pb-10 md:pb-8 pr-2 placeholder:text-muted-foreground ${INPUT_CLASSES.base} ${INPUT_CLASSES.transparent}`}
                      style={INPUT_STYLE_PROPS}
                    />
                    {onImproveText && (
                      <button
                        type="button"
                        onClick={onImproveText}
                        disabled={isImprovingText || !editedPreview.trim()}
                        className="absolute bottom-2 md:bottom-0 right-0 flex-shrink-0 p-1 md:p-0.5 hover:bg-muted rounded transition-colors opacity-60 group-hover:opacity-100 z-10 touch-manipulation"
                        title="Improve language and grammar"
                      >
                        <Wand2 className="h-4 w-4 md:h-3 md:w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Highlights Section - Only for places, inline editable */}
                {!isService && onHighlightsChange && (
                  <div className="mb-3 md:mb-5">
                    <div className="flex items-center gap-2 flex-col md:flex-row">
                      {/**
                       * Highlights label uses theme's textPrimary, falling back to textColor,
                       * then to black. This ensures proper contrast in both light and dark themes.
                       */}
                      <span 
                        className="text-sm md:text-sm font-medium min-w-0 flex-shrink-0 w-full md:w-auto"
                        style={{
                          color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000'
                        }}
                      >
                        Highlights:
                      </span>
                      <div className="flex items-center gap-1 flex-1 min-w-0 w-full md:w-auto">
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
                          className={`flex-1 text-sm md:text-sm font-medium p-0 placeholder:text-muted-foreground ${INPUT_CLASSES.base} ${INPUT_CLASSES.transparent}`}
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
                          className="flex-shrink-0 p-1 md:p-0.5 hover:bg-muted rounded transition-colors opacity-60 hover:opacity-100 touch-manipulation"
                          aria-label="Edit highlights"
                        >
                          <Pencil className="h-3.5 w-3.5 md:h-3 md:w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Labels Section - inline editable - Only for places */}
                {!isService && (
                  <div className="mb-3 md:mb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Display existing labels */}
                      {labels.length > 0 && (
                        <>
                          {labels.slice(0, MAX_VISIBLE_LABELS).map((label: string, i: number) => (
                            <span
                              key={`${label}-${i}`}
                              className="inline-flex items-center px-3 md:px-3 py-1.5 md:py-1.5 text-xs font-medium rounded-md cursor-default"
                              style={tagInlineStyles}
                            >
                              {label}
                              {onLabelsChange && (
                                <button
                                  type="button"
                                  onClick={() => removeLabel(label)}
                                  className="ml-1.5 md:ml-1.5 focus:outline-none transition-colors text-sm md:text-xs touch-manipulation p-0.5 -m-0.5"
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
                              className="inline-flex items-center px-3 md:px-3 py-1.5 md:py-1.5 text-xs font-medium rounded-md cursor-default"
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
                        className="inline-flex items-center px-3 md:px-2.5 py-1.5 md:py-1 rounded-full text-xs md:text-xs font-medium transition-all duration-200 border-[1.5px] hover:-translate-y-0.5 touch-manipulation"
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
                <LabelPicker
                  labels={CURATED_LABELS}
                  selectedLabels={labels || []}
                  onLabelsChange={onLabelsChange || (() => {})}
                  variant="modal"
                  isOpen={showLabelPicker}
                  onClose={() => setShowLabelPicker(false)}
                  initiallyExpanded={true}
                />
              </div>
            </div>
          </div>
        </article>
        )}
        </div>
      </div>

        {/* Post button - outside preview card */}
        <div className="container mx-auto px-0 md:px-4">
        <div className="flex items-center justify-center pt-4 md:pt-6">
          <Button
            onClick={handlePostClick}
            disabled={!isPostButtonEnabled}
            aria-label={postButtonAriaLabel}
            size="sm"
            className="h-12 md:h-10 w-full md:w-auto px-6 md:px-6 text-sm md:text-sm font-medium border-[1.5px] rounded-lg md:rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 touch-manipulation"
            style={postButtonStyle}
          >
            Post Recommendation
          </Button>
        </div>
      </div>
      {isEditingDescription && showMentionMenu && mentionMenu}
    </motion.div>
  );
};

export default PreviewStep;
