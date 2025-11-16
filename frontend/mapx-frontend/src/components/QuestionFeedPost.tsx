import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MessageSquarePlus, MessageCircle, Share2, ChevronDown, ChevronUp, MapPin, ExternalLink, Star, Edit2, Trash2, MoreVertical, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { questionsApi } from '@/services/questionsService';
import { formatUserDisplay, getUserInitials } from '../utils/userDisplay';
import { renderWithMentions } from '@/utils/mentions';
import { useLocationNavigation } from '@/hooks/useLocationNavigation';
import type { LocationData } from '@/types/location';
import { toast } from 'sonner';
import { LoginModal } from '@/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES, type ThemeName } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';

// Types
interface QuestionFeedPostProps {
  question?: any;
  currentUserId?: string;
  onQuestionUpdate?: () => void;
  noOuterSpacing?: boolean;
  isLoading?: boolean;
  refreshTrigger?: number;
  readOnly?: boolean;
  allowEdit?: boolean; // Only show edit/delete buttons on profile page
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

// Question card background colors that complement each theme
// These are very light, desaturated versions that provide subtle "lift" from the feed
const QUESTION_CARD_BACKGROUNDS: Record<ThemeName, string> = {
  'neo-brutal': '#FEFBF0', // Very light, desaturated yellow
  'ocean': '#F5F9F8', // Very light, desaturated teal
  'sunset': '#FCF8F8', // Very light, desaturated pink
  'forest': '#F8FBF9', // Very light, desaturated green
  'monochrome': '#F8F8F8', // Light gray as suggested
};

import { getProfilePictureUrl } from '@/config/apiConfig';

const getProxiedImageUrl = (url?: string): string => {
  if (!url) return '';
  return getProfilePictureUrl(url) || url;
};

// Loading skeleton component
const LoadingSkeleton: React.FC<{ noOuterSpacing?: boolean }> = ({ noOuterSpacing }) => (
  <article className={noOuterSpacing ? "w-full" : "w-full mb-1.5 md:mb-2"}>
    <div className={noOuterSpacing ? "relative animate-pulse" : "relative rounded-lg border-2 border-black bg-white p-3 md:p-4 shadow-[4px_4px_0_0_#000] animate-pulse"}>
      <div className="flex items-start gap-3 mb-2">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1">
          <div className="h-3 bg-gray-200 rounded w-1/3 mb-1.5"></div>
          <div className="h-2.5 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="flex gap-2">
        <div className="h-7 bg-gray-200 rounded w-16"></div>
        <div className="h-7 bg-gray-200 rounded w-16"></div>
        <div className="h-7 bg-gray-200 rounded w-12"></div>
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
  readOnly,
  allowEdit = false,
  onQuestionUpdate
}) => {
  const navigate = useNavigate();
  const { getLocationNavigationProps } = useLocationNavigation();
  const { theme } = useTheme();
  const selectedTheme = THEMES[theme];
  const questionCardBackground = QUESTION_CARD_BACKGROUNDS[theme];
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Early returns for loading and invalid states
  if (isLoading) return <LoadingSkeleton noOuterSpacing={noOuterSpacing} />;
  const isReadOnly = Boolean(readOnly) || !currentUserId;
  if (!question || (!currentUserId && !isReadOnly)) return null;

  // State
  const [answers, setAnswers] = useState<any[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isLoadingAnswers, setIsLoadingAnswers] = useState(false);
  
  // Edit/Delete state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editText, setEditText] = useState(question?.text || '');
  const [editVisibility, setEditVisibility] = useState<'friends' | 'public'>((question?.visibility as 'friends' | 'public') || 'friends');
  const [editLabels, setEditLabels] = useState(question?.labels?.join(', ') || '');

  // Memoized values
  const answersCount = useMemo(() => question.answers_count ?? null, [question.answers_count]);
  const isOwnQuestion = useMemo(() => {
    return currentUserId && question.user_id && currentUserId === question.user_id;
  }, [currentUserId, question.user_id]);
  const questionText = useMemo(() => question.text || question.description || '', [question.text, question.description]);
  const questionContext = useMemo(() => question.description || question.text, [question.description, question.text]);
  const canEdit = useMemo(() => {
    return allowEdit && isOwnQuestion && !isReadOnly;
  }, [allowEdit, isOwnQuestion, isReadOnly]);

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

  // Sync edit state when question changes
  useEffect(() => {
    if (question) {
      setEditText(question.text || '');
      setEditVisibility((question.visibility as 'friends' | 'public') || 'friends');
      setEditLabels(question.labels?.join(', ') || '');
    }
  }, [question]);

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

  // Edit handlers
  const handleStartEdit = useCallback(() => {
    setEditText(question.text || '');
    setEditVisibility((question.visibility as 'friends' | 'public') || 'friends');
    setEditLabels(question.labels?.join(', ') || '');
    setIsEditing(true);
  }, [question]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText(question.text || '');
    setEditVisibility((question.visibility as 'friends' | 'public') || 'friends');
    setEditLabels(question.labels?.join(', ') || '');
  }, [question]);

  const handleSaveEdit = useCallback(async () => {
    if (!currentUserId) return;
    
    setIsSaving(true);
    let toastShown = false;
    
    try {
      const labelsArray = editLabels.trim() 
        ? editLabels.split(',').map(l => l.trim()).filter(l => l.length > 0)
        : undefined;

      const updates: any = {
        text: editText.trim(),
        visibility: editVisibility,
      };

      if (labelsArray && labelsArray.length > 0) {
        updates.labels = labelsArray;
      }

      const success = await questionsApi.updateQuestion(question.id, updates);

      if (success) {
        setIsEditing(false);
        toastShown = true;
        toast.success('Question updated successfully');
        
        // Call onQuestionUpdate if provided
        if (onQuestionUpdate) {
          try {
            onQuestionUpdate();
          } catch (error) {
            console.error('Error in onQuestionUpdate callback:', error);
          }
        }
      } else {
        if (!toastShown) {
          toastShown = true;
          toast.error('Failed to update question');
        }
      }
    } catch (error) {
      console.error('Failed to update question:', error);
      if (!toastShown) {
        toast.error('Failed to update question');
      }
    } finally {
      setIsSaving(false);
    }
  }, [currentUserId, editText, editVisibility, editLabels, question.id, onQuestionUpdate]);

  // Delete handlers
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!currentUserId) return;
    
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    const questionId = question.id;
    
    try {
      const success = await questionsApi.deleteQuestion(questionId);

      if (success) {
        toast.success('Question deleted successfully');
        // Call onQuestionUpdate if provided to refresh the list
        if (onQuestionUpdate) {
          try {
            onQuestionUpdate();
          } catch (error) {
            console.error('Error in onQuestionUpdate callback:', error);
            toast.error('Question deleted but failed to refresh. Please refresh the page.');
          }
        }
      } else {
        toast.error('Failed to delete question');
      }
    } catch (error) {
      console.error('Failed to delete question:', error);
      toast.error('Failed to delete question. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [currentUserId, question.id, onQuestionUpdate]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  // Render functions
  const renderMenuButton = useCallback(() => {
    if (!canEdit || isEditing) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 md:top-4 md:right-4 z-20 h-7 w-7 md:h-8 md:w-8 p-0 bg-transparent hover:bg-gray-50 transition-all rounded-none"
            aria-label="More options"
          >
            <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 border-[1.5px] border-black" style={{ boxShadow: '3px 3px 0 0 #000' }}>
          <DropdownMenuItem onClick={handleStartEdit} className="cursor-pointer font-medium">
            <Edit2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDeleteClick} 
            variant="destructive"
            className="cursor-pointer text-red-600 focus:text-red-600 font-medium"
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [canEdit, isEditing, handleStartEdit, handleDeleteClick, isDeleting]);

  const renderUserInfo = useCallback(() => {
    const userDisplay = formatUserDisplay({
      displayName: question.user_name,
      username: question.user_name,
      email: undefined
    });

    if (isEditing) {
      const labelsArray = editLabels.trim() 
        ? editLabels.split(',').map(l => l.trim()).filter(l => l.length > 0)
        : [];

      return (
        <div className="flex items-start gap-3 md:gap-4 pr-24 md:pr-36">
          <button
            onClick={() => question.user_id && navigate(`/profile/${question.user_id}`)}
            className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label={`View ${userDisplay.name}'s profile`}
          >
            <Avatar className="h-10 w-10 md:h-12 md:w-12">
              <AvatarImage src={getProxiedImageUrl(question.user_picture)} alt={userDisplay.name} />
              <AvatarFallback className="text-sm md:text-base font-semibold">{getUserInitials({ displayName: question.user_name })}</AvatarFallback>
            </Avatar>
          </button>

          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
                <button
                  onClick={() => question.user_id && navigate(`/profile/${question.user_id}`)}
                  className="font-bold text-xs md:text-sm hover:underline cursor-pointer focus:outline-none focus:underline tracking-tight"
                  aria-label={`View ${userDisplay.name}'s profile`}
                >
                  {userDisplay.name}
                </button>
                {userDisplay.subtitle && (
                  <span className="text-xs md:text-sm text-muted-foreground font-medium">{userDisplay.subtitle}</span>
                )}
                <span className="text-xs md:text-sm text-muted-foreground font-medium"> asked</span>
                <span className="text-xs md:text-sm text-muted-foreground">•</span>
                <span className="text-xs md:text-sm text-muted-foreground font-medium">{formatDate(question.created_at)}</span>
                <span className="text-xs md:text-sm text-muted-foreground ml-1">•</span>
                <Select value={editVisibility} onValueChange={(value: 'friends' | 'public') => setEditVisibility(value)}>
                  <SelectTrigger className="h-auto w-auto p-0 border-0 shadow-none text-xs md:text-sm text-muted-foreground hover:text-foreground font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[1.5px] border-black" style={{ boxShadow: '3px 3px 0 0 #000' }}>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="friends">Friends Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Ask a question..."
                className="w-full text-xs leading-relaxed border-[1.5px] border-dashed border-black/30 focus:border-black focus:ring-0 resize-none min-h-[60px] bg-transparent rounded-none font-medium"
                style={{ boxShadow: '2px 2px 0 0 rgba(0,0,0,0.1)' }}
                required
              />
            </div>

            <div className="mb-2">
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <Input
                  value={editLabels}
                  onChange={(e) => setEditLabels(e.target.value)}
                  placeholder="Add labels (comma-separated)..."
                  className="inline-block w-auto min-w-[150px] max-w-[300px] h-auto py-1 px-2 text-xs border-[1.5px] border-dashed border-black/30 focus:border-black focus:outline-none bg-transparent rounded-none font-medium"
                  style={{ boxShadow: '2px 2px 0 0 rgba(0,0,0,0.1)' }}
                />
                {labelsArray.length > 0 && (
                  <>
                    {labelsArray.slice(0, 6).map((label: string, i: number) => (
                      <span 
                        key={i} 
                        className="inline-flex items-center px-2.5 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md cursor-default bg-muted/50 border border-black/10"
                      >
                        {label}
                      </span>
                    ))}
                    {labelsArray.length > 6 && (
                      <span className="inline-flex items-center px-2.5 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md bg-muted/50 border border-black/10">
                        +{labelsArray.length - 6} more
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t-[1.5px] border-black/20 mt-3">
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving || !editText.trim()}
                size="sm"
                className="h-7 md:h-8 px-3 md:px-4 text-xs font-medium border-[1.5px] border-black rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                style={{ 
                  backgroundColor: '#000',
                  color: '#fff',
                  boxShadow: isSaving || !editText.trim() ? 'none' : '3px 3px 0 0 #000'
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
                <Save className="h-3.5 w-3.5 ml-1.5" strokeWidth={1.5} />
              </Button>
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                disabled={isSaving}
                size="sm"
                className="h-7 md:h-8 px-3 md:px-4 text-xs font-medium border-[1.5px] border-black rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                style={{ boxShadow: '2px 2px 0 0 #000' }}
              >
                Cancel
                <X className="h-3.5 w-3.5 ml-1.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 md:gap-4 pr-24 md:pr-36">
        <button
          onClick={() => question.user_id && navigate(`/profile/${question.user_id}`)}
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={`View ${userDisplay.name}'s profile`}
        >
          <Avatar className="h-10 w-10 md:h-12 md:w-12">
            <AvatarImage src={getProxiedImageUrl(question.user_picture)} alt={userDisplay.name} />
            <AvatarFallback className="text-sm md:text-base font-semibold">{getUserInitials({ displayName: question.user_name })}</AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
              <button
                onClick={() => question.user_id && navigate(`/profile/${question.user_id}`)}
                className="font-bold text-xs md:text-sm hover:underline cursor-pointer focus:outline-none focus:underline tracking-tight"
                aria-label={`View ${userDisplay.name}'s profile`}
              >
                {userDisplay.name}
              </button>
              {userDisplay.subtitle && (
                <span className="text-xs md:text-sm text-muted-foreground font-medium">{userDisplay.subtitle}</span>
              )}
              <span className="text-xs md:text-sm text-muted-foreground font-medium"> asked</span>
              <span className="text-xs md:text-sm text-muted-foreground">•</span>
              <span className="text-xs md:text-sm text-muted-foreground font-medium">{formatDate(question.created_at)}</span>
            </div>
          </div>

          <div className="mb-2">
            <p className="text-xs leading-relaxed font-medium">
              {renderWithMentions(questionText, (userId) => navigate(`/profile/${userId}`))}
            </p>
          </div>
        </div>
      </div>
    );
  }, [question, questionText, navigate, isEditing, editText, editVisibility, editLabels, handleSaveEdit, handleCancelEdit, isSaving]);

  const renderAnswerCount = useCallback(() => {
    if (answersCount === null) {
      return <span className="animate-pulse bg-muted-foreground/20 rounded w-16 h-4 inline-block"></span>;
    }
    if (answersCount === 0) {
      return 'No answers yet';
    }
    return `${answersCount} answer${answersCount !== 1 ? 's' : ''}`;
  }, [answersCount]);

  // Helper to darken a hex color for hover state
  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
    const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const renderInteractionButtons = useCallback(() => {
    if (isEditing) return null; // Hide interaction buttons when editing
    
    const accentColor = selectedTheme.accentColor;
    const textColor = getReadableTextColor(accentColor);
    const hoverColor = darkenColor(accentColor, 0.1); // Darken by 10% for hover

    return (
      <div className="flex items-center justify-between mt-2 pt-2">
        <div className="flex items-center gap-1.5 md:gap-2">
          {answersCount !== null && answersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleAnswers}
              className="flex items-center gap-1.5 h-7 md:h-8 px-2 md:px-3 rounded-none transition-all font-medium border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
            >
              <MessageCircle className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
              <span className="text-xs">
                {showAnswers ? 'Hide' : 'View'} {renderAnswerCount()}
              </span>
              {showAnswers ? (
                <ChevronUp className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={2} />
              ) : (
                <ChevronDown className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={2} />
              )}
            </Button>
          )}
          
          {!isOwnQuestion && (
            <Button
              variant="default"
              size="sm"
              onClick={handleAnswer}
              className="flex items-center gap-1.5 h-7 md:h-8 px-2 md:px-3 rounded-none transition-colors duration-200 font-medium border border-transparent"
              style={{
                backgroundColor: accentColor,
                color: textColor,
                borderColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = hoverColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = accentColor;
              }}
            >
              <MessageSquarePlus className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
              <span className="text-xs">Answer</span>
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-none transition-all border border-transparent bg-transparent hover:border-black/40 hover:bg-black/[0.02]"
            aria-label="Share question"
          >
            <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    );
  }, [handleToggleAnswers, handleAnswer, handleShare, renderAnswerCount, answersCount, showAnswers, selectedTheme, isOwnQuestion, isEditing]);

  const renderAnswer = useCallback((answer: any, index: number) => {
    const answerText = answer.recommendation_description || answer.description || answer.text || '';
    const hasPlace = answer.recommendation_id && answer.place_name;
    const hasCoordinates = answer.place_lat && answer.place_lng && 
      answer.place_lat !== 0 && answer.place_lng !== 0;
    
    // Get address
    const address = answer.place_address || 
      (answer.content_data && (answer.content_data.display_address || answer.content_data.address || answer.content_data.service_address)) ||
      null;

    return (
      <motion.div
        key={answer.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ 
          delay: index * 0.05,
          duration: 0.2,
          ease: 'easeOut'
        }}
        className="bg-white border border-black/10 rounded-lg p-3 md:p-4 pb-3 last:pb-3 border-b border-black/5 last:border-b-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        onClick={() => answer.recommendation_id && navigate(`/post/${answer.recommendation_id}`)}
      >
        <div className="flex items-start gap-2 md:gap-3 pr-20 md:pr-24">
          <button
            onClick={(e) => {
              e.stopPropagation();
              answer.user_id && navigate(`/profile/${answer.user_id}`);
            }}
            className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label={`View ${answer.user_name || 'User'}'s profile`}
          >
            <Avatar className="h-8 w-8 md:h-9 md:w-9 border-[1.5px] border-black/20">
              <AvatarImage src={getProxiedImageUrl(answer.user_picture)} alt={answer.user_name || 'User'} />
              <AvatarFallback className="text-xs font-semibold">
                {getInitials(answer.user_name)}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    answer.user_id && navigate(`/profile/${answer.user_id}`);
                  }}
                  className="font-bold text-xs hover:underline cursor-pointer focus:outline-none focus:underline tracking-tight"
                >
                  {answer.user_name || 'Anonymous User'}
                </button>
                {hasPlace && (
                  <>
                    <span className="text-xs text-muted-foreground font-medium"> rated </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${answer.recommendation_id}`);
                      }}
                      className="font-bold text-xs tracking-tight hover:underline"
                    >
                      {answer.place_name}
                    </button>
                  </>
                )}
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground font-medium">{formatDate(answer.created_at)}</span>
              </div>
            </div>

            {/* Address */}
            {address && (() => {
              const locationData: LocationData = {
                lat: answer.place_lat || 0,
                lng: answer.place_lng || 0,
                placeName: answer.place_name || address,
                placeAddress: address,
                googlePlaceId: (answer as any).google_place_id
              };
              
              const locationProps = getLocationNavigationProps({
                hasCoordinates: Boolean(hasCoordinates),
                locationData,
                className: 'text-[10px] md:text-xs text-muted-foreground'
              });
              
              return (
                <div className="flex items-center gap-2 md:gap-2.5 text-[10px] md:text-xs text-muted-foreground mb-2 font-medium">
                  <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" strokeWidth={1.5} />
                  <span {...locationProps} className="truncate">
                    {address}
                  </span>
                </div>
              );
            })()}

            {/* Rating */}
            {answer.recommendation_rating && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < Math.floor(answer.recommendation_rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-yellow-600/30'
                      }`}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span className="text-[10px] md:text-xs text-muted-foreground font-medium">
                  {answer.recommendation_rating}/5
                </span>
              </div>
            )}

            {/* Description/Answer text */}
            {answerText && (
              <div className="mb-2">
                <p className="text-xs leading-relaxed font-medium">
                  {renderWithMentions(
                    answerText, 
                    (userId) => {
                      navigate(`/profile/${userId}`);
                    }
                  )}
                </p>
              </div>
            )}

            {/* Labels/Tags */}
            {answer.recommendation_labels && answer.recommendation_labels.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {answer.recommendation_labels.slice(0, 4).map((label: string, i: number) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center px-2 py-0.5 text-[10px] md:text-xs font-medium rounded-md bg-muted/50 border border-black/10"
                  >
                    {label}
                  </span>
                ))}
                {answer.recommendation_labels.length > 4 && (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] md:text-xs font-medium rounded-md bg-muted/50 border border-black/10">
                    +{answer.recommendation_labels.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }, [navigate, getLocationNavigationProps]);

  const renderAnswersSection = useCallback(() => {
    if (!showAnswers) return null;

    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="mt-3 pt-3 border-t border-black/10"
      >
        {isLoadingAnswers && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-black/10 rounded-lg p-3 md:p-4 animate-pulse">
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-gray-200 border border-black/10"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-10 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!isLoadingAnswers && answers.length > 0 && (
          <LayoutGroup>
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {answers.map((answer, index) => renderAnswer(answer, index))}
              </div>
            </AnimatePresence>
          </LayoutGroup>
        )}
        
        {!isLoadingAnswers && answers.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-6"
          >
            <MessageCircle className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-3">
              {isOwnQuestion ? 'No answers yet. Waiting for others to answer!' : 'No answers yet. Be the first to answer!'}
            </p>
            {!isOwnQuestion && (
              <Button
                variant="default"
                size="sm"
                onClick={handleAnswer}
                className="flex items-center gap-1.5 h-7 md:h-8 px-3 md:px-4 rounded-none transition-all font-semibold border-[1.5px] border-black bg-blue-600 hover:bg-blue-700 text-white shadow-[2px_2px_0_0_#000] hover:shadow-[3px_3px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] mx-auto"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2} />
                <span className="text-xs">Answer this question</span>
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }, [showAnswers, isLoadingAnswers, answers, renderAnswer, handleAnswer, isOwnQuestion]);

  return (
    <article className={noOuterSpacing ? "w-full" : "w-full mb-1.5 md:mb-2"}>
      <div 
        className={noOuterSpacing ? "relative group transition-all" : "relative p-3 md:p-4 group border border-black/10 transition-all"}
        style={{
          backgroundColor: noOuterSpacing ? 'transparent' : questionCardBackground,
        }}
      >
        {showLoginModal && (
          <LoginModal onClose={() => setShowLoginModal(false)} next={window.location.pathname + window.location.search} />
        )}
        {renderMenuButton()}
        {renderUserInfo()}        
        {renderInteractionButtons()}
        {!isReadOnly && renderAnswersSection()}
      </div>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleDeleteCancel}
            />
            <motion.div
              className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white border-[1.5px] border-black rounded-lg p-6 md:p-8 max-w-md w-full shadow-[6px_6px_0_0_#000]">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 border-[1.5px] border-red-300 flex items-center justify-center">
                    <Trash2 className="h-6 w-6 text-red-600" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                      Delete Question?
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground font-medium">
                      This action cannot be undone. The question will be permanently removed.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleDeleteCancel}
                    disabled={isDeleting}
                    className="border-[1.5px] border-black rounded-none px-5 py-2 h-auto font-medium transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    style={{ boxShadow: '2px 2px 0 0 #000' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                    className="border-[1.5px] border-black rounded-none px-5 py-2 h-auto font-medium transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none bg-red-600 text-white hover:bg-red-700"
                    style={{ boxShadow: isDeleting ? 'none' : '3px 3px 0 0 #000' }}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </article>
  );
};

export default React.memo(QuestionFeedPost);