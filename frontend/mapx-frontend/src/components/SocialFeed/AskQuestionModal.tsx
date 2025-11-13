import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { questionsApi, type CreateQuestionPayload } from '@/services/questionsService';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';

// Local hook for asking a question
const useAskQuestion = () => {
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => questionsApi.createQuestion(payload),
  });
};

type AskQuestionModalProps = {
  open: boolean;
  initialText?: string;
  onClose: () => void;
  onSubmitted?: (id: number) => void;
};

const AskQuestionModal: React.FC<AskQuestionModalProps> = ({ open, initialText = '', onClose, onSubmitted }) => {
  const [text, setText] = useState(initialText);
  const askMutation = useAskQuestion();
  
  // Theme support
  const { theme } = useTheme();
  const selectedTheme = THEMES[theme];
  const accentColor = selectedTheme.accentColor;
  const textOnAccent = getReadableTextColor(accentColor);

  const submit = async () => {
    if (!text.trim()) return;
    // Default visibility to 'friends' since visibility feature is not actively used
    const res = (await askMutation.mutateAsync({ text: text.trim(), visibility: 'friends' })) as any;
    if (res?.data?.id) onSubmitted?.(res.data.id);
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl rounded-lg border-2 border-black bg-white shadow-[8px_8px_0_0_#000] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-black">
          <h3 className="text-xl font-bold text-gray-900">Ask your friends</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-md border border-black/30 hover:bg-gray-100 hover:border-black/50 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <Textarea
          className="min-h-[140px] text-sm rounded-md border border-black/30 bg-white shadow-sm focus:shadow-md focus:border-black transition-shadow resize-none placeholder:text-gray-500"
          placeholder="What are you looking for?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Allow Cmd/Ctrl+Enter to submit
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        
        <div className="flex items-center justify-end mt-5 pt-4 border-t-2 border-black">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all bg-white"
            >
              Cancel
            </Button>
            <Button 
              onClick={submit} 
              disabled={askMutation.isPending || !text.trim()}
              className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              style={{ backgroundColor: accentColor, borderColor: '#000', color: textOnAccent }}
            >
              {askMutation.isPending ? 'Posting…' : 'Post question'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskQuestionModal;









