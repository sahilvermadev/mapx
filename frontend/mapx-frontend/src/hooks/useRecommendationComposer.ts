import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { aiClient } from '@/services/aiClient';
import { buildSaveRecommendationDto } from '@/mappers/formToSaveDto';
import { recommendationsApi } from '@/services/recommendationsApi';
import { convertUsernamesToTokens } from '@/utils/mentions';
import { handleError } from '@/utils/errorHandling';
import {
  ERROR_MESSAGES,
  type ContentType,
  CONTENT_TYPES,
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

export type ComposerStep =
  | 'content-type-selection'
  | 'map-selection'
  | 'service-basics'
  | 'service-details'
  | 'preview';

export interface QuestionMetadata {
  detected_category?: {
    content_type: 'place' | 'service' | 'unclear';
    service_category_id: number | null;
    service_category_slug: string | null;
    confidence: number;
  };
}

export function useRecommendationComposer(
  currentUserId: string, 
  questionId?: number,
  questionMetadata?: QuestionMetadata
) {
  const [text, setText] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  // Initialize step based on question metadata if available
  const [currentStep, setCurrentStep] = useState<ComposerStep>(() => {
    // If we have question metadata with a detected category, start at the appropriate step
    if (questionMetadata?.detected_category) {
      const contentType = questionMetadata.detected_category.content_type;
      if (contentType === 'service') {
        return 'service-basics';
      } else if (contentType === 'place') {
        return 'map-selection';
      }
    }
    // Default to content-type-selection
    return 'content-type-selection';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldResponses, setFieldResponses] = useState<Record<string, any>>({});
  const [labels, setLabels] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string>('');
  const [editedPreview, setEditedPreview] = useState<string>('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [isImprovingText, setIsImprovingText] = useState(false);
  // Service details state
  const [serviceDetails, setServiceDetails] = useState<Record<string, any>>({});
  // Explicit content type (set by user, bypasses AI classification)
  const [explicitContentType, setExplicitContentType] = useState<'place' | 'service' | null>(null);
  // Service basics data (from ServiceBasicsStep)
  const [serviceBasics, setServiceBasics] = useState<{
    category_id: number | null;
    name: string;
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
  } | null>(null);

  const location = useLocation();

  // Handler for place selection from map (for place recommendations)
  const handlePlaceSelectedFromMap = useCallback((location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
    city_name?: string;
    admin1_name?: string;
    country_code?: string;
  }) => {
    // Extract place name, address, coordinates, Google Place ID
    // Set extractedData with all location fields
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
      type: 'place' as const,
      contentType: 'place' as const,
    };

    setExtractedData(prev => ({
      ...prev,
      ...locationUpdate,
    }));

    setFieldResponses(prev => ({
      ...prev,
      ...locationUpdate,
    }));

    // Move directly to PreviewStep
    setCurrentStep('preview');
  }, []);

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
      
      // For services, use explicit contentType and serviceBasics data
      // Normalize to valid ContentType (only 'place', 'service', or 'unclear')
      const rawContentType = explicitContentType || extractedData.type || 'place';
      const contentType: ContentType = 
        rawContentType === CONTENT_TYPES.PLACE || 
        rawContentType === CONTENT_TYPES.SERVICE || 
        rawContentType === CONTENT_TYPES.UNCLEAR
          ? rawContentType
          : CONTENT_TYPES.PLACE; // Default to 'place' for invalid types like 'tip' or 'contact'
      
      // Build description for services from serviceDetails.experience_summary (primary)
      // or editedPreview (if user edited it), or text
      let serviceDescription = formattedRecommendation;
      if (contentType === 'service') {
        if (serviceDetails.experience_summary?.trim()) {
          serviceDescription = serviceDetails.experience_summary;
        } else if (editedPreview?.trim()) {
          // Use edited preview text if user edited it
          serviceDescription = editedPreview;
        } else if (text.trim()) {
          serviceDescription = text;
        } else {
          // Fallback: use service name as description
          serviceDescription = serviceBasics?.name || extractedData.name || 'Service recommendation';
        }
      }

      const finalData = {
        ...extractedData,
        ...fieldResponses,
        ...serviceDetails,
        ...(serviceBasics ? {
          service_name: serviceBasics.name,
          service_address: serviceBasics.city_location?.name,
          service_phone: serviceBasics.phone,
          service_email: serviceBasics.email,
          contact_info: {
            phone: serviceBasics.phone,
            email: serviceBasics.email,
          },
          phone_country_code: serviceBasics.phone_country_code,
          city_name: serviceBasics.city_location?.city_name,
          admin1_name: serviceBasics.city_location?.admin1_name,
          country_code: serviceBasics.city_location?.country_code,
          city_lat: serviceBasics.city_location?.lat,
          city_lng: serviceBasics.city_location?.lng,
        } : {}),
        originalText: contentType === 'service' ? (text || '') : textWithTokens,
        formattedText: contentType === 'service' ? serviceDescription : formattedRecommendation,
        type: contentType,
        contentType: contentType,
        highlights: highlights.trim() || undefined
      };

      const requestBody = buildSaveRecommendationDto({
        contentType,
        extractedData: finalData,
        fieldResponses,
        formattedRecommendation: contentType === 'service' ? serviceDescription : formattedRecommendation,
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
  }, [text, editedPreview, extractedData, fieldResponses, serviceDetails, serviceBasics, explicitContentType, rating, currentUserId, labels, highlights, questionId]);

  const handleContentTypeSelect = useCallback((contentType: ContentType) => {
    // Only handle 'place' and 'service' explicitly; 'unclear' defaults to place flow
    if (contentType === 'service') {
      setExplicitContentType('service');
      // For services, skip writing step and go directly to service basics
      setCurrentStep('service-basics');
    } else {
      // For places, go directly to map selection step
      setExplicitContentType(contentType === 'place' ? 'place' : null);
      setCurrentStep('map-selection');
    }
  }, []);

  const handleServiceBasicsSubmit = useCallback((data: {
    category_id: number | null;
    name: string;
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
  }) => {
    setServiceBasics(data);
    // Update extractedData and fieldResponses with service basics
    // Backend will derive service_type from category_id
    setExtractedData(prev => ({
      ...prev,
      name: data.name,
      service_name: data.name,
      service_address: data.city_location?.name,
      service_category_id: data.category_id, // Backend will use this to get slug/service_type
      type: 'service',
      contentType: 'service',
      description: data.description || '',
      contact_info: {
        phone: data.phone,
        email: data.email,
      },
      // Phone country code
      phone_country_code: data.phone_country_code,
      // Structured location fields
      city_name: data.city_location?.city_name,
      admin1_name: data.city_location?.admin1_name,
      country_code: data.city_location?.country_code,
      city_lat: data.city_location?.lat,
      city_lng: data.city_location?.lng,
    }));
    setFieldResponses(prev => ({
      ...prev,
      name: data.name,
      service_name: data.name,
      service_address: data.city_location?.name,
      service_category_id: data.category_id,
      contact_info: {
        phone: data.phone,
        email: data.email,
      },
      // Phone country code
      phone_country_code: data.phone_country_code,
      // Structured location fields
      city_name: data.city_location?.city_name,
      admin1_name: data.city_location?.admin1_name,
      country_code: data.city_location?.country_code,
      city_lat: data.city_location?.lat,
      city_lng: data.city_location?.lng,
    }));
    // Move to service details step
    setCurrentStep('service-details');
  }, []);

  const reset = useCallback((skipStepReset = false) => {
    setText('');
    setExtractedData({});
    setFieldResponses({});
    setEditedPreview('');
    setIsEditingDescription(false);
    setRating(null);
    setLabels([]);
    setHighlights('');
    setIsImprovingText(false);
    setServiceDetails({});
    setExplicitContentType(null);
    setServiceBasics(null);
    
    // Only reset step if not skipping (allows initializeWithQuestion to set it directly)
    if (!skipStepReset) {
      setCurrentStep('content-type-selection');
    }
  }, []);

  const initializeWithQuestion = useCallback((questionContext: string | undefined) => {
    if (questionContext && typeof questionContext === 'string' && questionContext.trim().length > 0) {
      setText(questionContext);
      
      // Check if we have detected category from question metadata
      const detectedCategory = questionMetadata?.detected_category;
      
      if (detectedCategory && detectedCategory.content_type !== 'unclear') {
        // Route directly based on detected category
        if (detectedCategory.content_type === 'service') {
          setExplicitContentType('service');
          
          // Pre-populate service basics with detected category if available
          if (detectedCategory.service_category_id) {
            setServiceBasics({
              category_id: detectedCategory.service_category_id,
              name: '',
            });
          }
          
          setCurrentStep('service-basics');
        } else if (detectedCategory.content_type === 'place') {
          setExplicitContentType('place');
          setCurrentStep('map-selection');
        } else {
          // Fallback to content-type-selection
          setCurrentStep('content-type-selection');
        }
      } else {
        // No detected category or unclear - go directly to content-type-selection
        setCurrentStep('content-type-selection');
      }
    } else {
      setText('');
      // Start with content type selection for new recommendations
      setCurrentStep('content-type-selection');
    }
  }, [questionMetadata]);

  // Allow user to go back and make edits
  const goBack = useCallback(() => {
    if (currentStep === 'preview') {
      // For services, go back to service-details
      if (explicitContentType === 'service') {
        setCurrentStep('service-details');
        return;
      }
      // For places, go back to map-selection
      if (explicitContentType === 'place') {
        setCurrentStep('map-selection');
        return;
      }
      // Default: go to content type selection
      setCurrentStep('content-type-selection');
      return;
    }

    if (currentStep === 'map-selection') {
      setCurrentStep('content-type-selection');
      return;
    }

    if (currentStep === 'service-details') {
      setCurrentStep('service-basics');
      return;
    }

    if (currentStep === 'service-basics') {
      setCurrentStep('content-type-selection');
      return;
    }
  }, [currentStep, explicitContentType]);

  return {
    // State
    text,
    setText,
    extractedData,
    setExtractedData,
    currentStep,
    setCurrentStep,
    isSubmitting,
    fieldResponses,
    setFieldResponses,
    labels,
    setLabels,
    highlights,
    setHighlights,
    editedPreview,
    setEditedPreview,
    isEditingDescription,
    setIsEditingDescription,
    rating,
    setRating,
    isImprovingText,
    // Actions
    handlePlaceSelectedFromMap,
    handleSubmit,
    improveText,
    reset,
    initializeWithQuestion,
    goBack,
    handleContentTypeSelect,
    handleServiceBasicsSubmit,
    
    // Service details
    serviceDetails,
    setServiceDetails,
    serviceBasics,
    explicitContentType,
    
    // Computed
    location
  };
}
