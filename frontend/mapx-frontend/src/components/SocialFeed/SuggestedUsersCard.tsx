import React from 'react';
import { Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

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
}

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export const SuggestedUsersCard: React.FC<SuggestedUsersCardProps> = ({ users, onFollow, onViewAll }) => {
  return (
    <div className="rounded-none overflow-hidden border-2 border-black bg-white shadow-[8px_8px_0_0_#000]">
      <div className="flex items-center gap-2 p-3 bg-pink-200 border-b-2 border-black">
        <Sparkles className="h-4 w-4" />
        <div className="font-semibold">Suggested Users</div>
      </div>

      <div className="p-4 space-y-4">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No suggestions available</p>
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
                <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{user.display_name}</div>
                <div className="text-xs text-muted-foreground">{user.followers_count || 0} followers</div>
              </div>
              <Button
                variant={user.is_following ? 'outline' : 'default'}
                size="sm"
                onClick={() => onFollow(user.id)}
                disabled={user.is_following}
                className="rounded-none border-2 border-black shadow-[3px_3px_0_0_#000]"
              >
                {user.is_following ? 'Following' : 'Follow'}
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t-2 border-black">
        <Button
          variant="ghost"
          size="sm"
          className="w-full rounded-none border-2 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]"
          onClick={onViewAll}
        >
          View All Users
        </Button>
      </div>
    </div>
  );
};

export default SuggestedUsersCard;


