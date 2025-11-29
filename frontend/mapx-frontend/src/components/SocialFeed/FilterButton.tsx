import React, { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

interface FilterButtonProps {
  icon: React.ReactNode;
  ariaLabel: string;
  isActive: boolean;
  activeCount?: number;
  totalCount?: number;
  onClick?: () => void;
  className?: string;
}

const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(({
  icon,
  ariaLabel,
  isActive,
  activeCount,
  totalCount,
  onClick,
  className = '',
}, ref) => {
  const { theme: themeName } = useTheme();
  const theme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  return (
    <Button
      ref={ref}
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
      onClick={onClick}
    >
      {icon}
      {isActive && activeCount !== undefined ? (
        <span 
          className="hidden sm:inline ml-2 px-2 py-0.5 text-[10px] md:text-xs rounded-full font-medium"
          style={theme ? {
            backgroundColor: theme.selectedBackground,
            color: theme.textPrimary,
          } : {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {activeCount}
        </span>
      ) : totalCount !== undefined && totalCount > 0 ? (
        <span 
          className="hidden sm:inline ml-2 px-2 py-0.5 text-[10px] md:text-xs rounded-full"
          style={theme ? {
            backgroundColor: theme.hoverBackground,
            color: theme.buttonGhost.text || theme.textPrimary,
          } : {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
          }}
        >
          {totalCount}
        </span>
      ) : null}
      {/* Visual indicator dot when active */}
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
  );
});

FilterButton.displayName = 'FilterButton';

export default FilterButton;

