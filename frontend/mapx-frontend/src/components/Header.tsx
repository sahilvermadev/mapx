import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Map, Users, Newspaper, LogOut, Plus, Loader2, Menu, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import NotificationsBell from '@/components/NotificationsBell';
import UnifiedFeedFilters from '@/components/SocialFeed/UnifiedFeedFilters';
import { useFeedFilters } from '@/contexts/FeedFiltersContext';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

// Types
interface HeaderProps {
  currentUserId?: string;
  showProfileButton?: boolean;
  showLogoutButton?: boolean;
  title?: string;
  variant?: 'default' | 'dark';
  onLogout?: () => void;
  profilePictureUrl?: string;
  displayName?: string;
  isLoggingOut?: boolean;
}

type HeaderVariant = 'default' | 'dark';

// Constants
const DEFAULT_TITLE = 'REKKY';
const DISCOVER_LINK = '/friends';

// Helper functions
const getHeaderClasses = (variant: HeaderVariant, themeName?: string): string => {
  const baseClasses = 'sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-none';
  
  if (variant === 'dark') {
    return `${baseClasses} bg-black border-white/20 text-white`;
  }
  
  // Use theme colors if available
  if (themeName && THEMES[themeName as keyof typeof THEMES]) {
    const theme = THEMES[themeName as keyof typeof THEMES];
    return `${baseClasses} border-border`;
  }
  
  return `${baseClasses} bg-background/95 border-border`;
};

const getTitleClasses = (variant: HeaderVariant, themeName?: string): string => {
  const baseClasses = 'flex items-center gap-2 text-xl font-semibold';
  
  if (variant === 'dark') {
    return `${baseClasses} text-white`;
  }
  
  // Check if theme is dark mode
  if (themeName === 'dark') {
    return `${baseClasses} text-white`;
  }
  
  return `${baseClasses} text-foreground`;
};

