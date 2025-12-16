import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Star, Heart, MapPin, MessageCircle } from 'lucide-react';
import { recommendationsApi, type PlaceRecommendation } from '../services/recommendationsApiService';
import { formatGoogleTypeForDisplay } from '../utils/placeTypes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { CardTitle } from '@/components/ui/card';
import ReviewItemSkeleton from '@/components/skeletons/ReviewItemSkeleton';
import './ContentCard.css';
import { renderWithMentions } from '@/utils/mentions';
import { socialApi, type Comment } from '../services/social';
import { useAuth } from '../auth';
import LoginModal from '../auth/components/LoginModal';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  category: string; // Google Places type (e.g., 'restaurant', 'bar', 'cafe', 'night_club', etc.)
  images?: string[];
  isSaved?: boolean;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
}

// Constants
const MAX_COMMENTS_HEIGHT = 'max-h-48';
const DEFAULT_REVIEWS_LIMIT = 10;
const SKELETON_COUNT = 3;

// Real review type from API
interface RealReview {
  id: number;
  user_name: string;
  user_picture?: string | null;
  title?: string;
  notes?: string;
  rating?: number;
  created_at: string;
  content_data?: Record<string, any>;
  likes_count?: number;
  comments_count?: number;
  is_liked_by_current_user?: boolean;
}

// Helper type for review state management
interface ReviewLikeState {
  count: number;
  isLiked: boolean;
}

// Helper type for review comments state
interface ReviewCommentsState {
  comments: Comment[];
  isLoading: boolean;
  isSubmitting: boolean;
  newComment: string;
  showComments: boolean;
}

interface ContentCardProps {
  place: PlaceDetails;
  onClose: () => void;
}

// Helper functions
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

const getInitials = (name: string): string => 
  name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// Helper function to transform API recommendation to RealReview
const transformRecommendationToReview = (rec: PlaceRecommendation & { likes_count?: number; comments_count?: number; is_liked_by_current_user?: boolean }): RealReview => ({
  id: rec.id,
  user_name: rec.user_name,
  user_picture: rec.user_picture || null,
  title: rec.title,
  notes: rec.description,
  rating: rec.rating,
  created_at: rec.created_at,
  content_data: rec.content_data,
  likes_count: rec.likes_count || 0,
  comments_count: rec.comments_count || 0,
  is_liked_by_current_user: rec.is_liked_by_current_user || false,
});

