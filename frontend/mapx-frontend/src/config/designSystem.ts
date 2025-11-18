/**
 * MAPX Design System
 * 
 * This file consolidates all design tokens, patterns, and utilities
 * to ensure consistent design language across the entire application.
 * 
 * Design Philosophy:
 * - Neobrutalist aesthetic with bold borders and offset shadows
 * - Clean, modern typography with Geist as primary font
 * - Accessible color contrasts and semantic color usage
 * - Smooth animations and transitions
 * - Responsive design with mobile-first approach
 */

// ============================================================================
// COLOR SYSTEM
// ============================================================================

/**
 * Semantic color tokens mapped to CSS variables
 * These align with shadcn/ui color system and support dark mode
 */
export const colors = {
  // Base colors (from CSS variables)
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: 'hsl(var(--card))',
  'card-foreground': 'hsl(var(--card-foreground))',
  popover: 'hsl(var(--popover))',
  'popover-foreground': 'hsl(var(--popover-foreground))',
  
  // Primary brand colors
  primary: 'hsl(var(--primary))',
  'primary-foreground': 'hsl(var(--primary-foreground))',
  
  // Secondary colors
  secondary: 'hsl(var(--secondary))',
  'secondary-foreground': 'hsl(var(--secondary-foreground))',
  
  // Muted colors
  muted: 'hsl(var(--muted))',
  'muted-foreground': 'hsl(var(--muted-foreground))',
  
  // Accent colors
  accent: 'hsl(var(--accent))',
  'accent-foreground': 'hsl(var(--accent-foreground))',
  
  // Destructive/error colors
  destructive: 'hsl(var(--destructive))',
  'destructive-foreground': 'hsl(var(--destructive-foreground))',
  
  // Border and input colors
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  
  // Chart colors
  chart: {
    1: 'hsl(var(--chart-1))',
    2: 'hsl(var(--chart-2))',
    3: 'hsl(var(--chart-3))',
    4: 'hsl(var(--chart-4))',
    5: 'hsl(var(--chart-5))',
  },
  
  // Sidebar colors
  sidebar: 'hsl(var(--sidebar))',
  'sidebar-foreground': 'hsl(var(--sidebar-foreground))',
  'sidebar-primary': 'hsl(var(--sidebar-primary))',
  'sidebar-primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  'sidebar-accent': 'hsl(var(--sidebar-accent))',
  'sidebar-accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  'sidebar-border': 'hsl(var(--sidebar-border))',
  'sidebar-ring': 'hsl(var(--sidebar-ring))',
  
  // Hardcoded colors used in components (to be migrated to CSS variables)
  // Neobrutalist black (used for borders and shadows)
  neobrutalist: {
    black: '#000000',
    'black-10': 'rgba(0, 0, 0, 0.1)',
    'black-20': 'rgba(0, 0, 0, 0.2)',
    'black-50': 'rgba(0, 0, 0, 0.5)',
    'black-60': 'rgba(0, 0, 0, 0.6)',
    'black-80': 'rgba(0, 0, 0, 0.8)',
  },
  
  // Text colors (from components)
  text: {
    primary: '#111827',
    secondary: '#374151',
    tertiary: '#6b7280',
    muted: '#9ca3af',
    light: '#e8eefc',
    'light-60': 'rgba(232, 238, 252, 0.6)',
    'light-70': 'rgba(232, 238, 252, 0.7)',
  },
  
  // Background colors (from components)
  bg: {
    white: '#ffffff',
    'white-06': 'rgba(255, 255, 255, 0.06)',
    'white-10': 'rgba(255, 255, 255, 0.1)',
    'white-90': 'rgba(255, 255, 255, 0.9)',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
    },
    dark: {
      base: '#0b0f17',
      'base-55': 'rgba(10, 14, 22, 0.55)',
      'base-70': 'rgba(10, 14, 22, 0.7)',
    },
  },
  
  // Blue accent (used in search, buttons)
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    500: '#3b82f6',
    600: '#2563eb',
    '500-12': 'rgba(59, 130, 246, 0.12)',
    '500-20': 'rgba(59, 130, 246, 0.2)',
    '500-30': 'rgba(59, 130, 246, 0.3)',
    '500-50': 'rgba(59, 130, 246, 0.5)',
    '500-70': 'rgba(59, 130, 246, 0.7)',
    '500-80': 'rgba(59, 130, 246, 0.8)',
  },
  
  // Red/destructive colors
  red: {
    50: '#fef2f2',
    100: '#fecaca',
    500: '#dc2626',
    600: '#ef4444',
  },
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  // Font families
  fontFamily: {
    // Primary font (Geist) - used throughout the app
    sans: ['Geist', 'system-ui', 'sans-serif'],
    // Alternative fonts used in specific components
    spaceGrotesk: ['Space Grotesk', 'sans-serif'],
    inter: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
  },
  
  // Font sizes (in rem for scalability)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  
  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  // Line heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  
  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.5px', // Used in uppercase badges
  },
} as const;

