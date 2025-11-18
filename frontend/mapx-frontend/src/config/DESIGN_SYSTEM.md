# MAPX Design System

This document describes the consolidated design system for the MAPX application. All design tokens, patterns, and utilities are centralized in `designSystem.ts` to ensure consistency across all components and pages.

## Table of Contents

- [Overview](#overview)
- [Design Philosophy](#design-philosophy)
- [Usage](#usage)
- [Color System](#color-system)
- [Typography](#typography)
- [Spacing](#spacing)
- [Borders & Shadows](#borders--shadows)
- [Animations](#animations)
- [Component Patterns](#component-patterns)
- [Best Practices](#best-practices)

## Overview

The design system is built on:
- **Tailwind CSS v4** for utility classes
- **shadcn/ui** components (New York style)
- **Geist font** as the primary typeface
- **Neobrutalist design** aesthetic with bold borders and offset shadows
- **CSS Variables** for theming and dark mode support

## Design Philosophy

### Neobrutalist Aesthetic
- Bold black borders (2px-4px)
- Offset shadows (4px-12px) for depth
- High contrast colors
- Clean, geometric shapes

### Accessibility
- WCAG AA compliant color contrasts
- Minimum 16px font size on mobile (prevents iOS zoom)
- Focus states for all interactive elements
- Semantic HTML structure

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly targets (minimum 44px height)

## Usage

### Import the Design System

```typescript
import designSystem from '@/config/designSystem';
// or import specific tokens
import { colors, spacing, shadows, animations } from '@/config/designSystem';
```

### Using in React Components

#### With Tailwind Classes (Recommended)

```tsx
// Use Tailwind classes that map to design tokens
<div className="bg-background text-foreground p-4 rounded-lg border-2 border-black shadow-[8px_8px_0_0_#000]">
  Content
</div>
```

#### With Inline Styles

```tsx
import { colors, spacing, shadows } from '@/config/designSystem';

<div style={{
  backgroundColor: colors.background,
  padding: spacing[4],
  boxShadow: shadows.neobrutalist.lg,
}}>
  Content
</div>
```

#### Using Utility Functions

```tsx
import { getNeobrutalistShadow, getTransition } from '@/config/designSystem';

<div style={{
  boxShadow: getNeobrutalistShadow(8),
  transition: getTransition(['color', 'background-color'], 'base', 'ease'),
}}>
  Content
</div>
```

## Color System

### Semantic Colors

Use semantic color tokens that automatically adapt to light/dark mode:

```tsx
// Primary actions
className="bg-primary text-primary-foreground"

// Secondary actions
className="bg-secondary text-secondary-foreground"

// Destructive actions
className="bg-destructive text-destructive-foreground"

// Muted backgrounds
className="bg-muted text-muted-foreground"
```

### Neobrutalist Colors

For neobrutalist design elements:

```tsx
import { colors } from '@/config/designSystem';

// Black borders and shadows
borderColor: colors.neobrutalist.black

// Text colors
color: colors.text.primary
color: colors.text.secondary
color: colors.text.light
```

### Color Usage Guidelines

1. **Always use semantic tokens** for UI elements (primary, secondary, destructive)
2. **Use CSS variables** via Tailwind classes when possible (`bg-primary`, `text-foreground`)
3. **Reserve hardcoded colors** for neobrutalist borders/shadows only
4. **Test color contrast** in both light and dark modes

## Typography

### Font Families

- **Primary**: Geist (used throughout the app)
- **Alternative**: Space Grotesk (used in search components)
- **Alternative**: Inter (used in legacy components)

### Font Sizes

```tsx
import { typography } from '@/config/designSystem';

// Available sizes: xs, sm, base, lg, xl, 2xl, 3xl, 4xl
className="text-sm"  // 14px
className="text-base" // 16px
className="text-xl"   // 20px
```

### Font Weights

- `font-normal` (400)
- `font-medium` (500)
- `font-semibold` (600)
- `font-bold` (700)
- `font-extrabold` (800)

### Typography Patterns

```tsx
// Headings
<h1 className="text-2xl font-bold text-foreground">Heading</h1>

// Body text
<p className="text-base text-foreground">Body text</p>

// Muted text
<span className="text-sm text-muted-foreground">Helper text</span>
```

## Spacing

### Spacing Scale

Based on 4px base unit:

```tsx
import { spacing, gaps } from '@/config/designSystem';

// Use Tailwind spacing classes
className="p-4"    // 16px
className="m-6"    // 24px
className="gap-3"  // 12px

// Or use design system tokens
padding: spacing[4]  // 16px
margin: spacing[6]    // 24px
gap: gaps.md          // 12px
```

### Common Spacing Patterns

- **Component padding**: `p-4` (16px) or `p-6` (24px)
- **Gap between elements**: `gap-3` (12px) or `gap-4` (16px)
- **Section spacing**: `space-y-6` (24px vertical)

## Borders & Shadows

### Neobrutalist Borders

```tsx
import { borders, getNeobrutalistBorder } from '@/config/designSystem';

// Standard neobrutalist border
className="border-2 border-black"

// Or using utility
style={{ border: getNeobrutalistBorder(2) }}
```

### Neobrutalist Shadows

```tsx
import { shadows, getNeobrutalistShadow } from '@/config/designSystem';

// Standard shadows
className="shadow-[8px_8px_0_0_#000]"

// Or using utility
style={{ boxShadow: getNeobrutalistShadow(8) }}

// With focus ring
style={{ boxShadow: shadows.neobrutalist['lg-focus'] }}
```

### Border Radius

```tsx
// Use Tailwind classes
className="rounded-md"   // 8px
className="rounded-lg"   // 14px
className="rounded-xl"   // 16px
className="rounded-2xl"  // 24px
```

## Animations

### Transitions

```tsx
import { animations, getTransition } from '@/config/designSystem';

// Standard transitions
className="transition-all duration-200 ease-in-out"

// Using utility function
style={{ transition: getTransition('all', 'base', 'ease') }}

// Color transitions
style={{ transition: animations.transitions.colors }}
```

### Keyframe Animations

Common animations are defined in the design system:

- `fadeIn` - Fade in from opacity 0
- `slideInFromTop` - Slide in from top
- `slideInFromRight` - Slide in from right
- `scaleIn` - Scale in from 0.95
- `shimmer` - Loading shimmer effect
- `spin` - Rotation animation

### Animation Patterns

```tsx
// Framer Motion (recommended for complex animations)
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  Content
</motion.div>

// CSS animations
<div className="fade-in">Content</div>
```

## Component Patterns

### Buttons

Use shadcn/ui Button component with variants:

```tsx
import { Button } from '@/components/ui/button';

<Button variant="default" size="default">Primary</Button>
<Button variant="outline" size="sm">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="destructive">Delete</Button>
```

### Cards

```tsx
import { Card } from '@/components/ui/card';

<Card className="p-6">
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Input Fields

```tsx
import { Input } from '@/components/ui/input';

<Input 
  className="h-9 px-4" 
  placeholder="Enter text"
  // Minimum 16px font-size on mobile (handled in index.css)
/>
```

### Neobrutalist Components

For components with neobrutalist styling:

```tsx
<div className={cn(
  "bg-background",
  "border-2 border-black",
  "rounded-lg",
  "shadow-[8px_8px_0_0_#000]",
  "p-4",
  "transition-all duration-200",
  "hover:shadow-[6px_6px_0_0_#000]",
  "active:shadow-[4px_4px_0_0_#000]"
)}>
  Neobrutalist Card
</div>
```

## Best Practices

### 1. Use Design System Tokens

✅ **Do:**
```tsx
className="bg-primary text-primary-foreground p-4 rounded-lg"
```

❌ **Don't:**
```tsx
style={{ backgroundColor: '#3b82f6', padding: '16px' }}
```

### 2. Consistent Spacing

✅ **Do:**
```tsx
<div className="space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

❌ **Don't:**
```tsx
<div>
  <div className="mb-3">Item 1</div>
  <div className="mb-5">Item 2</div>
</div>
```

### 3. Semantic Colors

✅ **Do:**
```tsx
<button className="bg-destructive text-destructive-foreground">
  Delete
</button>
```

❌ **Don't:**
```tsx
<button className="bg-red-500 text-white">
  Delete
</button>
```

### 4. Responsive Design

✅ **Do:**
```tsx
<div className="p-4 md:p-6 lg:p-8">
  Content
</div>
```

❌ **Don't:**
```tsx
<div style={{ padding: '24px' }}>
  Content
</div>
```

### 5. Animation Performance

✅ **Do:**
```tsx
// Use transform and opacity for animations
className="transition-transform duration-200"
```

❌ **Don't:**
```tsx
// Avoid animating layout properties
className="transition-width duration-200"
```

## Migration Guide

When updating existing components to use the design system:

1. **Replace hardcoded colors** with semantic tokens
2. **Standardize spacing** using the spacing scale
3. **Use consistent border radius** values
4. **Apply neobrutalist patterns** where appropriate
5. **Update animations** to use design system transitions

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Geist Font](https://vercel.com/font)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)



