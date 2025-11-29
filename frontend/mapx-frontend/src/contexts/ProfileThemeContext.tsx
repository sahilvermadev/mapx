import React, { createContext, useContext, ReactNode, useState, useCallback, useMemo } from 'react';
import { THEMES, type ThemeName } from '@/services/profileService';

interface ProfileThemeContextValue {
  profileTheme: ThemeName | null;
  profileThemeObject: ReturnType<typeof THEMES[ThemeName]> | null;
  setProfileTheme: (themeName: ThemeName | null) => void;
}

const ProfileThemeContext = createContext<ProfileThemeContextValue | undefined>(undefined);

/**
 * Provider component that manages the theme of the profile being viewed.
 * 
 * When viewing someone else's profile, their theme is stored here and can be accessed
 * by components like Header, FeedPost, etc. to display UI elements using the profile
 * owner's theme instead of the viewer's theme.
 * 
 * This provider should wrap the entire app (in App.tsx) so that all components can
 * access the profile theme when needed.
 * 
 * @example
 * ```tsx
 * <ProfileThemeProvider>
 *   <App />
 * </ProfileThemeProvider>
 * ```
 */
export const ProfileThemeProvider: React.FC<{ 
  children: ReactNode; 
}> = ({ children }) => {
  const [profileTheme, setProfileThemeState] = useState<ThemeName | null>(null);
  
  // Memoize theme object computation to avoid recalculating on every render
  const profileThemeObject = useMemo(() => 
    profileTheme && THEMES[profileTheme] ? THEMES[profileTheme] : null,
    [profileTheme]
  );
  
  const setProfileTheme = useCallback((themeName: ThemeName | null) => {
    setProfileThemeState(themeName);
  }, []);
  
  return (
    <ProfileThemeContext.Provider value={{ profileTheme, profileThemeObject, setProfileTheme }}>
      {children}
    </ProfileThemeContext.Provider>
  );
};

/**
 * Hook to access the profile theme context.
 * 
 * Returns the theme of the profile being viewed (if any) and a function to set it.
 * Components should check for `profileTheme` first, and if it exists, use `profileThemeObject`
 * instead of the viewer's theme. This allows UI elements to display using the profile
 * owner's theme when viewing their profile.
 * 
 * @returns An object containing:
 *   - `profileTheme`: The theme name of the profile being viewed, or null
 *   - `profileThemeObject`: The theme object, or null
 *   - `setProfileTheme`: Function to set the profile theme (typically called by ProfilePage)
 * 
 * @example
 * ```tsx
 * const { profileTheme, profileThemeObject } = useProfileTheme();
 * const { theme: userTheme } = useTheme();
 * 
 * // Use profile theme if available, otherwise use viewer's theme
 * const theme = profileThemeObject || THEMES[userTheme];
 * ```
 */
export function useProfileTheme() {
  const ctx = useContext(ProfileThemeContext);
  return ctx || { profileTheme: null, profileThemeObject: null, setProfileTheme: () => {} };
}
