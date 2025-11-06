import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Star } from 'lucide-react';
import ContactReveal from '@/components/ContactReveal';
import { FaPlus } from 'react-icons/fa';
import { ArrowLeft } from 'lucide-react';
import { getProfilePictureUrl } from '@/config/apiConfig';

interface PreviewStepProps {
  currentUser: { displayName?: string; email?: string; profilePictureUrl?: string } | null | undefined;
  placeName?: string;
  placeAddress?: string;
  description: string;
  contentType?: 'place' | 'service' | 'tip' | 'contact' | 'unclear' | string;
  contact?: { phone?: string; email?: string } | null;
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
  onBack: () => void;
  labels?: string[];
  onLabelsChange?: (labels: string[]) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  currentUser,
  placeName,
  placeAddress,
  description,
  contentType,
  contact,
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
  onApprove,
  onBack,
  labels = [],
  onLabelsChange
}) => {
  const [customLabel, setCustomLabel] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Label editing functions
  const removeLabel = (labelToRemove: string) => {
    if (!onLabelsChange) return;
    const newLabels = labels.filter(l => l !== labelToRemove);
    onLabelsChange(newLabels);
  };

  const addCustomLabel = () => {
    const value = customLabel.trim();
    if (!value || !onLabelsChange) return;
    
    const normalized = value.replace(/\s+/g, ' ').slice(0, 40);
    const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    const exists = labels.some(l => l.toLowerCase() === capitalized.toLowerCase());
    if (exists) {
      setCustomLabel('');
      return;
    }
    
    onLabelsChange([...labels, capitalized]);
    setCustomLabel('');
  };
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
    return getProfilePictureUrl(url) || url;
  };

  const getRatingMessage = (rating: number): string => {
    const RATING_MESSAGES = { 5: 'Truly exceptional!', 4: 'Really good!', 3: 'Worth trying!', 2: 'Just okay!', 1: 'Not it!' } as const;
    const roundedRating = Math.floor(rating) as keyof typeof RATING_MESSAGES;
    return RATING_MESSAGES[roundedRating] || '';
  };

  // Contact icon now rendered inline next to location; reserved for future reuse

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 md:space-y-6 py-4 md:py-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 md:h-10 md:w-10 p-0 rounded-full text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>

        <article className="w-full border-b border-border/50 pb-4 md:pb-6 mb-4 md:mb-6 relative">
          <div className="relative">
            {rating && (
              <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10">
                <div className="flex flex-col items-end gap-0.5 md:gap-1">
                  <div className="flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1">
                    {renderStars(rating || 0)}
                  </div>
                  {rating && (
                    <div className="text-[10px] md:text-xs text-muted-foreground text-right">
                      {getRatingMessage(rating)}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 md:gap-3 pr-20 md:pr-24">
              <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                <AvatarImage src={getProxiedImageUrl(currentUser?.profilePictureUrl)} alt={currentUser?.displayName || 'You'} />
                <AvatarFallback className="text-xs md:text-sm">{(currentUser?.displayName || 'You').split(' ').map(s => s[0]).join('').slice(0, 2)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="mb-1 md:mb-2">
                  <span className="font-semibold text-xs md:text-sm">{currentUser?.displayName || 'You'}</span>
                  {placeName ? (
                    <>
                      <span className="text-xs md:text-sm text-muted-foreground"> rated </span>
                      <span className="font-semibold text-xs md:text-sm">{placeName}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs md:text-sm text-muted-foreground"> shared </span>
                      <span className="font-semibold text-xs md:text-sm">a recommendation</span>
                    </>
                  )}
                </div>

                {placeAddress && (
                  <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3 pr-16 md:pr-20">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{placeAddress}</span>
                    {contentType === 'service' && (contact?.phone || contact?.email) && (
                      <ContactReveal
                        contact={contact}
                        className="relative ml-1 md:ml-2 flex-shrink-0"
                        buttonClassName="h-5 w-5 hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-300/40"
                        iconClassName="h-3 w-3"
                        align="right"
                      />
                    )}
                  </div>
                )}

                {description && (
                  <div className="mb-2 md:mb-3">
                    {/* <h4 className="font-semibold text-sm mb-1">Notes:</h4> */}
                    {isEditingDescription ? (
                      <Textarea
                        value={editedPreview}
                        onChange={(e) => onEditedPreviewChange(e.target.value)}
                        className="min-h-[80px] md:min-h-[100px] text-xs md:text-sm resize-none border border-gray-200 rounded-lg focus:border-gray-400 focus:ring-0 bg-white px-2 md:px-3 py-1.5 md:py-2 text-gray-800"
                        placeholder="Edit your recommendation..."
                      />
                    ) : (
                      <p className="text-xs md:text-sm leading-relaxed">{description}</p>
                    )}
                  </div>
                )}

                {/* Labels Section */}
                <div className="mb-2 md:mb-3">
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {/* AI-generated and user labels */}
                    {labels.map((label, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200"
                      >
                        {label}
                        {onLabelsChange && (
                          <button
                            type="button"
                            onClick={() => removeLabel(label)}
                            className="ml-1 md:ml-1.5 text-yellow-600 hover:text-yellow-800 focus:outline-none transition-colors text-[10px] md:text-xs"
                            aria-label={`Remove ${label} label`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    
                    {/* Add custom label input */}
                    {showCustomInput ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          className="px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium border-[1.5px] border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] md:focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] transition-all duration-200"
                          value={customLabel}
                          onChange={e => setCustomLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomLabel();
                              setShowCustomInput(false);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setShowCustomInput(false);
                              setCustomLabel('');
                            }
                          }}
                          onBlur={() => {
                            if (!customLabel.trim()) {
                              setShowCustomInput(false);
                            }
                          }}
                          placeholder="Add label…"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => { addCustomLabel(); setShowCustomInput(false); }}
                          disabled={!customLabel.trim()}
                          className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium transition-all duration-200 border-[1.5px] bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Add label"
                        >
                          <FaPlus />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCustomInput(true)}
                        className="inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-medium transition-all duration-200 border-[1.5px] bg-white text-gray-600 border-gray-200 hover:bg-slate-50 hover:border-slate-300 hover:text-gray-900 hover:-translate-y-0.5"
                        aria-label="Add label"
                      >
                        <FaPlus />
                        <span className="ml-1">Add</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </article>

        {!isEditingDescription && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 shadow-sm">
            <div className="space-y-2 md:space-y-3">
              <h3 className="text-xs md:text-sm font-medium text-gray-800">How would you rate this?</h3>
              <div className="flex justify-center">
                <div className="flex items-center justify-center gap-1.5 md:gap-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => onRatingChange(n)} className={`h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 text-base md:text-lg ${rating && n <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
                  ))}
                  {rating && <span className="ml-2 md:ml-3 text-xs md:text-sm font-medium text-gray-600">{rating}/5</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 md:gap-3 justify-center">
          {isEditingDescription ? (
            <>
              <Button onClick={onCancelEdit} variant="outline" className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-200 shadow-sm transition-colors duration-200 w-full sm:w-auto">Cancel</Button>
              <Button onClick={onSaveEdit} className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-md border-0 shadow-sm transition-colors duration-200 w-full sm:w-auto">Save Changes</Button>
            </>
          ) : (
            <>
              <Button onClick={onEdit} className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-200 shadow-sm transition-colors duration-200 w-full sm:w-auto">Edit Text</Button>
              <Button onClick={onApprove} className="px-4 md:px-6 py-2 text-xs md:text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-md border-0 shadow-sm transition-colors duration-200 w-full sm:w-auto">Post Recommendation</Button>
            </>
          )}
        </div>
        {isEditingDescription && showMentionMenu && mentionMenu}
      </div>
    </motion.div>
  );
};

export default PreviewStep;






