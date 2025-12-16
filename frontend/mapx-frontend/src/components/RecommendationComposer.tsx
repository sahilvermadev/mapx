import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { insertPlainMention } from '@/utils/mentions';
import { useRecommendationComposer, type ExtractedData, type QuestionMetadata } from '@/hooks/useRecommendationComposer';
import { useMentionHandler } from '@/hooks/useMentionHandler';
import PreviewStep from '@/components/composer/steps/PreviewStep';
import ContentTypeSelectionStep from '@/components/composer/steps/ContentTypeSelectionStep';
import ServiceBasicsStep from '@/components/composer/steps/ServiceBasicsStep';
import MapStep from '@/components/composer/steps/MapStep';
import MentionMenu from '@/components/MentionMenu';
import ServiceDetailsForm, { type ServiceDetailsFormData } from '@/components/ServiceDetailsForm';
import {
  CELEBRATION_DELAY_MS,
  CELEBRATION_SHAPES_COUNT,
  CELEBRATION_SHAPE_RADIUS,
  CELEBRATION_SHAPE_SIZE_MIN,
  CELEBRATION_SHAPE_SIZE_MAX,
  CELEBRATION_SHAPE_COLORS,
  SUCCESS_MESSAGES,
} from './composer/constants';

interface RecommendationComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  currentUserId: string;
  questionContext?: string;
  questionId?: number;
  questionMetadata?: QuestionMetadata;
}

interface LocationData {
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_place_id?: string;
  city_name?: string;
  admin1_name?: string;
  country_code?: string;
}

interface MentionUser {
  id: string;
  username?: string;
  display_name?: string;
  user_name?: string;
}

