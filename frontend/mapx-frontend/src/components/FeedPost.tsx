import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FeedPostSkeleton from '@/components/skeletons/FeedPostSkeleton';
import { Heart, MessageCircle, MapPin, Star, Share2, Edit2, Trash2, X, Save, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { socialApi, type FeedPost as FeedPostType, type Comment } from '@/services/socialService';
import { useAuth, LoginModal } from '@/auth';
import { formatUserDisplay, getUserInitials } from '../utils/userDisplay';
import { renderWithMentions, insertPlainMention, convertUsernamesToTokens } from '@/utils/mentions';
import { useLocationNavigation } from '@/hooks/useLocationNavigation';
import type { LocationData } from '@/types/location';
import ContactReveal from '@/components/ContactReveal';
import { recommendationsApi } from '@/services/recommendationsApiService';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileTheme } from '@/contexts/ProfileThemeContext';
import { THEMES } from '@/services/profileService';
import { CURATED_LABELS } from '@/components/composer/constants';
import { getTagInlineStyles } from '@/utils/themeUtils';
import LabelPicker from '@/components/LabelPicker';

// Types
interface FeedPostProps {
  post?: FeedPostType;
  currentUserId?: string;
  onPostUpdate?: (deletedPostId?: number) => void;
  noOuterSpacing?: boolean;
  isLoading?: boolean;
  readOnly?: boolean;
  allowEdit?: boolean; // Only show edit/delete buttons on profile page
}

// Constants
const RATING_MESSAGES = {
  5: "Truly exceptional!",
  4: "Really good!",
  3: "Worth trying!",
  2: "Just okay!",
  1: "Not it!"
} as const;

const STAR_COUNT = 5;
const MAX_COMMENTS_HEIGHT = 'max-h-48';

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


import { getProfilePictureUrl } from '@/config/apiConfig';

const getProxiedImageUrl = (url?: string): string => {
  if (!url) return '';
  return getProfilePictureUrl(url) || url;
};

const getRatingMessage = (rating: number): string => {
  const roundedRating = Math.floor(rating) as keyof typeof RATING_MESSAGES;
  return RATING_MESSAGES[roundedRating] || '';
};

const renderStars = (rating: number) => (
  [...Array(STAR_COUNT)].map((_, index) => (
    <Star
      key={index}
      className={`h-3.5 w-3.5 ${
        index < Math.floor(rating) 
          ? 'fill-yellow-400 text-yellow-400' 
          : 'text-yellow-600'
      }`}
      strokeWidth={1.5}
    />
  ))
);

