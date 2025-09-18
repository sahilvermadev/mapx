import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, MapPin, Star, Clock, Share2, Bookmark, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { socialApi, type FeedPost as FeedPostType, type Comment } from '@/services/social';
import { apiClient } from '@/services/api';

// Types
interface FeedPostProps {
  post: FeedPostType;
  currentUserId: string;
  onPostUpdate?: () => void;
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

const getInitials = (name: string): string => 
  name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
const FeedPost: React.FC<FeedPostProps> = ({ post, currentUserId, onPostUpdate }) => {
  // State
  const [postData, setPostData] = useState(post);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLiked, setIsLiked] = useState(post.is_liked_by_current_user);
  const [isSaved, setIsSaved] = useState(post.is_saved || false);

  const currentUser = apiClient.getCurrentUser();

  // Effects
  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments]);

  // Event handlers
  const loadComments = async () => {
    setIsLoadingComments(true);
    try {
      const response = await socialApi.getComments(postData.annotation_id, currentUserId);
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
      const response = await socialApi.addComment(postData.annotation_id, currentUserId, newComment);
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
      const response = await socialApi.deleteComment(commentId, currentUserId);
      if (response.success) {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        // Update comment count locally
        setPostData(prev => ({ ...prev, comments_count: String(Math.max(0, parseInt(prev.comments_count) - 1)) }));
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleLike = async () => {
    try {
      if (isLiked) {
        const response = await socialApi.unlikeAnnotation(postData.annotation_id, currentUserId);
        if (response.success) {
          setIsLiked(false);
          // Update like count locally without full reload
          setPostData(prev => ({ ...prev, likes_count: Math.max(0, prev.likes_count - 1) }));
        }
      } else {
        const response = await socialApi.likeAnnotation(postData.annotation_id, currentUserId);
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

  const handleToggleComments = () => setShowComments(!showComments);

  const handleSave = async () => {
    try {
      if (isSaved) {
        const response = await socialApi.unsavePlace(postData.place_id, currentUserId);
        if (response.success) {
          setIsSaved(false);
        }
      } else {
        const response = await socialApi.savePlace(postData.place_id, currentUserId);
        if (response.success) {
          setIsSaved(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle save:', error);
    }
  };

  // Render components
  const renderRatingBadge = () => (
    <div className="absolute top-4 right-4 z-10">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 px-2 py-1">
          {renderStars(postData.rating)}
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {getRatingMessage(postData.rating)}
        </div>
      </div>
    </div>
  );

  const renderUserInfo = () => (
    <div className="flex items-start gap-3">
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={getProxiedImageUrl(postData.user_picture)} alt={postData.user_name} />
        <AvatarFallback>{getInitials(postData.user_name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="mb-2">
          <span className="font-semibold text-sm">{postData.user_name}</span>
          <span className="text-sm text-muted-foreground"> rated </span>
          <span className="font-semibold text-sm">{postData.place_name}</span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <MapPin className="h-3 w-3" />
          <span>{postData.place_address}</span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <Clock className="h-3 w-3" />
          <span>1 visit</span>
        </div>

        {postData.notes && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm mb-1">Notes:</h4>
            <p className="text-sm leading-relaxed">{postData.notes}</p>
          </div>
        )}

        {postData.labels && postData.labels.length > 0 && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm mb-1">Favorite Dishes:</h4>
            <div className="space-y-1">
              {postData.labels.map((label, i) => (
                <div key={i} className="text-sm">• {label}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderInteractionButtons = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={`flex items-center gap-2 h-8 px-2 ${
            isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
          <span className="text-sm">{postData.likes_count}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleComments}
          className="flex items-center gap-2 h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{postData.comments_count}</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Plus className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`h-8 w-8 p-0 ${isSaved ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={handleSave}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
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
        const response = await socialApi.unlikeComment(commentId, currentUserId);
        if (response.success) {
          setComments(prev => updateCommentInState(prev, commentId, {
            is_liked_by_current_user: false,
            likes_count: (prev.find(c => c.id === commentId)?.likes_count || 0) - 1
          }));
        }
      } else {
        const response = await socialApi.likeComment(commentId, currentUserId);
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
        <AvatarImage src={getProxiedImageUrl(comment.user_picture)} alt={comment.user_name} />
        <AvatarFallback className="text-xs">
          {getInitials(comment.user_name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{comment.user_name}</span>
          <span className="text-sm text-foreground">{comment.comment}</span>
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
          <Input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={isSubmitting}
            className="flex-1 text-sm border-0 bg-transparent px-0 py-2 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
          />
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
    showComments && (
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
    <article className="w-full border-b border-border/50 pb-6 mb-6 last:border-b-0">
      <div className="relative">
        {renderRatingBadge()}
        {renderUserInfo()}        
        {renderInteractionButtons()}
        {renderCommentsSection()}
      </div>
    </article>
  );
};

export default FeedPost; 