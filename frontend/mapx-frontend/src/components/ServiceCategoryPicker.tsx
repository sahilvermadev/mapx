import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { serviceCategoriesApi, type ServiceCategory } from '@/services/serviceCategoriesApi';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';
import { toast } from 'sonner';

interface ServiceCategoryPickerProps {
  selectedCategoryId?: number | null;
  onSelect: (categoryId: number | null) => void;
  className?: string;
  showSearch?: boolean;
  compact?: boolean;
}

const ServiceCategoryPicker: React.FC<ServiceCategoryPickerProps> = ({
  selectedCategoryId,
  onSelect,
  className = '',
  showSearch = true,
  compact = false,
}) => {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  const accentColor = selectedTheme?.accentColor || '#000000';
  const textOnAccent = getReadableTextColor(accentColor);

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(query) ||
      cat.slug.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find(cat => cat.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await serviceCategoriesApi.getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch service categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    if (newCategoryName.trim().length > 255) {
      toast.error('Category name must be 255 characters or less');
      return;
    }

    setIsCreating(true);
    try {
      const newCategory = await serviceCategoriesApi.createCategory(
        newCategoryName.trim()
      );
      
      // Refresh categories list
      await fetchCategories();
      
      // Select the newly created category
      onSelect(newCategory.id);
      
      // Reset form and close modal
      setNewCategoryName('');
      setShowCreateModal(false);
      
      toast.success(`Category "${newCategory.name}" created successfully`);
    } catch (error: any) {
      console.error('Failed to create category:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create category';
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
          Loading categories...
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {categories.slice(0, 8).map(cat => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <Button
              key={cat.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelect(isSelected ? null : cat.id)}
              className="text-xs h-8 px-3 rounded-full"
              style={selectedTheme ? {
                backgroundColor: isSelected ? selectedTheme.accentColor : 'transparent',
                color: isSelected ? textOnAccent : selectedTheme.textPrimary,
                borderColor: isSelected ? selectedTheme.accentColor : selectedTheme.borderColor,
                boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
              } : undefined}
            >
              {cat.name}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showSearch && (
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
            style={{ color: selectedTheme?.textMuted || '#9CA3AF' }}
          />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            style={selectedTheme ? {
              backgroundColor: selectedTheme.inputBackground,
              borderColor: selectedTheme.inputBorder,
              color: selectedTheme.inputText,
              boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : undefined}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {selectedCategory && (
        <div className="flex items-center justify-between p-2 rounded-lg border"
          style={selectedTheme ? {
            backgroundColor: selectedTheme.selectedBackground,
            borderColor: selectedTheme.borderColor,
            boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
          } : {
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
            borderColor: 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: selectedTheme?.textPrimary || '#000000' }}>
              {selectedCategory.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onSelect(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto space-y-1">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: selectedTheme?.textMuted || '#6B7280' }}>
            No categories found
          </div>
        ) : (
          filteredCategories.map(cat => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(isSelected ? null : cat.id)}
                className="w-full text-left p-3 rounded-lg border transition-colors hover:bg-opacity-50"
                style={selectedTheme ? {
                  backgroundColor: isSelected 
                    ? (selectedTheme.accentColor + '20') 
                    : 'transparent',
                  borderColor: isSelected 
                    ? selectedTheme.accentColor 
                    : selectedTheme.borderColor,
                  color: selectedTheme.textPrimary,
                  boxShadow: `2px 2px 0 0 ${selectedTheme.borderColor || '#000000'}`,
                } : {
                  backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                  borderColor: isSelected ? '#000000' : 'rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  if (selectedTheme && !isSelected) {
                    e.currentTarget.style.backgroundColor = selectedTheme.hoverBackground;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTheme && !isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium">{cat.name}</span>
                  {isSelected && (
                    <Badge 
                      variant="secondary"
                      className="text-xs"
                      style={selectedTheme ? {
                        backgroundColor: selectedTheme.accentColor,
                        color: textOnAccent,
                      } : undefined}
                    >
                      Selected
                    </Badge>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Add Custom Category Button */}
      <Button
        variant="outline"
        onClick={() => setShowCreateModal(true)}
        className="w-full mt-3 border-dashed"
        style={selectedTheme ? {
          borderColor: selectedTheme.borderColorMuted || selectedTheme.borderColor,
          color: selectedTheme.textPrimary,
          backgroundColor: selectedTheme.cardBackground,
        } : undefined}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Custom Category
      </Button>

      {/* Create Category Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !isCreating && setShowCreateModal(false)}
        >
          <div 
            className="rounded-lg shadow-lg p-6 max-w-md w-full mx-4 border"
            onClick={(e) => e.stopPropagation()}
            style={selectedTheme ? {
              backgroundColor: selectedTheme.cardBackground,
              borderColor: selectedTheme.borderColor,
              boxShadow: `3px 3px 0 0 ${selectedTheme.borderColor || '#000000'}`,
            } : {
              backgroundColor: '#FFFFFF',
              borderColor: '#000000',
              boxShadow: '3px 3px 0 0 #000000',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-lg font-semibold"
                style={{ color: selectedTheme?.textPrimary || '#000000' }}
              >
                Create Custom Category
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => !isCreating && setShowCreateModal(false)}
                disabled={isCreating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label 
                  className="text-sm font-medium mb-2 block"
                  style={{ color: selectedTheme?.textPrimary || '#000000' }}
                >
                  Category Name *
                </label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Personal Trainer"
                  disabled={isCreating}
                  maxLength={255}
                  style={selectedTheme ? {
                    backgroundColor: selectedTheme.inputBackground,
                    borderColor: selectedTheme.inputBorder,
                    color: selectedTheme.inputText,
                  } : undefined}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewCategoryName('');
                    setShowCreateModal(false);
                  }}
                  disabled={isCreating}
                  style={selectedTheme ? {
                    borderColor: selectedTheme.borderColor,
                    color: selectedTheme.textPrimary,
                  } : undefined}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCategory}
                  disabled={isCreating || !newCategoryName.trim()}
                  style={selectedTheme ? {
                    backgroundColor: selectedTheme.accentColor,
                    color: textOnAccent,
                  } : undefined}
                >
                  {isCreating ? 'Creating...' : 'Create Category'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCategoryPicker;


