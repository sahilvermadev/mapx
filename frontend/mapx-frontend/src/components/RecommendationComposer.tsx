import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/auth';
import { insertPlainMention, convertUsernamesToTokens } from '@/utils/mentions';
import { aiClient } from '@/services/aiClient';
import { buildSaveRecommendationDto } from '@/mappers/formToSaveDto';
import { recommendationsApi } from '@/services/recommendationsApi';
import { useMentions } from '@/hooks/useMentions';
import AnalyzingStep from '@/components/composer/steps/AnalyzingStep';
import CompletingStep from '@/components/composer/steps/CompletingStep';
import PreviewStep from '@/components/composer/steps/PreviewStep';

// Computes caret pixel coordinates for accurate @mention picker anchoring
const getCaretGlobalPosition = (textarea: HTMLTextAreaElement, position: number) => {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement('div');
  const span = document.createElement('span');
  const properties = [
    'borderLeftWidth','borderTopWidth','borderRightWidth','borderBottomWidth',
    'fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','textTransform','textAlign','textIndent',
    'whiteSpace','wordBreak','wordWrap','overflowWrap','paddingLeft','paddingTop','paddingRight','paddingBottom',
    'lineHeight','width'
  ];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  properties.forEach(prop => { (div.style as any)[prop] = (style as any)[prop]; });
  div.style.width = style.width;
  const value = textarea.value;
  const textBefore = value.substring(0, position);
  const textAfter = value.substring(position) || '.';
  div.textContent = textBefore;
  span.textContent = textAfter;
  div.appendChild(span);
  document.body.appendChild(div);
  const taRect = textarea.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const left = Math.min(taRect.left + (spanRect.left - divRect.left), taRect.right - 4);
  const top = taRect.top + (spanRect.top - divRect.top);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  document.body.removeChild(div);
  return { left: left + window.scrollX, top: top + window.scrollY + lineHeight, lineHeight };
};

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
  specialities?: string[];
  best_times?: string;
  tips?: string;
  type?: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  // Location picker fields
  location_name?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  location_google_place_id?: string;
  google_place_id?: string;
  [key: string]: any; // Allow additional dynamic fields
}

