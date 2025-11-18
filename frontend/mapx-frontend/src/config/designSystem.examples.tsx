/**
 * Design System Usage Examples
 * 
 * This file demonstrates how to use the design system in React components.
 * These are reference examples - not meant to be imported directly.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  colors, 
  spacing, 
  shadows, 
  borders,
  getNeobrutalistShadow,
  getNeobrutalistBorder,
  getTransition,
  designSystem 
} from '@/config/designSystem';

// ============================================================================
// Example 1: Using Tailwind Classes (Recommended)
// ============================================================================

export function ExampleTailwindUsage() {
  return (
    <div className="bg-background text-foreground p-6 rounded-lg border-2 border-black shadow-[8px_8px_0_0_#000]">
      <h2 className="text-2xl font-bold mb-4">Neobrutalist Card</h2>
      <p className="text-muted-foreground">Using Tailwind classes with design system tokens</p>
    </div>
  );
}

// ============================================================================
// Example 2: Using Design System Tokens with Inline Styles
// ============================================================================

export function ExampleInlineStyles() {
  return (
    <div style={{
      backgroundColor: colors.background,
      color: colors.foreground,
      padding: spacing[6],
      borderRadius: '0.5rem',
      border: getNeobrutalistBorder(2),
      boxShadow: getNeobrutalistShadow(8),
      transition: getTransition('all', 'base', 'ease'),
    }}>
      <h2 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 700,
        marginBottom: spacing[4],
      }}>
        Using Design System Tokens
      </h2>
    </div>
  );
}

// ============================================================================
// Example 3: Neobrutalist Button Component
// ============================================================================

export function NeobrutalistButton({ 
  children, 
  onClick 
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-primary text-primary-foreground",
        "px-6 py-3",
        "rounded-lg",
        "border-2 border-black",
        "shadow-[6px_6px_0_0_#000]",
        "font-semibold",
        "transition-all duration-200",
        "hover:shadow-[4px_4px_0_0_#000]",
        "active:shadow-[2px_2px_0_0_#000]",
        "active:translate-x-[2px] active:translate-y-[2px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Example 4: Consistent Spacing Pattern
// ============================================================================

export function ExampleSpacing() {
  return (
    <div className="space-y-4">
      {/* Consistent vertical spacing */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-3">Card 1</h3>
        <p className="text-muted-foreground">Content with consistent spacing</p>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-3">Card 2</h3>
        <p className="text-muted-foreground">Same spacing pattern</p>
      </Card>
    </div>
  );
}

// ============================================================================
// Example 5: Using Semantic Colors
// ============================================================================

export function ExampleSemanticColors() {
  return (
    <div className="space-y-4">
      <Button variant="default">Primary Action</Button>
      <Button variant="secondary">Secondary Action</Button>
      <Button variant="outline">Outline Button</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="ghost">Ghost Button</Button>
    </div>
  );
}

// ============================================================================
// Example 6: Responsive Design with Design System
// ============================================================================

export function ExampleResponsive() {
  return (
    <div className={cn(
      "bg-card text-card-foreground",
      "p-4 md:p-6 lg:p-8",  // Responsive padding
      "rounded-lg md:rounded-xl",  // Responsive border radius
      "border-2 border-black",
      "shadow-[4px_4px_0_0_#000] md:shadow-[8px_8px_0_0_#000]"  // Responsive shadow
    )}>
      <h2 className="text-xl md:text-2xl lg:text-3xl font-bold">
        Responsive Heading
      </h2>
      <p className="text-sm md:text-base mt-2">
        Content that adapts to screen size
      </p>
    </div>
  );
}

// ============================================================================
// Example 7: Animation with Design System
// ============================================================================

export function ExampleAnimation() {
  return (
    <div 
      className="fade-in"
      style={{
        transition: designSystem.animations.transitions.smooth,
      }}
    >
      <Card className="p-6 hover:scale-105 transition-transform duration-200">
        <h3 className="text-xl font-semibold">Animated Card</h3>
        <p className="text-muted-foreground mt-2">
          Hover to see scale animation
        </p>
      </Card>
    </div>
  );
}

// ============================================================================
// Example 8: Search Bar with Neobrutalist Design
// ============================================================================

export function ExampleSearchBar() {
  return (
    <div className="search-container">
      <div 
        className="search"
        style={{
          minHeight: designSystem.components.search.minHeight.default,
          padding: designSystem.components.search.padding.default,
          borderRadius: designSystem.components.search.borderRadius,
          border: designSystem.components.search.border,
          boxShadow: designSystem.components.search.shadow,
        }}
      >
        <input
          type="text"
          placeholder="Search..."
          className="search-bar-input"
          style={{
            fontSize: '14px', // Minimum 16px on mobile handled by index.css
          }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Example 9: Typography Scale
// ============================================================================

export function ExampleTypography() {
  return (
    <div className="space-y-4">
      <h1 className="text-4xl font-bold text-foreground">Heading 1</h1>
      <h2 className="text-3xl font-bold text-foreground">Heading 2</h2>
      <h3 className="text-2xl font-semibold text-foreground">Heading 3</h3>
      <h4 className="text-xl font-semibold text-foreground">Heading 4</h4>
      <p className="text-base text-foreground">Body text</p>
      <p className="text-sm text-muted-foreground">Small text</p>
      <p className="text-xs text-muted-foreground">Extra small text</p>
    </div>
  );
}

// ============================================================================
// Example 10: Complete Component with All Design System Elements
// ============================================================================

export function ExampleCompleteComponent() {
  return (
    <Card className={cn(
      "p-6",
      "border-2 border-black",
      "shadow-[8px_8px_0_0_#000]",
      "transition-all duration-200",
      "hover:shadow-[6px_6px_0_0_#000]"
    )}>
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Complete Example
          </h2>
          <p className="text-sm text-muted-foreground">
            Using all design system elements
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="default" size="default">
            Primary
          </Button>
          <Button variant="outline" size="default">
            Secondary
          </Button>
        </div>
        
        <div className="pt-4 border-t border-border">
          <p className="text-base text-foreground">
            This component demonstrates:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Consistent spacing (p-6, space-y-4, gap-3)</li>
            <li>Semantic colors (text-foreground, text-muted-foreground)</li>
            <li>Neobrutalist borders and shadows</li>
            <li>Typography scale (text-2xl, text-sm)</li>
            <li>Smooth transitions</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}



