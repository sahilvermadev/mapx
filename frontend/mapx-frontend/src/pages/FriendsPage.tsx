import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Plus, UserPlus, UserCheck, UserX, Users2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { socialApi, type User } from '@/services/socialService';
import { useAuth } from '@/auth';
import GroupCreator from '@/components/GroupCreator';
import GroupList from '@/components/GroupList';
import { useTheme } from '@/contexts/ThemeContext';
import { THEMES } from '@/services/profileService';
import { getReadableTextColor } from '@/utils/color';

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | undefined>(undefined);
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const [activeFriendsTab, setActiveFriendsTab] = useState<'following' | 'followers' | 'search'>('following');
  const { theme } = useTheme();

  // Get accent color from current theme (reactive to theme changes)
  const selectedTheme = THEMES[theme];
  const accentColor = selectedTheme.accentColor;
  const textOnAccent = getReadableTextColor(accentColor);

  useEffect(() => {
    // Only redirect if auth check is complete and user is not authenticated
    if (!isChecking && !isAuthenticated) {
      navigate('/');
      return;
    }
  }, [isChecking, isAuthenticated, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    loadFollowers();
    loadFollowing();
    if (searchQuery.trim()) {
      searchUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    
    if (searchQuery.trim()) {
      // Automatically switch to search tab when user starts searching
      setActiveFriendsTab('search');
      
      // Debounce the search to avoid too many API calls
      const timeoutId = setTimeout(() => {
        searchUsers();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else {
      setUsers([]);
    }
  }, [searchQuery, currentUser]);

  // Show loading while authentication is being checked
  if (isChecking) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-96" />
            </div>

            {/* Navigation Pills Skeleton */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>

            {/* Search and Content Skeleton */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 flex-1" />
                <div className="flex space-x-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>

              {/* Sub-navigation Skeleton */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>

              {/* User Cards Skeleton */}
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                        <div className="flex gap-4">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  const loadFollowers = async () => {
    setFollowersLoading(true);
    try {
      const response = await socialApi.getFollowers(currentUser.id, currentUser.id, 50, 0);
      if (response.success && response.data) {
        setFollowers(Array.isArray(response.data) ? response.data : response.data.users || []);
      } else {
        setFollowers([]);
      }
    } catch (error) {
      console.error('Failed to load followers:', error);
      setFollowers([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  const loadFollowing = async () => {
    setFollowingLoading(true);
    try {
      const response = await socialApi.getFollowing(currentUser.id, currentUser.id, 50, 0);
      if (response.success && response.data) {
        setFollowing(Array.isArray(response.data) ? response.data : response.data.users || []);
      } else {
        setFollowing([]);
      }
    } catch (error) {
      console.error('Failed to load following:', error);
      setFollowing([]);
    } finally {
      setFollowingLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await socialApi.searchUsers(searchQuery, currentUser.id);
      if (response.success && response.data) {
        setUsers(response.data);
        console.log('Search results:', response.data);
      } else {
        setUsers([]);
        console.log('No search results found');
      }
    } catch (error) {
      console.error('Failed to search users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const follow = async (userId: string) => {
    try {
      await socialApi.followUser(userId, currentUser.id);
      // Update the user's following status in all lists
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
      setFollowing(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
      setFollowers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  const unfollow = async (userId: string) => {
    try {
      await socialApi.unfollowUser(userId, currentUser.id);
      // Update the user's following status in all lists
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
      setFollowing(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
      setFollowers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);


  const renderUserCard = (user: User) => (
    <Card key={user.id} className="bg-white rounded-md border-2 border-black shadow-[3px_3px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] transition-all" onClick={() => navigate(`/profile/${user.id}`)}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3 md:gap-4">
          <Avatar className="h-10 w-10 md:h-12 md:w-12 bg-gray-200 flex-shrink-0">
            <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
            <AvatarFallback className="bg-gray-200 text-gray-600 font-medium text-xs md:text-sm">
              {getInitials(user.display_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
              <h3 className="font-semibold text-sm md:text-base text-gray-900 truncate">{user.display_name}</h3>
              {user.is_following && (
                <span className="text-xs md:text-sm text-gray-600">Following</span>
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-500 truncate mb-1 md:mb-2">
              {user.email}
            </p>
            <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-xs text-gray-500">
              <span>{user.followers_count || 0} followers</span>
              <span>{user.following_count || 0} following</span>
            </div>
          </div>
          <Button
            variant={user.is_following ? 'outline' : 'default'}
            size="sm"
            className={`rounded-md border border-black shadow-[1px_1px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none flex-shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3`}
            style={user.is_following ? {} : { backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click when clicking button
              user.is_following ? unfollow(user.id) : follow(user.id);
            }}
          >
            {user.is_following ? (
              <>
                <UserX className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
                <span className="hidden sm:inline">Unfollow</span>
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
                <span className="hidden sm:inline">Follow</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!currentUser) {
    return (
      <div className="min-h-[calc(100vh-64px)]" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-96" />
            </div>

            {/* Navigation Pills Skeleton */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>

            {/* Search and Content Skeleton */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 flex-1" />
                <div className="flex space-x-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>

              {/* Sub-navigation Skeleton */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>

              {/* User Cards Skeleton */}
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                        <div className="flex gap-4">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)]" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>
      {/* Content Section */}
      <div className="container mx-auto px-4 py-4 md:py-8">
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-8">
          {/* Header Section */}
          <div className="space-y-1 md:space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Friends</h1>
            <p className="text-sm md:text-base text-gray-600">Search for people to follow, view followers, or manage your Lenses.</p>
          </div>

          {/* Main Navigation Pills */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'friends' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('friends')}
              className={`flex items-center gap-1.5 md:gap-2 rounded-md border border-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm whitespace-nowrap`}
              style={activeTab === 'friends' ? { backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent } : {}}
            >
              <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span>Friends</span>
            </Button>
            <Button
              variant={activeTab === 'groups' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-1.5 md:gap-2 rounded-md border border-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm whitespace-nowrap`}
              style={activeTab === 'groups' ? { backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent } : {}}
            >
              <UserPlus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span>Lenses</span>
            </Button>
          </div>

          {/* Friends Tab Content */}
          {activeTab === 'friends' && (
            <div className="space-y-4 md:space-y-6">
              {/* Search bar with counts */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name or email"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full rounded-md border border-black/30 shadow-sm focus:shadow-md transition-shadow h-9 md:h-10"
                  />
                </div>
                
                {/* Counts next to search bar */}
                <div className="flex space-x-3 md:space-x-4 text-xs md:text-sm text-gray-600 whitespace-nowrap">
                  <span>Following {following.length}</span>
                  <span>Followers {followers.length}</span>
                </div>
              </div>

              {/* Full-width sub-navigation */}
              <div className="flex gap-2 w-full">
                <Button
                  variant={activeFriendsTab === 'following' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFriendsTab('following')}
                  className={`flex-1 rounded-md border border-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm`}
                  style={activeFriendsTab === 'following' ? { backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent } : {}}
                >
                  Following
                </Button>
                <Button
                  variant={activeFriendsTab === 'followers' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFriendsTab('followers')}
                  className={`flex-1 rounded-md border border-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm`}
                  style={activeFriendsTab === 'followers' ? { backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent } : {}}
                >
                  Followers
                </Button>
                <Button
                  variant={activeFriendsTab === 'search' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFriendsTab('search')}
                  className={`flex-1 rounded-md border border-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm`}
                  style={activeFriendsTab === 'search' ? { backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent } : {}}
                >
                  Search
                </Button>
              </div>

              {/* Content based on active tab */}
              {activeFriendsTab === 'following' && (
                <div className="space-y-4">
                  {followingLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                              <div className="flex gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : following.length === 0 ? (
                    <div className="text-center py-12">
                      <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">Not Following Anyone</h3>
                      <p className="text-gray-600 max-w-sm mx-auto">
                        Start following people to see their recommendations and discover new places.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {following.map(renderUserCard)}
                    </div>
                  )}
                </div>
              )}

              {activeFriendsTab === 'followers' && (
                <div className="space-y-4">
                  {followersLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                              <div className="flex gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : followers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">No Followers Yet</h3>
                      <p className="text-gray-600 max-w-sm mx-auto">
                        When people follow you, they'll appear here. Share your recommendations to get followers!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {followers.map(renderUserCard)}
                    </div>
                  )}
                </div>
              )}

              {activeFriendsTab === 'search' && (
                <div className="space-y-4">
                  {!searchQuery.trim() ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">Search for People</h3>
                      <p className="text-gray-600 max-w-sm mx-auto">
                        Use the search box above to find people by name or email address.
                      </p>
                    </div>
                  ) : loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                              <div className="flex gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">No Results Found</h3>
                      <p className="text-gray-600">
                        No users found matching "{searchQuery}". Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {users.map(renderUserCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lenses Tab Content */}
          {activeTab === 'groups' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-1.5 md:gap-2">
                    <Filter className="h-5 w-5 md:h-6 md:w-6" />
                    Your Lenses
                  </h2>
                  <p className="text-sm md:text-base text-gray-600 mt-1">
                    Create and manage personal Lenses (lists of people) to filter your feed
                  </p>
                </div>
                <Button
                  onClick={() => setShowGroupCreator(true)}
                  className="rounded-md border-2 border-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-xs md:text-sm whitespace-nowrap flex-shrink-0 w-full sm:w-auto"
                  style={{ backgroundColor: 'var(--app-accent)', borderColor: '#000', color: textOnAccent }}
                >
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Create Lens
                </Button>
              </div>
              
              <GroupList
                key={groupsRefreshKey}
                currentUserId={currentUser.id}
                showActions={true}
                onEditGroup={(groupId) => {
                  setEditingGroupId(groupId);
                  setShowGroupCreator(true);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Group Creator Modal */}
      <GroupCreator
        isOpen={showGroupCreator}
        onClose={() => { setShowGroupCreator(false); setEditingGroupId(undefined); }}
        onGroupCreated={() => {
          // Refresh groups list if needed
          setShowGroupCreator(false);
          setGroupsRefreshKey(k => k + 1);
        }}
        onGroupUpdated={() => {
          setShowGroupCreator(false);
          setEditingGroupId(undefined);
          setGroupsRefreshKey(k => k + 1);
        }}
        currentUserId={currentUser.id}
        editingGroupId={editingGroupId}
      />
    </div>
  );
};

export default React.memo(FriendsPage); 