import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Map, Users, Newspaper, LogOut, Plus, Loader2, Menu, X } from 'lucide-react';
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
const DEFAULT_TITLE = 'RECCE';
const DISCOVER_LINK = '/friends';

// Helper functions
const getHeaderClasses = (variant: HeaderVariant): string => {
  const baseClasses = 'sticky top-0 z-50 w-full backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-none';
  
  return variant === 'dark'
    ? `${baseClasses} bg-black border-white/20 text-white`
    : `${baseClasses} bg-background/95 border-border`;
};

const getTitleClasses = (variant: HeaderVariant): string => {
  const baseClasses = 'flex items-center gap-2 text-xl font-semibold';
  
  return variant === 'dark'
    ? `${baseClasses} text-white`
    : `${baseClasses} text-foreground`;
};

const getButtonClasses = (variant: HeaderVariant): string => {
  return variant === 'dark'
    ? 'text-white hover:bg-white/10 hover:text-white'
    : '';
};

// No dynamic icon helper needed; we always render explicit icons for each nav item.

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
  const buttonClasses = getButtonClasses(variant);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const handleDiscoverButtonClick = () => {
    navigate(DISCOVER_LINK);
    setMobileMenuOpen(false);
  };
  const handleProfileButtonClick = () => {
    navigate(`/profile/${currentUserId}`);
    setMobileMenuOpen(false);
  };
  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    }
    setMobileMenuOpen(false);
  };

  const proxiedAvatarSrc = getProxiedProfilePicture(profilePictureUrl);

  const getNavClasses = (path: string) => {
    const isActive = path === '/map' ? location.pathname === '/map' : location.pathname.startsWith(path);
    // Ensure active color persists even on hover in dark variant where hover:text-white is applied
    return isActive
      ? `${buttonClasses} !text-yellow-200 hover:!text-yellow-200 focus:!text-yellow-200`
      : `${buttonClasses}`;
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  
  return (
    <header className={getHeaderClasses(variant)}>
      <div className="w-full px-3 md:px-6 h-16 flex items-center justify-between relative">
        {/* Left: Title + Mobile Menu Button */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile menu button */}
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className={`md:hidden h-9 w-9 ${buttonClasses}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          
          {currentUserId ? (
            <button
              onClick={() => navigate('/feed')}
              className={`${getTitleClasses(variant)} cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0`}
              aria-label="Go to feed"
            >
              {title}
            </button>
          ) : (
            <h1 className={getTitleClasses(variant)}>
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
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Rec</span>
              </Button>

              {/* Feed */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/feed')}
                className={getNavClasses('/feed')}
              >
                <Newspaper className="h-4 w-4" />
                <span className="text-sm">Feed</span>
              </Button>

              {/* Map */}
              <Button 
                variant="ghost"
                size="sm" 
                onClick={() => navigate('/map')}
                className={`relative group ${getNavClasses('/map')}`}
              >
                <Map className="h-4 w-4" />
                <span className="text-sm">Map</span>
              </Button>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center justify-end gap-1 md:gap-2 min-w-0">
          {isLoggingOut ? (
            <div className="flex items-center gap-2 text-yellow-200">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-full ${buttonClasses}`} aria-label="Profile menu">
                  <Avatar className="h-8 w-8 md:h-7 md:w-7">
                    <AvatarImage src={proxiedAvatarSrc} alt={displayName || 'Profile'} />
                    <AvatarFallback className="text-xs">{getInitials(displayName || currentUserId || '?')}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleProfileButtonClick}>
                  <User className="h-4 w-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDiscoverButtonClick}>
                  <Users className="h-4 w-4 mr-2" />
                  Friends
                </DropdownMenuItem>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogoutClick} className="text-red-600 focus:text-red-600">
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
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden md:inline text-sm ml-1">Friends</span>
                </Button>
                {showLogoutButton && onLogout && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className={`${buttonClasses} text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10`}
                    onClick={handleLogoutClick}
                    aria-label="Logout"
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
            >
              <Plus className="h-4 w-4 mr-3" />
              Recommend
            </Button>

            {/* Feed */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/feed')}`}
              onClick={() => handleNavClick('/feed')}
            >
              <Newspaper className="h-4 w-4 mr-3" />
              Feed
            </Button>

            {/* Map */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/map')}`}
              onClick={() => handleNavClick('/map')}
            >
              <Map className="h-4 w-4 mr-3" />
              Map
            </Button>

            {/* Separator */}
            <div className={`h-px my-2 ${variant === 'dark' ? 'bg-white/20' : 'bg-border'}`} />

            {/* Profile */}
            {showProfileButton && currentUserId && (
              <Button
                variant="ghost"
                className={`w-full justify-start ${buttonClasses}`}
                onClick={handleProfileButtonClick}
              >
                <User className="h-4 w-4 mr-3" />
                My Profile
              </Button>
            )}

            {/* Friends */}
            <Button
              variant="ghost"
              className={`w-full justify-start ${getNavClasses('/friends')}`}
              onClick={handleDiscoverButtonClick}
            >
              <Users className="h-4 w-4 mr-3" />
              Friends
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
    </header>
  );
};

export default Header; 