import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { aiClient } from '@/services/aiClient';
import { buildSaveRecommendationDto } from '@/mappers/formToSaveDto';
import { recommendationsApi } from '@/services/recommendationsApi';
import { convertUsernamesToTokens } from '@/utils/mentions';
import { handleError } from '@/utils/errorHandling';
import {
  RECOMMENDATION_PREFIX,
  MIN_TEXT_LENGTH,
  QUESTION_ANALYSIS_DELAY_MS,
  ERROR_MESSAGES,
} from '@/components/composer/constants';

export interface ExtractedData {
  name?: string;
  description?: string;
  location?: string;
  category?: string;
  rating?: number;
  lat?: number;
  lng?: number;
  contact_info?: {
    phone?: string;
    email?: string;
  };
  highlights?: string[];
  // Removed deprecated fields: best_times, tips
  type?: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  location_name?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  location_google_place_id?: string;
  google_place_id?: string;
  [key: string]: any;
}

export interface MissingField {
  field: string;
  question: string;
  required: boolean;
  needsLocationPicker?: boolean;
}

export type ComposerStep = 'writing' | 'analyzing' | 'completing' | 'preview';

export function useRecommendationComposer(currentUserId: string, questionId?: number) {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [currentStep, setCurrentStep] = useState<ComposerStep>('writing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldResponses, setFieldResponses] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editedPreview, setEditedPreview] = useState<string>('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [isImprovingText, setIsImprovingText] = useState(false);

  const location = useLocation();

  // Helper function to prepare text for AI analysis based on context
  const prepareTextForAnalysis = useCallback((text: string, isQuestionContext: boolean = false): string => {
    if (isQuestionContext) {
      // For question context, we don't need to add a prefix
      // The AI will detect this is answering a question based on the question patterns
      return text;
    } else {
      // For standalone recommendations, ensure it starts with recommendation language
      if (!text.toLowerCase().startsWith(RECOMMENDATION_PREFIX.toLowerCase())) {
        return RECOMMENDATION_PREFIX + text;
      }
      return text;
    }
  }, []);

  const performAnalysis = useCallback(async (textToAnalyze: string, isQuestionContext: boolean = false) => {
    try {
      const processedText = prepareTextForAnalysis(textToAnalyze, isQuestionContext);
      const analysis = await aiClient.analyze(processedText);
        
      if (analysis?.isGibberish) {
        setError(ERROR_MESSAGES.GIBBERISH);
        setCurrentStep('writing');
        setIsAnalyzing(false);
        setIsProcessing(false);
        return;
      }

      const processedExtractedData = {
        ...analysis.extractedData,
        type: analysis.contentType,
        contentType: analysis.contentType,
        description: isQuestionContext 
          ? (analysis.extractedData.description || processedText) 
          : prepareTextForAnalysis(analysis.extractedData.description || processedText, false)
      };

      setExtractedData(processedExtractedData);
      setMissingFields(analysis.missingFields || []);
      
      // Initialize highlights from extractedData if available (only for places)
      if (analysis.contentType === 'place' && processedExtractedData.highlights) {
        const highlightsValue = Array.isArray(processedExtractedData.highlights)
          ? processedExtractedData.highlights.join(', ')
          : String(processedExtractedData.highlights);
        if (highlightsValue.trim()) {
          setHighlights(highlightsValue);
        }
      }
      
      setCurrentStep(
        analysis.missingFields && analysis.missingFields.length > 0 
          ? 'completing' 
          : 'preview'
      );
    } catch (error) {
      handleError(error, {
        context: 'useRecommendationComposer.performAnalysis',
        showToast: false,
        logError: true
      });
      setError(
        error instanceof Error 
          ? error.message 
          : ERROR_MESSAGES.ANALYSIS_ERROR
      );
      setCurrentStep('writing');
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  }, [prepareTextForAnalysis]);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) {
      setError(ERROR_MESSAGES.EMPTY_TEXT);
      return;
    }

    if (text.trim().length < MIN_TEXT_LENGTH) {
      setError(ERROR_MESSAGES.TEXT_TOO_SHORT);
      return;
    }

    setError(null);
    setCurrentStep('analyzing');
    setIsAnalyzing(true);
    setIsProcessing(true);

    await performAnalysis(text, false);
  }, [text, performAnalysis]);

  const moveToNextField = useCallback(() => {
    setCurrentFieldIndex(prev => {
      if (prev < missingFields.length - 1) {
        return prev + 1;
      } else {
        setCurrentStep('preview');
        return prev;
      }
    });
  }, [missingFields.length]);

  const handleFieldResponse = useCallback(async (field: string, response: any) => {
    if (typeof response === 'string') {
      if (!response.trim()) return;
    } else if (response == null) {
      return;
    }

    try {
      if (field === 'contact_info' && typeof response === 'object') {
        const cleaned = {
          phone: response.phone ? String(response.phone).replace(/\D/g, '') : undefined,
          email: response.email ? String(response.email).trim().toLowerCase() : undefined
        };
        setFieldResponses(prev => ({ ...prev, [field]: cleaned }));
        setExtractedData(prev => ({ ...prev, [field]: cleaned }));
        moveToNextField();
        return;
      }

      const validation = await aiClient.validate(
        missingFields[currentFieldIndex]?.question || '',
        String(response),
        field
      );
      
      if (!validation.isValid) {
        toast.error(validation.feedback || ERROR_MESSAGES.VALIDATION_ERROR);
        return;
      }

      const extractedValue = validation.extractedValue || String(response);
      setFieldResponses(prev => ({ ...prev, [field]: extractedValue }));
      setExtractedData(prev => ({ ...prev, [field]: extractedValue }));
      moveToNextField();
    } catch (error) {
      handleError(error, {
        context: 'useRecommendationComposer.handleFieldResponse',
        showToast: false,
        logError: true
      });
      setFieldResponses(prev => ({ ...prev, [field]: response }));
      setExtractedData(prev => ({ ...prev, [field]: response }));
      moveToNextField();
    }
  }, [missingFields, currentFieldIndex, moveToNextField]);

  const handleLocationSelected = useCallback((location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
  }) => {
    const field = missingFields[currentFieldIndex]?.field;
    if (!field) return;
    
    const locationText = `${location.name}, ${location.address}`;
    
    setExtractedData(prev => ({
      ...prev,
      [field]: locationText,
      [`${field}_lat`]: location.lat,
      [`${field}_lng`]: location.lng,
      [`${field}_google_place_id`]: location.google_place_id,
      [`${field}_name`]: location.name,
      [`${field}_address`]: location.address,
      // normalized fields (store both generic and field-scoped for mapper compatibility)
      city_name: location.city_name || prev.city_name,
      admin1_name: location.admin1_name || prev.admin1_name,
      country_code: location.country_code || prev.country_code,
      [`${field}_city_name`]: location.city_name,
      [`${field}_admin1_name`]: location.admin1_name,
      [`${field}_country_code`]: location.country_code,
    }));

    setFieldResponses(prev => ({ ...prev, [field]: locationText }));
    moveToNextField();
  }, [missingFields, currentFieldIndex, moveToNextField]);

  const handleSkipField = useCallback(() => {
    moveToNextField();
  }, [moveToNextField]);

  const improveText = useCallback(async (currentText: string): Promise<string | null> => {
    setIsImprovingText(true);
    try {
      const improved = await aiClient.improveText(currentText);
      
      if (improved && improved.trim()) {
        return improved.trim();
      }
      
      // Show toast if no improvement was returned
      toast.error('Unable to improve text. Please try again.');
      return null;
    } catch (error) {
      handleError(error, {
        context: 'useRecommendationComposer.improveText',
        showToast: true,
        logError: true
      });
      return null;
    } finally {
      setIsImprovingText(false);
    }
  }, []);

  const handleSubmit = useCallback(async (getMapping: () => Record<string, any>) => {
    setIsSubmitting(true);
    
    try {
      const textWithTokens = convertUsernamesToTokens(text, getMapping());
      const formattedRecommendation = convertUsernamesToTokens(editedPreview || text, getMapping());
      
      const finalData = {
        ...extractedData,
        ...fieldResponses,
        originalText: textWithTokens,
        formattedText: formattedRecommendation,
        type: extractedData.type || 'place',
        contentType: (extractedData as any).contentType || extractedData.type || 'place',
        highlights: highlights.trim() || undefined
      };
      
      const contentType = (finalData.type as ('place' | 'service' | 'tip' | 'contact' | 'unclear')) || 'place';

      const requestBody = buildSaveRecommendationDto({
        contentType,
        extractedData: finalData,
        fieldResponses,
        formattedRecommendation,
        rating,
        currentUserId,
        labels
      });
      
      let result;
      if (questionId) {
        // Use the question answers endpoint to link the recommendation to the question
        // Import the answersApi for question answers
        const { answersApi } = await import('@/services/answersService');
        result = await answersApi.createAnswer(questionId, { recommendation_payload: requestBody });
      } else {
        // Use the regular recommendation endpoint
        result = await recommendationsApi.saveRecommendation(requestBody as any);
      }
      
      // Accept both shapes: direct data ({ recommendation_id }) or wrapped
      const recId = (result as any)?.recommendation_id || (result as any)?.data?.recommendation_id;
      if (recId) return true;
      throw new Error(ERROR_MESSAGES.SAVE_FAILED);
    } catch (error) {
      handleError(error, {
        context: 'useRecommendationComposer.handleSubmit',
        showToast: true,
        fallbackMessage: ERROR_MESSAGES.SAVE_ERROR
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [text, editedPreview, extractedData, fieldResponses, rating, currentUserId, labels, highlights, questionId]);

  const reset = useCallback(() => {
    setText('');
    setExtractedData({});
    setMissingFields([]);
    setCurrentFieldIndex(0);
    setFieldResponses({});
    setError(null);
    setIsProcessing(false);
    setEditedPreview('');
    setIsEditingDescription(false);
    setRating(null);
    setLabels([]);
    setHighlights('');
    setIsImprovingText(false);
  }, []);

  const initializeWithQuestion = useCallback((questionContext: string | undefined) => {
    if (questionContext && typeof questionContext === 'string' && questionContext.trim().length > 0) {
      setText(questionContext);
      setCurrentStep('analyzing');
      setIsAnalyzing(true);
      setIsProcessing(true);
      
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        performAnalysis(questionContext, true); // Pass true for question context
      }, QUESTION_ANALYSIS_DELAY_MS);
    } else {
      setText('');
      setCurrentStep('writing');
      setIsAnalyzing(false);
    }
  }, [performAnalysis]);

  // Allow user to go back and make edits
  const goBack = useCallback(() => {
    if (currentStep === 'preview') {
      // Go back to completing at the last field (if any)
      if (missingFields.length > 0) {
        setCurrentFieldIndex(Math.max(0, missingFields.length - 1));
        setCurrentStep('completing');
      } else {
        // If there were no fields, go back to writing to edit original text
        setCurrentStep('writing');
      }
      return;
    }

    if (currentStep === 'completing') {
      if (currentFieldIndex > 0) {
        setCurrentFieldIndex(prev => Math.max(0, prev - 1));
      } else {
        setCurrentStep('writing');
      }
      return;
    }

    if (currentStep === 'analyzing') {
      // Cancel analysis and go back to writing
      setIsAnalyzing(false);
      setIsProcessing(false);
      setCurrentStep('writing');
      return;
    }
  }, [currentStep, currentFieldIndex, missingFields.length]);

  return {
    // State
    text,
    setText,
    isAnalyzing,
    extractedData,
    setExtractedData,
    missingFields,
    currentStep,
    setCurrentStep,
    isSubmitting,
    currentFieldIndex,
    fieldResponses,
    setFieldResponses,
    error,
    setError,
    labels,
    setLabels,
    highlights,
    setHighlights,
    isProcessing,
    editedPreview,
    setEditedPreview,
    isEditingDescription,
    setIsEditingDescription,
    rating,
    setRating,
    isImprovingText,
    
    // Actions
    handleAnalyze,
    handleFieldResponse,
    handleLocationSelected,
    handleSkipField,
    handleSubmit,
    performAnalysis,
    improveText,
    reset,
    initializeWithQuestion,
    goBack,
    
    // Computed
    location
  };
}