const RecommendationComposer: React.FC<RecommendationComposerProps> = ({
  isOpen,
  onPostCreated,
  currentUserId,
  questionContext,
  questionId,
  questionMetadata
}) => {
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { user: currentUser } = useAuth();
  
  // Celebration animation state
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Theme support
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);
  const borderColor = selectedTheme?.borderColor || '#000000';
  const backgroundColor = selectedTheme?.backgroundColor || '#FFFFFF';
  const cardBackground = selectedTheme?.cardBackground || '#FFFFFF';
  
  // Use the custom hooks for state management
  const composer = useRecommendationComposer(currentUserId, questionId, questionMetadata);
  const mentionHandler = useMentionHandler(currentUserId);

  // Extract stable functions and values to avoid dependency issues
  const { 
    reset, 
    initializeWithQuestion, 
    location: composerLocation,
    improveText,
    isImprovingText,
    serviceDetails,
    setServiceDetails,
    handleContentTypeSelect,
    handleServiceBasicsSubmit,
    serviceBasics,
  } = composer;

  // Memoize celebration shapes to prevent re-generation on each render
  const celebrationShapes = useMemo(() => {
    return Array.from({ length: CELEBRATION_SHAPES_COUNT }, (_, i) => {
      const angle = (i * 360) / CELEBRATION_SHAPES_COUNT;
      const x = Math.cos((angle * Math.PI) / 180) * CELEBRATION_SHAPE_RADIUS;
      const y = Math.sin((angle * Math.PI) / 180) * CELEBRATION_SHAPE_RADIUS;
      const size = CELEBRATION_SHAPE_SIZE_MIN + (i % (CELEBRATION_SHAPE_SIZE_MAX - CELEBRATION_SHAPE_SIZE_MIN));
      const colors = [accentColor, ...CELEBRATION_SHAPE_COLORS];
      const shapeColor = colors[i % colors.length];
      
      return { x, y, size, shapeColor, angle, delay: 0.3 + i * 0.05 };
    });
  }, [accentColor]);

  // Container style: no card on mobile for map-selection, no card for preview step
  const stepContainerClassName = useMemo(() => {
    if (composer.currentStep === 'map-selection') {
      return 'w-full max-w-4xl sm:rounded-lg sm:border-2 p-0 sm:p-3 md:p-4 md:p-6 lg:p-8';
    }
    if (composer.currentStep === 'preview') {
      return 'w-full max-w-4xl p-0';
    }
    return 'w-full max-w-4xl rounded-lg border-2 p-3 sm:p-4 md:p-6 lg:p-8';
  }, [composer.currentStep]);
  
  const stepContainerStyle = useMemo(() => {
    if (composer.currentStep === 'map-selection') {
      // Transparent background on mobile, card styling on desktop via CSS classes
      return undefined;
    }
    if (composer.currentStep === 'preview') {
      // No border/background for preview step - buttons should be outside
      return undefined;
    }
    return selectedTheme ? {
      backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
      borderColor: selectedTheme.borderColor || '#000000',
      boxShadow: `6px 6px 0 0 ${selectedTheme.borderColor || '#000000'}`,
    } : {
      backgroundColor: '#FFFFFF',
      borderColor: '#000000',
      boxShadow: '6px 6px 0 0 #000000',
    };
  }, [composer.currentStep, selectedTheme]);

  // Initialize component when opened
  useEffect(() => {
    if (!isOpen) return;
    
    // Check for question context from props or location.state
    const contextToUse = questionContext || composerLocation.state?.questionContext;
    
    // If we're answering a question, wait for metadata if it's not available yet
    if (questionId && contextToUse && questionMetadata === undefined) {
      // Metadata is being fetched - don't initialize yet, let the metadata effect handle it
      return;
    }
    
    // If we have question metadata with a detected category, go directly to the right flow
    const hasDetectedCategory = questionMetadata?.detected_category && 
                                 questionMetadata.detected_category.content_type !== 'unclear';
    
    if (hasDetectedCategory && contextToUse) {
      // Reset state but keep the step (already initialized correctly)
      reset(true);
      setShowCelebration(false);
      initializeWithQuestion(contextToUse);
    } else if (contextToUse) {
      // We have question context but no metadata (or unclear category)
      reset();
      setShowCelebration(false);
      initializeWithQuestion(contextToUse);
    } else {
      // No question context - start fresh
      reset();
      setShowCelebration(false);
      composer.setCurrentStep('content-type-selection');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, questionContext, questionId, questionMetadata]);

  // Re-initialize when questionMetadata becomes available (handles race condition)
  useEffect(() => {
    if (!isOpen || !questionId || !questionMetadata) return;
    
    const contextToUse = questionContext || composerLocation.state?.questionContext;
    if (!contextToUse) return;
    
    const detectedCategory = questionMetadata.detected_category;
    
    // If we have a detected category that's not unclear, route to the correct flow
    if (detectedCategory && detectedCategory.content_type !== 'unclear') {
      const expectedStep = detectedCategory.content_type === 'service' ? 'service-basics' : 'map-selection';
      
      // Check if we need to re-route (metadata arrived after initial render)
      const needsReRoute = 
        composer.currentStep === 'content-type-selection' ||
        composer.currentStep !== expectedStep ||
        composer.explicitContentType !== detectedCategory.content_type;
      
      if (needsReRoute) {
        reset(true);
        initializeWithQuestion(contextToUse);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionMetadata, isOpen, questionId, questionContext]);

  // Fetch mention suggestions with proper cleanup
  useEffect(() => {
    let isMounted = true;
    
    const fetchMentions = async () => {
      if (!mentionHandler.mentionQuery || mentionHandler.mentionQuery.length < 1) {
        if (isMounted) {
          // Clear suggestions when there's no query
          mentionHandler.fetchSuggestions('');
        }
        return;
      }
      
      if (isMounted) {
        await mentionHandler.fetchSuggestions(mentionHandler.mentionQuery);
      }
    };
    
    fetchMentions();
    
    return () => {
      isMounted = false;
    };
  }, [mentionHandler.mentionQuery, mentionHandler.fetchSuggestions]);

  // Helper function to update both extractedData and fieldResponses
  const updateLocationData = useCallback((location: LocationData) => {
    const locationUpdate = {
      name: location.name,
      location_name: location.name,
      title: location.name,
      location: location.address,
      location_address: location.address,
      location_lat: location.lat,
      location_lng: location.lng,
      place_lat: location.lat,
      place_lng: location.lng,
      google_place_id: location.google_place_id,
      location_google_place_id: location.google_place_id,
      city_name: location.city_name,
      admin1_name: location.admin1_name,
      country_code: location.country_code,
    };

    composer.setExtractedData((prev: ExtractedData) => ({
      ...prev,
      ...locationUpdate,
    }));

    composer.setFieldResponses((prev: Record<string, any>) => ({
      ...prev,
      ...locationUpdate,
    }));
  }, [composer]);

  // Handle place name/address changes for preview step
  const handlePlaceNameChange = useCallback((name: string) => {
    const trimmedName = name.trim() || undefined;
    const nameUpdate = {
      name: trimmedName,
      location_name: trimmedName,
      title: trimmedName,
    };

    composer.setExtractedData((prev: ExtractedData) => ({
      ...prev,
      ...nameUpdate,
    }));

    composer.setFieldResponses((prev: Record<string, any>) => ({
      ...prev,
      ...nameUpdate,
    }));
  }, [composer]);

  const handlePlaceAddressChange = useCallback((address: string) => {
    const trimmedAddress = address || undefined;
    const addressUpdate = {
      location: trimmedAddress,
      location_address: trimmedAddress,
    };

    composer.setExtractedData((prev: ExtractedData) => ({
      ...prev,
      ...addressUpdate,
    }));

    composer.setFieldResponses((prev: Record<string, any>) => ({
      ...prev,
      ...addressUpdate,
    }));
  }, [composer]);

  const handlePreviewLocationSelected = useCallback((location: LocationData) => {
    updateLocationData(location);
  }, [updateLocationData]);

  // Shared celebration handler
  const handleCelebration = useCallback(() => {
    setShowCelebration(true);
    toast.success(SUCCESS_MESSAGES.POSTED);
    
    setTimeout(() => {
      // Notify parent/page
      onPostCreated();

      // Fire a lightweight cross-page event so any mounted feed instance
      // can react immediately (e.g. show a toast or invalidate queries).
      try {
        window.dispatchEvent(
          new CustomEvent('answer:posted', {
            detail: {
              questionId,
            },
          })
        );
      } catch {
        // Ignore – this is best-effort UX sugar
      }
    }, CELEBRATION_DELAY_MS);
  }, [onPostCreated, questionId]);

  // Handle approve preview
  const handleApprovePreview = useCallback(async () => {
    console.log('[RecommendationComposer] handleApprovePreview called');
    try {
      const getMapping = mentionHandler?.getMapping || (() => ({}));
      console.log('[RecommendationComposer] Calling handleSubmit...');
      const success = await composer.handleSubmit(getMapping);
      console.log('[RecommendationComposer] handleSubmit result:', success);
      if (success) {
        handleCelebration();
      } else {
        console.error('[RecommendationComposer] handleSubmit returned false');
        toast.error('Failed to post recommendation. Please try again.');
      }
    } catch (error) {
      console.error('[RecommendationComposer] Error in handleApprovePreview:', error);
      toast.error('An error occurred while posting the recommendation.');
      throw error;
    }
  }, [composer, mentionHandler, handleCelebration]);

  // Handle edit preview
  const handleEditPreview = useCallback(() => {
    composer.setIsEditingDescription(true);
    if (!composer.editedPreview) {
      composer.setEditedPreview('');
    }
  }, [composer]);

  // Handle save edit
  const handleSaveEdit = useCallback(() => {
    // For services, sync editedPreview to serviceDetails.experience_summary
    if (composer.explicitContentType === 'service' && composer.editedPreview?.trim()) {
      setServiceDetails(prev => ({
        ...prev,
        experience_summary: composer.editedPreview.trim(),
        service_experience: composer.editedPreview.trim(), // Also set for compatibility
      }));
    }
    composer.setIsEditingDescription(false);
  }, [composer, setServiceDetails]);

  // Handle improve text with AI
  const handleImproveText = useCallback(async () => {
    if (!composer.editedPreview.trim()) {
      toast.error('Please enter some text to improve');
      return;
    }
    
    const improved = await improveText(composer.editedPreview);
    
    if (improved && improved.trim()) {
      composer.setEditedPreview(improved);
      if (!composer.isEditingDescription) {
        composer.setIsEditingDescription(true);
      }
      toast.success('Text improved successfully!');
    }
  }, [composer, improveText]);

  // Memoize consolidated data to avoid recalculating on every render
  const consolidatedData = useMemo(() => {
    return { ...composer.extractedData, ...composer.fieldResponses };
  }, [composer.extractedData, composer.fieldResponses]);

  // Memoize preview step props
  const previewStepProps = useMemo(() => {
    const placeName = consolidatedData.name || consolidatedData.location_name || consolidatedData.title;
    const placeAddress = consolidatedData.location || consolidatedData.location_address;
    const contentType = (consolidatedData.contentType || consolidatedData.type || 'place') as 
      'place' | 'service' | 'tip' | 'contact' | 'unclear';
    const contact = consolidatedData.contact_info || consolidatedData.contact || null;

    return {
      placeName,
      placeAddress,
      contentType,
      contact,
    };
  }, [
    consolidatedData,
  ]);

  // Handle preview mention selection
  const handlePreviewMentionSelect = useCallback((user: MentionUser) => {
    const sel = previewTextareaRef.current;
    if (!sel) return;

    const cursor = sel.selectionStart || composer.editedPreview.length;
    const uname = (user.username || '').toLowerCase() || 
      (user.display_name || user.user_name || '').toLowerCase().replace(/\s+/g, '');
    const { text: nt, newCursor } = insertPlainMention(composer.editedPreview, cursor, uname);
    const display = user.display_name || user.user_name || uname;
    
    mentionHandler.getMapping()[uname] = { id: user.id, displayName: display };
    composer.setEditedPreview(nt);
    mentionHandler.closeMentionMenu();
    
    requestAnimationFrame(() => {
      sel.focus();
      sel.setSelectionRange(newCursor, newCursor);
    });
  }, [composer.editedPreview, composer.setEditedPreview, mentionHandler]);

  const renderContentTypeSelectionStep = useCallback(() => (
    <ContentTypeSelectionStep
      onSelect={handleContentTypeSelect}
      onSkip={() => {
        // Skip defaults to place flow
        handleContentTypeSelect('place');
      }}
    />
  ), [handleContentTypeSelect]);

  const renderMapStep = useCallback(() => (
    <MapStep
      onBack={composer.goBack}
      onPlaceSelected={composer.handlePlaceSelectedFromMap}
    />
  ), [composer]);

  const renderServiceBasicsStep = useCallback(() => (
    <ServiceBasicsStep
      initialData={serviceBasics || {}}
      onContinue={handleServiceBasicsSubmit}
      onBack={composer.goBack}
    />
  ), [serviceBasics, handleServiceBasicsSubmit, composer]);

  const handleServiceDetailsSubmit = useCallback(async (data: ServiceDetailsFormData) => {
    // If category changed, update category_id - backend will derive service_type from it
    if (data.category_id && data.category_id !== serviceBasics?.category_id) {
      composer.setExtractedData(prev => ({
        ...prev,
        service_category_id: data.category_id,
      }));
      composer.setFieldResponses(prev => ({
        ...prev,
        service_category_id: data.category_id,
      }));
    }

    // Map service details to the format expected by the mapper
    setServiceDetails({
      service_category_id: data.category_id || serviceBasics?.category_id || null,
      service_price_range: data.price_range,
      exact_price: data.exact_price,
      service_quote: data.verbatim_quote,
      experience_summary: data.experience_summary,
      service_experience: data.experience_summary, // Also set service_experience for compatibility
      context_tags: data.context_tags,
    });
    // Move to preview after service details are filled
    composer.setCurrentStep('preview');
  }, [setServiceDetails, composer, serviceBasics]);

  const renderServiceDetailsStep = useCallback(() => (
    <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
      <div>
        <h2 
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-light tracking-tight leading-tight"
          style={{ color: selectedTheme?.textPrimary || '#000000' }}
        >
          Service Details
        </h2>
        <p className="text-xs sm:text-sm mt-1" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
          Help others by sharing more details about this service
        </p>
      </div>
      <ServiceDetailsForm
        initialData={{
          category_id: serviceBasics?.category_id || serviceDetails.service_category_id,
          ...serviceDetails,
        }}
        onSubmit={handleServiceDetailsSubmit}
        onCancel={() => composer.setCurrentStep('service-basics')}
      />
    </div>
  ), [serviceBasics, serviceDetails, handleServiceDetailsSubmit, composer, selectedTheme]);

  const renderPreviewStep = useCallback(() => {
    const previewMentionMenu = (
      composer.isEditingDescription && 
      mentionHandler.showMentionMenu && 
      mentionHandler.mentionSuggestions.length > 0
    ) ? (
      <MentionMenu
        show={mentionHandler.showMentionMenu}
        suggestions={mentionHandler.mentionSuggestions}
        position={mentionHandler.mentionPosition}
        onSelect={handlePreviewMentionSelect}
      />
    ) : null;

    return (
      <PreviewStep
        currentUser={currentUser}
        placeName={previewStepProps.placeName}
        placeAddress={previewStepProps.placeAddress}
        contentType={previewStepProps.contentType}
        contact={previewStepProps.contact}
        isEditingDescription={composer.isEditingDescription}
        editedPreview={composer.editedPreview}
        onEditedPreviewChange={composer.setEditedPreview}
        showMentionMenu={mentionHandler.showMentionMenu}
        mentionMenu={previewMentionMenu}
        rating={composer.rating}
        onRatingChange={composer.setRating}
        onEdit={handleEditPreview}
        onSaveEdit={handleSaveEdit}
        onApprove={handleApprovePreview}
        onBack={composer.goBack}
        onImproveText={handleImproveText}
        isImprovingText={isImprovingText}
        labels={composer.labels}
        onLabelsChange={composer.setLabels}
        highlights={composer.highlights}
        onHighlightsChange={composer.setHighlights}
        onPlaceNameChange={handlePlaceNameChange}
        onPlaceAddressChange={handlePlaceAddressChange}
        onLocationSelected={handlePreviewLocationSelected}
        serviceDetails={serviceDetails}
        serviceBasics={serviceBasics}
      />
    );
  }, [
    currentUser,
    previewStepProps,
    composer,
    mentionHandler,
    handlePreviewMentionSelect,
    handleEditPreview,
    handleSaveEdit,
    handleApprovePreview,
    handlePlaceNameChange,
    handlePlaceAddressChange,
    handlePreviewLocationSelected,
    handleImproveText,
    isImprovingText,
    serviceDetails,
    serviceBasics,
  ]);

  // Neobrutalist celebration animation component
  const CelebrationOverlay = useCallback(() => (
    <AnimatePresence>
      {showCelebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ backgroundColor }}
          />
          
          {/* Celebration Content - Neobrutalist Style */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Main Success Card */}
            <motion.div
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: -20, opacity: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 300,
                damping: 20
              }}
              className="relative rounded-lg border-4 p-6 md:p-8"
              style={{ 
                backgroundColor: accentColor, 
                borderColor: borderColor,
                boxShadow: `8px 8px 0 0 ${borderColor}`,
              }}
            >
              {/* Checkmark Container */}
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 300,
                  damping: 15
                }}
                className="w-16 h-16 md:w-20 md:h-20 rounded-lg border-4 flex items-center justify-center mb-4 md:mb-6 mx-auto"
                style={{
                  backgroundColor: cardBackground,
                  borderColor: borderColor,
                  boxShadow: `3px 3px 0 0 ${borderColor}`,
                }}
              >
                <Check 
                  className="h-8 w-8 md:h-12 md:w-12" 
                  strokeWidth={4}
                  style={{ color: borderColor }}
                />
              </motion.div>
              
              {/* Success Message */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-3xl md:text-5xl font-black text-center mb-2 md:mb-3 tracking-tight"
                style={{ color: textOnAccent }}
              >
                POSTED!
              </motion.h2>
              
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm md:text-lg font-bold text-center"
                style={{ color: textOnAccent, opacity: 0.9 }}
              >
                Your recommendation is live
              </motion.p>
            </motion.div>
            
            {/* Geometric decorative shapes - brutalist style */}
            {celebrationShapes.map((shape, i) => (
              <motion.div
                key={i}
                initial={{ 
                  scale: 0,
                  x: 0,
                  y: 0,
                  rotate: 0,
                  opacity: 0
                }}
                animate={{ 
                  scale: [0, 1.2, 1],
                  x: shape.x,
                  y: shape.y,
                  rotate: [0, 180, 360],
                  opacity: [0, 1, 0.8, 0]
                }}
                transition={{ 
                  delay: shape.delay,
                  duration: 1.2,
                  ease: 'easeOut'
                }}
                className="absolute rounded-lg border-2"
                style={{
                  width: `${shape.size}px`,
                  height: `${shape.size}px`,
                  backgroundColor: shape.shapeColor === '#000' ? borderColor : shape.shapeColor,
                  borderColor: borderColor,
                  boxShadow: `3px 3px 0 0 ${borderColor}`
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  ), [showCelebration, accentColor, textOnAccent, celebrationShapes, borderColor, backgroundColor, cardBackground]);

  return (
    <>
      <AnimatePresence>
        {isOpen && !showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ 
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.3, ease: 'easeInOut' }
            }}
            className="fixed inset-0 z-40 pt-16"
            style={{ 
              backgroundColor: selectedTheme?.backgroundColor || 'var(--app-bg)', 
              color: selectedTheme?.textPrimary || 'var(--app-text)' 
            }}
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <div className={`h-full flex items-center justify-center ${composer.currentStep === 'map-selection' ? 'p-0 sm:p-2 md:p-4 lg:p-12' : 'p-3 sm:p-4 md:p-8 lg:p-12'}`}>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ 
                      y: -20, 
                      opacity: 0,
                      scale: 0.95,
                      transition: { duration: 0.2 }
                    }}
                    className={stepContainerClassName}
                    style={stepContainerStyle}
                    data-step={composer.currentStep}
                  >
                  {composer.currentStep === 'map-selection' && (
                    <style>{`
                      [data-step="map-selection"] {
                        background-color: transparent !important;
                      }
                      @media (min-width: 768px) {
                        [data-step="map-selection"] {
                          background-color: ${selectedTheme?.cardBackground || '#FFFFFF'} !important;
                          border-color: ${selectedTheme?.borderColor || '#000000'} !important;
                          box-shadow: 6px 6px 0 0 ${selectedTheme?.borderColor || '#000000'} !important;
                        }
                      }
                    `}</style>
                  )}
                    <AnimatePresence mode="wait">
                      {composer.currentStep === 'content-type-selection' && renderContentTypeSelectionStep()}
                      {composer.currentStep === 'map-selection' && renderMapStep()}
                      {composer.currentStep === 'service-basics' && renderServiceBasicsStep()}
                      {composer.currentStep === 'service-details' && renderServiceDetailsStep()}
                      {composer.currentStep === 'preview' && renderPreviewStep()}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <CelebrationOverlay />
    </>
  );
};

export default RecommendationComposer;
