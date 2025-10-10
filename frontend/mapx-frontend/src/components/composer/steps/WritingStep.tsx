import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface WritingStepProps {
  error: string | null;
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onContinue: () => void;
  onClearError: () => void;
  mentionMenu: React.ReactNode;
}

export const WritingStep: React.FC<WritingStepProps> = ({
  error,
  text,
  textareaRef,
  onChange,
  onContinue,
  onClearError,
  mentionMenu
}) => {
  return (
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
                onClick={onClearError}
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
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tell us about a new spot, service, or tip..."
            className="min-h-[200px] text-2xl resize-none border-none border-b border-gray-300 rounded-none focus:border-0 focus:border-b focus:border-gray-500 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-white px-0 text-black placeholder:text-gray-400 text-left"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                onContinue();
              }
            }}
          />
          {mentionMenu}
        </div>
        
        <div className="flex justify-center">
          <Button
            onClick={onContinue}
            disabled={!text.trim()}
            className="px-8 py-3 text-lg font-medium bg-black hover:bg-gray-800 text-white rounded-lg border-0 shadow-sm disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Continue
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default WritingStep;






