import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { questionsApi } from '@/services/questionsService';
import { formatUserDisplay, getUserInitials } from '../utils/userDisplay';
import { renderWithMentions } from '@/utils/mentions';
import { useLocationNavigation } from '@/hooks/useLocationNavigation';
import type { LocationData } from '@/types/location';
import { toast } from 'sonner';
import { LoginModal } from '@/auth';

// Types
interface QuestionFeedPostProps {
  question?: any;
  currentUserId?: string;
  onQuestionUpdate?: () => void;
  noOuterSpacing?: boolean;
  isLoading?: boolean;
  refreshTrigger?: number;
  readOnly?: boolean;
}

// Helper functions
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
};

const getInitials = (name: string | undefined | null): string => {
  if (!name) return 'U';
  return name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

import { getProfilePictureUrl } from '@/config/apiConfig';

const getProxiedImageUrl = (url?: string): string => {
  if (!url) return '';
  return getProfilePictureUrl(url) || url;
};

// Loading skeleton component
const LoadingSkeleton: React.FC<{ noOuterSpacing?: boolean }> = ({ noOuterSpacing }) => (
  <article className={noOuterSpacing ? "w-full" : "w-full mb-6 md:mb-8"}>
    <div className={noOuterSpacing ? "relative animate-pulse" : "relative rounded-lg border-2 border-black bg-white p-4 md:p-6 shadow-[4px_4px_0_0_#000] animate-pulse"}>
      <div className="flex items-start gap-3 mb-4">
        <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="flex gap-3">
        <div className="h-8 bg-gray-200 rounded w-20"></div>
        <div className="h-8 bg-gray-200 rounded w-20"></div>
        <div className="h-8 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  </article>
);

// Main component
const QuestionFeedPost: React.FC<QuestionFeedPostProps> = ({ 
  question, 
  currentUserId, 
  noOuterSpacing, 
  isLoading,
  refreshTrigger,
  readOnly
}) => {
  const navigate = useNavigate();
  const { getLocationNavigationProps } = useLocationNavigation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Early returns for loading and invalid states
  if (isLoading) return <LoadingSkeleton noOuterSpacing={noOuterSpacing} />;
  const isReadOnly = Boolean(readOnly) || !currentUserId;
  if (!question || (!currentUserId && !isReadOnly)) return null;

  // State
  const [answers, setAnswers] = useState<any[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);

  // Memoized values
  const answersCount = useMemo(() => question.answers_count ?? null, [question.answers_count]);
  const questionText = useMemo(() => question.text || question.description || '', [question.text, question.description]);
  const questionContext = useMemo(() => question.description || question.text, [question.description, question.text]);

  // Load answers function
  const loadAnswers = useCallback(async () => {
    setIsLoadingAnswers(true);
    try {
      const response = await questionsApi.getAnswers(question.id, { limit: 10 });
      if (response.success && response.data) {
        setAnswers(response.data);
      } else {
        console.error('Failed to load answers:', response.error);
        setAnswers([]);
      }
    } catch (error) {
      console.error('Failed to load answers:', error);
      setAnswers([]);
    } finally {
      setIsLoadingAnswers(false);
    }
  }, [question.id]);

  // Effects
  useEffect(() => {
    if (showAnswers) {
      loadAnswers();
    }
  }, [showAnswers, loadAnswers]);

  useEffect(() => {
    if (refreshTrigger && showAnswers) {
      loadAnswers();
    }
  }, [refreshTrigger, showAnswers, loadAnswers]);

  // Event handlers
  const promptLoginIfNeeded = useCallback((): boolean => {
    if (isReadOnly) {
      setShowLoginModal(true);
      return true;
    }
    return false;
  }, [isReadOnly]);

  const handleToggleAnswers = useCallback(() => {
    if (promptLoginIfNeeded()) return;
    setShowAnswers(prev => !prev);
  }, [promptLoginIfNeeded]);

  const handleAnswer = useCallback(() => {
    if (promptLoginIfNeeded()) return;
    navigate('/compose', { 
      state: { 
        questionContext, 
        questionId: question.id 
      } 
    });
  }, [navigate, questionContext, question.id, promptLoginIfNeeded]);

  const handleShare = useCallback(async () => {
    const { getBackendUrl } = await import('@/config/apiConfig');
    const url = getBackendUrl(`/share/question/${question.id}`);
    const shareData: ShareData = {
      title: 'Question',
      text: questionText || 'Check out this question',
      url
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      } else {
        window.prompt('Copy this link', url);
      }
    } catch (error) {
      console.error('Failed to share link', error);
      try {
        await navigator.clipboard?.writeText(url);
        toast.success('Link copied to clipboard');
      } catch {
        // Silent fail
      }
    }
  }, [question.id, questionText]);

  // Render functions
  const renderUserInfo = useCallback(() => {
    const userDisplay = formatUserDisplay({
      displayName: question.user_name,
      username: question.user_name,
      email: undefined
    });

    return (
      <div className="flex items-start gap-4 md:gap-5 pr-24 md:pr-36">
        <button
          onClick={() => question.user_id && navigate(`/profile/${question.user_id}`)}
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={`View ${userDisplay.name}'s profile`}
        >
          <Avatar className="h-12 w-12 md:h-14 md:w-14 border-[1.5px] border-black">
            <AvatarImage src={getProxiedImageUrl(question.user_picture)} alt={userDisplay.name} />
            <AvatarFallback className="text-sm md:text-base font-semibold">{getUserInitials({ displayName: question.user_name })}</AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div className="mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
              <button
                onClick={() => question.user_id && navigate(`/profile/${question.user_id}`)}
                className="font-bold text-sm md:text-base hover:underline cursor-pointer focus:outline-none focus:underline tracking-tight"
                aria-label={`View ${userDisplay.name}'s profile`}
              >
                {userDisplay.name}
              </button>
              {userDisplay.subtitle && (
                <span className="text-sm md:text-base text-muted-foreground font-medium">{userDisplay.subtitle}</span>
              )}
              <span className="text-sm md:text-base text-muted-foreground font-medium"> asked</span>
              <span className="text-sm md:text-base text-muted-foreground">•</span>
              <span className="text-sm md:text-base text-muted-foreground font-medium">{formatDate(question.created_at)}</span>
            </div>
          </div>

          <div className="mb-4 md:mb-5">
            <p className="text-xs md:text-sm leading-relaxed font-medium">
              {renderWithMentions(questionText, (userId) => navigate(`/profile/${userId}`))}
            </p>
          </div>
        </div>
      </div>
    );
  }, [question, questionText, navigate]);

  const renderAnswerCount = useCallback(() => {
    if (answersCount === null) {
      return <span className="animate-pulse bg-muted-foreground/20 rounded w-16 h-4 inline-block"></span>;
    }
    return `${answersCount} answer${answersCount !== 1 ? 's' : ''}`;
  }, [answersCount]);

  const renderInteractionButtons = useCallback(() => (
    <div className="flex items-center justify-between mt-4 pt-4">
      <div className="flex items-center gap-3 md:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleAnswers}
          className="flex items-center gap-2 h-9 md:h-10 px-3 md:px-4 rounded-none transition-all font-medium border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
        >
          <MessageCircle className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} />
          <span className="text-xs md:text-sm">{renderAnswerCount()}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAnswer}
          className="flex items-center gap-2 h-9 md:h-10 px-3 md:px-4 rounded-none transition-all font-medium border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02] text-blue-600 hover:text-blue-700"
        >
          <HelpCircle className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} />
          <span className="text-xs md:text-sm">Answer</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="flex items-center justify-center h-9 w-9 md:h-10 md:w-10 rounded-none transition-all border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
        >
          <Share2 className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  ), [handleToggleAnswers, handleAnswer, handleShare, renderAnswerCount]);

  const renderAnswer = useCallback((answer: any) => (
    <div key={answer.id} className="flex items-start gap-3 md:gap-4 mb-3">
      <Avatar className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0 mt-0.5 border-[1.5px] border-black/20">
        <AvatarImage src={getProxiedImageUrl(answer.user_picture)} alt={answer.user_name || 'User'} />
        <AvatarFallback className="text-xs md:text-sm font-semibold">
          {getInitials(answer.user_name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs md:text-sm font-bold tracking-tight">{answer.user_name || 'Anonymous User'}</span>
        </div>
        
        {(answer.recommendation_description || answer.description || answer.text) && (
          <p className="text-xs md:text-sm text-foreground font-medium mb-2">
            {renderWithMentions(
              answer.recommendation_description || answer.description || answer.text || '', 
              (userId) => navigate(`/profile/${userId}`)
            )}
          </p>
        )}
        
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs md:text-sm text-muted-foreground font-medium">
            {formatDate(answer.created_at)}
          </span>
        </div>
        
        {answer.recommendation_id && (
          <div className="mt-3 pl-6">
            <div className="border-l border-black/10 pl-4">
              <div 
                className="p-3 bg-muted/30 rounded-md border border-black/10 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/post/${answer.recommendation_id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {answer.place_name && (
                      <h4 className="font-bold text-xs md:text-sm mb-1 tracking-tight">{answer.place_name}</h4>
                    )}
                    {answer.recommendation_title && (
                      <p className="text-xs md:text-sm text-muted-foreground mb-2 font-medium">{answer.recommendation_title}</p>
                    )}
                    {(answer.recommendation_description || answer.description || answer.text) && (
                      <p className="text-xs md:text-sm leading-relaxed mb-2 font-medium">
                        {renderWithMentions(
                          answer.recommendation_description || answer.description || answer.text || '', 
                          (userId) => navigate(`/profile/${userId}`)
                        )}
                      </p>
                    )}
                    {answer.place_address && (() => {
                      const hasCoordinates = answer.place_lat && answer.place_lng && 
                        answer.place_lat !== 0 && answer.place_lng !== 0;
                      
                      const locationData: LocationData = {
                        lat: answer.place_lat || 0,
                        lng: answer.place_lng || 0,
                        placeName: answer.place_name || answer.place_address,
                        placeAddress: answer.place_address,
                        googlePlaceId: (answer as any).google_place_id
                      };
                      
                      const locationProps = getLocationNavigationProps({
                        hasCoordinates: Boolean(hasCoordinates),
                        locationData,
                        className: 'text-[10px] md:text-xs text-muted-foreground'
                      });
                      
                      return (
                        <p {...locationProps} className="text-[10px] md:text-xs text-muted-foreground font-medium">
                          {answer.place_address}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ), [navigate]);

  const renderAnswersSection = useCallback(() => {
    if (!showAnswers) return null;

    return (
      <div className="mt-6 pt-6 border-t border-black/10">
        {isLoadingAnswers && (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs md:text-sm text-muted-foreground font-medium">Loading answers...</div>
          </div>
        )}
        
        {!isLoadingAnswers && answers.length > 0 && (
          <div className="space-y-3 mb-4">
            {answers.map(renderAnswer)}
          </div>
        )}
        
        {!isLoadingAnswers && answers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs md:text-sm text-muted-foreground font-medium">No answers yet. Be the first to answer!</p>
          </div>
        )}
      </div>
    );
  }, [showAnswers, isLoadingAnswers, answers, renderAnswer]);

  return (
    <article className={noOuterSpacing ? "w-full" : "w-full mb-8 md:mb-10"}>
      <div className={noOuterSpacing ? "relative group transition-all" : "relative bg-white p-6 md:p-8 group border border-black/10 transition-all"}>
        {showLoginModal && (
          <LoginModal onClose={() => setShowLoginModal(false)} next={window.location.pathname + window.location.search} />
        )}
        {renderUserInfo()}        
        {renderInteractionButtons()}
        {!isReadOnly && renderAnswersSection()}
      </div>
    </article>
  );
};

export default React.memo(QuestionFeedPost);