// Component
const FeedPost: React.FC<FeedPostProps> = ({ post, currentUserId, noOuterSpacing, isLoading, readOnly, allowEdit = false, onPostUpdate }) => {
  if (isLoading) {
    return <FeedPostSkeleton noOuterSpacing={noOuterSpacing} />;
  }

  const isReadOnly = Boolean(readOnly) || !currentUserId;
  if (!post || (!currentUserId && !isReadOnly)) {
    return null;
  }
  const navigate = useNavigate();
  const { getLocationNavigationProps } = useLocationNavigation();
  const { theme: userTheme } = useTheme();
  const { profileTheme, profileThemeObject } = useProfileTheme();
  // Use profile theme if available (viewing someone else's profile), otherwise use viewer's theme
  const themeName = profileTheme || userTheme;
  // Validate theme before accessing THEMES to prevent runtime errors
  const selectedTheme = profileThemeObject || (userTheme && THEMES[userTheme as keyof typeof THEMES] 
    ? THEMES[userTheme as keyof typeof THEMES] 
    : null);
  
  
  // Get theme-specific tag styles with fallback
  const tagStyle = selectedTheme?.tagStyle || {
    background: '#F5F5F5',
    textColor: '#000000',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: '1px',
    shadow: 'none',
    hoverBackground: '#F5F5F5',
  };
  
  // Helper to format background (gradient or solid)
  const getTagBackground = (bg: string | { from: string; to: string }): string => {
    if (typeof bg === 'string') return bg;
    return `linear-gradient(135deg, ${bg.from} 0%, ${bg.to} 100%)`;
  };
  
  const tagBackground = getTagBackground(tagStyle.background);
  
  // State
  const [postData, setPostData] = useState(post);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLiked, setIsLiked] = useState(post.is_liked_by_current_user);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title || '');
  const [editDescription, setEditDescription] = useState(post.description || '');
  const [editRating, setEditRating] = useState(post.rating || 0);
  const [editVisibility, setEditVisibility] = useState<'friends' | 'public'>((post.visibility as 'friends' | 'public') || 'public');
  const [editLabels, setEditLabels] = useState<string[]>(post.labels || []);
  const [showLabelPicker, setShowLabelPicker] = useState<boolean>(false);
  
  // Get tag inline styles for theme
  const tagInlineStyles = React.useMemo(() => getTagInlineStyles(themeName), [themeName]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Mentions state for comment input
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [usernameToUser, setUsernameToUser] = useState<Record<string, { id: string; displayName: string }>>({});

  const { user: currentUser } = useAuth();

  const effectiveUserId = currentUserId || '';
  const isOwnPost = postData.user_id === currentUserId;
  const canEdit = allowEdit && isOwnPost; // Only allow editing on profile page for own posts

  // Effects
  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments]);

  // Fetch mention suggestions for comment input
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!mentionQuery || mentionQuery.length < 1) {
        if (active) setMentionSuggestions([]);
        return;
      }
      try {
        const res = await socialApi.searchUsers(mentionQuery, effectiveUserId);
        if (active && (res as any).success) setMentionSuggestions((res as any).data || []);
      } catch {
        if (active) setMentionSuggestions([]);
      }
    };
    run();
    return () => { active = false; };
  }, [mentionQuery, currentUserId]);

  // Event handlers
  const loadComments = async () => {
    setIsLoadingComments(true);
    try {
      const response = await socialApi.getComments(postData.recommendation_id, effectiveUserId);
      if (response.success && response.data) {
        setComments(response.data);
      } else {
        console.error('Failed to load comments:', response.error);
        setComments([]);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Convert any @username to stable @[id:name] tokens based on mapping
      const textWithTokens = convertUsernamesToTokens(newComment, usernameToUser);
      const response = await socialApi.addComment(postData.recommendation_id, effectiveUserId, textWithTokens);
      if (response.success && response.data) {
        setComments(prev => [response.data!, ...prev]);
        setNewComment('');
        // Update comment count locally
        setPostData(prev => ({ ...prev, comments_count: String(parseInt(prev.comments_count) + 1) }));
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const response = await socialApi.deleteComment(commentId, effectiveUserId);
      if (response.success) {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        // Update comment count locally
        setPostData(prev => ({ ...prev, comments_count: String(Math.max(0, parseInt(prev.comments_count) - 1)) }));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const promptLoginIfNeeded = () => {
    if (readOnly) {
      setShowLoginModal(true);
      return true;
    }
    return false;
  };

  const handleLike = async () => {
    if (promptLoginIfNeeded()) return;
    try {
      if (isLiked) {
        const response = await socialApi.unlikeAnnotation(postData.recommendation_id, effectiveUserId);
        if (response.success) {
          setIsLiked(false);
          // Update like count locally without full reload
          setPostData(prev => ({ ...prev, likes_count: Math.max(0, prev.likes_count - 1) }));
        }
      } else {
        const response = await socialApi.likeAnnotation(postData.recommendation_id, effectiveUserId);
        if (response.success) {
          setIsLiked(true);
          // Update like count locally without full reload
          setPostData(prev => ({ ...prev, likes_count: prev.likes_count + 1 }));
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleToggleComments = () => {
    if (promptLoginIfNeeded()) return;
    setShowComments(!showComments);
  };

  const handleShare = async () => {
    try {
      const { getBackendUrl } = await import('@/config/apiConfig');
      const url = getBackendUrl(`/share/post/${postData.recommendation_id}`);
      const shareData: ShareData = {
        title: postData.place_name || postData.title || 'Post',
        text: postData.description || 'Check out this post on RECCE',
        url
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      } else {
        // Fallback
        const success = document.execCommand && document.execCommand('copy');
        if (!success) {
          // As a last resort, show the URL to the user
          window.prompt('Copy this link', url);
        }
      }
    } catch (e) {
      console.error('Failed to share link', e);
      try {
        const url = `${window.location.origin}/post/${postData.recommendation_id}`;
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      } catch {}
    }
  };

  // Label management functions
  const removeLabel = React.useCallback((labelToRemove: string) => {
    setEditLabels(prev => prev.filter(l => l !== labelToRemove));
  }, []);

  const handleStartEdit = () => {
    setEditTitle(postData.title || '');
    setEditDescription(postData.description || '');
    setEditRating(postData.rating || 0);
    setEditVisibility((postData.visibility as 'friends' | 'public') || 'public');
    setEditLabels(postData.labels || []);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(postData.title || '');
    setEditDescription(postData.description || '');
    setEditRating(postData.rating || 0);
    setEditVisibility((postData.visibility as 'friends' | 'public') || 'public');
    setEditLabels(postData.labels || []);
    setShowLabelPicker(false);
  };

  const handleSaveEdit = async () => {
    if (!effectiveUserId) return;
    
    setIsSaving(true);
    let toastShown = false;
    
    try {
      const updates: any = {
        description: editDescription,
        rating: editRating,
        visibility: editVisibility,
      };

      if (editTitle.trim()) {
        updates.title = editTitle.trim();
      }

      if (editLabels && editLabels.length > 0) {
        updates.labels = editLabels;
      }

      const success = await recommendationsApi.updateRecommendation(
        postData.recommendation_id,
        updates
      );

      if (success) {
        // Update local state
        setPostData(prev => ({
          ...prev,
          title: editTitle.trim() || prev.title,
          description: editDescription,
          rating: editRating,
          visibility: editVisibility,
          labels: editLabels || prev.labels,
        }));
        setIsEditing(false);
        toastShown = true;
        toast.success('Recommendation updated successfully');
        
        // Call onPostUpdate if provided, but don't let errors here show another toast
        if (onPostUpdate) {
          try {
            onPostUpdate();
          } catch (error) {
            // Silently handle errors from onPostUpdate to avoid duplicate toasts
            console.error('Error in onPostUpdate callback:', error);
          }
        }
      } else {
        if (!toastShown) {
          toastShown = true;
          toast.error('Failed to update recommendation');
        }
      }
    } catch (error) {
      console.error('Failed to update recommendation:', error);
      if (!toastShown) {
        toast.error('Failed to update recommendation');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!effectiveUserId) return;
    
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    const postId = postData.recommendation_id;
    
    try {
      const success = await recommendationsApi.deleteRecommendation(
        postId,
        effectiveUserId
      );

      if (success) {
        toast.success('Recommendation deleted successfully');
        // Call onPostUpdate if provided to refresh the list
        // Pass the post ID for optimistic UI updates
        if (onPostUpdate) {
          try {
            // onPostUpdate handles cache invalidation and optimistic updates
            // If it fails, it will rollback the optimistic update internally
            await onPostUpdate(postId);
          } catch (error) {
            // onPostUpdate failed (e.g., refetch failed)
            // The callback should handle rollback internally, but we show an error
            console.error('Error in onPostUpdate callback:', error);
            toast.error('Post deleted but failed to refresh. Please refresh the page.');
          }
        } else {
          // If no callback, remove from view by setting post to null
          setPostData(null as any);
        }
      } else {
        // API returned success: false
        toast.error('Failed to delete recommendation');
      }
    } catch (error) {
      // API call failed (network error, etc.)
      console.error('Failed to delete recommendation:', error);
      toast.error('Failed to delete recommendation. Please try again.');
      // Note: onPostUpdate is not called, so no optimistic update was made
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };


  // Render components
  const renderRatingBadge = () => (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex items-center gap-0.5">
        {renderStars(postData.rating)}
      </div>
      <span className="text-xs text-muted-foreground font-medium">
        {getRatingMessage(postData.rating)}
      </span>
    </div>
  );

  const renderMenuButton = () => {
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
  };

  const renderEditableRatingBadge = () => {
    if (!isEditing) return null;

    return (
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setEditRating(rating)}
              className="focus:outline-none hover:scale-110 transition-transform"
            >
              <Star
                className={`h-3.5 w-3.5 ${
                  rating <= editRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-yellow-600'
                } transition-colors`}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {getRatingMessage(editRating)}
        </span>
      </div>
    );
  };

  const renderUserInfo = () => {
    const userDisplay = formatUserDisplay({
      displayName: postData.user_name,
      username: postData.user_name, // Use user_name as fallback
      email: undefined // Email not available in post data
    });

    if (isEditing) {
      const address =
        (postData.content_data && postData.content_data.display_address) ||
        postData.place_address ||
        (postData.content_data && (postData.content_data.address || postData.content_data.service_address));
      const contactPhone = (postData.content_data && (postData.content_data.contact_info?.phone || postData.content_data.phone)) || undefined;
      const contactEmail = (postData.content_data && (postData.content_data.contact_info?.email || postData.content_data.email)) || undefined;
      const hasCoordinates = postData.place_lat && postData.place_lng && 
        postData.place_lat !== 0 && postData.place_lng !== 0;
      
      const locationData: LocationData = {
        lat: postData.place_lat || 0,
        lng: postData.place_lng || 0,
        placeName: postData.place_name || address,
        placeAddress: address,
        googlePlaceId: (postData as any).google_place_id || (postData.content_data && (postData.content_data as any).google_place_id)
      };
      
      const locationProps = getLocationNavigationProps({
        hasCoordinates: Boolean(hasCoordinates),
        locationData,
        className: 'md:truncate'
      });

      return (
        <div className="flex items-start gap-3 md:gap-4 pr-10 md:pr-12">
          <button
            onClick={() => navigate(`/profile/${postData.user_id}`)}
            className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            aria-label={`View ${userDisplay.name}'s profile`}
          >
            <Avatar className="h-10 w-10 md:h-12 md:w-12">
              <AvatarImage src={getProxiedImageUrl(postData.user_picture)} alt={userDisplay.name} />
              <AvatarFallback className="text-sm md:text-base font-semibold">{getUserInitials({ displayName: postData.user_name })}</AvatarFallback>
            </Avatar>
          </button>

          <div className="flex-1 min-w-0 w-full">
            <div className="mb-2">
              <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
                <button
                  onClick={() => navigate(`/profile/${postData.user_id}`)}
                  className="font-bold text-xs md:text-sm hover:underline cursor-pointer focus:outline-none focus:underline tracking-tight"
                  aria-label={`View ${userDisplay.name}'s profile`}
                >
                  {userDisplay.name}
                </button>
                {userDisplay.subtitle && (
                  <span className="text-xs md:text-sm text-muted-foreground font-medium">{userDisplay.subtitle}</span>
                )}
                {postData.place_name ? (
                  <>
                    <span className="text-xs md:text-sm text-muted-foreground font-medium"> rated </span>
                    <span className="font-bold text-xs md:text-sm tracking-tight">{postData.place_name}</span>
                  </>
                ) : editTitle ? (
                  <>
                    <span className="text-xs md:text-sm text-muted-foreground font-medium"> recommended </span>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title..."
                      className="inline-block w-auto min-w-[100px] max-w-[200px] h-auto py-0 px-2 text-xs md:text-sm font-bold border-b-[1.5px] border-dashed border-black/30 focus:border-black focus:outline-none bg-transparent rounded-none"
                    />
                  </>
                ) : (
                  <>
                    <span className="text-xs md:text-sm text-muted-foreground font-medium"> recommended </span>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Add title..."
                      className="inline-block w-auto min-w-[100px] max-w-[200px] h-auto py-0 px-2 text-xs md:text-sm font-bold border-b-[1.5px] border-dashed border-black/30 focus:border-black focus:outline-none bg-transparent rounded-none"
                    />
                  </>
                )}
                <span className="text-xs md:text-sm text-muted-foreground">•</span>
                <span className="text-xs md:text-sm text-muted-foreground font-medium">{formatDate(postData.created_at)}</span>
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

            {address && (
              <div className="flex items-center gap-2 md:gap-2.5 text-[10px] md:text-xs text-muted-foreground mb-2 font-medium">
                <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" strokeWidth={1.5} />
                <span {...locationProps} className="truncate">
                  {address}
                </span>
                {postData.content_type === 'service' && (contactPhone || contactEmail) && (
                  <ContactReveal
                    contact={{ phone: contactPhone, email: contactEmail }}
                    className="relative flex-shrink-0 ml-3"
                    buttonClassName="h-5 w-5 md:h-5 md:w-5 hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-300/40"
                    iconClassName="h-3 w-3"
                    align="right"
                  />
                )}
              </div>
            )}

            {renderEditableRatingBadge()}

            <div className="mb-2">
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full text-xs leading-relaxed border-[1.5px] border-dashed border-black/30 focus:border-black focus:ring-0 resize-none min-h-[60px] bg-transparent rounded-none font-medium"
                style={{ boxShadow: '2px 2px 0 0 rgba(0,0,0,0.1)' }}
                required
              />
            </div>

            {/* Labels */}
            <div className="mb-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {editLabels.length > 0 && (
                    <>
                      {editLabels.map((label: string, i: number) => (
                        <span 
                          key={i} 
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md"
                          style={tagInlineStyles}
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => removeLabel(label)}
                            className="ml-1.5 text-xs hover:opacity-70"
                            aria-label={`Remove ${label}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLabelPicker(!showLabelPicker)}
                    className="h-7 px-2 text-xs border-[1.5px] border-dashed rounded-none"
                    style={{
                      backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
                      color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
                      borderColor: selectedTheme?.borderColorMuted || 'rgba(0, 0, 0, 0.3)',
                      boxShadow: '2px 2px 0 0 rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTheme) {
                        e.currentTarget.style.borderColor = selectedTheme.borderColor || '#000000';
                        e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || selectedTheme.cardBackground || '#FFFFFF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTheme) {
                        e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.backgroundColor = selectedTheme.cardBackground || '#FFFFFF';
                      }
                    }}
                  >
                    {showLabelPicker ? 'Hide Labels' : '+ Add Labels'}
                  </Button>
                </div>
              </div>

              {/* Label Picker Panel */}
              <LabelPicker
                labels={CURATED_LABELS}
                selectedLabels={editLabels}
                onLabelsChange={setEditLabels}
                variant="inline"
                isOpen={showLabelPicker}
                onClose={() => setShowLabelPicker(false)}
                showSearch={true}
                maxHeight="max-h-[40vh]"
                initiallyExpanded={true}
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t-[1.5px] border-black/20 mt-3">
              <Button
                onClick={handleSaveEdit}
                disabled={isSaving || !editDescription.trim()}
                size="sm"
                className="h-7 md:h-8 px-3 md:px-4 text-xs font-medium border-[1.5px] border-black rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                style={{ 
                  backgroundColor: '#000',
                  color: '#fff',
                  boxShadow: isSaving || !editDescription.trim() ? 'none' : '3px 3px 0 0 #000'
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
                className="h-7 md:h-8 px-3 md:px-4 text-xs font-medium border-[1.5px] rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                style={{
                  backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
                  color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
                  borderColor: selectedTheme?.borderColor || '#000000',
                  boxShadow: '2px 2px 0 0 #000'
                }}
                onMouseEnter={(e) => {
                  if (selectedTheme && !isSaving) {
                    e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || selectedTheme.buttonGhost?.hover || selectedTheme.cardBackground || '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTheme && !isSaving) {
                    e.currentTarget.style.backgroundColor = selectedTheme.cardBackground || '#FFFFFF';
                  }
                }}
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
    <div className={`flex items-start gap-3 md:gap-4 ${noOuterSpacing ? '' : 'pr-10 md:pr-12'}`}>
        <button
          onClick={() => navigate(`/profile/${postData.user_id}`)}
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={`View ${userDisplay.name}'s profile`}
        >
          <Avatar className="h-10 w-10 md:h-12 md:w-12">
            <AvatarImage src={getProxiedImageUrl(postData.user_picture)} alt={userDisplay.name} />
            <AvatarFallback className="text-sm md:text-base font-semibold">{getUserInitials({ displayName: postData.user_name })}</AvatarFallback>
          </Avatar>
        </button>

        <div className={`flex-1 min-w-0 ${noOuterSpacing ? 'max-w-3xl' : 'w-full'}`}>
          <div className="mb-2">
            <div className="flex items-center gap-2 md:gap-2.5 flex-wrap">
              <button
                onClick={() => navigate(`/profile/${postData.user_id}`)}
                className="font-bold text-xs md:text-sm hover:underline cursor-pointer focus:outline-none focus:underline tracking-tight"
                aria-label={`View ${userDisplay.name}'s profile`}
              >
                {userDisplay.name}
              </button>
              {userDisplay.subtitle && (
                <span className="text-xs md:text-sm text-muted-foreground font-medium">{userDisplay.subtitle}</span>
              )}
              {postData.place_name ? (
                <>
                  <span className="text-xs md:text-sm text-muted-foreground font-medium"> rated </span>
                  <span className="font-bold text-xs md:text-sm tracking-tight">{postData.place_name}</span>
                </>
              ) : postData.title ? (
                <>
                  <span className="text-xs md:text-sm text-muted-foreground font-medium"> recommended </span>
                  <span className="font-bold text-xs md:text-sm tracking-tight">{postData.title}</span>
                </>
              ) : null}
              <span className="text-xs md:text-sm text-muted-foreground">•</span>
              <span className="text-xs md:text-sm text-muted-foreground font-medium">{formatDate(postData.created_at)}</span>
            </div>
          </div>

        {(() => {
          let address =
            (postData.content_data && postData.content_data.display_address) ||
            postData.place_address ||
            (postData as any).service_address ||
            (postData.content_data && (postData.content_data.address || postData.content_data.service_address));
          
          // Handle case where address might be a JSON string (legacy data from bug)
          if (address && typeof address === 'string') {
            // Check if it looks like JSON (starts with { and ends with })
            if (address.trim().startsWith('{') && address.trim().endsWith('}')) {
              try {
                const parsed = JSON.parse(address);
                // If it's a location object, construct a readable address
                if (parsed.city_name) {
                  address = [parsed.city_name, parsed.admin1_name, parsed.country_code]
                    .filter(Boolean)
                    .join(', ');
                } else {
                  // If we can't parse it meaningfully, try to use place_address, service_address, or fallback
                  address = postData.place_address || (postData as any).service_address || null;
                }
              } catch (e) {
                // If parsing fails, it's not JSON, use as-is
              }
            }
          }
          
          const contactPhone = (postData.content_data && (postData.content_data.contact_info?.phone || postData.content_data.phone)) || undefined;
          const contactEmail = (postData.content_data && (postData.content_data.contact_info?.email || postData.content_data.email)) || undefined;
          if (!address) return null;
          
          // Check if we have coordinates for navigation
          const hasCoordinates = postData.place_lat && postData.place_lng && 
            postData.place_lat !== 0 && postData.place_lng !== 0;
          
          const locationData: LocationData = {
            lat: postData.place_lat || 0,
            lng: postData.place_lng || 0,
            placeName: postData.place_name || address,
            placeAddress: address,
            googlePlaceId: (postData as any).google_place_id || (postData.content_data && (postData.content_data as any).google_place_id)
          };
          
          const locationProps = getLocationNavigationProps({
            hasCoordinates: Boolean(hasCoordinates),
            locationData,
            className: 'md:truncate'
          });
          
          return (
            <div className="flex items-center gap-2 md:gap-2.5 text-[10px] md:text-xs text-muted-foreground mb-2 font-medium">
              <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" strokeWidth={1.5} />
              <span {...locationProps} className="truncate">
                {address}
              </span>
              {postData.content_type === 'service' && (contactPhone || contactEmail) && (
                <ContactReveal
                  contact={{ phone: contactPhone, email: contactEmail }}
                  className="relative flex-shrink-0 ml-3"
                  buttonClassName="h-5 w-5 md:h-5 md:w-5 hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-300/40"
                  iconClassName="h-3 w-3"
                  align="right"
                />
              )}
            </div>
          );
        })()}

        {renderRatingBadge()}

        {(postData.description || (postData as any).notes) && (
          <div className="mb-2">
            <p className="text-xs leading-relaxed font-medium">
              {renderWithMentions(postData.description || (postData as any).notes, (userId) => navigate(`/profile/${userId}`))}
            </p>
          </div>
        )}

        {postData.content_data && (() => {
          const highlights = postData.content_data.highlights || postData.content_data.specialities;
          const hasHighlights = highlights && (
            (typeof highlights === 'string' && highlights.trim().length > 0) ||
            (Array.isArray(highlights) && highlights.length > 0 && highlights.some(h => h && String(h).trim().length > 0))
          );
          return hasHighlights ? (
            <div className="mb-2">
              <div className="flex items-start gap-2">
                <span 
                  className="text-xs font-medium min-w-0 flex-shrink-0"
                  style={{
                    color: selectedTheme?.textMuted || selectedTheme?.textSecondary || '#6B7280',
                  }}
                >
                  Highlights:
                </span>
                <span 
                  className="text-xs font-medium"
                  style={{
                    color: selectedTheme?.textPrimary || '#000000',
                  }}
                >
                  {Array.isArray(highlights) ? highlights.filter(h => h && String(h).trim()).join(', ') : highlights}
                </span>
              </div>
            </div>
          ) : null;
        })()}

        {/* Service-specific rich details */}
        {postData.content_type === 'service' && postData.content_data && (() => {
          const serviceData = postData.content_data;
          const priceRange = serviceData.service_price_range || serviceData.price_range;
          const experienceSummary = serviceData.service_experience || serviceData.experience_summary;
          const verbatimQuote = serviceData.service_quote || serviceData.verbatim_quote;
          const contextTags = serviceData.context_tags || [];
          const categoryName = serviceData.service_category_name || serviceData.category_name;
          
          const hasServiceDetails = priceRange || experienceSummary || verbatimQuote || contextTags.length > 0 || categoryName;

          if (!hasServiceDetails) return null;

          return (
            <div className="mb-3 space-y-2 p-3 rounded-lg border" 
              style={{
                backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
                borderColor: selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Category Badge */}
              {categoryName && (
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary"
                    className="text-xs"
                    style={selectedTheme ? {
                      backgroundColor: selectedTheme.accentColor + '20',
                      color: selectedTheme.accentColor,
                      borderColor: selectedTheme.accentColor,
                    } : undefined}
                  >
                    {categoryName}
                  </Badge>
                </div>
              )}

              {/* Price Range */}
              {priceRange && (
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-medium"
                    style={{ color: selectedTheme?.textMuted || '#6B7280' }}
                  >
                    Price:
                  </span>
                  <span 
                    className="text-xs font-bold"
                    style={{ color: selectedTheme?.textPrimary || '#000000' }}
                  >
                    {priceRange}
                  </span>
                </div>
              )}

              {/* Experience Summary */}
              {experienceSummary && (
                <div className="space-y-1">
                  <span 
                    className="text-xs font-medium"
                    style={{ color: selectedTheme?.textMuted || '#6B7280' }}
                  >
                    Experience:
                  </span>
                  <p 
                    className="text-xs leading-relaxed"
                    style={{ color: selectedTheme?.textPrimary || '#000000' }}
                  >
                    {experienceSummary}
                  </p>
                </div>
              )}

              {/* Verbatim Quote */}
              {verbatimQuote && (
                <div className="space-y-1 pl-3 border-l-2"
                  style={{ borderColor: selectedTheme?.accentColor || '#000000' }}
                >
                  <span 
                    className="text-xs font-medium italic"
                    style={{ color: selectedTheme?.textPrimary || '#000000' }}
                  >
                    "{verbatimQuote}"
                  </span>
                </div>
              )}

              {/* Context Tags */}
              {contextTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {contextTags.map((tag: string, idx: number) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0.5"
                      style={selectedTheme ? {
                        borderColor: selectedTheme.borderColor,
                        color: selectedTheme.textPrimary,
                      } : undefined}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {postData.labels && postData.labels.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {postData.labels.slice(0, 6).map((label: string, i: number) => (
                <span 
                  key={i} 
                  className="inline-flex items-center px-2.5 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md cursor-default"
                  style={{
                    background: tagBackground,
                    color: tagStyle.textColor,
                    border: `${tagStyle.borderWidth || '1px'} solid ${tagStyle.borderColor || 'rgba(0, 0, 0, 0.1)'}`,
                    boxShadow: tagStyle.shadow === 'none' ? 'none' : (tagStyle.shadow || 'none'),
                  }}
                >
                  {label}
                </span>
              ))}
              {postData.labels.length > 6 && (
                <span 
                  className="inline-flex items-center px-2.5 md:px-3 py-1 md:py-1.5 text-xs font-medium rounded-md"
                  style={{
                    background: tagBackground,
                    color: tagStyle.textColor,
                    border: `${tagStyle.borderWidth || '1px'} solid ${tagStyle.borderColor || 'rgba(0, 0, 0, 0.1)'}`,
                    boxShadow: tagStyle.shadow === 'none' ? 'none' : (tagStyle.shadow || 'none'),
                  }}
                >
                  +{postData.labels.length - 6} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

  const renderInteractionButtons = () => (
    <div className="flex items-center justify-between mt-2 pt-2">
      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className="flex items-center gap-1.5 h-7 md:h-8 px-2 md:px-3 rounded-none transition-all font-medium border border-transparent bg-transparent"
          style={{
            color: isLiked ? '#DC2626' : (selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000'),
            borderColor: 'transparent',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            if (selectedTheme) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonGhost.hover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Heart 
            className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isLiked ? 'fill-current' : ''}`} 
            strokeWidth={1.5}
            style={{
              color: isLiked ? '#DC2626' : (selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000'),
            }}
          />
          <span 
            className="text-xs"
            style={{
              color: isLiked ? '#DC2626' : (selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000'),
            }}
          >
            {postData.likes_count}
          </span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleComments}
          className="flex items-center gap-1.5 h-7 md:h-8 px-2 md:px-3 rounded-none transition-all font-medium border border-transparent bg-transparent"
          style={{
            color: selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000',
            borderColor: 'transparent',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            if (selectedTheme) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonGhost.hover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <MessageCircle 
            className="h-3.5 w-3.5 md:h-4 md:w-4" 
            strokeWidth={1.5}
            style={{
              color: selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000',
            }}
          />
          <span 
            className="text-xs"
            style={{
              color: selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000',
            }}
          >
            {postData.comments_count}
          </span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-none transition-all border border-transparent bg-transparent"
          style={{
            color: selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000',
            borderColor: 'transparent',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            if (selectedTheme) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonGhost.hover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Share2 
            className="h-3.5 w-3.5 md:h-4 md:w-4" 
            strokeWidth={1.5}
            style={{
              color: selectedTheme?.buttonGhost.text || selectedTheme?.textPrimary || '#000000',
            }}
          />
        </Button>
      </div>
    </div>
  );

  const updateCommentInState = (comments: Comment[], commentId: number, updates: Partial<Comment>): Comment[] => {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return { ...comment, ...updates };
      }
      if (comment.replies && comment.replies.length > 0) {
        return { ...comment, replies: updateCommentInState(comment.replies, commentId, updates) };
      }
      return comment;
    });
  };

  const handleCommentLike = async (commentId: number, isCurrentlyLiked: boolean) => {
    try {
      if (isCurrentlyLiked) {
        const response = await socialApi.unlikeComment(commentId, effectiveUserId);
        if (response.success) {
          setComments(prev => updateCommentInState(prev, commentId, {
            is_liked_by_current_user: false,
            likes_count: (prev.find(c => c.id === commentId)?.likes_count || 0) - 1
          }));
        }
      } else {
        const response = await socialApi.likeComment(commentId, effectiveUserId);
        if (response.success) {
          setComments(prev => updateCommentInState(prev, commentId, {
            is_liked_by_current_user: true,
            likes_count: (prev.find(c => c.id === commentId)?.likes_count || 0) + 1
          }));
        }
      }
    } catch (error) {
      console.error('Failed to toggle comment like:', error);
    }
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => (
    <div key={comment.id} className={`flex items-start gap-2 md:gap-3 ${isReply ? 'ml-10 md:ml-12' : ''} mb-2`}>
      <Avatar className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 mt-0.5 border-[1.5px] border-black/20">
        <AvatarImage src={getProxiedImageUrl(comment.user_picture)} alt={comment.user_name || 'User'} />
        <AvatarFallback className="text-xs font-semibold">
          {getUserInitials({ displayName: comment.user_name || 'User' })}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span
            className="text-xs font-bold tracking-tight"
            style={{ color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#FFFFFF' }}
          >
            {comment.user_name || 'Anonymous User'}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#E5E5E5' }}
          >
            {renderWithMentions(comment.comment, (userId) => navigate(`/profile/${userId}`))}
          </span>
        </div>
        
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground font-medium">
            {formatDate(comment.created_at)}
          </span>
          
          {/* Comment like button */}
          {(comment.likes_count || 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommentLike(comment.id, comment.is_liked_by_current_user || false)}
              className={`h-auto p-0 text-xs font-medium ${
                comment.is_liked_by_current_user 
                  ? 'text-red-600' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {comment.likes_count} like{comment.likes_count !== 1 ? 's' : ''}
            </Button>
          )}
          
          {comment.user_id === currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteComment(comment.id)}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive font-medium"
            >
              Delete
            </Button>
          )}
        </div>
        
        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCommentForm = () => (
    currentUser && (
      <form onSubmit={handleAddComment} className="flex items-center gap-2 md:gap-3 pt-2 border-t border-black/10 mt-2">
        <Avatar className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 border-[1.5px] border-black/20">
          <AvatarImage src={getProxiedImageUrl(currentUser.profilePictureUrl)} alt={currentUser.displayName} />
          <AvatarFallback className="text-xs font-semibold">
            {getUserInitials({ displayName: currentUser.displayName || 'User' })}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 flex items-center">
          <div className="relative flex-1 flex items-center">
          <Input
            type="text"
            value={newComment}
            onChange={(e) => {
              const v = e.target.value;
              setNewComment(v);
              const pos = (e.target as HTMLInputElement).selectionStart || v.length;
              const left = v.slice(0, pos);
              const at = left.lastIndexOf('@');
              if (at >= 0 && (at === 0 || /\s|[([{-]/.test(left[at - 1] || ''))) {
                const query = left.slice(at + 1);
                if (/^[\w.\-]{0,30}$/.test(query)) {
                  setMentionQuery(query);
                  setShowMentionMenu(true);
                  const el = e.target as HTMLInputElement;
                  const rect = el.getBoundingClientRect();
                  const computed = window.getComputedStyle(el);
                  const textUpToCursor = el.value.substring(0, at);
                  const lines = textUpToCursor.split('\n');
                  const currentLine = lines.length - 1;
                  const currentLineText = lines[currentLine] || '';
                  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;
                  const fontSize = parseFloat(computed.fontSize);
                  const charWidth = fontSize * 0.6;
                  const paddingLeft = parseFloat(computed.paddingLeft) || 0;
                  const paddingTop = parseFloat(computed.paddingTop) || 0;
                  const p = {
                    x: rect.left + paddingLeft + (currentLineText.length * charWidth),
                    y: rect.top + paddingTop + (currentLine * lineHeight)
                  };
                  const pickerWidth = 256;
                  const pickerHeight = 200;
                  let top = p.y + window.scrollY + 20;
                  let leftPx = p.x + window.scrollX;
                  if (top + pickerHeight > window.innerHeight) top = p.y + window.scrollY - pickerHeight - 8;
                  if (leftPx + pickerWidth > window.innerWidth) leftPx = window.innerWidth - pickerWidth - 8;
                  if (leftPx < 8) leftPx = 8;
                  setMentionPosition({ top, left: leftPx });
                } else {
                  setShowMentionMenu(false);
                  setMentionQuery(null);
                }
              } else {
                setShowMentionMenu(false);
                setMentionQuery(null);
              }
            }}
            placeholder="Add a comment..."
            disabled={isSubmitting}
            className="flex-1 text-[11px] md:text-xs border-0 bg-transparent px-0 py-1 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground font-medium"
            style={{
              backgroundColor: selectedTheme?.inputBackground || selectedTheme?.cardBackground || 'transparent',
              color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#FFFFFF',
            }}
          />
          {showMentionMenu && mentionSuggestions.length > 0 && (
            <div className="fixed z-50 w-64 border-[1.5px] border-black bg-popover text-popover-foreground" style={{ top: mentionPosition?.top || 0, left: mentionPosition?.left || 0, boxShadow: '3px 3px 0 0 #000' }}>
              {mentionSuggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent font-medium"
                  onClick={() => {
                    const cursor = newComment.length;
                    const uname = (u.username || '').toLowerCase() || (u.display_name || u.user_name || '').toLowerCase().replace(/\s+/g, '');
                    const { text: nt } = insertPlainMention(newComment, cursor, uname);
                    const display = u.display_name || u.user_name || uname;
                    setUsernameToUser(prev => ({ ...prev, [uname]: { id: u.id, displayName: display } }));
                    setNewComment(nt);
                    setShowMentionMenu(false);
                    setMentionQuery(null);
                    setMentionPosition(null);
                  }}
                >
                  {u.profile_picture_url && (
                    <img src={u.profile_picture_url} className="h-6 w-6 rounded-full" />
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-medium">{u.display_name || u.user_name}</span>
                    {u.username && (
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={!newComment.trim() || isSubmitting}
            className="h-7 md:h-8 px-3 md:px-4 border-[1.5px] rounded-none transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: selectedTheme?.borderColor || '#FFFFFF',
              backgroundColor: (!newComment.trim() || isSubmitting)
                ? (selectedTheme?.cardBackground || 'transparent')
                : (selectedTheme?.buttonPrimary?.background || selectedTheme?.accentColor || selectedTheme?.cardBackground || '#FFFFFF'),
              color: (!newComment.trim() || isSubmitting)
                ? (selectedTheme?.textMuted || selectedTheme?.textSecondary || '#9CA3AF')
                : (selectedTheme?.buttonPrimary?.text || selectedTheme?.textOnAccent || '#000000'),
              boxShadow: (!newComment.trim() || isSubmitting) ? 'none' : '2px 2px 0 0 #000',
            }}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </form>
    )
  );

  const renderCommentsSection = () => (
    !readOnly && showComments && (
      <div className="mt-3 pt-3 border-t border-black/10">
        {/* Loading state */}
        {isLoadingComments && (
          <div className="flex items-center justify-center py-4">
            <div className="text-xs text-muted-foreground font-medium">Loading comments...</div>
          </div>
        )}
        
        {/* Comments display */}
        {!isLoadingComments && comments && comments.length > 0 && (
          <div className={`space-y-2 ${MAX_COMMENTS_HEIGHT} overflow-y-auto mb-2`}>
            {comments.map(comment => renderComment(comment))}
          </div>
        )}
        
        {/* No comments message */}
        {!isLoadingComments && comments && comments.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground font-medium">No comments yet. Be the first to comment!</p>
          </div>
        )}
        
        {/* Comment form - only visible when comments are shown */}
        {!isLoadingComments && renderCommentForm()}
      </div>
    )
  );

  // Don't render if post was deleted
  if (!postData) {
    return null;
  }

  // Main render
  return (
    <>
      {/* Dimming overlay when in edit mode */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleCancelEdit}
          />
        )}
      </AnimatePresence>

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
              <div 
                className="border-[1.5px] rounded-lg p-6 md:p-8 max-w-md w-full shadow-[6px_6px_0_0_#000]"
                style={{
                  backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
                  borderColor: selectedTheme?.borderColor || '#000000',
                }}
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 border-[1.5px] border-red-300 flex items-center justify-center">
                    <Trash2 className="h-6 w-6 text-red-600" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                      Delete Recommendation?
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground font-medium">
                      This action cannot be undone. The recommendation will be permanently removed.
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

      <article 
        className={noOuterSpacing ? "w-full" : "w-full mb-1.5 md:mb-2"}
        style={{ position: isEditing ? 'relative' : 'static', zIndex: isEditing ? 9999 : 'auto' }}
      >
        <div 
          className={noOuterSpacing ? "relative group transition-all" : "relative p-3 md:p-4 group border transition-all"}
          style={noOuterSpacing ? undefined : {
            backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
            borderColor: selectedTheme?.borderColorMuted || 'rgba(0, 0, 0, 0.1)',
            color: selectedTheme?.textPrimary || '#000000',
          }}
          onClick={(e) => isEditing && e.stopPropagation()}
        >
          {showLoginModal && (
            <LoginModal onClose={() => setShowLoginModal(false)} next={window.location.pathname + window.location.search} />
          )}
          {renderMenuButton()}
          {renderUserInfo()}        
          {!isEditing && renderInteractionButtons()}
          {!isEditing && renderCommentsSection()}
        </div>
      </article>
    </>
  );
};

export default React.memo(FeedPost);