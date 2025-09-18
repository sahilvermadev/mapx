import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Map, Users, Newspaper, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import RecommendationComposer from './RecommendationComposer';

// Types
interface HeaderProps {
  currentUserId?: string;
  showMapButton?: boolean;
  showProfileButton?: boolean;
  showDiscoverButton?: boolean;
  showLogoutButton?: boolean;
  showShareButton?: boolean;
  title?: string;
  variant?: 'default' | 'dark';
  mapButtonText?: string;
  mapButtonLink?: string;
  onLogout?: () => void;
  onRecommendationPosted?: () => void;
  profilePictureUrl?: string;
  displayName?: string;
}

type HeaderVariant = 'default' | 'dark';

// Constants
const DEFAULT_TITLE = 'RECCE';
const DEFAULT_MAP_BUTTON_TEXT = 'Explore places';
const DEFAULT_MAP_BUTTON_LINK = '/';
const DISCOVER_LINK = '/discover';

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

const getMapButtonIcon = (buttonText: string): React.ReactNode => {
  return buttonText === 'Feed' ? (
    <Newspaper className="h-4 w-4" />
  ) : (
    <Map className="h-4 w-4" />
  );
};

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
  showMapButton = true,
  showProfileButton = true,
  showDiscoverButton = true,
  showLogoutButton = false,
  showShareButton = true,
  title = DEFAULT_TITLE,
  variant = 'default',
  mapButtonText = DEFAULT_MAP_BUTTON_TEXT,
  mapButtonLink = DEFAULT_MAP_BUTTON_LINK,
  onLogout,
  onRecommendationPosted,
  profilePictureUrl,
  displayName,
}) => {
  const navigate = useNavigate();
  const buttonClasses = getButtonClasses(variant);
  const [showRecommendationComposer, setShowRecommendationComposer] = useState(false);

  const handleMapButtonClick = () => navigate(mapButtonLink);
  const handleDiscoverButtonClick = () => navigate(DISCOVER_LINK);
  const handleProfileButtonClick = () => navigate(`/profile/${currentUserId}`);
  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const handleRecommendationPosted = () => {
    setShowRecommendationComposer(false);
    if (onRecommendationPosted) {
      onRecommendationPosted();
    }
  };

  const proxiedAvatarSrc = getProxiedProfilePicture(profilePictureUrl);

  return (
    <header className={getHeaderClasses(variant)}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <h1 className={getTitleClasses(variant)}>
          {title}
        </h1>
        
        <div className="flex items-center gap-2">
          {showMapButton && (
            <Button 
              variant="ghost"
              size="sm" 
              onClick={handleMapButtonClick}
              className={`relative group ${buttonClasses}`}
            >
              {getMapButtonIcon(mapButtonText)}
              <span className="text-sm">{mapButtonText}</span>
            </Button>
          )}
          
          {showDiscoverButton && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDiscoverButtonClick}
              className={buttonClasses}
            >
              <Users className="h-4 w-4" />
              <span className="text-sm">Friends</span>
            </Button>
          )}

          {showShareButton && currentUserId && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/compose')}
              className={buttonClasses}
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm">Share</span>
            </Button>
          )}
          
          {/* Prefer avatar menu when we have a profile image */}
          {currentUserId && profilePictureUrl ? (
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
                  size="sm" 
                  onClick={handleProfileButtonClick}
                  className={buttonClasses}
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm">Profile</span>
                </Button>
              )}
              {showLogoutButton && onLogout && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogoutClick}
                  className={`${buttonClasses} text-red-500 hover:text-red-400 hover:bg-red-500/10`}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm">Logout</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal usage removed; composer now on its own route */}
    </header>
  );
};

export default Header; 