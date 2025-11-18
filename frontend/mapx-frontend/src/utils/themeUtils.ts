import { THEMES } from '@/services/profileService';
import type { ThemeName } from '@/services/profileService';

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








