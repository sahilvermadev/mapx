import React, { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { friendGroupsApi, type FriendGroup } from '@/services/friendGroupsService';

interface GroupFilterProps {
  currentUserId: string;
  selectedGroupIds: number[];
  onGroupToggle: (groupId: number) => void;
  onClearAll: () => void;
  className?: string;
}

const GroupFilter: React.FC<GroupFilterProps> = ({
  currentUserId,
  selectedGroupIds,
  onGroupToggle,
  onClearAll,
  className = ''
}) => {
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, [currentUserId]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const response = await friendGroupsApi.getUserGroups(currentUserId);
      if (response.success && response.data) {
        setGroups(response.data);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Friend Groups</h3>
        </div>
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded-md"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Friend Groups</h3>
        </div>
        <div className="text-center py-4 text-gray-500 text-sm">
          No groups available
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Friend Groups</h3>
        {selectedGroupIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear all
          </Button>
        )}
      </div>
      
      <div className="space-y-1">
        {groups.map((group) => {
          const isSelected = selectedGroupIds.includes(group.id);
          return (
            <Button
              key={group.id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onGroupToggle(group.id)}
              className={`w-full justify-start text-left h-auto p-2 ${
                isSelected 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-2 w-full">
                <span className="text-sm">{group.icon || '👥'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm font-medium truncate">
                      {group.name}
                    </span>
                    {group.role === 'admin' && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs opacity-75">
                    <span className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{group.member_count || 0}</span>
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <X className="h-3 w-3 ml-auto" />
                )}
              </div>
            </Button>
          );
        })}
      </div>
      
      {selectedGroupIds.length > 0 && (
        <div className="pt-2 border-t">
          <div className="flex flex-wrap gap-1">
            {selectedGroupIds.map((groupId) => {
              const group = groups.find(g => g.id === groupId);
              if (!group) return null;
              
              return (
                <Badge
                  key={groupId}
                  variant="secondary"
                  className="text-xs bg-blue-100 text-blue-800"
                >
                  <span className="mr-1">{group.icon || '👥'}</span>
                  {group.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-blue-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGroupToggle(groupId);
                    }}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupFilter;