const getButtonClasses = (variant: HeaderVariant, themeName?: string): string => {
  if (variant === 'dark') {
    return 'text-white hover:bg-white/10 hover:text-white';
  }
  
  return '';
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

import { getProfilePictureUrl } from '@/config/apiConfig';

const getProxiedProfilePicture = (originalUrl?: string): string => {
  if (!originalUrl) return '';
  return getProfilePictureUrl(originalUrl) || originalUrl;
};

// Component
const Header: React.FC<HeaderProps> = ({
  currentUserId,
  showProfileButton = true,
  showLogoutButton = false,
  title = DEFAULT_TITLE,
  variant = 'default',
  onLogout,
  profilePictureUrl,
  displayName,
  isLoggingOut = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: themeName } = useTheme();
  const buttonClasses = getButtonClasses(variant, themeName);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mobileMenuOpen]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close user menu when route changes
  useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Reset dropdown opacity when menu opens
  useEffect(() => {
    if (userMenuOpen) {
      // Find dropdown content by data attribute and reset opacity/transition
      const dropdownContent = document.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
      if (dropdownContent) {
        dropdownContent.style.opacity = '';
        dropdownContent.style.pointerEvents = '';
        dropdownContent.style.transition = '';
      }
    }
  }, [userMenuOpen]);

  const handleDiscoverButtonClick = () => {
    // Hide dropdown content immediately to prevent blink
    const dropdownContent = document.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    if (dropdownContent) {
      dropdownContent.style.opacity = '0';
      dropdownContent.style.pointerEvents = 'none';
      dropdownContent.style.transition = 'opacity 0s';
    }
    // Close dropdown synchronously before navigation to prevent blink
    flushSync(() => {
      setUserMenuOpen(false);
    });
    // Navigate immediately after closing - no delay needed since menu is already hidden
    navigate(DISCOVER_LINK);
    setMobileMenuOpen(false);
  };
  const handleProfileButtonClick = () => {
    const startTime = performance.now();
    if (import.meta.env.DEV) {
      console.log('🚀 [PERF] Profile button clicked - starting navigation');
      performance.mark('profile-nav-start');
    }
    // Hide dropdown content immediately to prevent blink
    const dropdownContent = document.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    if (dropdownContent) {
      dropdownContent.style.opacity = '0';
      dropdownContent.style.pointerEvents = 'none';
      dropdownContent.style.transition = 'opacity 0s';
    }
    // Close dropdown synchronously before navigation to prevent blink
    flushSync(() => {
      setUserMenuOpen(false);
    });
    // Navigate immediately after closing - no delay needed since menu is already hidden
    navigate(`/profile/${currentUserId}`);
    setMobileMenuOpen(false);
    if (import.meta.env.DEV) {
      const navTime = performance.now() - startTime;
      console.log(`⏱️ [PERF] Navigation initiated in ${navTime.toFixed(2)}ms`);
    }
  };
  const handleLogoutClick = () => {
    // Close dropdown synchronously before logout
    flushSync(() => {
      setUserMenuOpen(false);
    });
    if (onLogout) {
      onLogout();
    }
    setMobileMenuOpen(false);
  };

  const proxiedAvatarSrc = getProxiedProfilePicture(profilePictureUrl);

  const getNavClasses = (path: string) => {
    const isActive = path === '/map' ? location.pathname === '/map' : location.pathname.startsWith(path);
    // Use theme accent color for active state, or fallback to a visible color
    if (isActive && theme) {
      // For active state, use accent color with inline style for better visibility
      return buttonClasses;
    }
    return buttonClasses;
  };
  
  const getActiveNavStyle = (path: string): React.CSSProperties | undefined => {
    const isActive = path === '/map' ? location.pathname === '/map' : location.pathname.startsWith(path);
    if (isActive && theme) {
      return {
        color: `${theme.accentColor} !important`,
      } as React.CSSProperties;
    }
    // Fallback for dark variant or no theme
    if (isActive && variant === 'dark') {
      return {
        color: '#FCD34D !important',
      } as React.CSSProperties;
    }
    return undefined;
  };
  
  const getActiveNavColor = (path: string): string | undefined => {
    const isActive = path === '/map' ? location.pathname === '/map' : location.pathname.startsWith(path);
    if (isActive && theme) {
      // For active state, use a color that contrasts with the header background
      // If accent color is too similar to header background, use textPrimary or a darker shade
      const headerBg = theme.headerBackground.toLowerCase();
      const accentColor = theme.accentColor.toLowerCase();
      
      // If accent color is too similar to header background (like yellow on yellow), use darker text
      if (headerBg === accentColor || 
          (headerBg.includes('ffd') && accentColor.includes('ffd')) || // Both yellow-ish
          (headerBg.includes('fff') && accentColor.includes('fff'))) { // Both white-ish
        return theme.textPrimary || theme.headerText;
      }
      return theme.accentColor;
    }
    if (isActive && variant === 'dark') {
      return '#FCD34D';
    }
    return undefined;
  };
  
  const getNavTextColor = (path: string): string | undefined => {
    // For non-active buttons, use buttonGhost text color or header text
    if (theme) {
      return theme.buttonGhost.text || theme.headerText;
    }
    return undefined;
  };

  const handleFeedClick = () => {
    const clickTime = performance.now();
    const timestamp = Date.now();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🖱️ [PERF] FEED BUTTON CLICKED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⏱️ [PERF] Click timestamp: ${timestamp} (${new Date(timestamp).toISOString()})`);
    
    // Store click time in sessionStorage for SocialFeedPage to read
    sessionStorage.setItem('feedClickTime', clickTime.toString());
    sessionStorage.setItem('feedClickTimestamp', timestamp.toString());
    
    if (location.pathname === '/feed') {
      console.log('🔄 [PERF] Already on feed page, reloading...');
      window.location.reload();
    } else {
      console.log('🚀 [PERF] Navigating to /feed...');
      navigate('/feed');
    }
    setMobileMenuOpen(false);
  };

  const handleNavClick = (path: string) => {
    if (path === '/feed') {
      handleFeedClick();
    } else {
      navigate(path);
      setMobileMenuOpen(false);
    }
  };

  // Get feed filters context when on feed page
  const feedFilters = useFeedFilters();
  const isFeedPage = location.pathname === '/feed';
  const showFeedFilters = isFeedPage && feedFilters && !feedFilters.hasActiveSearch;
  const headerRef = useRef<HTMLElement>(null);

  // Get theme colors
  const theme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  
  // Header styling based on variant and theme
  const headerStyle: React.CSSProperties | undefined = variant === 'dark' 
    ? undefined // Use default dark styling from classes
    : theme 
      ? {
          backgroundColor: theme.headerBackground,
          color: theme.headerText,
          borderColor: theme.headerBorder === 'transparent' ? 'transparent' : theme.headerBorder,
        }
      : undefined;

  // Update CSS variable for header height when it changes
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight;
      document.documentElement.style.setProperty('--header-height', `${height}px`);
    }
  }, [showFeedFilters, mobileMenuOpen]);

  

  return (
    <header 
      ref={headerRef} 
      className={getHeaderClasses(variant, themeName)}
      style={headerStyle}
    >
      <div className="w-full px-3 md:px-6 h-16 flex items-center justify-between relative">
        {/* Left: Title + Mobile Menu Button */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile menu button */}
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            style={{
              color: theme?.buttonGhost.text || theme?.headerText || (variant === 'dark' ? '#FFFFFF' : '#000000'),
            }}
            onMouseEnter={(e) => {
              if (theme) {
                e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
              } else if (variant === 'dark') {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#FFFFFF';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme?.buttonGhost.text || theme?.headerText || (variant === 'dark' ? '#FFFFFF' : '#000000');
            }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" style={{ color: 'inherit' }} /> : <Menu className="h-5 w-5" style={{ color: 'inherit' }} />}
          </Button>
          
          {currentUserId ? (
            <button
              onClick={() => {
                if (location.pathname === '/feed') {
                  // Refresh the page if already on feed
                  window.location.reload();
                } else {
                  navigate('/feed');
                }
              }}
              className={`${getTitleClasses(variant, themeName)} cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0`}
              style={themeName === 'dark' ? { color: '#FFFFFF' } : theme ? { color: theme.headerText } : undefined}
              aria-label="Go to feed"
            >
              {title}
            </button>
          ) : (
            <h1 
              className={getTitleClasses(variant, themeName)}
              style={themeName === 'dark' ? { color: '#FFFFFF' } : theme ? { color: theme.headerText } : undefined}
            >
              {title}
            </h1>
          )}
        </div>

        {/* Center: Primary nav - Desktop only */}
        <div className="hidden md:flex items-center justify-center gap-2 absolute left-1/2 transform -translate-x-1/2">
              {/* Recommend */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/compose')}
                className={getNavClasses('/compose')}
                style={{
                  color: getActiveNavColor('/compose') || getNavTextColor('/compose') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
                }}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                    e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                  } else if (variant === 'dark') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = getActiveNavColor('/compose') || getNavTextColor('/compose') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
                }}
              >
                <Plus className="h-4 w-4" style={{ color: 'inherit' }} />
                <span className="text-sm" style={{ color: 'inherit' }}>Rec</span>
              </Button>

              {/* Feed */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleFeedClick}
                className={getNavClasses('/feed')}
                style={{
                  color: getActiveNavColor('/feed') || getNavTextColor('/feed') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
                }}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                    e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                  } else if (variant === 'dark') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = getActiveNavColor('/feed') || getNavTextColor('/feed') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
                }}
              >
                <Newspaper className="h-4 w-4" style={{ color: 'inherit' }} />
                <span className="text-sm" style={{ color: 'inherit' }}>Feed</span>
              </Button>

              {/* Map */}
              <Button 
                variant="ghost"
                size="sm" 
                onClick={() => navigate('/map')}
                className={`relative group ${getNavClasses('/map')}`}
                style={{
                  color: getActiveNavColor('/map') || getNavTextColor('/map') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
                }}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                    e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                  } else if (variant === 'dark') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = getActiveNavColor('/map') || getNavTextColor('/map') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
                }}
              >
                <Map className="h-4 w-4" style={{ color: 'inherit' }} />
                <span className="text-sm" style={{ color: 'inherit' }}>Map</span>
              </Button>

              {/* Ask */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/ask')}
                className={getNavClasses('/ask')}
                style={{
                  color: getActiveNavColor('/ask') || getNavTextColor('/ask') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
                }}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                    e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                  } else if (variant === 'dark') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = getActiveNavColor('/ask') || getNavTextColor('/ask') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
                }}
              >
                <HelpCircle className="h-4 w-4" style={{ color: 'inherit' }} />
                <span className="text-sm" style={{ color: 'inherit' }}>Ask</span>
              </Button>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center justify-end gap-1 md:gap-2 min-w-0">
          {isLoggingOut ? (
            <div 
              className="flex items-center gap-2"
              style={theme ? { color: theme.accentColor } : variant === 'dark' ? { color: '#FCD34D' } : undefined}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline text-sm">Logging out...</span>
            </div>
          ) : (
            <>
              {currentUserId && (
                <NotificationsBell currentUserId={currentUserId} variant={variant} />
          )}
          
          {/* User menu - only show when not logging out */}
              {currentUserId && profilePictureUrl ? (
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full" 
                  style={{
                    color: theme?.buttonGhost.text || theme?.headerText || (variant === 'dark' ? '#FFFFFF' : '#000000'),
                  }}
                  onMouseEnter={(e) => {
                    if (theme) {
                      e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                    } else if (variant === 'dark') {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  aria-label="Profile menu"
                >
                  <Avatar className="h-8 w-8 md:h-7 md:w-7">
                    <AvatarImage src={proxiedAvatarSrc} alt={displayName || 'Profile'} />
                    <AvatarFallback className="text-xs">{getInitials(displayName || currentUserId || '?')}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56"
              >
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    handleProfileButtonClick();
                  }}
                >
                  <User className="h-4 w-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={(e) => {
                    e.preventDefault();
                    handleDiscoverButtonClick();
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Friends
                </DropdownMenuItem>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onSelect={(e) => {
                        e.preventDefault();
                        handleLogoutClick();
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Fallback to simple buttons if avatar is not available
              <>
                {showProfileButton && currentUserId && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={`${buttonClasses}`}
                    onClick={handleProfileButtonClick}
                    aria-label="Profile"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline text-sm ml-1">Profile</span>
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`${getNavClasses('/friends')}`}
                  onClick={handleDiscoverButtonClick}
                  aria-label="Friends"
                  style={{
                    color: getActiveNavColor('/friends') || getNavTextColor('/friends') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
                  }}
                  onMouseEnter={(e) => {
                    if (theme) {
                      e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                      e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                    } else if (variant === 'dark') {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = getActiveNavColor('/friends') || getNavTextColor('/friends') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
                  }}
                >
                  <Users className="h-4 w-4" style={{ color: 'inherit' }} />
                  <span className="hidden md:inline text-sm ml-1" style={{ color: 'inherit' }}>Friends</span>
                </Button>
                {showLogoutButton && onLogout && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={buttonClasses}
                    onClick={handleLogoutClick}
                    aria-label="Logout"
                    style={theme ? { 
                      color: theme.textSecondary || theme.textPrimary,
                    } : variant === 'dark' ? { 
                      color: '#F87171' 
                    } : { 
                      color: '#DC2626' 
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden md:inline text-sm ml-1">Logout</span>
                  </Button>
                )}
              </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div 
          ref={mobileMenuRef}
          className={`md:hidden absolute top-16 left-0 right-0 z-50 border-t ${
            variant === 'dark' ? 'bg-black border-white/20' : 'bg-background border-border'
          } shadow-lg`}
        >
          <div className="px-4 py-3 space-y-2">
            {/* Recommend */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/compose')}`}
              onClick={() => handleNavClick('/compose')}
              style={{
                color: getActiveNavColor('/compose') || getNavTextColor('/compose') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
              }}
              onMouseEnter={(e) => {
                if (theme) {
                  e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                } else if (variant === 'dark') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = getActiveNavColor('/compose') || getNavTextColor('/compose') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
              }}
            >
              <Plus className="h-4 w-4 mr-3" style={{ color: 'inherit' }} />
              <span style={{ color: 'inherit' }}>Recommend</span>
            </Button>

            {/* Feed */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/feed')}`}
              onClick={() => handleNavClick('/feed')}
              style={{
                color: getActiveNavColor('/feed') || getNavTextColor('/feed') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
              }}
              onMouseEnter={(e) => {
                if (theme) {
                  e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                } else if (variant === 'dark') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = getActiveNavColor('/feed') || getNavTextColor('/feed') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
              }}
            >
              <Newspaper className="h-4 w-4 mr-3" style={{ color: 'inherit' }} />
              <span style={{ color: 'inherit' }}>Feed</span>
            </Button>

            {/* Map */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/map')}`}
              onClick={() => handleNavClick('/map')}
              style={{
                color: getActiveNavColor('/map') || getNavTextColor('/map') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
              }}
              onMouseEnter={(e) => {
                if (theme) {
                  e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                } else if (variant === 'dark') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = getActiveNavColor('/map') || getNavTextColor('/map') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
              }}
            >
              <Map className="h-4 w-4 mr-3" style={{ color: 'inherit' }} />
              <span style={{ color: 'inherit' }}>Map</span>
            </Button>

            {/* Ask */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/ask')}`}
              onClick={() => handleNavClick('/ask')}
              style={{
                color: getActiveNavColor('/ask') || getNavTextColor('/ask') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
              }}
              onMouseEnter={(e) => {
                if (theme) {
                  e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                } else if (variant === 'dark') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = getActiveNavColor('/ask') || getNavTextColor('/ask') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
              }}
            >
              <HelpCircle className="h-4 w-4 mr-3" style={{ color: 'inherit' }} />
              <span style={{ color: 'inherit' }}>Ask</span>
            </Button>

            {/* Separator */}
            <div className={`h-px my-2 ${variant === 'dark' ? 'bg-white/20' : 'bg-border'}`} />

            {/* Profile */}
            {showProfileButton && currentUserId && (
              <Button
                variant="ghost"
                className="w-full justify-start"
                style={{
                  color: theme?.buttonGhost.text || theme?.headerText || (variant === 'dark' ? '#FFFFFF' : '#000000'),
                }}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                    e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                  } else if (variant === 'dark') {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme?.buttonGhost.text || theme?.headerText || (variant === 'dark' ? '#FFFFFF' : '#000000');
                }}
                onClick={handleProfileButtonClick}
              >
                <User className="h-4 w-4 mr-3" style={{ color: 'inherit' }} />
                <span style={{ color: 'inherit' }}>My Profile</span>
              </Button>
            )}

            {/* Friends */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/friends')}`}
              onClick={handleDiscoverButtonClick}
              style={{
                color: getActiveNavColor('/friends') || getNavTextColor('/friends') || (theme?.buttonGhost.text || theme?.headerText || '#000000'),
              }}
              onMouseEnter={(e) => {
                if (theme) {
                  e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  e.currentTarget.style.color = theme.buttonGhost.text || theme.headerText;
                } else if (variant === 'dark') {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = getActiveNavColor('/friends') || getNavTextColor('/friends') || (theme?.buttonGhost.text || theme?.headerText || '#000000');
              }}
            >
              <Users className="h-4 w-4 mr-3" style={{ color: 'inherit' }} />
              <span style={{ color: 'inherit' }}>Friends</span>
            </Button>

            {/* Logout */}
            {showLogoutButton && onLogout && (
              <>
                <div className={`h-px my-2 ${variant === 'dark' ? 'bg-white/20' : 'bg-border'}`} />
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${buttonClasses} text-red-600 hover:text-red-500 hover:bg-red-500/10`}
                  onClick={handleLogoutClick}
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Feed Filters - only on feed page when not in active search */}
      {showFeedFilters && feedFilters && (
        <div 
          className="w-full"
          style={variant === 'dark' 
            ? {
                backgroundColor: '#000000',
              }
            : theme 
              ? {
                  // Use the same header background
                  backgroundColor: theme.headerBackground,
                }
              : {
                  backgroundColor: 'var(--background)',
                }}
        >
          <div className="w-full px-3 md:px-6 py-2" style={theme ? { maxWidth: '100%' } : undefined}>
            <UnifiedFeedFilters
              cities={feedFilters.cities}
              selectedCityId={feedFilters.selectedCityId}
              selectedCityName={feedFilters.selectedCityName}
              globalSummary={feedFilters.globalSummary}
              onSelectCity={feedFilters.onSelectCity}
              selectedCategoryKeys={feedFilters.selectedCategoryKeys}
              onToggleCategory={feedFilters.onToggleCategory}
              overrideCategories={feedFilters.overrideCategories}
              isAuthenticated={feedFilters.isAuthenticated}
              onStream={feedFilters.onStream}
              onCleared={feedFilters.onCleared}
              searchPlaceholder={feedFilters.searchPlaceholder}
              currentUserId={feedFilters.currentUserId}
              selectedGroupIds={feedFilters.selectedGroupIds}
              onGroupToggle={feedFilters.onGroupToggle}
            />
          </div>
        </div>
      )}

    </header>
  );
};

export default Header; 