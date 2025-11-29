import React from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu';
import FilterButton from './FilterButton';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import type { FriendGroup } from '@/services/friendGroupsService';

interface GroupsDropdownProps {
  groups: FriendGroup[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  loading?: boolean;
  className?: string;
}

const GroupsDropdown: React.FC<GroupsDropdownProps> = ({
  groups,
  selectedIds,
  onToggle,
  loading = false,
  className = '',
}) => {
  const { theme: themeName } = useTheme();
  const theme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;

  // Don't render if loading or no groups
  if (loading || groups.length === 0) {
    return null;
  }

  const isActive = selectedIds.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterButton
          icon={<Users className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={1.5} />}
          ariaLabel="Friend groups"
          isActive={isActive}
          activeCount={selectedIds.length}
          totalCount={groups.length}
          className={className}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        side="bottom"
        sideOffset={4}
        className="w-56 p-2 border z-50"
        style={theme ? {
          backgroundColor: theme.cardBackground,
          borderColor: theme.borderColorMuted,
        } : {
          backgroundColor: '#FFFFFF',
          borderColor: 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="max-h-[60vh] overflow-y-auto pr-1" role="listbox" aria-label="Friend groups">
          {groups.map(group => {
            const active = selectedIds.includes(group.id);
            return (
              <DropdownMenuItem 
                key={group.id} 
                onSelect={() => {
                  onToggle(group.id);
                }}
                className="cursor-pointer"
                style={theme ? {
                  color: theme.textPrimary || '#000000',
                } : undefined}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.hoverBackground || theme.buttonGhost.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div className={`inline-flex items-center gap-2 text-xs md:text-sm ${active ? 'font-medium' : ''}`}>
                  <span 
                    className="inline-block h-2 w-2 rounded-full"
                    style={active 
                      ? { backgroundColor: theme?.accentColor || '#000000' }
                      : { backgroundColor: theme?.borderColorMuted || '#D1D5DB' }
                    }
                  />
                  <span style={{ color: theme?.textPrimary || '#000000' }}>{group.name}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
        {selectedIds.length > 0 && (
          <>
            <DropdownMenuSeparator 
              style={{ 
                backgroundColor: theme?.borderColorMuted || theme?.borderColor || 'rgba(0, 0, 0, 0.1)' 
              }} 
            />
            <div className="px-2 py-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full" 
                onClick={() => {
                  selectedIds.forEach(id => onToggle(id));
                }}
                style={theme ? {
                  color: theme.buttonGhost.text || theme.textPrimary || '#000000',
                } : undefined}
                onMouseEnter={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = theme.buttonGhost.hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                Clear filters
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GroupsDropdown;

