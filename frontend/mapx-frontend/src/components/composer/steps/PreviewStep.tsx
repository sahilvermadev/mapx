import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Star } from 'lucide-react';

interface PreviewStepProps {
  currentUser: { displayName?: string; email?: string; profilePictureUrl?: string } | null | undefined;
  placeName?: string;
  placeAddress?: string;
  description: string;
  isEditingDescription: boolean;
  editedPreview: string;
  onEditedPreviewChange: (v: string) => void;
  showMentionMenu: boolean;
  mentionMenu: React.ReactNode;
  rating: number | null;
  onRatingChange: (n: number) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onApprove: () => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  currentUser,
  placeName,
  placeAddress,
  description,
  isEditingDescription,
  editedPreview,
  onEditedPreviewChange,
  showMentionMenu,
  mentionMenu,
  rating,
  onRatingChange,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onApprove
}) => {
  const renderStars = (rating: number) => (
    [...Array(5)].map((_, index) => (
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

  const getProxiedImageUrl = (url?: string): string => {
    if (!url) return '';
    return url.includes('googleusercontent.com')
      ? `http://localhost:5000/auth/profile-picture?url=${encodeURIComponent(url)}`
      : url;
  };

  const getRatingMessage = (rating: number): string => {
    const RATING_MESSAGES = { 5: 'Truly exceptional!', 4: 'Really good!', 3: 'Worth trying!', 2: 'Just okay!', 1: 'Not it!' } as const;
    const roundedRating = Math.floor(rating) as keyof typeof RATING_MESSAGES;
    return RATING_MESSAGES[roundedRating] || '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 py-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-light text-black leading-tight mb-6 text-center">
          Preview your recommendation
        </h1>

        <article className="w-full border-b border-border/50 pb-6 mb-6">
          <div className="relative">
            {rating && (
              <div className="absolute top-4 right-4 z-10">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 px-2 py-1">
                    {renderStars(rating || 0)}
                  </div>
                  {rating && (
                    <div className="text-xs text-muted-foreground text-right">
                      {getRatingMessage(rating)}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 pr-24">
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={getProxiedImageUrl(currentUser?.profilePictureUrl)} alt={currentUser?.displayName || 'You'} />
                <AvatarFallback>{(currentUser?.displayName || 'You').split(' ').map(s => s[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <span className="font-semibold text-sm">{currentUser?.displayName || 'You'}</span>
                  {placeName ? (
                    <>
                      <span className="text-sm text-muted-foreground"> rated </span>
                      <span className="font-semibold text-sm">{placeName}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground"> shared </span>
                      <span className="font-semibold text-sm">a recommendation</span>
                    </>
                  )}
                </div>

                {placeAddress && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3 pr-24">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{placeAddress}</span>
                  </div>
                )}

                {description && (
                  <div className="mb-3">
                    <h4 className="font-semibold text-sm mb-1">Notes:</h4>
                    {isEditingDescription ? (
                      <Textarea
                        value={editedPreview}
                        onChange={(e) => onEditedPreviewChange(e.target.value)}
                        className="min-h-[100px] text-sm resize-none border border-gray-200 rounded-lg focus:border-gray-400 focus:ring-0 bg-white px-3 py-2 text-gray-800"
                        placeholder="Edit your recommendation..."
                      />
                    ) : (
                      <p className="text-sm leading-relaxed">{description}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>

        {!isEditingDescription && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-800">How would you rate this?</h3>
              <div className="flex justify-center">
                <div className="flex items-center justify-center gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => onRatingChange(n)} className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${rating && n <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
                  ))}
                  {rating && <span className="ml-3 text-sm font-medium text-gray-600">{rating}/5</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {isEditingDescription ? (
            <>
              <Button onClick={onCancelEdit} variant="outline" className="px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-200 shadow-sm transition-colors duration-200">Cancel</Button>
              <Button onClick={onSaveEdit} className="px-4 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-md border-0 shadow-sm transition-colors duration-200">Save Changes</Button>
            </>
          ) : (
            <>
              <Button onClick={onEdit} className="px-4 py-2 text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-200 shadow-sm transition-colors duration-200">Edit Text</Button>
              <Button onClick={onApprove} className="px-6 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-md border-0 shadow-sm transition-colors duration-200">Post Recommendation</Button>
            </>
          )}
        </div>
        {isEditingDescription && showMentionMenu && mentionMenu}
      </div>
    </motion.div>
  );
};

export default PreviewStep;






