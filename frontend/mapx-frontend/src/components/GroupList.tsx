import React, { useState, useEffect } from 'react';
import GroupCardSkeleton from '@/components/skeletons/GroupCardSkeleton';
import { Users, Settings, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { friendGroupsApi, type FriendGroup } from '@/services/friendGroupsService';

interface GroupListProps {
  currentUserId: string;
  onGroupSelect?: (groupId: number) => void;
  selectedGroupIds?: number[];
  showActions?: boolean;
  onEditGroup?: (groupId: number) => void;
}

const GroupList: React.FC<GroupListProps> = ({
  currentUserId,
  onGroupSelect,
  selectedGroupIds = [],
  showActions = true,
  onEditGroup
}) => {
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, [currentUserId]);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await friendGroupsApi.getUserGroups(currentUserId);
      if (response && response.success && response.data) {
        setGroups(response.data);
      } else {
        setError('Failed to load groups');
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    try {
      await friendGroupsApi.deleteGroup(groupId, currentUserId);
      setGroups(prev => prev.filter(group => group.id !== groupId));
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const getInitials = (name: string): string => 
    name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <GroupCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={loadGroups} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No groups yet</h3>
        <p className="text-gray-500">Create your first friend group to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Card 
          key={group.id} 
          className={`cursor-pointer transition-transform rounded-md border-2 border-black bg-white shadow-[3px_3px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] ${
            selectedGroupIds.includes(group.id) ? 'ring-2 ring-offset-2 ring-black' : ''
          }`}
          onClick={() => onGroupSelect?.(group.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-md border border-black bg-white/90 shadow-[1px_1px_0_0_#000] text-lg">
                  {group.icon || '👥'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                    {group.role === 'admin' && (
                      <span className="text-xs rounded-none border-2 border-black px-1.5 py-0.5 shadow-[1px_1px_0_0_#000] bg-white">Admin</span>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-600 truncate mt-1">{group.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{group.member_count || 0} members</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 capitalize">{group.visibility}</span>
                  </div>
                </div>
              </div>
              
              {showActions && group.role === 'admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-md border-2 border-black shadow-[1px_1px_0_0_#000]">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditGroup?.(group.id); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Lens
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600 focus:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Lens
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default GroupList;
