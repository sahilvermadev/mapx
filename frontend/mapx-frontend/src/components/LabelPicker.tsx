import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getTagInlineStyles, getScrollbarStyles } from '@/utils/themeUtils';
import { getReadableTextColor } from '@/utils/color';
import { MAX_LABEL_LENGTH } from '@/components/composer/constants';
import { FaPlus } from 'react-icons/fa';

export interface LabelPickerProps {
  // Label data source
  labels: Record<string, readonly string[] | string[]>;
  
  // State management
  selectedLabels: string[];
  onLabelsChange: (labels: string[]) => void;
  
  // Display mode
  variant?: 'modal' | 'inline';
  
  // Visibility control
  isOpen: boolean;
  onClose: () => void;
  
  // Optional features
  showSearch?: boolean;
  showSelectedSummary?: boolean;
  maxHeight?: string;
  
  // Customization
  title?: string;
  placeholder?: string;
  
  // Initial state
  initiallyExpanded?: boolean;
}

const LabelPicker: React.FC<LabelPickerProps> = ({
  labels,
  selectedLabels,
  onLabelsChange,
  variant = 'modal',
  isOpen,
  onClose,
  showSearch = false,
  showSelectedSummary = false,
  maxHeight,
  title = 'Select Labels',
  placeholder = 'Add custom label...',
  initiallyExpanded = true,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(initiallyExpanded ? Object.keys(labels) : [])
  );
  const [customLabel, setCustomLabel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);
  const tagInlineStyles = useMemo(() => getTagInlineStyles(themeName), [themeName]);
  const scrollbarStyles = useMemo(() => 
    getScrollbarStyles(themeName, selectedTheme),
    [themeName, selectedTheme]
  );

  // Reset search and custom label when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setCustomLabel('');
      if (initiallyExpanded) {
        setExpandedCategories(new Set(Object.keys(labels)));
      }
    }
  }, [isOpen, initiallyExpanded, labels]);

  // Filter labels based on search query
  const filteredLabelEntries = useMemo(() => {
    if (!searchQuery.trim()) {
      return Object.entries(labels);
    }
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, readonly string[] | string[]> = {};
    
    Object.entries(labels).forEach(([category, labelList]) => {
      // Check if category name matches
      const categoryMatches = category.toLowerCase().includes(query);
      
      // Filter labels that match
      const matchingLabels = labelList.filter(label => 
        label.toLowerCase().includes(query)
      );
      
      // Include category if category matches or has matching labels
      if (categoryMatches || matchingLabels.length > 0) {
        filtered[category] = categoryMatches ? labelList : matchingLabels;
      }
    });
    
    return Object.entries(filtered);
  }, [labels, searchQuery]);

  const toggleLabel = useCallback((label: string) => {
    const normalizedLabel = label.trim();
    const isSelected = selectedLabels.some(l => l.toLowerCase() === normalizedLabel.toLowerCase());
    
    if (isSelected) {
      const newLabels = selectedLabels.filter(l => l.toLowerCase() !== normalizedLabel.toLowerCase());
      onLabelsChange(newLabels);
    } else {
      const newLabels = [...selectedLabels, normalizedLabel];
      onLabelsChange(newLabels);
    }
  }, [selectedLabels, onLabelsChange]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const addCustomLabel = useCallback(() => {
    const value = customLabel.trim();
    if (!value) return;
    
    const normalized = value.replace(/\s+/g, ' ').slice(0, MAX_LABEL_LENGTH);
    const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    
    const exists = selectedLabels.some(l => l.toLowerCase() === capitalized.toLowerCase());
    if (exists) {
      setCustomLabel('');
      return;
    }
    
    onLabelsChange([...selectedLabels, capitalized]);
    setCustomLabel('');
  }, [customLabel, selectedLabels, onLabelsChange]);

  const removeLabel = useCallback((labelToRemove: string) => {
    const newLabels = selectedLabels.filter(l => l.toLowerCase() !== labelToRemove.toLowerCase());
    onLabelsChange(newLabels);
  }, [selectedLabels, onLabelsChange]);

  // Modal variant content
  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1050] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      style={{ paddingTop: '5rem', paddingBottom: '2rem' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg shadow-lg p-6 max-w-3xl w-full mx-4 my-auto flex flex-col border-2"
        style={{
          maxHeight: maxHeight && (maxHeight.includes('vh') || maxHeight.includes('px') || maxHeight.includes('%')) 
            ? maxHeight.replace('max-h-[', '').replace(']', '')
            : (maxHeight || 'calc(90vh - 7rem)'),
          height: 'auto',
          marginTop: 'auto',
          marginBottom: 'auto',
          ...(selectedTheme ? {
            backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
            borderColor: selectedTheme.borderColor || '#000000',
            boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            ...scrollbarStyles,
          } : {})
        }}
      >
        {renderHeader()}
        {renderLabelsContent()}
        {renderCustomLabelInput()}
        {renderDoneButton()}
      </motion.div>
    </motion.div>
  );

  // Inline variant content
  const inlineContent = (
    <motion.div
      key="label-picker"
      initial={{ opacity: 0, y: -12, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <motion.div
        layout
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="rounded-md border shadow-sm"
        style={{
          borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.2)',
          backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
          ...scrollbarStyles,
        }}
      >
        {renderHeader(true)}
        {showSelectedSummary && renderSelectedSummary()}
        {renderLabelsContent(true)}
        {renderCustomLabelInput(true)}
      </motion.div>
    </motion.div>
  );

  function renderHeader(isInline = false) {
    return (
      <div className={`flex items-center justify-between ${isInline ? 'sticky top-0 z-10 flex-col gap-3 border-b p-3 md:flex-row md:items-center' : 'mb-4'}`}
        style={isInline ? {
          borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.1)',
          backgroundColor: selectedTheme?.cardBackground || '#FFFFFF',
        } : undefined}
      >
        <h3 
          className={`font-semibold ${isInline ? 'text-sm' : 'text-lg'}`}
          style={{ color: selectedTheme?.textPrimary || '#000000' }}
        >
          {title}
        </h3>
        <div className={`flex ${isInline ? 'flex-col gap-2 md:flex-row md:items-center' : 'items-center gap-2'}`}>
          {showSearch && (
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search labels..."
              className={isInline ? 'h-8 w-full md:w-56' : 'h-8 w-48'}
              style={{
                backgroundColor: selectedTheme?.inputBackground || selectedTheme?.cardBackground || '#FFFFFF',
                color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
                borderColor: selectedTheme?.inputBorder || selectedTheme?.borderColor || '#000000',
                boxShadow: `2px 2px 0 0 ${selectedTheme?.borderColor || '#000000'}`,
              }}
            />
          )}
          <Button
            type="button"
            variant={isInline ? 'ghost' : 'ghost'}
            size="sm"
            onClick={onClose}
            className={isInline ? 'h-8 w-full md:w-8 md:p-0' : 'p-1'}
            aria-label="Close"
            style={{
              color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
            }}
          >
            {isInline ? (
              <>
                <span className="md:hidden" style={{ color: 'inherit' }}>Done</span>
                <span className="hidden md:inline">
                  <X className="h-4 w-4" style={{ color: 'inherit' }} />
                </span>
              </>
            ) : (
              <X className="h-5 w-5" style={{ color: 'inherit' }} />
            )}
          </Button>
        </div>
      </div>
    );
  }

  function renderSelectedSummary() {
    if (selectedLabels.length === 0) return null;

    return (
      <AnimatePresence>
        <motion.div
          key="selected-labels"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="border-b border-dashed p-3"
          style={{
            borderColor: selectedTheme?.borderColorMuted || 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {selectedLabels.map((label, i) => (
              <motion.span
                key={`${label}-${i}`}
                layout
                className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md"
                style={tagInlineStyles}
              >
                {label}
                <button
                  type="button"
                  onClick={() => removeLabel(label)}
                  className="ml-1 text-xs hover:opacity-70 transition-opacity"
                  aria-label={`Remove ${label}`}
                  style={selectedTheme ? {
                    color: selectedTheme.accentColor || '#000000',
                  } : undefined}
                >
                  ×
                </button>
              </motion.span>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  function renderLabelsContent(isInline = false) {
    const entries = showSearch ? filteredLabelEntries : Object.entries(labels);
    const contentMaxHeight = isInline 
      ? (maxHeight || 'max-h-[45vh]')
      : 'flex-1 min-h-0';

    return (
      <div 
        className={`overflow-y-auto space-y-4 label-menu-scrollbar ${contentMaxHeight}`}
        style={isInline ? { padding: '12px' } : { padding: '0', minHeight: 0, maxHeight: '100%' }}
      >
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-center"
            style={{
              borderColor: selectedTheme?.borderColorMuted || 'rgba(0, 0, 0, 0.1)',
              backgroundColor: selectedTheme?.hoverBackground || '#F9FAFB',
              color: selectedTheme?.textMuted || '#6B7280',
            }}
          >
            {showSearch && searchQuery ? 'No labels found' : 'No labels available'}
          </div>
        ) : (
          entries.map(([category, labelList]) => (
            <div key={category} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex items-center gap-2 w-full text-left font-semibold text-sm transition-colors"
                style={{
                  color: selectedTheme?.textSecondary || selectedTheme?.textMuted || selectedTheme?.textColor || '#6B7280',
                }}
                onMouseEnter={(e) => {
                  if (selectedTheme) {
                    e.currentTarget.style.color = selectedTheme.textPrimary || selectedTheme.textColor || '#000000';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTheme) {
                    e.currentTarget.style.color = selectedTheme.textSecondary || selectedTheme.textMuted || selectedTheme.textColor || '#6B7280';
                  }
                }}
              >
                {expandedCategories.has(category) ? (
                  <ChevronDown className="h-4 w-4" style={{ color: 'inherit' }} />
                ) : (
                  <ChevronUp className="h-4 w-4" style={{ color: 'inherit' }} />
                )}
                <span style={{ color: 'inherit' }}>{category}</span>
              </button>
              {isInline ? (
                <AnimatePresence initial={false}>
                  {expandedCategories.has(category) && (
                    <motion.div
                      key={`${category}-labels`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="flex flex-wrap gap-2 pl-6"
                    >
                      {labelList.map((label: string) => renderLabelButton(label, category))}
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                expandedCategories.has(category) && (
                  <div className="flex flex-wrap gap-2 pl-6">
                    {labelList.map((label: string) => renderLabelButton(label, category))}
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  function renderLabelButton(label: string, category: string) {
    const isSelected = selectedLabels.some(l => l.toLowerCase() === label.toLowerCase());
    const ButtonComponent = variant === 'inline' ? motion.button : 'button';
    const buttonProps = variant === 'inline' 
      ? { whileTap: { scale: 0.96 } }
      : {};

    return (
      <ButtonComponent
        key={label}
        type="button"
        onClick={() => toggleLabel(label)}
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-all border select-none ${
          variant === 'modal' ? 'hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none' : ''
        }`}
        style={selectedTheme ? isSelected ? {
          backgroundColor: selectedTheme.selectedBackground || selectedTheme.hoverBackground || 'rgba(251, 191, 36, 0.1)',
          color: selectedTheme.accentColor || selectedTheme.textPrimary || '#92400E',
          borderColor: variant === 'modal' 
            ? (selectedTheme.accentColor + '40' || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.3)')
            : (selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.3)'),
          boxShadow: `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`,
        } : {
          backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
          color: selectedTheme.textMuted || selectedTheme.textSecondary || '#6B7280',
          borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)',
        } : undefined}
        onMouseEnter={(e) => {
          if (selectedTheme && !isSelected) {
            e.currentTarget.style.borderColor = selectedTheme.borderColor || 'rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.boxShadow = `1px 1px 0 0 ${selectedTheme.borderColor || '#000000'}`;
          }
        }}
        onMouseLeave={(e) => {
          if (selectedTheme && !isSelected) {
            e.currentTarget.style.borderColor = selectedTheme.borderColorMuted || selectedTheme.borderColor || 'rgba(0, 0, 0, 0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
        {...buttonProps}
      >
        {label}
      </ButtonComponent>
    );
  }

  function renderCustomLabelInput(isInline = false) {
    return (
      <div 
        className={`border-t flex items-center gap-2 ${isInline ? 'p-3' : 'mt-4 pt-4'}`}
        style={{
          borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <Input
          type="text"
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomLabel();
            }
          }}
          placeholder={placeholder}
          className={`flex-1 text-sm shadow-none border-0 focus:ring-0 focus:outline-none focus:border-0 appearance-none ${isInline ? 'h-8' : ''}`}
          style={{
            backgroundColor: selectedTheme?.inputBackground || selectedTheme?.cardBackground || 'transparent',
            color: selectedTheme?.textPrimary || selectedTheme?.textColor || '#000000',
          }}
        />
        <Button
          type="button"
          onClick={addCustomLabel}
          disabled={!customLabel.trim()}
          size="sm"
          className={`px-3 ${isInline ? 'h-8' : ''}`}
          style={selectedTheme ? {
            backgroundColor: selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000',
            color: selectedTheme.buttonPrimary?.text || textOnAccent,
            boxShadow: variant === 'modal' ? `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}` : undefined,
          } : undefined}
          onMouseEnter={(e) => {
            if (selectedTheme && customLabel.trim()) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.hover || selectedTheme.accentColor || '#000000';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTheme && customLabel.trim()) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000';
            }
          }}
        >
          <FaPlus className="h-3 w-3" style={{ color: 'inherit' }} />
        </Button>
      </div>
    );
  }

  function renderDoneButton() {
    if (variant === 'inline') return null;

    return (
      <div 
        className="mt-4 pt-4 border-t flex justify-end"
        style={{
          borderColor: selectedTheme?.borderColorMuted || selectedTheme?.borderColor || 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <Button
          type="button"
          onClick={onClose}
          className="px-6"
          style={selectedTheme ? {
            backgroundColor: selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000',
            color: selectedTheme.buttonPrimary?.text || textOnAccent,
            boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : undefined}
          onMouseEnter={(e) => {
            if (selectedTheme) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.hover || selectedTheme.accentColor || '#000000';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedTheme) {
              e.currentTarget.style.backgroundColor = selectedTheme.buttonPrimary?.background || selectedTheme.accentColor || '#000000';
            }
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  if (!isOpen) return null;

  if (variant === 'modal') {
    return modalContent;
  }

  return (
    <AnimatePresence initial={false}>
      {inlineContent}
    </AnimatePresence>
  );
};

export default LabelPicker;


