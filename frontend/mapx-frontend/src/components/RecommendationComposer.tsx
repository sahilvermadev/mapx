import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { useAuth } from '@/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { insertPlainMention } from '@/utils/mentions';
import { useRecommendationComposer } from '@/hooks/useRecommendationComposer';
import { useMentionHandler } from '@/hooks/useMentionHandler';
import WritingStep from '@/components/composer/steps/WritingStep';
import AnalyzingStep from '@/components/composer/steps/AnalyzingStep';
import CompletingStep from '@/components/composer/steps/CompletingStep';
import PreviewStep from '@/components/composer/steps/PreviewStep';
import MentionMenu from '@/components/MentionMenu';

interface RecommendationComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  currentUserId: string;
  questionContext?: string;
  questionId?: number;
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

  // Auto-focus input when completing step is shown
  useEffect(() => {
    if (composer.currentStep === 'completing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [composer.currentStep]);

  // Initialize component when opened
  useEffect(() => {
    if (!isOpen) return;
    
    console.log('RecommendationComposer opened, questionContext:', questionContext, 'questionId:', questionId);
    
    // Reset all state including celebration
    composer.reset();
    setShowCelebration(false);
    
    // Check for question context from props or location.state
    const contextToUse = questionContext || composer.location.state?.questionContext;
    composer.initializeWithQuestion(contextToUse);
  }, [isOpen, questionContext, questionId]);

  // Auto-focus textarea when opened (but only for writing step)
  useEffect(() => {
    if (isOpen && composer.currentStep === 'writing' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, composer.currentStep]);

  // Fetch mention suggestions
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!mentionHandler.mentionQuery || mentionHandler.mentionQuery.length < 1) {
        if (active) mentionHandler.fetchSuggestions('');
        return;
      }
      await mentionHandler.fetchSuggestions(mentionHandler.mentionQuery);
    };
    run();
    return () => { active = false; };
  }, [mentionHandler.mentionQuery]);

  // Handle text change with mention detection
  const handleTextChange = (value: string) => {
    mentionHandler.handleTextChange(value, textareaRef, composer.setText);
    if (composer.error) composer.setError(null);
  };

  // Handle text selection for mention positioning
  const handleTextSelection = (newPos: number) => {
    mentionHandler.handleTextSelection(textareaRef, newPos);
  };

  // Handle mention selection
  const handleMentionSelect = (user: any) => {
    mentionHandler.handleMentionSelect(user, composer.text, textareaRef, composer.setText);
  };

  // Handle field response
  const handleFieldResponse = async (field: string, response: any) => {
    await composer.handleFieldResponse(field, response);
  };

  // Handle location selection
  const handleLocationSelected = (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
  }) => {
    composer.handleLocationSelected(location);
  };

  // Handle skip field
  const handleSkipField = () => {
    composer.handleSkipField();
  };

  // Handle approve preview
  const handleApprovePreview = async () => {
    const success = await composer.handleSubmit(mentionHandler.getMapping);
    if (success) {
      setShowCelebration(true);
      toast.success('Recommendation posted!');
      
      // Navigate directly after celebration animation completes
      // Don't close celebration - let navigation unmount the component
      // This prevents the flash back to preview screen
        setTimeout(() => {
      onPostCreated();
      }, 1800); // Slightly shorter than celebration duration to ensure smooth transition
    }
  };

  // Handle edit preview
  const handleEditPreview = () => {
    composer.setIsEditingDescription(true);
    const currentText = composer.formattedPreview || composer.formatRecommendationTextSync(composer.extractedData, composer.fieldResponses);
    composer.setEditedPreview(currentText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());
  };

  // Handle save edit
  const handleSaveEdit = () => {
    composer.setFormattedPreview(composer.editedPreview);
    composer.setIsEditingDescription(false);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    composer.setIsEditingDescription(false);
    composer.setEditedPreview('');
  };

  // Generate/refresh LLM-formatted preview whenever entering preview, or when data has changed
  useEffect(() => {
    if (composer.currentStep !== 'preview' || composer.isFormattingPreview) return;

    composer.setIsFormattingPreview(true);

    const generatePreview = async () => {
      try {
        const llmFormatted = await composer.formatRecommendationText(composer.extractedData, composer.fieldResponses);
        if (llmFormatted) {
          composer.setFormattedPreview(llmFormatted);
        }
      } catch (error) {
        console.error('Error generating LLM preview:', error);
        composer.setFormattedPreview(composer.formatRecommendationTextSync(composer.extractedData, composer.fieldResponses));
      } finally {
        composer.setIsFormattingPreview(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (composer.isFormattingPreview) {
        composer.setFormattedPreview(composer.formatRecommendationTextSync(composer.extractedData, composer.fieldResponses));
        composer.setIsFormattingPreview(false);
      }
    }, 25000);

    generatePreview();
    return () => clearTimeout(timeoutId);
  }, [composer.currentStep, composer.extractedData, composer.fieldResponses]);

  // Update labels when consolidated data changes
  useEffect(() => {
    if (composer.currentStep === 'preview') {
      const consolidated = { ...composer.extractedData, ...composer.fieldResponses };
      const newLabels = Array.isArray(consolidated.specialities)
        ? consolidated.specialities
        : consolidated.specialities
        ? [consolidated.specialities]
        : [];
      composer.setLabels(newLabels);
    }
  }, [composer.currentStep]);

  const renderWritingStep = () => (
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
  );

  const renderAnalyzingStep = () => (
    <AnalyzingStep />
  );

  const renderCompletingStep = () => (
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
          setShowCelebration(true);
          toast.success('Recommendation posted!');
          
          // Navigate directly after celebration animation completes
          // Don't close celebration - let navigation unmount the component
          // This prevents the flash back to preview screen
            setTimeout(() => {
          onPostCreated();
          }, 1800); // Slightly shorter than celebration duration to ensure smooth transition
        }
      }}
    />
  );

  const renderPreviewStep = () => {
    const consolidated = { ...composer.extractedData, ...composer.fieldResponses };
    
    const placeName = consolidated.name || consolidated.location_name || consolidated.title;
    const placeAddress = consolidated.location || consolidated.location_address;
    const description = composer.formattedPreview || composer.formatRecommendationTextSync(composer.extractedData, composer.fieldResponses);
    const contentType = (consolidated.contentType || consolidated.type) as any;
    const contact = consolidated.contact_info || consolidated.contact || null;
    
    const previewMentionMenu = (composer.isEditingDescription && mentionHandler.showMentionMenu && mentionHandler.mentionSuggestions.length > 0) ? (
      <MentionMenu
        show={mentionHandler.showMentionMenu}
        suggestions={mentionHandler.mentionSuggestions}
        position={mentionHandler.mentionPosition}
        onSelect={(user) => {
                  const sel = previewTextareaRef.current;
                  if (!sel) return;
          const cursor = sel.selectionStart || composer.editedPreview.length;
          const uname = (user.username || '').toLowerCase() || (user.display_name || user.user_name || '').toLowerCase().replace(/\s+/g, '');
          const { text: nt, newCursor } = insertPlainMention(composer.editedPreview, cursor, uname);
          const display = user.display_name || user.user_name || uname;
          mentionHandler.getMapping()[uname] = { id: user.id, displayName: display };
          composer.setEditedPreview(nt);
          mentionHandler.closeMentionMenu();
                  requestAnimationFrame(() => {
                    sel.focus();
                    sel.setSelectionRange(newCursor, newCursor);
                  });
                }}
      />
    ) : null;

    return (
      <PreviewStep
        currentUser={currentUser}
        placeName={placeName}
        placeAddress={placeAddress}
        description={description}
        contentType={contentType}
        contact={contact}
        isEditingDescription={composer.isEditingDescription}
        editedPreview={composer.editedPreview}
        onEditedPreviewChange={composer.setEditedPreview}
        showMentionMenu={mentionHandler.showMentionMenu}
        mentionMenu={previewMentionMenu}
        rating={composer.rating}
        onRatingChange={composer.setRating}
        onEdit={handleEditPreview}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onApprove={handleApprovePreview}
        onBack={composer.goBack}
        labels={composer.labels}
        onLabelsChange={composer.setLabels}
      />
    );
  };


  // Neobrutalist celebration animation component
  const CelebrationOverlay = () => (
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
            {[...Array(12)].map((_, i) => {
              const angle = (i * 360) / 12;
              const radius = 100;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;
              const size = Math.random() * 16 + 12;
              const colors = [accentColor, '#000', '#fbbf24', '#ef4444'];
              const shapeColor = colors[Math.floor(Math.random() * colors.length)];
              
              return (
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
                    x: x,
                    y: y,
                    rotate: [0, 180, 360],
                    opacity: [0, 1, 0.8, 0]
                  }}
                  transition={{ 
                    delay: 0.3 + i * 0.05,
                    duration: 1.2,
                    ease: 'easeOut'
                  }}
                  className="absolute rounded-lg border-2 border-black"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: shapeColor === '#000' ? '#000' : shapeColor,
                    borderColor: '#000',
                    boxShadow: '3px 3px 0 0 #000'
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
                    className="w-full max-w-4xl rounded-lg border-2 border-black bg-white p-4 md:p-6 lg:p-8 shadow-[6px_6px_0_0_#000]"
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