// ============================================================================
// SPACING SYSTEM
// ============================================================================

/**
 * Spacing scale based on 4px base unit
 * Used for padding, margins, gaps, etc.
 */
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;

// Common spacing values used in components
export const gaps = {
  xs: spacing[1],  // 4px
  sm: spacing[2],   // 8px
  md: spacing[3],  // 12px
  lg: spacing[4],  // 16px
  xl: spacing[6],   // 24px
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: '0',
  sm: 'calc(var(--radius) - 4px)',   // ~2px
  md: 'calc(var(--radius) - 2px)',    // ~6px
  base: 'var(--radius)',              // 0.5rem (8px) or 0.625rem (10px)
  lg: 'calc(var(--radius) + 4px)',    // ~14px
  xl: 'calc(var(--radius) + 8px)',   // ~18px
  '2xl': '1rem',                      // 16px
  '3xl': '1.5rem',                    // 24px
  full: '9999px',
  
  // Specific values used in components
  specific: {
    '4px': '4px',
    '6px': '6px',
    '8px': '8px',
    '10px': '10px',
    '14px': '14px',
    '16px': '16px',
  },
} as const;

// ============================================================================
// BORDERS
// ============================================================================

export const borders = {
  // Border widths
  width: {
    none: '0',
    thin: '1px',
    base: '2px',
    thick: '4px',
  },
  
  // Border styles
  style: {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
  },
  
  // Common border combinations
  neobrutalist: {
    base: '2px solid #000000',
    thick: '4px solid #000000',
  },
  
  // Border colors
  color: {
    default: colors.border,
    input: colors.input,
    neobrutalist: colors.neobrutalist.black,
    muted: 'rgba(255, 255, 255, 0.1)',
    'muted-20': 'rgba(255, 255, 255, 0.2)',
  },
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  // Standard shadows (from Tailwind/shadcn)
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  base: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  xl: '0 20px 40px rgba(0, 0, 0, 0.15)',
  
  // Neobrutalist offset shadows
  neobrutalist: {
    sm: '4px 4px 0 0 #000000',
    md: '6px 6px 0 0 #000000',
    lg: '8px 8px 0 0 #000000',
    xl: '12px 12px 0 0 #000000',
    // With focus ring
    'lg-focus': '8px 8px 0 0 #000000, 0 0 0 3px rgba(59, 130, 246, 0.12)',
  },
  
  // Focus rings
  focus: {
    ring: '0 0 0 3px rgba(59, 130, 246, 0.12)',
    'ring-white': '0 0 0 2px rgba(255, 255, 255, 0.3)',
  },
} as const;

// ============================================================================
// ANIMATIONS & TRANSITIONS
// ============================================================================

