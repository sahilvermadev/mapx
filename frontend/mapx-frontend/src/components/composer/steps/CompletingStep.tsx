import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizePhoneDigits, validateOptionalPhoneOrEmail } from '@/utils/validation';
import InlineLocationPicker from '@/components/InlineLocationPicker';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface MissingField {
  field: string;
  question: string;
  required: boolean;
  needsLocationPicker?: boolean;
}

interface CompletingStepProps {
  missingFields: MissingField[];
  currentFieldIndex: number;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fieldResponses: Record<string, any>;
  onFieldResponse: (field: string, value: string) => Promise<void> | void;
  onLocationSelected: (loc: { name: string; address: string; lat: number; lng: number; google_place_id?: string }) => void;
  onSkipField: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export const CompletingStep: React.FC<CompletingStepProps> = ({
  missingFields,
  currentFieldIndex,
  textareaRef,
  fieldResponses,
  onFieldResponse,
  onLocationSelected,
  onSkipField,
  onBack,
  isSubmitting,
  onSubmit
}) => {
  const currentField = missingFields[currentFieldIndex]?.field;
  const isContactField = currentField === 'contact_info';
  const isPhoneField = isContactField || /phone/i.test(currentField || '');
  const [phoneValue, setPhoneValue] = React.useState('');
  const [emailValue, setEmailValue] = React.useState('');
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [isProcessingField, setIsProcessingField] = React.useState(false);

  // Populate/reset fields with previous responses when field index changes
  React.useEffect(() => {
    const currentFieldName = missingFields[currentFieldIndex]?.field;
    if (!currentFieldName) return;

    const previousResponse = fieldResponses[currentFieldName];

    // Reset all local inputs first
    setPhoneValue('');
    setEmailValue('');
    if (textareaRef.current) textareaRef.current.value = '';

    if (currentFieldName === 'contact_info' && typeof previousResponse === 'object') {
      setPhoneValue(previousResponse.phone || '');
      setEmailValue(previousResponse.email || '');
    } else if (isPhoneField && typeof previousResponse === 'string') {
      setPhoneValue(previousResponse);
    } else if (textareaRef.current && typeof previousResponse === 'string') {
      textareaRef.current.value = previousResponse;
    }
  }, [currentFieldIndex, missingFields, fieldResponses, isPhoneField, textareaRef]);

  // email validation handled in utils

  const handleContinue = async () => {
    if (isProcessingField) return;
    if (isContactField) {
      const { phoneError: pErr, emailError: eErr } = validateOptionalPhoneOrEmail(phoneValue, emailValue);
      setPhoneError(pErr);
      setEmailError(eErr);
      if (pErr || eErr) return;

      const payload = {
        phone: phoneValue.trim().length ? normalizePhoneDigits(phoneValue) : undefined,
        email: emailValue.trim().length ? emailValue.trim().toLowerCase() : undefined
      } as any;

      try {
        setIsProcessingField(true);
        await onFieldResponse(currentField!, payload);
      } finally {
        setIsProcessingField(false);
      }
      return;
    } else if (isPhoneField) {
      const err = validateOptionalPhoneOrEmail(phoneValue || '', '').phoneError;
      setPhoneError(err);
      if (err) return;
      try {
        setIsProcessingField(true);
        await onFieldResponse(currentField!, normalizePhoneDigits(phoneValue));
      } finally {
        setIsProcessingField(false);
      }
      return;
    }
    const el = textareaRef.current;
    if (el) {
      try {
        setIsProcessingField(true);
        await onFieldResponse(currentField!, el.value);
      } finally {
        setIsProcessingField(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left space-y-4 md:space-y-8 py-4 md:py-8"
    >
      <div className="max-w-3xl mx-auto space-y-4 md:space-y-8">
        {/* Progress Header */}
        {missingFields.length > 0 && (
          <div className="space-y-2 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[10px] md:text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Question {Math.min(currentFieldIndex + 1, missingFields.length)} of {missingFields.length}
              </span>
              <span className="text-[10px] md:text-[11px] font-medium text-muted-foreground">
                {Math.round(((Math.min(currentFieldIndex + 1, missingFields.length)) / missingFields.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-500 ease-out"
                style={{ width: `${Math.min(((currentFieldIndex + 1) / missingFields.length) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-light tracking-tight text-foreground leading-tight">
          {missingFields[currentFieldIndex]?.question || 'Additional Information'}
        </h1>

        {missingFields.length > 0 && currentFieldIndex < missingFields.length && (
          <div className="space-y-4 md:space-y-8">
            {missingFields[currentFieldIndex]?.needsLocationPicker ? (
              <div className="space-y-6">
                <InlineLocationPicker
                  onLocationSelected={onLocationSelected}
                  onSkip={onSkipField}
                />
              </div>
            ) : (
              <>
                {isContactField ? (
                  <div className="space-y-4 md:space-y-6 text-left">
                    <div className="space-y-2">
                      <Label htmlFor="contact-phone" className="text-sm md:text-base">Phone number</Label>
                      <Input
                        id="contact-phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="e.g. +1 415 555 2671"
                        value={phoneValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPhoneValue(v);
                          if (phoneError) setPhoneError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleContinue();
                          }
                        }}
                        disabled={isProcessingField}
                        className="text-base md:text-lg h-9 md:h-10"
                      />
                      {phoneError && (
                        <div className="text-xs md:text-sm text-red-600">{phoneError}</div>
                      )}
                      <div className="text-xs md:text-sm text-gray-500">Only digits will be saved. 10–15 digits required.</div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email" className="text-sm md:text-base">Email (optional)</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        inputMode="email"
                        placeholder="e.g. name@example.com"
                        value={emailValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEmailValue(v);
                          if (emailError) setEmailError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleContinue();
                          }
                        }}
                        disabled={isProcessingField}
                        className="text-base md:text-lg h-9 md:h-10"
                      />
                      {emailError && (
                        <div className="text-xs md:text-sm text-red-600">{emailError}</div>
                      )}
                      <div className="text-xs md:text-sm text-gray-500">Provide either a valid phone or email.</div>
                    </div>
                  </div>
                ) : isPhoneField ? (
                  <div className="space-y-2 text-left">
                    <Label htmlFor="contact-phone" className="text-sm md:text-base">Phone number</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="e.g. +1 415 555 2671"
                      value={phoneValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPhoneValue(v);
                        if (phoneError) setPhoneError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleContinue();
                        }
                      }}
                      disabled={isProcessingField}
                      className="text-base md:text-lg h-9 md:h-10"
                    />
                    {phoneError && (
                      <div className="text-xs md:text-sm text-red-600">{phoneError}</div>
                    )}
                    <div className="text-xs md:text-sm text-gray-500">Only digits will be saved. 10–15 digits required.</div>
                  </div>
                ) : (
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Your answer..."
                      className="min-h-[150px] md:min-h-[200px] text-lg md:text-xl lg:text-2xl resize-none border-0 rounded-none bg-transparent px-0 text-foreground placeholder:text-muted-foreground text-left shadow-none focus:shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 appearance-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (e.metaKey || e.ctrlKey) {
                            // Cmd/Ctrl+Enter: always continue
                            const value = (e.target as HTMLTextAreaElement).value;
                            // do not clear immediately; wait for move
                            void onFieldResponse(missingFields[currentFieldIndex].field, value);
                          } else if (!e.shiftKey) {
                            // Enter: continue (but allow Shift+Enter for new lines)
                            e.preventDefault();
                            const value = (e.target as HTMLTextAreaElement).value;
                            // do not clear immediately; wait for move
                            void onFieldResponse(missingFields[currentFieldIndex].field, value);
                          }
                        }
                      }}
                      disabled={isProcessingField}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 md:pt-8 border-t border-border">
                  <Button
                    variant="ghost"
                    onClick={onBack}
                    disabled={isProcessingField}
                    aria-label="Back"
                    className="h-9 w-9 md:h-10 md:w-10 p-0 rounded-full text-foreground hover:bg-muted"
                  >
                    <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                  <div className="flex items-center gap-2 md:gap-3">
                    <Button
                      onClick={onSkipField}
                      variant="ghost"
                      disabled={isProcessingField}
                      className="h-9 md:h-10 px-2 md:px-3 rounded-full text-xs md:text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={handleContinue}
                      disabled={isProcessingField}
                      aria-label="Continue"
                      className="p-2.5 md:p-3 rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {currentFieldIndex >= missingFields.length && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 md:space-y-16"
          >
            <h1 className="text-2xl md:text-4xl font-light text-black leading-tight">
              Ready to share!
            </h1>
            
            <div className="flex justify-center">
              <Button
                onClick={onSubmit}
                disabled={isSubmitting}
                className="px-6 md:px-8 py-2.5 md:py-3 text-base md:text-lg font-medium bg-black hover:bg-gray-800 text-white rounded-lg border-0 shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-white mr-2 md:mr-3" />
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
};

export default CompletingStep;