interface MissingField {
  field: string;
  question: string;
  required: boolean;
  needsLocationPicker?: boolean;
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
  const [fieldResponses, setFieldResponses] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  // Mentions state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  // Track selection if needed for future use (currently unused)
  // const [cursorPos, setCursorPos] = useState<number>(0);
  // Mentions mapping is handled via useMentions hook
  const mentions = useMentions();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { user: currentUser } = useAuth();

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
      setMentionQuery(null);
      setMentionSuggestions([]);
      setShowMentionMenu(false);
      setMentionPosition(null);
    }
  }, [isOpen]);

  // Fetch mention suggestions
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!mentionQuery || mentionQuery.length < 1) {
        if (active) setMentionSuggestions([]);
        return;
      }
      const list = await mentions.suggest(mentionQuery, currentUserId);
      if (active) setMentionSuggestions(list);
    };
    run();
    return () => { active = false; };
  }, [mentionQuery, currentUserId]);

  // Helper function to ensure description starts with "I want to recommend a "
  const ensureRecommendationPrefix = (description: string): string => {
    const prefix = "I want to recommend a ";
    if (!description.toLowerCase().startsWith(prefix.toLowerCase())) {
      return prefix + description;
    }
    return description;
  };

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
      // Ensure the text sent to AI includes the recommendation prefix
      const processedText = ensureRecommendationPrefix(text);
      
      // Call the AI analyze via client
      const analysis = await aiClient.analyze(processedText);
        
        // Check if the text is gibberish or invalid
        if (analysis.isGibberish || !analysis.isValid) {
          setError('Please provide a meaningful recommendation. The text you entered doesn\'t seem to contain useful information.');
          setCurrentStep('writing');
          return;
        }

        // Ensure description starts with "I want to recommend a "
        const processedExtractedData = {
          ...analysis.extractedData,
          // Map AI contentType -> local "type" field used by submit flow
          type: analysis.contentType,
          // Keep a canonical contentType field as well for downstream consumers (e.g., formatter)
          contentType: analysis.contentType,
          description: ensureRecommendationPrefix(analysis.extractedData.description || processedText)
        };

        // Set processed extracted data and missing fields from AI analysis
        setExtractedData(processedExtractedData);
        setMissingFields(analysis.missingFields);
        
        // If no missing fields, go directly to preview
        if (analysis.missingFields.length === 0) {
          setCurrentStep('preview');
        } else {
          setCurrentStep('completing');
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
      setError(error instanceof Error ? error.message : 'Sorry, there was an error analyzing your recommendation. Please try again.');
      setCurrentStep('writing');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleFieldResponse = async (field: string, response: any) => {
    if (typeof response === 'string') {
      if (!response.trim()) return;
    } else if (response == null) {
      return;
    }

    try {
      // If contact_info is an object { phone, email }, bypass AI validation and save directly
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

      // Validate the response with AI (string path)
      const validation = await aiClient.validate(
        missingFields[currentFieldIndex]?.question || '',
        String(response),
        field
      );
      
      if (!validation.isValid) {
        alert(validation.feedback || 'Please provide a more specific answer.');
        return;
      }

      // Use the extracted value from AI validation
      const extractedValue = validation.extractedValue || String(response);
      setFieldResponses(prev => ({ ...prev, [field]: extractedValue }));
      setExtractedData(prev => ({ ...prev, [field]: extractedValue }));
      moveToNextField();
    } catch (error) {
      console.error('Error validating response:', error);
      // Fallback: accept input as-is
      setFieldResponses(prev => ({ ...prev, [field]: response }));
      setExtractedData(prev => ({ ...prev, [field]: response }));
      
      moveToNextField();
    }
  };

  const handleLocationSelected = (location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    google_place_id?: string;
  }) => {
    const field = missingFields[currentFieldIndex]?.field;
    if (!field) return;
    
    const locationText = `${location.name}, ${location.address}`;
    
    // Store the location data in extracted data
    setExtractedData(prev => ({
      ...prev,
      [field]: locationText,
      [`${field}_lat`]: location.lat,
      [`${field}_lng`]: location.lng,
      [`${field}_google_place_id`]: location.google_place_id,
      [`${field}_name`]: location.name,
      [`${field}_address`]: location.address
    }));

    // Store the display text in field responses
    setFieldResponses(prev => ({ ...prev, [field]: locationText }));
    
    // Move to next field
    moveToNextField();
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
    setIsEditingDescription(true);
    const currentText = formattedPreview || formatRecommendationTextSync(extractedData, fieldResponses);
    setEditedPreview(formatTextForEditing(currentText));
  };

  const handleSaveEdit = () => {
    setFormattedPreview(editedPreview);
    setIsEditingDescription(false);
  };

  const handleCancelEdit = () => {
    setIsEditingDescription(false);
    setEditedPreview('');
  };

  // Deprecated: star rating inline UI moved into PreviewStep

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Use the edited preview if available, otherwise create formatted recommendation text
      // Before formatting/saving, convert any @username occurrences to stable @[id:name] tokens
      const textWithTokens = convertUsernamesToTokens(text, mentions.getMapping());
      const baseFormatted = editedPreview || formattedPreview || await formatRecommendationText(extractedData, fieldResponses);
      const formattedRecommendation = convertUsernamesToTokens(baseFormatted, mentions.getMapping());
      
      // Combine original text with field responses
      const finalData = {
        ...extractedData,
        ...fieldResponses,
        originalText: textWithTokens,
        formattedText: formattedRecommendation,
        // Ensure we have the content type from the AI analysis
        type: extractedData.type || 'place',
        contentType: (extractedData as any).contentType || extractedData.type || 'place'
      };
      
      // Map extracted data to the format expected by the backend (new recommendations API)
      const contentType = (finalData.type as ('place' | 'service' | 'tip' | 'contact' | 'unclear')) || 'place';

      // contentData now constructed in DTO mapper

      const requestBody = buildSaveRecommendationDto({
        contentType,
        extractedData: finalData,
        fieldResponses,
        formattedRecommendation,
        rating,
        currentUserId,
        labels
      });
      
      const result = await recommendationsApi.saveRecommendation(requestBody as any);
      
      if (result && (result as any).recommendation_id) {
        onPostCreated();
        onClose();
      } else {
        throw new Error('Failed to save recommendation');
      }
    } catch (error) {
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
        <h1 className="text-4xl font-light text-black leading-tight">
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
            const v = e.target.value;
            setText(v);
            // detect @mention
            const pos = (e.target as HTMLTextAreaElement).selectionStart || v.length;
            // track selection if needed
            const left = v.slice(0, pos);
            const at = left.lastIndexOf('@');
              if (at >= 0 && (at === 0 || /\s|[([{-]/.test(left[at - 1] || ''))) {
              const query = left.slice(at + 1);
              if (/^[\w.\-]{0,30}$/.test(query)) {
                setMentionQuery(query);
                setShowMentionMenu(true);
                if (textareaRef.current) {
                  const el = textareaRef.current;
                  const caret = getCaretGlobalPosition(el, at + 1);
                  const pickerWidth = 256;
                  const pickerHeight = 200;
                  let top = caret.top + 4;
                  let leftPx = caret.left;
                  if (top + pickerHeight > window.innerHeight + window.scrollY) {
                    top = caret.top - pickerHeight - 8;
                  }
                  if (leftPx + pickerWidth > window.innerWidth + window.scrollX) {
                    leftPx = window.innerWidth + window.scrollX - pickerWidth - 8;
                  }
                  if (leftPx < 8 + window.scrollX) leftPx = 8 + window.scrollX;
                  setMentionPosition({ top, left: leftPx });
                }
              } else {
                setShowMentionMenu(false);
                setMentionQuery(null);
              }
            } else {
              setShowMentionMenu(false);
              setMentionQuery(null);
            }
            if (error) setError(null);
          }}
          onSelect={(e) => {
            const el = e.target as HTMLTextAreaElement;
            const newPos = el.selectionStart || 0;
            if (showMentionMenu && textareaRef.current) {
              const textBeforeCursor = (el.value || '').substring(0, newPos);
              const lastAtIndex = textBeforeCursor.lastIndexOf('@');
              if (lastAtIndex !== -1) {
                const after = textBeforeCursor.substring(lastAtIndex + 1);
                if (/^[\w.\-]{0,30}$/.test(after)) {
                  const caret = getCaretGlobalPosition(textareaRef.current, newPos);
                  const pickerWidth = 256;
                  const pickerHeight = 200;
                  let top = caret.top + 4;
                  let leftPx = caret.left;
                  if (top + pickerHeight > window.innerHeight + window.scrollY) top = caret.top - pickerHeight - 8;
                  if (leftPx + pickerWidth > window.innerWidth + window.scrollX) leftPx = window.innerWidth + window.scrollX - pickerWidth - 8;
                  if (leftPx < 8 + window.scrollX) leftPx = 8 + window.scrollX;
                  setMentionPosition({ top, left: leftPx });
                }
              }
            }
          }}
          placeholder="Tell us about a new spot, service, or tip..."
          className="min-h-[200px] text-2xl resize-none border-none border-b border-gray-300 rounded-none focus:border-0 focus:border-b focus:border-gray-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-white px-0 text-black placeholder:text-gray-400 text-left"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleAnalyze();
              }
            }}
          />
          {showMentionMenu && mentionSuggestions.length > 0 && (
            <div className="fixed z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md" style={{ top: mentionPosition?.top || 0, left: mentionPosition?.left || 0 }}>
              {mentionSuggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
                  onClick={() => {
                    const sel = textareaRef.current;
                    if (!sel) return;
                    const cursor = sel.selectionStart || text.length;
                    const uname = (u.username || '').toLowerCase() || (u.display_name || u.user_name || '').toLowerCase().replace(/\s+/g, '');
                    const { text: nt, newCursor } = insertPlainMention(text, cursor, uname);
                    // remember mapping for conversion on submit
                    const display = u.display_name || u.user_name || uname;
                    mentions.rememberMapping(uname, { id: u.id, displayName: display });
                    setText(nt);
                    setShowMentionMenu(false);
                    setMentionQuery(null);
                    setMentionPosition(null);
                    requestAnimationFrame(() => {
                      sel.focus();
                      sel.setSelectionRange(newCursor, newCursor);
                    });
                  }}
                >
                  {u.profile_picture_url && (
                    <img src={u.profile_picture_url} className="h-6 w-6 rounded-full" />
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium">{u.display_name || u.user_name}</span>
                    {u.username && (
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
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
    <AnalyzingStep />
  );

  const renderCompletingStep = () => (
    <CompletingStep
      missingFields={missingFields}
      currentFieldIndex={currentFieldIndex}
      textareaRef={textareaRef}
      onFieldResponse={handleFieldResponse}
      onLocationSelected={handleLocationSelected}
      onSkipField={handleSkipField}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );

  const generateLLMFormattedPost = async (consolidated: any) => {
    try {
      const formatted = await aiClient.format(consolidated, text);
      return formatted;
    } catch (error) {
      console.warn('LLM formatting failed, using fallback:', error);
      return null;
    }
  };

  const formatRecommendationTextSync = (data: ExtractedData, fieldResponses: Record<string, string>) => {
    try {
      const consolidated = { ...data, ...fieldResponses };
      
      // Manual formatting: concise natural language, no emojis, no fluff
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
      // Fallback to original text if formatting fails
      return text || 'Recommendation shared';
    }
  };

  // Helper function to convert formatted text to continuous paragraph for editing
  const formatTextForEditing = (formattedText: string) => {
    return formattedText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const formatRecommendationText = async (data: ExtractedData, fieldResponses: Record<string, string>) => {
    try {
      const consolidated = { ...data, ...fieldResponses };
      
      // Try to use LLM to create a well-written post
      try {
        const llmFormatted = await generateLLMFormattedPost(consolidated);
        if (llmFormatted) {
          return llmFormatted;
        }
      } catch (error) {
        // Fall back silently
      }
      
      // Fallback to manual formatting
      return formatRecommendationTextSync(data, fieldResponses);
    } catch (error) {
      // Fallback to original text if formatting fails
      return text || 'Recommendation shared';
    }
  };


  const [formattedPreview, setFormattedPreview] = useState<string>('');
  const [isFormattingPreview, setIsFormattingPreview] = useState(false);
  // Removed local isEditingPreview; PreviewStep owns editing state via props
  const [editedPreview, setEditedPreview] = useState<string>('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  // Helper functions for preview (matching FeedPost component)

  // Moved to PreviewStep

  // Moved to PreviewStep

  // Moved to PreviewStep

  // Reset formatted preview when leaving preview step
  useEffect(() => {
    if (currentStep !== 'preview') {
      setFormattedPreview('');
      setIsFormattingPreview(false);
      setIsEditingDescription(false);
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
      }, 25000); // 25 second timeout (longer than AI client timeout)
      
      generatePreview();
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentStep]); // Only depend on currentStep to avoid infinite loop

  // Update labels when consolidated data changes
  useEffect(() => {
    if (currentStep === 'preview') {
      const consolidated = { ...extractedData, ...fieldResponses };
      const newLabels = Array.isArray(consolidated.specialities)
        ? consolidated.specialities
        : consolidated.specialities
        ? [consolidated.specialities]
        : [];
      setLabels(newLabels);
    }
  }, [currentStep, extractedData, fieldResponses]);

  const renderPreviewStep = () => {
    const consolidated = { ...extractedData, ...fieldResponses };
    
    // Extract data for preview
    const placeName = consolidated.name || consolidated.location_name || consolidated.title;
    const placeAddress = consolidated.location || consolidated.location_address;
    const description = formattedPreview || formatRecommendationTextSync(extractedData, fieldResponses);
    const contentType = (consolidated.contentType || consolidated.type) as any;
    const contact = consolidated.contact_info || consolidated.contact || null;
    
    // Generate labels from specialities (same logic as in formToSaveDto.ts)
    const currentLabels = Array.isArray(consolidated.specialities)
      ? consolidated.specialities
      : consolidated.specialities
      ? [consolidated.specialities]
      : [];
    const previewMentionMenu = (isEditingDescription && showMentionMenu && mentionSuggestions.length > 0) ? (
          <div className="fixed z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md" style={{ top: mentionPosition?.top || 0, left: mentionPosition?.left || 0 }}>
            {mentionSuggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
                onClick={() => {
                  const sel = previewTextareaRef.current;
                  if (!sel) return;
                  const cursor = sel.selectionStart || editedPreview.length;
                  const uname = (u.username || '').toLowerCase() || (u.display_name || u.user_name || '').toLowerCase().replace(/\s+/g, '');
                  const { text: nt, newCursor } = insertPlainMention(editedPreview, cursor, uname);
                  const display = u.display_name || u.user_name || uname;
              mentions.rememberMapping(uname, { id: u.id, displayName: display });
                  setEditedPreview(nt);
                  setShowMentionMenu(false);
                  setMentionQuery(null);
                  setMentionPosition(null);
                  requestAnimationFrame(() => {
                    sel.focus();
                    sel.setSelectionRange(newCursor, newCursor);
                  });
                }}
              >
                {u.profile_picture_url && (
                  <img src={u.profile_picture_url} className="h-6 w-6 rounded-full" />
                )}
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium">{u.display_name || u.user_name}</span>
                  {u.username && (
                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
    ) : null;

    return (
      <PreviewStep
        currentUser={currentUser}
        placeName={placeName}
        placeAddress={placeAddress}
        description={description}
        contentType={contentType}
        contact={contact}
        isEditingDescription={isEditingDescription}
        editedPreview={editedPreview}
        onEditedPreviewChange={setEditedPreview}
        showMentionMenu={showMentionMenu}
        mentionMenu={previewMentionMenu}
        rating={rating}
        onRatingChange={setRating}
        onEdit={handleEditPreview}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onApprove={handleApprovePreview}
        labels={labels}
        onLabelsChange={setLabels}
      />
    );
  };

  const renderCompleteStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="text-center space-y-8 py-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-center text-green-600 text-5xl">✓</div>
        
        <h1 className="text-4xl font-light text-black leading-tight">
          Recommendation posted!
        </h1>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-white pt-16"
        >
          <div className="h-full flex flex-col">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="h-full flex items-center justify-center p-12">
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