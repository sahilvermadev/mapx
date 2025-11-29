import type { CSSProperties } from 'react';
import { THEMES } from '@/services/profileService';
import type { ThemeName, Theme } from '@/services/profileService';

/**
 * Get theme-specific tag styles with fallback defaults
 */
export const getTagStyle = (theme: ThemeName) => {
  const selectedTheme = THEMES[theme];
  return selectedTheme.tagStyle || {
    background: '#F5F5F5',
    textColor: '#000000',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: '1px',
    shadow: 'none',
    hoverBackground: '#F5F5F5',
  };
};

/**
 * Convert tag background (solid or gradient) to CSS string
 */
export const getTagBackground = (bg: string | { from: string; to: string }): string => {
  if (typeof bg === 'string') return bg;
  return `linear-gradient(135deg, ${bg.from} 0%, ${bg.to} 100%)`;
};

/**
 * Get tag style properties for inline styles
 */
export const getTagInlineStyles = (theme: ThemeName) => {
  const tagStyle = getTagStyle(theme);
  const tagBackground = getTagBackground(tagStyle.background);
  
  return {
    background: tagBackground,
    color: tagStyle.textColor,
    border: `${tagStyle.borderWidth || '1px'} solid ${tagStyle.borderColor || 'rgba(0, 0, 0, 0.1)'}`,
    boxShadow: tagStyle.shadow === 'none' ? 'none' : (tagStyle.shadow || 'none'),
  };
};

/**
 * TypeScript type for CSS properties that include CSS custom properties (CSS variables)
 * This allows type-safe usage of CSS variables like --scrollbar-track in inline styles
 */
export type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string;
};

/**
 * Fallback colors for themes when theme-specific colors are not available
 */
export const THEME_FALLBACKS = {
  dark: {
    scrollbarTrack: 'rgba(255, 255, 255, 0.1)',
    scrollbarThumb: 'rgba(255, 255, 255, 0.3)',
    scrollbarThumbHover: 'rgba(255, 255, 255, 0.5)',
  },
  light: {
    scrollbarTrack: 'rgba(0, 0, 0, 0.1)',
    scrollbarThumb: 'rgba(0, 0, 0, 0.3)',
    scrollbarThumbHover: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

/**
 * Get scrollbar CSS variable styles based on theme
 * 
 * This function generates CSS custom properties for scrollbar styling that will be
 * inherited by child elements with the `.label-menu-scrollbar` class.
 * 
 * @param themeName - The current theme name (e.g., 'dark', 'neo-brutal')
 * @param selectedTheme - The theme object, or null if theme is not found
 * @returns CSS properties object with scrollbar CSS variables
 * 
 * @example
 * ```tsx
 * const scrollbarStyles = getScrollbarStyles(themeName, selectedTheme);
 * <div style={scrollbarStyles}>
 *   <div className="label-menu-scrollbar">...</div>
 * </div>
 * ```
 */
export function getScrollbarStyles(
  themeName: ThemeName | string | undefined,
  selectedTheme: Theme | null
): CSSPropertiesWithVars {
  const isDark = themeName === 'dark';
  
  return {
    '--scrollbar-track': selectedTheme?.borderColorMuted || 
      (isDark ? THEME_FALLBACKS.dark.scrollbarTrack : THEME_FALLBACKS.light.scrollbarTrack),
    '--scrollbar-thumb': isDark 
      ? THEME_FALLBACKS.dark.scrollbarThumb 
      : (selectedTheme?.borderColor || THEME_FALLBACKS.light.scrollbarThumb),
    '--scrollbar-thumb-hover': isDark 
      ? THEME_FALLBACKS.dark.scrollbarThumbHover 
      : (selectedTheme?.textMuted || selectedTheme?.textSecondary || THEME_FALLBACKS.light.scrollbarThumbHover),
  };
}










