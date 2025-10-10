import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Map, Users, Newspaper, LogOut, Plus, Loader2 } from 'lucide-react';
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
  const baseClasses = 'sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60';
  
  return variant === 'dark'
    ? `${baseClasses} bg-black/80 border-white/20 text-white`
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

const getProxiedProfilePicture = (originalUrl?: string): string => {
  if (!originalUrl) return '';
  if (originalUrl.includes('googleusercontent.com')) {
    return `http://localhost:5000/auth/profile-picture?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
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

  const handleDiscoverButtonClick = () => navigate(DISCOVER_LINK);
  const handleProfileButtonClick = () => navigate(`/profile/${currentUserId}`);
  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const proxiedAvatarSrc = getProxiedProfilePicture(profilePictureUrl);

  const getNavClasses = (path: string) => {
    const isActive = path === '/map' ? location.pathname === '/map' : location.pathname.startsWith(path);
    // Ensure active color persists even on hover in dark variant where hover:text-white is applied
    return isActive
      ? `${buttonClasses} !text-yellow-200 hover:!text-yellow-200 focus:!text-yellow-200`
      : `${buttonClasses}`;
  };

  
  return (
    <header className={getHeaderClasses(variant)}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <h1 className={getTitleClasses(variant)}>
          {title}
        </h1>
        
        <div className="flex items-center gap-2">
          {isLoggingOut ? (
            // Show loading state during logout
            <div className="flex items-center gap-2 text-yellow-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Logging out...</span>
            </div>
          ) : (
            <>
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

              {/* Notifications */}
              {currentUserId && (
                <NotificationsBell currentUserId={currentUserId} variant={variant} />
              )}
            </>
          )}
          
          {/* User menu - only show when not logging out */}
          {!isLoggingOut && currentUserId && profilePictureUrl ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-full ml-3 mr-0 ${buttonClasses}`} aria-label="Profile menu">
                  <Avatar className="h-7 w-7 ">
                    <AvatarImage src={proxiedAvatarSrc} alt={displayName || 'Profile'} />
                    <AvatarFallback>{getInitials(displayName || currentUserId || '?')}</AvatarFallback>
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
            !isLoggingOut && (
              <>
                {showProfileButton && currentUserId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleProfileButtonClick}
                    className={buttonClasses}
                  >
                    <User className="h-4 w-4" />
                    <span className="text-sm">Profile</span>
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDiscoverButtonClick}
                  className={getNavClasses('/friends')}
                >
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Friends</span>
                </Button>
                {showLogoutButton && onLogout && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleLogoutClick}
                    className={`${buttonClasses} text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10`}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Logout</span>
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </div>

      {/* Modal usage removed; composer now on its own route */}
    </header>
  );
};

export default Header; 