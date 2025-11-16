import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEMES, type ThemeName } from '@/services/profileService';
import { useAuth } from '@/auth';
import { profileApi } from '@/services/profileService';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'mapx.theme';
const DEFAULT_BG_COLOR = '#ffffff'; // Default white background
const DEFAULT_TEXT_COLOR = '#000000'; // Default black text

function applyThemeToDocument(themeName: ThemeName, isLandingPage: boolean = false) {
  const root = document.documentElement;
  
  if (isLandingPage) {
    // Reset to defaults for landing page
    root.style.setProperty('--app-bg', DEFAULT_BG_COLOR);
    root.style.setProperty('--app-text', DEFAULT_TEXT_COLOR);
    root.style.setProperty('--app-accent', '');
    document.body.style.backgroundColor = DEFAULT_BG_COLOR;
    document.body.style.color = DEFAULT_TEXT_COLOR;
  } else {
    // Apply user theme for other pages
    const t = THEMES[themeName];
    root.style.setProperty('--app-bg', t.backgroundColor);
    root.style.setProperty('--app-text', t.textColor);
    root.style.setProperty('--app-accent', t.accentColor);
    document.body.style.backgroundColor = t.backgroundColor;
    document.body.style.color = t.textColor;
  }
}

/**
 * Check if current route is the landing page
 * Uses window.location instead of useLocation to avoid Router context dependency
 */
function isLandingPageRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname;
  return pathname === '/landing' || pathname === '/';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = (typeof window !== 'undefined') ? (localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null) : null;
    return stored && THEMES[stored] ? stored : 'monochrome';
  });

  // Load user's theme preference when they log in
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;

    const loadUserTheme = async () => {
      try {
        const prefs = await profileApi.getUserPreferences(user.id);
        
        // Check if component is still mounted and user is still authenticated
        if (cancelled) return;
        
        // Validate theme before applying
        if (prefs.theme && THEMES[prefs.theme]) {
          const validTheme = prefs.theme as ThemeName;
          setThemeState(validTheme);
          try {
            localStorage.setItem(THEME_STORAGE_KEY, validTheme);
          } catch (error) {
            console.warn('Failed to save theme to localStorage:', error);
          }
        }
      } catch (error) {
        // Only log error if component is still mounted
        if (!cancelled) {
          console.error('Failed to load user theme preference:', error);
        }
        // Fall back to stored theme or default (already set in initial state)
      }
    };

    loadUserTheme();

    // Cleanup: cancel async operation if component unmounts or dependencies change
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Apply theme and listen for route changes
  useEffect(() => {
    const updateThemeForRoute = () => {
      const isLanding = isLandingPageRoute();
      applyThemeToDocument(theme, isLanding);
    };
    
    // Apply theme on mount and when theme changes
    updateThemeForRoute();
    
    // Intercept pushState and replaceState to detect route changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      // Small delay to ensure pathname is updated
      setTimeout(updateThemeForRoute, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(updateThemeForRoute, 0);
    };
    
    // Listen to popstate for back/forward navigation
    window.addEventListener('popstate', updateThemeForRoute);
    
    // Listen to custom navigation events (React Router might emit)
    window.addEventListener('locationchange', updateThemeForRoute);
    
    return () => {
      // Restore original methods
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', updateThemeForRoute);
      window.removeEventListener('locationchange', updateThemeForRoute);
    };
  }, [theme]);

  const setTheme = useCallback((t: ThemeName) => {
    // Validate theme before setting
    if (!THEMES[t]) {
      console.warn(`Invalid theme: ${t}, falling back to default`);
      return;
    }
    
    // Only update state if theme actually changed (prevents unnecessary re-renders)
    setThemeState((prevTheme) => {
      if (prevTheme === t) {
        return prevTheme; // No change, return same reference
      }
      // Update localStorage when theme changes
      try {
        localStorage.setItem(THEME_STORAGE_KEY, t);
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error);
      }
      return t;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}


