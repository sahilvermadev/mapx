import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { questionsApi, type CreateQuestionPayload } from '@/services/questionsService';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { useAuth } from '@/auth';
import { toast } from 'sonner';

// Local hook for asking a question
const useAskQuestion = () => {
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => questionsApi.createQuestion(payload),
  });
};

const AskQuestionPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isChecking } = useAuth();
  const [text, setText] = useState('');
  const askMutation = useAskQuestion();
  
  // Theme support
  const { theme } = useTheme();
  const selectedTheme = THEMES[theme];
  const accentColor = selectedTheme.accentColor;
  const textOnAccent = getReadableTextColor(accentColor);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      navigate('/feed');
    }
  }, [isAuthenticated, isChecking, navigate]);

  const submit = async () => {
    if (!text.trim()) return;
    
    try {
      // Default visibility to 'friends' since visibility feature is not actively used
      const res = await askMutation.mutateAsync({ text: text.trim(), visibility: 'friends' });
      
      // Handle both wrapped ApiResponse and direct data responses
      const questionData = (res as any).data || res;
      const questionId = questionData?.id;
      
      if (questionId) {
        toast.success('Question posted!');
        // Navigate back to feed after a brief delay for smooth transition
        setTimeout(() => {
          navigate('/feed', { replace: true });
        }, 300);
      } else {
        console.error('Question creation failed - no ID in response:', res);
        toast.error((res as any).error || (res as any).message || 'Failed to post question');
      }
    } catch (error) {
      console.error('Failed to post question:', error);
      toast.error('Failed to post question');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/feed', { replace: true });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        <div className="rounded-lg border-2 border-black bg-white shadow-[8px_8px_0_0_#000] p-6 md:p-8">
          <div className="mb-6 pb-4 border-b-2 border-black">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ask your friends</h1>
            <p className="text-sm md:text-base text-gray-600 mt-2">
              What are you looking for? Ask your friends for recommendations.
            </p>
          </div>
          
          <Textarea
            className="min-h-[200px] md:min-h-[240px] text-sm md:text-base rounded-md border-2 border-black/30 bg-white shadow-sm focus:shadow-md focus:border-black transition-shadow resize-none placeholder:text-gray-500"
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
            autoFocus
          />
          
          <div className="flex items-center justify-between mt-6 pt-4 border-t-2 border-black">
            <Button 
              variant="outline" 
              onClick={handleBack}
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

export default AskQuestionPage;

