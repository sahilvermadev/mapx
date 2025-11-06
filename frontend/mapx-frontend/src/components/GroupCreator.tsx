import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendGroupsApi, type CreateGroupData, type UpdateGroupData, type FriendGroupMember } from '@/services/friendGroupsService';
import { socialApi, type User } from '@/services/socialService';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';

interface GroupCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated?: () => void;
  onGroupUpdated?: () => void;
  currentUserId: string;
  editingGroupId?: number;
}

const GroupCreator: React.FC<GroupCreatorProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
  onGroupUpdated,
  currentUserId,
  editingGroupId
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('👥');
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]); // People to add
  const [currentMembers, setCurrentMembers] = useState<FriendGroupMember[]>([]); // Current lens members (for edit mode)
  const [originalMemberIds, setOriginalMemberIds] = useState<Set<string>>(new Set()); // Original member IDs when editing started
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme support
  const { theme } = useTheme();
  const selectedTheme = THEMES[theme];
  const accentColor = selectedTheme.accentColor;
  const textOnAccent = getReadableTextColor(accentColor);

  // Load friends when component opens and prefill when editing
  useEffect(() => {
    if (isOpen) {
      loadFriends();
      if (editingGroupId) {
        prefillGroup(editingGroupId);
      } else {
        // reset when switching from edit to create
        setName('');
        setDescription('');
        setIcon('👥');
        setSelectedFriends([]);
      }
    }
  }, [isOpen, currentUserId, editingGroupId]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const response = await socialApi.getFollowing(currentUserId, currentUserId, 50, 0);
      if (response.success && response.data) {
        setFriends(Array.isArray(response.data) ? response.data : response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setFriendsLoading(false);
    }
  };

  const prefillGroup = async (groupId: number) => {
    setMembersLoading(true);
    try {
      const res = await friendGroupsApi.getGroupDetails(groupId, currentUserId);
      if (res.success && res.data) {
        const g = res.data.group;
        setName(g.name || '');
        setDescription(g.description || '');
        setIcon(g.icon || '👥');
        // Store current members and original member IDs
        const members = res.data.members || [];
        setCurrentMembers(members);
        setOriginalMemberIds(new Set(members.map(m => m.user_id)));
        // Don't set selectedFriends - those are for adding new people
        setSelectedFriends([]);
      }
    } catch (e) {
      console.error('Failed to prefill group', e);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const groupData: CreateGroupData = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        visibility: 'private', // All lenses are private
        memberIds: selectedFriends
      };

      await friendGroupsApi.createGroup(groupData, currentUserId);
      onGroupCreated?.();
      handleClose();
    } catch (error: any) {
      console.error('Failed to create group:', error);
      // Extract error message from the API response
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create group. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroupId) return;
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Update group metadata
      const update: UpdateGroupData = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon
      };
      await friendGroupsApi.updateGroup(editingGroupId, update, currentUserId);
      
      // Handle member changes
      const currentMemberIds = new Set(currentMembers.map(m => m.user_id));
      
      // Add new members (people in selectedFriends but not in original members)
      const newMembers = selectedFriends.filter(id => !originalMemberIds.has(id));
      if (newMembers.length > 0) {
        await friendGroupsApi.addGroupMembers(editingGroupId, newMembers, currentUserId);
      }
      
      // Remove members that were in original but are not in current members anymore
      const membersToRemove = Array.from(originalMemberIds).filter(id => !currentMemberIds.has(id));
      for (const memberId of membersToRemove) {
        await friendGroupsApi.removeGroupMember(editingGroupId, memberId, currentUserId);
      }
      
      onGroupUpdated?.();
      handleClose();
    } catch (error: any) {
      console.error('Failed to update group:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update group. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIcon('👥');
    setSelectedFriends([]);
    setCurrentMembers([]);
    setOriginalMemberIds(new Set());
    setError(null);
    onClose();
  };
  
  const handleRemoveMember = (memberId: string) => {
    setCurrentMembers(prev => prev.filter(m => m.user_id !== memberId));
  };

  const toggleFriendSelection = (friendId: string) => {
    // Don't allow selecting someone who's already a current member
    if (currentMembers.some(m => m.user_id === friendId)) {
      return;
    }
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };
  
  // Filter out current members from friends list (and already selected)
  const availableFriends = friends.filter(f => 
    !currentMembers.some(m => m.user_id === f.id) && 
    !selectedFriends.includes(f.id)
  );
  
  // Selected friends that aren't current members
  const friendsToAdd = friends.filter(f => selectedFriends.includes(f.id));

  const getInitials = (name: string): string => 
    name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-lg border-2 border-black bg-white shadow-[8px_8px_0_0_#000]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b-2 border-black bg-white">
          <CardTitle className="text-xl font-bold text-gray-900">
            {editingGroupId ? 'Edit Lens' : 'Create Lens'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0 rounded-md border border-black/30 hover:bg-gray-100 hover:border-black/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)] p-6 bg-white">
          {/* Lens Details */}
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">Lens Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Foodies, Travel Buddies"
                className="w-full rounded-md border border-black/30 shadow-sm focus:shadow-md focus:border-black transition-shadow"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this lens for? (optional)"
                className="w-full rounded-md border border-black/30 shadow-sm focus:shadow-md focus:border-black transition-shadow resize-none"
                rows={3}
              />
            </div>

              <div>
              <label className="text-sm font-semibold text-gray-900 mb-2 block">Icon</label>
              <div className="flex gap-2 flex-wrap">
                  {['👥', '🍕', '✈️', '💼', '🎉', '🏠'].map((emoji) => (
                    <Button
                      key={emoji}
                    variant="outline"
                    size="sm"
                    onClick={() => setIcon(emoji)}
                    className={`w-12 h-12 p-0 rounded-md border-2 transition-all ${
                      icon === emoji
                        ? 'border-black bg-white shadow-[2px_2px_0_0_#000] scale-105'
                        : 'border-black/30 hover:border-black/50 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-xl">{emoji}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Current Members (Edit Mode Only) */}
          {editingGroupId && (
          <div>
              <label className="text-sm font-semibold text-gray-900 mb-3 block">
                Current Members ({currentMembers.length})
              </label>
              {membersLoading ? (
                <div className="text-center py-8 text-gray-500 rounded-md border border-black/10 bg-gray-50">
                  Loading members...
                </div>
              ) : currentMembers.length === 0 ? (
                <div className="text-center py-4 text-gray-500 rounded-md border border-black/10 bg-gray-50">
                  <p className="text-sm">No members yet</p>
                </div>
            ) : (
                <div className="space-y-2 rounded-md border-2 border-black/20 bg-gray-50/50 p-3">
                  {currentMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-3 rounded-md border border-black/20 bg-white"
                    >
                      <Avatar className="h-10 w-10 border border-black/20">
                        <AvatarImage src={member.profile_picture_url} />
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-700">
                          {getInitials(member.display_name || member.user_id)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {member.display_name || member.user_id}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="h-8 w-8 p-0 rounded-md border border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 transition-colors"
                        aria-label="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* People to Add (for Edit Mode) */}
          {editingGroupId && friendsToAdd.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-900 mb-3 block text-green-700">
                Adding {friendsToAdd.length} {friendsToAdd.length === 1 ? 'person' : 'people'}...
              </label>
              <div className="space-y-2 rounded-md border-2 border-green-300 bg-green-50/50 p-3">
                {friendsToAdd.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-green-300 bg-white"
                  >
                    <Avatar className="h-10 w-10 border border-black/20">
                      <AvatarImage src={friend.profile_picture_url} />
                      <AvatarFallback className="text-xs bg-gray-100 text-gray-700">
                        {getInitials(friend.display_name || friend.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {friend.display_name || friend.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFriendSelection(friend.id)}
                      className="h-8 w-8 p-0 rounded-md border border-black/30 hover:bg-gray-100 hover:border-black/50 transition-colors"
                      aria-label="Remove from add list"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People Selection - Available to Add */}
          <div>
            <label className="text-sm font-semibold text-gray-900 mb-3 block">
              {editingGroupId ? 'Add More People' : 'Add People'} (you follow)
            </label>
            {friendsLoading ? (
              <div className="text-center py-8 text-gray-500 rounded-md border border-black/10 bg-gray-50">
                Loading people...
              </div>
            ) : availableFriends.length === 0 && !editingGroupId ? (
              <div className="text-center py-8 text-gray-500 rounded-md border border-black/10 bg-gray-50">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No people found</p>
                <p className="text-xs mt-1">Start following people to add them to your Lenses</p>
              </div>
            ) : availableFriends.length === 0 && editingGroupId ? (
              <div className="text-center py-4 text-gray-500 rounded-md border border-black/10 bg-gray-50">
                <p className="text-sm">All people you follow are already in this lens</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border-2 border-black/20 bg-gray-50/50 p-3">
                {availableFriends.map((friend) => {
                  const isSelected = selectedFriends.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-black bg-white shadow-[2px_2px_0_0_#000]'
                          : 'border-black/20 hover:border-black/40 hover:bg-white/80 hover:shadow-sm'
                      }`}
                      onClick={() => toggleFriendSelection(friend.id)}
                    >
                      <Avatar className="h-10 w-10 border border-black/20">
                        <AvatarImage src={friend.profile_picture_url} />
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-700">
                          {getInitials(friend.display_name || friend.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {friend.display_name || friend.email}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-md border-2 border-black bg-white shadow-[1px_1px_0_0_#000] flex items-center justify-center">
                          <Check className="h-4 w-4 text-black" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Count (Create Mode Only) */}
          {!editingGroupId && selectedFriends.length > 0 && (
            <div className="text-sm font-medium text-gray-700 px-2 py-1.5 rounded-md bg-gray-100 border border-black/10 inline-block">
              {selectedFriends.length} {selectedFriends.length === 1 ? 'person' : 'people'} selected
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="rounded-md border-2 border-red-400 bg-red-50 p-3 text-sm text-red-800 shadow-[2px_2px_0_0_#ef4444]">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
            <Button 
              variant="outline" 
              onClick={handleClose}
              className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all bg-white"
            >
              Cancel
            </Button>
            {!editingGroupId ? (
            <Button
              onClick={handleCreateGroup}
              disabled={!name.trim() || loading}
                className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                style={{ backgroundColor: accentColor, borderColor: '#000', color: textOnAccent }}
            >
                {loading ? 'Creating...' : 'Create Lens'}
              </Button>
            ) : (
              <Button
                onClick={handleUpdateGroup}
                disabled={!name.trim() || loading}
                className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                style={{ backgroundColor: accentColor, borderColor: '#000', color: textOnAccent }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupCreator;
