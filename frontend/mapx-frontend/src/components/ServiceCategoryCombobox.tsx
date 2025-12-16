import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
// Removed CommandItem and CommandList imports - using custom list instead
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { serviceCategoriesApi, type ServiceCategory } from '@/services/serviceCategoriesApi';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { cn } from '@/lib/utils';
import { getReadableTextColor } from '@/utils/color';

interface ServiceCategoryComboboxProps {
  selectedCategoryId?: number | null;
  onSelect: (categoryId: number | null) => void;
  className?: string;
  placeholder?: string;
}

const ServiceCategoryCombobox: React.FC<ServiceCategoryComboboxProps> = ({
  selectedCategoryId,
  onSelect,
  className = '',
  placeholder = 'Search categories...',
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  const fetchCategories = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const data = await serviceCategoriesApi.getAllCategories();
      
      // Check if request was aborted before updating state
      if (signal?.aborted) {
        return;
      }
      
      setCategories(data);
    } catch (error) {
      // Don't update state if request was aborted
      if (signal?.aborted) {
        return;
      }
      
      console.error('Failed to fetch service categories:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to load categories. Please check your connection and try again.';
      setError(errorMessage);
      setCategories([]); // Clear categories on error
    } finally {
      // Only update loading state if not aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    fetchCategories(abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, [fetchCategories]);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find(cat => cat.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Filter categories based on search value (by name only)
  const filteredCategories = useMemo(() => {
    if (!searchValue.trim()) return categories;
    const query = searchValue.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(query)
    );
  }, [categories, searchValue]);

  // Update search value when category is selected
  useEffect(() => {
    if (selectedCategory) {
      setSearchValue(selectedCategory.name);
    } else {
      setSearchValue('');
    }
  }, [selectedCategory]);

  const handleSelect = (categoryId: number | null) => {
    onSelect(categoryId === selectedCategoryId ? null : categoryId);
    setOpen(false);
    // Focus will return to input after selection
    setTimeout(() => inputRef.current?.blur(), 0);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSearchValue('');
    onSelect(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setOpen(true);
    // Clear selection if user starts typing
    if (selectedCategoryId && value !== selectedCategory?.name) {
      onSelect(null);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only open popover on focus if it's not already open
    // This prevents conflicts with click handlers
    if (!open) {
      setOpen(true);
    }
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Ensure popover opens when clicking the input
    if (!open) {
      setOpen(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  // Focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      // Use a small delay to ensure popover is fully rendered and input can receive focus
      const timeoutId = setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
      
      return () => clearTimeout(timeoutId);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      // Only update state if it's actually changing to avoid unnecessary re-renders
      if (newOpen !== open) {
        setOpen(newOpen);
      }
    }}>
      <div ref={containerRef} className={cn("relative w-full", className)}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onClick={handleInputClick}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholder}
              autoFocus={false}
              className={cn(
                "w-full h-9 sm:h-10 text-sm sm:text-base pr-10",
                className
              )}
              style={selectedTheme ? {
                backgroundColor: selectedTheme.inputBackground || selectedTheme.cardBackground || '#FFFFFF',
                borderColor: selectedTheme.inputBorder || selectedTheme.borderColor || '#000000',
                color: selectedTheme.inputText || selectedTheme.textPrimary || '#000000',
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {selectedCategory && searchValue === selectedCategory.name && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={handleClear}
                  style={{ color: selectedTheme?.textMuted || '#6B7280' }}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </div>
        </PopoverAnchor>
        
        <PopoverContent 
          className="p-0 w-full" 
          align="start"
          onInteractOutside={(e) => {
            // Prevent closing when clicking on the input or container
            if (containerRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          style={{
            width: containerRef.current?.offsetWidth ? `${containerRef.current.offsetWidth}px` : undefined,
            ...(selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              borderColor: selectedTheme.borderColor || '#000000',
              boxShadow: `4px 4px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : {})
          }}
        >
            <div
              style={selectedTheme ? {
                backgroundColor: selectedTheme.cardBackground || '#FFFFFF',
              } : undefined}
            >
              <div 
                className="max-h-[300px] overflow-y-auto overflow-x-hidden"
                role="listbox"
              >
                {loading ? (
                  <div className="py-6 text-center text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
                    Loading categories...
                  </div>
                ) : error ? (
                  <div className="py-6 px-4 text-center">
                    <div className="text-sm mb-3" style={{ color: selectedTheme?.textHighlight || selectedTheme?.accentColor || '#EF4444' }}>
                      {error}
                    </div>
                    <Button 
                      onClick={() => fetchCategories()} 
                      size="sm"
                      disabled={loading}
                      style={selectedTheme ? {
                        backgroundColor: selectedTheme.accentColor,
                        color: textOnAccent,
                        boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      } : undefined}
                    >
                      {loading ? 'Retrying...' : 'Retry'}
                    </Button>
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="py-6 text-center text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
                    No category found.
                  </div>
                ) : (
                  <div className="p-1">
                    {filteredCategories.map((category, index) => {
                      const isSelected = selectedCategoryId === category.id;
                      return (
                        <div
                          key={category.id}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(category.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelect(category.id);
                            } else if (e.key === 'ArrowDown' && index < filteredCategories.length - 1) {
                              e.preventDefault();
                              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                              nextElement?.focus();
                            } else if (e.key === 'ArrowUp' && index > 0) {
                              e.preventDefault();
                              const prevElement = e.currentTarget.previousElementSibling as HTMLElement;
                              prevElement?.focus();
                            }
                          }}
                          tabIndex={0}
                          className={cn(
                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                            isSelected 
                              ? "bg-accent text-accent-foreground" 
                              : "hover:bg-accent/50"
                          )}
                          style={selectedTheme ? {
                            color: selectedTheme.textPrimary || '#000000',
                            backgroundColor: isSelected 
                              ? (selectedTheme.accentColor + '20' || 'rgba(0, 0, 0, 0.1)')
                              : 'transparent',
                          } : undefined}
                          onMouseEnter={(e) => {
                            if (selectedTheme && !isSelected) {
                              e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground || 'rgba(0, 0, 0, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedTheme && !isSelected) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="flex-1 truncate">{category.name}</span>
                          </div>
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                            style={selectedTheme ? {
                              color: selectedTheme.accentColor || '#000000',
                            } : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
      </div>
    </Popover>
  );
};

export default ServiceCategoryCombobox;


