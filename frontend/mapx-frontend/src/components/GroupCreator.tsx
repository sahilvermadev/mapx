import React, { useState, useEffect } from 'react';
import { X, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { friendGroupsApi, type CreateGroupData } from '@/services/friendGroupsService';
import { socialApi, type User } from '@/services/socialService';

interface GroupCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
  currentUserId: string;
}

const GroupCreator: React.FC<GroupCreatorProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
  currentUserId
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('👥');
  const [visibility, setVisibility] = useState<'private' | 'members'>('private');
  const [friends, setFriends] = useState<User[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load friends when component opens
  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen, currentUserId]);

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

  const handleCreateGroup = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const groupData: CreateGroupData = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        visibility,
        memberIds: selectedFriends
      };

      await friendGroupsApi.createGroup(groupData, currentUserId);
      onGroupCreated();
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

  const handleClose = () => {
    setName('');
    setDescription('');
    setIcon('👥');
    setVisibility('private');
    setSelectedFriends([]);
    setError(null);
    onClose();
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const getInitials = (name: string): string => 
    name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">Create Friend Group</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Group Details */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Group Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Foodies, Travel Buddies"
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                className="w-full"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Icon</label>
                <div className="flex space-x-2">
                  {['👥', '🍕', '✈️', '💼', '🎉', '🏠'].map((emoji) => (
                    <Button
                      key={emoji}
                      variant={icon === emoji ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIcon(emoji)}
                      className="w-10 h-10 p-0"
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Visibility</label>
                <div className="flex space-x-2">
                  <Button
                    variant={visibility === 'private' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVisibility('private')}
                  >
                    Private
                  </Button>
                  <Button
                    variant={visibility === 'members' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVisibility('members')}
                  >
                    Members Only
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Friends Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Add Friends</label>
            {friendsLoading ? (
              <div className="text-center py-4 text-gray-500">Loading friends...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No friends found</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedFriends.includes(friend.id)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={friend.profile_picture_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(friend.display_name || friend.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {friend.display_name || friend.email}
                      </p>
                    </div>
                    {selectedFriends.includes(friend.id) && (
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <Plus className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Friends Count */}
          {selectedFriends.length > 0 && (
            <div className="text-sm text-gray-600">
              {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''} selected
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!name.trim() || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupCreator;
