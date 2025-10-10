import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizePhoneDigits, validateOptionalPhoneOrEmail } from '@/utils/validation';
import InlineLocationPicker from '@/components/InlineLocationPicker';

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
  onFieldResponse: (field: string, value: string) => void;
  onLocationSelected: (loc: { name: string; address: string; lat: number; lng: number; google_place_id?: string }) => void;
  onSkipField: () => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export const CompletingStep: React.FC<CompletingStepProps> = ({
  missingFields,
  currentFieldIndex,
  textareaRef,
  onFieldResponse,
  onLocationSelected,
  onSkipField,
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

  // email validation handled in utils

  const handleContinue = () => {
    if (isContactField) {
      const { phoneError: pErr, emailError: eErr } = validateOptionalPhoneOrEmail(phoneValue, emailValue);
      setPhoneError(pErr);
      setEmailError(eErr);
      if (pErr || eErr) return;

      const payload = {
        phone: phoneValue.trim().length ? normalizePhoneDigits(phoneValue) : undefined,
        email: emailValue.trim().length ? emailValue.trim().toLowerCase() : undefined
      } as any;

      onFieldResponse(currentField!, payload);
      setPhoneValue('');
      setEmailValue('');
      return;
    } else if (isPhoneField) {
      const err = validateOptionalPhoneOrEmail(phoneValue || '', '').phoneError;
      setPhoneError(err);
      if (err) return;
      onFieldResponse(currentField!, normalizePhoneDigits(phoneValue));
      setPhoneValue('');
      return;
    }
    const el = textareaRef.current;
    if (el) {
      onFieldResponse(currentField!, el.value);
      el.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center space-y-8 py-8"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-light text-black leading-tight">
          {missingFields[currentFieldIndex]?.question || 'Additional Information'}
        </h1>

        {missingFields.length > 0 && currentFieldIndex < missingFields.length && (
          <div className="space-y-8">
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
                  <div className="space-y-6 text-left">
                    <div className="space-y-2">
                      <Label htmlFor="contact-phone" className="text-base">Phone number</Label>
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
                        className="text-lg"
                      />
                      {phoneError && (
                        <div className="text-sm text-red-600">{phoneError}</div>
                      )}
                      <div className="text-sm text-gray-500">Only digits will be saved. 10–15 digits required.</div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email" className="text-base">Email (optional)</Label>
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
                        className="text-lg"
                      />
                      {emailError && (
                        <div className="text-sm text-red-600">{emailError}</div>
                      )}
                      <div className="text-sm text-gray-500">Provide either a valid phone or email.</div>
                    </div>
                  </div>
                ) : isPhoneField ? (
                  <div className="space-y-2 text-left">
                    <Label htmlFor="contact-phone" className="text-base">Phone number</Label>
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
                      className="text-lg"
                    />
                    {phoneError && (
                      <div className="text-sm text-red-600">{phoneError}</div>
                    )}
                    <div className="text-sm text-gray-500">Only digits will be saved. 10–15 digits required.</div>
                  </div>
                ) : (
                  <div className="relative">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Your answer..."
                      className="min-h-[200px] text-2xl resize-none border-none border-b border-gray-300 rounded-none focus:border-0 focus:border-b focus:border-gray-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-white px-0 text-black placeholder:text-gray-400 text-left"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          const value = (e.target as HTMLTextAreaElement).value;
                          onFieldResponse(missingFields[currentFieldIndex].field, value);
                          (e.target as HTMLTextAreaElement).value = '';
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={onSkipField}
                    variant="outline"
                    className="px-6 py-2 text-base font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 shadow-sm transition-colors duration-200"
                  >
                    Skip
                  </Button>

                  <Button
                    onClick={handleContinue}
                    className="px-8 py-3 text-lg font-medium bg-black hover:bg-gray-800 text-white rounded-lg border-0 shadow-sm transition-colors duration-200"
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {currentFieldIndex >= missingFields.length && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-16"
          >
            <h1 className="text-4xl font-light text-black leading-tight">
              Ready to share!
            </h1>
            
            <div className="flex justify-center">
              <Button
                onClick={onSubmit}
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
};

export default CompletingStep;


