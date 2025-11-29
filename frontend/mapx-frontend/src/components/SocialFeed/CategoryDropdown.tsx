import React, { useMemo, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

export interface Category {
  key: string;
  label: string;
  count?: number;
}

interface CategoryDropdownProps {
  categories: Category[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  categories,
  selectedKeys,
  onToggle,
  ariaLabel = 'All categories',
  icon,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  
  // Get theme for styling
  const { theme: themeName } = useTheme();
  const theme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  // Memoize filtered categories
  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return categories;
    return categories.filter(c => c.label.toLowerCase().includes(normalizedQuery));
  }, [categories, query]);

  const isActive = selectedKeys.length > 0;
  const displayIcon = icon || <ListFilter className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={ariaLabel}
          size="sm"
          variant="ghost"
          className={`h-8 w-8 sm:w-auto rounded-full bg-transparent border px-0 sm:px-2 text-xs md:text-sm flex items-center justify-center font-medium transition-all flex-shrink-0 relative ${className}`}
          style={theme ? {
            color: theme.buttonGhost.text || theme.textPrimary,
            borderColor: isActive ? theme.accentColor + '40' : theme.borderColor,
            backgroundColor: isActive ? theme.selectedBackground : 'transparent',
          } : {
            borderColor: isActive ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)',
            backgroundColor: isActive ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (theme) {
              e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (theme) {
              e.currentTarget.style.backgroundColor = isActive ? theme.selectedBackground : 'transparent';
            }
          }}
        >
          {displayIcon}
          {isActive ? (
            <span 
              className="hidden sm:inline ml-2 px-2 py-0.5 text-[10px] md:text-xs rounded-full font-medium"
              style={theme ? {
                backgroundColor: theme.selectedBackground,
                color: theme.textPrimary,
              } : {
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {selectedKeys.length}
            </span>
          ) : categories.length > 0 ? (
            <span 
              className="hidden sm:inline ml-2 px-2 py-0.5 text-[10px] md:text-xs rounded-full"
              style={theme ? {
                backgroundColor: theme.hoverBackground,
                color: theme.buttonGhost.text || theme.textPrimary,
              } : {
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
              }}
            >
              {categories.length}
            </span>
          ) : null}
          {/* Visual indicator dot when categories are selected */}
          {isActive && (
            <span 
              className="absolute -top-1 -right-1 h-2 w-2 rounded-full border"
              style={theme ? {
                backgroundColor: theme.accentColor,
                borderColor: theme.cardBackground || theme.headerBackground || '#FFFFFF',
              } : {
                backgroundColor: '#000000',
                borderColor: '#FFFFFF',
              }}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        side="bottom"
        sideOffset={4}
        className="w-[90vw] max-w-[360px] p-2 border z-50"
        style={theme ? {
          backgroundColor: theme.cardBackground,
          borderColor: theme.borderColorMuted,
        } : {
          backgroundColor: '#FFFFFF',
          borderColor: 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <DropdownMenuLabel 
          className="text-xs md:text-sm font-semibold"
          style={{ color: theme?.textPrimary || '#000000' }}
        >
          All Categories
        </DropdownMenuLabel>
        <div 
          className="p-1"
          style={theme ? {
            '--category-input-placeholder': theme.inputPlaceholder || theme.textMuted || '#9CA3AF',
          } as React.CSSProperties & { '--category-input-placeholder': string } : {
            '--category-input-placeholder': '#9CA3AF',
          } as React.CSSProperties & { '--category-input-placeholder': string }}
        >
          <Input
            placeholder="Search categories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border text-xs md:text-sm [&::placeholder]:!text-[var(--category-input-placeholder)]"
            style={theme ? {
              backgroundColor: theme.inputBackground,
              borderColor: theme.inputBorder,
              color: theme.inputText,
            } : {
              backgroundColor: '#FFFFFF',
              borderColor: 'rgba(0, 0, 0, 0.1)',
            }}
          />
        </div>
        <DropdownMenuSeparator 
          style={{ 
            backgroundColor: theme?.borderColorMuted || theme?.borderColor || 'rgba(0, 0, 0, 0.1)' 
          }} 
        />
        <div className="max-h-[60vh] overflow-y-auto pr-1" role="listbox" aria-label={ariaLabel}>
          {filteredCategories.map(cat => {
            const active = selectedKeys.includes(cat.key);
            return (
              <DropdownMenuItem 
                key={cat.key} 
                onSelect={() => onToggle(cat.key)} 
                className="cursor-pointer"
                style={theme ? {
                  color: theme.textPrimary || '#000000',
                } : undefined}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.hoverBackground || theme.buttonGhost.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div className={`inline-flex items-center gap-2 text-xs md:text-sm ${active ? 'font-medium' : ''}`}>
                  <span 
                    className="inline-block h-2 w-2 rounded-full"
                    style={active 
                      ? { backgroundColor: theme?.accentColor || '#000000' }
                      : { backgroundColor: theme?.borderColorMuted || '#D1D5DB' }
                    }
                  />
                  <span style={{ color: theme?.textPrimary || '#000000' }}>{cat.label}</span>
                  {typeof cat.count === 'number' && (
                    <Badge 
                      variant={active ? 'secondary' : 'outline'} 
                      className="ml-1 h-5 px-1 text-[10px] md:text-xs"
                      style={theme ? {
                        backgroundColor: active 
                          ? (theme.selectedBackground || theme.hoverBackground || 'rgba(0, 0, 0, 0.1)')
                          : 'transparent',
                        borderColor: theme.borderColorMuted || theme.borderColor || 'rgba(0, 0, 0, 0.2)',
                        color: theme.textPrimary || '#000000',
                      } : undefined}
                    >
                      {cat.count}
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
          {filteredCategories.length === 0 && (
            <div 
              className="py-6 text-center text-xs md:text-sm"
              style={{ color: theme?.textMuted || '#6B7280' }}
            >
              No categories found.
            </div>
          )}
        </div>
        {selectedKeys.length > 0 && (
          <>
            <DropdownMenuSeparator 
              style={{ 
                backgroundColor: theme?.borderColorMuted || theme?.borderColor || 'rgba(0, 0, 0, 0.1)' 
              }} 
            />
            <div className="px-2 py-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full" 
                onClick={() => {
                  selectedKeys.forEach(k => onToggle(k));
                }}
                style={theme ? {
                  color: theme.buttonGhost.text || theme.textPrimary || '#000000',
                } : undefined}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                Clear filters
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CategoryDropdown;