const ContentCard: React.FC<ContentCardProps> = ({
  place,
  onClose,
}) => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [realReviews, setRealReviews] = useState<RealReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [networkAverageRating, setNetworkAverageRating] = useState<number | null>(null);
  const [networkRatingCount, setNetworkRatingCount] = useState<number>(0);
  
  // Consolidated state for likes and comments per review
  const [reviewLikes, setReviewLikes] = useState<Record<number, ReviewLikeState>>({});
  const [reviewCommentsState, setReviewCommentsState] = useState<Record<number, ReviewCommentsState>>({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Initialize mobile detection immediately to avoid flash
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Memoized values
  const totalImages = useMemo(() => place.images?.length || 0, [place.images]);
  const currentUserId = useMemo(() => currentUser?.id || '', [currentUser?.id]);

  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Drag handlers for mobile swipe-to-close
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);
  
  const handleDragEnd = useCallback((_event: unknown, info: { offset: { y: number } }) => {
    if (isMobile && info.offset.y > 100) {
      onClose();
    } else {
      // Reset position if not dragged enough
      y.set(0);
    }
  }, [isMobile, onClose, y]);

  // Fetch real recommendations when component mounts
  useEffect(() => {
    const fetchReviews = async () => {
      if (!place.google_place_id) {
        setReviewsLoading(false);
        setReviewsError('This location was added manually and doesn\'t have Google Place data. Reviews are only available for places found through Google Places.');
        setRealReviews([]);
        return;
      }

      try {
        setReviewsLoading(true);
        setReviewsError(null);
        
        // First, get the database place ID from Google Place ID
        const placeInfo = await recommendationsApi.getPlaceByGoogleId(place.google_place_id);
        
        if (!placeInfo) {
          // Place doesn't exist in our database yet, so no reviews
          setRealReviews([]);
          setReviewsLoading(false);
          return;
        }

        // Now get recommendations using the database place ID
        const recommendations = await recommendationsApi.getPlaceRecommendations(placeInfo.id, 'friends', DEFAULT_REVIEWS_LIMIT);
        
        // Transform API data to our review format
        const reviews: RealReview[] = recommendations.map(transformRecommendationToReview);
        setRealReviews(reviews);
        
        // Initialize likes state for all reviews
        const initialLikes: Record<number, ReviewLikeState> = {};
        reviews.forEach(review => {
          initialLikes[review.id] = {
            count: review.likes_count || 0,
            isLiked: review.is_liked_by_current_user || false
          };
        });
        setReviewLikes(initialLikes);

        // Fetch consolidated network-only rating
        try {
          const net = await recommendationsApi.getPlaceNetworkRating(placeInfo.id);
          setNetworkAverageRating(net.average_rating);
          setNetworkRatingCount(net.rating_count);
        } catch (e) {
          console.warn('Failed to fetch network rating');
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
        setReviewsError(error instanceof Error ? error.message : 'Failed to load reviews');
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [place.google_place_id]);

  // Helper function to initialize comments state for a review
  const getCommentsState = useCallback(
    (reviewId: number): ReviewCommentsState => {
      return reviewCommentsState[reviewId] || {
        comments: [],
        isLoading: false,
        isSubmitting: false,
        newComment: '',
        showComments: false,
      };
    },
    [reviewCommentsState]
  );

  // Helper function to update comments state for a review
  const updateCommentsState = useCallback(
    (reviewId: number, updates: Partial<ReviewCommentsState>) => {
      setReviewCommentsState(prev => ({
        ...prev,
        [reviewId]: { ...(prev[reviewId] || getCommentsState(reviewId)), ...updates },
      }));
    },
    [getCommentsState]
  );

  // Small helper to ensure the user is authenticated before performing
  // comment-related actions. Returns true if authenticated.
  const ensureAuthenticatedForComments = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginModal(true);
      return false;
    }
    return true;
  }, [isAuthenticated, currentUser]);


  // Handle like/unlike for a review
  const handleLike = useCallback(async (reviewId: number) => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginModal(true);
      return;
    }

    const currentLikeState = reviewLikes[reviewId] || { count: 0, isLiked: false };
    const newIsLiked = !currentLikeState.isLiked;

    // Optimistic update
    setReviewLikes(prev => ({
      ...prev,
      [reviewId]: {
        count: newIsLiked ? currentLikeState.count + 1 : Math.max(0, currentLikeState.count - 1),
        isLiked: newIsLiked
      }
    }));

    try {
      const response = newIsLiked
        ? await socialApi.likeAnnotation(reviewId, currentUserId)
        : await socialApi.unlikeAnnotation(reviewId, currentUserId);
      
      if (!response.success) {
        // Rollback on failure
        setReviewLikes(prev => ({
          ...prev,
          [reviewId]: currentLikeState
        }));
        console.error('Failed to toggle like:', response.error);
      }
    } catch (error) {
      // Rollback on error
      setReviewLikes(prev => ({
        ...prev,
        [reviewId]: currentLikeState
      }));
      console.error('Failed to toggle like:', error);
    }
  }, [isAuthenticated, currentUser, currentUserId, reviewLikes]);

  // Load comments for a review
  const loadCommentsForReview = useCallback(
    async (reviewId: number) => {
      updateCommentsState(reviewId, { isLoading: true });

      try {
        const response = await socialApi.getComments(reviewId, currentUserId);
        if (response.success && response.data) {
          updateCommentsState(reviewId, {
            comments: response.data,
            isLoading: false,
          });
        } else {
          updateCommentsState(reviewId, {
            comments: [],
            isLoading: false,
          });
          console.error('Failed to load comments:', response.error);
        }
      } catch (error) {
        console.error('Failed to load comments:', error);
        updateCommentsState(reviewId, {
          comments: [],
          isLoading: false,
        });
      }
    },
    [currentUserId, updateCommentsState]
  );

  // Handle toggle comments for a review
  const handleToggleComments = useCallback(
    (reviewId: number) => {
      // Require authentication to interact with comments
      if (!ensureAuthenticatedForComments()) return;

      const currentState = getCommentsState(reviewId);
      const isShowing = currentState.showComments;
      const newShowState = !isShowing;

      // Update show state immediately so the UI responds to the tap
      updateCommentsState(reviewId, { showComments: newShowState });

      // If we're opening and haven't loaded comments yet, fetch them
      if (
        newShowState &&
        currentState.comments.length === 0 &&
        !currentState.isLoading
      ) {
        void loadCommentsForReview(reviewId);
      }
    },
    [ensureAuthenticatedForComments, getCommentsState, updateCommentsState, loadCommentsForReview]
  );

  // Handle add comment
  const handleAddComment = useCallback(async (reviewId: number, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ensureAuthenticatedForComments()) return;

    const currentState = getCommentsState(reviewId);
    const commentText = currentState.newComment.trim();
    
    if (!commentText || !currentUser || currentState.isSubmitting) return;

    updateCommentsState(reviewId, { isSubmitting: true });
    
    try {
      const response = await socialApi.addComment(reviewId, currentUserId, commentText);
      if (response.success && response.data) {
        // Optimistic update
        updateCommentsState(reviewId, {
          comments: [response.data, ...currentState.comments],
          newComment: '',
          isSubmitting: false
        });
        
        // Update comment count in review
        setRealReviews(prev => prev.map(review => 
          review.id === reviewId 
            ? { ...review, comments_count: (review.comments_count || 0) + 1 }
            : review
        ));
      } else {
        updateCommentsState(reviewId, { isSubmitting: false });
        console.error('Failed to add comment:', response.error);
      }
    } catch (error) {
      updateCommentsState(reviewId, { isSubmitting: false });
      console.error('Failed to add comment:', error);
    }
  }, [currentUser, currentUserId, getCommentsState, updateCommentsState]);

  // Handle delete comment
  const handleDeleteComment = useCallback(async (reviewId: number, commentId: number) => {
    if (!currentUser) return;

    const currentState = getCommentsState(reviewId);
    
    // Optimistic update
    updateCommentsState(reviewId, {
      comments: currentState.comments.filter(c => c.id !== commentId)
    });
    
    // Update comment count optimistically
    setRealReviews(prev => prev.map(review => 
      review.id === reviewId 
        ? { ...review, comments_count: Math.max(0, (review.comments_count || 0) - 1) }
        : review
    ));

    try {
      const response = await socialApi.deleteComment(commentId, currentUserId);
      if (!response.success) {
        // Rollback on failure
        updateCommentsState(reviewId, { comments: currentState.comments });
        setRealReviews(prev => prev.map(review => 
          review.id === reviewId 
            ? { ...review, comments_count: (review.comments_count || 0) + 1 }
            : review
        ));
        console.error('Failed to delete comment:', response.error);
      }
    } catch (error) {
      // Rollback on error
      updateCommentsState(reviewId, { comments: currentState.comments });
      setRealReviews(prev => prev.map(review => 
        review.id === reviewId 
          ? { ...review, comments_count: (review.comments_count || 0) + 1 }
          : review
      ));
      console.error('Failed to delete comment:', error);
    }
  }, [currentUser, currentUserId, getCommentsState, updateCommentsState]);


  // Render components
  const renderImageGallery = () => (
    <div 
      className="relative w-full h-64 md:h-72 overflow-hidden border-b-2 flex-shrink-0"
      style={selectedTheme ? {
        borderColor: selectedTheme.borderColor || '#000000',
      } : undefined}
    >
      {place.images && place.images.length > 0 ? (
        <>
          <img 
            src={place.images[currentImageIndex]} 
            alt={place.name}
            className="w-full h-full object-cover"
          />
          
          {/* Close Button */}
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 md:top-4 md:right-4 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border-0 z-10"
          >
            <X className="h-5 w-5" />
          </Button>
          
          {/* Navigation Arrows */}
          {totalImages > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages)}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setCurrentImageIndex((prev) => (prev + 1) % totalImages)}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border-0"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              
              {/* Image Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {place.images.map((_, index) => (
                  <button
                    key={index}
                    className={`h-2 w-2 rounded-full transition-all duration-200 ${
                      index === currentImageIndex 
                        ? 'bg-white scale-110' 
                        : 'bg-white/60 hover:bg-white/80'
                    }`}
                    onClick={() => setCurrentImageIndex(index)}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div 
          className="w-full h-full flex items-center justify-center"
          style={selectedTheme ? {
            background: `linear-gradient(to bottom right, ${selectedTheme.hoverBackground || '#F9FAFB'}, ${selectedTheme.activeBackground || '#F3F4F6'})`,
          } : undefined}
        >
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-30">📷</div>
            <p 
              className="font-medium"
              style={selectedTheme ? {
                color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
              } : undefined}
            >No image available</p>
          </div>
          
          {/* Close Button */}
          <Button
            variant="secondary"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 md:top-4 md:right-4 h-10 w-10 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm border-0 z-10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderPlaceHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <CardTitle 
          className="text-2xl font-bold tracking-tight"
          style={selectedTheme ? {
            color: selectedTheme.textPrimary || selectedTheme.textColor || '#000000',
          } : undefined}
        >
          {place.name}
        </CardTitle>
      </div>
      <div 
        className="flex items-start gap-2 text-sm"
        style={selectedTheme ? {
          color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
        } : undefined}
      >
        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span className="leading-relaxed">{place.address}</span>
      </div>
      {networkAverageRating !== null && networkRatingCount > 0 && (
        <div 
          className="flex items-center gap-2 text-sm"
          style={selectedTheme ? {
            color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
          } : undefined}
        >
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.round(networkAverageRating) }).map((_, i) => (
              <Star 
                key={i} 
                className="h-4 w-4"
                style={selectedTheme ? {
                  fill: selectedTheme.accentColor || '#FCD34D',
                  color: selectedTheme.accentColor || '#FCD34D',
                } : undefined}
              />
            ))}
          </div>
          <span className="text-sm">
            {networkAverageRating.toFixed(1)}
          </span>
        </div>
      )}
      {place.category && place.category !== 'point_of_interest' && (
        <Badge 
          variant="secondary" 
          className="w-fit rounded-md border font-medium"
          style={selectedTheme ? {
            backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
            borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || '#000000',
            color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
            boxShadow: `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : undefined}
        >
          {formatGoogleTypeForDisplay(place.category)}
        </Badge>
      )}
    </div>
  );

  const renderReviewItem = (review: RealReview, index: number) => (
    <motion.div
      key={review.id}
      className="group flex gap-3 p-3 rounded-md border transition-all duration-200 shadow-sm"
      style={selectedTheme ? {
        backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
        borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.2)',
        boxShadow: `1px 1px 0 0 ${selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.1)'}`,
      } : undefined}
      onMouseEnter={(e) => {
        if (selectedTheme) {
          e.currentTarget.style.borderColor = selectedTheme.borderColor || '#000000';
          e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || '#F9FAFB';
          e.currentTarget.style.boxShadow = `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`;
        }
      }}
      onMouseLeave={(e) => {
        if (selectedTheme) {
          e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.2)';
          e.currentTarget.style.backgroundColor = selectedTheme.cardBackground || '#FFFFFF';
          e.currentTarget.style.boxShadow = `1px 1px 0 0 ${selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.1)'}`;
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        delay: index * 0.05,
        duration: 0.2,
        ease: 'easeOut'
      }}
    >
      <Avatar className="h-8 w-8 border border-black/20">
        {review.user_picture ? (
          <img
            src={review.user_picture}
            alt={review.user_name}
            className="h-8 w-8 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            {getInitials(review.user_name)}
          </AvatarFallback>
        )}
      </Avatar>
      
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span 
            className="font-semibold text-sm"
            style={selectedTheme ? {
              color: selectedTheme.textPrimary || selectedTheme.textColor || '#000000',
            } : undefined}
          >{review.user_name}</span>
          <span 
            style={selectedTheme ? {
              color: selectedTheme.textMuted || selectedTheme.textSecondary || '#9CA3AF',
            } : undefined}
          >•</span>
          <span 
            className="text-xs"
            style={selectedTheme ? {
              color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
            } : undefined}
          >
            {formatDate(review.created_at)}
          </span>
          {review.rating && (
            <>
              <span 
                style={selectedTheme ? {
                  color: selectedTheme.textMuted || selectedTheme.textSecondary || '#9CA3AF',
                } : undefined}
              >•</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star 
                    key={i} 
                    className="h-3 w-3"
                    style={selectedTheme ? {
                      fill: selectedTheme.accentColor || '#FCD34D',
                      color: selectedTheme.accentColor || '#FCD34D',
                    } : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        
        {(review.notes || review.content_data) && (
          <div className="space-y-2">
            {/* Always show notes if they exist */}
            {review.notes && (
              <p 
                className="text-sm leading-relaxed"
                style={selectedTheme ? {
                  color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
                } : undefined}
              >{renderWithMentions(review.notes, (userId) => navigate(`/profile/${userId}`))}</p>
            )}
          
          {/* Display additional content data */}
          {review.content_data && (
            <div className="space-y-1">
              {(() => {
                const highlights = review.content_data.highlights || review.content_data.specialities;
                const hasHighlights = highlights && (
                  (typeof highlights === 'string' && highlights.trim().length > 0) ||
                  (Array.isArray(highlights) && highlights.length > 0 && highlights.some(h => h && String(h).trim().length > 0))
                );
                return hasHighlights ? (
                  <div className="flex items-start gap-2">
                    <span 
                      className="text-xs font-medium min-w-0 flex-shrink-0"
                      style={selectedTheme ? {
                        color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                      } : undefined}
                    >Highlights:</span>
                    <span 
                      className="text-xs"
                      style={selectedTheme ? {
                        color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
                      } : undefined}
                    >
                      {Array.isArray(highlights) ? highlights.filter(h => h && String(h).trim()).join(', ') : highlights}
                    </span>
                  </div>
                ) : null;
              })()}
              {/* Removed visit_type display as it is not needed */}
              {review.content_data.companions_count !== undefined && (
                <div className="flex items-start gap-2">
                  <span 
                    className="text-xs font-medium min-w-0 flex-shrink-0"
                    style={selectedTheme ? {
                      color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                    } : undefined}
                  >Companions:</span>
                  <span 
                    className="text-xs"
                    style={selectedTheme ? {
                      color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
                    } : undefined}
                  >
                    {review.content_data.companions_count === 0 ? 'Solo' : 
                     review.content_data.companions_count === 1 ? '1 person' : 
                     `${review.content_data.companions_count} people`}
                  </span>
                </div>
              )}
              {review.content_data.went_with && review.content_data.went_with.length > 0 && (
                <div className="flex items-start gap-2">
                  <span 
                    className="text-xs font-medium min-w-0 flex-shrink-0"
                    style={selectedTheme ? {
                      color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                    } : undefined}
                  >Went with:</span>
                  <span 
                    className="text-xs"
                    style={selectedTheme ? {
                      color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
                    } : undefined}
                  >{renderWithMentions(review.content_data.went_with.join(', '), (userId) => navigate(`/profile/${userId}`))}</span>
                </div>
              )}
            </div>
          )}
          </div>
        )}
        
        {/* Review Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button 
            className="flex items-center gap-1.5 transition-colors duration-200 text-xs font-medium px-2 py-1 rounded-md border border-transparent"
            style={selectedTheme ? {
              color: (reviewLikes[review.id]?.isLiked || false)
                ? (selectedTheme.accentColor || '#EF4444')
                : (selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280'),
              backgroundColor: (reviewLikes[review.id]?.isLiked || false)
                ? (selectedTheme.hoverBackground || '#FEF2F2')
                : 'transparent',
              borderColor: (reviewLikes[review.id]?.isLiked || false)
                ? (selectedTheme.borderColorMuted || selectedTheme.borderColor || '#FECACA')
                : 'transparent',
            } : undefined}
            onMouseEnter={(e) => {
              if (selectedTheme && !(reviewLikes[review.id]?.isLiked || false)) {
                e.currentTarget.style.color = selectedTheme.accentColor || '#EF4444';
                e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || selectedTheme.borderColor || '#FECACA';
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || '#FEF2F2';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme && !(reviewLikes[review.id]?.isLiked || false)) {
                e.currentTarget.style.color = selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            onClick={() => handleLike(review.id)}
          >
            <Heart className={`h-3.5 w-3.5 ${(reviewLikes[review.id]?.isLiked || false) ? 'fill-current' : ''}`} />
            <span>{(reviewLikes[review.id]?.count || 0) > 0 ? reviewLikes[review.id]?.count : 'Like'}</span>
          </button>
          
          <button 
            className="flex items-center gap-1.5 transition-colors duration-200 text-xs font-medium px-2 py-1 rounded-md border border-transparent"
            style={selectedTheme ? {
              color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
            } : undefined}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.color = selectedTheme.accentColor || '#3B82F6';
                e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || selectedTheme.borderColor || '#DBEAFE';
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || '#EFF6FF';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.color = selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            onClick={() => handleToggleComments(review.id)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{getCommentsState(review.id).comments.length || review.comments_count || 0}</span>
          </button>
        </div>
        
        {/* Comments Section */}
        {(() => {
          const commentsState = getCommentsState(review.id);
          if (!commentsState.showComments) return null;
          
          return (
            <div className="mt-3 pt-3 border-t border-black/10">
              {/* Loading state */}
              {commentsState.isLoading && (
                <div className="flex items-center justify-center py-4">
                  <div 
                    className="text-xs"
                    style={selectedTheme ? {
                      color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                    } : undefined}
                  >Loading comments...</div>
                </div>
              )}
              
              {/* Comments display */}
              {!commentsState.isLoading && commentsState.comments.length > 0 && (
                <div className={`space-y-2 mb-3 ${MAX_COMMENTS_HEIGHT} overflow-y-auto`}>
                  {commentsState.comments.map(comment => (
                  <div key={comment.id} className="flex items-start gap-2 text-xs">
                    <Avatar className="h-5 w-5 flex-shrink-0 mt-0.5">
                      {comment.user_picture ? (
                        <img
                          src={comment.user_picture}
                          alt={comment.user_name || 'User'}
                          className="h-5 w-5 rounded-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {getInitials(comment.user_name || 'U')}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span 
                          className="font-semibold"
                          style={selectedTheme ? {
                            color: selectedTheme.textPrimary || selectedTheme.textColor || '#000000',
                          } : undefined}
                        >{comment.user_name || 'Anonymous User'}</span>
                        <span 
                          style={selectedTheme ? {
                            color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
                          } : undefined}
                        >{renderWithMentions(comment.comment, (userId) => navigate(`/profile/${userId}`))}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span 
                          style={selectedTheme ? {
                            color: selectedTheme.textMuted || selectedTheme.textSecondary || '#9CA3AF',
                          } : undefined}
                        >{formatDate(comment.created_at)}</span>
                        {comment.user_id === currentUser?.id && (
                          <button
                            onClick={() => handleDeleteComment(review.id, comment.id)}
                            className="text-xs"
                            style={selectedTheme ? {
                              color: selectedTheme.textMuted || selectedTheme.textSecondary || '#9CA3AF',
                            } : undefined}
                            onMouseEnter={(e) => {
                              if (selectedTheme) {
                                e.currentTarget.style.color = selectedTheme.accentColor || '#EF4444';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedTheme) {
                                e.currentTarget.style.color = selectedTheme.textMuted || selectedTheme.textSecondary || '#9CA3AF';
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* No comments message */}
              {!commentsState.isLoading && commentsState.comments.length === 0 && (
                <div className="text-center py-4">
                  <p 
                    className="text-xs"
                    style={selectedTheme ? {
                      color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
                    } : undefined}
                  >No comments yet. Be the first to comment!</p>
                </div>
              )}
              
              {/* Comment form */}
              {!commentsState.isLoading && currentUser && (
                <form 
                  onSubmit={(e) => handleAddComment(review.id, e)} 
                  className="flex items-center gap-2 pt-2 border-t"
                  style={selectedTheme ? {
                    borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.1)',
                  } : undefined}
                >
                  <Avatar className="h-6 w-6 flex-shrink-0">
                    {currentUser.profilePictureUrl ? (
                      <img
                        src={currentUser.profilePictureUrl}
                        alt={currentUser.displayName}
                        className="h-6 w-6 rounded-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {getInitials(currentUser.displayName || 'U')}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <Input
                    type="text"
                    value={commentsState.newComment}
                    onChange={(e) => updateCommentsState(review.id, { newComment: e.target.value })}
                    placeholder="Add a comment..."
                    className="flex-1 h-7 text-sm md:text-xs rounded-md border"
                    style={selectedTheme ? {
                      backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
                      borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
                      color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
                    } : undefined}
                    disabled={commentsState.isSubmitting}
                  />
                  <style>{`
                    input::placeholder {
                      color: ${selectedTheme?.inputPlaceholder || selectedTheme?.textMuted || '#9CA3AF'} !important;
                    }
                  `}</style>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-md border transition-all disabled:opacity-50"
                    style={selectedTheme ? {
                      backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
                      borderColor: selectedTheme.borderColor || '#000000',
                      color: selectedTheme.textPrimary || selectedTheme.textColor || '#000000',
                      boxShadow: `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                    } : undefined}
                    disabled={!commentsState.newComment.trim() || commentsState.isSubmitting}
                    onMouseEnter={(e) => {
                      if (selectedTheme && !commentsState.isSubmitting && commentsState.newComment.trim()) {
                        e.currentTarget.style.transform = 'translate(0.5px, 0.5px)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTheme && !commentsState.isSubmitting && commentsState.newComment.trim()) {
                        e.currentTarget.style.transform = 'translate(0, 0)';
                        e.currentTarget.style.boxShadow = `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`;
                      }
                    }}
                  >
                    {commentsState.isSubmitting ? '...' : 'Post'}
                  </Button>
                </form>
              )}
            </div>
          );
        })()}
      </div>
    </motion.div>
  );

  const renderReviewsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 
          className="text-lg font-semibold"
          style={selectedTheme ? {
            color: selectedTheme.textPrimary || selectedTheme.textColor || '#000000',
          } : undefined}
        >Reviews ({realReviews.length})</h3>
      </div>
      
      <div className="space-y-3">
        {reviewsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <ReviewItemSkeleton key={i} />
            ))}
          </div>
        ) : reviewsError ? (
          <div 
            className="p-6 text-center rounded-md border-2"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.hoverBackground || '#FEF3C7',
              borderColor: selectedTheme.accentColor || '#F59E0B',
              boxShadow: `2px 2px 0 0 ${selectedTheme.accentColor || '#F59E0B'}`,
            } : undefined}
          >
            <div className="text-4xl mb-3 opacity-30">📍</div>
            <p 
              className="font-medium mb-2"
              style={selectedTheme ? {
                color: selectedTheme.accentColor || '#92400E',
              } : undefined}
            >
              Manual Location
            </p>
            <p 
              className="text-sm"
              style={selectedTheme ? {
                color: selectedTheme.textSecondary || selectedTheme.textMuted || '#D97706',
              } : undefined}
            >
              {reviewsError}
            </p>
          </div>
        ) : realReviews.length === 0 ? (
          <div 
            className="p-8 text-center rounded-md border shadow-sm"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.hoverBackground || '#F9FAFB',
              borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.2)',
            } : undefined}
          >
            <div className="text-4xl mb-3 opacity-30">💬</div>
            <p 
              className="font-medium mb-2"
              style={selectedTheme ? {
                color: selectedTheme.textSecondary || selectedTheme.textMuted || '#6B7280',
              } : undefined}
            >No reviews yet</p>
            <p 
              className="text-sm"
              style={selectedTheme ? {
                color: selectedTheme.textMuted || selectedTheme.textSecondary || '#9CA3AF',
              } : undefined}
            >Be the first to review this place!</p>
          </div>
        ) : (
          <AnimatePresence>
            {realReviews.map((review, index) => renderReviewItem(review, index))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );


  const renderSocialActions = () => (
    // Commented out - not using save/share buttons yet
    // <div className="flex gap-3 pt-6">
    //   
    //   <Button 
    //     variant={place.isSaved ? "default" : "outline"}
    //     size="sm"
    //     onClick={onSave}
    //     className={`flex-1 font-medium rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all ${
    //       place.isSaved 
    //         ? "bg-blue-500 hover:bg-blue-600 text-white" 
    //         : "bg-white text-gray-900 hover:bg-gray-50"
    //     }`}
    //   >
    //     <Bookmark className={`h-4 w-4 ${place.isSaved ? 'fill-current' : ''}`} />
    //     {place.isSaved ? 'Saved' : 'Save'}
    //   </Button>
    //   
    //   <Button 
    //     variant="outline"
    //     size="sm"
    //     onClick={onShare}
    //     className="flex-1 font-medium rounded-md border-2 border-black bg-white text-gray-900 shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all hover:bg-gray-50"
    //   >
    //     <Share2 className="h-4 w-4" />
    //     Share
    //   </Button>
    // </div>
    null
  );

  return (
    <>
      {/* Backdrop overlay for mobile */}
      <motion.div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Content Card */}
      <motion.div
        className="
          content-card-root fixed z-50 overflow-hidden flex flex-col
          inset-x-0 bottom-0 rounded-t-2xl border-t-2 h-[90dvh]
          md:inset-x-auto md:inset-y-0 md:left-0 md:bottom-auto md:w-96 md:rounded-r-lg md:rounded-t-none md:border-t-0 md:border-r-2 md:pt-16 md:h-screen
        "
        initial={isMobile ? { y: '100%' } : { x: '-100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '-100%' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        drag={isMobile ? 'y' : false}
        dragConstraints={isMobile ? { top: 0 } : {}}
        dragElastic={isMobile ? 0.2 : 0}
        onDragEnd={handleDragEnd}
        style={isMobile ? { y, opacity } : {
          ...(selectedTheme ? {
            backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
            borderColor: selectedTheme.borderColor || '#000000',
            boxShadow: isMobile 
              ? `0 -8px 0 0 ${selectedTheme.borderColor || '#000000'}`
              : `8px 0 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : {
            backgroundColor: '#FFFFFF',
            borderColor: '#000000',
            boxShadow: isMobile ? '0 -8px 0 0 #000' : '8px 0 0 0 #000',
          }),
        }}
      >
        {/* Drag handle for mobile */}
        <div 
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none md:hidden flex-shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div 
            className="w-12 h-1.5 rounded-full"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.textMuted || selectedTheme.textSecondary || '#D1D5DB',
            } : undefined}
          />
        </div>

        {/* Scrollable content: images + details + reviews */}
        <div className="flex-1 overflow-y-auto">
          {renderImageGallery()}
          
          <div className="p-4 md:p-6 space-y-8">
            {renderPlaceHeader()}
            
            <Separator 
              style={selectedTheme ? {
                backgroundColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0,0,0,0.2)',
              } : undefined}
            />
            
            {renderReviewsSection()}
            
            {renderSocialActions()}
          </div>
        </div>

        {/* Login Modal */}
        {showLoginModal && (
          <LoginModal 
            onClose={() => setShowLoginModal(false)} 
            next={window.location.pathname + window.location.search}
          />
        )}
      </motion.div>
    </>
  );
};

export default ContentCard; 