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
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
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
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ 
          backgroundColor: selectedTheme?.backgroundColor || 'var(--app-bg)',
          color: selectedTheme?.textPrimary || 'var(--app-text)',
        }}
      >
        <div 
          className="animate-spin rounded-full h-8 w-8 border-4"
          style={{ 
            borderColor: selectedTheme?.borderColorMuted || selectedTheme?.hoverBackground || '#E5E7EB',
            borderTopColor: accentColor,
          }}
        ></div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4"
      style={{ 
        backgroundColor: selectedTheme?.backgroundColor || 'var(--app-bg)',
        color: selectedTheme?.textPrimary || 'var(--app-text)',
      }}
    >
      <div className="w-full max-w-2xl">
        <div 
          className="rounded-lg border-2 p-6 md:p-8"
          style={selectedTheme ? {
            backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
            borderColor: selectedTheme.borderColor || '#000000',
            boxShadow: `8px 8px 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : undefined}
        >
          <div 
            className="mb-6 pb-4 border-b-2"
            style={{ borderColor: selectedTheme?.borderColor || '#000000' }}
          >
            <h1 
              className="text-2xl md:text-3xl font-bold"
              style={{ color: selectedTheme?.textPrimary || '#111827' }}
            >
              Ask your friends
            </h1>
            <p 
              className="text-sm md:text-base mt-2"
              style={{ color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280' }}
            >
              What are you looking for? Ask your friends for recommendations.
            </p>
          </div>
          
          <Textarea
            className="min-h-[200px] md:min-h-[240px] text-sm md:text-base rounded-md border-2 shadow-sm focus:shadow-md transition-shadow resize-none"
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
            style={selectedTheme ? {
              backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
              borderColor: selectedTheme.inputBorder || selectedTheme.borderColorMuted || 'rgba(0, 0, 0, 0.3)',
              color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
            } : undefined}
          />
          <style>{`
            textarea::placeholder {
              color: ${selectedTheme?.inputPlaceholder || selectedTheme?.textMuted || '#9CA3AF'} !important;
            }
            textarea:focus {
              border-color: ${selectedTheme?.borderColor || '#000000'} !important;
            }
          `}</style>
          
          <div 
            className="flex items-center justify-between mt-6 pt-4 border-t-2"
            style={{ borderColor: selectedTheme?.borderColor || '#000000' }}
          >
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="rounded-md border-2 shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
              style={selectedTheme ? {
                backgroundColor: 'transparent',
                borderColor: selectedTheme.borderColor || '#000000',
                color: selectedTheme.buttonGhost.text || selectedTheme.textPrimary || '#000000',
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
              onMouseEnter={(e) => {
                if (selectedTheme) {
                  e.currentTarget.style.backgroundColor = selectedTheme.buttonGhost.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedTheme) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={submit} 
              disabled={askMutation.isPending || !text.trim()}
              className="rounded-md border-2 shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              style={selectedTheme ? {
                backgroundColor: (askMutation.isPending || !text.trim()) 
                  ? (selectedTheme.borderColorMuted || selectedTheme.hoverBackground || '#E5E7EB')
                  : accentColor,
                borderColor: selectedTheme.borderColor || '#000000',
                color: (askMutation.isPending || !text.trim())
                  ? (selectedTheme.textMuted || '#6B7280')
                  : textOnAccent,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
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

