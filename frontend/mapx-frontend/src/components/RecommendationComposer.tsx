import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { insertPlainMention } from '@/utils/mentions';
import { useRecommendationComposer, type ExtractedData } from '@/hooks/useRecommendationComposer';
import { useMentionHandler } from '@/hooks/useMentionHandler';
import WritingStep from '@/components/composer/steps/WritingStep';
import AnalyzingStep from '@/components/composer/steps/AnalyzingStep';
import CompletingStep from '@/components/composer/steps/CompletingStep';
import PreviewStep from '@/components/composer/steps/PreviewStep';
import MentionMenu from '@/components/MentionMenu';
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
  questionId
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { user: currentUser } = useAuth();
  
  // Celebration animation state
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Theme support
  const { theme } = useTheme();
  const selectedTheme = THEMES[theme];
  const accentColor = selectedTheme.accentColor;
  const textOnAccent = getReadableTextColor(accentColor);
  
  // Use the custom hooks for state management
  const composer = useRecommendationComposer(currentUserId, questionId);
  const mentionHandler = useMentionHandler(currentUserId);

  // Extract stable functions and values to avoid dependency issues
  const { 
    reset, 
    initializeWithQuestion, 
    location: composerLocation,
    improveText,
    isImprovingText,
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

  // Container style: no card for analyzing step
  const stepContainerClassName = useMemo(() => {
    if (composer.currentStep === 'analyzing') {
      return 'w-full max-w-4xl p-4 md:p-6 lg:p-8';
    }
    return 'w-full max-w-4xl rounded-lg border-2 border-black bg-white p-4 md:p-6 lg:p-8 shadow-[6px_6px_0_0_#000]';
  }, [composer.currentStep]);

  // Auto-focus input when completing step is shown
  useEffect(() => {
    if (composer.currentStep === 'completing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [composer.currentStep]);

  // Initialize component when opened
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset all state including celebration
    reset();
    setShowCelebration(false);
    
    // Check for question context from props or location.state
    const contextToUse = questionContext || composerLocation.state?.questionContext;
    initializeWithQuestion(contextToUse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, questionContext, questionId]);

  // Auto-focus textarea when opened (but only for writing step)
  useEffect(() => {
    if (isOpen && composer.currentStep === 'writing' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, composer.currentStep]);

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

  // Handle text change with mention detection
  const handleTextChange = useCallback((value: string) => {
    mentionHandler.handleTextChange(value, textareaRef, composer.setText);
    if (composer.error) {
      composer.setError(null);
    }
  }, [mentionHandler, composer]);

  // Handle text selection for mention positioning
  const handleTextSelection = useCallback((newPos: number) => {
    mentionHandler.handleTextSelection(textareaRef, newPos);
  }, [mentionHandler]);

  // Handle mention selection
  const handleMentionSelect = useCallback((user: MentionUser) => {
    mentionHandler.handleMentionSelect(user, composer.text, textareaRef, composer.setText);
  }, [mentionHandler, composer.text]);

  // Handle field response
  const handleFieldResponse = useCallback(async (field: string, response: any) => {
    await composer.handleFieldResponse(field, response);
  }, [composer]);

  // Handle location selection
  const handleLocationSelected = useCallback((location: LocationData) => {
    composer.handleLocationSelected(location);
  }, [composer]);

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

  // Handle skip field
  const handleSkipField = useCallback(() => {
    composer.handleSkipField();
  }, [composer]);

  // Shared celebration handler
  const handleCelebration = useCallback(() => {
    setShowCelebration(true);
    toast.success(SUCCESS_MESSAGES.POSTED);
    
    setTimeout(() => {
      onPostCreated();
    }, CELEBRATION_DELAY_MS);
  }, [onPostCreated]);

  // Handle approve preview
  const handleApprovePreview = useCallback(async () => {
    const success = await composer.handleSubmit(mentionHandler.getMapping);
    if (success) {
      handleCelebration();
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
    composer.setIsEditingDescription(false);
  }, [composer]);

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

  const renderWritingStep = useCallback(() => (
    <WritingStep
      error={composer.error}
      text={composer.text}
      textareaRef={textareaRef}
      onChange={handleTextChange}
      onContinue={composer.handleAnalyze}
      onClearError={() => composer.setError(null)}
      onTextSelection={handleTextSelection}
      mentionMenu={
        <MentionMenu
          show={mentionHandler.showMentionMenu}
          suggestions={mentionHandler.mentionSuggestions}
          position={mentionHandler.mentionPosition}
          onSelect={handleMentionSelect}
        />
      }
    />
  ), [composer, handleTextChange, handleTextSelection, handleMentionSelect, mentionHandler]);

  const renderAnalyzingStep = useCallback(() => (
    <AnalyzingStep />
  ), []);

  const renderCompletingStep = useCallback(() => (
    <CompletingStep
      missingFields={composer.missingFields}
      currentFieldIndex={composer.currentFieldIndex}
      textareaRef={textareaRef}
      fieldResponses={composer.fieldResponses}
      onFieldResponse={handleFieldResponse}
      onLocationSelected={handleLocationSelected}
      onSkipField={handleSkipField}
      onBack={composer.goBack}
      isSubmitting={composer.isSubmitting}
      onSubmit={async () => {
        const success = await composer.handleSubmit(mentionHandler.getMapping);
        if (success) {
          handleCelebration();
        }
      }}
    />
  ), [composer, handleFieldResponse, handleLocationSelected, handleSkipField, mentionHandler, handleCelebration]);

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
            className="absolute inset-0 bg-white"
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
              className="relative rounded-lg border-4 border-black bg-white p-6 md:p-8 shadow-[8px_8px_0_0_#000] md:shadow-[12px_12px_0_0_#000]"
              style={{ backgroundColor: accentColor, borderColor: '#000' }}
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
                className="w-16 h-16 md:w-20 md:h-20 rounded-lg border-4 border-black bg-white shadow-[3px_3px_0_0_#000] md:shadow-[4px_4px_0_0_#000] flex items-center justify-center mb-4 md:mb-6 mx-auto"
              >
                <Check className="h-8 w-8 md:h-12 md:w-12 text-black" strokeWidth={4} />
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
                className="absolute rounded-lg border-2 border-black"
                style={{
                  width: `${shape.size}px`,
                  height: `${shape.size}px`,
                  backgroundColor: shape.shapeColor === '#000' ? '#000' : shape.shapeColor,
                  borderColor: '#000',
                  boxShadow: '3px 3px 0 0 #000'
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  ), [showCelebration, accentColor, textOnAccent, celebrationShapes]);

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
            style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}
          >
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <div className="h-full flex items-center justify-center p-4 md:p-12">
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
                  >
                    <AnimatePresence mode="wait">
                      {composer.currentStep === 'writing' && renderWritingStep()}
                      {composer.currentStep === 'analyzing' && renderAnalyzingStep()}
                      {composer.currentStep === 'completing' && renderCompletingStep()}
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
