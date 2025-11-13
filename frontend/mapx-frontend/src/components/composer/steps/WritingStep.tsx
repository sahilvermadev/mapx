import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TypingText from '@/components/ui/shadcn-io/typing-text';

interface WritingStepProps {
  error: string | null;
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onContinue: () => void;
  onClearError: () => void;
  onTextSelection: (newPos: number) => void;
  mentionMenu: React.ReactNode;
}

export const WritingStep: React.FC<WritingStepProps> = ({
  error,
  text,
  textareaRef,
  onChange,
  onContinue,
  onClearError,
  onTextSelection,
  mentionMenu
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-left space-y-4 md:space-y-8 py-4 md:py-8"
    >
      <div className="max-w-3xl mx-auto space-y-4 md:space-y-8">
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-light tracking-tight text-foreground leading-tight">
          What are you recommending?
        </h1>

        {error && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-none border-2 border-black bg-red-100 text-red-900 shadow-[4px_4px_0_0_#000] md:shadow-[6px_6px_0_0_#000]">
              <span className="text-xs md:text-sm font-medium">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearError}
                className="h-5 w-5 md:h-6 md:w-6 p-0 text-red-900 hover:bg-red-200"
              >
                ×
              </Button>
            </div>
          </div>
        )}

        <div className="relative rounded-md border-2 border-black bg-white p-3 md:p-4 shadow-[3px_3px_0_0_#000] md:shadow-[4px_4px_0_0_#000]">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onSelect={(e) => {
              const newPos = (e.target as HTMLTextAreaElement).selectionStart || 0;
              onTextSelection(newPos);
            }}
            placeholder=""
            className="min-h-[150px] md:min-h-[200px] text-lg md:text-xl lg:text-2xl resize-none border-0 rounded-none bg-transparent px-0 text-foreground placeholder:text-muted-foreground text-left shadow-none focus:shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 appearance-none relative z-10"
            style={{ caretColor: text ? 'auto' : 'transparent' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.metaKey || e.ctrlKey) {
                  // Cmd/Ctrl+Enter: always continue
                  onContinue();
                } else if (!e.shiftKey) {
                  // Enter: continue (but allow Shift+Enter for new lines)
                  e.preventDefault();
                  onContinue();
                }
              }
            }}
          />
          {/* Animated placeholder overlay - only visible when textarea is empty */}
          {!text && (
            <div className="absolute top-3 md:top-5 left-3 md:left-4 pointer-events-none z-0">
              <TypingText
                text={[
                  "a restaurant I went to recently",
                  "a carpenter who worked on my kitchen",
                  "the Shangri La hotel in Delhi"
                ]}
                typingSpeed={75}
                pauseDuration={2000}
                deletingSpeed={30}
                loop={true}
                showCursor={true}
                cursorCharacter="|"
                cursorBlinkDuration={0.5}
                variableSpeed={{ min: 50, max: 120 }}
                className="text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed"
                cursorClassName=""
              />
            </div>
          )}
          {mentionMenu}
        </div>
        
        <div className="flex justify-center">
          <Button
            onClick={onContinue}
            disabled={!text.trim()}
            aria-label="Continue"
            className="h-10 w-10 md:h-11 md:w-11 p-0 rounded-md border-2 border-black bg-yellow-300 text-black shadow-[2px_2px_0_0_#000] md:shadow-[3px_3px_0_0_#000] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
          >
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default WritingStep;






