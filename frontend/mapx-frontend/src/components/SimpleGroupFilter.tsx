import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { friendGroupsApi, type FriendGroup } from '@/services/friendGroups';

interface SimpleGroupFilterProps {
  currentUserId: string;
  selectedGroupIds: number[];
  onGroupToggle: (groupId: number) => void;
  className?: string;
}

const SimpleGroupFilter: React.FC<SimpleGroupFilterProps> = ({
  currentUserId,
  selectedGroupIds,
  onGroupToggle,
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
      if (response && response.success && response.data) {
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
      <div className={`flex flex-wrap gap-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-7 w-20 bg-gray-200 rounded-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return null; // Don't show anything if no groups
  }

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {/* Group buttons */}
      {groups.map((group) => {
        const isSelected = selectedGroupIds.includes(group.id);
        return (
          <button
            key={group.id}
            onClick={() => onGroupToggle(group.id)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
              isSelected 
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            {group.name}
          </button>
        );
      })}
    </div>
  );
};

export default SimpleGroupFilter;
