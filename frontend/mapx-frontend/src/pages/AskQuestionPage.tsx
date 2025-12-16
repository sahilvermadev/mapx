import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HelpCircle } from 'lucide-react';
import { questionsApi, type CreateQuestionPayload } from '@/services/questionsService';
import { QUESTION_CONTENT_TYPES } from '@/components/composer/constants';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { useAuth } from '@/auth';

// Local hook for asking a question
const useAskQuestion = () => {
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => questionsApi.createQuestion(payload),
  });
};

const AskQuestionPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  const [text, setText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [isNavigating, setIsNavigating] = useState(false);
  const askMutation = useAskQuestion();
  const queryClient = useQueryClient();
  
  // Theme support
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#6366F1';
  const textOnAccent = getReadableTextColor(accentColor);

  // CSS variables for theme-aware styling (used by Tailwind arbitrary values)
  const themeVars = {
    '--ask-bg': selectedTheme?.backgroundColor || '#020617',
    '--ask-text': selectedTheme?.textPrimary || '#F9FAFB',
    '--ask-muted': selectedTheme?.textMuted || 'rgba(148, 163, 184, 0.9)',
    '--ask-border-subtle': selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.4)',
    '--ask-chip-bg': selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.7)',
    '--ask-chip-hover-bg': selectedTheme?.selectedBackground || 'rgba(30, 64, 175, 0.85)',
    '--ask-chip-selected-bg': selectedTheme?.accentColor || 'rgba(59, 130, 246, 1)',
    '--ask-chip-selected-text': getReadableTextColor(selectedTheme?.accentColor || '#3B82F6'),
    '--ask-visibility-bg': selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.8)',
    '--ask-visibility-selected-bg': selectedTheme?.cardBackground || '#F9FAFB',
    '--ask-visibility-selected-text': selectedTheme?.textPrimary || '#020617',
    '--ask-post-bg': accentColor,
    '--ask-post-bg-disabled': selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.6)',
  } as React.CSSProperties;
  
  // Form container styling to mirror recommendation composer card
  const formContainerStyle = selectedTheme
    ? {
        backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
        borderColor: selectedTheme.borderColor || '#000000',
        boxShadow: `6px 6px 0 0 ${selectedTheme.borderColor || '#000000'}`,
      }
    : {
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
        boxShadow: '6px 6px 0 0 #000000',
      };
  
  // Character count
  const characterCount = text.length;

  // Redirect if not authenticated
  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      navigate('/feed');
    }
  }, [isAuthenticated, isChecking, navigate]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || askMutation.isPending || isNavigating) return;
    
    const labels = selectedCategory ? [selectedCategory] : undefined;
    const payload = { 
      text: trimmed, 
      visibility,
      labels,
    } as CreateQuestionPayload;

    const clickTime = performance.now();
    if (import.meta.env.DEV) {
      console.log('[ASK] Submit clicked - starting optimistic navigation', {
        time: clickTime,
        textLength: trimmed.length,
        visibility,
        labels,
      });
    }

    const mutationPromise = askMutation.mutateAsync(payload);

    // Navigate immediately for snappy UX; handle result asynchronously
    setIsNavigating(true);
    if (import.meta.env.DEV) {
      console.log('[ASK] Calling navigate after click', { time: performance.now(), from: (location.state as any)?.from });
    }

    const from = (location.state as any)?.from as string | undefined;
    if (from === '/feed') {
      if (import.meta.env.DEV) {
        console.log('[ASK] Navigating back to previous feed instance with navigate(-1)');
      }
      navigate(-1);
    } else {
      if (import.meta.env.DEV) {
        console.log('[ASK] Navigating directly to /feed');
      }
      navigate('/feed', { replace: true });
    }

    mutationPromise
      .then((res) => {
        const questionData = (res as any).data || res;
        const questionId = questionData?.id;
        
        if (questionId) {
          const successTime = performance.now();
          console.log('[ASK] Question created successfully', { questionId, time: successTime, sinceClick: successTime - clickTime });

          // Build a minimal optimistic question object for the unified feed
          const optimisticQuestion = {
            type: 'question',
            id: questionId,
            text: payload.text,
            visibility: payload.visibility ?? 'friends',
            labels: payload.labels ?? [],
            created_at: questionData.created_at || new Date().toISOString(),
            user_id: currentUser?.id,
            user_name: currentUser?.displayName || currentUser?.username || 'You',
            user_picture: currentUser?.profilePictureUrl,
            answers_count: 0,
          };

          // Optimistically prepend to all matching feed queries
          try {
            queryClient.setQueriesData(
              { queryKey: ['feed'], exact: false },
              (oldData: any) => {
                if (!oldData || !Array.isArray(oldData.pages)) return oldData;
                const pages = oldData.pages as Array<{ data: any[] }>;
                if (pages.length === 0 || !Array.isArray(pages[0].data)) return oldData;

                const firstPage = pages[0];
                const existingIndex = firstPage.data.findIndex(
                  (p: any) => p && p.type === 'question' && p.id === questionId,
                );
                if (existingIndex !== -1) {
                  return oldData;
                }

                const nextFirstPage = {
                  ...firstPage,
                  data: [optimisticQuestion, ...firstPage.data],
                };

                return {
                  ...oldData,
                  pages: [nextFirstPage, ...pages.slice(1)],
                };
              },
            );
          } catch (e) {
            console.warn('[ASK] Failed to setQueriesData for feed (optimistic question)', e);
          }

          // Invalidate feed queries so the new question is reconciled with backend data
          queryClient.invalidateQueries({ queryKey: ['feed'], exact: false }).catch(() => {});
          // Flag for feed page on initial mount
          sessionStorage.setItem('questionPosted', 'true');
          try {
            window.dispatchEvent(new CustomEvent('question:posted'));
          } catch (e) {
            // ignore if event dispatch fails
          }
        } else {
          const message = (res as any).error || (res as any).message || 'Failed to post question';
          console.error('Question creation failed - no ID in response:', res);
          try {
            window.dispatchEvent(new CustomEvent('question:post-failed', { detail: { message } }));
          } catch (e) {
            // ignore
          }
        }
      })
      .catch((error) => {
        console.error('Failed to post question:', error);
        try {
          window.dispatchEvent(new CustomEvent('question:post-failed', { detail: { message: 'Failed to post question' } }));
        } catch (e) {
          // ignore
        }
      });
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
      className="min-h-[calc(100vh-64px)] flex flex-col px-4 py-6 sm:px-5 md:px-8 md:py-8"
      style={{ 
        backgroundColor: 'var(--ask-bg)',
        color: 'var(--ask-text)',
        ...themeVars,
      }}
    >
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full gap-6 md:gap-8 lg:gap-10 justify-start md:justify-center">
        {/* Main Title */}
        <div className="flex flex-col items-center text-center gap-2 md:gap-3">
          <h1 
            className="text-2xl md:text-4xl lg:text-5xl font-light tracking-tight leading-tight"
            style={{ color: 'var(--ask-text)' }}
          >
            Post your question here.
          </h1>
        </div>
        
        {/* Form container */}
        <div className="w-full">
          <div
            className="w-full rounded-lg border-2 p-4 md:p-6 lg:p-8"
            style={formContainerStyle}
          >
            {/* Question Input */}
            <div className="w-full space-y-3">
              <Textarea
                className="min-h-[100px] md:min-h-[120px] text-lg md:text-xl lg:text-2xl rounded-none border-0 border-b border-b-[color:var(--ask-border-subtle)] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 bg-transparent pb-2"
                placeholder="Looking for a great golf instructor in Delhi. Need a few lessons guys!!"
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
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--ask-text)',
                }}
              />
              <style>{`
                textarea::placeholder {
                  color: var(--ask-muted) !important;
                  opacity: 0.6;
                }
                textarea:focus {
                  border-color: var(--ask-border-subtle) !important;
                }
              `}</style>
              
              {/* Character Counter */}
              <div 
                className="text-xs mt-1"
                style={{ color: 'var(--ask-muted)' }}
              >
                {characterCount} characters
              </div>
            </div>
            
            {/* Category Section */}
            <div className="w-full mt-8 md:mt-10">
              {/* Category label */}
              <div 
                className="w-full mb-3 text-xs font-medium uppercase tracking-[0.16em]"
                style={{ color: 'var(--ask-muted)' }}
              >
                Category
              </div>

              {/* Category Selection */}
              <div className="w-full flex flex-wrap gap-2 md:gap-2.5">
              {QUESTION_CONTENT_TYPES.map((contentType) => {
                const isSelected = selectedCategory === contentType.key;
                const baseBg = isSelected
                  ? selectedTheme?.accentColor || '#3B82F6'
                  : selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.75)';
                const baseBorder = isSelected
                  ? selectedTheme?.accentColor || '#3B82F6'
                  : selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.6)';
                const baseColor = isSelected
                  ? getReadableTextColor(selectedTheme?.accentColor || '#3B82F6')
                  : selectedTheme?.textPrimary || '#E5E7EB';
                const hoverBg = isSelected
                  ? selectedTheme?.buttonPrimary?.hover || selectedTheme?.accentColor || '#1D4ED8'
                  : selectedTheme?.buttonGhost?.hover || selectedTheme?.selectedBackground || 'rgba(51, 65, 85, 0.85)';

                return (
                  <button
                    key={contentType.key}
                    onClick={() => setSelectedCategory(isSelected ? null : contentType.key)}
                    className="px-4 md:px-5 py-1.5 md:py-2 rounded-full text-sm font-medium border transition-all duration-150 ease-out shadow-sm"
                    style={{
                      backgroundColor: baseBg,
                      borderColor: baseBorder,
                      color: baseColor,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = baseBg;
                    }}
                  >
                    {contentType.label}
                  </button>
                );
              })}
            </div>
            </div>
            
            {/* Visibility Section */}
            <div className="w-full mt-8 md:mt-10">
              {/* Visibility label */}
              <div 
                className="w-full mb-3 text-xs font-medium uppercase tracking-[0.16em]"
                style={{ color: 'var(--ask-muted)' }}
              >
                Visibility
              </div>

              {/* Audience Selection and Ask Button */}
              <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={() => setVisibility('public')}
                    className="px-4 md:px-6 py-1.5 md:py-2.5 rounded-lg text-sm md:text-base font-medium transition-all duration-150 ease-out border shadow-sm"
                  style={{
                    backgroundColor: visibility === 'public'
                      ? selectedTheme?.cardBackground || '#F9FAFB'
                      : selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.75)',
                    borderColor: visibility === 'public'
                      ? selectedTheme?.accentColor || selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.6)'
                      : 'transparent',
                    color: visibility === 'public'
                      ? selectedTheme?.textPrimary || '#020617'
                      : selectedTheme?.textPrimary || '#E5E7EB',
                  }}
                  onMouseEnter={(e) => {
                    if (visibility === 'public') {
                      e.currentTarget.style.backgroundColor =
                        selectedTheme?.activeBackground ||
                        selectedTheme?.buttonPrimary?.hover ||
                        selectedTheme?.cardBackground ||
                        '#E5E7EB';
                    } else {
                      e.currentTarget.style.borderColor =
                        selectedTheme?.accentColor ||
                        selectedTheme?.borderColorMuted ||
                        'rgba(148, 163, 184, 0.8)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = visibility === 'public'
                      ? selectedTheme?.cardBackground || '#F9FAFB'
                      : selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.75)';
                    e.currentTarget.style.borderColor = visibility === 'public'
                      ? selectedTheme?.accentColor || selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.6)'
                      : 'transparent';
                  }}
                >
                    Everyone
                  </button>
                  <button
                    onClick={() => setVisibility('friends')}
                    className="px-4 md:px-6 py-1.5 md:py-2.5 rounded-lg text-sm md:text-base font-medium transition-all duration-150 ease-out border shadow-sm"
                  style={{
                    backgroundColor: visibility === 'friends'
                      ? selectedTheme?.cardBackground || '#F9FAFB'
                      : selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.75)',
                    borderColor: visibility === 'friends'
                      ? selectedTheme?.accentColor || selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.6)'
                      : 'transparent',
                    color: visibility === 'friends'
                      ? selectedTheme?.textPrimary || '#020617'
                      : selectedTheme?.textPrimary || '#E5E7EB',
                  }}
                  onMouseEnter={(e) => {
                    if (visibility === 'friends') {
                      e.currentTarget.style.backgroundColor =
                        selectedTheme?.activeBackground ||
                        selectedTheme?.buttonPrimary?.hover ||
                        selectedTheme?.cardBackground ||
                        '#E5E7EB';
                    } else {
                      e.currentTarget.style.borderColor =
                        selectedTheme?.accentColor ||
                        selectedTheme?.borderColorMuted ||
                        'rgba(148, 163, 184, 0.8)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = visibility === 'friends'
                      ? selectedTheme?.cardBackground || '#F9FAFB'
                      : selectedTheme?.hoverBackground || 'rgba(15, 23, 42, 0.75)';
                    e.currentTarget.style.borderColor = visibility === 'friends'
                      ? selectedTheme?.accentColor || selectedTheme?.borderColorMuted || 'rgba(148, 163, 184, 0.6)'
                      : 'transparent';
                  }}
                >
                    Close Friends
                  </button>
                </div>
              
                <Button 
                  onClick={submit} 
                  disabled={isNavigating || !text.trim()}
                  className="w-full sm:w-auto sm:min-w-[120px] px-6 md:px-8 py-2.5 md:py-3 text-sm md:text-base font-semibold border-[1.5px] border-black rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                  style={{
                    backgroundColor: isNavigating || !text.trim()
                      ? (selectedTheme?.borderColorMuted || selectedTheme?.hoverBackground || '#666')
                      : (selectedTheme?.accentColor || '#000000'),
                    color: isNavigating || !text.trim()
                      ? (selectedTheme?.textMuted || '#9CA3AF')
                      : textOnAccent,
                    borderColor: selectedTheme?.borderColor || '#000000',
                    boxShadow: (isNavigating || !text.trim()) ? 'none' : `3px 3px 0 0 ${selectedTheme?.borderColor || '#000000'}`,
                  }}
                >
                  Ask
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Question Mark Icon in Bottom Right */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6">
        <HelpCircle 
          className="h-5 w-5 md:h-6 md:w-6"
          style={{ color: selectedTheme?.textMuted || 'rgba(255, 255, 255, 0.5)' }}
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
};

export default AskQuestionPage;

