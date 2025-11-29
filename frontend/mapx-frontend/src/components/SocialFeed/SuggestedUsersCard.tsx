import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';

type User = {
  id: string;
  display_name: string;
  profile_picture_url?: string;
  followers_count?: number;
  is_following?: boolean;
};

interface SuggestedUsersCardProps {
  users: User[];
  onFollow: (userId: string) => void;
  onViewAll: () => void;
  onClose?: () => void;
}

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export const SuggestedUsersCard: React.FC<SuggestedUsersCardProps> = ({ users, onFollow, onViewAll, onClose }) => {
  const { theme: themeName } = useTheme();
  const theme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  return (
    <div 
      className="rounded-none overflow-hidden border-2 shadow-[8px_8px_0_0_#000]"
      style={{
        backgroundColor: theme?.cardBackground || '#FFFFFF',
        borderColor: theme?.borderColor || '#000000',
      }}
    >
      <div 
        className="flex items-center justify-between p-3 border-b-2"
        style={{
          backgroundColor: theme?.headerBackground || '#FBCFE8',
          borderColor: theme?.borderColor || '#000000',
          color: theme?.headerText || '#000000',
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <div className="font-semibold">Suggested Users</div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 rounded-none border-2 shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_#000]"
            style={{
              borderColor: theme?.borderColor || '#000000',
              backgroundColor: 'transparent',
              color: theme?.headerText || '#000000',
            }}
            onMouseEnter={(e) => {
              if (theme) {
                e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Close suggested users"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4" style={{ color: theme?.textPrimary || '#000000' }}>
        {users.length === 0 ? (
          <p 
            className="text-sm text-center py-2"
            style={{ color: theme?.textMuted || '#6B7280' }}
          >
            No suggestions available
          </p>
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
                <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div 
                  className="font-medium text-sm truncate"
                  style={{ color: theme?.textPrimary || '#000000' }}
                >
                  {user.display_name}
                </div>
                <div 
                  className="text-xs"
                  style={{ color: theme?.textMuted || '#6B7280' }}
                >
                  {user.followers_count || 0} followers
                </div>
              </div>
              <Button
                variant={user.is_following ? 'outline' : 'default'}
                size="sm"
                onClick={() => onFollow(user.id)}
                disabled={user.is_following}
                className="rounded-none border-2 shadow-[3px_3px_0_0_#000]"
                style={user.is_following ? {
                  borderColor: theme?.borderColor || '#000000',
                  backgroundColor: 'transparent',
                  color: theme?.textPrimary || '#000000',
                } : theme ? {
                  backgroundColor: theme.buttonPrimary.background,
                  color: theme.buttonPrimary.text,
                  borderColor: theme.borderColor,
                } : {
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  borderColor: '#000000',
                }}
                onMouseEnter={(e) => {
                  if (!user.is_following && theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonPrimary.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!user.is_following && theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonPrimary.background;
                  }
                }}
              >
                {user.is_following ? 'Following' : 'Follow'}
              </Button>
            </div>
          ))
        )}
      </div>

      <div 
        className="p-4 border-t-2"
        style={{ borderColor: theme?.borderColor || '#000000' }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="w-full rounded-none border-2 shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]"
          style={{
            borderColor: theme?.borderColor || '#000000',
            backgroundColor: 'transparent',
            color: theme?.textPrimary || '#000000',
          }}
          onMouseEnter={(e) => {
            if (theme) {
              e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          onClick={onViewAll}
        >
          View All Users
        </Button>
      </div>
    </div>
  );
};

export default SuggestedUsersCard;


