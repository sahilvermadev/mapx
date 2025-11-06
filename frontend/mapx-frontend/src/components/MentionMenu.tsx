import React from 'react';

interface MentionMenuProps {
  show: boolean;
  suggestions: any[];
  position: { top: number; left: number } | null;
  onSelect: (user: any) => void;
}

export const MentionMenu: React.FC<MentionMenuProps> = ({
  show,
  suggestions,
  position,
  onSelect
}) => {
  if (!show || !position || suggestions.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed z-50 w-64 rounded-md border bg-popover text-popover-foreground shadow-md" 
      style={{ top: position.top, left: position.left }}
    >
      {suggestions.map((user) => (
        <button
          key={user.id}
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
          onClick={() => onSelect(user)}
        >
          {user.profile_picture_url && (
            <img src={user.profile_picture_url} className="h-6 w-6 rounded-full" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium">{user.display_name || user.user_name}</span>
            {user.username && (
              <span className="text-xs text-muted-foreground">@{user.username}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export default MentionMenu;