export const animations = {
  // Duration (in seconds)
  duration: {
    fast: '0.15s',
    base: '0.2s',
    normal: '0.3s',
    slow: '0.5s',
  },
  
  // Easing functions
  easing: {
    linear: 'linear',
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out',
    // Custom cubic-bezier curves
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  // Common transition combinations
  transitions: {
    // Standard transitions
    all: 'all 0.2s ease',
    colors: 'color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
    transform: 'transform 0.2s ease',
    opacity: 'opacity 0.3s ease-in-out',
    
    // Auth transitions (from index.css)
    auth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    
    // Smooth transitions
    smooth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Keyframe animations
  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    slideInFromTop: {
      from: { opacity: 0, transform: 'translateY(-10px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    slideInFromRight: {
      from: { opacity: 0, transform: 'translateX(100%)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
    slideInFromBottom: {
      from: { opacity: 0, transform: 'translateY(100%)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    slideInFromLeft: {
      from: { opacity: 0, transform: 'translateX(-100%)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
    scaleIn: {
      from: { opacity: 0, transform: 'scale(0.95)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    shimmer: {
      '0%': { backgroundPosition: '-200% 0' },
      '100%': { backgroundPosition: '200% 0' },
    },
    spin: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  },
} as const;

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  // Specific component z-indexes
  header: 50,
  sidePanel: 50,
  searchResults: 1000,
} as const;

// ============================================================================
// BREAKPOINTS (for responsive design)
// ============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// COMPONENT-SPECIFIC DESIGN TOKENS
// ============================================================================

export const components = {
  // Button variants (matching shadcn/ui button component)
  button: {
    height: {
      sm: 'h-8',
      default: 'h-9',
      lg: 'h-10',
      icon: 'size-9',
    },
    padding: {
      sm: 'px-3',
      default: 'px-4',
      lg: 'px-6',
    },
    gap: {
      sm: 'gap-1.5',
      default: 'gap-2',
    },
  },
  
  // Input fields
  input: {
    height: {
      sm: 'h-8',
      default: 'h-9',
      lg: 'h-10',
    },
    padding: {
      sm: 'px-3',
      default: 'px-4',
      lg: 'px-6',
    },
    minHeight: {
      mobile: '44px', // Prevents iOS zoom
      default: '48px',
    },
  },
  
  // Cards
  card: {
    padding: {
      sm: spacing[4],  // 16px
      md: spacing[6],  // 24px
      lg: spacing[8],  // 32px
    },
    gap: {
      sm: spacing[4],  // 16px
      md: spacing[6],  // 24px
    },
  },
  
  // Search bar
  search: {
    minHeight: {
      mobile: '44px',
      default: '48px',
    },
    padding: {
      mobile: '6px 12px',
      default: '10px 16px',
    },
    borderRadius: borderRadius.specific['14px'],
    border: borders.neobrutalist.base,
    shadow: shadows.neobrutalist.lg,
  },
  
  // Avatar sizes
  avatar: {
    xs: '20px',
    sm: '24px',
    md: '32px',
    lg: '40px',
    xl: '48px',
  },
  
  // Icon sizes
  icon: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '20px',
    xl: '24px',
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get neobrutalist shadow with custom offset
 */
export function getNeobrutalistShadow(offset: number = 8): string {
  return `${offset}px ${offset}px 0 0 ${colors.neobrutalist.black}`;
}

/**
 * Get neobrutalist border with custom width
 */
export function getNeobrutalistBorder(width: number = 2): string {
  return `${width}px solid ${colors.neobrutalist.black}`;
}

/**
 * Get responsive font size (mobile-first)
 */
export function getResponsiveFontSize(
  mobile: keyof typeof typography.fontSize,
  desktop: keyof typeof typography.fontSize
): string {
  return `${typography.fontSize[mobile]} / ${typography.fontSize[desktop]}`;
}

/**
 * Get transition string with custom duration and easing
 */
export function getTransition(
  properties: string | string[] = 'all',
  duration: keyof typeof animations.duration = 'base',
  easing: keyof typeof animations.easing = 'ease'
): string {
  const props = Array.isArray(properties) ? properties.join(', ') : properties;
  return `${props} ${animations.duration[duration]} ${animations.easing[easing]}`;
}

/**
 * Get backdrop blur with opacity
 */
export function getBackdropBlur(blur: number = 8, opacity: number = 0.06): string {
  return `backdrop-filter: blur(${blur}px); background: rgba(255, 255, 255, ${opacity});`;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type BorderRadiusToken = keyof typeof borderRadius;
export type ShadowToken = keyof typeof shadows;
export type AnimationDuration = keyof typeof animations.duration;
export type AnimationEasing = keyof typeof animations.easing;
export type Breakpoint = keyof typeof breakpoints;

// ============================================================================
// DESIGN SYSTEM CONFIGURATION
// ============================================================================

/**
 * Main design system configuration object
 * Export this for easy access to all design tokens
 */
export const designSystem = {
  colors,
  typography,
  spacing,
  gaps,
  borderRadius,
  borders,
  shadows,
  animations,
  zIndex,
  breakpoints,
  components,
  // Utility functions
  utils: {
    getNeobrutalistShadow,
    getNeobrutalistBorder,
    getResponsiveFontSize,
    getTransition,
    getBackdropBlur,
  },
} as const;

// Default export
export default designSystem;



