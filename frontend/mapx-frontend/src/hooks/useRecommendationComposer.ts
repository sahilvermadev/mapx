import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { aiClient } from '@/services/aiClient';
import { buildSaveRecommendationDto } from '@/mappers/formToSaveDto';
import { recommendationsApi } from '@/services/recommendationsApi';
import { convertUsernamesToTokens } from '@/utils/mentions';
import { handleError } from '@/utils/errorHandling';

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
  specialities?: string[];
  best_times?: string;
  tips?: string;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [formattedPreview, setFormattedPreview] = useState<string>('');
  const [isFormattingPreview, setIsFormattingPreview] = useState(false);
  const [editedPreview, setEditedPreview] = useState<string>('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  const location = useLocation();

  // Helper function to prepare text for AI analysis based on context
  const prepareTextForAnalysis = useCallback((text: string, isQuestionContext: boolean = false): string => {
    if (isQuestionContext) {
      // For question context, we don't need to add a prefix
      // The AI will detect this is answering a question based on the question patterns
      return text;
    } else {
      // For standalone recommendations, ensure it starts with recommendation language
      const prefix = "I want to recommend a ";
      if (!text.toLowerCase().startsWith(prefix.toLowerCase())) {
        return prefix + text;
      }
      return text;
    }
  }, []);

  const performAnalysis = useCallback(async (textToAnalyze: string, isQuestionContext: boolean = false) => {
    try {
      console.log('Starting analysis for:', textToAnalyze, 'isQuestionContext:', isQuestionContext);
      
      const processedText = prepareTextForAnalysis(textToAnalyze, isQuestionContext);
      const analysis = await aiClient.analyze(processedText);
      
      console.log('Analysis result:', analysis);
        
      if (analysis && analysis.isGibberish) {
        setError('Please provide a meaningful recommendation. The text you entered doesn\'t seem to contain useful information.');
        setCurrentStep('writing');
        setIsAnalyzing(false);
        setIsProcessing(false);
        return;
      }

      const processedExtractedData = {
        ...analysis.extractedData,
        type: analysis.contentType,
        contentType: analysis.contentType,
        description: isQuestionContext ? (analysis.extractedData.description || processedText) : prepareTextForAnalysis(analysis.extractedData.description || processedText, false)
      };

      setExtractedData(processedExtractedData);
      setMissingFields(analysis.missingFields);
      
      if (analysis.missingFields && analysis.missingFields.length > 0) {
        console.log('Proceeding to completing step with missing fields:', analysis.missingFields);
        setCurrentStep('completing');
      } else {
        console.log('No missing fields, proceeding to preview');
        setCurrentStep('preview');
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
      setError(error instanceof Error ? error.message : 'Sorry, there was an error analyzing your recommendation. Please try again.');
      setCurrentStep('writing');
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  }, [prepareTextForAnalysis]);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) {
      setError('Please enter some text before continuing.');
      return;
    }

    if (text.trim().length < 5) {
      setError('Please enter at least 5 characters for your recommendation.');
      return;
    }

    setError(null);
    setCurrentStep('analyzing');
    setIsAnalyzing(true);
    setIsProcessing(true);

    await performAnalysis(text, false);
  }, [text, performAnalysis]);

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
        toast.error(validation.feedback || 'Please provide a more specific answer.');
        return;
      }

      const extractedValue = validation.extractedValue || String(response);
      setFieldResponses(prev => ({ ...prev, [field]: extractedValue }));
      setExtractedData(prev => ({ ...prev, [field]: extractedValue }));
      setFormattedPreview(''); // invalidate preview to force regeneration
      moveToNextField();
    } catch (error) {
      console.error('Error validating response:', error);
      setFieldResponses(prev => ({ ...prev, [field]: response }));
      setExtractedData(prev => ({ ...prev, [field]: response }));
      setFormattedPreview(''); // invalidate preview to force regeneration
      moveToNextField();
    }
  }, [missingFields, currentFieldIndex]);

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
  }, [missingFields, currentFieldIndex]);

  const handleSkipField = useCallback(() => {
    moveToNextField();
  }, []);

  const moveToNextField = useCallback(() => {
    if (currentFieldIndex < missingFields.length - 1) {
      setCurrentFieldIndex(prev => prev + 1);
    } else {
      setCurrentStep('preview');
    }
  }, [currentFieldIndex, missingFields.length]);

  const handleSubmit = useCallback(async (getMapping: () => Record<string, any>) => {
    setIsSubmitting(true);
    
    try {
      const textWithTokens = convertUsernamesToTokens(text, getMapping());
      const baseFormatted = editedPreview || formattedPreview || await formatRecommendationText(extractedData, fieldResponses);
      const formattedRecommendation = convertUsernamesToTokens(baseFormatted, getMapping());
      
      const finalData = {
        ...extractedData,
        ...fieldResponses,
        originalText: textWithTokens,
        formattedText: formattedRecommendation,
        type: extractedData.type || 'place',
        contentType: (extractedData as any).contentType || extractedData.type || 'place'
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
      throw new Error('Failed to save recommendation');
    } catch (error) {
      handleError(error, {
        context: 'RecommendationComposer.handleSubmit',
        showToast: true,
        fallbackMessage: 'Sorry, there was an error saving your recommendation. Please try again.'
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [text, editedPreview, formattedPreview, extractedData, fieldResponses, rating, currentUserId, labels, questionId]);

  const formatRecommendationText = useCallback(async (data: ExtractedData, fieldResponses: Record<string, string>) => {
    try {
      const consolidated = { ...data, ...fieldResponses };
      
      try {
        const llmFormatted = await aiClient.format(consolidated, text);
        if (llmFormatted) {
          return llmFormatted;
        }
      } catch (error) {
        // Log AI formatting error but fall back silently
        handleError(error, {
          context: 'RecommendationComposer.formatRecommendationText',
          showToast: false,
          logError: true
        });
      }
      
      return formatRecommendationTextSync(data, fieldResponses);
    } catch (error) {
      return text || 'Recommendation shared';
    }
  }, [text]);

  const formatRecommendationTextSync = useCallback((data: ExtractedData, fieldResponses: Record<string, string>) => {
    try {
      const consolidated = { ...data, ...fieldResponses };
      
      const name = consolidated.name || consolidated.location_name || 'This place';
      const locationLine = consolidated.location || consolidated.location_address || '';
      const contactInfo = typeof consolidated.contact_info === 'string' 
        ? { phone: consolidated.contact_info }
        : (consolidated.contact_info || {});
      const phone = contactInfo.phone || fieldResponses.phone || '';
      const email = contactInfo.email || fieldResponses.email || '';
      const category = consolidated.category || '';
      const pricing = consolidated.pricing || fieldResponses.pricing || fieldResponses.price || '';
      const qualities = [fieldResponses.trustworthy, fieldResponses.affordable, fieldResponses.reliable]
        .filter(Boolean)
        .join(', ');

      const lines: string[] = [];
      lines.push(`${name}${category ? ` — ${category}` : ''}.`);
      if (locationLine) lines.push(`Address: ${locationLine}.`);
      if (pricing) lines.push(`Pricing: ${pricing}.`);
      if (qualities) lines.push(`Notes: ${qualities}.`);
      if (phone || email) {
        const parts = [] as string[];
        if (phone) parts.push(`Phone ${phone}`);
        if (email) parts.push(`Email ${email}`);
        lines.push(`Contact: ${parts.join(', ')}.`);
      }
      if (consolidated.best_times) lines.push(`Best time: ${consolidated.best_times}.`);
      if (consolidated.tips) lines.push(`Tip: ${consolidated.tips}.`);
      if (consolidated.specialities) {
        const specialities = Array.isArray(consolidated.specialities) ? consolidated.specialities : [consolidated.specialities];
        if (specialities.length > 0) lines.push(`specialities: ${specialities.join(', ')}.`);
      }
      if (consolidated.rating) lines.push(`Rating: ${consolidated.rating}/5.`);

      return lines.join('\n');
    } catch (error) {
      return text || 'Recommendation shared';
    }
  }, [text]);

  const reset = useCallback(() => {
    setText('');
    setExtractedData({});
    setMissingFields([]);
    setCurrentFieldIndex(0);
    setFieldResponses({});
    setError(null);
    setIsProcessing(false);
    setFormattedPreview('');
    setIsFormattingPreview(false);
    setEditedPreview('');
    setIsEditingDescription(false);
    setRating(null);
    setLabels([]);
  }, []);

  const initializeWithQuestion = useCallback((questionContext: string) => {
    if (questionContext && typeof questionContext === 'string' && questionContext.trim().length > 0) {
      console.log('Question context detected, starting analysis:', questionContext);
      setText(questionContext);
      setCurrentStep('analyzing');
      setIsAnalyzing(true);
      setIsProcessing(true);
      
      setTimeout(() => {
        performAnalysis(questionContext, true); // Pass true for question context
      }, 100);
    } else {
      console.log('No question context, starting with writing step');
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
    missingFields,
    currentStep,
    setCurrentStep,
    isSubmitting,
    currentFieldIndex,
    fieldResponses,
    error,
    setError,
    labels,
    setLabels,
    isProcessing,
    formattedPreview,
    setFormattedPreview,
    isFormattingPreview,
    setIsFormattingPreview,
    editedPreview,
    setEditedPreview,
    isEditingDescription,
    setIsEditingDescription,
    rating,
    setRating,
    
    // Actions
    handleAnalyze,
    handleFieldResponse,
    handleLocationSelected,
    handleSkipField,
    handleSubmit,
    performAnalysis,
    formatRecommendationText,
    formatRecommendationTextSync,
    reset,
    initializeWithQuestion,
    goBack,
    
    // Computed
    location
  };
}
