import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Star, ChevronDown, ChevronUp, Clock, MapPin, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { FeedPost as FeedPostType } from '@/services/socialService';
import { toast } from 'sonner';

type Props = {
  posts: FeedPostType[];
  recIdToGroupKey: Record<number, string>;
  groupKeyToMeta: Record<string, { title: string; subtitle?: string }>;
};

const FeedGroups: React.FC<Props> = ({ posts, recIdToGroupKey, groupKeyToMeta }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { orderKeys, keyToPosts } = useMemo(() => {
    const map: Record<string, FeedPostType[]> = {};
    const keys: string[] = [];
    for (const p of posts) {
      const key = recIdToGroupKey[p.recommendation_id] || `place:${p.place_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(p);
      if (!keys.includes(key)) keys.push(key);
    }
    return { orderKeys: keys, keyToPosts: map };
  }, [posts, recIdToGroupKey]);

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {orderKeys.map((key, groupIndex) => {
          const group = keyToPosts[key] || [];
          const meta = groupKeyToMeta[key];
          const isService = key.startsWith('service:');
          const isExpanded = expanded.has(key);
          const sorted = [...group].sort((a, b) => (b.rating || 0) - (a.rating || 0));
          const best = sorted[0];
          const rest = sorted.slice(1);
          const ratings = group.map(p => p.rating).filter((r): r is number => Boolean(r));
          const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;

          const toggle = () => {
            setExpanded(prev => {
              const next = new Set(prev);
              next.has(key) ? next.delete(key) : next.add(key);
              return next;
            });
          };

          // Helper function to get initials
          const getInitials = (name: string): string => 
            name.split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

          // Get the best post for display
          const displayPost = best;
          const serviceName = meta?.title || displayPost?.place_name || 'Service Provider';
          const location = meta?.subtitle || displayPost?.place_address;
          
          // Extract labels from the post description or use default labels
          const getLabels = () => {
            if (displayPost?.labels && displayPost.labels.length > 0) {
              return displayPost.labels.slice(0, 3);
            }
            // Fallback to service type labels
            if (isService) {
              return ['service provider', 'professional'];
            }
            return ['local business', 'recommended'];
          };

          // Format date helper
          const formatDate = (dateString: string): string => {
            const date = new Date(dateString);
            const now = new Date();
            const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
            
            if (diffInHours < 1) return 'Just now';
            if (diffInHours < 24) return `${diffInHours}h ago`;
            if (diffInHours < 48) return 'Yesterday';
            return date.toLocaleDateString();
          };

          return (
            <motion.div
              key={`group_${key}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: groupIndex * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative"
            >
              {/* Main Service Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.4, delay: groupIndex * 0.1 + 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden"
              >
                {/* Header Section */}
                <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">{serviceName}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star 
                              key={i} 
                              className={`h-4 w-4 ${i < Math.floor(avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                            />
                          ))}
                          <span className="ml-1 font-medium text-gray-800">{avg.toFixed(1)}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <span>{group.length} review{group.length !== 1 ? 's' : ''}</span>
                        {location && (
                          <>
                            <span className="text-gray-400">•</span>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-xs">{location}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs px-2 py-1 font-medium border-blue-200">
                      {Math.round(avg * 100)}% match
                    </Badge>
                  </div>

                  {/* Labels */}
                  <div className="flex gap-2">
                    {getLabels().map((label, index) => (
                      <Badge key={index} variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200 font-medium">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Featured Review */}
                {displayPost && (
                  <div className="p-6">
                    <div className="bg-gray-50/50 rounded-lg p-4 border border-gray-100">
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={displayPost.user_picture} />
                          <AvatarFallback className="bg-blue-500 text-white text-xs font-medium">
                            {displayPost.user_name ? getInitials(displayPost.user_name) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 text-sm">{displayPost.user_name || 'User'}</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star 
                        key={i} 
                                  className={`h-3 w-3 ${i < Math.floor(displayPost.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                      />
                    ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>{displayPost.created_at ? formatDate(displayPost.created_at) : 'Recently'}</span>
                          </div>
                  </div>
                </div>

                      {displayPost.description && (
                        <p className="text-gray-700 leading-relaxed mb-3 text-sm">
                          {displayPost.description}
                        </p>
                      )}

                      {/* Interaction buttons */}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1 h-7 px-2 text-gray-500 hover:text-gray-700"
                        >
                          <Heart className="h-3 w-3" />
                          <span className="text-xs">{displayPost.likes_count || 0}</span>
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1 h-7 px-2 text-gray-500 hover:text-gray-700"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span className="text-xs">{displayPost.comments_count || 0}</span>
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const url = `${window.location.origin}/post/${displayPost.recommendation_id}`;
                              const shareData: ShareData = {
                                title: displayPost.place_name || displayPost.title || 'Post',
                                text: displayPost.description || 'Check out this post on RECCE',
                                url
                              };
                              if (navigator.share) {
                                await navigator.share(shareData);
                              } else if (navigator.clipboard && navigator.clipboard.writeText) {
                                await navigator.clipboard.writeText(url);
                                toast.success('Link copied to clipboard');
                              } else {
                                const success = document.execCommand && document.execCommand('copy');
                                if (!success) window.prompt('Copy this link', url);
                              }
                            } catch (e) {
                              console.error('Failed to share link', e);
                              try {
                                const url = `${window.location.origin}/post/${displayPost.recommendation_id}`;
                                await navigator.clipboard.writeText(url);
                                toast.success('Link copied to clipboard');
                              } catch {}
                            }
                          }}
                          className="flex items-center gap-1 h-7 px-2 text-gray-500 hover:text-gray-700"
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                </div>
                )}

                {/* Additional reviews section - only show when not expanded */}
                {rest.length > 0 && !isExpanded && (
                  <div className="px-6 pb-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={toggle}
                      className="w-full text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors font-medium"
                    >
                          <ChevronDown className="h-4 w-4 mr-2" />
                      See {rest.length} more review{rest.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                )}

                {/* Additional reviews (collapsible) */}
              {rest.length > 0 && (
                <motion.div 
                  initial={false} 
                  animate={{ height: isExpanded ? 'auto' : 0 }} 
                  transition={{ duration: 0.3, ease: 'easeInOut' }} 
                  className="overflow-hidden"
                >
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        transition={{ duration: 0.2 }} 
                          className="px-6 space-y-3 border-t border-gray-100"
                      >
                        {rest.map((post, postIndex) => (
                          <motion.div 
                            key={post.recommendation_id} 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            transition={{ duration: 0.2, delay: postIndex * 0.05 }}
                              className="bg-gray-50/30 rounded-lg p-4 border border-gray-100"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <Avatar className="h-7 w-7 flex-shrink-0">
                                  <AvatarImage src={post.user_picture} />
                                  <AvatarFallback className="bg-blue-500 text-white text-xs">
                                    {post.user_name ? getInitials(post.user_name) : 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900 text-sm">{post.user_name || 'User'}</span>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }, (_, i) => (
                                        <Star 
                                          key={i} 
                                          className={`h-3 w-3 ${i < Math.floor(post.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    <span>{post.created_at ? formatDate(post.created_at) : 'Recently'}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {post.description && (
                                <p className="text-gray-700 leading-relaxed mb-3 text-sm">
                                  {post.description}
                                </p>
                              )}

                              {/* Interaction buttons for additional reviews */}
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center gap-1 h-6 px-2 text-gray-500 hover:text-gray-700"
                                >
                                  <Heart className="h-3 w-3" />
                                  <span className="text-xs">{post.likes_count || 0}</span>
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center gap-1 h-6 px-2 text-gray-500 hover:text-gray-700"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                  <span className="text-xs">{post.comments_count || 0}</span>
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const url = `${window.location.origin}/post/${post.recommendation_id}`;
                                      const shareData: ShareData = {
                                        title: post.place_name || post.title || 'Post',
                                        text: post.description || 'Check out this post on RECCE',
                                        url
                                      };
                                      if (navigator.share) {
                                        await navigator.share(shareData);
                                      } else if (navigator.clipboard && navigator.clipboard.writeText) {
                                        await navigator.clipboard.writeText(url);
                                        toast.success('Link copied to clipboard');
                                      } else {
                                        const success = document.execCommand && document.execCommand('copy');
                                        if (!success) window.prompt('Copy this link', url);
                                      }
                                    } catch (e) {
                                      console.error('Failed to share link', e);
                                      try {
                                        const url = `${window.location.origin}/post/${post.recommendation_id}`;
                                        await navigator.clipboard.writeText(url);
                                        toast.success('Link copied to clipboard');
                                      } catch {}
                                    }
                                  }}
                                  className="flex items-center gap-1 h-6 px-2 text-gray-500 hover:text-gray-700"
                                >
                                  <Share2 className="h-3 w-3" />
                                </Button>
                              </div>
                          </motion.div>
                        ))}
                          
                          {/* Hide reviews button - positioned after all reviews */}
                          <div className="pt-4 pb-6">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={toggle}
                              className="w-full text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors font-medium"
                            >
                              <ChevronUp className="h-4 w-4 mr-2" />
                              Hide {rest.length} more review{rest.length !== 1 ? 's' : ''}
                            </Button>
                          </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default FeedGroups;




