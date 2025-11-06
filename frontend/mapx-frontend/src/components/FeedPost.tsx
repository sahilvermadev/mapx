import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FeedPostSkeleton from '@/components/skeletons/FeedPostSkeleton';
import { Heart, MessageCircle, MapPin, Star, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { socialApi, type FeedPost as FeedPostType, type Comment } from '@/services/socialService';
import { useAuth, LoginModal } from '@/auth';
import { formatUserDisplay, getUserInitials } from '../utils/userDisplay';
import { renderWithMentions, insertPlainMention, convertUsernamesToTokens } from '@/utils/mentions';
import { useLocationNavigation } from '@/hooks/useLocationNavigation';
import type { LocationData } from '@/types/location';
import ContactReveal from '@/components/ContactReveal';
import { socialApi as SocialApi } from '@/services/socialService';
import { toast } from 'sonner';

// Types
interface FeedPostProps {
  post?: FeedPostType;
  currentUserId?: string;
  onPostUpdate?: () => void;
  noOuterSpacing?: boolean;
  isLoading?: boolean;
  readOnly?: boolean;
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

const getInitials = (name: string | undefined | null): string => {
  if (!name) return 'U';
  return name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getProxiedImageUrl = (url?: string): string => {
  if (!url) return '';
  return url.includes('googleusercontent.com')
    ? `http://localhost:5000/auth/profile-picture?url=${encodeURIComponent(url)}`
    : url;
};

const getRatingMessage = (rating: number): string => {
  const roundedRating = Math.floor(rating) as keyof typeof RATING_MESSAGES;
  return RATING_MESSAGES[roundedRating] || '';
};

const renderStars = (rating: number) => (
  [...Array(STAR_COUNT)].map((_, index) => (
    <Star
      key={index}
      className={`h-3 w-3 ${
        index < Math.floor(rating) 
          ? 'fill-yellow-400 text-yellow-400' 
          : 'text-yellow-600'
      }`}
    />
  ))
);

// Component
// onPostUpdate currently unused
const FeedPost: React.FC<FeedPostProps> = ({ post, currentUserId, noOuterSpacing, isLoading, readOnly }) => {
  if (isLoading) {
    return <FeedPostSkeleton noOuterSpacing={noOuterSpacing} />;
  }

  const isReadOnly = Boolean(readOnly) || !currentUserId;
  if (!post || (!currentUserId && !isReadOnly)) {
    return null;
  }
  const navigate = useNavigate();
  const { getLocationNavigationProps } = useLocationNavigation();
  // State
  const [postData, setPostData] = useState(post);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLiked, setIsLiked] = useState(post.is_liked_by_current_user);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Mentions state for comment input
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [usernameToUser, setUsernameToUser] = useState<Record<string, { id: string; displayName: string }>>({});

  const { user: currentUser } = useAuth();

  const effectiveUserId = currentUserId || '';

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
        const res = await SocialApi.searchUsers(mentionQuery, effectiveUserId);
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
      const backendBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const url = `${backendBase}/share/post/${postData.recommendation_id}`;
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


  // Render components
  const renderRatingBadge = () => (
    <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10">
      <div className="flex flex-col items-end gap-0.5 md:gap-1">
        <div className="flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1">
          {renderStars(postData.rating)}
        </div>
        <div className="text-[10px] md:text-xs text-muted-foreground text-right leading-tight">
          {getRatingMessage(postData.rating)}
        </div>
      </div>
    </div>
  );

  const renderUserInfo = () => {
    const userDisplay = formatUserDisplay({
      displayName: postData.user_name,
      username: postData.user_name, // Use user_name as fallback
      email: undefined // Email not available in post data
    });

    return (
      <div className="flex items-start gap-3 pr-20 md:pr-32">
        <button
          onClick={() => navigate(`/profile/${postData.user_id}`)}
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={`View ${userDisplay.name}'s profile`}
        >
          <Avatar className="h-10 w-10 md:h-12 md:w-12">
            <AvatarImage src={getProxiedImageUrl(postData.user_picture)} alt={userDisplay.name} />
            <AvatarFallback>{getUserInitials({ displayName: postData.user_name })}</AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div className="mb-2 md:mb-2.5">
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              <button
                onClick={() => navigate(`/profile/${postData.user_id}`)}
                className="font-semibold text-sm hover:underline cursor-pointer focus:outline-none focus:underline"
                aria-label={`View ${userDisplay.name}'s profile`}
              >
                {userDisplay.name}
              </button>
              {userDisplay.subtitle && (
                <span className="text-sm text-muted-foreground">{userDisplay.subtitle}</span>
              )}
              {postData.place_name ? (
                <>
                  <span className="text-sm text-muted-foreground"> rated </span>
                  <span className="font-semibold text-sm">{postData.place_name}</span>
                </>
              ) : postData.title ? (
                <>
                  <span className="text-sm text-muted-foreground"> recommended </span>
                  <span className="font-semibold text-sm">{postData.title}</span>
                </>
              ) : null}
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{formatDate(postData.created_at)}</span>
            </div>
          </div>

        {(() => {
          const address =
            (postData.content_data && postData.content_data.display_address) ||
            postData.place_address ||
            (postData.content_data && (postData.content_data.address || postData.content_data.service_address));
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
            <div className="flex items-center gap-1.5 md:gap-1 text-xs text-muted-foreground mb-3 pr-20 md:pr-32">
              <MapPin className="h-3 w-3 md:h-3 md:w-3 flex-shrink-0" />
              <span {...locationProps} className="truncate flex-1 min-w-0">
                {address}
              </span>
              {postData.content_type === 'service' && (contactPhone || contactEmail) && (
                <ContactReveal
                  contact={{ phone: contactPhone, email: contactEmail }}
                  className="relative flex-shrink-0"
                  buttonClassName="h-5 w-5 md:h-5 md:w-5 hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-300/40"
                  iconClassName="h-3 w-3"
                  align="right"
                />
              )}
            </div>
          );
        })()}

        {(postData.description || (postData as any).notes) && (
          <div className="mb-3 md:mb-4">
            {/* <h4 className="font-semibold text-sm mb-1">Notes:</h4> */}
            <p className="text-sm leading-relaxed">
              {renderWithMentions(postData.description || (postData as any).notes, (userId) => navigate(`/profile/${userId}`))}
            </p>
          </div>
        )}

        {postData.labels && postData.labels.length > 0 && (
          <div className="mb-3 md:mb-4">
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              {postData.labels.slice(0, 6).map((label: string, i: number) => (
                <span key={i} className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100 transition-colors">
                  {label}
                </span>
              ))}
              {postData.labels.length > 6 && (
                <span className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300">
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
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/10">
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={`flex items-center gap-1 md:gap-2 h-8 md:h-8 px-2 md:px-3 rounded-md border border-black bg-white/95 shadow-[1px_1px_0_0_#000] transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-y-0.5 ${
            isLiked ? 'text-red-600' : 'text-foreground'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isLiked ? 'fill-current' : ''}`} />
          <span className="text-xs md:text-sm font-medium">{postData.likes_count}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleComments}
          className="flex items-center gap-1 md:gap-2 h-8 md:h-8 px-2 md:px-3 rounded-md border border-black bg-white/95 shadow-[1px_1px_0_0_#000] transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-y-0.5"
        >
          <MessageCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="text-xs md:text-sm font-medium">{postData.comments_count}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="flex items-center justify-center h-8 w-8 md:h-8 md:w-auto md:px-3 rounded-md border border-black bg-white/95 shadow-[1px_1px_0_0_#000] transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-y-0.5"
        >
          <Share2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
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
    <div key={comment.id} className={`flex items-start gap-3 ${isReply ? 'ml-10' : ''}`}>
      <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
        <AvatarImage src={getProxiedImageUrl(comment.user_picture)} alt={comment.user_name || 'User'} />
        <AvatarFallback className="text-xs">
          {getInitials(comment.user_name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{comment.user_name || 'Anonymous User'}</span>
          <span className="text-sm text-foreground">{renderWithMentions(comment.comment, (userId) => navigate(`/profile/${userId}`))}</span>
        </div>
        
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatDate(comment.created_at)}
          </span>
          
          {/* Comment like button */}
          {(comment.likes_count || 0) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCommentLike(comment.id, comment.is_liked_by_current_user || false)}
              className={`h-auto p-0 text-xs ${
                comment.is_liked_by_current_user 
                  ? 'text-red-500' 
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
              className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
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
      <form onSubmit={handleAddComment} className="flex items-center gap-3 pt-3 border-t border-border/20">
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarImage src={getProxiedImageUrl(currentUser.profilePictureUrl)} alt={currentUser.displayName} />
          <AvatarFallback className="text-xs">
            {getInitials(currentUser.displayName || 'U')}
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
            className="flex-1 text-sm border-0 bg-transparent px-0 py-2 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
          />
          {showMentionMenu && mentionSuggestions.length > 0 && (
            <div className="fixed z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md" style={{ top: mentionPosition?.top || 0, left: mentionPosition?.left || 0 }}>
              {mentionSuggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
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
            className="h-auto p-0 text-sm font-medium text-blue-500 hover:text-blue-600 disabled:text-muted-foreground disabled:opacity-50"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </form>
    )
  );

  const renderCommentsSection = () => (
    !readOnly && showComments && (
      <div className="mt-3">
        {/* Loading state */}
        {isLoadingComments && (
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-muted-foreground">Loading comments...</div>
          </div>
        )}
        
        {/* Comments display */}
        {!isLoadingComments && comments && comments.length > 0 && (
          <div className={`space-y-2 ${MAX_COMMENTS_HEIGHT} overflow-y-auto mb-3`}>
            {comments.map(comment => renderComment(comment))}
          </div>
        )}
        
        {/* No comments message */}
        {!isLoadingComments && comments && comments.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
          </div>
        )}
        
        {/* Comment form - only visible when comments are shown */}
        {!isLoadingComments && renderCommentForm()}
      </div>
    )
  );

  // Main render
  return (
    <article className={noOuterSpacing ? "w-full" : "w-full mb-6 md:mb-8"}>
      <div className={noOuterSpacing ? "relative" : "relative rounded-lg border-2 border-black bg-white p-4 md:p-6 shadow-[4px_4px_0_0_#000]"}>
        {showLoginModal && (
          <LoginModal onClose={() => setShowLoginModal(false)} next={window.location.pathname + window.location.search} />
        )}
        {renderRatingBadge()}
        {renderUserInfo()}        
        {renderInteractionButtons()}
        {renderCommentsSection()}
      </div>
    </article>
  );
};

export default React.memo(FeedPost);