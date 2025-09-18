import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle, ArrowLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/services/api';

interface RecommendationComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
  currentUserId: string;
}

interface ExtractedData {
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
  specialties?: string[];
  best_times?: string;
  tips?: string;
  type?: 'place' | 'service' | 'tip' | 'contact';
}

interface MissingField {
  field: string;
  question: string;
  required: boolean;
}

const RecommendationComposer: React.FC<RecommendationComposerProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  currentUserId
}) => {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [currentStep, setCurrentStep] = useState<'writing' | 'analyzing' | 'completing' | 'preview' | 'complete'>('writing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [fieldResponses, setFieldResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUser = apiClient.getCurrentUser();

  // Auto-focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Auto-focus input when completing step is shown
  useEffect(() => {
    if (currentStep === 'completing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStep]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setText('');
      setExtractedData({});
      setMissingFields([]);
      setCurrentStep('writing');
      setCurrentFieldIndex(0);
      setFieldResponses({});
      setError(null);
    }
  }, [isOpen]);

  const handleAnalyze = async () => {
    if (!text.trim()) {
      setError('Please enter some text before continuing.');
      return;
    }

    if (text.trim().length < 5) {
      setError('Please enter at least 5 characters for your recommendation.');
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setCurrentStep('analyzing');

    try {
      // Call the new intelligent recommendation AI
      const response = await fetch('http://localhost:5000/api/ai-recommendation/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          currentUserId: currentUserId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error occurred' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const analysis = result.data;
        
        // Check if the text is gibberish or invalid
        if (analysis.isGibberish || !analysis.isValid) {
          setError('Please provide a meaningful recommendation. The text you entered doesn\'t seem to contain useful information.');
          setCurrentStep('writing');
          return;
        }

        // Set extracted data and missing fields from AI analysis
        setExtractedData(analysis.extractedData);
        setMissingFields(analysis.missingFields);
        
        // If no missing fields, go directly to preview
        if (analysis.missingFields.length === 0) {
          setCurrentStep('preview');
        } else {
          setCurrentStep('completing');
        }
      } else {
        throw new Error(result.error || 'Failed to analyze recommendation');
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
      setError(error instanceof Error ? error.message : 'Sorry, there was an error analyzing your recommendation. Please try again.');
      setCurrentStep('writing');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleFieldResponse = async (field: string, response: string) => {
    if (!response.trim()) return;

    try {
      // Validate the response with AI
      const validationResponse = await fetch('http://localhost:5000/api/ai-recommendation/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: missingFields[currentFieldIndex]?.question || '',
          userResponse: response,
          expectedField: field,
          currentUserId: currentUserId
        }),
      });

      const validationResult = await validationResponse.json();
      
      if (validationResult.success) {
        const validation = validationResult.data;
        
        if (!validation.isValid) {
          alert(validation.feedback || 'Please provide a more specific answer.');
          return;
        }

        // Use the extracted value from AI validation
        const extractedValue = validation.extractedValue || response;
        
        setFieldResponses(prev => ({ ...prev, [field]: extractedValue }));
        
        // Update extracted data
        setExtractedData(prev => ({
          ...prev,
          [field]: extractedValue
        }));

        // Move to next field
        moveToNextField();
      } else {
        // Fallback to simple validation
        setFieldResponses(prev => ({ ...prev, [field]: response }));
        setExtractedData(prev => ({ ...prev, [field]: response }));
        
        moveToNextField();
      }
    } catch (error) {
      console.error('Error validating response:', error);
      // Fallback to simple validation
      setFieldResponses(prev => ({ ...prev, [field]: response }));
      setExtractedData(prev => ({ ...prev, [field]: response }));
      
      moveToNextField();
    }
  };

  const handleSkipField = () => {
    // Mark the field as skipped (don't add to fieldResponses)
    // Just move to the next field
    moveToNextField();
  };

  const moveToNextField = () => {
    if (currentFieldIndex < missingFields.length - 1) {
      setCurrentFieldIndex(prev => prev + 1);
    } else {
      // All fields completed - go to preview
      setCurrentStep('preview');
    }
  };

  const handleApprovePreview = () => {
    setCurrentStep('complete');
    handleSubmit();
  };

  const handleEditPreview = () => {
    setIsEditingPreview(true);
    setEditedPreview(formattedPreview || formatRecommendationTextSync(extractedData, fieldResponses));
  };

  const handleSaveEdit = () => {
    setFormattedPreview(editedPreview);
    setIsEditingPreview(false);
  };

  const handleCancelEdit = () => {
    setIsEditingPreview(false);
    setEditedPreview('');
  };

  const StarRating: React.FC<{ rating: number | null; onRatingChange: (rating: number) => void }> = ({ rating, onRatingChange }) => {
    return (
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            className="focus:outline-none focus:ring-2 focus:ring-yellow-300 rounded-full p-1 transition-all duration-200 hover:scale-110"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={`h-10 w-10 transition-all duration-200 ${
                rating && star <= rating
                  ? 'text-yellow-400 fill-yellow-400 drop-shadow-sm'
                  : 'text-gray-300 hover:text-yellow-200 hover:fill-yellow-100'
              }`}
            />
          </button>
        ))}
        {rating && (
          <span className="ml-3 text-sm font-medium text-gray-600">
            {rating}/5
          </span>
        )}
      </div>
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('=== RECOMMENDATION COMPOSER SUBMIT START ===');
      console.log('RecommendationComposer - currentUserId:', currentUserId);
      console.log('RecommendationComposer - currentUser from apiClient:', currentUser);
      console.log('RecommendationComposer - extractedData:', extractedData);
      console.log('RecommendationComposer - fieldResponses:', fieldResponses);
      console.log('RecommendationComposer - text:', text);
      
      // Use the edited preview if available, otherwise create formatted recommendation text
      const formattedRecommendation = editedPreview || formattedPreview || await formatRecommendationText(extractedData, fieldResponses);
      
      // Combine original text with field responses
      const finalData = {
        ...extractedData,
        ...fieldResponses,
        originalText: text,
        formattedText: formattedRecommendation,
        // Ensure we have the content type from the AI analysis
        type: extractedData.type || 'place'
      };
      
      console.log('RecommendationComposer - finalData:', finalData);

      // Map extracted data to the format expected by the backend
      const requestBody = {
        // Place data
        place_name: finalData.name || 'Unnamed Place',
        place_address: finalData.location || '',
        place_lat: finalData.lat || null,
        place_lng: finalData.lng || null,
        place_category: finalData.category || null,
        place_metadata: {
          contact_info: finalData.contact_info,
          specialties: finalData.specialties,
          best_times: finalData.best_times,
          tips: finalData.tips,
          type: finalData.type
        },
        
        // Annotation data
        notes: formattedRecommendation,
        rating: rating || finalData.rating || null,
        visibility: 'public', // Default to public for now
        labels: finalData.specialties || [],
        
        // User data
        user_id: currentUserId
      };
      
      console.log('RecommendationComposer - API request body:', requestBody);
      console.log('RecommendationComposer - Making API call to:', 'http://localhost:5000/api/recommendations/save');
      
      const response = await fetch('http://localhost:5000/api/recommendations/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('RecommendationComposer - API response status:', response.status);
      console.log('RecommendationComposer - API response headers:', response.headers);
      
      const result = await response.json();
      console.log('RecommendationComposer - API response body:', result);
      
      if (result.success) {
        console.log('RecommendationComposer - Success! Calling onPostCreated()');
        onPostCreated();
        onClose();
      } else {
        console.error('RecommendationComposer - API returned error:', result);
        throw new Error(result.error || 'Failed to save recommendation');
      }
    } catch (error) {
      console.error('Error submitting recommendation:', error);
      alert('Sorry, there was an error saving your recommendation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const renderWritingStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left space-y-8 py-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-6xl font-light text-black leading-tight">
          What would you like to recommend?
        </h1>

        {error && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <span className="text-sm font-medium">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0 text-red-700 hover:bg-red-100"
              >
                ×
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Tell us about a new spot, service, or tip..."
          className="min-h-[200px] text-2xl resize-none border-none border-b border-gray-300 rounded-none focus:border-0 focus:border-b focus:border-gray-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-white px-0 text-black placeholder:text-gray-400 text-left"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleAnalyze();
              }
            }}
          />
        </div>
        
        <div className="flex justify-center">
          <Button
            onClick={handleAnalyze}
            disabled={!text.trim() || isAnalyzing}
            className="px-8 py-3 text-lg font-medium bg-black hover:bg-gray-800 text-white rounded-lg border-0 shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3" />
                Analyzing...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );

  const renderAnalyzingStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-left space-y-8 py-8"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="flex justify-center"
      >
        <Sparkles className="h-20 w-20 text-primary" />
      </motion.div>
      
      <h1 className="text-5xl font-light text-black leading-tight">
        Analyzing your recommendation
      </h1>
    </motion.div>
  );

  const renderCompletingStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left space-y-8 py-8"
    >
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-5xl font-light text-black leading-tight">
          {missingFields[currentFieldIndex]?.question || "Additional Information"}
        </h1>

        {missingFields.length > 0 && currentFieldIndex < missingFields.length && (
          <div className="space-y-8">
            <div className="relative">
        <Input
          ref={inputRef}
          placeholder="Your answer..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              handleFieldResponse(missingFields[currentFieldIndex].field, input.value);
              input.value = '';
            }
          }}
          className="text-2xl border border-gray-300 rounded-lg focus:border-gray-500 focus:ring-0 bg-white px-4 py-3 text-black placeholder:text-gray-400 text-left"
        />
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleSkipField}
              variant="outline"
              className="px-6 py-2 text-base font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 shadow-sm transition-colors duration-200"
            >
              Skip
            </Button>
            <Button
              onClick={() => {
                if (inputRef.current) {
                  handleFieldResponse(missingFields[currentFieldIndex].field, inputRef.current.value);
                  inputRef.current.value = '';
                }
              }}
              className="px-8 py-3 text-lg font-medium bg-black hover:bg-gray-800 text-white rounded-lg border-0 shadow-sm transition-colors duration-200"
            >
              Continue
            </Button>
            </div>
          </div>
        )}

        {currentFieldIndex >= missingFields.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-16"
        >
          <h1 className="text-5xl font-light text-black leading-tight">
            Ready to share!
          </h1>
          
          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 text-lg font-medium bg-black hover:bg-gray-800 text-white rounded-lg border-0 shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3" />
                  Posting...
                </>
              ) : (
                'Post Recommendation'
              )}
            </Button>
          </div>
        </motion.div>
        )}
      </div>
    </motion.div>
  );

  const generateLLMFormattedPost = async (consolidated: any) => {
    try {
      console.log('=== LLM FORMATTING REQUEST ===');
      console.log('generateLLMFormattedPost - consolidated data:', consolidated);
      console.log('generateLLMFormattedPost - original text:', text);
      
      const requestBody = {
        data: consolidated,
        originalText: text,
        currentUserId: currentUserId
      };
      
      console.log('generateLLMFormattedPost - request body:', requestBody);
      
      const response = await fetch('http://localhost:5000/api/ai-recommendation/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('generateLLMFormattedPost - response status:', response.status);
      
      const result = await response.json();
      console.log('generateLLMFormattedPost - response result:', result);
      
      if (result.success && result.formattedText) {
        console.log('generateLLMFormattedPost - formatted text:', result.formattedText);
        return result.formattedText;
      }
      return null;
    } catch (error) {
      console.error('Error calling LLM formatting API:', error);
      return null;
    }
  };

  const formatRecommendationTextSync = (data: ExtractedData, fieldResponses: Record<string, string>) => {
    try {
      const consolidated = { ...data, ...fieldResponses };
      
      console.log('formatRecommendationTextSync - data:', data);
      console.log('formatRecommendationTextSync - fieldResponses:', fieldResponses);
      console.log('formatRecommendationTextSync - consolidated:', consolidated);
      
      // Manual formatting (synchronous)
      let formattedText = '';
    
      // Start with the main description or original text
      if (consolidated.description) {
        formattedText = consolidated.description;
      } else if (text) {
        formattedText = text;
      }
      
      // Add location if available
      if (consolidated.location) {
        formattedText += `\n\n📍 Located at: ${consolidated.location}`;
      }
      
      // Add category if available
      if (consolidated.category) {
        formattedText += `\n\n🏷️ Category: ${consolidated.category}`;
      }
      
      // Add rating if available
      if (consolidated.rating) {
        const stars = '⭐'.repeat(consolidated.rating);
        formattedText += `\n\n${stars} Rating: ${consolidated.rating}/5`;
      }
      
      // Add contact information if available
      if (consolidated.contact_info) {
        const contactInfo = typeof consolidated.contact_info === 'string' 
          ? { phone: consolidated.contact_info } 
          : consolidated.contact_info;
          
        if (contactInfo?.phone || contactInfo?.email) {
          formattedText += '\n\n📞 Contact:';
          if (contactInfo.phone) {
            formattedText += `\nPhone: ${contactInfo.phone}`;
          }
          if (contactInfo.email) {
            formattedText += `\nEmail: ${contactInfo.email}`;
          }
        }
      }
      
      // Add specialties if available
      if (consolidated.specialties) {
        const specialties = Array.isArray(consolidated.specialties) 
          ? consolidated.specialties 
          : [consolidated.specialties];
        if (specialties.length > 0) {
          formattedText += `\n\n🎯 Specialties: ${specialties.join(', ')}`;
        }
      }
      
      // Add best times if available
      if (consolidated.best_times) {
        formattedText += `\n\n⏰ Best times: ${consolidated.best_times}`;
      }
      
      // Add tips if available
      if (consolidated.tips) {
        formattedText += `\n\n💡 Tips: ${consolidated.tips}`;
      }
      
      return formattedText;
    } catch (error) {
      console.error('Error formatting recommendation text:', error);
      // Fallback to original text if formatting fails
      return text || 'Recommendation shared';
    }
  };

  const formatRecommendationText = async (data: ExtractedData, fieldResponses: Record<string, string>) => {
    try {
      const consolidated = { ...data, ...fieldResponses };
      
      console.log('formatRecommendationText - data:', data);
      console.log('formatRecommendationText - fieldResponses:', fieldResponses);
      console.log('formatRecommendationText - consolidated:', consolidated);
      
      // Try to use LLM to create a well-written post
      try {
        const llmFormatted = await generateLLMFormattedPost(consolidated);
        if (llmFormatted) {
          return llmFormatted;
        }
      } catch (error) {
        console.log('LLM formatting failed, falling back to manual formatting:', error);
      }
      
      // Fallback to manual formatting
      return formatRecommendationTextSync(data, fieldResponses);
    } catch (error) {
      console.error('Error formatting recommendation text:', error);
      // Fallback to original text if formatting fails
      return text || 'Recommendation shared';
    }
  };

  // Minimal rich-text renderer for labeled lines and basic markdown (bold/italics)
  const renderRichPreview = (textContent: string) => {
    const lines = textContent.split('\n');
    return (
      <div className="space-y-2 text-left">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-2" />;
          }
          // Bullet list support: lines starting with "- "
          if (trimmed.startsWith('- ')) {
            const content = trimmed.slice(2);
            return (
              <div key={idx} className="flex items-start gap-2">
                <span className="mt-[6px] h-[4px] w-[4px] rounded-full bg-gray-400" />
                <span className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: inlineMarkdown(content) }} />
              </div>
            );
          }
          // Labeled line: Label: Value
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
            const label = trimmed.slice(0, colonIndex).trim();
            const value = trimmed.slice(colonIndex + 1).trim();
            return (
              <p key={idx} className="text-sm text-gray-800">
                <span className="font-semibold text-gray-900">{label}:</span> <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(value) }} />
              </p>
            );
          }
          // Default paragraph with inline markdown
          return (
            <p key={idx} className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed) }} />
          );
        })}
      </div>
    );
  };

  // Very small inline markdown converter for **bold** and _italics_
  const inlineMarkdown = (s: string): string => {
    // Escape basic HTML
    const escaped = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Bold: **text**
    const withBold = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic: _text_
    const withItalics = withBold.replace(/_([^_]+)_/g, '<em>$1</em>');
    return withItalics;
  };

  const [formattedPreview, setFormattedPreview] = useState<string>('');
  const [isFormattingPreview, setIsFormattingPreview] = useState(false);
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [editedPreview, setEditedPreview] = useState<string>('');
  const [rating, setRating] = useState<number | null>(null);

  // Reset formatted preview when leaving preview step
  useEffect(() => {
    if (currentStep !== 'preview') {
      setFormattedPreview('');
      setIsFormattingPreview(false);
      setIsEditingPreview(false);
      setEditedPreview('');
      setRating(null);
    }
  }, [currentStep]);

  // Generate LLM-formatted preview when reaching preview step
  useEffect(() => {
    if (currentStep === 'preview' && !formattedPreview && !isFormattingPreview) {
      setIsFormattingPreview(true);
      
      const generatePreview = async () => {
        try {
          const llmFormatted = await generateLLMFormattedPost({ ...extractedData, ...fieldResponses });
          if (llmFormatted) {
            setFormattedPreview(llmFormatted);
          }
        } catch (error) {
          console.error('Error generating LLM preview:', error);
          // Set fallback formatted text to prevent infinite retries
          setFormattedPreview(formatRecommendationTextSync(extractedData, fieldResponses));
        } finally {
          setIsFormattingPreview(false);
        }
      };
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (isFormattingPreview) {
          console.log('LLM formatting timeout, using fallback');
          setFormattedPreview(formatRecommendationTextSync(extractedData, fieldResponses));
          setIsFormattingPreview(false);
        }
      }, 10000); // 10 second timeout
      
      generatePreview();
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentStep]); // Only depend on currentStep to avoid infinite loop

  const renderPreviewStep = () => {
    // Use the formatted preview if available, otherwise fallback to sync formatting
    const displayText = formattedPreview || formatRecommendationTextSync(extractedData, fieldResponses);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center space-y-6 py-6"
      >

        <div className="max-w-3xl mx-auto space-y-4">
          {/* Recommendation Content */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            {isEditingPreview ? (
              <div className="space-y-4">
                <Textarea
                  value={editedPreview}
                  onChange={(e) => setEditedPreview(e.target.value)}
                  className="min-h-[300px] text-sm resize-none border border-gray-200 rounded-lg focus:border-gray-400 focus:ring-0 bg-white px-4 py-3 text-gray-800"
                  placeholder="Edit your recommendation..."
                />
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    className="px-4 py-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-black hover:bg-gray-800 text-white"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-gray-800 text-sm leading-relaxed text-left">
                {isFormattingPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                      <span className="text-gray-600">Creating your post...</span>
                    </div>
                  </div>
                ) : (
                  renderRichPreview(displayText)
                )}
              </div>
            )}
          </div>

          {/* Rating Section - Better positioned */}
          {!isEditingPreview && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-center space-y-3">
                <h3 className="text-sm font-medium text-gray-800">How would you rate this?</h3>
                <p className="text-xs text-gray-500">Your rating helps others understand the quality of this recommendation</p>
                <StarRating rating={rating} onRatingChange={setRating} />
                {rating && (
                  <p className="text-xs text-gray-500">
                    {rating === 1 && "Not it!"}
                    {rating === 2 && "Just okay!"}
                    {rating === 3 && "Worth trying!"}
                    {rating === 4 && "Really good!"}
                    {rating === 5 && "Truly exceptional!"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {!isEditingPreview && (
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleEditPreview}
              className="px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-200 shadow-sm transition-colors duration-200"
            >
              Edit
            </Button>
            <Button
              onClick={handleApprovePreview}
              className="px-6 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-md border-0 shadow-sm transition-colors duration-200"
            >
              Post Recommendation
            </Button>
          </div>
        )}
      </motion.div>
    );
  };

  const renderCompleteStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-left space-y-8 py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
        className="flex justify-center"
      >
        <CheckCircle className="h-20 w-20 text-green-600" />
      </motion.div>
      
      <h1 className="text-5xl font-light text-black leading-tight">
        Recommendation posted!
      </h1>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10"
              >
                <ArrowLeft className="h-5 w-5 text-gray-800" />
              </Button>
              {currentStep === 'preview' && (
                <h1 className="text-lg font-semibold text-gray-900">
                  {isEditingPreview ? 'Edit Your Post' : 'Review Your Post'}
                </h1>
              )}
              <div className="w-10" /> {/* Spacer for centering */}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="min-h-full flex items-center justify-center p-12">
                <div className="w-full max-w-4xl">
                  <AnimatePresence mode="wait">
                    {currentStep === 'writing' && renderWritingStep()}
                    {currentStep === 'analyzing' && renderAnalyzingStep()}
                    {currentStep === 'completing' && renderCompletingStep()}
                    {currentStep === 'preview' && renderPreviewStep()}
                    {currentStep === 'complete' && renderCompleteStep()}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RecommendationComposer;
