import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { SERVICE_CURATED_LABELS } from '@/components/composer/constants';
import { serviceCategoriesApi, type ServiceCategory } from '@/services/serviceCategoriesApi';
import { getTagInlineStyles } from '@/utils/themeUtils';
import { getReadableTextColor } from '@/utils/color';
import { FaPlus } from 'react-icons/fa';
import LabelPicker from '@/components/LabelPicker';

export interface ServiceDetailsFormData {
  category_id?: number | null;
  price_range?: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹' | null;
  exact_price?: string | null;
  verbatim_quote?: string;
  experience_summary?: string;
  context_tags?: string[];
}

interface ServiceDetailsFormProps {
  initialData?: Partial<ServiceDetailsFormData>;
  onSubmit: (data: ServiceDetailsFormData) => void;
  onCancel?: () => void;
  className?: string;
  categorySlug?: string; // Optional: if provided, avoids fetching category
}

const PRICE_RANGES: Array<{ value: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹'; label: string }> = [
  { value: '₹', label: '₹ Budget' },
  { value: '₹₹', label: '₹₹ Moderate' },
  { value: '₹₹₹', label: '₹₹₹ Higher-end' },
  { value: '₹₹₹₹', label: '₹₹₹₹ Luxury' },
];

const ServiceDetailsForm: React.FC<ServiceDetailsFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  className = '',
  categorySlug,
}) => {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  const [formData, setFormData] = useState<ServiceDetailsFormData>({
    category_id: initialData.category_id || null,
    price_range: initialData.price_range || null,
    exact_price: initialData.exact_price || null,
    verbatim_quote: initialData.verbatim_quote || '',
    experience_summary: initialData.experience_summary || '',
    context_tags: initialData.context_tags || [],
  });

  const [tagInput, setTagInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [showLabelPicker, setShowLabelPicker] = useState<boolean>(false);
  const [showCustomPrice, setShowCustomPrice] = useState<boolean>(false);

  // Show custom price input if exact_price exists or if user wants to enter custom price
  useEffect(() => {
    if (formData.exact_price) {
      setShowCustomPrice(true);
    }
  }, []);

  // Get theme utilities
  const tagInlineStyles = useMemo(() => getTagInlineStyles(themeName), [themeName]);

  // Fetch category when category_id changes
  useEffect(() => {
    const fetchCategory = async () => {
      if (categorySlug) {
        // If slug is provided, we can use it directly
        // But we still need to fetch to get the full category object
        const categories = await serviceCategoriesApi.getAllCategories();
        const category = categories.find(cat => cat.slug === categorySlug);
        if (category) {
          setSelectedCategory(category);
          // Initialize expanded categories for this category's labels
        }
      } else if (formData.category_id) {
        try {
          const categories = await serviceCategoriesApi.getAllCategories();
          const category = categories.find(cat => cat.id === formData.category_id);
          if (category) {
            setSelectedCategory(category);
          }
        } catch (error) {
          console.error('Failed to fetch category:', error);
        }
      } else {
        setSelectedCategory(null);
      }
    };

    fetchCategory();
  }, [formData.category_id, categorySlug]);

  // Get curated labels for the selected category
  const curatedLabels = useMemo(() => {
    if (!selectedCategory) return null;
    return SERVICE_CURATED_LABELS[selectedCategory.slug as keyof typeof SERVICE_CURATED_LABELS] || null;
  }, [selectedCategory]);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.context_tags?.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        context_tags: [...(prev.context_tags || []), tag],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      context_tags: prev.context_tags?.filter(t => t !== tag) || [],
    }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 sm:space-y-4 md:space-y-5 ${className}`}>
      {/* Price Information */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-xs sm:text-sm font-medium" style={{ color: selectedTheme?.textPrimary || '#000000' }}>
          Price Information
        </Label>
        
        {/* Price Range Buttons */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {PRICE_RANGES.map(range => (
            <Button
              key={range.value}
              type="button"
              variant={formData.price_range === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFormData(prev => ({ 
                  ...prev, 
                  price_range: prev.price_range === range.value ? null : range.value,
                  // Clear exact price when selecting a range
                  exact_price: prev.price_range === range.value ? prev.exact_price : null
                }));
                // Hide custom input when selecting a predefined range
                if (formData.price_range !== range.value) {
                  setShowCustomPrice(false);
                }
              }}
              style={selectedTheme ? {
                backgroundColor: formData.price_range === range.value 
                  ? selectedTheme.accentColor 
                  : 'transparent',
                color: formData.price_range === range.value 
                  ? textOnAccent
                  : selectedTheme.textPrimary,
                borderColor: selectedTheme.borderColor,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
            >
              {range.label}
            </Button>
          ))}
          
          {/* Custom Price Button */}
          <Button
            type="button"
            variant={showCustomPrice || formData.exact_price ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              const newShowCustom = !showCustomPrice;
              setShowCustomPrice(newShowCustom);
              if (!newShowCustom) {
                // Clear exact price when hiding custom input
                setFormData(prev => ({ ...prev, exact_price: null, price_range: null }));
              } else {
                // Clear price range when showing custom input
                setFormData(prev => ({ ...prev, price_range: null }));
              }
            }}
            style={selectedTheme ? {
              backgroundColor: (showCustomPrice || formData.exact_price)
                ? selectedTheme.accentColor 
                : 'transparent',
              color: (showCustomPrice || formData.exact_price)
                ? textOnAccent
                : selectedTheme.textPrimary,
              borderColor: selectedTheme.borderColor,
              boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : undefined}
          >
            {showCustomPrice || formData.exact_price ? '✓ Custom' : 'Custom'}
          </Button>
        </div>

        {/* Custom Price Input - Shows when Custom button is clicked or exact_price exists */}
        {(showCustomPrice || formData.exact_price) && (
          <div className="mt-1.5 sm:mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Input
              type="text"
              value={formData.exact_price || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, exact_price: e.target.value || null }))}
              placeholder="e.g., ₹500, ₹1,500, ₹50,000, or 'Free consultation'"
              className="h-9 sm:h-10 text-sm"
              autoFocus={showCustomPrice && !formData.exact_price}
              style={selectedTheme ? {
                backgroundColor: selectedTheme.inputBackground,
                borderColor: selectedTheme.inputBorder,
                color: selectedTheme.inputText,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
            />
            <p className="text-xs mt-1.5" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
              Enter specific price information, or leave blank to remove
            </p>
          </div>
        )}
      </div>

      {/* Experience Summary */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-xs sm:text-sm font-medium" style={{ color: selectedTheme?.textPrimary || '#000000' }}>
          Experience Summary <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={formData.experience_summary || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, experience_summary: e.target.value }))}
          placeholder="Describe your experience with this service..."
          className="min-h-[90px] sm:min-h-[100px] text-sm resize-none"
          style={selectedTheme ? {
            backgroundColor: selectedTheme.inputBackground,
            borderColor: selectedTheme.inputBorder,
            color: selectedTheme.inputText,
            boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : undefined}
          required
        />
      </div>

      {/* Context Tags */}
      <div className="space-y-1.5 sm:space-y-2">
        <Label className="text-xs sm:text-sm font-medium" style={{ color: selectedTheme?.textPrimary || '#000000' }}>
          Context Labels
        </Label>
        {/* Display existing tags */}
        {formData.context_tags && formData.context_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            {formData.context_tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md cursor-default"
                style={tagInlineStyles}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 focus:outline-none transition-colors text-sm font-bold hover:opacity-70"
                  style={selectedTheme ? {
                    color: selectedTheme.accentColor || '#000000',
                  } : undefined}
                  aria-label={`Remove ${tag} tag`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Add label button */}
        {curatedLabels && (
          <button
            type="button"
            onClick={() => setShowLabelPicker(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 border-2 hover:scale-105"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              color: selectedTheme.textPrimary || '#111827',
              borderColor: selectedTheme.borderColor || '#D1D5DB',
              boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : undefined}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || '#F9FAFB';
                e.currentTarget.style.borderColor = selectedTheme.accentColor || selectedTheme.borderColor || '#D1D5DB';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.cardBackground || '#FFFFFF';
                e.currentTarget.style.borderColor = selectedTheme.borderColor || '#D1D5DB';
              }
            }}
            aria-label="Add label"
          >
            <FaPlus className="h-3 w-3" />
            <span>Add label</span>
          </button>
        )}
        {/* Fallback: Manual tag input if no curated labels available */}
        {!curatedLabels && (
          <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add a tag (e.g., emergency, night_visit)"
              className="h-9 sm:h-10 text-sm flex-1"
              style={selectedTheme ? {
                backgroundColor: selectedTheme.inputBackground,
                borderColor: selectedTheme.inputBorder,
                color: selectedTheme.inputText,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : undefined}
          />
          <Button
            type="button"
            onClick={handleAddTag}
            size="sm"
              className="h-9"
              style={selectedTheme ? {
                backgroundColor: selectedTheme.accentColor,
                color: textOnAccent,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : undefined}
          >
            Add
          </Button>
          </div>
        )}
      </div>

      {/* Label Picker Modal */}
      {curatedLabels && (
        <LabelPicker
          labels={curatedLabels}
          selectedLabels={formData.context_tags || []}
          onLabelsChange={(newLabels) => setFormData(prev => ({ ...prev, context_tags: newLabels }))}
          variant="modal"
          isOpen={showLabelPicker}
          onClose={() => setShowLabelPicker(false)}
          initiallyExpanded={true}
        />
      )}

      {/* Additional Info section removed: years known, times used, and would hire again */}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 sm:pt-3 border-t mt-2 sm:mt-3" style={{ borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || '#E5E7EB' }}>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            aria-label="Back"
            className="h-9 w-9 sm:h-10 sm:w-10 p-0 rounded-full flex-shrink-0 hover:bg-opacity-10"
            style={selectedTheme ? {
              color: selectedTheme.textPrimary || '#000000',
            } : undefined}
            onMouseEnter={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = selectedTheme.textPrimary || '#000000';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTheme) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = selectedTheme.textPrimary || '#000000';
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        ) : (
          <div />
        )}
        <Button
          type="submit"
          className="px-4 sm:px-5 py-2 sm:py-2.5 md:py-3 rounded-full hover:opacity-90 transition-all text-sm sm:text-base flex-shrink-0"
          disabled={!formData.experience_summary?.trim()}
          style={selectedTheme ? {
            backgroundColor: formData.experience_summary?.trim() ? selectedTheme.accentColor : (selectedTheme.borderColorMuted || '#D1D5DB'),
            color: formData.experience_summary?.trim() ? textOnAccent : (selectedTheme.textMuted || '#9CA3AF'),
            boxShadow: formData.experience_summary?.trim() ? `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}` : 'none',
            opacity: formData.experience_summary?.trim() ? 1 : 0.5,
            cursor: formData.experience_summary?.trim() ? 'pointer' : 'not-allowed',
          } : undefined}
          onMouseEnter={(e) => {
            if (selectedTheme && formData.experience_summary?.trim()) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.hover || selectedTheme.accentColor || '#000000';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTheme && formData.experience_summary?.trim()) {
              e.currentTarget.style.backgroundColor = selectedTheme.accentColor || '#000000';
            }
          }}
        >
          Continue
        </Button>
      </div>
    </form>
  );
};

export default ServiceDetailsForm;


